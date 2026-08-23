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
    # 1. Direct Google GTX API via httpx (fastest, universally accessible)
    try:
        import urllib.parse
        paragraphs = [p for p in text.split("\n") if p.strip()]
        if not paragraphs:
            paragraphs = [text]
        
        chunks = []
        cur_chunk = ""
        for p in paragraphs:
            if len(cur_chunk) + len(p) + 1 > 1500:
                if cur_chunk:
                    chunks.append(cur_chunk)
                cur_chunk = p
            else:
                cur_chunk = f"{cur_chunk}\n{p}" if cur_chunk else p
        if cur_chunk:
            chunks.append(cur_chunk)

        translated_chunks = []
        async with httpx.AsyncClient(timeout=15) as client:
            for c in chunks:
                if not c.strip():
                    continue
                q_enc = urllib.parse.quote(c)
                url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl={google_source}&tl={google_target}&dt=t&q={q_enc}"
                r = await client.get(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
                if r.status_code == 200:
                    data = r.json()
                    chunk_trans = "".join([s[0] for s in data[0] if s and s[0]])
                    translated_chunks.append(chunk_trans if chunk_trans else c)
                else:
                    translated_chunks.append(c)

        if translated_chunks:
            full_translated = "\n".join(translated_chunks)
            if full_translated.strip():
                return {"success": True, "translated_text": full_translated, "engine": "google-translate-gtx"}
    except Exception as gtx_err:
        print(f"[Translation] Google GTX failed: {gtx_err}")

    # 2. Zia Text Analytics Translation via Catalyst API
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

    # 3. Fallback: Google Translate via deep-translator
    try:
        from deep_translator import GoogleTranslator
        import asyncio
        loop = asyncio.get_event_loop()
        
        def _do_translate():
            src = google_source if google_source != "auto" else "auto"
            paragraphs = [p for p in text.split("\n") if p.strip()]
            if not paragraphs:
                paragraphs = [text]
            
            chunks = []
            cur_chunk = ""
            for p in paragraphs:
                if len(cur_chunk) + len(p) + 1 > 3500:
                    if cur_chunk:
                        chunks.append(cur_chunk)
                    cur_chunk = p
                else:
                    cur_chunk = f"{cur_chunk}\n{p}" if cur_chunk else p
            if cur_chunk:
                chunks.append(cur_chunk)
                
            translated_chunks = []
            translator = GoogleTranslator(source=src, target=google_target)
            for chunk in chunks:
                if len(chunk.strip()) > 0:
                    try:
                        translated_chunks.append(translator.translate(chunk))
                    except Exception:
                        translated_chunks.append(chunk)
            return "\n".join(translated_chunks)

        translated = await loop.run_in_executor(None, _do_translate)
        if translated:
            return {"success": True, "translated_text": translated, "engine": "google-translate"}
    except Exception as e:
        print(f"[Translation] deep-translator failed: {e}")

    # 4. Catalyst QuickML LLM Translation
    try:
        from services.quickml_service import call_llm
        llm_prompt = f"Translate the following Indian police document text into {target_lang}. Return ONLY the direct translation without any explanation or conversational filler:\n\n{text[:3000]}"
        llm_out = await call_llm("You are an expert multilingual legal and police translator.", llm_prompt, request=request)
        if llm_out and len(llm_out) > 5 and "error" not in llm_out.lower():
            return {"success": True, "translated_text": llm_out.strip(), "engine": "catalyst-quickml-llm"}
    except Exception as qml_err:
        print(f"[Translation] QuickML LLM failed: {qml_err}")

    # 5. Last resort: LibreTranslate public endpoint
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                "https://libretranslate.de/translate",
                json={"q": text[:2000], "source": google_source if google_source != "auto" else "auto", "target": google_target, "format": "text"},
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


async def translate_fir_fields(parsed_data: dict, target_lang: str = "en", request=None) -> dict:
    """Translate all natural-language text fields of a parsed FIR dictionary."""
    if not parsed_data:
        return {}
    
    result = dict(parsed_data)
    fields_to_translate = [
        "complainant_name", "complainant_father", "place_of_occurrence",
        "act_section", "crime_group", "fir_narrative", "fir_contents",
        "district", "police_station", "sho_name", "court_name", "village", "beat_name"
    ]
    
    # Translate single scalar text fields
    for field in fields_to_translate:
        val = result.get(field)
        if val and isinstance(val, str) and len(val.strip()) > 1:
            t_res = await translate_text(val, target_lang=target_lang, request=request)
            if t_res and t_res.get("success") and t_res.get("translated_text"):
                result[field] = t_res["translated_text"]

    # Translate accused array
    if isinstance(result.get("accused"), list):
        translated_accused = []
        for acc in result["accused"]:
            a_copy = dict(acc) if isinstance(acc, dict) else {"name": str(acc)}
            if a_copy.get("name") and len(str(a_copy["name"]).strip()) > 1:
                t_name = await translate_text(str(a_copy["name"]), target_lang=target_lang, request=request)
                if t_name.get("success"):
                    a_copy["name"] = t_name.get("translated_text")
            if a_copy.get("address") and len(str(a_copy["address"]).strip()) > 1:
                t_addr = await translate_text(str(a_copy["address"]), target_lang=target_lang, request=request)
                if t_addr.get("success"):
                    a_copy["address"] = t_addr.get("translated_text")
            translated_accused.append(a_copy)
        result["accused"] = translated_accused

    # Translate victims array
    if isinstance(result.get("victims"), list):
        translated_victims = []
        for vic in result["victims"]:
            v_copy = dict(vic) if isinstance(vic, dict) else {"name": str(vic)}
            if v_copy.get("name") and len(str(v_copy["name"]).strip()) > 1:
                t_name = await translate_text(str(v_copy["name"]), target_lang=target_lang, request=request)
                if t_name.get("success"):
                    v_copy["name"] = t_name.get("translated_text")
            translated_victims.append(v_copy)
        result["victims"] = translated_victims

    return result



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
