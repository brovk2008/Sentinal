import { useState, useEffect, useRef } from 'react';
import {
  startScraper,
  fetchScraperStatus,
  stopScraper,
  queryScrapedFirs,
  fetchScraperDistricts,
  getScrapedFirPdfUrl
} from '../api';

export default function DataIngestion() {
  const [year, setYear] = useState('2024');
  const [districts, setDistricts] = useState([]);
  const [selectedDistricts, setSelectedDistricts] = useState([]);
  const [status, setStatus] = useState({
    status: 'idle',
    year: null,
    total_stations: 0,
    done_stations: 0,
    firs_found: 0,
    firs_not_found: 0,
    firs_skipped: 0,
    errors: 0,
    current: '',
    log: []
  });
  
  const [searchResults, setSearchResults] = useState([]);
  const [searchParams, setSearchParams] = useState({
    year: '',
    district: '',
    station: '',
    status: ''
  });
  const [searchLoading, setSearchLoading] = useState(false);

  const consoleEndRef = useRef(null);

  // Load districts on mount
  useEffect(() => {
    fetchScraperDistricts()
      .then(res => {
        if (res && res.districts) {
          setDistricts(res.districts);
        }
      })
      .catch(err => console.error('Failed to load districts', err));

    // Refresh query list initially
    handleSearch();
  }, []);

  // Poll status when running
  useEffect(() => {
    let interval = null;
    
    const checkStatus = () => {
      fetchScraperStatus()
        .then(res => {
          if (res) {
            setStatus(res);
            if (res.status !== 'running') {
              clearInterval(interval);
              // Search again to show new records
              handleSearch();
            }
          }
        })
        .catch(err => console.error('Status check error', err));
    };

    // Initial check
    checkStatus();

    // Set interval if status is running
    interval = setInterval(checkStatus, 2000);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status.status]);

  // Auto scroll console
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [status.log]);

  const handleStartScrape = () => {
    const list = selectedDistricts.length > 0 ? selectedDistricts.map(Number) : null;
    startScraper(year, list)
      .then(res => {
        if (res.error) {
          alert(res.error);
        } else {
          // Immediately set status running to trigger polling hook
          setStatus(prev => ({ ...prev, status: 'running', year }));
        }
      })
      .catch(err => {
        console.error(err);
        alert('Failed to trigger scraper');
      });
  };

  const handleStopScrape = () => {
    stopScraper()
      .then(() => {
        alert('Stop signal dispatched to workers.');
      })
      .catch(err => console.error(err));
  };

  const handleDistrictToggle = (id) => {
    if (selectedDistricts.includes(id)) {
      setSelectedDistricts(selectedDistricts.filter(x => x !== id));
    } else {
      setSelectedDistricts([...selectedDistricts, id]);
    }
  };

  const handleSearch = () => {
    setSearchLoading(true);
    // filter out empty params
    const activeParams = {};
    Object.keys(searchParams).forEach(k => {
      if (searchParams[k]) activeParams[k] = searchParams[k];
    });

    queryScrapedFirs(activeParams)
      .then(res => {
        if (res && res.results) {
          setSearchResults(res.results);
        }
      })
      .catch(err => console.error(err))
      .finally(() => setSearchLoading(false));
  };

  const handleDownloadPdf = (key) => {
    getScrapedFirPdfUrl(key)
      .then(res => {
        if (res.url) {
          window.open(res.url, '_blank');
        } else {
          alert('Could not retrieve PDF download link.');
        }
      })
      .catch(err => {
        console.error(err);
        alert('Failed to download PDF');
      });
  };

  const pct = status.total_stations > 0 
    ? Math.round((status.done_stations / status.total_stations) * 100) 
    : 0;

  return (
    <div style={{ padding: '24px 32px', color: 'var(--text-primary)' }}>
      {/* Title */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--copper-400)', margin: 0, fontFamily: 'var(--font-mono)' }}>
          DATA INGESTION MODULE
        </h1>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
          Real-time crawler and pipeline for Karnataka Police FIR Portal powered by SmartBrowz Remote Grid
        </p>
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24 }}>
        
        {/* Left column: Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Scrape Target Panel */}
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            padding: 16
          }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 0, marginBottom: 12, letterSpacing: '0.05em' }}>
              TARGET CONFIGURATION
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Year Dropdown */}
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                  TARGET CALENDAR YEAR
                </label>
                <select 
                  value={year} 
                  onChange={(e) => setYear(e.target.value)}
                  disabled={status.status === 'running'}
                  style={{
                    width: '100%',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 4,
                    padding: '8px 10px',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    outline: 'none'
                  }}
                >
                  {Array.from({ length: 11 }, (_, i) => String(2015 + i)).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              {/* Districts Multi-Select */}
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                  DISTRICT FILTER ({selectedDistricts.length} selected - default: All)
                </label>
                <div style={{
                  maxHeight: 180,
                  overflowY: 'auto',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 4,
                  background: 'var(--bg-primary)',
                  padding: 8
                }}>
                  {districts.map(d => (
                    <label key={d.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '4px 6px',
                      fontSize: 12,
                      cursor: 'pointer',
                      borderRadius: 2
                    }}>
                      <input 
                        type="checkbox"
                        checked={selectedDistricts.includes(d.id)}
                        disabled={status.status === 'running'}
                        onChange={() => handleDistrictToggle(d.id)}
                        style={{ accentColor: 'var(--copper-500)' }}
                      />
                      <span style={{ color: selectedDistricts.includes(d.id) ? 'var(--copper-400)' : 'var(--text-primary)' }}>
                        {d.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                {status.status === 'running' ? (
                  <button 
                    onClick={handleStopScrape}
                    style={{
                      flex: 1,
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid #ef4444',
                      borderRadius: 4,
                      color: '#ef4444',
                      padding: '10px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Stop Scraper
                  </button>
                ) : (
                  <button 
                    onClick={handleStartScrape}
                    style={{
                      flex: 1,
                      background: 'var(--copper-500)',
                      border: 'none',
                      borderRadius: 4,
                      color: '#000',
                      padding: '10px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Start Crawler
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Progress and Live Logs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Live Status panel */}
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            padding: 20
          }}>
            <div style={{ display: 'flex', justifyContext: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: status.status === 'running' ? 'var(--copper-400)' : 'var(--text-muted)',
                  boxShadow: status.status === 'running' ? '0 0 10px var(--copper-500)' : 'none'
                }} />
                <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {status.status === 'running' ? `RUNNING (Year: ${status.year})` : status.status.toUpperCase()}
                </span>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Workers: 8 (SmartBrowz Grid)
              </span>
            </div>

            {/* Progress metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', padding: '12px 16px', borderRadius: 4 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>STATIONS SCAPED</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
                  {status.done_stations} <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>/ {status.total_stations}</span>
                </div>
              </div>
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', padding: '12px 16px', borderRadius: 4 }}>
                <div style={{ fontSize: 10, color: '#10b981' }}>FIRS DOWNLOADED</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#10b981', marginTop: 4 }}>
                  {status.firs_found}
                </div>
              </div>
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', padding: '12px 16px', borderRadius: 4 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>NO RECORD / MISSED</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {status.firs_not_found}
                </div>
              </div>
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', padding: '12px 16px', borderRadius: 4 }}>
                <div style={{ fontSize: 10, color: '#ef4444' }}>ERRORS</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#ef4444', marginTop: 4 }}>
                  {status.errors}
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Overall Progress</span>
                <span style={{ fontWeight: 600 }}>{pct}%</span>
              </div>
              <div style={{ height: 6, background: 'var(--bg-primary)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: 'var(--copper-500)', transition: 'width 0.4s ease' }} />
              </div>
            </div>

            {status.current && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Active Task: <span style={{ color: 'var(--text-primary)' }}>{status.current}</span>
              </div>
            )}
          </div>

          {/* Console Output Logs */}
          <div style={{
            background: '#040406',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            padding: 16,
            display: 'flex',
            flexDirection: 'column'
          }}>
            <h2 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginTop: 0, marginBottom: 10, fontFamily: 'var(--font-mono)' }}>
              CRAWLER LOG CONSOLE
            </h2>
            <div style={{
              height: 240,
              overflowY: 'auto',
              background: '#000',
              borderRadius: 4,
              padding: 12,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              lineHeight: '1.5',
              color: '#34d399',
              border: '1px solid #1f2937'
            }}>
              {status.log.length === 0 ? (
                <div style={{ color: '#6b7280', fontStyle: 'italic' }}>Console idle. Awaiting job trigger...</div>
              ) : (
                status.log.map((line, idx) => (
                  <div key={idx} style={{
                    color: line.includes('✗') || line.includes('error') ? '#f87171' : 
                           line.includes('✓') ? '#34d399' : '#9ca3af'
                  }}>
                    {line}
                  </div>
                ))
              )}
              <div ref={consoleEndRef} />
            </div>
          </div>
        </div>

      </div>

      {/* Database Explorer / Query Section */}
      <div style={{
        marginTop: 32,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        padding: 20
      }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--copper-400)', marginTop: 0, marginBottom: 16 }}>
          INGESTED DATA INDEX EXPLORER
        </h2>

        {/* Filter inputs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr) auto', gap: 12, marginBottom: 20 }}>
          <input 
            type="text" 
            placeholder="Year (e.g. 2024)"
            value={searchParams.year}
            onChange={(e) => setSearchParams({ ...searchParams, year: e.target.value })}
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 4,
              padding: '6px 10px',
              color: 'var(--text-primary)',
              fontSize: 12,
              outline: 'none'
            }}
          />
          <input 
            type="text" 
            placeholder="District (e.g. Bengaluru)"
            value={searchParams.district}
            onChange={(e) => setSearchParams({ ...searchParams, district: e.target.value })}
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 4,
              padding: '6px 10px',
              color: 'var(--text-primary)',
              fontSize: 12,
              outline: 'none'
            }}
          />
          <input 
            type="text" 
            placeholder="Station"
            value={searchParams.station}
            onChange={(e) => setSearchParams({ ...searchParams, station: e.target.value })}
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 4,
              padding: '6px 10px',
              color: 'var(--text-primary)',
              fontSize: 12,
              outline: 'none'
            }}
          />
          <select 
            value={searchParams.status}
            onChange={(e) => setSearchParams({ ...searchParams, status: e.target.value })}
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 4,
              padding: '6px 10px',
              color: 'var(--text-primary)',
              fontSize: 12,
              outline: 'none'
            }}
          >
            <option value="">Status (All)</option>
            <option value="found">Found (PDF Uploaded)</option>
            <option value="found_no_pdf">Found (No PDF)</option>
            <option value="not_found">Not Found</option>
            <option value="error">Error</option>
          </select>
          <button 
            onClick={handleSearch}
            disabled={searchLoading}
            style={{
              background: 'var(--border-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 4,
              color: 'var(--text-primary)',
              fontSize: 12,
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            {searchLoading ? 'Searching...' : 'Filter Index'}
          </button>
        </div>

        {/* Results table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '8px 12px' }}>DISTRICT</th>
                <th style={{ padding: '8px 12px' }}>POLICE STATION</th>
                <th style={{ padding: '8px 12px' }}>FIR NO</th>
                <th style={{ padding: '8px 12px' }}>YEAR</th>
                <th style={{ padding: '8px 12px' }}>STATUS</th>
                <th style={{ padding: '8px 12px' }}>INGESTED AT</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {searchResults.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No indexed records found matching the filters.
                  </td>
                </tr>
              ) : (
                searchResults.map(row => (
                  <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>{row.district}</td>
                    <td style={{ padding: '10px 12px' }}>{row.police_station}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)' }}>{row.fir_number}</td>
                    <td style={{ padding: '10px 12px' }}>{row.year}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: 3,
                        fontSize: 10,
                        fontWeight: 600,
                        background: row.status === 'found' ? 'rgba(16, 185, 129, 0.1)' : 
                                    row.status === 'found_no_pdf' ? 'rgba(245, 158, 11, 0.1)' : 
                                    row.status === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.05)',
                        color: row.status === 'found' ? '#10b981' : 
                               row.status === 'found_no_pdf' ? '#f59e0b' : 
                               row.status === 'error' ? '#ef4444' : 'var(--text-muted)'
                      }}>
                        {row.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 11 }}>{row.scraped_at}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      {row.pdf_stratus_key ? (
                        <button 
                          onClick={() => handleDownloadPdf(row.pdf_stratus_key)}
                          style={{
                            background: 'rgba(224, 168, 50, 0.1)',
                            border: '1px solid var(--copper-500)',
                            borderRadius: 3,
                            color: 'var(--copper-400)',
                            padding: '3px 8px',
                            fontSize: 10,
                            cursor: 'pointer'
                          }}
                        >
                          View PDF
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>No PDF</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
