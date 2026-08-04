import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function Callback() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get("code");
    const returnedState = searchParams.get("state");
    const storedState = sessionStorage.getItem("pkce_state");
    const verifier = sessionStorage.getItem("pkce_code_verifier");

    // Single-use: clear PKCE material before any await so a replayed callback
    // cannot reuse the verifier.
    sessionStorage.removeItem("pkce_state");
    sessionStorage.removeItem("pkce_code_verifier");

    // CSRF protection: reject the callback unless state matches what we stored.
    if (!code || !verifier || !storedState || returnedState !== storedState) {
      navigate("/login", { replace: true });
      return;
    }

    const run = async () => {
      try {
        const res = await fetch("/oidc/callback", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, code_verifier: verifier }),
        });
        if (!res.ok) throw new Error("Callback failed");

        // The AuthProvider already resolved /users/me at app boot (before this
        // exchange set the session cookie), so it holds a null user. Load the
        // identity here and only navigate once it is in context — otherwise
        // ProtectedRoute bounces us straight back to /login.
        const user = await refresh();
        if (!user) throw new Error("Session not established");

        navigate("/", { replace: true });
      } catch {
        navigate("/login", { replace: true });
      }
    };

    void run();
  }, [navigate, refresh]);

  return <div>Signing in…</div>;
}
