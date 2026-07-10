/**
 * Catalyst Auth REST API wrapper for Sentinel v2
 * Project ID: 50170000000065001
 *
 * Uses Catalyst Authentication REST API directly (no browser SDK on npm).
 * Falls back to mock auth when running on localhost so local dev still works.
 */

const PROJECT_ID = "50170000000065001";
const CATALYST_AUTH_BASE = `https://api.catalyst.zoho.com/baas/v1/project/${PROJECT_ID}/auth`;

const IS_LOCAL = window.location.hostname === "localhost" ||
                 window.location.hostname === "127.0.0.1";

// ── Mock credentials (local dev only) ─────────────────────────────────────────
const MOCK_CREDS = {
  email: "demo@sentinal.ksp",
  password: "Sentinal@2024",
  user: {
    email_id: "demo@sentinal.ksp",
    first_name: "Demo",
    last_name: "Officer",
    user_id: "mock-001",
    role: "admin",
  },
};

// ── Auth functions ────────────────────────────────────────────────────────────

export async function signupUser(name, email, password) {
  if (IS_LOCAL) {
    // Mock: always succeeds locally
    return {
      success: true,
      data: { message: "Mock signup OK. Use demo@sentinal.ksp / Sentinal@2024 to login." },
    };
  }
  try {
    const firstName = name.split(" ")[0];
    const lastName = name.split(" ").slice(1).join(" ") || "";
    const res = await fetch(`${CATALYST_AUTH_BASE}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        email_id: email,
        password,
        redirect_url: window.location.origin + "/dashboard",
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Signup failed");
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message || "Signup failed" };
  }
}

export async function loginUser(email, password) {
  // ── Local dev mock ─────────────────────────────────────────────────────────
  if (IS_LOCAL) {
    if (email === MOCK_CREDS.email && password === MOCK_CREDS.password) {
      localStorage.setItem("sentinal_token", "mock-valid-sentinal-jwt-token");
      localStorage.setItem("sentinal_user", JSON.stringify(MOCK_CREDS.user));
      return { success: true, data: MOCK_CREDS.user };
    }
    return { success: false, error: "Invalid credentials. Access Denied." };
  }

  // ── Catalyst Auth REST API ─────────────────────────────────────────────────
  try {
    const res = await fetch(`${CATALYST_AUTH_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email_id: email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || "Authentication failed");
    }
    // Catalyst sets a session cookie; also store a flag in localStorage
    localStorage.setItem("sentinal_token", "catalyst-session-active");
    const user = data?.data?.user_details || data?.data || {};
    localStorage.setItem("sentinal_user", JSON.stringify(user));
    return { success: true, data: user };
  } catch (err) {
    return { success: false, error: err.message || "Authentication failed" };
  }
}

export async function logoutUser() {
  localStorage.removeItem("sentinal_token");
  localStorage.removeItem("sentinal_user");
  if (!IS_LOCAL) {
    try {
      await fetch(`${CATALYST_AUTH_BASE}/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch { /* ignore */ }
  }
  window.location.href = "/login";
}

export async function getCurrentUser() {
  const token = localStorage.getItem("sentinal_token");
  if (!token) return null;

  // Local mock
  if (token === "mock-valid-sentinal-jwt-token") {
    const cached = localStorage.getItem("sentinal_user");
    return cached ? JSON.parse(cached) : MOCK_CREDS.user;
  }

  // Catalyst session check
  if (!IS_LOCAL) {
    try {
      const res = await fetch(`${CATALYST_AUTH_BASE}/currentuser`, {
        credentials: "include",
      });
      if (!res.ok) {
        localStorage.removeItem("sentinal_token");
        return null;
      }
      const data = await res.json();
      return data?.data || null;
    } catch {
      return null;
    }
  }
  return null;
}
