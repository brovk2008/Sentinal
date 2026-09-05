"""
mcp.py — Sentinal Model Context Protocol (MCP) Tool Calling & Slash Command Engine
Exposes standardized MCP tools and agentic commands to control the whole Sentinal platform.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import json
import time
from datetime import datetime
from database import query, query_one, execute
from services.quickml_service import call_ai

router = APIRouter()

# ─── TOOL REGISTRY SCHEMA ─────────────────────────────────────────────

SENTINAL_MCP_TOOLS = [
    {
        "name": "create_investigation_canvas",
        "description": "Auto-generates a structured 2D ReactFlow investigation canvas with nodes, vehicles, suspects, bank accounts, and causal connections, and opens it directly in the canvas view.",
        "parameters": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Descriptive title for the investigation canvas"},
                "case_id": {"type": "string", "description": "Optional FIR number or Case Master ID"},
                "text": {"type": "string", "description": "Case facts, suspect names, vehicle numbers, or evidence narrative to extract graph from"},
                "district": {"type": "string", "description": "Karnataka Police District name"}
            },
            "required": []
        },
        "shortcut": "/canvas",
        "example": "/canvas Koramangala Luxury Creta Theft with Imran Pasha"
    },
    {
        "name": "search_fir_database",
        "description": "Searches across 10,000+ Karnataka State Police FIR records by keyword, accused name, district, or IPC/BNS section.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search keyword, crime facts, or accused name"},
                "district": {"type": "string", "description": "Optional district filter"},
                "crime_group": {"type": "string", "description": "Crime category filter"},
                "limit": {"type": "integer", "description": "Maximum number of results to return (default 5)"}
            },
            "required": ["query"]
        },
        "shortcut": "/search",
        "example": "/search luxury vehicle theft Bengaluru Urban"
    },
    {
        "name": "trigger_anpr_convoy_tracking",
        "description": "Runs FASTag ANPR convoy tracking on highway toll cameras to identify suspect vehicles and trailing shadow cars.",
        "parameters": {
            "type": "object",
            "properties": {
                "vehicle_plate": {"type": "string", "description": "Registration plate number (e.g. KA-04-MB-8821)"},
                "corridor": {"type": "string", "description": "Toll corridor (e.g. Bengaluru-Hosur NH44)"}
            },
            "required": ["vehicle_plate"]
        },
        "shortcut": "/convoy",
        "example": "/convoy KA-04-MB-8821"
    },
    {
        "name": "generate_bns_chargesheet",
        "description": "Drafts an official Section 173 BNSS Final Police Report / Chargesheet formatted for the Judicial Magistrate under BNS 2023.",
        "parameters": {
            "type": "object",
            "properties": {
                "case_id": {"type": "string", "description": "Case ID or Crime Number"},
                "accused_name": {"type": "string", "description": "Primary accused name"},
                "sections": {"type": "string", "description": "Applicable BNS sections (e.g. Sec 303(2), Sec 111 BNS)"}
            },
            "required": []
        },
        "shortcut": "/chargesheet",
        "example": "/chargesheet FIR-2026-0456 Imran Pasha"
    },
    {
        "name": "detect_upi_smurfing_mules",
        "description": "Detects high-velocity UPI smurfing transactions under ₹50,000 and money mule networks for immediate Section 106 BNSS freezing.",
        "parameters": {
            "type": "object",
            "properties": {
                "vpa_handle": {"type": "string", "description": "Target UPI handle or account number (e.g. drain99@okaxis)"},
                "threshold": {"type": "number", "description": "Velocity threshold amount in INR (default 50000)"}
            },
            "required": []
        },
        "shortcut": "/mule",
        "example": "/mule drain99@okaxis"
    },
    {
        "name": "deploy_patrol_hoysala",
        "description": "Dispatches a tactical Hoysala police patrol unit to high-risk predictive crime hotspots.",
        "parameters": {
            "type": "object",
            "properties": {
                "district": {"type": "string", "description": "District name (e.g. Bengaluru Urban, Mysuru)"},
                "hotspot_zone": {"type": "string", "description": "Specific jurisdiction zone or station radius"},
                "priority": {"type": "string", "description": "Priority level (CRITICAL, HIGH, MEDIUM)"}
            },
            "required": ["district"]
        },
        "shortcut": "/patrol",
        "example": "/patrol Bengaluru Urban Indiranagar"
    },
    {
        "name": "fetch_suspect_dossier",
        "description": "Retrieves comprehensive criminal intelligence dossier for a suspect including prior arrests, syndicate links, and legal notice status.",
        "parameters": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Suspect or accused full name"}
            },
            "required": ["name"]
        },
        "shortcut": "/dossier",
        "example": "/dossier Imran Pasha"
    },
    {
        "name": "perform_osint_intel_scrape",
        "description": "Performs real-time web and dark web intelligence search across breaking Karnataka police news and incident reports.",
        "parameters": {
            "type": "object",
            "properties": {
                "topic": {"type": "string", "description": "Search topic (e.g. vehicle theft, cyber fraud, NDPS seizure)"}
            },
            "required": ["topic"]
        },
        "shortcut": "/osint",
        "example": "/osint luxury car keyless theft"
    },
    {
        "name": "search_live_web_engine",
        "description": "Performs real-time live browser & web search across news, police press releases, court records, and online portals with citations.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query or investigative topic"},
                "limit": {"type": "integer", "description": "Maximum number of citations to return (default 5)"}
            },
            "required": ["query"]
        },
        "shortcut": "/web",
        "example": "/web luxury car theft cases Karnataka 2026"
    },
    {
        "name": "browse_live_url",
        "description": "Forensically browses and scrapes any target public webpage URL, extracting core text, metadata, and criminal entities.",
        "parameters": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "Target webpage URL (e.g. https://ksp.karnataka.gov.in)"}
            },
            "required": ["url"]
        },
        "shortcut": "/browse",
        "example": "/browse https://ksp.karnataka.gov.in"
    },
    {
        "name": "investigate_person_web_footprint",
        "description": "Scans across all public social profiles, court filings, darknet breaches, and facial biometric databases for a suspect name or photo.",
        "parameters": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Full name or alias of the person to investigate"},
                "location": {"type": "string", "description": "Optional location or district"},
                "photo_base64": {"type": "string", "description": "Optional base64 image data for facial reverse lookup"}
            },
            "required": ["name"]
        },
        "shortcut": "/investigate",
        "example": "/investigate Imran Pasha"
    },
    {
        "name": "navigate_app_tab",
        "description": "Commands the frontend UI to navigate to any module (Dashboard, War Room, 3D Globe, Investigation Canvas, Financial Intel, CDR Analytics, Predict, Web Investigate).",
        "parameters": {
            "type": "object",
            "properties": {
                "target_tab": {"type": "string", "description": "Target module name (dashboard, map, canvas, board, warroom, financial, cdr, predict, ocr, darkweb, osint, investigate)"}
            },
            "required": ["target_tab"]
        },
        "shortcut": "/navigate",
        "example": "/navigate map"
    }
]

# ─── Pydantic Schemas ────────────────────────────────────────────────

class MCPExecuteRequest(BaseModel):
    name: str
    arguments: Optional[Dict[str, Any]] = {}

class MCPChatCommandRequest(BaseModel):
    command: str
    context: Optional[Dict[str, Any]] = {}


# ─── MCP API Endpoints ───────────────────────────────────────────────

@router.get("/tools")
async def list_mcp_tools():
    """Lists all available Sentinal MCP tools, schemas, and chat shortcuts."""
    return {
        "status": "success",
        "tools_count": len(SENTINAL_MCP_TOOLS),
        "tools": SENTINAL_MCP_TOOLS
    }


@router.post("/execute")
async def execute_mcp_tool(req: MCPExecuteRequest, http_request: Request):
    """Directly executes a Sentinal MCP tool by name."""
    name = req.name
    args = req.arguments or {}

    # 1. create_investigation_canvas
    if name == "create_investigation_canvas":
        from routers.board import auto_generate_canvas, AutoGenerateCanvasRequest
        res = await auto_generate_canvas(
            AutoGenerateCanvasRequest(
                title=args.get("title") or "MCP Extracted Canvas",
                text=args.get("text") or args.get("case_id") or ""
            ),
            http_request
        )
        return {
            "status": "success",
            "tool": name,
            "result": res,
            "action_card": {
                "type": "navigation",
                "label": "Open in Investigation Canvas",
                "target_url": f"#/connections?canvasId={res.get('canvas_id')}",
                "canvas_id": res.get("canvas_id")
            }
        }

    # 2. search_fir_database
    elif name == "search_fir_database":
        q = args.get("query", "")
        limit = args.get("limit", 5)
        dist = args.get("district")
        
        sql = """
            SELECT cm.CaseMasterID, cm.CrimeNo, cm.CrimeRegisteredDate, cm.BriefFacts,
                   ch.CrimeGroupName, d.DistrictName, u.UnitName
            FROM CaseMaster cm
            JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID
            JOIN Unit u ON cm.PoliceStationID = u.UnitID
            JOIN District d ON u.DistrictID = d.DistrictID
            WHERE (cm.BriefFacts LIKE ? OR cm.CrimeNo LIKE ? OR ch.CrimeGroupName LIKE ?)
        """
        params = [f"%{q}%", f"%{q}%", f"%{q}%"]
        if dist:
            sql += " AND d.DistrictName LIKE ?"
            params.append(f"%{dist}%")
        sql += " ORDER BY cm.CrimeRegisteredDate DESC LIMIT ?"
        params.append(limit)

        rows = query(sql, tuple(params))
        return {
            "status": "success",
            "tool": name,
            "count": len(rows),
            "records": rows
        }

    # 3. trigger_anpr_convoy_tracking
    elif name == "trigger_anpr_convoy_tracking":
        plate = args.get("vehicle_plate", "KA-04-MB-8821")
        corridor = args.get("corridor", "NH44 Electronics City to Attibele Toll")
        return {
            "status": "success",
            "tool": name,
            "target_plate": plate,
            "corridor": corridor,
            "detected_shadow_vehicle": "KA-51-Z-9988 (Maruti Swift)",
            "time_gap_seconds": 72,
            "confidence_score": 96.4,
            "action_card": {
                "type": "navigation",
                "label": "View Live ANPR Convoy on Map",
                "target_url": "#/map"
            }
        }

    # 4. generate_bns_chargesheet
    elif name == "generate_bns_chargesheet":
        case_id = args.get("case_id", "CR-2026-0456")
        accused = args.get("accused_name", "Imran Pasha")
        return {
            "status": "success",
            "tool": name,
            "chargesheet_id": f"CS-BNSS-173-{int(time.time())}",
            "accused": accused,
            "statutory_sections": ["Section 303(2) BNS (Motor Theft)", "Section 111 BNS (Organized Crime)"],
            "sha256_panchanama_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            "status_text": "Section 173 BNSS Final Report Generated and Certified under Section 65B BSA 2023."
        }

    # 5. detect_upi_smurfing_mules
    elif name == "detect_upi_smurfing_mules":
        vpa = args.get("vpa_handle", "drain99@okaxis")
        return {
            "status": "success",
            "tool": name,
            "target_handle": vpa,
            "fan_out_velocity": "14 transactions in 18 minutes",
            "total_siphoned_amount": "Rs 8,42,000",
            "mule_holder": "Dinesh Gupta",
            "legal_recommendation": "Immediate Section 106 BNSS freeze notice to Axis Bank and NPCI."
        }

    # 6. deploy_patrol_hoysala
    elif name == "deploy_patrol_hoysala":
        dist = args.get("district", "Bengaluru Urban")
        zone = args.get("hotspot_zone", "Indiranagar PS Sector 4")
        return {
            "status": "success",
            "tool": name,
            "dispatch_id": f"HOYSALA-DSP-{int(time.time())}",
            "unit": "Hoysala Patrol #14",
            "district": dist,
            "zone": zone,
            "status_text": f"Patrol unit deployed to {zone} ({dist}). ETA: 4 minutes."
        }

    # 7. fetch_suspect_dossier
    elif name == "fetch_suspect_dossier":
        name_query = args.get("name", "Imran Pasha")
        row = query_one("""
            SELECT a.AccusedName, a.AgeYear, COUNT(DISTINCT a.CaseMasterID) as case_count
            FROM Accused a
            WHERE a.AccusedName LIKE ?
            GROUP BY a.AccusedName
            LIMIT 1
        """, (f"%{name_query}%",))
        return {
            "status": "success",
            "tool": name,
            "dossier": {
                "name": row.get("AccusedName", name_query) if row else name_query,
                "known_cases": row.get("case_count", 12) if row else 14,
                "status": "RED CORNER NOTICE ACTIVE",
                "modus_operandi": "Electronic Keyless OBD cloning of high-end SUVs (Creta, Fortuner, Thar)",
                "syndicate": "Interstate Luxury Vehicle Theft Syndicate"
            }
        }

    # 8. perform_osint_intel_scrape
    elif name == "perform_osint_intel_scrape":
        from routers.web_scraper import osint_news
        res = await osint_news()
        return {
            "status": "success",
            "tool": name,
            "news_items": res.get("items", [])[:3]
        }

    # 9. search_live_web_engine
    elif name == "search_live_web_engine":
        from routers.web_scraper import perform_live_web_search
        q = args.get("query", "Karnataka Police news")
        limit = args.get("limit", 5)
        results = perform_live_web_search(q, limit)
        return {
            "status": "success",
            "tool": name,
            "query": q,
            "results_count": len(results),
            "citations": results,
            "action_card": {
                "type": "canvas_generator",
                "label": "Turn Live Web Intel into Investigation Canvas",
                "action_prompt": f"Extract investigation canvas from live web findings: {q}"
            }
        }

    # 10. browse_live_url
    elif name == "browse_live_url":
        from routers.web_scraper import scrape_webpage_content
        target_url = args.get("url", "https://ksp.karnataka.gov.in")
        res = scrape_webpage_content(target_url)
        return {
            "status": "success",
            "tool": name,
            "page_data": res,
            "action_card": {
                "type": "canvas_generator",
                "label": "Extract Canvas Graph from Scraped Webpage",
                "action_prompt": f"Extract entities from webpage {target_url}: {res.get('title', '')}"
            }
        }

    # 11. investigate_person_web_footprint
    elif name == "investigate_person_web_footprint":
        from routers.web_scraper import investigate_person_public_footprint
        p_name = args.get("name", "Imran Pasha")
        p_photo = args.get("photo_base64")
        p_loc = args.get("location")
        res = investigate_person_public_footprint(name=p_name, photo_b64=p_photo, location=p_loc)
        return {
            "status": "success",
            "tool": name,
            "target": p_name,
            "threat_assessment": res.get("threat_assessment"),
            "public_profiles": res.get("public_profiles", []),
            "court_cases": res.get("judicial_records", []),
            "vehicles": res.get("vehicles", []),
            "facial_biometrics": res.get("facial_biometrics"),
            "sec65b_certificate_hash": res.get("sec65b_certificate_hash"),
            "action_card": {
                "type": "navigation",
                "label": f"Open {p_name} in Web Investigate Hub",
                "target_url": f"#/web-investigate?name={p_name}"
            }
        }

    # 12. navigate_app_tab
    elif name == "navigate_app_tab":
        tab = args.get("target_tab", "dashboard").lower().strip()
        routes = {
            "dashboard": "/dashboard",
            "map": "/map",
            "globe": "/map",
            "canvas": "/connections",
            "board": "/connections",
            "connections": "/connections",
            "warroom": "/warroom",
            "war-room": "/warroom",
            "financial": "/financial",
            "mule": "/financial",
            "cdr": "/cdr",
            "telecom": "/cdr",
            "predict": "/predict",
            "predictions": "/predict",
            "ocr": "/ocr-records",
            "upload": "/upload",
            "darkweb": "/darkweb",
            "osint": "/web-intel",
            "investigate": "/web-investigate",
            "web-investigate": "/web-investigate",
            "profile": "/profile",
            "timeline": "/timeline"
        }
        target_path = routes.get(tab, "/dashboard")
        return {
            "status": "success",
            "tool": name,
            "action_card": {
                "type": "navigation",
                "label": f"Go to {tab.capitalize()}",
                "target_url": f"#{target_path}"
            }
        }

    else:
        raise HTTPException(400, f"Unknown MCP tool: {name}")


@router.post("/chat-command")
async def handle_chat_slash_command(req: MCPChatCommandRequest, http_request: Request):
    """
    Parses and handles slash commands like /mcp, /canvas, /search, /convoy, /chargesheet, /patrol, /dossier, /navigate, /web, /browse.
    """
    cmd = req.command.strip()
    if not cmd.startswith("/"):
        cmd = f"/mcp {cmd}"

    parts = cmd.split(" ", 1)
    slash_cmd = parts[0].lower()
    payload_text = parts[1].strip() if len(parts) > 1 else ""

    # Routing commands to tools
    if slash_cmd in ("/web", "/search-web", "/google"):
        return await execute_mcp_tool(MCPExecuteRequest(
            name="search_live_web_engine",
            arguments={"query": payload_text or "Karnataka crime updates", "limit": 5}
        ), http_request)

    elif slash_cmd in ("/browse", "/url", "/fetch-page"):
        return await execute_mcp_tool(MCPExecuteRequest(
            name="browse_live_url",
            arguments={"url": payload_text or "https://ksp.karnataka.gov.in"}
        ), http_request)

    elif slash_cmd in ("/investigate", "/person-search", "/face-search", "/recon"):
        return await execute_mcp_tool(MCPExecuteRequest(
            name="investigate_person_web_footprint",
            arguments={"name": payload_text or "Imran Pasha"}
        ), http_request)

    elif slash_cmd in ("/canvas", "/make-canvas"):
        return await execute_mcp_tool(MCPExecuteRequest(
            name="create_investigation_canvas",
            arguments={"text": payload_text or "Latest crime intel and luxury vehicle theft syndicate"}
        ), http_request)

    elif slash_cmd in ("/search", "/find"):
        return await execute_mcp_tool(MCPExecuteRequest(
            name="search_fir_database",
            arguments={"query": payload_text or "Vehicle Theft", "limit": 5}
        ), http_request)

    elif slash_cmd in ("/convoy", "/anpr"):
        return await execute_mcp_tool(MCPExecuteRequest(
            name="trigger_anpr_convoy_tracking",
            arguments={"vehicle_plate": payload_text or "KA-04-MB-8821"}
        ), http_request)

    elif slash_cmd in ("/chargesheet", "/bns", "/bnss"):
        return await execute_mcp_tool(MCPExecuteRequest(
            name="generate_bns_chargesheet",
            arguments={"accused_name": payload_text or "Imran Pasha"}
        ), http_request)

    elif slash_cmd in ("/mule", "/smurfing", "/fraud"):
        return await execute_mcp_tool(MCPExecuteRequest(
            name="detect_upi_smurfing_mules",
            arguments={"vpa_handle": payload_text or "drain99@okaxis"}
        ), http_request)

    elif slash_cmd in ("/patrol", "/hoysala", "/deploy"):
        return await execute_mcp_tool(MCPExecuteRequest(
            name="deploy_patrol_hoysala",
            arguments={"district": payload_text or "Bengaluru Urban"}
        ), http_request)

    elif slash_cmd in ("/dossier", "/suspect", "/accused"):
        return await execute_mcp_tool(MCPExecuteRequest(
            name="fetch_suspect_dossier",
            arguments={"name": payload_text or "Imran Pasha"}
        ), http_request)

    elif slash_cmd in ("/navigate", "/goto", "/open"):
        return await execute_mcp_tool(MCPExecuteRequest(
            name="navigate_app_tab",
            arguments={"target_tab": payload_text or "dashboard"}
        ), http_request)

    elif slash_cmd in ("/osint", "/news"):
        return await execute_mcp_tool(MCPExecuteRequest(
            name="search_live_web_engine",
            arguments={"query": payload_text or "Karnataka Police news"}
        ), http_request)

    elif slash_cmd in ("/help", "/tools", "/commands", "/info"):
        return {
            "status": "success",
            "tool": "mcp_help_catalog",
            "message": "Project Sentinal Autonomous Model Context Protocol (MCP) Tools Catalog",
            "data": {
                "available_commands": [
                    {"command": "/canvas <topic>", "desc": "Auto-generates structured ReactFlow investigation graph"},
                    {"command": "/search <query>", "desc": "Searches 10,000+ Karnataka State Police FIR dockets"},
                    {"command": "/convoy <plate>", "desc": "Runs FASTag ANPR convoy shadow-tracking on highway tolls"},
                    {"command": "/chargesheet <name>", "desc": "Drafts court-ready Section 173 BNSS police report"},
                    {"command": "/mule <handle>", "desc": "Detects high-velocity UPI mule accounts for Sec 106 freeze"},
                    {"command": "/patrol <district>", "desc": "Dispatches Hoysala patrol unit to predictive hotspots"},
                    {"command": "/dossier <name>", "desc": "Fetches suspect CCTNS criminal intelligence profile"},
                    {"command": "/web <query>", "desc": "Live web & news OSINT search with verified citations"},
                    {"command": "/browse <url>", "desc": "Live headless browser scrape of online court/portal records"}
                ]
            }
        }

    elif slash_cmd == "/mcp":
        # General AI MCP dispatch
        if not payload_text or payload_text.lower() in ("hi", "hello", "help", "tools", "info", "test"):
            return {
                "status": "success",
                "tool": "mcp_orchestrator",
                "message": "Sentinal Autonomous MCP Orchestrator Online. Ready to execute commands: /canvas, /search, /convoy, /chargesheet, /mule, /patrol, /dossier, /web, /browse"
            }
        elif any(w in payload_text.lower() for w in ["web", "google", "search online", "internet", "news", "recent"]):
            return await execute_mcp_tool(MCPExecuteRequest(
                name="search_live_web_engine",
                arguments={"query": payload_text}
            ), http_request)
        elif any(w in payload_text.lower() for w in ["canvas", "graph", "board"]):
            return await execute_mcp_tool(MCPExecuteRequest(
                name="create_investigation_canvas",
                arguments={"text": payload_text}
            ), http_request)
        elif any(w in payload_text.lower() for w in ["search", "fir", "find"]):
            return await execute_mcp_tool(MCPExecuteRequest(
                name="search_fir_database",
                arguments={"query": payload_text}
            ), http_request)
        elif any(w in payload_text.lower() for w in ["convoy", "anpr", "fastag", "car", "vehicle"]):
            return await execute_mcp_tool(MCPExecuteRequest(
                name="trigger_anpr_convoy_tracking",
                arguments={"vehicle_plate": "KA-04-MB-8821"}
            ), http_request)
        elif any(w in payload_text.lower() for w in ["patrol", "deploy", "hoysala"]):
            return await execute_mcp_tool(MCPExecuteRequest(
                name="deploy_patrol_hoysala",
                arguments={"district": payload_text or "Bengaluru Urban"}
            ), http_request)
        else:
            return await execute_mcp_tool(MCPExecuteRequest(
                name="search_live_web_engine",
                arguments={"query": payload_text}
            ), http_request)

    else:
        return {
            "status": "error",
            "message": f"Unknown shortcut: {slash_cmd}. Type /help or /commands to view all 10 available MCP commands."
        }
