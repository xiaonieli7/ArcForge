package pbws

import (
	"context"
	"strings"
	"time"

	gatewayv1 "github.com/liveagent/agent-gateway/internal/proto/v1"
	gatewayv2 "github.com/liveagent/agent-gateway/internal/proto/v2"
	"github.com/liveagent/agent-gateway/internal/protocol/shared"
	"github.com/liveagent/agent-gateway/internal/transport/wscore"
)

// handleAgentRequest 直通转发一条浏览器构造的 GatewayEnvelope：白名单/限额校验 →
// request_id 按连接命名空间化 → 经 session 层等待关联响应 → list 类共享后处理 →
// 还原 request_id 回送。取代 v1 约 90 个手工编解码处理器，载荷零翻译。
func (c *browserConn) handleAgentRequest(requestID string, env *gatewayv1.GatewayEnvelope) {
	if requestID == "" {
		_ = c.sendLocalError(requestID, "request id is required")
		return
	}
	if err := vetAgentRequest(c.sm, env); err != nil {
		_ = c.sendLocalError(requestID, err.Error())
		return
	}

	// 命名空间化：多标签页共享一个桌面端，透传 id 必须按连接隔离；回程剥离前缀还原。
	agentRequestID := c.idPrefix + requestID
	env.RequestId = agentRequestID
	if env.GetTimestamp() == 0 {
		env.Timestamp = time.Now().Unix()
	}

	ctx, cancel := context.WithTimeout(context.Background(), c.srv.requestTimeout())
	defer cancel()
	go func() {
		select {
		case <-c.done:
			cancel()
		case <-ctx.Done():
		}
	}()

	response, err := c.sm.AwaitUnaryResponse(ctx, agentRequestID, env)
	if err != nil {
		_ = c.sendLocalError(requestID, errorMessage(err))
		return
	}

	// list 类终端响应的合并/过滤与兴趣登记（与 v1 同一份域逻辑）。
	if terminalResp := response.GetTerminalResponse(); terminalResp != nil {
		req := env.GetTerminalRequest()
		finalized := shared.FinalizeTerminalResponse(
			c.sm,
			c.terminalInterest,
			strings.TrimSpace(req.GetAction()),
			strings.TrimSpace(req.GetProjectPathKey()),
			terminalResp,
		)
		if finalized != terminalResp {
			response.Payload = &gatewayv1.AgentEnvelope_TerminalResponse{TerminalResponse: finalized}
		}
	}

	// 还原关联 id 后原样回送（含 error=99 臂：错误语义交由客户端处理，与 v1
	// writeError(errResp.Message) 等价但保留结构化错误码）。
	response.RequestId = requestID
	_ = c.send(wscore.FrameResponse, "agent_response", &gatewayv2.WebServerFrame{
		RequestId: requestID,
		Payload:   &gatewayv2.WebServerFrame_AgentResponse{AgentResponse: response},
	})
}
