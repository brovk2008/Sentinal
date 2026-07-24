"""
Catalyst Zia / QuickML trained NLP models:
  - Text Translation
  - Text-to-Audio Synthesis
  - Audio-to-Text Transcription
"""
import base64
import os
import httpx

PROJECT_ID = os.getenv("SENTINAL_PROJECT_ID") or os.getenv("CATALYST_PROJECT_ID", "50170000000065001")
ORG_ID     = os.getenv("SENTINAL_ORG_ID") or os.getenv("CATALYST_ORG_ID", "60073535541")
QUICKML_BASE = f"https://api.catalyst.zoho.in/quickml/v1/project/{PROJECT_ID}"
CATALYST_KEY = os.getenv("SENTINAL_QUICKML_KEY") or os.getenv("ZCAT_QUICKML_KEY") or os.getenv("CATALYST_QUICKML_KEY") or ""

TRANSLATION_URL = (
    os.getenv("SENTINAL_NLP_TRANSLATE_URL")
    or os.getenv("CATALYST_NLP_TRANSLATE_URL")
    or f"{QUICKML_BASE}/nlp/text-translation"
)
TTS_URL = os.getenv("SENTINAL_NLP_TTS_URL") or os.getenv("CATALYST_NLP_TTS_URL") or f"{QUICKML_BASE}/nlp/text-to-audio"
STT_URL = os.getenv("SENTINAL_NLP_STT_URL") or os.getenv("CATALYST_NLP_STT_URL") or f"{QUICKML_BASE}/nlp/audio-to-text"


def _headers(request=None) -> dict:
    try:
        import zcatalyst_sdk as catalyst
        app = None
        if request is not None:
            try:
                app = catalyst.initialize(req=request)
            except Exception as req_err:
                print(f"[Zia NLP] Request-based initialization failed: {req_err}. Falling back to default app...")
        
        if app is None:
            try:
                app = catalyst.initialize()
            except Exception as default_err:
                try:
                    app = catalyst.initialize_app(
                        credential=catalyst.credentials.ApplicationDefaultCredential().credential
                    )
                except Exception as app_err:
                    print(f"[Zia NLP] App-level initialization failed: {default_err} / {app_err}")

        if app is not None:
            raw_token = app.credential.token()
            token = raw_token[1] if isinstance(raw_token, (tuple, list)) and len(raw_token) > 1 else raw_token
            return {
                "Authorization": f"Zoho-oauthtoken {token}",
                "CATALYST-ORG": ORG_ID,
                "Content-Type": "application/json",
            }
    except Exception as e:
        print(f"[Zia NLP] Failed to get live Catalyst token: {e}")

    return {
        "Authorization": f"Zoho-oauthtoken {CATALYST_KEY}",
        "CATALYST-ORG": ORG_ID,
        "Content-Type": "application/json",
    }


def is_configured() -> bool:
    if CATALYST_KEY:
        return True
    try:
        import zcatalyst_sdk
        return True
    except ImportError:
        return False


async def translate_text(text: str, source_lang: str = "auto", target_lang: str = "kn", request=None) -> dict:
    """Translate text using Catalyst Zia first, then deep-translator (Google) as fallback."""
    
    # Language code map: our codes -> Google Translate codes
    LANG_MAP = {
        "en": "en", "kn": "kn", "hi": "hi", "ta": "ta",
        "te": "te", "ur": "ur", "mr": "mr", "pa": "pa",
        "gu": "gu", "ml": "ml", "bn": "bn", "auto": "auto",
    }
    google_target = LANG_MAP.get(target_lang, target_lang)
    google_source = LANG_MAP.get(source_lang, "auto")

    if not text or not text.strip():
        return {"success": True, "translated_text": text}

    # 1. Try Catalyst Zia first (when creds are available)
    headers = _headers(request)
    urls = [
        f"https://api.catalyst.zoho.in/baas/v1/project/{PROJECT_ID}/ml/text-analytics/translation",
        TRANSLATION_URL,
    ]
    for url in urls:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                r = await client.post(
                    url, headers=headers,
                    json={"text": text, "source_language": source_lang, "target_language": target_lang, "text_list": [text]},
                )
                if r.status_code == 200:
                    data = r.json()
                    translated = (
                        data.get("translated_text")
                        or data.get("translation")
                        or (data.get("data") if isinstance(data.get("data"), str) else None)
                        or (data.get("data") or {}).get("translated_text")
                        or (data.get("result") or {}).get("translated_text")
                    )
                    if translated:
                        return {"success": True, "translated_text": translated, "engine": "catalyst-zia"}
        except Exception:
            pass

    # 2. Real fallback: Google Translate via deep-translator (no API key needed)
    try:
        from deep_translator import GoogleTranslator
        # deep-translator runs synchronously — offload to thread
        import asyncio
        loop = asyncio.get_event_loop()
        
        def _do_translate():
            src = google_source if google_source != "auto" else "auto"
            chunks = [text[i:i+4000] for i in range(0, len(text), 4000)]
            translated_chunks = []
            for chunk in chunks:
                translated_chunks.append(
                    GoogleTranslator(source=src, target=google_target).translate(chunk)
                )
            return " ".join(translated_chunks)

        translated = await loop.run_in_executor(None, _do_translate)
        if translated:
            return {"success": True, "translated_text": translated, "engine": "google-translate"}
    except Exception as e:
        print(f"[Translation] deep-translator failed: {e}")

    # 3. Last resort: LibreTranslate public endpoint
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                "https://libretranslate.de/translate",
                json={"q": text, "source": google_source if google_source != "auto" else "auto", "target": google_target, "format": "text"},
                headers={"Content-Type": "application/json"},
            )
            if r.status_code == 200:
                data = r.json()
                translated = data.get("translatedText")
                if translated:
                    return {"success": True, "translated_text": translated, "engine": "libretranslate"}
    except Exception:
        pass

    return {"success": False, "translated_text": text, "error": "All translation engines failed"}



async def text_to_speech(text: str, language: str = "en-IN", request=None) -> dict:
    """Synthesize speech from text using Catalyst Text-to-Audio model."""
    if not is_configured():
        return {"success": False, "error": "Catalyst NLP not configured"}

    clean = text[:500]
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            r = await client.post(
                TTS_URL,
                headers=_headers(request),
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


async def speech_to_text(audio_bytes: bytes, language: str = "en-IN", request=None) -> dict:
    """Transcribe audio using Catalyst Audio-to-Text model."""
    if not is_configured():
        return {"success": False, "error": "Catalyst NLP not configured", "transcript": ""}

    audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            r = await client.post(
                STT_URL,
                headers=_headers(request),
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
