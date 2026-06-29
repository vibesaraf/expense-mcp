import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

export function Callback() {
  const navigate = useNavigate();
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get("code");
    const returnedState = searchParams.get("state");
    const storedState = sessionStorage.getItem("pkce_state");
    const verifier = sessionStorage.getItem("pkce_code_verifier");

    sessionStorage.removeItem("pkce_state");
    sessionStorage.removeItem("pkce_code_verifier");

    if (!code || !verifier || returnedState !== storedState) {
      navigate("/login", { replace: true });
      return;
    }

    fetch("/oidc/callback", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, code_verifier: verifier }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Callback failed");
        navigate("/", { replace: true });
      })
      .catch(() => navigate("/login", { replace: true }));
  }, [navigate]);

  return <div>Signing in…</div>;
}
