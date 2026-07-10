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

let sdkReady;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      if (existing.dataset.loaded === "true") resolve();
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

async function ensureCatalystSdk() {
  if (IS_LOCAL) return null;
  if (!sdkReady) {
    sdkReady = loadScript(
      "https://static.zohocdn.com/catalyst/sdk/js/4.0.0/catalystWebSDK.js",
    ).then(() => loadScript("/__catalyst/sdk/init.js"));
  }
  await sdkReady;
  return window.catalyst;
}

function normalizeUser(response) {
  const data = response?.content || response?.data || response;
  if (!data || data.status === 401) return null;
  return {
    user_id: data.user_id || data.zuid || "",
    email_id: data.email_id || "",
    first_name: data.first_name || "",
    last_name: data.last_name || "",
    role: data.role_details?.role_name || data.user_type || "officer",
  };
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

  window.location.href = "/__catalyst/auth/login?service_url=/dashboard";
  return { success: false, error: "Redirecting to Catalyst login..." };
}

export async function signupUser(name, email, password) {
  if (IS_LOCAL) {
    return {
      success: true,
      data: {
        message: "Mock signup OK. Use demo@sentinal.ksp / Sentinal@2024 to login.",
      },
    };
  }

  window.location.href = "/__catalyst/auth/login?service_url=/dashboard";
  return {
    success: false,
    error: "Public signup is disabled. Sign in with a Catalyst user account.",
  };
}

export async function getCurrentUser() {
  if (IS_LOCAL) {
    const cached = localStorage.getItem("sentinal_user");
    return cached ? JSON.parse(cached) : null;
  }

  try {
    const catalyst = await ensureCatalystSdk();
    const response = await catalyst.userManagement().getCurrentProjectUser();
    const user = normalizeUser(response);
    if (!user?.email_id && !user?.user_id) return null;

    localStorage.setItem("sentinal_user", JSON.stringify(user));
    localStorage.setItem("sentinal_authed", "1");
    localStorage.removeItem("sentinal_token");
    return user;
  } catch {
    localStorage.removeItem("sentinal_authed");
    localStorage.removeItem("sentinal_user");
    localStorage.removeItem("sentinal_token");
    return null;
  }
}

export async function logoutUser() {
  localStorage.removeItem("sentinal_authed");
  localStorage.removeItem("sentinal_user");
  localStorage.removeItem("sentinal_token");

  window.location.href = "/login";
}

export function isAuthed() {
  return !!localStorage.getItem("sentinal_authed");
}
