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
