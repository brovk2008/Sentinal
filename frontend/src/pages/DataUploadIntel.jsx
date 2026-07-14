/**
 * DataUploadIntel.jsx
 * Upload ANY file → AI parses it → stores in user's knowledge base
 * CDR CSV → auto-detected → stored in cdr_records
 * PDF/Image → OCR → stored in uploaded_files + added to RAG
 * Per-user storage keyed by Catalyst user ID
 */
import { useState, useCallback, useEffect } from 'react';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const FILE_TYPES = {
  'text/csv':             { label: 'CDR / CSV Data',    icon: '📊', handler: 'cdr' },
  'application/pdf':      { label: 'FIR / Document',    icon: '📄', handler: 'pdf' },
  'image/jpeg':           { label: 'Photo / Evidence',  icon: '🖼️', handler: 'vision' },
  'image/png':            { label: 'Photo / Evidence',  icon: '🖼️', handler: 'vision' },
  'audio/webm':           { label: 'Audio Recording',   icon: '🎵', handler: 'audio' },
  'audio/mpeg':           { label: 'Audio File',        icon: '🎵', handler: 'audio' },
  'application/vnd.ms-excel': { label: 'Excel Data',   icon: '📊', handler: 'excel' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
                          { label: 'Excel Data',        icon: '📊', handler: 'excel' },
};

export default function DataUploadIntel() {
  const [uploads,     setUploads]     = useState([]);
  const [dragging,    setDragging]    = useState(false);
  const [processing,  setProcessing]  = useState(false);
  const [label,       setLabel]       = useState('');
  const [myFiles,     setMyFiles]     = useState([]);
  const [loadingFiles,setLoadingFiles]= useState(false);

  // Load user's existing uploads on mount
  useEffect(() => {
    setLoadingFiles(true);
    fetch(`${BASE_URL}/api/v1/uploads/list`)
      .then(r => r.json())
      .then(d => { setMyFiles(d.files || []); setLoadingFiles(false); })
      .catch(() => setLoadingFiles(false));
  }, []);

  const processFile = async (file) => {
    setProcessing(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('label', label || file.name);
    fd.append('add_to_rag', 'true');  // ← tells backend to add to RAG knowledge base

    try {
      const res  = await fetch(`${BASE_URL}/api/v1/uploads/upload`, { method: 'POST', body: fd });
      const data = await res.json();

      setUploads(prev => [{
        filename: file.name,
        type:     FILE_TYPES[file.type]?.label || 'File',
        icon:     FILE_TYPES[file.type]?.icon  || '📎',
        size:     (file.size / 1024).toFixed(1) + ' KB',
        ai_summary: data.ai_summary || 'Processing...',
        ai_tags:    data.ai_tags    || [],
        status:     data.success ? 'success' : 'error',
        file_id:    data.file_id,
        rag_added:  data.rag_added,
      }, ...prev]);

      // Reload files list
      fetch(`${BASE_URL}/api/v1/uploads/list`).then(r => r.json())
        .then(d => setMyFiles(d.files || [])).catch(() => {});

    } catch (e) {
      setUploads(prev => [{
        filename: file.name, status: 'error',
        ai_summary: `Upload failed: ${e.message}`,
      }, ...prev]);
    }
    setProcessing(false);
    setLabel('');
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer?.files) {
      Array.from(e.dataTransfer.files).forEach(processFile);
    }
  }, [label]);

  return (
    <div style={{ padding: '24px 32px', color: 'var(--text-primary)',
                  fontFamily: 'var(--font-sans)', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--copper-400)',
                     margin: 0, fontFamily: 'var(--font-mono)' }}>
          INTELLIGENCE DATA UPLOAD
        </h1>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
          Upload any file — AI automatically parses and adds it to your personal knowledge base.
          CDR files are auto-detected and indexed for movement analysis.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Upload zone */}
        <div>
          <input value={label} onChange={e => setLabel(e.target.value)}
            placeholder="File label (e.g. 'CDR for Suspect Ramesh K.')"
            style={{ width: '100%', marginBottom: 12, background: 'var(--bg-primary)',
                     border: '1px solid var(--border-subtle)', borderRadius: 4,
                     color: 'var(--text-primary)', fontSize: 12, padding: '8px 12px',
                     boxSizing: 'border-box' }} />

          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => {
              const inp = document.createElement('input');
              inp.type = 'file'; inp.multiple = true; inp.accept = '*/*';
              inp.onchange = e => {
                if (e.target.files) {
                  Array.from(e.target.files).forEach(processFile);
                }
              };
              inp.click();
            }}
            style={{
              border: `2px dashed ${dragging ? 'var(--copper-400)' : 'var(--border-subtle)'}`,
              borderRadius: 8, padding: '40px 20px', textAlign: 'center',
              cursor: 'pointer', marginBottom: 20,
              background: dragging ? 'rgba(200,129,74,0.06)' : 'var(--bg-primary)',
              transition: 'all 0.15s',
            }}>
            {processing ? (
              <div style={{ color: 'var(--copper-400)', fontSize: 13 }}>
                <span className="live-dot" style={{ marginRight: 8 }} />
                AI is analyzing your file...
              </div>
            ) : (
              <>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📁</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Drag any file here or click to upload
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  CDR CSV · FIR PDF · Suspect Photos · Audio · Excel · Any format
                </div>
              </>
            )}
          </div>

          {/* What AI does with each type */}
          <div style={{ background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--copper-400)', fontWeight: 700,
                          marginBottom: 10, textTransform: 'uppercase',
                          letterSpacing: '0.1em' }}>
              AI PROCESSING BY FILE TYPE
            </div>
            {[
              { icon: '📊', type: 'CDR CSV',        action: 'Auto-detects telco format → indexes towers, IMEI, call records → enables movement trail on map' },
              { icon: '📄', type: 'PDF / FIR',      action: 'Extracts text via Zia OCR → adds to your personal RAG knowledge base → AI can answer questions about it' },
              { icon: '🖼️', type: 'Photo / CCTV',  action: 'Zia Vision analyzes faces, objects, license plates, scene → adds description to knowledge base' },
              { icon: '🎵', type: 'Audio',           action: 'Zia STT transcribes → adds transcript to knowledge base → AI can search it' },
              { icon: '📊', type: 'Excel',           action: 'Parses rows/columns → detects financial patterns → adds to case data' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8,
                                    padding: '8px', borderRadius: 4,
                                    background: 'var(--bg-primary)' }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)',
                                marginBottom: 2 }}>{item.type}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)',
                                lineHeight: 1.4 }}>{item.action}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent uploads + AI results */}
        <div>
          {/* Upload results */}
          {uploads.map((u, i) => (
            <div key={i} style={{
              padding: '12px 16px', marginBottom: 10, borderRadius: 6,
              background: u.status === 'success'
                ? 'rgba(74,200,128,0.05)' : 'rgba(224,82,82,0.05)',
              border: `1px solid ${u.status === 'success'
                ? 'rgba(74,200,128,0.2)' : 'rgba(224,82,82,0.2)'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 18 }}>{u.icon || '📎'}</span>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{u.filename}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  {u.type} · {u.size}
                </span>
              </div>
              {u.ai_summary && (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)',
                              lineHeight: 1.5, marginBottom: u.ai_tags?.length ? 6 : 0 }}>
                  🤖 {u.ai_summary}
                </div>
              )}
              {u.rag_added && (
                <div style={{ fontSize: 10, color: 'var(--status-success)',
                              marginTop: 4 }}>
                  ✓ Added to your AI knowledge base — ask the AI Assistant about this file
                </div>
              )}
              {u.ai_tags?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                  {u.ai_tags.map((tag, j) => (
                    <span key={j} style={{
                      fontSize: 9, padding: '1px 6px', borderRadius: 3,
                      background: 'rgba(200,129,74,0.1)', color: 'var(--copper-400)',
                      border: '1px solid rgba(200,129,74,0.2)',
                    }}>{tag}</span>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* My files library */}
          <div style={{ background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--copper-400)', fontWeight: 700,
                          marginBottom: 12, textTransform: 'uppercase',
                          letterSpacing: '0.1em' }}>
              MY UPLOADED FILES ({myFiles.length})
            </div>
            {loadingFiles ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Loading...</div>
            ) : myFiles.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                No files uploaded yet. Upload a file above.
              </div>
            ) : myFiles.map((f, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 0', borderBottom: '1px solid var(--border-subtle)',
              }}>
                <span style={{ fontSize: 14 }}>
                  {FILE_TYPES[f.mime_type]?.icon || '📎'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)',
                                overflow: 'hidden', textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap' }}>
                    {f.label || f.filename}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {f.file_type} · {f.uploaded_at?.slice(0, 10)}
                  </div>
                </div>
                {f.stratus_url && (
                  <a href={f.stratus_url} target="_blank" rel="noreferrer"
                    style={{ fontSize: 10, color: 'var(--copper-400)',
                             textDecoration: 'none' }}>
                    View →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
