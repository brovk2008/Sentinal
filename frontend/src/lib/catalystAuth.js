/**
 * catalystAuth.js - Sentinal v2
 *
 * Authentication module designed for HashRouter (<HashRouter>) on Zoho Catalyst.
 *
 * URL Specification for HashRouter:
 *   `<base_url>[?query_params]#<hash_path>`
 *
 * Host Environments:
 * 1. localhost / 127.0.0.1 (Local Dev):
 *    - Uses mock user session.
 * 2. onslate.in (Custom Domain / Catalyst Slate):
 *    - IS_CUSTOM_DOMAIN = true.
 *    - Relies on SSO bridge to catalystserverless.in for native Catalyst session management.
 * 3. catalystserverless.in (Catalyst Web Client):
 *    - IS_CUSTOM_DOMAIN = false.
 *    - Hosts native Catalyst Web SDK and authentication endpoints (/__catalyst/auth/login).
 */

const IS_LOCAL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

// Canonical Catalyst serverless domain hosting native SDK & BAAS endpoints
const CATALYST_BASE =
  "https://sentinal-60073535541.development.catalystserverless.in";

// Custom domain flag (Slate / custom domain where SDK session cookies are non-first-party)
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

/* ── Helper: Canonical HashRouter App Entry URL Builder ──────────────── */
/**
 * Constructs a URL formatted specifically for HashRouter:
 * `<base_url>[?query_params]#<hash_path>`
 *
 * Ensures that whenever Catalyst auth redirects back to service_url, the URL
 * contains the hash fragment (e.g. #/dashboard), preventing HashRouter from
 * throwing "No routes matched location /app/".
 */
export function getAppEntryUrl({
  baseUrl = null,
  hashPath = "/dashboard",
  queryParams = null,
} = {}) {
  let base = baseUrl;
  if (!base) {
    if (IS_LOCAL || IS_CUSTOM_DOMAIN) {
      base = `${window.location.origin}/`;
    } else {
      base = `${window.location.origin}/app/index.html`;
    }
  }

  // Ensure hashPath starts with '/'
  const normalizedHash = hashPath.startsWith("/") ? hashPath : `/${hashPath}`;

  // Format search query parameters if provided
  let queryString = "";
  if (queryParams) {
    let params;
    if (queryParams instanceof URLSearchParams) {
      params = queryParams;
    } else {
      params = new URLSearchParams();
      Object.entries(queryParams).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          params.set(k, typeof v === "object" ? JSON.stringify(v) : v);
        }
      });
    }
    const str = params.toString();
    if (str) {
      queryString = `?${str}`;
    }
  }

  return `${base}${queryString}#${normalizedHash}`;
}

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
 * • Custom Domain (onslate.in): Redirects to serverless domain's entry point with redirect_back
 * • Serverless Domain: Redirects to /__catalyst/auth/login with service_url formatted for HashRouter
 */
export function redirectToLogin(returnPath = "/dashboard") {
  if (IS_CUSTOM_DOMAIN) {
    // 1. Target return URL on custom domain (e.g. https://sentinal-peak.onslate.in/#/dashboard)
    const returnUrl = getAppEntryUrl({
      baseUrl: `${window.location.origin}/`,
      hashPath: returnPath,
    });

    // 2. Redirect to serverless app entry point preserving hash route & redirect_back query
    window.location.href = getAppEntryUrl({
      baseUrl: `${CATALYST_BASE}/app/index.html`,
      hashPath: returnPath,
      queryParams: { redirect_back: returnUrl },
    });
    return;
  }

  // On serverless domain: construct service_url for Catalyst native auth
  const currentParams = new URLSearchParams(window.location.search);
  const redirectBack = currentParams.get("redirect_back");
  const queryObj = redirectBack ? { redirect_back: redirectBack } : null;

  // service_url explicitly includes the HashRouter path (e.g. /app/index.html?redirect_back=...#/dashboard)
  const serviceUrl = getAppEntryUrl({
    baseUrl: `${window.location.origin}/app/index.html`,
    hashPath: returnPath,
    queryParams: queryObj,
  });

  window.location.href =
    `/__catalyst/auth/login?service_url=${encodeURIComponent(serviceUrl)}`;
}

/**
 * Redirect to signup.
 */
export function redirectToSignup(returnPath = "/dashboard") {
  if (IS_CUSTOM_DOMAIN) {
    const returnUrl = getAppEntryUrl({
      baseUrl: `${window.location.origin}/`,
      hashPath: returnPath,
    });
    window.location.href = getAppEntryUrl({
      baseUrl: `${CATALYST_BASE}/app/index.html`,
      hashPath: returnPath,
      queryParams: { redirect_back: returnUrl, mode: "signup" },
    });
    return;
  }

  const currentParams = new URLSearchParams(window.location.search);
  const redirectBack = currentParams.get("redirect_back");
  const queryObj = redirectBack ? { redirect_back: redirectBack } : null;

  const serviceUrl = getAppEntryUrl({
    baseUrl: `${window.location.origin}/app/index.html`,
    hashPath: returnPath,
    queryParams: queryObj,
  });

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
 *  4. Serverless + ?logout=true → sign out and redirect to #/login
 *  5. Serverless + cached session / SDK auth → return user (redirecting to custom domain if ?redirect_back is present)
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

        // Clean query parameter from URL without page reload while preserving hash route
        params.delete("auth_user");
        const qs = params.toString();
        const hash = window.location.hash || "#/dashboard";
        const clean = window.location.pathname + (qs ? `?${qs}` : "") + hash;
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

    // Redirect to HashRouter login path
    window.location.href = getAppEntryUrl({
      baseUrl: `${window.location.origin}/app/index.html`,
      hashPath: "/login",
    });
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

/**
 * Logout user.
 * • Custom domain: Redirects to serverless app with ?logout=true to destroy remote session
 * • Serverless domain: Destroys session via SDK and redirects to #/login
 */
export async function logoutUser() {
  clearSession();

  if (IS_CUSTOM_DOMAIN) {
    // Bridge logout to the serverless domain where the real session lives
    window.location.href = getAppEntryUrl({
      baseUrl: `${CATALYST_BASE}/app/index.html`,
      hashPath: "/login",
      queryParams: { logout: "true" },
    });
    return;
  }

  if (!IS_LOCAL) {
    try {
      const catalyst = await ensureCatalystSdk();
      if (catalyst?.auth) await catalyst.auth.signOut();
    } catch { /* best-effort */ }
  }

  window.location.href = getAppEntryUrl({
    baseUrl: `${window.location.origin}/app/index.html`,
    hashPath: "/login",
  });
}

export function isAuthed() {
  return !!localStorage.getItem("sentinal_authed");
}
