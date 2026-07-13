import React from 'react';

/**
 * Icons.jsx — Custom SVG icon system for Sentinal v2
 * No emojis. Clean monochrome SVGs that match the dark theme.
 * Usage: <Icon name="dashboard" size={14} color="var(--copper-400)" />
 */

const ICONS = {
  dashboard: (
    <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 4h2v-2h-2v2zm4 0h2v-2h-2v2zm-4 4h2v-2h-2v2zm4 0h2v-2h-2v2z"/>
  ),
  warroom: (
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
  ),
  cases: (
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
  ),
  canvas: (
    <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm0 3a7 7 0 1 1 0 14A7 7 0 0 1 12 5zm-1 3v5l4 2-1 1.7L9 14V8h2z"/>
  ),
  pattern: (
    <path d="M2 12h4M18 12h4M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
  ),
  evidence: (
    <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/>
  ),
  network: (
    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
  ),
  map: (
    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0zm-9-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/>
  ),
  persons: (
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm8 4a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm4 2v-1a3 3 0 0 0-3-3"/>
  ),
  fir: (
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  ),
  financial: (
    <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  ),
  cdr: (
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.28h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9a16 16 0 0 0 6.09 6.09l1.78-1.88a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
  ),
  predict: (
    <path d="M21.21 15.89A10 10 0 1 1 8 2.83M22 12A10 10 0 0 0 12 2v10z"/>
  ),
  ai: (
    <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-1H0a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73A2 2 0 0 1 10 4a2 2 0 0 1 2-2z"/>
  ),
  darkweb: (
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  ),
  ingestion: (
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
  ),
  connect: (
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>
  ),
  save: (
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zm-7-1v-8H9v8m10 0V9l-4-4H5"/>
  ),
  search: (
    <path d="M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z"/>
  ),
  alert: (
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/>
  ),
  mic: (
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zm6 10a6 6 0 0 1-12 0H4a8 8 0 0 0 16 0h-2zM12 19v4m-4 0h8"/>
  ),
  close: (
    <path d="M18 6L6 18M6 6l12 12"/>
  ),
  live: (
    <g fill="currentColor"><circle cx="12" cy="12" r="3"/><path d="M5.64 5.64a9 9 0 0 0 0 12.72M18.36 5.64a9 9 0 0 1 0 12.72M3.22 3.22a12 12 0 0 0 0 16.97M20.78 3.22a12 12 0 0 1 0 16.97"/></g>
  ),
  satellite: (
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L1.16 16.5a5.5 5.5 0 0 0 7.78 7.78l11.9-11.9a5.5 5.5 0 0 0 0-7.77zM4.22 4.22l4.24 4.24M10.1 2.1l.9 3.4M21.9 13.9l-3.4-.9"/>
  ),
  person: (
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/>
  ),
  photo: (
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2v11zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/>
  ),
  trash: (
    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  ),
  analyze: (
    <path d="M2 2l20 20M9 9a3 3 0 0 0 5.12 2.12M21 12a9 9 0 0 1-1.2 4.52M3.31 4.51A9 9 0 0 0 12 21a9 9 0 0 0 6.36-2.64"/>
  ),
  dots: (
    <g fill="currentColor"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></g>
  ),
};

export default function Icon({ name, size = 16, color = 'currentColor',
                               strokeWidth = 1.5, className = '', style = {} }) {
  const path = ICONS[name];
  if (!path) return null;
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      className={className}
      style={{ flexShrink: 0, ...style }}
    >
      {path}
    </svg>
  );
}
