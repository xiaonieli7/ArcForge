package shared

import (
	"testing"

	gatewayv1 "github.com/liveagent/agent-gateway/internal/proto/v1"
)

func TestTerminalInterestTrackerFiltersOutputBySession(t *testing.T) {
	t.Parallel()

	tracker := NewTerminalInterestTracker()
	outputEvent := &gatewayv1.TerminalEvent{
		Kind:           "output",
		SessionId:      "session-1",
		ProjectPathKey: "project-1",
	}
	metadataEvent := &gatewayv1.TerminalEvent{
		Kind:           "created",
		SessionId:      "session-1",
		ProjectPathKey: "project-1",
	}

	if tracker.ShouldForward(outputEvent) {
		t.Fatal("output should not forward before a session is attached")
	}
	if !tracker.ShouldForward(metadataEvent) {
		t.Fatal("metadata should forward so project/session lists stay fresh")
	}

	tracker.RememberSession("session-1", "project-1")
	if !tracker.ShouldForward(outputEvent) {
		t.Fatal("output should forward after attaching the session")
	}

	tracker.Forget("session-1", "project-1")
	if tracker.ShouldForward(outputEvent) {
		t.Fatal("output should stop forwarding after detaching the session")
	}
}
