import httpx
import os
import json
from config import config

# Catalyst QuickML settings from environment
QUICKML_URL = os.getenv("CATALYST_QUICKML_URL", "")
QUICKML_KEY = os.getenv("CATALYST_QUICKML_KEY", "")

async def call_ai(system_prompt: str, user_prompt: str, max_tokens: int = 2000) -> str:
    """
    Calls Catalyst QuickML if configured, else falls back to Groq Llama 3.3.
    """
    if QUICKML_URL and QUICKML_KEY:
        try:
            return await _call_quickml(system_prompt, user_prompt, max_tokens)
        except Exception as e:
            print(f"[QuickML] Request failed, falling back to Groq: {e}")

    # Fallback to Groq
    if config.GROQ_API_KEY:
        try:
            return await _call_groq(system_prompt, user_prompt, max_tokens)
        except Exception as e:
            print(f"[QuickML] Groq fallback failed: {e}")
            return f"Error executing LLM call: {e}"
            
    return "AI service not configured. Please set CATALYST_QUICKML_KEY or GROQ_API_KEY environment variables."

async def _call_quickml(system: str, user: str, max_tokens: int) -> str:
    # Determine the target endpoint URL
    url = QUICKML_URL.strip()
    if not url.endswith("/chat") and not url.endswith("/chat/"):
        url = f"{url.rstrip('/')}/chat/completions"
        
    # Extract model name/alias from the URL if possible
    model_name = "GLM-4.7-Flash"
    url_parts = url.rstrip("/").split("/")
    if url_parts:
        if url_parts[-1] == "chat":
            model_name = url_parts[-2]
        elif len(url_parts) >= 2 and url_parts[-2] == "chat":
            model_name = url_parts[-3]

    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            url,
            headers={
                "Authorization": f"Catalyst {QUICKML_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": model_name,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user",   "content": user}
                ],
                "max_tokens": max_tokens,
                "temperature": 0.2
            }
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]

async def _call_groq(system: str, user: str, max_tokens: int) -> str:
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {config.GROQ_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": config.GROQ_MODEL,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user",   "content": user}
                ],
                "max_tokens": max_tokens,
                "temperature": 0.2
            }
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]
