export const DEMO_STEPS = [
  {
    step: 1,
    title: "Intelligence Overview",
    narrative: "Welcome to Project Sentinal. The command center dashboard aggregates real-time crime feeds, charge sheet rates, and district metrics across Karnataka.",
    action: "navigate",
    target: "/dashboard",
    highlight: null
  },
  {
    step: 2,
    title: "District Crime Spikes",
    narrative: "The system automatically flags anomalies, highlighting a 23% spike in cyber fraud cases in the Bengaluru region.",
    action: "highlight",
    target: "/dashboard",
    highlight: ".grid"
  },
  {
    step: 3,
    title: "SmartBrowz Data Ingestion",
    narrative: "Let's review the ingested data. We use Catalyst SmartBrowz to scrape Form 1 FIR PDFs from the KSP portal.",
    action: "navigate",
    target: "/ingestion",
    highlight: null
  },
  {
    step: 4,
    title: "Serverless OCR Extraction",
    narrative: "When an FIR is fetched, our serverless OCR function parses complainant and accused rosters, extracting structured metadata instantly.",
    action: "custom_event",
    target: "/ingestion",
    event: "demo-trigger-ingestion-pdf",
    highlight: null
  },
  {
    step: 5,
    title: "Google Earth 3D Globe",
    narrative: "We project these geospatial points onto a photorealistic 3D Globe. Scroll to zoom in from space to localized street-level pins.",
    action: "custom_event",
    target: "/map",
    event: "demo-trigger-globe-zoom",
    highlight: null
  },
  {
    step: 6,
    title: "Investigation Canvas",
    narrative: "Here is our Palantir-inspired canvas. We map out Ramesh K. alongside associated phone IMEIs, locations, and bank accounts.",
    action: "custom_event",
    target: "/connections",
    event: "demo-trigger-canvas-populate",
    highlight: null
  },
  {
    step: 7,
    title: "AI Graph Linker",
    narrative: "Clicking AI Analyze fires QuickML (GLM-4.7-Flash). The model checks historical CDR links and draws suggested green edges automatically.",
    action: "custom_event",
    target: "/connections",
    event: "demo-trigger-canvas-ai",
    highlight: null
  },
  {
    step: 8,
    title: "MO Series Linking",
    narrative: "Our Pattern Intelligence engine automatically clusters criminal series operating with identical Modus Operandi.",
    action: "custom_event_payload",
    target: "/patterns",
    event: "demo-trigger-pattern-tab",
    payload: { tab: "mo" },
    highlight: null
  },
  {
    step: 9,
    title: "Near-Repeat Spatial Risk",
    narrative: "Following Near-Repeat theory, we forecast risk zones within 500m of burglaries and recommend tactical patrol actions.",
    action: "custom_event_payload",
    target: "/patterns",
    event: "demo-trigger-pattern-tab",
    payload: { tab: "nearRepeat" },
    highlight: null
  },
  {
    step: 10,
    title: "Cross-FIR Syndicate Roster",
    narrative: "The system automatically parses repeat offenders across districts to reveal organized crime syndicates and hierarchy roles.",
    action: "custom_event_payload",
    target: "/patterns",
    event: "demo-trigger-pattern-tab",
    payload: { tab: "syndicates" },
    highlight: null
  },
  {
    step: 11,
    title: "RAG AI Assistant Query",
    narrative: "Finally, investigators can query 10,000+ case records using natural language. Watch the AI auto-type and submit.",
    action: "navigate_and_type",
    target: "/assistant",
    query: "Show me the network of Ramesh K. and related cyber fraud cases in Bangalore"
  },
  {
    step: 12,
    title: "Unified Case Timeline",
    narrative: "All findings are compiled into a unified chronological case timeline, ready for official chargesheet generation.",
    action: "navigate_with_case",
    target: "/timeline",
    caseId: 1
  }
]
