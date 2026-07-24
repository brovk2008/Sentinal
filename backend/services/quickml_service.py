"""
quickml_service.py
Catalyst QuickML API wrapper for Project Sentinal.

Auth pattern:
  URL:     https://api.catalyst.zoho.in/quickml/v1/project/{PROJECT_ID}/glm/chat
  Headers: { "CATALYST-ORG": "<org_id>", "Authorization": "Zoho-oauthtoken <token>" }

Inside AppSail, zcatalyst_sdk auto-fetches the OAuth token from the
X-ZC-Admin-Cred-Token header that Catalyst injects into every request.
"""

import httpx
import os
import logging

log = logging.getLogger(__name__)

PROJECT_ID = (
    os.getenv("SENTINAL_PROJECT_ID")
    or os.getenv("CATALYST_PROJECT_ID", "50170000000065001")
)
ORG_ID = (
    os.getenv("SENTINAL_ORG_ID")
    or os.getenv("CATALYST_ORG_ID", "60073535541")
)

GLM_CHAT_URL = (
    os.getenv("SENTINAL_QUICKML_URL")
    or os.getenv("CATALYST_QUICKML_URL")
    or f"https://api.catalyst.zoho.in/quickml/v1/project/{PROJECT_ID}/glm/chat"
)
VISION_CHAT_URL = (
    os.getenv("SENTINAL_VISION_URL")
    or os.getenv("CATALYST_VISION_URL")
    or f"https://api.catalyst.zoho.in/quickml/v1/project/{PROJECT_ID}/vlm/chat"
)

DEFAULT_LLM_MODEL = (
    os.getenv("SENTINAL_LLM_MODEL")
    or os.getenv("CATALYST_LLM_MODEL", "crm-di-glm47b_30b_it")  # Catalyst internal model ID for GLM-4.7-Flash
)
VISION_MODEL = (
    os.getenv("SENTINAL_VISION_MODEL")
    or os.getenv("CATALYST_VISION_MODEL", "VL-Qwen3.6-35B-A3B")
)


def _get_catalyst_token(request=None) -> str | None:
    """
    Obtain a Zoho OAuth token using zcatalyst_sdk.
    Strategy 1: Use the FastAPI Request object (most reliable inside AppSail —
                 Catalyst injects X-ZC-Admin-Cred-Token into every request).
    Strategy 2: ApplicationDefaultCredential (for background tasks).
    Strategy 3: SENTINAL_QUICKML_KEY env var (local dev only).
    """
    try:
        import zcatalyst_sdk as catalyst

        # Strategy 1: Request-scoped token
        if request is not None:
            try:
                app = catalyst.initialize(req=request)
                raw = app.credential.token()
                token = raw[1] if isinstance(raw, (tuple, list)) and len(raw) > 1 else str(raw)
                if token and len(token) > 10:
                    log.info("[QuickML] Token via request credential OK.")
                    return token
            except Exception as req_err:
                log.warning(f"[QuickML] Request credential failed: {req_err}")

        # Strategy 2: Default app credential
        try:
            app = catalyst.initialize()
            raw = app.credential.token()
            token = raw[1] if isinstance(raw, (tuple, list)) and len(raw) > 1 else str(raw)
            if token and len(token) > 10:
                log.info("[QuickML] Token via default credential OK.")
                return token
        except Exception as def_err:
            log.warning(f"[QuickML] Default credential failed: {def_err}")

    except ImportError:
        log.warning("[QuickML] zcatalyst_sdk not installed.")
    except Exception as outer_err:
        log.warning(f"[QuickML] Token extraction error: {outer_err}")

    # Strategy 3: Manual env var (local dev)
    key = (os.getenv("SENTINAL_QUICKML_KEY") or "").strip()
    if key and "your-" not in key.lower() and "placeholder" not in key.lower():
        log.info("[QuickML] Using SENTINAL_QUICKML_KEY from env.")
        return key

    log.error("[QuickML] No valid Catalyst credential found.")
    return None


async def call_ai(
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = 2000,
    model: str | None = None,
    request=None,
) -> str:
    """Convenience wrapper — builds a messages list and calls call_ai_messages."""
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user",   "content": user_prompt},
    ]
    return await call_ai_messages(messages, max_tokens=max_tokens, model=model, request=request)


async def call_ai_messages(
    messages: list,
    max_tokens: int = 2000,
    model: str | None = None,
    request=None,
) -> str:
    """
    Call Catalyst QuickML GLM with an OpenAI-style messages array.
    ONLY uses Zoho Catalyst QuickML — no external AI services.
    """
    token = _get_catalyst_token(request)
    if not token:
        log.error("[QuickML] No token — cannot call GLM.")
        return "LLM_SERVICE_UNAVAILABLE"

    headers = {
        "Authorization": f"Zoho-oauthtoken {token}",
        "CATALYST-ORG": ORG_ID,
        "Content-Type": "application/json",
    }

    used_model = model or DEFAULT_LLM_MODEL
    if used_model.lower() in ("glm-4.7-flash", "glm-4.7"):
        used_model = "crm-di-glm47b_30b_it"

    user_text = "\n".join(
        m.get("content", "") for m in messages if m.get("role") == "user"
    ) or "Hello"

    def _extract_text(data: dict) -> str | None:
        return (
            (data.get("choices") or [{}])[0].get("message", {}).get("content")
            or data.get("output", {}).get("text")
            or data.get("result")
            or data.get("data")
            or data.get("response")
            or data.get("text")
        )

    try:
        async with httpx.AsyncClient(timeout=45) as client:

            # ── Attempt 1: Full OpenAI-compatible messages array ──────────────
            try:
                r1 = await client.post(
                    GLM_CHAT_URL,
                    headers=headers,
                    json={"messages": messages, "model": used_model, "max_tokens": max_tokens},
                )
                log.info(f"[QuickML GLM #1] status={r1.status_code}")
                if r1.status_code == 200:
                    text = _extract_text(r1.json())
                    if text:
                        log.info("[QuickML GLM #1] SUCCESS")
                        return str(text)
                    log.warning(f"[QuickML GLM #1] 200 but empty text. body={r1.text[:300]}")
                else:
                    log.warning(f"[QuickML GLM #1] {r1.status_code}: {r1.text[:300]}")
            except Exception as e1:
                log.warning(f"[QuickML GLM #1] Exception: {e1}")

            # ── Attempt 2: Prompt-only payload (older endpoint style) ─────────
            try:
                r2 = await client.post(
                    GLM_CHAT_URL,
                    headers=headers,
                    json={"prompt": user_text, "model": used_model, "max_tokens": max_tokens},
                )
                log.info(f"[QuickML GLM #2] status={r2.status_code}")
                if r2.status_code == 200:
                    text2 = _extract_text(r2.json())
                    if text2:
                        log.info("[QuickML GLM #2] SUCCESS")
                        return str(text2)
                    log.warning(f"[QuickML GLM #2] 200 but empty text. body={r2.text[:300]}")
                else:
                    log.warning(f"[QuickML GLM #2] {r2.status_code}: {r2.text[:300]}")
            except Exception as e2:
                log.warning(f"[QuickML GLM #2] Exception: {e2}")

    except Exception as outer_err:
        log.error(f"[QuickML] HTTP client error: {outer_err}")

    log.error("[QuickML] All Catalyst GLM attempts failed.")
    return "LLM_SERVICE_UNAVAILABLE"


async def call_vision(
    system_prompt: str,
    user_prompt: str,
    image_b64: str,
    max_tokens: int = 1500,
    request=None,
) -> str:
    """Call Catalyst QuickML Qwen Vision model for image + text analysis."""
    token = _get_catalyst_token(request)
    if not token:
        return "Catalyst QuickML Vision: no token available."

    headers = {
        "Authorization": f"Zoho-oauthtoken {token}",
        "CATALYST-ORG": ORG_ID,
        "Content-Type": "application/json",
    }

    # Strip any data URI scheme (e.g., "data:image/jpeg;base64,") if present
    clean_b64 = image_b64
    if "," in image_b64:
        clean_b64 = image_b64.split(",", 1)[1]

    body = {
        "prompt": user_prompt,
        "model": VISION_MODEL,
        "images": [clean_b64],
        "system_prompt": system_prompt,
        "top_k": 50,
        "top_p": 0.9,
        "temperature": 0.2,
        "max_tokens": max_tokens,
    }

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(VISION_CHAT_URL, headers=headers, json=body)
            log.info(f"[QuickML Vision] status={r.status_code}")
            r.raise_for_status()
            
            data = r.json()
            # Support both OpenAI-style and custom Catalyst response outputs
            content = (
                (data.get("choices") or [{}])[0].get("message", {}).get("content")
                or data.get("response")
                or data.get("output", {}).get("text")
                or data.get("result")
                or data.get("text")
                or str(data)
            )
            return str(content)
    except Exception as e:
        log.error(f"[QuickML Vision] Request failed: {e}")
        # Return response body for extra debugging if available
        try:
            if hasattr(e, "response") and e.response is not None:
                return f"Catalyst Vision error: {e}. Body: {e.response.text}"
        except:
            pass
        return f"Catalyst Vision error: {e}"
