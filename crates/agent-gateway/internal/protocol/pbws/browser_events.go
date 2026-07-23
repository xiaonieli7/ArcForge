package pbws

import (
	"encoding/json"
	"errors"
	"strings"
	"sync"

	gatewayv1 "github.com/liveagent/agent-gateway/internal/proto/v1"
	gatewayv2 "github.com/liveagent/agent-gateway/internal/proto/v2"
	"github.com/liveagent/agent-gateway/internal/protocol/shared"
	"github.com/liveagent/agent-gateway/internal/session"
	"github.com/liveagent/agent-gateway/internal/transport/wscore"
)

// 浏览器连接的订阅生命周期、九路广播转发与连接后快照回放，语义与 v1 转发器一一对应：
// 广播帧可掉（errWriteQueueFull 跳过继续），chat 会话流掉帧则发订阅重置信号让客户端按
// after_seq 断点续传。

// workspaceSubscription 是一个 workdir 的活动订阅（对应 v1 同名结构）。
type workspaceSubscription struct {
	cancel func()
	done   chan struct{}
	once   sync.Once
}

func (s *workspaceSubscription) close() {
	s.once.Do(func() {
		close(s.done)
		s.cancel()
	})
}

// releaseSubscriptions 由 core 关闭回调（恰好一次），释放 chat/workspace 订阅；
// 九路广播转发器各自监听 done 退出并 defer cleanup。
func (c *browserConn) releaseSubscriptions() {
	c.chatStreamsMu.Lock()
	for conversationID, cancel := range c.chatStreams {
		cancel()
		delete(c.chatStreams, conversationID)
	}
	c.chatStreamsMu.Unlock()

	c.workspaceSubsMu.Lock()
	for workdir, sub := range c.workspaceSubs {
		sub.close()
		delete(c.workspaceSubs, workdir)
	}
	c.workspaceSubsMu.Unlock()
}

// ---------------------------------------------------------------------------
// chat 会话流订阅
// ---------------------------------------------------------------------------

// handleChatSubscribe 对应 v1 "chat.subscribe"（读循环内联执行以保帧序）。
func (c *browserConn) handleChatSubscribe(requestID string, req *gatewayv2.ChatSubscribeRequest) {
	conversationID := strings.TrimSpace(req.GetConversationId())
	if conversationID == "" {
		_ = c.sendLocalError(requestID, "conversation_id is required")
		return
	}

	sub := c.sm.SubscribeConversationStream(conversationID, req.GetAfterSeq(), req.GetStreamEpoch())

	events := make([][]byte, 0, len(sub.Events))
	for _, event := range sub.Events {
		payload, err := json.Marshal(event.Payload)
		if err != nil {
			continue
		}
		events = append(events, payload)
	}
	result := &gatewayv2.ChatSubscribeResult{
		ConversationId: sub.ConversationID,
		StreamEpoch:    sub.StreamEpoch,
		LatestSeq:      sub.LatestSeq,
		Reset_:         sub.Reset,
		Activity:       chatRunActivity(sub.Activity),
		Snapshot:       chatRunSnapshot(sub.Snapshot),
		EventsJson:     events,
	}

	// 先登记（替换同会话旧订阅）再应答，避免回放边界之后发布的事件被漏。
	c.chatStreamsMu.Lock()
	if c.chatStreams == nil {
		c.chatStreams = make(map[string]func())
	}
	if previous := c.chatStreams[conversationID]; previous != nil {
		previous()
	}
	c.chatStreams[conversationID] = sub.Cleanup
	c.chatStreamsMu.Unlock()

	if err := c.send(wscore.FrameResponse, "chat_subscribed", &gatewayv2.WebServerFrame{
		RequestId: requestID,
		Payload:   &gatewayv2.WebServerFrame_ChatSubscribed{ChatSubscribed: result},
	}); err != nil {
		sub.Cleanup()
		c.chatStreamsMu.Lock()
		// Cleanup 幂等：仅当仍指向本次订阅时移除登记。
		delete(c.chatStreams, conversationID)
		c.chatStreamsMu.Unlock()
		// 被掉帧的订阅响应会让客户端干等到超时且无人重订阅；控制队列上的重置信号重新武装其恢复循环。
		if errors.Is(err, wscore.ErrWriteQueueFull) {
			c.sendSubscriptionResetOrClose(conversationID)
		}
		return
	}

	go c.forwardConversationEvents(conversationID, sub)
}

// handleChatUnsubscribe 对应 v1 "chat.unsubscribe"。
func (c *browserConn) handleChatUnsubscribe(requestID string, req *gatewayv2.ChatUnsubscribeRequest) {
	conversationID := strings.TrimSpace(req.GetConversationId())

	c.chatStreamsMu.Lock()
	if cancel := c.chatStreams[conversationID]; cancel != nil {
		cancel()
		delete(c.chatStreams, conversationID)
	}
	c.chatStreamsMu.Unlock()

	_ = c.sendAck(requestID)
}

func (c *browserConn) sendAck(requestID string) error {
	return c.send(wscore.FrameResponse, "ack", &gatewayv2.WebServerFrame{
		RequestId: requestID,
		Payload:   &gatewayv2.WebServerFrame_Ack{Ack: &gatewayv2.AckResult{Ok: true}},
	})
}

// forwardConversationEvents 推送订阅后的实时会话事件；订阅通道溢出或写队列持续拥塞时
// 通知客户端重订阅（after_seq 从缓冲重放缺口），拥塞只牺牲该订阅、不牺牲连接。
func (c *browserConn) forwardConversationEvents(
	conversationID string,
	sub *session.ConversationSubscription,
) {
	defer sub.Cleanup()
	for {
		select {
		case <-c.done:
			return
		case event, ok := <-sub.EventCh:
			if !ok {
				if sub.Overflowed() {
					c.sendSubscriptionResetOrClose(conversationID)
				}
				return
			}
			payload, err := json.Marshal(event.Payload)
			if err != nil {
				continue
			}
			if err := c.send(wscore.FrameData, "chat_event", &gatewayv2.WebServerFrame{
				Payload: &gatewayv2.WebServerFrame_ChatEvent{
					ChatEvent: &gatewayv2.ChatStreamEvent{
						ConversationId: conversationID,
						Seq:            event.Seq,
						PayloadJson:    payload,
					},
				},
			}); err != nil {
				if errors.Is(err, wscore.ErrWriteQueueFull) {
					// 重置帧走控制队列越过拥塞积压；客户端重同步后按 seq 去重在途旧事件。
					c.sendSubscriptionResetOrClose(conversationID)
				}
				return
			}
		}
	}
}

// sendSubscriptionResetOrClose 送出恢复被掉订阅的唯一信号；连控制队列都容不下时关闭连接，
// 重连后的重订阅（after_seq）是仅剩的不可丢路径。
func (c *browserConn) sendSubscriptionResetOrClose(conversationID string) {
	if err := c.send(wscore.FrameControl, "chat_subscription_reset", &gatewayv2.WebServerFrame{
		Payload: &gatewayv2.WebServerFrame_ChatSubscriptionReset{
			ChatSubscriptionReset: &gatewayv2.ChatSubscriptionReset{ConversationId: conversationID},
		},
	}); err != nil {
		c.core.Close()
	}
}

// ---------------------------------------------------------------------------
// workspace 活动订阅
// ---------------------------------------------------------------------------

// handleWorkspaceSubscribe 对应 v1 "workspace.subscribe"（读循环内联）。
func (c *browserConn) handleWorkspaceSubscribe(requestID string, req *gatewayv2.WorkspaceSubscribeRequest) {
	workdir := strings.TrimSpace(req.GetWorkdir())
	if workdir == "" {
		_ = c.sendLocalError(requestID, "workdir is required")
		return
	}

	events, cancel := c.sm.SubscribeWorkspaceActivity(workdir)
	sub := &workspaceSubscription{
		cancel: cancel,
		done:   make(chan struct{}),
	}

	c.workspaceSubsMu.Lock()
	if c.workspaceSubs == nil {
		c.workspaceSubs = make(map[string]*workspaceSubscription)
	}
	if previous := c.workspaceSubs[workdir]; previous != nil {
		previous.close()
	}
	c.workspaceSubs[workdir] = sub
	c.workspaceSubsMu.Unlock()

	if err := c.sendAck(requestID); err != nil {
		sub.close()
		c.workspaceSubsMu.Lock()
		if c.workspaceSubs[workdir] == sub {
			delete(c.workspaceSubs, workdir)
		}
		c.workspaceSubsMu.Unlock()
		return
	}

	go func() {
		for {
			select {
			case <-c.done:
				return
			case <-sub.done:
				return
			case event, ok := <-events:
				if !ok {
					return
				}
				if err := c.send(wscore.FrameData, "workspace_activity", &gatewayv2.WebServerFrame{
					Payload: &gatewayv2.WebServerFrame_WorkspaceActivity{WorkspaceActivity: event},
				}); err != nil {
					if errors.Is(err, wscore.ErrWriteQueueFull) {
						continue
					}
					return
				}
			}
		}
	}()
}

// handleWorkspaceUnsubscribe 对应 v1 "workspace.unsubscribe"。
func (c *browserConn) handleWorkspaceUnsubscribe(requestID string, req *gatewayv2.WorkspaceUnsubscribeRequest) {
	workdir := strings.TrimSpace(req.GetWorkdir())

	c.workspaceSubsMu.Lock()
	if sub := c.workspaceSubs[workdir]; sub != nil {
		sub.close()
		delete(c.workspaceSubs, workdir)
	}
	c.workspaceSubsMu.Unlock()

	_ = c.sendAck(requestID)
}

// ---------------------------------------------------------------------------
// 广播事件扇出与快照回放
// ---------------------------------------------------------------------------

// startEventForwarders 启动九路广播转发（对应 v1 的 startXxxForwarder 组）；
// 泛型 forward 统一可掉帧广播骨架，各路只提供订阅与帧构造。
func (c *browserConn) startEventForwarders() {
	forward(c, c.sm.SubscribeHistorySync, func(event *gatewayv1.HistorySyncEvent) (*gatewayv2.WebServerFrame, bool) {
		return &gatewayv2.WebServerFrame{
			Payload: &gatewayv2.WebServerFrame_HistoryEvent{HistoryEvent: event},
		}, true
	}, "history_event")

	forward(c, c.sm.SubscribeSettingsSync, func(event *gatewayv1.SettingsSyncEvent) (*gatewayv2.WebServerFrame, bool) {
		return &gatewayv2.WebServerFrame{
			Payload: &gatewayv2.WebServerFrame_SettingsEvent{SettingsEvent: event},
		}, true
	}, "settings_event")

	forward(c, c.sm.SubscribeTerminalEvents, func(event *gatewayv1.TerminalEvent) (*gatewayv2.WebServerFrame, bool) {
		if !shared.TerminalEventAllowed(c.sm, event) || !c.terminalInterest.ShouldForward(event) {
			return nil, false
		}
		return &gatewayv2.WebServerFrame{
			Payload: &gatewayv2.WebServerFrame_TerminalEvent{TerminalEvent: event},
		}, true
	}, "terminal_event")

	forward(c, c.sm.SubscribeSftpEvents, func(event *gatewayv1.SftpEvent) (*gatewayv2.WebServerFrame, bool) {
		if !c.sm.WebSshTerminalEnabled() {
			return nil, false
		}
		return &gatewayv2.WebServerFrame{
			Payload: &gatewayv2.WebServerFrame_SftpEvent{SftpEvent: event},
		}, true
	}, "sftp_event")

	forward(c, c.sm.SubscribeChatQueueEvents, func(event *gatewayv1.ChatQueueEvent) (*gatewayv2.WebServerFrame, bool) {
		return &gatewayv2.WebServerFrame{
			Payload: &gatewayv2.WebServerFrame_ChatQueueEvent{ChatQueueEvent: event},
		}, true
	}, "chat_queue_event")

	forward(c, c.sm.SubscribeChatActivity, func(event session.ConversationActivityEvent) (*gatewayv2.WebServerFrame, bool) {
		return &gatewayv2.WebServerFrame{
			Payload: &gatewayv2.WebServerFrame_ChatActivity{ChatActivity: chatActivityEvent(event)},
		}, true
	}, "chat_activity")

	forward(c, c.sm.SubscribeTunnelState, func(event *gatewayv1.TunnelStateSnapshot) (*gatewayv2.WebServerFrame, bool) {
		return &gatewayv2.WebServerFrame{
			Payload: &gatewayv2.WebServerFrame_TunnelState{TunnelState: event},
		}, true
	}, "tunnel_state")

	forward(c, c.sm.SubscribeManagedProcessState, func(event *gatewayv1.ManagedProcessSnapshot) (*gatewayv2.WebServerFrame, bool) {
		return &gatewayv2.WebServerFrame{
			Payload: &gatewayv2.WebServerFrame_ProcessState{ProcessState: event},
		}, true
	}, "process_state")

	forward(c, c.sm.SubscribeStatus, func(status session.Status) (*gatewayv2.WebServerFrame, bool) {
		return &gatewayv2.WebServerFrame{
			Payload: &gatewayv2.WebServerFrame_Status{Status: statusEvent(status)},
		}, true
	}, "status")
}

// forward 是可掉帧广播转发的共用骨架：subscribe 建立订阅（cleanup 随 goroutine 退出执行），
// build 过滤并构造帧；掉帧跳过继续，其他写错误结束转发。
func forward[T any](
	c *browserConn,
	subscribe func() (<-chan T, func()),
	build func(T) (*gatewayv2.WebServerFrame, bool),
	kind string,
) {
	events, cleanup := subscribe()
	go func() {
		defer cleanup()
		for {
			select {
			case <-c.done:
				return
			case event, ok := <-events:
				if !ok {
					return
				}
				frame, send := build(event)
				if !send {
					continue
				}
				if err := c.send(wscore.FrameData, kind, frame); err != nil {
					if errors.Is(err, wscore.ErrWriteQueueFull) {
						continue
					}
					return
				}
			}
		}
	}()
}

// replaySnapshots 在鉴权后把当前状态画到新连接上（与 v1 四组回放一致），免去首轮轮询。
func (c *browserConn) replaySnapshots() {
	// 终端会话快照：以 created 事件逐条回放。
	if shared.TerminalFeaturesEnabled(c.sm) {
		for _, terminalSession := range c.sm.TerminalSessionSnapshot("") {
			if !shared.TerminalSessionAllowed(c.sm, terminalSession) {
				continue
			}
			if err := c.send(wscore.FrameData, "terminal_event", &gatewayv2.WebServerFrame{
				Payload: &gatewayv2.WebServerFrame_TerminalEvent{
					TerminalEvent: &gatewayv1.TerminalEvent{
						Kind:           "created",
						SessionId:      terminalSession.GetId(),
						ProjectPathKey: terminalSession.GetProjectPathKey(),
						Session:        terminalSession,
					},
				},
			}); err != nil {
				return
			}
		}
	}

	// 隧道/进程快照：空快照发空消息（等价 v1 默认空 payload——revision 0、无条目），
	// 保证客户端拿到确定的初始状态。
	tunnelSnapshot := c.sm.TunnelStateSnapshot()
	if tunnelSnapshot == nil {
		tunnelSnapshot = &gatewayv1.TunnelStateSnapshot{}
	}
	_ = c.send(wscore.FrameData, "tunnel_state", &gatewayv2.WebServerFrame{
		Payload: &gatewayv2.WebServerFrame_TunnelState{TunnelState: tunnelSnapshot},
	})
	processSnapshot := c.sm.ManagedProcessSnapshotCached()
	if processSnapshot == nil {
		processSnapshot = &gatewayv1.ManagedProcessSnapshot{}
	}
	_ = c.send(wscore.FrameData, "process_state", &gatewayv2.WebServerFrame{
		Payload: &gatewayv2.WebServerFrame_ProcessState{ProcessState: processSnapshot},
	})
	_ = c.send(wscore.FrameData, "status", &gatewayv2.WebServerFrame{
		Payload: &gatewayv2.WebServerFrame_Status{Status: statusEvent(c.sm.Status())},
	})
}
