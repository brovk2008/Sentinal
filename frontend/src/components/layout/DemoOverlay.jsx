import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, ChevronRight, ChevronLeft, X, Play, Pause, ExternalLink,
  Keyboard, List, Info, HelpCircle, ArrowRight, Zap, Target, BookOpen,
  CheckCircle2, Compass, Layers
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
      // Don't intercept if user is typing in an input
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
      }, 10000);
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
      }, 500);
    } else if (step.action === 'navigate_with_case') {
      navigate(`${step.target}/${step.caseId || 1}`);
    } else if (step.action === 'navigate_and_type') {
      navigate(step.target);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('demo-auto-type', {
          detail: { query: step.query }
        }));
      }, 1200);
    } else if (step.action === 'custom_event') {
      navigate(step.target);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent(step.event));
      }, 700);
    } else if (step.action === 'custom_event_payload') {
      navigate(step.target);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent(step.event, {
          detail: step.payload
        }));
      }, 700);
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

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      width: isMinimized ? 260 : 440,
      maxWidth: 'calc(100vw - 48px)',
      background: 'linear-gradient(180deg, rgba(12, 16, 28, 0.98) 0%, rgba(6, 9, 18, 0.99) 100%)',
      border: '1px solid rgba(200, 129, 74, 0.4)',
      borderRadius: 12,
      boxShadow: '0 16px 48px rgba(0, 0, 0, 0.8), 0 0 24px rgba(200, 129, 74, 0.2)',
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      color: '#e2e8f0',
      fontFamily: 'Inter, system-ui, sans-serif',
      backdropFilter: 'blur(16px)',
      transition: 'width 0.2s ease, height 0.2s ease',
    }}>
      {/* ── TOP ACCENT PROGRESS BAR ─────────────────────────────────────── */}
      <div style={{ width: '100%', height: 3, background: 'rgba(255,255,255,0.08)', position: 'relative' }}>
        <div style={{
          width: `${progressPercent}%`,
          height: '100%',
          background: 'linear-gradient(90deg, #c8814a 0%, #38bdf8 100%)',
          transition: 'width 0.3s ease',
          boxShadow: '0 0 8px rgba(200, 129, 74, 0.8)',
        }} />
      </div>

      {/* ── HEADER STRIP ────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 14px',
        background: 'rgba(200, 129, 74, 0.08)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={14} color="#c8814a" />
          <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--copper-400)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            SENTINAL FULL SYSTEM TOUR
          </span>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 3,
            background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)'
          }}>
            {step.category || 'MODULE'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Chapter Menu Toggle */}
          <button
            onClick={() => setShowChapterMenu(prev => !prev)}
            title="Table of Contents (Jump to any step)"
            style={{
              background: showChapterMenu ? 'rgba(200, 129, 74, 0.25)' : 'none',
              border: 'none', color: showChapterMenu ? '#c8814a' : '#94a3b8',
              cursor: 'pointer', padding: '3px', borderRadius: 4, display: 'flex', alignItems: 'center'
            }}
          >
            <List size={14} />
          </button>

          {/* Minimize toggle */}
          <button
            onClick={() => setIsMinimized(prev => !prev)}
            title={isMinimized ? "Expand Guide" : "Minimize Guide"}
            style={{
              background: 'none', border: 'none', color: '#94a3b8',
              cursor: 'pointer', padding: '3px', borderRadius: 4, display: 'flex', alignItems: 'center', fontSize: 11
            }}
          >
            {isMinimized ? '▲' : '▼'}
          </button>

          {/* Exit */}
          <button
            onClick={handleExit}
            title="Exit Demo Tour (Esc)"
            style={{
              background: 'none', border: 'none', color: '#94a3b8',
              cursor: 'pointer', padding: '3px', borderRadius: 4, display: 'flex', alignItems: 'center'
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── CHAPTER MENU POPOVER ────────────────────────────────────────── */}
      {showChapterMenu && (
        <div style={{
          maxHeight: 280,
          overflowY: 'auto',
          background: 'rgba(6, 9, 18, 0.98)',
          borderBottom: '1px solid rgba(200, 129, 74, 0.3)',
          padding: '8px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}>
          <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, fontWeight: 700, paddingLeft: 4 }}>
            Jump to Feature Module:
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
                background: currentStepIndex === idx ? 'rgba(200, 129, 74, 0.25)' : 'transparent',
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
              <span style={{ fontSize: 9, color: '#64748b', marginLeft: 8 }}>{s.category}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── MAIN BODY CONTENT ───────────────────────────────────────────── */}
      {!isMinimized && (
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto' }}>
          {/* Step Number & Title */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
              <span style={{ fontSize: 10, color: '#38bdf8', fontFamily: 'monospace', fontWeight: 700 }}>
                STEP {step.step} OF {DEMO_STEPS.length}
              </span>
              <span style={{ fontSize: 9, color: '#64748b', fontFamily: 'monospace' }}>
                Route: {step.target}
              </span>
            </div>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc', margin: 0, lineHeight: 1.3 }}>
              {step.title}
            </h3>
          </div>

          {/* 1. What is this? */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: 6,
            padding: '8px 10px',
            fontSize: 11,
            color: '#cbd5e1',
            lineHeight: 1.45,
          }}>
            <div style={{ fontSize: 9, color: 'var(--copper-400)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Info size={11} />
              <span>What is this?</span>
            </div>
            {step.what_it_is || step.narrative}
          </div>

          {/* 2. What this does & Algorithm */}
          {step.what_it_does && (
            <div style={{
              background: 'rgba(56, 189, 248, 0.04)',
              border: '1px solid rgba(56, 189, 248, 0.15)',
              borderRadius: 6,
              padding: '8px 10px',
              fontSize: 11,
              color: '#e2e8f0',
              lineHeight: 1.45,
            }}>
              <div style={{ fontSize: 9, color: '#38bdf8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Zap size={11} />
                <span>What this does (Under the hood):</span>
              </div>
              {step.what_it_does}
            </div>
          )}

          {/* 3. How to use & Try It Live */}
          {step.how_to_use && (
            <div style={{
              background: 'rgba(200, 129, 74, 0.06)',
              border: '1px solid rgba(200, 129, 74, 0.25)',
              borderRadius: 6,
              padding: '8px 10px',
              fontSize: 11,
              color: '#f8fafc',
              lineHeight: 1.45,
            }}>
              <div style={{ fontSize: 9, color: 'var(--copper-400)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Compass size={11} />
                <span>How to use &amp; Try it live:</span>
              </div>
              {step.how_to_use}
            </div>
          )}

          {/* 4. Real Example scenario */}
          {step.example && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.05)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: 6,
              padding: '8px 10px',
              fontSize: 11,
              color: '#94a3b8',
              lineHeight: 1.4,
              fontStyle: 'normal',
              whiteSpace: 'pre-line'
            }}>
              <div style={{ fontSize: 9, color: '#10b981', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle2 size={11} />
                <span>Real Karnataka Police Scenario:</span>
              </div>
              {step.example}
            </div>
          )}

          {/* Action Trigger Button */}
          {step.interactive_label && (
            <button
              onClick={() => handleStepAction(step)}
              style={{
                width: '100%',
                padding: '7px 12px',
                borderRadius: 6,
                background: 'linear-gradient(135deg, rgba(200, 129, 74, 0.25) 0%, rgba(200, 129, 74, 0.1) 100%)',
                border: '1px solid var(--copper-400)',
                color: '#ffffff',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.15s ease',
              }}
            >
              <Zap size={12} color="#c8814a" />
              <span>▶ Re-Run Live Action: {step.interactive_label}</span>
            </button>
          )}
        </div>
      )}

      {/* ── BOTTOM CONTROLS & SHORTCUT BAR ──────────────────────────────── */}
      <div style={{
        padding: '10px 14px',
        background: 'rgba(0,0,0,0.5)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Navigation Controls */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              onClick={handlePrev}
              disabled={currentStepIndex === 0}
              style={{
                padding: '5px 10px',
                borderRadius: 5,
                background: currentStepIndex === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: currentStepIndex === 0 ? '#475569' : '#e2e8f0',
                fontSize: 11,
                fontWeight: 600,
                cursor: currentStepIndex === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              <ChevronLeft size={13} />
              <span>Back</span>
            </button>

            <button
              onClick={handleNext}
              disabled={currentStepIndex === DEMO_STEPS.length - 1}
              style={{
                padding: '5px 14px',
                borderRadius: 5,
                background: currentStepIndex === DEMO_STEPS.length - 1 ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg, #c8814a, #9e5b2b)',
                border: 'none',
                color: '#ffffff',
                fontSize: 11,
                fontWeight: 700,
                cursor: currentStepIndex === DEMO_STEPS.length - 1 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                boxShadow: currentStepIndex === DEMO_STEPS.length - 1 ? 'none' : '0 0 12px rgba(200, 129, 74, 0.4)',
              }}
            >
              <span>Next Step</span>
              <ChevronRight size={13} />
            </button>

            {/* Auto-Play Toggle */}
            <button
              onClick={() => setIsAutoPlay(prev => !prev)}
              title={isAutoPlay ? "Pause Auto-Tour (10s per slide)" : "Auto-Play Tour (10s per slide)"}
              style={{
                padding: '5px 8px',
                borderRadius: 5,
                background: isAutoPlay ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.08)',
                border: isAutoPlay ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                color: isAutoPlay ? '#10b981' : '#94a3b8',
                fontSize: 10,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              {isAutoPlay ? <Pause size={11} /> : <Play size={11} />}
              <span>{isAutoPlay ? 'Auto-Playing' : 'Auto'}</span>
            </button>
          </div>

          {/* Step Indicator */}
          <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>
            {currentStepIndex + 1} / {DEMO_STEPS.length}
          </span>
        </div>

        {/* Shortcuts reference strip */}
        {!isMinimized && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 9,
            color: '#64748b',
            borderTop: '1px solid rgba(255,255,255,0.04)',
            paddingTop: 4,
            fontFamily: 'monospace',
          }}>
            <span>[N] Next</span>
            <span>[P] Prev</span>
            <span>[Space] Auto</span>
            <span>[Ctrl+K] Palette</span>
            <span>[Esc] Close</span>
          </div>
        )}
      </div>
    </div>
  );
}
