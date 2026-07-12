export const DEMO_STEPS = [
  {
    step: 1,
    title: "Overview",
    narrative: "Karnataka Police has detected unusual financial activity linked to a known cyber fraud syndicate...",
    action: "navigate",
    target: "/dashboard",
    highlight: null
  },
  {
    step: 2,
    title: "Crime Spike Alert",
    narrative: "The dashboard shows Bengaluru Urban with a 23% spike in cyber fraud...",
    action: "highlight",
    target: "/dashboard",
    highlight: ".card"  // We will highlight one of the main dashboard cards
  },
  {
    step: 3,
    title: "Network Analysis",
    narrative: "Connecting the dots — Ramesh K. appears in 7 cases across 3 districts...",
    action: "navigate",
    target: "/connections",
    highlight: null
  },
  {
    step: 4,
    title: "Financial Trail",
    narrative: "₹2.4 crore moved through 3 mule accounts linked to the syndicate...",
    action: "navigate",
    target: "/financial",
    highlight: null
  },
  {
    step: 5,
    title: "Case Timeline",
    narrative: "FIR CR/2024/0456 shows the complete investigation lifecycle...",
    action: "navigate_with_case",
    target: "/timeline",
    caseId: 1
  },
  {
    step: 6,
    title: "CDR Evidence",
    narrative: "Phone records show coordinated calls 48 hours before the incident...",
    action: "navigate",
    target: "/cdr",
    highlight: null
  },
  {
    step: 7,
    title: "AI Intelligence Query",
    narrative: "The AI assistant surfaces patterns invisible to manual analysis...",
    action: "navigate_and_type",
    target: "/assistant",
    query: "What are the key connections in the Bengaluru Cyber Fraud Collective?"
  },
  {
    step: 8,
    title: "Pattern Intelligence",
    narrative: "The system detects an active crime spree — same MO across 7 FIRs in 3 districts. Likely same offender.",
    action: "navigate",
    target: "/patterns",
    highlight: null
  },
  {
    step: 9,
    title: "Upload Suspect Photo",
    narrative: "Officer uploads a CCTV frame. AI identifies physical features, auto-tags, and adds to canvas.",
    action: "navigate",
    target: "/connections",
    highlight: null
  },
  {
    step: 10,
    title: "Investigation Complete",
    narrative: "Suspect identified, financial trail documented, chargesheet ready.",
    action: "navigate",
    target: "/timeline",
    highlight: null
  }
]
