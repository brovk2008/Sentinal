/**
 * FileUploader.jsx
 * Universal drag-and-drop file upload component.
 * Calls uploadFile from api.js (POST /api/v1/uploads/upload)
 * Shows AI analysis result inline after upload.
 * Can be dropped into any page.
 */
import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { uploadFile } from '../api';

const FILE_ICONS = {
  image: '🖼️', document: '📄', data: '📊',
  audio: '🎵', video: '🎥', other: '📎',
};

const ENTITY_TYPES = [
  { value: 'evidence',  label: '🔬 Evidence' },
  { value: 'person',    label: '👤 Suspect Photo' },
  { value: 'cdr',       label: '📱 CDR Data (CSV)' },
  { value: 'document',  label: '📄 Document / FIR' },
  { value: 'cctv',      label: '📹 CCTV Frame' },
  { value: 'financial', label: '💰 Financial Record' },
];

export default function FileUploader({ caseId, onUploadComplete }) {
  const { t } = useTranslation();
  const [dragging,    setDragging]    = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [label,       setLabel]       = useState('');
  const [entityType,  setEntityType]  = useState('evidence');
  const [results,     setResults]     = useState([]);
  const [error,       setError]       = useState('');
  const [progress,    setProgress]    = useState('');

  const uploadFiles = useCallback(async (files) => {
    if (!files.length) return;
    setUploading(true);
    setError('');
    const newResults = [];

    for (const file of files) {
      setProgress(`Uploading ${file.name}...`);
      const fd = new FormData();
      fd.append('file', file);
      if (caseId)    fd.append('case_id', caseId);
      fd.append('label',       label || file.name);
      fd.append('entity_type', entityType);

      try {
        const data = await uploadFile(fd);
        if (data.success) {
          newResults.push(data);
          onUploadComplete?.(data);
        } else {
          setError(data.detail || data.error || 'Upload failed');
        }
      } catch (err) {
        setError(`Upload failed: ${err.message}`);
      }
    }

    setResults(r => [...newResults, ...r]);
    setUploading(false);
    setProgress('');
    setLabel('');
  }, [caseId, label, entityType, onUploadComplete]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    uploadFiles(Array.from(e.dataTransfer?.files || []));
  }, [uploadFiles]);

  const onDropOver = useCallback((e) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const onDropLeave = useCallback(() => {
    setDragging(false);
  }, []);

  const onInputChange = useCallback((e) => {
    uploadFiles(Array.from(e.target.files || []));
    e.target.value = '';
  }, [uploadFiles]);

  return (
    <div style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
      {/* Controls row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="File label (e.g. Suspect photo — Ramesh K.)"
          style={{
            flex: 1, minWidth: 200, background: 'var(--bg-primary)',
            border: '1px solid var(--border-subtle)', borderRadius: 4,
            color: 'var(--text-primary)', fontSize: 12, padding: '6px 10px',
          }}
        />
        <select
          value={entityType}
          onChange={e => setEntityType(e.target.value)}
          style={{
            background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
            borderRadius: 4, color: 'var(--text-primary)', fontSize: 12, padding: '6px 10px',
          }}
        >
          {ENTITY_TYPES.map(et => (
            <option key={et.value} value={et.value}>{et.label}</option>
          ))}
        </select>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={onDropOver}
        onDragLeave={onDropLeave}
        onDrop={onDrop}
        onClick={() => document.getElementById(`fu-input-${caseId || 'global'}`).click()}
        style={{
          border: `2px dashed ${dragging ? 'var(--copper-400)' : 'var(--border-subtle)'}`,
          borderRadius: 8, padding: '28px 20px', textAlign: 'center',
          cursor: 'pointer', marginBottom: 12,
          background: dragging ? 'rgba(200,129,74,0.06)' : 'var(--bg-primary)',
          transition: 'all 0.15s',
        }}
      >
        <input
          id={`fu-input-${caseId || 'global'}`}
          type="file" multiple accept="*/*"
          style={{ display: 'none' }}
          onChange={onInputChange}
        />
        {uploading ? (
          <div style={{ color: 'var(--copper-400)', fontSize: 12 }}>
            <span className="live-dot" style={{ marginRight: 8 }} />
            {progress || 'Uploading & analyzing with AI...'}
          </div>
        ) : (
          <>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📁</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Drag files here or click to upload
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              Photos · PDFs · CDR CSV · Audio · Video · Any file
            </div>
          </>
        )}
      </div>

      {error && (
        <div style={{ color: 'var(--status-danger)', fontSize: 11, marginBottom: 8 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Upload results */}
      {results.map((r, i) => (
        <div key={i} style={{
          padding: '10px 14px', marginBottom: 8, borderRadius: 6,
          background: 'rgba(74,200,128,0.05)',
          border: '1px solid rgba(74,200,128,0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 16 }}>{FILE_ICONS[r.file_type] || '📎'}</span>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{r.label}</span>
            <span style={{ fontSize: 10, color: 'var(--status-success)', marginLeft: 'auto' }}>
              ✓ Uploaded
            </span>
          </div>
          {r.ai_summary && (
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              🤖 <b>AI:</b> {r.ai_summary}
            </div>
          )}
          {r.ai_tags?.length > 0 && (
            <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {r.ai_tags.map((tag, j) => (
                <span key={j} style={{
                  fontSize: 9, padding: '1px 6px', borderRadius: 3,
                  background: 'rgba(200,129,74,0.1)', color: 'var(--copper-400)',
                  border: '1px solid rgba(200,129,74,0.2)',
                }}>{tag}</span>
              ))}
            </div>
          )}
          {r.file_type === 'image' && r.stratus_url && (
            <img
              src={r.stratus_url}
              alt={r.label}
              style={{ marginTop: 8, maxWidth: '100%', maxHeight: 200,
                       borderRadius: 4, border: '1px solid var(--border-subtle)' }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
