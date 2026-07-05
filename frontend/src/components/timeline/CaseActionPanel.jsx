import { useState, useEffect } from 'react'
import {
  updateCaseStatus,
  addInvestigationNote,
  flagAccused,
  linkSyndicate,
  fetchInvestigationNotes,
  fetchSyndicates
} from '../../api'

export default function CaseActionPanel({ caseId, currentStatusId, accused = [], onClose, onSaveSuccess }) {
  const [selectedStatusId, setSelectedStatusId] = useState(currentStatusId)
  const [noteText, setNoteText] = useState('')
  const [priorityFlags, setPriorityFlags] = useState({})
  const [selectedSyndicateId, setSelectedSyndicateId] = useState(0)
  const [syndicates, setSyndicates] = useState([])
  const [existingNotes, setExistingNotes] = useState([])
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState('idle') // 'idle' | 'success' | 'error'

  // Load existing notes, syndicates, and initial priority flags
  useEffect(() => {
    if (!caseId) return

    // Set initial priority flags for each accused
    const initialFlags = {}
    accused.forEach(a => {
      initialFlags[a.AccusedMasterID] = !!a.is_priority
    })
    setPriorityFlags(initialFlags)
    setSelectedStatusId(currentStatusId)
    setNoteText('')
    setSaveResult('idle')

    // Fetch existing notes
    fetchInvestigationNotes(caseId)
      .then(setExistingNotes)
      .catch(err => console.error('Error fetching notes:', err))

    // Fetch syndicates dropdown data
    fetchSyndicates()
      .then(data => {
        setSyndicates(data.syndicates || data || [])
      })
      .catch(err => console.error('Error fetching syndicates:', err))

    // Check if this case is already linked to a syndicate in DB
    // Since we don't have a direct case_syndicate_links GET, we can query it or we can let backend manage it,
    // or we can see if the case response contains it, or fetch it. For now, initializing selectedSyndicateId is fine.
    // Wait, let's look at case object to see if there is any syndicate ID associated.
    // The case object doesn't have syndicate, but let's see. If the case master schema doesn't have it, we can default to 0.
  }, [caseId, currentStatusId, accused])

  const handlePriorityToggle = (accusedId) => {
    setPriorityFlags(prev => ({
      ...prev,
      [accusedId]: !prev[accusedId]
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveResult('idle')
    try {
      const promises = []

      // 1. Status Update
      if (selectedStatusId !== currentStatusId) {
        promises.push(updateCaseStatus(caseId, Number(selectedStatusId)))
      }

      // 2. Add note if not empty
      if (noteText.trim()) {
        // Hardcode a demo officer ID of 1 (ACP Arjun R.)
        promises.push(addInvestigationNote(caseId, noteText.trim(), 1))
      }

      // 3. Flag accused (for any that changed)
      accused.forEach(a => {
        const initial = !!a.is_priority
        const current = !!priorityFlags[a.AccusedMasterID]
        if (initial !== current) {
          promises.push(flagAccused(a.AccusedMasterID, current))
        }
      })

      // 4. Link Syndicate
      if (selectedSyndicateId !== 0) {
        promises.push(linkSyndicate(caseId, Number(selectedSyndicateId)))
      }

      await Promise.all(promises)
      setSaveResult('success')
      setNoteText('')

      // Reload notes
      const notes = await fetchInvestigationNotes(caseId)
      setExistingNotes(notes)

      // Notify parent to refresh case detail view
      if (onSaveSuccess) {
        onSaveSuccess()
      }

      // Clear success flash after 2 seconds
      setTimeout(() => {
        setSaveResult('idle')
      }, 2000)

    } catch (err) {
      console.error('Error saving case actions:', err)
      setSaveResult('error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      width: 320,
      height: '100%',
      background: 'var(--bg-card)',
      borderLeft: '2px solid var(--border-strong)',
      display: 'flex',
      flexDirection: 'column',
      color: 'var(--text-primary)',
      zIndex: 100,
      position: 'relative'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div className="section-label" style={{ margin: 0, fontSize: 12, color: 'var(--text-copper)' }}>
          Case Actions
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ✕
        </button>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        
        {/* Section 1: Update Status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="section-label" style={{ fontSize: 10 }}>Update Case Status</div>
          <select
            value={selectedStatusId}
            onChange={(e) => setSelectedStatusId(e.target.value)}
            style={{
              padding: '8px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-default)',
              borderRadius: 6,
              color: 'var(--text-primary)',
              outline: 'none',
              cursor: 'pointer',
              width: '100%',
              fontFamily: 'var(--font-sans)',
              fontSize: 13
            }}
          >
            <option value="1">Registered</option>
            <option value="2">Under Investigation</option>
            <option value="3">Charge Sheeted</option>
            <option value="4">Court Trial</option>
            <option value="5">Closed</option>
          </select>
        </div>

        {/* Section 2: Link Syndicate */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="section-label" style={{ fontSize: 10 }}>Associate Crime Syndicate</div>
          <select
            value={selectedSyndicateId}
            onChange={(e) => setSelectedSyndicateId(e.target.value)}
            style={{
              padding: '8px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-default)',
              borderRadius: 6,
              color: 'var(--text-primary)',
              outline: 'none',
              cursor: 'pointer',
              width: '100%',
              fontFamily: 'var(--font-sans)',
              fontSize: 13
            }}
          >
            <option value="0">-- None / Select Syndicate --</option>
            {syndicates.map(s => (
              <option key={s.syndicate_id} value={s.syndicate_id}>
                {s.syndicate_name}
              </option>
            ))}
          </select>
        </div>

        {/* Section 3: Flag Accused */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="section-label" style={{ fontSize: 10 }}>Flag Accused Priority</div>
          {accused.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No accused registered for this case.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {accused.map(a => (
                <div key={a.AccusedMasterID} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 8px',
                  background: 'var(--bg-secondary)',
                  borderRadius: 6,
                  border: '1px solid var(--border-subtle)'
                }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{a.AccusedName}</span>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', position: 'relative' }}>
                    <input
                      type="checkbox"
                      checked={!!priorityFlags[a.AccusedMasterID]}
                      onChange={() => handlePriorityToggle(a.AccusedMasterID)}
                      style={{ display: 'none' }}
                    />
                    <div style={{
                      width: 32,
                      height: 18,
                      borderRadius: 9,
                      background: priorityFlags[a.AccusedMasterID] ? 'var(--status-danger)' : 'var(--text-muted)',
                      position: 'relative',
                      transition: 'background 0.2s'
                    }}>
                      <div style={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background: '#fff',
                        position: 'absolute',
                        top: 2,
                        left: priorityFlags[a.AccusedMasterID] ? 16 : 2,
                        transition: 'left 0.2s'
                      }} />
                    </div>
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 4: Investigation Notes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 180 }}>
          <div className="section-label" style={{ fontSize: 10 }}>Investigation Notes</div>
          
          {/* Notes list */}
          <div style={{
            maxHeight: 120,
            overflowY: 'auto',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 6,
            padding: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            marginBottom: 8
          }}>
            {existingNotes.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '10px 0' }}>
                No notes documented yet.
              </div>
            ) : (
              existingNotes.map(n => (
                <div key={n.note_id} style={{
                  padding: 6,
                  borderBottom: '1px solid var(--border-subtle)',
                  fontSize: 11
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-copper)', fontWeight: 500, fontSize: 10 }}>
                    <span>{n.officer_name || 'Officer'}</span>
                    <span className="mono" style={{ color: 'var(--text-muted)', fontSize: 9 }}>
                      {new Date(n.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', marginTop: 2, wordBreak: 'break-word' }}>
                    {n.note_text}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* New note input */}
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
            <textarea
              placeholder="Add operation progress details..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value.slice(0, 500))}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-default)',
                borderRadius: 6,
                padding: '8px',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: 12,
                resize: 'none',
                height: 70,
                outline: 'none'
              }}
            />
            <div style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              textAlign: 'right',
              marginTop: 4
            }}>
              {noteText.length}/500
            </div>
          </div>
        </div>

      </div>

      {/* Footer */}
      <div style={{
        padding: '16px',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%',
            padding: '10px',
            background: saveResult === 'success' ? 'var(--status-success)' :
                        saveResult === 'error' ? 'var(--status-danger)' : 'var(--text-copper)',
            border: 'none',
            borderRadius: 6,
            color: '#fff',
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'background 0.2s'
          }}
        >
          {saving ? (
            <>
              <span className="spinner" style={{
                width: 14,
                height: 14,
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
              }} />
              Saving Changes...
            </>
          ) : saveResult === 'success' ? (
            '✓ Changes Saved'
          ) : saveResult === 'error' ? (
            '✕ Error Saving'
          ) : (
            'Save All Changes'
          )}
        </button>
      </div>

      {/* Spinner animation inline */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
