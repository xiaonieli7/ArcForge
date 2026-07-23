package wscore

import (
	"time"

	"github.com/gorilla/websocket"
)

// StartHeartbeat 启动心跳与空闲驱逐循环（幂等），每周期依次：空闲检查（超过 IdleTimeout
// 即关连接，唯一驱逐裁决点）；WS 控制帧 ping（浏览器网络进程应答，冻结/节流标签页也能证明存活）；
// buildPing 构造的应用层 ping（页面 JS 唯一可观测入站活动，尽力而为，掉帧不影响驱逐裁决）。
func (c *Conn) StartHeartbeat(buildPing func() (Frame, bool)) {
	c.heartbeatOnce.Do(func() {
		period := c.cfg.HeartbeatPeriod
		if period <= 0 {
			period = defaultHeartbeatPeriod
		}
		go func() {
			ticker := time.NewTicker(period)
			defer ticker.Stop()
			for {
				select {
				case <-c.done:
					return
				case <-ticker.C:
					c.lastInboundMu.Lock()
					lastInbound := c.lastInboundAt
					c.lastInboundMu.Unlock()
					if time.Since(lastInbound) > c.IdleTimeout() {
						c.Close()
						return
					}
					deadline := time.Now().Add(c.ControlWriteTimeout())
					_ = c.ws.WriteControl(websocket.PingMessage, nil, deadline)
					if buildPing != nil {
						if frame, ok := buildPing(); ok {
							_ = c.Enqueue(frame)
						}
					}
				}
			}
		}()
	})
}
