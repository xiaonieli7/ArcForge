package pbws

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"google.golang.org/protobuf/proto"

	"github.com/liveagent/agent-gateway/internal/observability"
	gatewayv1 "github.com/liveagent/agent-gateway/internal/proto/v1"
	gatewayv2 "github.com/liveagent/agent-gateway/internal/proto/v2"
	"github.com/liveagent/agent-gateway/internal/protocol/shared"
	"github.com/liveagent/agent-gateway/internal/session"
)

// 终端数据面（/ws/v2/terminal）：两端共用一条路径，角色由 hello 区分——浏览器角色对应
// v1 /ws/terminal 自定义二进制流（attach/detach 登记、input/resize 需已附着、按订阅过滤），
// Agent 角色对应 v1 gRPC AgentTerminalConnect（登记到-agent 通道、广播入站帧）。
// 帧载荷直接复用 proto TerminalStreamFrame，淘汰 v1 浏览器侧的手工帧格式。

const terminalWriteQueueSize = 1024

// TerminalHandler 返回 /ws/v2/terminal 的 HTTP 处理器。
func (s *Server) TerminalHandler() http.Handler {
	upgrader := s.upgrader()
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		conn.SetReadLimit(s.readLimit())
		s.serveTerminal(conn)
	})
}

func (s *Server) serveTerminal(conn *websocket.Conn) {
	defer func() { _ = conn.Close() }()

	frame, ok := readTerminalFrame(conn)
	if !ok {
		return
	}
	hello := frame.GetHello()
	// 终端路径两端共用：按 hello 声明的角色校验（未声明按浏览器处理）。
	wantRole := hello.GetRole()
	if wantRole == gatewayv2.ClientRole_CLIENT_ROLE_UNSPECIFIED {
		wantRole = gatewayv2.ClientRole_CLIENT_ROLE_BROWSER
	}
	verdict := s.vetHello(hello, wantRole)
	if !verdict.ok {
		_ = writeDirectMessage(conn, s.writeTimeout(), &gatewayv2.TerminalServerFrame{
			Payload: &gatewayv2.TerminalServerFrame_Hello{
				Hello: s.serverHello(false, verdict.message, ""),
			},
		})
		closeUnauthorized(conn, s.writeTimeout())
		return
	}
	if err := writeDirectMessage(conn, s.writeTimeout(), &gatewayv2.TerminalServerFrame{
		Payload: &gatewayv2.TerminalServerFrame_Hello{
			Hello: s.serverHello(true, "", ""),
		},
	}); err != nil {
		return
	}

	if wantRole == gatewayv2.ClientRole_CLIENT_ROLE_AGENT {
		observability.Usage.V2TerminalConnectsTotal.Add(1)
		s.serveTerminalAgent(conn)
		return
	}
	observability.Usage.V2TerminalConnectsTotal.Add(1)
	s.serveTerminalBrowser(conn)
}

func readTerminalFrame(conn *websocket.Conn) (*gatewayv2.TerminalClientFrame, bool) {
	for {
		messageType, data, err := conn.ReadMessage()
		if err != nil {
			return nil, false
		}
		if messageType != websocket.BinaryMessage {
			continue
		}
		var frame gatewayv2.TerminalClientFrame
		if err := proto.Unmarshal(data, &frame); err != nil {
			return nil, false
		}
		return &frame, true
	}
}

// ---------------------------------------------------------------------------
// Agent 角色（对应 v1 gRPC AgentTerminalConnect）
// ---------------------------------------------------------------------------

func (s *Server) serveTerminalAgent(conn *websocket.Conn) {
	toAgent := make(chan *gatewayv1.TerminalStreamFrame, 4096)
	cleanup := s.sm.RegisterTerminalStreamToAgent(toAgent)
	defer cleanup()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go func() {
		<-ctx.Done()
		_ = conn.Close()
	}()

	go func() {
		defer cancel()
		for {
			select {
			case <-ctx.Done():
				return
			case frame := <-toAgent:
				if frame == nil {
					continue
				}
				if !s.writeTerminalFrame(conn, frame) {
					return
				}
			}
		}
	}()

	for {
		frame, ok := readTerminalFrame(conn)
		if !ok {
			cancel()
			return
		}
		if streamFrame := frame.GetFrame(); streamFrame != nil {
			s.sm.BroadcastTerminalStreamFrame(streamFrame)
		}
	}
}

func (s *Server) writeTerminalFrame(conn *websocket.Conn, frame *gatewayv1.TerminalStreamFrame) bool {
	data, err := proto.Marshal(&gatewayv2.TerminalServerFrame{
		Payload: &gatewayv2.TerminalServerFrame_Frame{Frame: frame},
	})
	if err != nil {
		return false
	}
	if timeout := s.writeTimeout(); timeout > 0 {
		if err := conn.SetWriteDeadline(time.Now().Add(timeout)); err != nil {
			return false
		}
		defer func() { _ = conn.SetWriteDeadline(time.Time{}) }()
	}
	return conn.WriteMessage(websocket.BinaryMessage, data) == nil
}

// ---------------------------------------------------------------------------
// 浏览器角色（对应 v1 /ws/terminal 二进制流）
// ---------------------------------------------------------------------------

type terminalBrowserConn struct {
	srv  *Server
	sm   *session.Manager
	conn *websocket.Conn

	out  chan []byte
	done chan struct{}
	once sync.Once

	mu       sync.RWMutex
	attached map[string]struct{}
	streams  map[string]struct{}
}

func (s *Server) serveTerminalBrowser(conn *websocket.Conn) {
	c := &terminalBrowserConn{
		srv:      s,
		sm:       s.sm,
		conn:     conn,
		out:      make(chan []byte, terminalWriteQueueSize),
		done:     make(chan struct{}),
		attached: make(map[string]struct{}),
		streams:  make(map[string]struct{}),
	}
	defer c.close()

	go c.writeLoop()
	c.startForwarder()

	for {
		frame, ok := readTerminalFrame(conn)
		if !ok {
			return
		}
		streamFrame := frame.GetFrame()
		if streamFrame == nil {
			continue
		}
		c.handleFrame(streamFrame)
	}
}

func (c *terminalBrowserConn) handleFrame(frame *gatewayv1.TerminalStreamFrame) {
	kind := strings.TrimSpace(frame.GetKind())
	if !c.frameAllowed(frame) {
		c.enqueueFrame(terminalErrorFrame(frame, shared.TerminalPermissionError(kind)))
		return
	}

	switch kind {
	case "attach":
		c.remember(frame.GetSessionId(), frame.GetStreamId())
	case "detach":
		c.forget(frame.GetSessionId(), frame.GetStreamId())
	case "input", "resize":
		if !c.isAttached(frame.GetSessionId()) {
			c.enqueueFrame(terminalErrorFrame(frame, "terminal stream is not attached"))
			return
		}
	default:
		c.enqueueFrame(terminalErrorFrame(frame, "unsupported terminal stream frame"))
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := c.sm.SendTerminalFrameToAgent(ctx, frame); err != nil {
		message := "desktop agent is offline"
		if !errors.Is(err, session.ErrAgentOffline) {
			message = err.Error()
		}
		c.enqueueFrame(terminalErrorFrame(frame, message))
	}
}

func (c *terminalBrowserConn) frameAllowed(frame *gatewayv1.TerminalStreamFrame) bool {
	if frame == nil {
		return false
	}
	sessionID := strings.TrimSpace(frame.GetSessionId())
	switch c.sm.TerminalSessionKind(sessionID) {
	case "ssh":
		return c.sm.WebSshTerminalEnabled()
	case "local":
		return c.sm.WebTerminalEnabled()
	default:
		return c.sm.WebTerminalEnabled() || c.sm.WebSshTerminalEnabled()
	}
}

func (c *terminalBrowserConn) startForwarder() {
	frames, cleanup := c.sm.SubscribeTerminalStreamFrames()
	go func() {
		defer cleanup()
		for {
			select {
			case <-c.done:
				return
			case frame, ok := <-frames:
				if !ok {
					c.close()
					return
				}
				if !c.shouldForward(frame) {
					continue
				}
				c.enqueueFrame(frame)
			}
		}
	}()
}

func (c *terminalBrowserConn) shouldForward(frame *gatewayv1.TerminalStreamFrame) bool {
	if frame == nil {
		return false
	}
	kind := strings.TrimSpace(frame.GetKind())
	if kind == "snapshot" || kind == "error" {
		return c.knowsStream(frame.GetStreamId())
	}
	if kind != "output" {
		return false
	}
	return c.isAttached(frame.GetSessionId())
}

func (c *terminalBrowserConn) remember(sessionID string, streamID string) {
	sessionID = strings.TrimSpace(sessionID)
	streamID = strings.TrimSpace(streamID)
	if sessionID == "" && streamID == "" {
		return
	}
	c.mu.Lock()
	if sessionID != "" {
		c.attached[sessionID] = struct{}{}
	}
	if streamID != "" {
		c.streams[streamID] = struct{}{}
	}
	c.mu.Unlock()
}

func (c *terminalBrowserConn) forget(sessionID string, streamID string) {
	sessionID = strings.TrimSpace(sessionID)
	streamID = strings.TrimSpace(streamID)
	if sessionID == "" && streamID == "" {
		return
	}
	c.mu.Lock()
	if sessionID != "" {
		delete(c.attached, sessionID)
	}
	if streamID != "" {
		delete(c.streams, streamID)
	}
	c.mu.Unlock()
}

func (c *terminalBrowserConn) isAttached(sessionID string) bool {
	sessionID = strings.TrimSpace(sessionID)
	if sessionID == "" {
		return false
	}
	c.mu.RLock()
	_, ok := c.attached[sessionID]
	c.mu.RUnlock()
	return ok
}

func (c *terminalBrowserConn) knowsStream(streamID string) bool {
	streamID = strings.TrimSpace(streamID)
	if streamID == "" {
		return false
	}
	c.mu.RLock()
	_, ok := c.streams[streamID]
	c.mu.RUnlock()
	return ok
}

// enqueueFrame 与 v1 语义一致：队列满即关闭连接（终端输出无可容忍的丢帧语义，
// 客户端重连后 attach + snapshot 恢复）。
func (c *terminalBrowserConn) enqueueFrame(frame *gatewayv1.TerminalStreamFrame) {
	data, err := proto.Marshal(&gatewayv2.TerminalServerFrame{
		Payload: &gatewayv2.TerminalServerFrame_Frame{Frame: frame},
	})
	if err != nil {
		return
	}
	select {
	case <-c.done:
	case c.out <- data:
	default:
		c.close()
	}
}

func (c *terminalBrowserConn) writeLoop() {
	for {
		select {
		case <-c.done:
			return
		case payload := <-c.out:
			if timeout := c.srv.writeTimeout(); timeout > 0 {
				_ = c.conn.SetWriteDeadline(time.Now().Add(timeout))
			}
			if err := c.conn.WriteMessage(websocket.BinaryMessage, payload); err != nil {
				c.close()
				return
			}
			_ = c.conn.SetWriteDeadline(time.Time{})
		}
	}
}

func (c *terminalBrowserConn) close() {
	c.once.Do(func() {
		close(c.done)
		_ = c.conn.Close()
	})
}

func terminalErrorFrame(source *gatewayv1.TerminalStreamFrame, message string) *gatewayv1.TerminalStreamFrame {
	return &gatewayv1.TerminalStreamFrame{
		Kind:           "error",
		StreamId:       strings.TrimSpace(source.GetStreamId()),
		SessionId:      strings.TrimSpace(source.GetSessionId()),
		ProjectPathKey: strings.TrimSpace(source.GetProjectPathKey()),
		Error:          strings.TrimSpace(message),
	}
}
