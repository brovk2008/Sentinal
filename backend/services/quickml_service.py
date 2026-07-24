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
    if not headers:
        return (
            "Catalyst QuickML is not configured. "
            "Running inside AppSail: zcatalyst_sdk should auto-authenticate. "
            "For local dev, set SENTINAL_QUICKML_KEY to a valid Zoho OAuth token."
        )

    user_text = "\n".join([m.get("content", "") for m in messages if m.get("role") == "user"]) or "Hello"
    sys_text = "\n".join([m.get("content", "") for m in messages if m.get("role") == "system"]) or "Assistant"

    payload_json = json.dumps({"messages": messages, "prompt": user_text, "model": model or DEFAULT_LLM_MODEL})
    
    # Clean headers without Content-Type for multipart/custom requests
    clean_headers = {k: v for k, v in headers.items() if k.lower() != "content-type"}

    # Attempt 1: Native Catalyst SDK app.quick_ml()
    try:
        import zcatalyst_sdk as catalyst
        if request is not None:
            c_app = catalyst.initialize(req=request)
            qml = c_app.quick_ml()
            # Try predict with GLM endpoint key or project ID
            res = qml.predict(end_point_key=PROJECT_ID, input_data={"prompt": user_text, "messages": json.dumps(messages)})
            if res:
                return str(res)
    except Exception as sdk_err:
        log.warning(f"[QuickML] SDK predict failed: {sdk_err}")

    PREDICT_URL = f"https://api.catalyst.zoho.in/quickml/v1/project/{PROJECT_ID}/endpoints/predict"

    attempts = [
        # Attempt 1: Standard SDK predict endpoint
        {
            "url": PREDICT_URL,
            "headers": {**headers, "X-QUICKML-ENDPOINT-KEY": PROJECT_ID},
            "json": {"data": {"prompt": user_text, "messages": messages}}
        },
        # Attempt 2: GLM chat with X-QUICKML-ENDPOINT-KEY
        {
            "url": GLM_CHAT_URL,
            "headers": {**headers, "X-QUICKML-ENDPOINT-KEY": PROJECT_ID},
            "json": {"data": {"prompt": user_text, "messages": messages}}
        },
        # Attempt 3: Predict endpoint with text string
        {
            "url": PREDICT_URL,
            "headers": {**headers, "X-QUICKML-ENDPOINT-KEY": PROJECT_ID},
            "json": {"data": {"text": user_text}}
        },
        # Attempt 4: GLM chat with prompt string
        {
            "url": GLM_CHAT_URL,
            "headers": headers,
            "json": {"data": {"prompt": user_text}}
        }
    ]

    attempt_errors = []
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            for i, kwargs in enumerate(attempts):
                target_url = kwargs.pop("url", GLM_CHAT_URL)
                try:
                    r = await client.post(target_url, **kwargs)
                    if r.status_code == 200:
                        data = r.json()
                        text = (
                            data.get("choices", [{}])[0].get("message", {}).get("content")
                            or data.get("output", {}).get("text")
                            or data.get("result")
                            or data.get("data")
                        )
                        if text:
                            return str(text)
                        return json.dumps(data)
                    else:
                        attempt_errors.append(f"[Attempt {i+1} code {r.status_code}: {r.text}]")
                except Exception as err:
                    attempt_errors.append(f"[Attempt {i+1} err: {err}]")

            return f"Catalyst QuickML errors: {' | '.join(attempt_errors)}"
    except Exception as e:
        log.error(f"[QuickML] GLM request failed: {e}")
        return f"Catalyst QuickML error: {e}"


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
