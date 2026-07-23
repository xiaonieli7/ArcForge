package pbws

import (
	"strings"
	"time"

	"github.com/gorilla/websocket"

	"github.com/liveagent/agent-gateway/internal/auth"
	gatewayv2 "github.com/liveagent/agent-gateway/internal/proto/v2"
)

// helloVerdict 是握手校验结果；ok=false 时 message 面向客户端。
type helloVerdict struct {
	ok      bool
	message string
}

// vetHello 校验 ClientHello 的协议版本、角色与令牌（常量时间比较）。
func (s *Server) vetHello(hello *gatewayv2.ClientHello, wantRole gatewayv2.ClientRole) helloVerdict {
	if hello == nil {
		return helloVerdict{message: "hello frame is required"}
	}
	if hello.GetProtocolVersion() != ProtocolVersion {
		return helloVerdict{message: "unsupported protocol version"}
	}
	role := hello.GetRole()
	// hello 缺省角色按端点预期补齐（路径已可区分）；显式错误角色拒绝，防止 agent 帧被当浏览器帧处理。
	if role != gatewayv2.ClientRole_CLIENT_ROLE_UNSPECIFIED && role != wantRole {
		return helloVerdict{message: "unexpected client role"}
	}
	if !auth.ValidateToken(hello.GetToken(), s.cfg.Token) {
		return helloVerdict{message: "unauthorized"}
	}
	return helloVerdict{ok: true}
}

// serverHello 构造握手应答；sessionID 仅 agent 角色使用。
func (s *Server) serverHello(ok bool, message string, sessionID string) *gatewayv2.ServerHello {
	return &gatewayv2.ServerHello{
		Ok:                     ok,
		Message:                strings.TrimSpace(message),
		SessionId:              strings.TrimSpace(sessionID),
		ServerTime:             time.Now().Unix(),
		HeartbeatPeriodSeconds: uint32(s.heartbeatPeriod() / time.Second),
		MaxMessageBytes:        uint64(s.readLimit()),
	}
}

// closeUnauthorized 以鉴权失败码关闭连接（调用方已写出失败 hello）。
func closeUnauthorized(conn *websocket.Conn, timeout time.Duration) {
	deadline := time.Now().Add(timeout)
	_ = conn.WriteControl(
		websocket.CloseMessage,
		websocket.FormatCloseMessage(closeCodeUnauthorized, "unauthorized"),
		deadline,
	)
	_ = conn.Close()
}
