import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DEMO_STEPS } from '../../data/demoScript'

export default function DemoOverlay() {
  const navigate = useNavigate()
  const [isVisible, setIsVisible] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  useEffect(() => {
    const handleToggle = () => {
      setIsVisible(prev => {
        const nextState = !prev
        if (nextState) {
          setCurrentStepIndex(0)
          // Run action for first step
          setTimeout(() => handleStepAction(DEMO_STEPS[0]), 100)
        } else {
          // Cleanup highlights on exit
          document.querySelectorAll('.demo-highlight').forEach(el => el.classList.remove('demo-highlight'))
        }
        return nextState
      })
    }

    window.addEventListener('toggle-demo-mode', handleToggle)
    return () => window.removeEventListener('toggle-demo-mode', handleToggle)
  }, [currentStepIndex])

  // Setup keyboard shortcuts
  useEffect(() => {
    if (!isVisible) return

    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase()
      if (key === 'arrowright' || key === 'n') {
        handleNext()
      } else if (key === 'arrowleft' || key === 'p') {
        handlePrev()
      } else if (e.key === 'Escape') {
        handleExit()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isVisible, currentStepIndex])

  const handleStepAction = (step) => {
    if (!step) return

    // Clean up highlights
    document.querySelectorAll('.demo-highlight').forEach(el => el.classList.remove('demo-highlight'))

    if (step.action === 'navigate') {
      navigate(step.target)
    } else if (step.action === 'highlight') {
      navigate(step.target)
      // Wait for page transition then highlight
      setTimeout(() => {
        const selector = step.highlight
        const el = document.querySelector(selector)
        if (el) {
          el.classList.add('demo-highlight')
        }
      }, 600)
    } else if (step.action === 'navigate_with_case') {
      navigate(`${step.target}/${step.caseId}`)
    } else if (step.action === 'navigate_and_type') {
      navigate(step.target)
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('demo-auto-type', {
          detail: { query: step.query }
        }))
      }, 1500)
    }
  }

  const handleNext = () => {
    if (currentStepIndex < DEMO_STEPS.length - 1) {
      const nextIndex = currentStepIndex + 1
      setCurrentStepIndex(nextIndex)
      handleStepAction(DEMO_STEPS[nextIndex])
    }
  }

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      const prevIndex = currentStepIndex - 1
      setCurrentStepIndex(prevIndex)
      handleStepAction(DEMO_STEPS[prevIndex])
    }
  }

  const handleExit = () => {
    document.querySelectorAll('.demo-highlight').forEach(el => el.classList.remove('demo-highlight'))
    setIsVisible(false)
    navigate('/dashboard')
  }

  if (!isVisible) return null

  const step = DEMO_STEPS[currentStepIndex]
  const progressPercent = ((currentStepIndex + 1) / DEMO_STEPS.length) * 100

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      left: 20,
      width: 320,
      background: 'var(--bg-card)',
      border: '1px solid var(--border-strong)',
      borderRadius: 'var(--card-radius)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Progress Bar */}
      <div style={{
        width: '100%',
        height: 3,
        background: 'var(--border-subtle)'
      }}>
        <div style={{
          width: `${progressPercent}%`,
          height: '100%',
          background: 'var(--copper-400)',
          transition: 'width 0.2s ease-in-out'
        }} />
      </div>

      <div style={{ padding: '16px' }}>
        {/* Step tracker */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8
        }}>
          <span style={{ fontSize: 10, color: 'var(--text-copper)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            Operation Shadow Net
          </span>
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            Step {step.step} of {DEMO_STEPS.length}
          </span>
        </div>

        {/* Title */}
        <h4 style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: 8
        }}>
          {step.title}
        </h4>

        {/* Narrative text */}
        <p style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
          marginBottom: 16,
          minHeight: 54
        }}>
          {step.narrative}
        </p>

        {/* Action Controls */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <button
            onClick={handleExit}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
              outline: 'none',
              padding: '4px 0'
            }}
          >
            EXIT DEMO
          </button>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handlePrev}
              disabled={currentStepIndex === 0}
              style={{
                padding: '6px 12px',
                borderRadius: 4,
                border: '1px solid var(--border-default)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: 11,
                cursor: currentStepIndex === 0 ? 'not-allowed' : 'pointer',
                opacity: currentStepIndex === 0 ? 0.5 : 1,
                outline: 'none'
              }}
            >
              ◀ PREV
            </button>
            <button
              onClick={handleNext}
              disabled={currentStepIndex === DEMO_STEPS.length - 1}
              style={{
                padding: '6px 12px',
                borderRadius: 4,
                border: '1px solid var(--copper-400)',
                background: 'rgba(200, 129, 74, 0.1)',
                color: 'var(--copper-200)',
                fontSize: 11,
                fontWeight: 600,
                cursor: currentStepIndex === DEMO_STEPS.length - 1 ? 'not-allowed' : 'pointer',
                opacity: currentStepIndex === DEMO_STEPS.length - 1 ? 0.5 : 1,
                outline: 'none'
              }}
            >
              NEXT ▶
            </button>
          </div>
        </div>
      </div>

      {/* Global CSS injection for highlighting */}
      <style>{`
        .demo-highlight {
          box-shadow: 0 0 0 2px var(--copper-400) !important;
          animation: highlight-pulse-anim 1.5s infinite alternate !important;
          border-color: var(--copper-400) !important;
          z-index: 1000 !important;
        }
        @keyframes highlight-pulse-anim {
          0% { box-shadow: 0 0 0 2px var(--copper-400); }
          100% { box-shadow: 0 0 8px 4px var(--copper-300); }
        }
      `}</style>
    </div>
  )
}
