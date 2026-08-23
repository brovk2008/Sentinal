"""Catalyst Zia NLP endpoints — translation, TTS, STT."""
from fastapi import APIRouter, UploadFile, File, Request
from pydantic import BaseModel
from services import zia_nlp_service as zia

router = APIRouter()


class TranslateRequest(BaseModel):
    text: str
    source_lang: str = "auto"   # auto-detects Kannada, Hindi etc.
    target_lang: str = "en"



class TTSRequest(BaseModel):
    text: str
    language: str = "en-IN"


@router.get("/status")
async def nlp_status():
    return {
        "configured": zia.is_configured(),
        "models": ["Text Translation", "Text-to-Audio Synthesis", "Audio-to-Text Transcription"],
        "llm": "GLM-4.7-Flash",
        "vision": "VL-Qwen3.6-35B-A3B",
    }


@router.post("/translate")
async def translate(req: TranslateRequest, request: Request):
    return await zia.translate_text(req.text, req.source_lang, req.target_lang, request=request)


class TranslateBatchRequest(BaseModel):
    texts: list[str]
    source_lang: str = "auto"
    target_lang: str = "en"


@router.post("/translate-batch")
async def translate_batch_endpoint(req: TranslateBatchRequest, request: Request):
    return await zia.translate_batch(req.texts, target_lang=req.target_lang, source_lang=req.source_lang, request=request)


@router.post("/translate-html")
async def translate_html(body: dict, request: Request):
    html_content = body.get("html") or body.get("text") or ""
    target_lang = body.get("target_lang") or "en"
    source_lang = body.get("source_lang") or "auto"
    return await zia.translate_html_content(html_content, target_lang=target_lang, source_lang=source_lang, request=request)


@router.post("/text-to-speech")
async def text_to_speech(req: TTSRequest, request: Request):
    return await zia.text_to_speech(req.text, req.language, request=request)


@router.post("/speech-to-text")
async def speech_to_text(request: Request, audio: UploadFile = File(...), language: str = "en-IN"):
    audio_bytes = await audio.read()
    return await zia.speech_to_text(audio_bytes, language, request=request)

