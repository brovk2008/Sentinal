import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { translateText } from '../../api'

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

    translateText(children, 'en', currentLang)
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
