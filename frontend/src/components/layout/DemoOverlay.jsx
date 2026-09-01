import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight, ChevronLeft, X, Play, Pause,
  List, Minus, Maximize2, Zap, ArrowRight, CornerDownRight
} from 'lucide-react';
import { DEMO_STEPS } from '../../data/demoScript';

export default function DemoOverlay() {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showChapterMenu, setShowChapterMenu] = useState(false);
  const autoPlayTimerRef = useRef(null);

  // Toggle listener
  useEffect(() => {
    const handleToggle = () => {
      setIsVisible(prev => {
        const nextState = !prev;
        if (nextState) {
          setCurrentStepIndex(0);
          setIsMinimized(false);
          setShowChapterMenu(false);
          setTimeout(() => handleStepAction(DEMO_STEPS[0]), 100);
        } else {
          cleanupHighlights();
          setIsAutoPlay(false);
        }
        return nextState;
      });
    };

    window.addEventListener('toggle-demo-mode', handleToggle);
    return () => window.removeEventListener('toggle-demo-mode', handleToggle);
  }, []);

  // Keyboard navigation shortcuts
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e) => {
      if (['input', 'textarea', 'select'].includes(e.target?.tagName?.toLowerCase())) return;

      const key = e.key.toLowerCase();
      if (key === 'arrowright' || key === 'n') {
        e.preventDefault();
        handleNext();
      } else if (key === 'arrowleft' || key === 'p') {
        e.preventDefault();
        handlePrev();
      } else if (key === 'escape') {
        e.preventDefault();
        handleExit();
      } else if (key === ' ' || key === 'spacebar') {
        e.preventDefault();
        setIsAutoPlay(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, currentStepIndex]);

  // Auto-play interval
  useEffect(() => {
    if (isAutoPlay && isVisible) {
      autoPlayTimerRef.current = setTimeout(() => {
        if (currentStepIndex < DEMO_STEPS.length - 1) {
          handleNext();
        } else {
          setIsAutoPlay(false);
        }
      }, 9000);
    } else {
      clearTimeout(autoPlayTimerRef.current);
    }
    return () => clearTimeout(autoPlayTimerRef.current);
  }, [isAutoPlay, currentStepIndex, isVisible]);

  const cleanupHighlights = () => {
    document.querySelectorAll('.demo-highlight').forEach(el => el.classList.remove('demo-highlight'));
  };

  const handleStepAction = (step) => {
    if (!step) return;
    cleanupHighlights();

    if (step.action === 'navigate') {
      navigate(step.target);
    } else if (step.action === 'highlight') {
      navigate(step.target);
      setTimeout(() => {
        if (step.highlight) {
          const el = document.querySelector(step.highlight);
          if (el) el.classList.add('demo-highlight');
        }
      }, 400);
    } else if (step.action === 'navigate_with_case') {
      navigate(`${step.target}/${step.caseId || 1}`);
    } else if (step.action === 'navigate_and_type') {
      navigate(step.target);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('demo-auto-type', {
          detail: { query: step.query }
        }));
      }, 1000);
    } else if (step.action === 'custom_event') {
      navigate(step.target);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent(step.event));
      }, 600);
    } else if (step.action === 'custom_event_payload') {
      navigate(step.target);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent(step.event, {
          detail: step.payload
        }));
      }, 600);
    }
  };

  const handleNext = () => {
    if (currentStepIndex < DEMO_STEPS.length - 1) {
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      handleStepAction(DEMO_STEPS[nextIndex]);
    } else {
      setIsAutoPlay(false);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      const prevIndex = currentStepIndex - 1;
      setCurrentStepIndex(prevIndex);
      handleStepAction(DEMO_STEPS[prevIndex]);
    }
  };

  const handleJumpToStep = (index) => {
    setCurrentStepIndex(index);
    setShowChapterMenu(false);
    handleStepAction(DEMO_STEPS[index]);
  };

  const handleExit = () => {
    cleanupHighlights();
    setIsAutoPlay(false);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  const step = DEMO_STEPS[currentStepIndex] || DEMO_STEPS[0];
  const progressPercent = ((currentStepIndex + 1) / DEMO_STEPS.length) * 100;
  const formattedStepNum = String(step.step).padStart(2, '0');
  const formattedTotalSteps = String(DEMO_STEPS.length).padStart(2, '0');

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      right: 20,
      width: isMinimized ? 280 : 420,
      maxWidth: 'calc(100vw - 40px)',
      background: '#0e131f',
      border: '1px solid #283347',
      borderRadius: 8,
      boxShadow: '0 12px 36px rgba(0, 0, 0, 0.65)',
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      color: '#e2e8f0',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      boxSizing: 'border-box',
    }}>
      {/* ── PROGRESS ACCENT LINE ────────────────────────────────────────── */}
      <div style={{ width: '100%', height: 2, background: '#1c2435', position: 'relative' }}>
        <div style={{
          width: `${progressPercent}%`,
          height: '100%',
          background: 'var(--copper-400)',
          transition: 'width 0.25s ease',
        }} />
      </div>

      {/* ── HEADER STRIP ────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 12px',
        background: '#131927',
        borderBottom: '1px solid #232c3f',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--copper-400)',
            fontFamily: 'monospace',
            letterSpacing: '0.04em'
          }}>
            STEP {formattedStepNum}/{formattedTotalSteps}
          </span>
          <span style={{ color: '#475569', fontSize: 10 }}>•</span>
          <span style={{
            fontSize: 10,
            fontWeight: 600,
            color: '#94a3b8',
            letterSpacing: '0.04em',
            textTransform: 'uppercase'
          }}>
            {step.category || 'MODULE'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Table of Contents Button */}
          <button
            onClick={() => setShowChapterMenu(prev => !prev)}
            title="Index Menu"
            aria-label="Table of contents"
            style={{
              background: showChapterMenu ? '#232c3f' : 'transparent',
              border: 'none',
              color: showChapterMenu ? '#f1f5f9' : '#94a3b8',
              cursor: 'pointer',
              padding: '4px 6px',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <List size={13} />
          </button>

          {/* Minimize Button */}
          <button
            onClick={() => setIsMinimized(prev => !prev)}
            title={isMinimized ? "Expand" : "Minimize"}
            aria-label={isMinimized ? "Expand" : "Minimize"}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px 6px',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {isMinimized ? <Maximize2 size={12} /> : <Minus size={13} />}
          </button>

          {/* Close Button */}
          <button
            onClick={handleExit}
            title="Close Tour (Esc)"
            aria-label="Close tour"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px 6px',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* ── CHAPTER INDEX MENU ─────────────────────────────────────────── */}
      {showChapterMenu && (
        <div style={{
          maxHeight: 260,
          overflowY: 'auto',
          background: '#0a0e17',
          borderBottom: '1px solid #232c3f',
          padding: '6px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
          <div style={{
            fontSize: 9,
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            padding: '4px 6px',
            fontWeight: 700
          }}>
            Table of Contents
          </div>
          {DEMO_STEPS.map((s, idx) => (
            <button
              key={s.step}
              onClick={() => handleJumpToStep(idx)}
              style={{
                textAlign: 'left',
                padding: '5px 8px',
                borderRadius: 4,
                fontSize: 11,
                cursor: 'pointer',
                background: currentStepIndex === idx ? '#1a2233' : 'transparent',
                border: currentStepIndex === idx ? '1px solid var(--copper-400)' : '1px solid transparent',
                color: currentStepIndex === idx ? '#ffffff' : '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {s.title}
              </span>
              <span style={{ fontSize: 9, color: '#475569', marginLeft: 8, flexShrink: 0 }}>
                {s.category}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── CARD BODY ───────────────────────────────────────────────────── */}
      {!isMinimized && (
        <div style={{
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          maxHeight: 380,
          overflowY: 'auto',
        }}>
          {/* Title */}
          <div>
            <h3 style={{
              fontSize: 13,
              fontWeight: 700,
              color: '#f8fafc',
              margin: 0,
              lineHeight: 1.35,
            }}>
              {step.title}
            </h3>
          </div>

          {/* Description */}
          <div style={{
            fontSize: 11,
            color: '#94a3b8',
            lineHeight: 1.5,
          }}>
            {step.what_it_is || step.narrative}
          </div>

          {/* Technical Capability Under the Hood */}
          {step.what_it_does && (
            <div style={{
              fontSize: 11,
              color: '#cbd5e1',
              lineHeight: 1.45,
              paddingLeft: 8,
              borderLeft: '2px solid #334155',
            }}>
              {step.what_it_does}
            </div>
          )}

          {/* Action & Example Box */}
          {(step.how_to_use || step.example) && (
            <div style={{
              background: '#131927',
              border: '1px solid #232c3f',
              borderRadius: 6,
              padding: '8px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              fontSize: 11,
            }}>
              {step.how_to_use && (
                <div style={{ color: '#e2e8f0', lineHeight: 1.4 }}>
                  <span style={{ color: 'var(--copper-400)', fontWeight: 600, marginRight: 4 }}>
                    Try:
                  </span>
                  {step.how_to_use}
                </div>
              )}

              {step.example && (
                <div style={{ color: '#94a3b8', lineHeight: 1.4, fontSize: 10, whiteSpace: 'pre-line' }}>
                  <span style={{ color: '#64748b', fontWeight: 600, marginRight: 4 }}>
                    Context:
                  </span>
                  {step.example}
                </div>
              )}
            </div>
          )}

          {/* Interactive Trigger Button */}
          {step.interactive_label && (
            <button
              onClick={() => handleStepAction(step)}
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: 5,
                background: '#182030',
                border: '1px solid #2d3b54',
                color: '#cbd5e1',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#232c3f'}
              onMouseLeave={e => e.currentTarget.style.background = '#182030'}
            >
              <Zap size={11} color="var(--copper-400)" />
              <span>{step.interactive_label}</span>
            </button>
          )}
        </div>
      )}

      {/* ── FOOTER CONTROLS & SHORTCUT HINTS ─────────────────────────────── */}
      <div style={{
        padding: '8px 12px',
        background: '#090d15',
        borderTop: '1px solid #1c2435',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Previous / Next buttons */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              onClick={handlePrev}
              disabled={currentStepIndex === 0}
              style={{
                padding: '4px 8px',
                borderRadius: 4,
                background: currentStepIndex === 0 ? '#111622' : '#1a2233',
                border: '1px solid #232c3f',
                color: currentStepIndex === 0 ? '#475569' : '#cbd5e1',
                fontSize: 11,
                fontWeight: 500,
                cursor: currentStepIndex === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <ChevronLeft size={12} />
              <span>Back</span>
            </button>

            <button
              onClick={handleNext}
              disabled={currentStepIndex === DEMO_STEPS.length - 1}
              style={{
                padding: '4px 12px',
                borderRadius: 4,
                background: currentStepIndex === DEMO_STEPS.length - 1 ? '#111622' : 'var(--copper-400)',
                border: 'none',
                color: currentStepIndex === DEMO_STEPS.length - 1 ? '#475569' : '#ffffff',
                fontSize: 11,
                fontWeight: 600,
                cursor: currentStepIndex === DEMO_STEPS.length - 1 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              <span>Next</span>
              <ChevronRight size={12} />
            </button>
          </div>

          {/* Auto-Play Toggle */}
          <button
            onClick={() => setIsAutoPlay(prev => !prev)}
            title={isAutoPlay ? "Pause Auto Tour" : "Play Auto Tour (9s interval)"}
            style={{
              padding: '3px 8px',
              borderRadius: 4,
              background: isAutoPlay ? '#152422' : 'transparent',
              border: isAutoPlay ? '1px solid #10b981' : '1px solid #232c3f',
              color: isAutoPlay ? '#10b981' : '#94a3b8',
              fontSize: 10,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            {isAutoPlay ? <Pause size={10} /> : <Play size={10} />}
            <span>{isAutoPlay ? 'Playing' : 'Auto'}</span>
          </button>
        </div>

        {/* Monospace Keyboard Shortcut Hint */}
        {!isMinimized && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 9,
            color: '#475569',
            fontFamily: 'monospace',
            borderTop: '1px solid #141a27',
            paddingTop: 4,
          }}>
            <span>[N] Next</span>
            <span>[P] Prev</span>
            <span>[Space] Auto</span>
            <span>[Esc] Exit</span>
          </div>
        )}
      </div>
    </div>
  );
}
