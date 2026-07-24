import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

// Client-side cache to prevent calling the translation API multiple times for the same text
const translationCache = {}

export function ZiaText({ children, className, style }) {
  const { i18n } = useTranslation()
  const currentLang = i18n.language || 'en'
  const [translatedText, setTranslatedText] = useState(children)

  useEffect(() => {
    if (!children || typeof children !== 'string' || currentLang === 'en') {
      setTranslatedText(children)
      return
    }

    const cacheKey = `${currentLang}:${children}`
    if (translationCache[cacheKey]) {
      setTranslatedText(translationCache[cacheKey])
      return
    }

    // Call Zia Translation API via AppSail backend
    fetch('/api/v1/nlp/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: children,
        source_lang: 'en',
        target_lang: currentLang
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.translated_text) {
          translationCache[cacheKey] = data.translated_text
          setTranslatedText(data.translated_text)
        }
      })
      .catch(err => {
        console.warn("[ZiaTranslate] error translating:", err)
        setTranslatedText(children)
      })
  }, [children, currentLang])

  return <span className={className} style={style}>{translatedText}</span>
}
