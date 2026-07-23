package auth_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/liveagent/agent-gateway/internal/auth"
)

func TestHTTPMiddlewareRequiresValidBearerToken(t *testing.T) {
	t.Parallel()

	var called bool
	handler := auth.HTTPMiddleware(" secret-token\r\n", http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		called = true
		w.WriteHeader(http.StatusNoContent)
	}))

	cases := []struct {
		name          string
		authorization string
		wantStatus    int
		wantCalled    bool
	}{
		{
			name:       "missing header",
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:          "wrong scheme",
			authorization: "Token secret-token",
			wantStatus:    http.StatusUnauthorized,
		},
		{
			name:          "wrong token",
			authorization: "Bearer wrong",
			wantStatus:    http.StatusUnauthorized,
		},
		{
			name:          "valid bearer token with whitespace",
			authorization: "  bearer   secret-token  ",
			wantStatus:    http.StatusNoContent,
			wantCalled:    true,
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			called = false
			req := httptest.NewRequest(http.MethodGet, "/api/status", nil)
			if tc.authorization != "" {
				req.Header.Set("Authorization", tc.authorization)
			}
			rec := httptest.NewRecorder()

			handler.ServeHTTP(rec, req)

			if rec.Code != tc.wantStatus {
				t.Fatalf("status = %d, want %d", rec.Code, tc.wantStatus)
			}
			if called != tc.wantCalled {
				t.Fatalf("handler called = %v, want %v", called, tc.wantCalled)
			}
		})
	}
}

func TestValidateTokenTrimsAndRejectsEmptyValues(t *testing.T) {
	t.Parallel()

	if !auth.ValidateToken(" secret-token ", "\nsecret-token\r\n") {
		t.Fatal("ValidateToken should accept matching trimmed tokens")
	}
	if auth.ValidateToken("", "secret-token") {
		t.Fatal("ValidateToken should reject empty input token")
	}
	if auth.ValidateToken("secret-token", "") {
		t.Fatal("ValidateToken should reject empty expected token")
	}
	if auth.ValidateToken("wrong-token", "secret-token") {
		t.Fatal("ValidateToken should reject mismatched tokens")
	}
}
