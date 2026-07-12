/**
 * catalystAuth.js - Sentinal v2
 *
 * Auth strategy:
 *
 * 1. localhost            → mock auth (local only)
 * 2. onslate.in           → IS_CUSTOM_DOMAIN = true
 *    • Check URL for ?auth_user=... (set by serverless domain on SSO return)
 *    • Check localStorage cache
 *    • If no session: redirect to serverless app with ?redirect_back=<origin>
 *
 * 3. catalystserverless.in → IS_CUSTOM_DOMAIN = false
 *    • Native Catalyst SDK auth via /__catalyst/sdk/init.js
 *    • If ?redirect_back is present: after auth, redirect to custom domain
 *      with ?auth_user=<user-json> appended
 *    • redirectToLogin() preserves ?redirect_back so it survives the
 *      /__catalyst/auth/login round-trip
 *
 * Logout:
 *    • Custom domain redirects to serverless with ?logout=true
 *    • Serverless clears session and runs catalyst.auth.signOut()
 */

const IS_LOCAL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

// The canonical Catalyst-hosted serverless client URL (where SDK & BAAS work natively)
const CATALYST_BASE =
  "https://sentinal-60073535541.development.catalystserverless.in";

// onslate.in is a custom/Slate domain – auth must be bridged to the serverless app
const IS_CUSTOM_DOMAIN =
  !IS_LOCAL &&
  !window.location.hostname.includes("catalystserverless.in");

/* ── Mock user (local dev only) ──────────────────────────────────────── */
const MOCK_USER = {
  email_id: "demo@sentinal.ksp",
  first_name: "Demo",
  last_name: "Officer",
  user_id: "mock-001",
  role: "officer",
};
const MOCK_EMAIL    = "demo@sentinal.ksp";
const MOCK_PASSWORD = "Sentinal@2024";

/* ── SDK loader ───────────────────────────────────────────────────────── */
let sdkReady = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true" || document.readyState !== "loading") {
        resolve();
        return;
      }
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src   = src;
    s.async = true;
    s.onload  = () => { s.dataset.loaded = "true"; resolve(); };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function ensureCatalystSdk() {
  if (IS_LOCAL) return Promise.resolve(null);
  if (!sdkReady) {
    sdkReady = Promise.race([
      loadScript(
        "https://static.zohocdn.com/catalyst/sdk/js/4.0.0/catalystWebSDK.js"
      ).then(async () => {
        // Prefer platform-provided init.js (sets correct api_domain for this host)
        try {
          await loadScript("/__catalyst/sdk/init.js");
        } catch (e) {
          console.warn("[Auth] init.js unavailable, using manual init", e);
          window.catalyst.initApp(
            {
              project_Id:     "50170000000065001",
              zaid:           "50043676705",
              auth_domain:    "https://accounts.zohoportal.in",
              is_appsail:     false,
              stratus_domain: "-development.zohostratus.in",
              nimbus_domain:  "-development.nimbuspop.com",
              api_domain:     CATALYST_BASE,
            },
            { org_id: "60073535541" }
          );
        }
        return window.catalyst;
      }),
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error("Catalyst SDK timed out")), 10_000)
      ),
    ]);
  }
  return sdkReady;
}

/* ── Helpers ──────────────────────────────────────────────────────────── */
function normalizeUser(response) {
  const d = response?.content || response?.data || response;
  if (!d || d.status === 401) return null;
  return {
    user_id:    d.user_id    || d.userid    || d.zuid  || "",
    email_id:   d.email_id   || d.emailid   || "",
    first_name: d.first_name || d.firstname || "",
    last_name:  d.last_name  || d.lastname  || "",
    role:       d.role_details?.role_name || d.user_type || "officer",
  };
}

function clearSession() {
  localStorage.removeItem("sentinal_authed");
  localStorage.removeItem("sentinal_user");
  localStorage.removeItem("sentinal_token");
}

function getCachedUser() {
  try {
    const raw = localStorage.getItem("sentinal_user");
    if (!raw) return null;
    const u = JSON.parse(raw);
    return (u?.email_id || u?.user_id) ? u : null;
  } catch { return null; }
}

/* ── Public API ────────────────────────────────────────────────────────── */
export function isLocalDev()      { return IS_LOCAL; }
export function isLocalAuthMode() { return IS_LOCAL; }

/**
 * Redirect to login.
 * • Custom domain  → serverless app's /app/index.html?redirect_back=<origin-url>
 * • Serverless     → /__catalyst/auth/login, PRESERVING current URL if redirect_back present
 *                    Falls back to /app<returnPath> to stay inside the web client base path.
 */
export function redirectToLogin(returnPath = "/dashboard") {
  if (IS_CUSTOM_DOMAIN) {
    const returnUrl = new URL(returnPath, window.location.origin).href;
    window.location.href =
      `${CATALYST_BASE}/app/index.html?redirect_back=${encodeURIComponent(returnUrl)}`;
    return;
  }

  // On serverless domain, ALL routes live under /app/ (web client base path).
  // If redirect_back is already in the current URL, use the full URL (it already
  // has /app/... prefix). Otherwise construct service_url with /app prefix so
  // Catalyst auth redirects back into the web client, not root /dashboard.
  const params = new URLSearchParams(window.location.search);
  let serviceUrl;
  if (params.has("redirect_back")) {
    serviceUrl = window.location.href;           // already has /app/...
  } else {
    // Detect base path: /app on catalystserverless.in, empty on other hosts
    const basePath = window.location.pathname.startsWith("/app") ? "/app" : "";
    serviceUrl = new URL(basePath + returnPath, window.location.origin).href;
  }

  window.location.href =
    `/__catalyst/auth/login?service_url=${encodeURIComponent(serviceUrl)}`;
}

export function redirectToSignup(returnPath = "/dashboard") {
  if (IS_CUSTOM_DOMAIN) {
    const returnUrl = new URL(returnPath, window.location.origin).href;
    window.location.href =
      `${CATALYST_BASE}/app/index.html?redirect_back=${encodeURIComponent(returnUrl)}&mode=signup`;
    return;
  }
  const basePath = window.location.pathname.startsWith("/app") ? "/app" : "";
  const serviceUrl = new URL(basePath + returnPath, window.location.origin).href;
  window.location.href =
    `/__catalyst/auth/signup?service_url=${encodeURIComponent(serviceUrl)}`;
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
  return { success: false, error: "Redirecting to Catalyst login…" };
}

export async function signupUser() {
  if (IS_LOCAL) {
    return {
      success: true,
      data: { message: "Mock signup OK. Use demo@sentinal.ksp / Sentinal@2024 to log in." },
    };
  }
  redirectToSignup("/dashboard");
  return { success: false, error: "Redirecting to Catalyst signup…" };
}

/**
 * Get the currently authenticated user.
 *
 * Flow:
 *  1. Local → return mock cache
 *  2. URL has ?auth_user=... → extract, save to localStorage, clean URL
 *  3. Custom domain → return cache or null (triggers SSO redirect via AuthGuard)
 *  4. Serverless + ?logout=true → sign out and go to /login
 *  5. Serverless (no redirect_back) → SDK getCurrentProjectUser
 *  6. Serverless + ?redirect_back → authenticate; on success redirect back with ?auth_user=
 */
export async function getCurrentUser() {
  /* ── 1. Local mock ── */
  if (IS_LOCAL) return getCachedUser();

  const params = new URLSearchParams(window.location.search);

  /* ── 2. SSO return: ?auth_user=<user-json> ── */
  const authUserStr = params.get("auth_user");
  if (authUserStr) {
    try {
      const user = JSON.parse(authUserStr);
      if (user?.email_id || user?.user_id) {
        localStorage.setItem("sentinal_user", JSON.stringify(user));
        localStorage.setItem("sentinal_authed", "1");
        // Clean URL without triggering reload
        params.delete("auth_user");
        const qs = params.toString();
        const clean =
          window.location.pathname +
          (qs ? `?${qs}` : "") +
          window.location.hash;
        window.history.replaceState({}, document.title, clean);
        return user;
      }
    } catch (e) {
      console.error("[Auth] Failed to parse auth_user from URL:", e);
    }
  }

  /* ── 3. Custom domain (onslate.in) ── */
  if (IS_CUSTOM_DOMAIN) {
    const cached = getCachedUser();
    if (cached) return cached;
    clearSession();
    return null; // → AuthGuard → redirectToLogin → SSO bridge
  }

  /* ── 4. Serverless: ?logout=true ── */
  if (params.get("logout") === "true") {
    clearSession();
    try {
      const catalyst = await ensureCatalystSdk();
      if (catalyst?.auth) await catalyst.auth.signOut();
    } catch { /* best-effort */ }
    window.location.href = "/login";
    return new Promise(() => {}); // never resolves; navigation pending
  }

  const redirectBack = params.get("redirect_back");

  /* ── 5. Check localStorage cache ── */
  const cached = getCachedUser();
  if (cached) {
    if (redirectBack) {
      // Already logged in on serverless – send user data back to custom domain
      const target = new URL(redirectBack);
      target.searchParams.set("auth_user", JSON.stringify(cached));
      window.location.href = target.href;
      return new Promise(() => {});
    }
    return cached;
  }

  /* ── 6. SDK auth (native Catalyst session) ── */
  try {
    const catalyst = await ensureCatalystSdk();
    if (!catalyst) return null;

    const response = await catalyst.userManagement.getCurrentProjectUser();
    const user = normalizeUser(response);

    if (!user?.email_id && !user?.user_id) {
      clearSession();
      return null; // → AuthGuard → redirectToLogin (preserving redirect_back)
    }

    localStorage.setItem("sentinal_user", JSON.stringify(user));
    localStorage.setItem("sentinal_authed", "1");
    localStorage.removeItem("sentinal_token");

    if (redirectBack) {
      // Authenticated! Bridge user back to the custom domain.
      const target = new URL(redirectBack);
      target.searchParams.set("auth_user", JSON.stringify(user));
      window.location.href = target.href;
      return new Promise(() => {});
    }

    return user;
  } catch (error) {
    console.warn("[Auth] getCurrentUser SDK error:", error.message);
    clearSession();
    return null;
  }
}

export async function logoutUser() {
  clearSession();

  if (IS_CUSTOM_DOMAIN) {
    // Bridge logout to the serverless domain where the real session lives
    window.location.href = `${CATALYST_BASE}/app/index.html?logout=true`;
    return;
  }

  if (!IS_LOCAL) {
    try {
      const catalyst = await ensureCatalystSdk();
      if (catalyst?.auth) await catalyst.auth.signOut();
    } catch { /* best-effort */ }
  }

  window.location.href = "/login";
}

export function isAuthed() {
  return !!localStorage.getItem("sentinal_authed");
}
