/**
 * DataUploadIntel.jsx
 * Upload ANY file → AI parses it → stores in user's knowledge base
 * CDR CSV → auto-detected → stored in cdr_records
 * PDF/Image → OCR → stored in uploaded_files + added to RAG
 * Per-user storage keyed by Catalyst user ID
 */
import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileSpreadsheet, FileText, Image as ImageIcon, Music,
  Paperclip, FolderUp, Brain, Check, CheckCircle2,
  AlertCircle, ExternalLink, Activity, Sparkles, LayoutDashboard
} from 'lucide-react';
import { autoGenerateCanvas } from '../api';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const FILE_TYPES = {
  'text/csv':             { label: 'CDR / CSV Data',    icon: 'csv', handler: 'cdr' },
  'application/pdf':      { label: 'FIR / Document',    icon: 'pdf', handler: 'pdf' },
  'image/jpeg':           { label: 'Photo / Evidence',  icon: 'image', handler: 'vision' },
  'image/png':            { label: 'Photo / Evidence',  icon: 'image', handler: 'vision' },
  'audio/webm':           { label: 'Audio Recording',   icon: 'audio', handler: 'audio' },
  'audio/mpeg':           { label: 'Audio File',        icon: 'audio', handler: 'audio' },
  'application/vnd.ms-excel': { label: 'Excel Data',   icon: 'excel', handler: 'excel' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
                          { label: 'Excel Data',        icon: 'excel', handler: 'excel' },
};

function FileTypeIcon({ type, size = 16 }) {
  switch (type) {
    case 'csv':
    case 'excel':
      return <FileSpreadsheet size={size} color="var(--copper-400)" />;
    case 'pdf':
      return <FileText size={size} color="#f87171" />;
    case 'image':
      return <ImageIcon size={size} color="#60a5fa" />;
    case 'audio':
      return <Music size={size} color="#a78bfa" />;
    default:
      return <Paperclip size={size} color="var(--text-muted)" />;
  }
}

export default function DataUploadIntel() {
  const navigate = useNavigate();
  const [uploads,     setUploads]     = useState([]);
  const [dragging,    setDragging]    = useState(false);
  const [processing,  setProcessing]  = useState(false);
  const [label,       setLabel]       = useState('');
  const [myFiles,     setMyFiles]     = useState([]);
  const [loadingFiles,setLoadingFiles]= useState(false);
  const [generatingCanvasId, setGeneratingCanvasId] = useState(null);

  const handleOpenCanvas = async (fileObj) => {
    const fileId = fileObj.file_id || fileObj.id;
    const title = fileObj.label || fileObj.filename || 'Uploaded Document Investigation Canvas';
    const text = fileObj.ai_summary || fileObj.filename || '';

    setGeneratingCanvasId(fileId || 'active');
    try {
      const res = await autoGenerateCanvas({
        file_id: fileId,
        title: `Canvas: ${title}`,
        text: text
      });
      if (res?.status === 'success' && res.canvas_id) {
        navigate(`/connections?canvasId=${res.canvas_id}`);
      } else {
        navigate(`/connections`);
      }
    } catch (err) {
      console.error('Failed to generate canvas from uploaded file:', err);
      navigate(`/connections`);
    } finally {
      setGeneratingCanvasId(null);
    }
  };

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
    fd.append('add_to_rag', 'true');

    try {
      const res  = await fetch(`${BASE_URL}/api/v1/uploads/upload`, { method: 'POST', body: fd });
      const data = await res.json();

      setUploads(prev => [{
        filename: file.name,
        type:     FILE_TYPES[file.type]?.label || 'File',
        iconType: FILE_TYPES[file.type]?.icon  || 'file',
        size:     (file.size / 1024).toFixed(1) + ' KB',
        ai_summary: data.ai_summary || 'Processing...',
        ai_tags:    data.ai_tags    || [],
        status:     data.success ? 'success' : 'error',
        file_id:    data.file_id,
        rag_added:  data.rag_added,
      }, ...prev]);

      fetch(`${BASE_URL}/api/v1/uploads/list`).then(r => r.json())
        .then(d => setMyFiles(d.files || [])).catch(() => {});

    } catch (e) {
      setUploads(prev => [{
        filename: file.name, status: 'error',
        ai_summary: 'Upload failed: ' + e.message,
      }, ...prev]);
    }
    setProcessing(false);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach(processFile);
  }, []);

  return (
    <div style={{ padding: '24px 32px', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>
          Universal Data Ingestion &amp; Intelligence Extractor
        </h1>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Upload CDR records, FIR documents, CCTV stills, audio files, or spreadsheets. Sentinal AI extracts intelligence, builds entity graphs, and updates your investigation knowledge base.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Left Column: Dropzone + Guide */}
        <div>
          {/* Custom Label Input */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Investigation Label (Optional):
            </label>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="e.g. Case 104/24 Suspect Phone CDR"
              style={{
                width: '100%', padding: '8px 12px', background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)', borderRadius: 6,
                color: 'var(--text-primary)', fontSize: 12, outline: 'none'
              }}
            />
          </div>

          {/* Dropzone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => {
              const inp = document.createElement('input');
              inp.type = 'file';
              inp.multiple = true;
              inp.onchange = (e) => {
                if (e.target.files?.length) {
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
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
            }}>
            {processing ? (
              <div style={{ color: 'var(--copper-400)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="live-dot" />
                <span>AI is analyzing your file...</span>
              </div>
            ) : (
              <>
                <FolderUp size={36} color="var(--copper-400)" style={{ marginBottom: 12 }} />
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
              { iconType: 'csv', type: 'CDR CSV',        action: 'Auto-detects telco format → indexes towers, IMEI, call records → enables movement trail on map' },
              { iconType: 'pdf', type: 'PDF / FIR',      action: 'Extracts text via Zia OCR → adds to your personal RAG knowledge base → AI can answer questions about it' },
              { iconType: 'image', type: 'Photo / CCTV',  action: 'Zia Vision analyzes faces, objects, license plates, scene → adds description to knowledge base' },
              { iconType: 'audio', type: 'Audio',           action: 'Zia STT transcribes → adds transcript to knowledge base → AI can search it' },
              { iconType: 'excel', type: 'Excel',           action: 'Parses rows/columns → detects financial patterns → adds to case data' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8,
                                    padding: '8px', borderRadius: 4,
                                    background: 'var(--bg-primary)', alignItems: 'center' }}>
                <div style={{ flexShrink: 0 }}><FileTypeIcon type={item.iconType} size={16} /></div>
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
                <FileTypeIcon type={u.iconType} size={16} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>{u.filename}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  {u.type} · {u.size}
                </span>
              </div>
              {u.ai_summary && (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)',
                              lineHeight: 1.5, marginBottom: u.ai_tags?.length ? 6 : 0, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <Brain size={13} color="var(--copper-400)" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{u.ai_summary}</span>
                </div>
              )}
              {u.rag_added && (
                <div style={{ fontSize: 10, color: 'var(--status-success)',
                              marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Check size={11} />
                  <span>Added to your AI knowledge base — ask the AI Assistant about this file</span>
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
              <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={() => handleOpenCanvas(u)}
                  disabled={generatingCanvasId === (u.file_id || 'active')}
                  style={{
                    background: 'linear-gradient(135deg, rgba(200,129,74,0.25) 0%, rgba(200,129,74,0.12) 100%)',
                    border: '1px solid var(--copper-400)',
                    color: '#f8fafc',
                    borderRadius: 5,
                    padding: '5px 12px',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: generatingCanvasId === (u.file_id || 'active') ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Sparkles size={12} color="var(--copper-400)" />
                  <span>{generatingCanvasId === (u.file_id || 'active') ? 'Building Canvas...' : '⚡ Open in Investigation Canvas'}</span>
                </button>
              </div>
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
                <FileTypeIcon type={FILE_TYPES[f.mime_type]?.icon || 'file'} size={14} />
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => handleOpenCanvas(f)}
                    disabled={generatingCanvasId === (f.id || f.file_id)}
                    title="Extract entities & Open Investigation Canvas"
                    style={{
                      background: 'rgba(200,129,74,0.12)',
                      border: '1px solid rgba(200,129,74,0.35)',
                      color: 'var(--copper-400)',
                      borderRadius: 4,
                      padding: '3px 9px',
                      fontSize: 10,
                      fontWeight: 600,
                      cursor: generatingCanvasId === (f.id || f.file_id) ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <Sparkles size={10} />
                    <span>{generatingCanvasId === (f.id || f.file_id) ? 'Extracting...' : 'Canvas'}</span>
                  </button>
                  {f.stratus_url && (
                    <a href={f.stratus_url} target="_blank" rel="noreferrer"
                      style={{ fontSize: 10, color: 'var(--copper-400)',
                               textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span>View</span>
                      <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
