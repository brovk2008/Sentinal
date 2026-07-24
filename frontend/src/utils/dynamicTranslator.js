/**
 * dynamicTranslator.js — Catalyst NLP Dynamic Translation Engine
 * 
 * Translates UI strings and document text dynamically via Catalyst NLP service (/api/v1/nlp/translate)
 * Caches translated phrases in memory / localStorage for instant rendering.
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const translationCache = new Map();

/**
 * Translate a string using Catalyst NLP service.
 */
export async function translateDynamic(text, targetLang = 'en', sourceLang = 'auto') {
  if (!text || typeof text !== 'string' || !text.trim() || targetLang === 'en') {
    return text;
  }

  const cacheKey = `${sourceLang}:${targetLang}:${text.trim()}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  try {
    const res = await fetch(`${BASE_URL}/api/v1/nlp/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text.trim(),
        source_lang: sourceLang,
        target_lang: targetLang,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.translated_text) {
        translationCache.set(cacheKey, data.translated_text);
        return data.translated_text;
      }
    }
  } catch (err) {
    console.warn('[DynamicTranslator] Catalyst NLP translation fallback:', err);
  }

  return text;
}

/**
 * Batch translate multiple strings dynamically.
 */
export async function batchTranslateDynamic(texts = [], targetLang = 'en') {
  if (!texts.length || targetLang === 'en') return texts;

  const results = await Promise.all(
    texts.map(txt => translateDynamic(txt, targetLang))
  );
  return results;
}
