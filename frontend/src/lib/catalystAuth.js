/**
 * catalystAuth.js - Sentinal v2
 *
 * Handles local mock auth and production Catalyst hosted auth without
 * allowing the app to hang forever while the SDK is loading.
 */

const IS_LOCAL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

const MOCK_USER = {
  email_id: "demo@sentinal.ksp",
  first_name: "Demo",
  last_name: "Officer",
  user_id: "mock-001",
  role: "officer",
};
const MOCK_EMAIL = "demo@sentinal.ksp";
const MOCK_PASSWORD = "Sentinal@2024";

let sdkReady = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (
        existing.dataset.loaded === "true" ||
        existing.readyState === "complete" ||
        document.readyState !== "loading"
      ) {
        resolve();
        return;
      }

      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function ensureCatalystSdk() {
  if (IS_LOCAL) return Promise.resolve(null);

  if (!sdkReady) {
    const SDK_TIMEOUT_MS = 8000;

    sdkReady = Promise.race([
      loadScript("https://static.zohocdn.com/catalyst/sdk/js/4.0.0/catalystWebSDK.js")
        .then(() => loadScript("/__catalyst/sdk/init.js"))
        .then(() => window.catalyst),
      new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error("Catalyst SDK load timed out after 8s")),
          SDK_TIMEOUT_MS,
        );
      }),
    ]);
  }

  return sdkReady;
}

function normalizeUser(response) {
  const data = response?.content || response?.data || response;
  if (!data || data.status === 401) return null;

  return {
    user_id: data.user_id || data.userid || data.zuid || "",
    email_id: data.email_id || data.emailid || "",
    first_name: data.first_name || data.firstname || "",
    last_name: data.last_name || data.lastname || "",
    role: data.role_details?.role_name || data.user_type || "officer",
  };
}

function clearSession() {
  localStorage.removeItem("sentinal_authed");
  localStorage.removeItem("sentinal_user");
  localStorage.removeItem("sentinal_token");
}

export function isLocalDev() {
  return IS_LOCAL;
}

export function isLocalAuthMode() {
  return IS_LOCAL;
}

export function redirectToLogin(returnPath = "/dashboard") {
  const returnUrl = new URL(returnPath, window.location.origin).href;
  window.location.href = `/__catalyst/auth/login?service_url=${encodeURIComponent(returnUrl)}`;
}

export function redirectToSignup(returnPath = "/dashboard") {
  const returnUrl = new URL(returnPath, window.location.origin).href;
  window.location.href = `/__catalyst/auth/signup?service_url=${encodeURIComponent(returnUrl)}`;
}

export function redirectToHostedLogin(returnPath = "/dashboard") {
  redirectToLogin(returnPath);
}

export function redirectToHostedSignup(returnPath = "/dashboard") {
  redirectToSignup(returnPath);
}

export async function loginUser(email, password) {
  if (IS_LOCAL) {
    if (email === MOCK_EMAIL && password === MOCK_PASSWORD) {
      localStorage.setItem("sentinal_user", JSON.stringify(MOCK_USER));
      localStorage.setItem("sentinal_authed", "1");
      localStorage.removeItem("sentinal_token");
      return { success: true, data: MOCK_USER };
    }
    return { success: false, error: "Invalid credentials. Access Denied." };
  }

  redirectToLogin("/dashboard");
  return { success: false, error: "Redirecting to Catalyst login..." };
}

export async function signupUser() {
  if (IS_LOCAL) {
    return {
      success: true,
      data: {
        message: "Mock signup OK. Use demo@sentinal.ksp / Sentinal@2024 to login.",
      },
    };
  }

  redirectToSignup("/dashboard");
  return { success: false, error: "Redirecting to Catalyst signup..." };
}

export async function getCurrentUser() {
  if (IS_LOCAL) {
    const cached = localStorage.getItem("sentinal_user");
    return cached ? JSON.parse(cached) : null;
  }

  try {
    const catalyst = await ensureCatalystSdk();
    if (!catalyst) return null;

    const response = await catalyst.userManagement.getCurrentProjectUser();
    const user = normalizeUser(response);

    if (!user?.email_id && !user?.user_id) {
      clearSession();
      return null;
    }

    localStorage.setItem("sentinal_user", JSON.stringify(user));
    localStorage.setItem("sentinal_authed", "1");
    localStorage.removeItem("sentinal_token");
    return user;
  } catch (error) {
    console.warn("[Auth] getCurrentUser failed:", error.message);
    clearSession();
    return null;
  }
}

export async function logoutUser() {
  clearSession();

  if (!IS_LOCAL) {
    try {
      const catalyst = await Promise.race([
        ensureCatalystSdk(),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error("timeout")), 3000);
        }),
      ]);

      if (catalyst?.auth) {
        await catalyst.auth.signOut();
      }
    } catch {
      // Best effort only; local session has already been cleared.
    }
  }

  window.location.href = "/login";
}

export function isAuthed() {
  return !!localStorage.getItem("sentinal_authed");
}
