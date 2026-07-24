"""
quickml_service.py
Catalyst QuickML API wrapper for Project Sentinal v2.

Auth pattern (from Catalyst console screenshot):
  - URL:     https://api.catalyst.zoho.in/quickml/v1/project/{PROJECT_ID}/glm/chat
  - Headers: { "CATALYST-ORG": "<org_id>", "Authorization": "Zoho-oauthtoken <access_token>" }
  - Method:  POST

Inside AppSail, zcatalyst_sdk automatically fetches a fresh OAuth token.
No manual QUICKML_KEY needed — the URL IS the full endpoint for both models.
"""

import httpx
import os
import json
import logging

log = logging.getLogger(__name__)

PROJECT_ID = os.getenv("SENTINAL_PROJECT_ID") or os.getenv("CATALYST_PROJECT_ID", "50170000000065001")
ORG_ID     = os.getenv("SENTINAL_ORG_ID") or os.getenv("CATALYST_ORG_ID", "60073535541")

# Full endpoint URLs — taken directly from Catalyst QuickML console
GLM_CHAT_URL    = (
    os.getenv("SENTINAL_QUICKML_URL")
    or os.getenv("CATALYST_QUICKML_URL")
    or f"https://api.catalyst.zoho.in/quickml/v1/project/{PROJECT_ID}/glm/chat"
)
VISION_CHAT_URL = (
    os.getenv("SENTINAL_VISION_URL")
    or os.getenv("CATALYST_VISION_URL")
    or f"https://api.catalyst.zoho.in/quickml/v1/project/{PROJECT_ID}/qwen/chat"
)

DEFAULT_LLM_MODEL = os.getenv("SENTINAL_LLM_MODEL") or os.getenv("CATALYST_LLM_MODEL", "GLM-4.7-Flash")
VISION_MODEL      = os.getenv("SENTINAL_VISION_MODEL") or os.getenv("CATALYST_VISION_MODEL", "VL-Qwen3.6-35B-A3B")


def _get_auth_headers(request=None) -> dict:
    """
    Build Catalyst QuickML auth headers.

    Strategy (in order):
    1. If a FastAPI Request is provided, use it so zcatalyst_sdk can parse
       Catalyst-injected headers (X-ZC-Admin-Cred-Token etc.) — most reliable.
    2. Try ApplicationDefaultCredential (reads from env/properties file) — works
       in AppSail background tasks and routes that don't pass request.
    3. Fall back to SENTINAL_QUICKML_KEY env var for local dev.
    """
    try:
        import zcatalyst_sdk as catalyst
        app = None
        if request is not None:
            try:
                app = catalyst.initialize(req=request)
            except Exception as req_err:
                log.warning(f"[QuickML] Request-based initialization failed: {req_err}. Falling back to default app...")

        if app is None:
            try:
                app = catalyst.initialize()
            except Exception as default_err:
                try:
                    app = catalyst.initialize_app(
                        credential=catalyst.credentials.ApplicationDefaultCredential().credential
                    )
                except Exception as app_err:
                    log.warning(f"[QuickML] App-level initialization failed: {default_err} / {app_err}")

        if app is not None:
            raw_token = app.credential.token()
            token = raw_token[1] if isinstance(raw_token, (tuple, list)) and len(raw_token) > 1 else raw_token
            return {
                "Authorization": f"Zoho-oauthtoken {token}",
                "CATALYST-ORG":  ORG_ID,
                "Content-Type":  "application/json",
            }
    except Exception as e:
        log.warning(f"[QuickML] SDK token fetch failed, trying env key: {e}")

    # Fallback: manual key for local dev / testing
    key = os.getenv("SENTINAL_QUICKML_KEY", "")
    if key:
        return {
            "Authorization": f"Zoho-oauthtoken {key}",
            "CATALYST-ORG":  ORG_ID,
            "Content-Type":  "application/json",
        }

    return {}   # no auth — request will fail with 401


async def call_ai(
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = 2000,
    model: str | None = None,
    request=None,
) -> str:
    """Call Catalyst QuickML GLM chat model."""
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
    """Call Catalyst QuickML with an OpenAI-style messages array."""
    headers = _get_auth_headers(request)

    user_text = "\n".join([m.get("content", "") for m in messages if m.get("role") == "user"]) or "Hello"

    # Clean headers without Content-Type for form data requests
    clean_headers = {k: v for k, v in headers.items() if k.lower() != "content-type"}

    attempt_errors = []
    try:
        async with httpx.AsyncClient(timeout=45) as client:

            # ── Attempt 1: QuickML GLM Chat (JSON body, standard OpenAI format) ──
            if headers:
                try:
                    r = await client.post(
                        GLM_CHAT_URL,
                        headers=headers,
                        json={"messages": messages, "model": model or DEFAULT_LLM_MODEL, "max_tokens": max_tokens}
                    )
                    log.info(f"[QuickML Attempt 1] status={r.status_code}")
                    if r.status_code == 200:
                        data = r.json()
                        text = (
                            data.get("choices", [{}])[0].get("message", {}).get("content")
                            or data.get("output", {}).get("text")
                            or data.get("result")
                            or data.get("data")
                            or data.get("response")
                        )
                        if text:
                            log.info("[QuickML Attempt 1] SUCCESS")
                            return str(text)
                    else:
                        attempt_errors.append(f"[GLM Chat status={r.status_code}: {r.text[:200]}]")
                except Exception as err:
                    attempt_errors.append(f"[Attempt 1 err: {err}]")

            # ── Attempt 2: QuickML prompt-only payload ──
            if headers:
                try:
                    r2 = await client.post(
                        GLM_CHAT_URL,
                        headers=headers,
                        json={"prompt": user_text, "model": model or DEFAULT_LLM_MODEL}
                    )
                    log.info(f"[QuickML Attempt 2] status={r2.status_code}")
                    if r2.status_code == 200:
                        data2 = r2.json()
                        text2 = (
                            data2.get("choices", [{}])[0].get("message", {}).get("content")
                            or data2.get("output", {}).get("text")
                            or data2.get("result")
                            or data2.get("data")
                        )
                        if text2:
                            log.info("[QuickML Attempt 2] SUCCESS")
                            return str(text2)
                    else:
                        attempt_errors.append(f"[GLM Prompt-only status={r2.status_code}: {r2.text[:200]}]")
                except Exception as err2:
                    attempt_errors.append(f"[Attempt 2 err: {err2}]")

            # ── Fallback A: OpenRouter (env var SENTINEL_OPENROUTER_KEY or OPENROUTER_API_KEY) ──
            from config import config
            or_key = (
                os.getenv("SENTINEL_OPENROUTER_KEY")
                or os.getenv("OPENROUTER_API_KEY")
                or config.OPENROUTER_KEY
                or ""
            ).strip()
            if or_key and or_key != "your-openrouter-key-here":
                try:
                    or_headers = {
                        "Authorization": f"Bearer {or_key}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://sentinal-60073535541.development.catalystserverless.in",
                        "X-Title": "Project Sentinal — KSP Intelligence"
                    }
                    or_res = await client.post(
                        "https://openrouter.ai/api/v1/chat/completions",
                        json={
                            "model": config.OPENROUTER_MODEL or "google/gemma-3-27b-it:free",
                            "messages": messages,
                            "max_tokens": max_tokens
                        },
                        headers=or_headers,
                        timeout=30
                    )
                    log.info(f"[OpenRouter Fallback A] status={or_res.status_code}")
                    if or_res.status_code == 200:
                        data_or = or_res.json()
                        out_or = data_or.get("choices", [{}])[0].get("message", {}).get("content")
                        if out_or:
                            log.info("[OpenRouter Fallback A] SUCCESS")
                            return out_or
                    else:
                        attempt_errors.append(f"[OpenRouter status={or_res.status_code}: {or_res.text[:200]}]")
                except Exception as or_err:
                    attempt_errors.append(f"[OpenRouter err: {or_err}]")

            log.error(f"[QuickML] ALL attempts failed: {' | '.join(attempt_errors)}")
            return "LLM_SERVICE_UNAVAILABLE"
    except Exception as e:
        log.error(f"[QuickML] Client-level failure: {e}")
        return "LLM_SERVICE_UNAVAILABLE"


async def call_vision(
    system_prompt: str,
    user_prompt: str,
    image_b64: str,
    max_tokens: int = 1500,
    request=None,
) -> str:
    """Call Catalyst QuickML Qwen Vision model for image + text analysis."""
    headers = _get_auth_headers(request)
    if not headers:
        return "Catalyst QuickML Vision is not configured."

    body = {
        "model":       VISION_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": [
                    {"type": "text",      "text": user_prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}},
                ],
            },
        ],
        "max_tokens":  max_tokens,
        "temperature": 0.2,
    }

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(VISION_CHAT_URL, headers=headers, json=body)
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]
    except Exception as e:
        log.error(f"[QuickML Vision] Request failed: {e}")
        return f"Catalyst Vision error: {e}"
