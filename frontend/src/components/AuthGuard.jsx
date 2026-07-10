import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getCurrentUser, redirectToLogin } from "../lib/catalystAuth";

const IS_LOCAL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

export default function AuthGuard({ children }) {
  const [state, setState] = useState("checking");

  useEffect(() => {
    let cancelled = false;

    const timeout = setTimeout(() => {
      if (!cancelled) {
        console.warn("[AuthGuard] Timed out waiting for auth - redirecting");
        setState("unauthed");
      }
    }, 10000);

    getCurrentUser()
      .then((user) => {
        if (!cancelled) {
          clearTimeout(timeout);
          setState(user ? "authed" : "unauthed");
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearTimeout(timeout);
          setState("unauthed");
        }
      });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  if (state === "checking") {
    return (
      <div style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0f",
        color: "var(--copper-400)",
        fontFamily: "var(--font-mono)",
        fontSize: 13,
        letterSpacing: "0.1em",
        flexDirection: "column",
        gap: 12,
      }}>
        <div>AUTHENTICATING...</div>
        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
          Verifying credentials with Catalyst Auth
        </div>
      </div>
    );
  }

  if (state === "unauthed") {
    if (!IS_LOCAL) {
      redirectToLogin("/dashboard");
      return (
        <div style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0f",
          color: "var(--copper-400)",
          fontFamily: "var(--font-mono)",
          fontSize: 13,
        }}>
          REDIRECTING TO CATALYST AUTH...
        </div>
      );
    }

    return <Navigate to="/login" replace />;
  }

  return children;
}
