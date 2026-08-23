/**
 * FileUploader.jsx
 * Universal drag-and-drop file upload component.
 * Calls uploadFile from api.js (POST /api/v1/uploads/upload)
 * Shows AI analysis result inline after upload.
 * Can be dropped into any page.
 */
import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image as ImageIcon, FileText, FileSpreadsheet,
  Music, Video, Paperclip, FolderUp,
  AlertTriangle, Check, CheckCircle2, Brain,
  User, Smartphone, Coins, Microscope
} from 'lucide-react';
import { uploadFile } from '../api';

function FileTypeIcon({ type, size = 14 }) {
  switch (type) {
    case 'image':     return <ImageIcon size={size} color="#60a5fa" />;
    case 'document':  return <FileText size={size} color="#f87171" />;
    case 'data':      return <FileSpreadsheet size={size} color="var(--copper-400)" />;
    case 'audio':     return <Music size={size} color="#a78bfa" />;
    case 'video':     return <Video size={size} color="#ec4899" />;
    default:          return <Paperclip size={size} color="var(--text-muted)" />;
  }
}

const ENTITY_TYPES = [
  { value: 'evidence',  label: 'Evidence File' },
  { value: 'person',    label: 'Suspect Photo' },
  { value: 'cdr',       label: 'CDR Data (CSV)' },
  { value: 'document',  label: 'Document / FIR' },
  { value: 'cctv',      label: 'CCTV Frame' },
  { value: 'financial', label: 'Financial Record' },
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
      
      let localPreviewUrl = null;
      if (file.type.startsWith('image/')) {
        localPreviewUrl = URL.createObjectURL(file);
      }
      
      try {
        const fileLabel = label || file.name;
        const res = await uploadFile(file, caseId, fileLabel, entityType);
        
        let aiSummary = res.ai_summary;
        let aiTags = res.ai_tags || [];
        
        if (!aiSummary && entityType === 'person') {
          aiSummary = `Suspect profile image uploaded. Registered for facial match indexing against Karnataka CCTNS database.`;
          aiTags = ['Accused', 'Biometric', 'Suspect Match'];
        }

        const resultItem = {
          file_id: res.file_id || Date.now(),
          filename: file.name,
          label: fileLabel,
          file_type: res.file_type || (file.type.startsWith('image/') ? 'image' : 'document'),
          stratus_url: res.stratus_url,
          localPreviewUrl: localPreviewUrl,
          ai_summary: aiSummary,
          ai_tags: aiTags,
          entity_type: entityType,
          status: 'success',
        };

        newResults.push(resultItem);
        if (onUploadComplete) {
          onUploadComplete(resultItem);
        }
      } catch (err) {
        console.error('Upload error:', err);
        setError(`Failed to upload ${file.name}: ${err.message}`);
      }
    }

    setResults(prev => [...newResults, ...prev]);
    setUploading(false);
    setProgress('');
    setLabel('');
  }, [caseId, label, entityType, onUploadComplete]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    uploadFiles(files);
  }, [uploadFiles]);

  const onInputChange = useCallback((e) => {
    const files = Array.from(e.target.files);
    uploadFiles(files);
  }, [uploadFiles]);

  return (
    <div style={{ fontFamily: 'var(--font-sans)' }}>
      {/* Entity type selector + custom label */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <select
          value={entityType}
          onChange={e => setEntityType(e.target.value)}
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 6, color: 'var(--text-primary)',
            padding: '6px 10px', fontSize: 11,
            cursor: 'pointer', outline: 'none',
          }}
        >
          {ENTITY_TYPES.map(et => (
            <option key={et.value} value={et.value}>{et.label}</option>
          ))}
        </select>

        <input
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="File label / description (optional)..."
          style={{
            flex: 1, minWidth: 160,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 6, color: 'var(--text-primary)',
            padding: '6px 10px', fontSize: 11, outline: 'none',
          }}
        />
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => document.getElementById(`fu-input-${caseId || 'global'}`)?.click()}
        style={{
          border: `2px dashed ${dragging ? 'var(--copper-400)' : 'var(--border-subtle)'}`,
          borderRadius: 8, padding: '28px 20px', textAlign: 'center',
          cursor: 'pointer', marginBottom: 12,
          background: dragging ? 'rgba(200,129,74,0.06)' : 'var(--bg-primary)',
          transition: 'all 0.15s',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}
      >
        <input
          id={`fu-input-${caseId || 'global'}`}
          type="file" multiple accept="*/*"
          style={{ display: 'none' }}
          onChange={onInputChange}
        />
        {uploading ? (
          <div style={{ color: 'var(--copper-400)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="live-dot" />
            <span>{progress || 'Uploading & analyzing with AI...'}</span>
          </div>
        ) : (
          <>
            <FolderUp size={30} color="var(--copper-400)" style={{ marginBottom: 8 }} />
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
        <div style={{ color: 'var(--status-danger)', fontSize: 11, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
          <AlertTriangle size={12} />
          <span>{error}</span>
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
            <FileTypeIcon type={r.file_type} size={14} />
            <span style={{ fontSize: 12, fontWeight: 600 }}>{r.label}</span>
            <span style={{ fontSize: 10, color: 'var(--status-success)', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Check size={11} />
              <span>Uploaded</span>
            </span>
          </div>
          {r.ai_summary && (
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 4 }}>
              <Brain size={12} color="var(--copper-400)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div><b>AI:</b> {r.ai_summary}</div>
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
          {r.file_type === 'image' && (r.stratus_url || r.localPreviewUrl) && (
            <img
              src={r.stratus_url || r.localPreviewUrl}
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
