package session

import (
	"context"

	gatewayv1 "github.com/liveagent/agent-gateway/internal/proto/v1"
)

// AwaitUnaryResponse 以单次请求-响应语义向桌面端发送信封并等待首条关联响应；
// v1/v2 协议层共用，取消/超时由调用方 ctx 控制。
func (m *Manager) AwaitUnaryResponse(
	ctx context.Context,
	requestID string,
	envelope *gatewayv1.GatewayEnvelope,
) (*gatewayv1.AgentEnvelope, error) {
	ch, done, cleanup, err := m.RegisterStreamAndSendContext(ctx, requestID, envelope)
	if err != nil {
		return nil, err
	}
	defer cleanup()

	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-done:
		return nil, ErrAgentOffline
	case env, ok := <-ch:
		if !ok {
			return nil, ErrAgentOffline
		}
		return env, nil
	}
}
