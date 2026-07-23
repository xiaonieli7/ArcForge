package handler

import (
	"net/http"

	"github.com/liveagent/agent-gateway/internal/observability"
	"github.com/liveagent/agent-gateway/internal/session"
)

// statusResponse 在 agent 状态之上追加协议使用计数；内嵌保持既有字段展平不变，protocol_usage 为纯增量字段，旧客户端自动忽略。
type statusResponse struct {
	session.Status
	ProtocolUsage map[string]int64 `json:"protocol_usage"`
}

func Status(sm *session.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, statusResponse{
			Status:        sm.Status(),
			ProtocolUsage: observability.Usage.Snapshot(),
		})
	}
}
