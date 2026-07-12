/**
 * catalystAuth.js - Sentinal v2
 *
 * Handles local mock auth and production Catalyst hosted auth without
 * allowing the app to hang forever while the SDK is loading.
 *
 * CUSTOM DOMAIN NOTE:
 * When served from a custom domain (onslate.in / GitHub Pages), the Catalyst
 * auth portal and SDK init.js are NOT available at /__catalyst/... paths.
 * We redirect auth to the canonical Catalyst serverless URL instead.
 */

const IS_LOCAL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

// The canonical Catalyst-hosted client URL where auth actually works
const CATALYST_BASE = "https://sentinal-60073535541.development.catalystserverless.in";

// Are we on the custom domain (onslate.in or any non-catalystserverless host)?
const IS_CUSTOM_DOMAIN =
  !IS_LOCAL &&
  !window.location.hostname.includes("catalystserverless.in");

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
    const SDK_TIMEOUT_MS = 10000;

    sdkReady = Promise.race([
      loadScript("https://static.zohocdn.com/catalyst/sdk/js/4.0.0/catalystWebSDK.js")
        .then(async () => {
          // On serverless domain: load the platform-provided init.js
          try {
            await loadScript("/__catalyst/sdk/init.js");
          } catch (e) {
            console.warn("[Auth] init.js failed, falling back to manual init", e);
            window.catalyst.initApp(
              {
                project_Id: "50170000000065001",
                zaid: "50043676705",
                auth_domain: "https://accounts.zohoportal.in",
                is_appsail: false,
                stratus_domain: "-development.zohostratus.in",
                nimbus_domain: "-development.nimbuspop.com",
                api_domain: CATALYST_BASE,
              },
              { org_id: "60073535541" }
            );
          }
          return window.catalyst;
        }),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Catalyst SDK timed out after 10s")),
          SDK_TIMEOUT_MS
        )
      ),
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

function checkUrlForAuthUser() {
  const params = new URLSearchParams(window.location.search);
  const authUserStr = params.get("auth_user");
  if (authUserStr) {
    try {
      const user = JSON.parse(decodeURIComponent(authUserStr));
      if (user?.email_id || user?.user_id) {
        localStorage.setItem("sentinal_user", JSON.stringify(user));
        localStorage.setItem("sentinal_authed", "1");
        
        // Remove parameter from URL without reload
        params.delete("auth_user");
        const newSearch = params.toString();
        const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "") + window.location.hash;
        window.history.replaceState({}, document.title, newUrl);
        return user;
      }
    } catch (e) {
      console.error("[Auth] Failed to parse auth_user from URL:", e);
    }
  }
  return null;
}

export function redirectToLogin(returnPath = "/dashboard") {
  if (IS_CUSTOM_DOMAIN) {
    const returnUrl = new URL(returnPath, window.location.origin).href;
    // Redirect to the serverless app page which handles auth and redirects back
    window.location.href = `${CATALYST_BASE}/app/index.html?redirect_back=${encodeURIComponent(returnUrl)}`;
  } else {
    const returnUrl = new URL(returnPath, window.location.origin).href;
    window.location.href = `/__catalyst/auth/login?service_url=${encodeURIComponent(returnUrl)}`;
  }
}

export function redirectToSignup(returnPath = "/dashboard") {
  if (IS_CUSTOM_DOMAIN) {
    const returnUrl = new URL(returnPath, window.location.origin).href;
    window.location.href = `${CATALYST_BASE}/app/index.html?redirect_back=${encodeURIComponent(returnUrl)}&signup=true`;
  } else {
    const returnUrl = new URL(returnPath, window.location.origin).href;
    window.location.href = `/__catalyst/auth/signup?service_url=${encodeURIComponent(returnUrl)}`;
  }
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

  // ── Custom Domain SSO Redirect Handle ──────────────────────────────────────
  const urlUser = checkUrlForAuthUser();
  if (urlUser) return urlUser;

  // Check cached session
  const cached = localStorage.getItem("sentinal_user");
  if (cached) {
    try {
      const u = JSON.parse(cached);
      if (u?.email_id || u?.user_id) return u;
    } catch { /* ignore */ }
  }

  if (IS_CUSTOM_DOMAIN) {
    // If not cached, we return null to let AuthGuard trigger the redirect
    clearSession();
    return null;
  }

  // ── Serverless Domain Authenticated Path ──────────────────────────────────
  // Check if we need to log out first (SSO logout redirect)
  const params = new URLSearchParams(window.location.search);
  if (params.get("logout") === "true") {
    clearSession();
    if (!IS_LOCAL) {
      try {
        const catalyst = await ensureCatalystSdk();
        if (catalyst?.auth) await catalyst.auth.signOut();
      } catch { /* ignore */ }
    }
    window.location.href = "/login";
    return new Promise(() => {});
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

    // SSO Redirect back if requested
    const redirectBack = params.get("redirect_back");
    if (redirectBack) {
      const targetUrl = new URL(redirectBack);
      targetUrl.searchParams.set("auth_user", JSON.stringify(user));
      window.location.href = targetUrl.href;
      return new Promise(() => {}); // prevent rendering
    }

    return user;
  } catch (error) {
    console.warn("[Auth] getCurrentUser failed:", error.message);
    clearSession();
    return null;
  }
}

export async function logoutUser() {
  clearSession();

  if (IS_CUSTOM_DOMAIN) {
    // Redirect to serverless domain to trigger sign out there
    window.location.href = `${CATALYST_BASE}/app/index.html?logout=true`;
    return;
  }

  if (!IS_LOCAL) {
    try {
      const catalyst = await ensureCatalystSdk();
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
