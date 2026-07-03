const STATUS_MAP = {
  'Registered':         'badge-danger',
  'Under Investigation': 'badge-warning',
  'Charge Sheeted':     'badge-info',
  'Court Trial':        'badge-success',
  'Closed':             'badge-neutral',
  // Severity
  'critical':           'badge-danger',
  'high':               'badge-danger',
  'medium':             'badge-warning',
  'low':                'badge-info',
}

export default function Badge({ text, variant }) {
  const cls = variant || STATUS_MAP[text] || 'badge-copper'
  return <span className={`badge ${cls}`}>{text}</span>
}
