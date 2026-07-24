/**
 * dynamicTranslator.js — Full-Page DOM Translation Engine for Sentinal
 *
 * How it works:
 *  1. On language change, walks the entire visible DOM collecting text nodes
 *  2. Deduplicates and batches them (max 50 per request)
 *  3. Sends to /api/v1/nlp/translate via the backend (Google Translate fallback)
 *  4. Replaces text nodes in-place with translated text
 *  5. Stores originals so switching back to English restores them instantly
 *  6. Caches all translations in memory to avoid re-fetching
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// In-memory caches
const translationCache = new Map()   // "lang:text" -> translated
const originalCache    = new Map()   // WeakRef to text node -> original value
const nodeRefs         = []          // track all translated nodes for restore

// Tags whose text we skip (scripts, styles, code, pre, etc.)
const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE', 'KBD', 'SAMP',
  'INPUT', 'SELECT', 'OPTION', 'SVG', 'MATH', 'CANVAS',
])

// Attribute classes to skip (numerical/code-like content)
const SKIP_CLASSES = ['mono', 'badge-code', 'live-dot']

let currentLang = 'en'
let translating  = false

/**
 * Collect all visible text nodes from the DOM.
 * Returns array of { node, text } objects.
 */
function collectTextNodes(root = document.body) {
  const results = []

  function walk(node) {
    if (!node) return

    // Skip script/style/code elements
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName
      if (SKIP_TAGS.has(tag)) return

      // Skip elements with skip classes
      const cls = node.className || ''
      if (SKIP_CLASSES.some(c => typeof cls === 'string' && cls.includes(c))) return

      // Skip hidden elements
      const style = window.getComputedStyle(node)
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return

      for (const child of node.childNodes) {
        walk(child)
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.trim()
      // Only translate meaningful text (not just spaces/numbers/punctuation)
      if (text.length > 1 && /[a-zA-Z]{2,}/.test(text)) {
        results.push({ node, text: node.textContent })
      }
    }
  }

  walk(root)
  return results
}

/**
 * Translate a single string via backend API.
 * Returns translated string or original on failure.
 */
async function translateString(text, targetLang) {
  if (!text || !text.trim() || targetLang === 'en') return text

  const key = `${targetLang}:${text.trim()}`
  if (translationCache.has(key)) return translationCache.get(key)

  try {
    const res = await fetch(`${BASE_URL}/api/v1/nlp/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text.trim(),
        source_lang: 'en',
        target_lang: targetLang,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      if (data && data.translated_text && data.translated_text !== text.trim()) {
        translationCache.set(key, data.translated_text)
        return data.translated_text
      }
    }
  } catch (err) {
    console.warn('[PageTranslator] API error:', err)
  }

  return text
}

/**
 * Batch translate an array of unique strings.
 * Sends one-by-one (backend doesn't have batch endpoint).
 * Uses Promise.all with concurrency limit.
 */
async function batchTranslate(texts, targetLang, concurrency = 8) {
  const results = new Map()
  const unique = [...new Set(texts.map(t => t.trim()).filter(t => t.length > 1 && /[a-zA-Z]{2,}/.test(t)))]

  // Process in chunks to avoid overwhelming the API
  for (let i = 0; i < unique.length; i += concurrency) {
    const chunk = unique.slice(i, i + concurrency)
    const promises = chunk.map(async text => {
      const translated = await translateString(text, targetLang)
      results.set(text, translated)
    })
    await Promise.all(promises)
  }

  return results
}

/**
 * Main page translation function.
 * Saves originals, translates all text nodes, replaces them.
 */
export async function translatePage(targetLang) {
  if (translating) return
  if (targetLang === currentLang) return

  translating = true
  currentLang = targetLang

  try {
    // If switching back to English, restore originals
    if (targetLang === 'en') {
      restoreOriginals()
      translating = false
      return
    }

    // Show visual indicator
    const indicator = showTranslatingIndicator()

    // Collect all text nodes
    const nodes = collectTextNodes(document.body)

    // Save originals (only for nodes not yet saved)
    nodes.forEach(({ node }) => {
      if (!node._sentinalOriginal) {
        node._sentinalOriginal = node.textContent
        node._sentinalLang = 'en'
      }
    })

    // Get unique texts to translate
    const texts = nodes.map(({ text }) => text.trim()).filter(t => t.length > 1)

    // Batch translate
    const translations = await batchTranslate(texts, targetLang)

    // Apply translations to DOM nodes
    nodes.forEach(({ node, text }) => {
      const key = text.trim()
      if (translations.has(key) && translations.get(key) !== key) {
        node.textContent = node.textContent.replace(key, translations.get(key))
        node._sentinalLang = targetLang
      }
    })

    // After applying, translate any dynamically added content
    // by observing DOM mutations for the next 3 seconds
    observeNewNodes(targetLang, 3000)

    hideTranslatingIndicator(indicator)
  } catch (err) {
    console.error('[PageTranslator] Translation failed:', err)
  }

  translating = false
}

/**
 * Restore all text nodes to their original English content.
 */
function restoreOriginals() {
  const allNodes = collectTextNodes(document.body)
  allNodes.forEach(({ node }) => {
    if (node._sentinalOriginal && node._sentinalLang !== 'en') {
      node.textContent = node._sentinalOriginal
      node._sentinalLang = 'en'
    }
  })
  // Clear cache for fresh re-translation
  translationCache.clear()
}

/**
 * Observe DOM mutations and translate newly added text nodes.
 */
function observeNewNodes(targetLang, durationMs) {
  const observer = new MutationObserver(async (mutations) => {
    const newNodes = []
    for (const mut of mutations) {
      for (const node of mut.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const collected = collectTextNodes(node)
          newNodes.push(...collected)
        }
      }
    }
    if (newNodes.length > 0) {
      const texts = newNodes.map(({ text }) => text.trim()).filter(t => t.length > 1)
      const translations = await batchTranslate(texts, targetLang)
      newNodes.forEach(({ node, text }) => {
        const key = text.trim()
        if (translations.has(key) && !node._sentinalOriginal) {
          node._sentinalOriginal = node.textContent
          node._sentinalLang = 'en'
          node.textContent = node.textContent.replace(key, translations.get(key))
          node._sentinalLang = targetLang
        }
      })
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })
  setTimeout(() => observer.disconnect(), durationMs)
}

/**
 * Show a "Translating..." indicator in the top-right corner.
 */
function showTranslatingIndicator() {
  const el = document.createElement('div')
  el.id = 'sentinal-translate-indicator'
  el.style.cssText = `
    position: fixed; top: 56px; right: 16px; z-index: 9999;
    background: rgba(20,22,30,0.95); border: 1px solid rgba(200,129,74,0.5);
    border-radius: 8px; padding: 8px 14px;
    font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600;
    color: #c8814a; display: flex; align-items: center; gap: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    animation: fadeIn 0.2s ease;
  `
  el.innerHTML = `<span style="animation: spin 1s linear infinite; display:inline-block">🌐</span> Translating page...`
  document.body.appendChild(el)
  return el
}

function hideTranslatingIndicator(el) {
  if (el && el.parentNode) {
    el.style.opacity = '0'
    el.style.transition = 'opacity 0.3s'
    setTimeout(() => el.parentNode && el.parentNode.removeChild(el), 300)
  }
}

/**
 * Translate a single string (used by ZiaTranslate component and other callers).
 */
export async function translateDynamic(text, targetLang = 'en', sourceLang = 'auto') {
  if (!text || typeof text !== 'string' || !text.trim() || targetLang === 'en') return text
  return translateString(text, targetLang)
}

/**
 * Batch translate multiple strings.
 */
export async function batchTranslateDynamic(texts = [], targetLang = 'en') {
  if (!texts.length || targetLang === 'en') return texts
  const map = await batchTranslate(texts, targetLang)
  return texts.map(t => map.get(t.trim()) || t)
}

/**
 * Initialize the page translator.
 * Listens for the sentinal-language-changed event dispatched by Topbar.
 */
export function initPageTranslator() {
  window.addEventListener('sentinal-language-changed', async (e) => {
    const { lang } = e.detail || {}
    if (lang) {
      await translatePage(lang)
    }
  })
  console.log('[PageTranslator] Initialized — listening for language changes')

  // Run initial translation if language is saved and is not English
  const savedLang = localStorage.getItem('sentinal_lang') || 'en'
  if (savedLang !== 'en') {
    const runInitial = () => {
      // Small delay to let page mount and fetch initial dashboard/case data
      setTimeout(() => {
        translatePage(savedLang).catch(err => console.warn('[PageTranslator] Startup translate failed:', err))
      }, 1500)
    }
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      runInitial()
    } else {
      window.addEventListener('DOMContentLoaded', runInitial)
    }
  }
}
