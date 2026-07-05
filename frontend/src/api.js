/**
 * Centralized API client for Project Sentinel v2.
 * All backend calls go through this module.
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const config = {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  };

  try {
    const res = await fetch(url, config);
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`[API] ${endpoint}:`, err);
    throw err;
  }
}

// ── Analytics ──
export const fetchKpis = () => request('/api/v1/analytics/kpis');
export const fetchKpiSparklines = () => request('/api/v1/analytics/kpi-sparklines');
export const fetchCrimeDistribution = () => request('/api/v1/analytics/crime-distribution');
export const fetchTopOffenders = (limit = 5) => request(`/api/v1/analytics/top-offenders?limit=${limit}`);
export const fetchDistrictComparison = (y1 = 2023, y2 = 2024) =>
  request(`/api/v1/analytics/district-comparison?year1=${y1}&year2=${y2}`);
export const fetchMonthlyTrend = () => request('/api/v1/analytics/monthly-trend');
export const fetchStatusBreakdown = () => request('/api/v1/analytics/status-breakdown');

// ── Heatmap ──
export const fetchHeatmapGrid = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/api/v1/heatmap/grid?${qs}`);
};
export const fetchHotspots = () => request('/api/v1/heatmap/hotspots');
export const fetchCasesNear = (lat, lng, radius = 2) =>
  request(`/api/v1/heatmap/cases-near?lat=${lat}&lng=${lng}&radius_km=${radius}`);
export const fetchDistrictCenters = () => request('/api/v1/heatmap/district-centers');
export const fetchHeatmapTimelapse = () => request('/api/v1/heatmap/timelapse');

// ── Network ──
export const fetchNetworkGraph = (limit = 200, syndicateId) => {
  let url = `/api/v1/network/graph?limit=${limit}`;
  if (syndicateId) url += `&syndicate_id=${syndicateId}`;
  return request(url);
};
export const fetchPersonConnections = (id) => request(`/api/v1/network/person/${id}/connections`);
export const fetchSyndicates = () => request('/api/v1/network/syndicates');

// ── Cases ──
export const fetchCases = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/api/v1/cases?${qs}`);
};
export const fetchCaseDetail = (id) => request(`/api/v1/cases/${id}`);
export const fetchRecentTimeline = () => request('/api/v1/cases/recent-timeline');
export const searchCases = (q) => request(`/api/v1/cases/search?q=${encodeURIComponent(q)}`);

// ── Persons ──
export const fetchRepeatOffenders = (limit = 20) => request(`/api/v1/persons/repeat-offenders?limit=${limit}`);
export const fetchAccusedProfile = (id) => request(`/api/v1/persons/${id}/profile`);
export const searchPersons = (q) => request(`/api/v1/persons/search?q=${encodeURIComponent(q)}`);

// ── Alerts ──
export const fetchAlerts = (limit = 10) => request(`/api/v1/alerts/recent?limit=${limit}`);

// ── Financial ──
export const fetchSuspiciousTxns = (limit = 100) => request(`/api/v1/financial/suspicious-transactions?limit=${limit}`);
export const fetchFinancialNetwork = () => request('/api/v1/financial/network');
export const fetchMuleAccounts = () => request('/api/v1/financial/mule-accounts');
export const fetchFinancialSummary = () => request('/api/v1/financial/summary');

// ── CDR ──
export const fetchCallGraph = (limit = 100) => request(`/api/v1/cdr/call-graph?limit=${limit}`);
export const fetchFrequentCallers = (limit = 20) => request(`/api/v1/cdr/frequent-callers?limit=${limit}`);
export const fetchTowerActivity = (districtId) => {
  let url = '/api/v1/cdr/tower-activity';
  if (districtId) url += `?district_id=${districtId}`;
  return request(url);
};
export const fetchPreIncidentCalls = () => request('/api/v1/cdr/pre-incident-calls');
export const fetchCdrSummary = () => request('/api/v1/cdr/summary');

// ── Intelligence ──
export const queryIntelligence = (query) =>
  request('/api/v1/intelligence/query', {
    method: 'POST',
    body: JSON.stringify({ query }),
  });
export const enhanceDiagram = (mermaidSource, caseId) =>
  request('/api/v1/intelligence/enhance-diagram', {
    method: 'POST',
    body: JSON.stringify({ mermaid_source: mermaidSource, case_id: caseId }),
  });

// ── AI Forecast ──
export const fetchForecastRisk = () => request('/api/v1/ai/forecast/top-risk');

// ── Case Actions ──
export const updateCaseStatus = (caseId, statusId) =>
  request('/api/v1/actions/update-case-status', {
    method: 'POST',
    body: JSON.stringify({ case_id: caseId, status_id: statusId })
  });

export const addInvestigationNote = (caseId, note, officerId) =>
  request('/api/v1/actions/add-investigation-note', {
    method: 'POST',
    body: JSON.stringify({ case_id: caseId, note, officer_id: officerId })
  });

export const flagAccused = (accusedId, isPriority) =>
  request('/api/v1/actions/flag-accused', {
    method: 'POST',
    body: JSON.stringify({ accused_id: accusedId, is_priority: isPriority })
  });

export const linkSyndicate = (caseId, syndicateId) =>
  request('/api/v1/actions/link-syndicate', {
    method: 'POST',
    body: JSON.stringify({ case_id: caseId, syndicate_id: syndicateId })
  });

export const fetchInvestigationNotes = (caseId) =>
  request(`/api/v1/actions/investigation-notes/${caseId}`);

// ── Reports ──
export const downloadCaseReport = async (caseId, crimeNo) => {
  const url = `${BASE_URL}/api/v1/reports/case/${caseId}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to download PDF report");
    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `Sentinel_Report_${crimeNo.replace(/\//g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
  } catch (err) {
    console.error("Error downloading report:", err);
    throw err;
  }
};

export const downloadDistrictReport = async (districtName) => {
  const url = `${BASE_URL}/api/v1/reports/district/${encodeURIComponent(districtName)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to download district PDF report");
    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `District_Report_${districtName}_${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
  } catch (err) {
    console.error("Error downloading district report:", err);
    throw err;
  }
};

export const compareCases = (caseIds) =>
  request('/api/v1/cases/compare', {
    method: 'POST',
    body: JSON.stringify({ case_ids: caseIds })
  });

// ── Predictive Intelligence ──
export const fetchReoffendRisk = (accusedId) =>
  request(`/api/v1/predict/reoffend-risk/${accusedId}`);

export const fetchPredictiveHotspots = (daysAhead = 7, districtId = null) => {
  let url = `/api/v1/predict/hotspots?days_ahead=${daysAhead}`;
  if (districtId) url += `&district_id=${districtId}`;
  return request(url);
};

export const fetchTemporalPatterns = (districtId = null, crimeHeadId = null) => {
  const params = new URLSearchParams();
  if (districtId) params.append('district_id', districtId);
  if (crimeHeadId) params.append('crime_head_id', crimeHeadId);
  return request(`/api/v1/predict/temporal-patterns?${params.toString()}`);
};

export const fetchCaseResolution = (caseId) =>
  request(`/api/v1/predict/case-resolution?case_id=${caseId}`, {
    method: 'POST'
  });

export const fetchLiveRiskScore = () =>
  request('/api/v1/predict/live-risk-score');


