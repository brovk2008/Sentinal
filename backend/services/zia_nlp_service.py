"""
Catalyst Zia / QuickML trained NLP models:
  - Text Translation
  - Text-to-Audio Synthesis
  - Audio-to-Text Transcription
"""
import base64
import os
import httpx

PROJECT_ID = os.getenv("CATALYST_PROJECT_ID", "50170000000065001")
QUICKML_BASE = os.getenv(
    "CATALYST_QUICKML_BASE",
    f"https://api.catalyst.zoho.in/quickml/v1/project/{PROJECT_ID}",
)
CATALYST_KEY = os.getenv("ZCAT_QUICKML_KEY") or os.getenv("CATALYST_QUICKML_KEY") or ""

TRANSLATION_URL = os.getenv("CATALYST_NLP_TRANSLATION_URL") or f"{QUICKML_BASE}/nlp/text-translation"
TTS_URL = os.getenv("CATALYST_NLP_TTS_URL") or f"{QUICKML_BASE}/nlp/text-to-audio"
STT_URL = os.getenv("CATALYST_NLP_STT_URL") or f"{QUICKML_BASE}/nlp/audio-to-text"


def _headers() -> dict:
    return {
        "Authorization": f"Catalyst {CATALYST_KEY}",
        "Content-Type": "application/json",
    }


def is_configured() -> bool:
    return bool(CATALYST_KEY)


async def translate_text(text: str, source_lang: str = "en", target_lang: str = "kn") -> dict:
    """Translate text using Catalyst Text Translation model."""
    if not CATALYST_KEY:
        return {"success": False, "error": "Catalyst NLP not configured", "translated_text": text}

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                TRANSLATION_URL,
                headers=_headers(),
                json={"text": text, "source_language": source_lang, "target_language": target_lang},
            )
            r.raise_for_status()
            data = r.json()
            translated = (
                data.get("translated_text")
                or data.get("translation")
                or data.get("result", {}).get("translated_text")
                or text
            )
            return {"success": True, "translated_text": translated, "raw": data}
    except Exception as e:
        print(f"[Zia NLP] Translation failed: {e}")
        return {"success": False, "error": str(e), "translated_text": text}


async def text_to_speech(text: str, language: str = "en-IN") -> dict:
    """Synthesize speech from text using Catalyst Text-to-Audio model."""
    if not CATALYST_KEY:
        return {"success": False, "error": "Catalyst NLP not configured"}

    clean = text[:500]
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            r = await client.post(
                TTS_URL,
                headers=_headers(),
                json={"text": clean, "language": language},
            )
            r.raise_for_status()
            data = r.json()
            audio_b64 = (
                data.get("audio_base64")
                or data.get("audio")
                or data.get("result", {}).get("audio_base64")
            )
            if not audio_b64 and isinstance(data.get("data"), dict):
                audio_b64 = data["data"].get("audio_base64")
            return {"success": True, "audio_base64": audio_b64, "format": "wav", "raw": data}
    except Exception as e:
        print(f"[Zia NLP] TTS failed: {e}")
        return {"success": False, "error": str(e)}


async def speech_to_text(audio_bytes: bytes, language: str = "en-IN") -> dict:
    """Transcribe audio using Catalyst Audio-to-Text model."""
    if not CATALYST_KEY:
        return {"success": False, "error": "Catalyst NLP not configured", "transcript": ""}

    audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            r = await client.post(
                STT_URL,
                headers=_headers(),
                json={"audio_base64": audio_b64, "language": language, "format": "wav"},
            )
            r.raise_for_status()
            data = r.json()
            transcript = (
                data.get("transcript")
                or data.get("text")
                or data.get("result", {}).get("transcript")
                or ""
            )
            return {"success": True, "transcript": transcript.strip(), "raw": data}
    except Exception as e:
        print(f"[Zia NLP] STT failed: {e}")
        return {"success": False, "error": str(e), "transcript": ""}
