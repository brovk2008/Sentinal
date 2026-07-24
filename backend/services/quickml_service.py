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
import logging

log = logging.getLogger(__name__)

PROJECT_ID = os.getenv("SENTINAL_PROJECT_ID", "50170000000065001")
ORG_ID     = os.getenv("SENTINAL_ORG_ID",     "60073535541")

# Full endpoint URLs — taken directly from Catalyst QuickML console
GLM_CHAT_URL    = (
    os.getenv("SENTINAL_QUICKML_URL")
    or f"https://api.catalyst.zoho.in/quickml/v1/project/{PROJECT_ID}/glm/chat"
)
VISION_CHAT_URL = (
    os.getenv("SENTINAL_VISION_URL")
    or f"https://api.catalyst.zoho.in/quickml/v1/project/{PROJECT_ID}/qwen/chat"
)

DEFAULT_LLM_MODEL = os.getenv("SENTINAL_LLM_MODEL",    "GLM-4.7-Flash")
VISION_MODEL      = os.getenv("SENTINAL_VISION_MODEL", "VL-Qwen3.6-35B-A3B")


def _get_auth_headers() -> dict:
    """
    Build Catalyst QuickML auth headers.

    Inside AppSail: zcatalyst_sdk fetches a live OAuth token automatically.
    Locally (dev):  falls back to SENTINAL_QUICKML_KEY env var so you can
                    paste a token from the Catalyst console for testing.
    """
    # Try SDK-based token (works inside AppSail container automatically)
    try:
        import zcatalyst_sdk as catalyst
        app   = catalyst.initialize()
        token = app.credential.token()
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
) -> str:
    """Call Catalyst QuickML GLM chat model."""
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user",   "content": user_prompt},
    ]
    return await call_ai_messages(messages, max_tokens=max_tokens, model=model)


async def call_ai_messages(
    messages: list,
    max_tokens: int = 2000,
    model: str | None = None,
) -> str:
    """Call Catalyst QuickML with an OpenAI-style messages array."""
    headers = _get_auth_headers()
    if not headers:
        return (
            "Catalyst QuickML is not configured. "
            "Running inside AppSail: zcatalyst_sdk should auto-authenticate. "
            "For local dev, set SENTINAL_QUICKML_KEY to a valid Zoho OAuth token."
        )

    body = {
        "model":       model or DEFAULT_LLM_MODEL,
        "messages":    messages,
        "max_tokens":  max_tokens,
        "temperature": 0.2,
    }

    try:
        async with httpx.AsyncClient(timeout=90) as client:
            r = await client.post(GLM_CHAT_URL, headers=headers, json=body)
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]
    except Exception as e:
        log.error(f"[QuickML] GLM request failed: {e}")
        return f"Catalyst QuickML error: {e}"


async def call_vision(
    system_prompt: str,
    user_prompt: str,
    image_b64: str,
    max_tokens: int = 1500,
) -> str:
    """Call Catalyst QuickML Qwen Vision model for image + text analysis."""
    headers = _get_auth_headers()
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
