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

    # Smart source language script detection
    import re
    if google_source == "auto" or not google_source:
        if re.search(r"[\u0C80-\u0CFF]", text):      # Kannada script
            google_source = "kn"
        elif re.search(r"[\u0900-\u097F]", text):    # Devanagari (Hindi/Marathi)
            google_source = "hi"
        elif re.search(r"[\u0C00-\u0C7F]", text):    # Telugu script
            google_source = "te"
        elif re.search(r"[\u0B80-\u0BFF]", text):    # Tamil script
            google_source = "ta"
        elif re.search(r"[\u0600-\u06FF]", text):    # Urdu / Arabic script
            google_source = "ur"
        elif re.search(r"[a-zA-Z]{2,}", text):       # Latin English script
            google_source = "en"
        else:
            google_source = "auto"

    # Normalize all-caps titles
    norm_text = text.title() if (text.isupper() and len(text) > 3) else text

    # ── Tier 1: Direct Google GTX API via Async httpx (Fastest & Non-Blocking) ──
    try:
        import urllib.parse
        paragraphs = [p for p in norm_text.split("\n") if p.strip()]
        if not paragraphs:
            paragraphs = [norm_text]
        
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
        async with httpx.AsyncClient(timeout=4.0) as client:
            for c in chunks:
                if not c.strip():
                    continue
                q_enc = urllib.parse.quote(c)
                url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl={google_source}&tl={google_target}&dt=t&q={q_enc}"
                r = await client.get(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
                if r.status_code == 200:
                    data = r.json()
                    chunk_trans = "".join([s[0] for s in data[0] if s and s[0]])
                    if chunk_trans and chunk_trans.strip():
                        translated_chunks.append(chunk_trans)
                    else:
                        raise Exception("Empty GTX chunk")
                else:
                    raise Exception(f"GTX status {r.status_code}")

        if translated_chunks:
            full_translated = "\n".join(translated_chunks)
            if full_translated.strip():
                return {"success": True, "translated_text": full_translated, "engine": "google-translate-gtx"}
    except Exception as gtx_err:
        print(f"[Translation] Google GTX tier failed: {gtx_err}")

    # ── Tier 2: deep-translator GoogleTranslator (Robust Fallback) ───────────────
    try:
        from deep_translator import GoogleTranslator
        import asyncio
        loop = asyncio.get_event_loop()
        
        def _do_deep_translate():
            src = google_source if google_source != "auto" else "auto"
            paragraphs = [p for p in norm_text.split("\n") if p.strip()]
            if not paragraphs:
                paragraphs = [norm_text]
            
            chunks = []
            cur_chunk = ""
            for p in paragraphs:
                if len(cur_chunk) + len(p) + 1 > 3000:
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
                    tr = translator.translate(chunk)
                    if tr and len(tr.strip()) > 0:
                        translated_chunks.append(tr)
                    else:
                        translated_chunks.append(chunk)
            return "\n".join(translated_chunks)

        translated = await asyncio.wait_for(loop.run_in_executor(None, _do_deep_translate), timeout=5.0)
        if translated and translated.strip():
            return {"success": True, "translated_text": translated, "engine": "google-deep-translator"}
    except Exception as deep_err:
        print(f"[Translation] deep-translator tier failed: {deep_err}")

    # ── Tier 3: Catalyst QuickML AI LLM (Legal Context Translator) ───────────────
    try:
        from services.quickml_service import call_ai
        llm_prompt = f"Translate the following Indian police FIR and legal text into {target_lang}. Translate ALL headers, labels, and text faithfully into {target_lang}. Return ONLY the direct translation without any explanation or commentary:\n\n{norm_text[:2500]}"
        llm_out = await asyncio.wait_for(call_ai("You are an expert multilingual Indian legal translator.", llm_prompt, request=request), timeout=5.0)
        if llm_out and len(llm_out) > 5 and "error" not in llm_out.lower() and llm_out.strip() != norm_text.strip():
            return {"success": True, "translated_text": llm_out.strip(), "engine": "catalyst-quickml-llm"}
    except Exception as qml_err:
        print(f"[Translation] QuickML LLM tier failed: {qml_err}")

    # ── Tier 4: Catalyst Zia Text Analytics Translation API ───────────────────────
    headers = _headers(request)
    urls = [
        f"https://api.catalyst.zoho.in/baas/v1/project/{PROJECT_ID}/ml/text-analytics/translation",
        TRANSLATION_URL,
    ]
    for url in urls:
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                r = await client.post(
                    url, headers=headers,
                    json={"text": norm_text, "source_language": google_source, "target_language": google_target, "text_list": [norm_text]},
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
                    if translated and translated.strip() != norm_text.strip():
                        return {"success": True, "translated_text": translated, "engine": "catalyst-zia"}
        except Exception:
            pass

    # ── Tier 4: Direct Google GTX API via httpx with Rotating User-Agents ────────
    try:
        import urllib.parse
        paragraphs = [p for p in norm_text.split("\n") if p.strip()]
        if not paragraphs:
            paragraphs = [norm_text]
        
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
                r = await client.get(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
                if r.status_code == 200:
                    data = r.json()
                    chunk_trans = "".join([s[0] for s in data[0] if s and s[0]])
                    if chunk_trans and chunk_trans.strip():
                        translated_chunks.append(chunk_trans)
                    else:
                        raise Exception("Empty GTX chunk")
                else:
                    raise Exception(f"GTX status {r.status_code}")

        if translated_chunks:
            full_translated = "\n".join(translated_chunks)
            if full_translated.strip():
                return {"success": True, "translated_text": full_translated, "engine": "google-translate-gtx"}
    except Exception as gtx_err:
        print(f"[Translation] Google GTX tier failed: {gtx_err}")

    # ── Tier 5: MyMemory Translator Fallback ──────────────────────────────────────
    try:
        from deep_translator import MyMemoryTranslator
        import asyncio
        loop = asyncio.get_event_loop()
        mm_tr = await loop.run_in_executor(None, lambda: MyMemoryTranslator(source=google_source, target=google_target).translate(norm_text[:500]))
        if mm_tr and mm_tr.strip() and mm_tr.strip() != norm_text.strip():
            return {"success": True, "translated_text": mm_tr, "engine": "mymemory-translator"}
    except Exception:
        pass

    return {"success": False, "translated_text": text, "error": "All translation engines failed"}


async def translate_html_content(html_str: str, target_lang: str = "en", source_lang: str = "auto", request=None) -> dict:
    """
    Translates an entire HTML document (including headers, table cells, labels, facts, signatures)
    while strictly preserving all HTML tags, layout styling, tables, borders, and CSS classes.
    """
    if not html_str or not html_str.strip() or target_lang in ["en", "original"]:
        return {"success": True, "translated_html": html_str}

    try:
        import re
        from bs4 import BeautifulSoup, NavigableString
        soup = BeautifulSoup(html_str, "html.parser")
        
        # Collect visible text nodes
        text_nodes = [
            node for node in soup.find_all(string=True)
            if node.parent.name not in ["script", "style", "noscript"] and node.strip() and len(node.strip()) > 1
        ]
        
        for node in text_nodes:
            orig = node.strip()
            # If text is purely digits/punctuation/symbols, skip
            if re.match(r"^[\d\s\:\/\-\,\.\(\)\#\%\&\@\_\|]+$", orig):
                continue
            t_res = await translate_text(orig, source_lang=source_lang, target_lang=target_lang, request=request)
            if t_res.get("success") and t_res.get("translated_text"):
                node.replace_with(NavigableString(t_res["translated_text"]))
                
        return {"success": True, "translated_html": str(soup), "engine": "catalyst-html-translator"}
    except Exception as html_err:
        print(f"[Translation] HTML translation error: {html_err}")
        return {"success": False, "translated_html": html_str, "error": str(html_err)}


async def translate_fir_fields(parsed_data: dict, target_lang: str = "en", request=None) -> dict:
    """Translate all natural-language text fields of a parsed FIR dictionary."""
    if not parsed_data:
        return {}
    
    result = dict(parsed_data)
    fields_to_translate = [
        "complainant_name", "complainant_father", "complainant_address", "complainant_occupation",
        "complainant_sex", "place_of_occurrence", "place", "occurrence_day",
        "act_section", "crime_group", "crime_category", "crime_type", "type_of_information",
        "fir_narrative", "fir_contents", "brief_facts", "action_taken",
        "district", "district_name", "police_station", "station_name", "sho_name", "sho_rank",
        "court_name", "village", "beat_name"
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
            if a_copy.get("status") and len(str(a_copy["status"]).strip()) > 1:
                t_stat = await translate_text(str(a_copy["status"]), target_lang=target_lang, request=request)
                if t_stat.get("success"):
                    a_copy["status"] = t_stat.get("translated_text")
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
            if v_copy.get("address") and len(str(v_copy["address"]).strip()) > 1:
                t_addr = await translate_text(str(v_copy["address"]), target_lang=target_lang, request=request)
                if t_addr.get("success"):
                    v_copy["address"] = t_addr.get("translated_text")
            translated_victims.append(v_copy)
        result["victims"] = translated_victims

    # Translate property array
    if isinstance(result.get("property"), list):
        translated_prop = []
        for pr in result["property"]:
            p_copy = dict(pr) if isinstance(pr, dict) else {"type": str(pr)}
            if p_copy.get("type") and len(str(p_copy["type"]).strip()) > 1:
                t_type = await translate_text(str(p_copy["type"]), target_lang=target_lang, request=request)
                if t_type.get("success"):
                    p_copy["type"] = t_type.get("translated_text")
            translated_prop.append(p_copy)
        result["property"] = translated_prop

    return result


async def translate_batch(texts: list, target_lang: str = "en", source_lang: str = "auto", request=None) -> dict:
    """Translates a list of strings efficiently in batch."""
    if not texts:
        return {"success": True, "translations": {}}
    
    unique_texts = [t for t in set(texts) if t and isinstance(t, str) and t.strip()]
    if target_lang in ["en", "original"]:
        return {"success": True, "translations": {t: t for t in unique_texts}}

    # Delimiter batching
    delimiter = "\n---SENTINAL_BREAK---\n"
    # Chunk into groups of 25 to respect token limits
    trans_map = {}
    chunk_size = 25
    
    for i in range(0, len(unique_texts), chunk_size):
        sub_chunk = unique_texts[i:i + chunk_size]
        joined = delimiter.join(sub_chunk)
        t_res = await translate_text(joined, source_lang=source_lang, target_lang=target_lang, request=request)
        if t_res.get("success") and t_res.get("translated_text"):
            parts = t_res["translated_text"].split("---SENTINAL_BREAK---")
            if len(parts) == len(sub_chunk):
                for orig, tr in zip(sub_chunk, parts):
                    trans_map[orig] = tr.strip()
        
        # Fallback for any missed
        for t in sub_chunk:
            if t not in trans_map:
                ind = await translate_text(t, source_lang=source_lang, target_lang=target_lang, request=request)
                trans_map[t] = ind.get("translated_text", t)
                
    return {"success": True, "translations": trans_map}



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
