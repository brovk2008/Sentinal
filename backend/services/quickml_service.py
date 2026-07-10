import httpx
import os
from config import config

# Catalyst AppSail reserves all vars starting with CATALYST_ — use SENTINAL_ prefix.
# Fallbacks keep local dev (.env with old names) working.
PROJECT_ID = (
    os.getenv("SENTINAL_PROJECT_ID")
    or os.getenv("CATALYST_PROJECT_ID", "50170000000065001")
)
QUICKML_BASE = (
    os.getenv("SENTINAL_QUICKML_BASE")
    or f"https://api.catalyst.zoho.in/quickml/v1/project/{PROJECT_ID}"
)

QUICKML_URL = (
    os.getenv("SENTINAL_QUICKML_URL")
    or os.getenv("ZCAT_QUICKML_URL")
    or os.getenv("CATALYST_QUICKML_URL")
    or f"{QUICKML_BASE}/glm/chat"
)
QUICKML_KEY = (
    os.getenv("SENTINAL_QUICKML_KEY")
    or os.getenv("ZCAT_QUICKML_KEY")
    or os.getenv("CATALYST_QUICKML_KEY")
    or ""
)

DEFAULT_LLM_MODEL = (
    os.getenv("SENTINAL_LLM_MODEL")
    or os.getenv("CATALYST_LLM_MODEL", "GLM-4.7-Flash")
)
VISION_MODEL = (
    os.getenv("SENTINAL_VISION_MODEL")
    or os.getenv("CATALYST_VISION_MODEL", "VL-Qwen3.6-35B-A3B")
)


def _resolve_chat_url() -> str:
    url = QUICKML_URL.strip()
    if url.endswith("/chat") or url.endswith("/chat/"):
        return f"{url.rstrip('/')}/completions"
    if "/chat/completions" in url:
        return url
    return f"{url.rstrip('/')}/chat/completions"


def _resolve_model_name(explicit: str | None = None) -> str:
    if explicit:
        return explicit
    url_parts = QUICKML_URL.rstrip("/").split("/")
    if url_parts and url_parts[-1] not in ("chat", "completions"):
        return url_parts[-1]
    return DEFAULT_LLM_MODEL


async def call_ai(system_prompt: str, user_prompt: str, max_tokens: int = 2000, model: str | None = None) -> str:
    """Call Catalyst QuickML GLM-4.7-Flash (or configured model)."""
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    return await call_ai_messages(messages, max_tokens=max_tokens, model=model)


async def call_ai_messages(messages: list, max_tokens: int = 2000, model: str | None = None) -> str:
    """Call Catalyst QuickML with an OpenAI-style messages array."""
    if not QUICKML_KEY:
        return (
            "Catalyst QuickML is not configured. "
            "Set CATALYST_QUICKML_KEY (or ZCAT_QUICKML_KEY) in your environment."
        )

    url = _resolve_chat_url()
    model_name = _resolve_model_name(model)

    try:
        async with httpx.AsyncClient(timeout=90) as client:
            r = await client.post(
                url,
                headers={
                    "Authorization": f"Catalyst {QUICKML_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model_name,
                    "messages": messages,
                    "max_tokens": max_tokens,
                    "temperature": 0.2,
                },
            )
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"[QuickML] Request failed: {e}")
        return f"Catalyst QuickML error: {e}"


async def call_vision(system_prompt: str, user_prompt: str, image_b64: str, max_tokens: int = 1500) -> str:
    """Call Catalyst QuickML Qwen 3.6 Vision for image + text analysis."""
    if not QUICKML_KEY:
        return "Catalyst QuickML is not configured."

    vision_url = os.getenv("CATALYST_VISION_URL") or f"{QUICKML_BASE}/qwen/chat/completions"
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(
                vision_url,
                headers={
                    "Authorization": f"Catalyst {QUICKML_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": VISION_MODEL,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": user_prompt},
                                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}},
                            ],
                        },
                    ],
                    "max_tokens": max_tokens,
                    "temperature": 0.2,
                },
            )
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"[QuickML Vision] Request failed: {e}")
        return f"Catalyst Vision error: {e}"
