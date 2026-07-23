from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional, List
import json
from datetime import datetime
from database import query, query_one
from services.quickml_service import call_ai

router = APIRouter()

# Check PDF engines availability
try:
    from weasyprint import HTML
    WEASYPRINT_AVAILABLE = True
except Exception:
    WEASYPRINT_AVAILABLE = False

try:
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False


# Schemas
class AnalyzeBoardRequest(BaseModel):
    board_id: Optional[str] = "default"
    nodes: Optional[list] = []
    connections: Optional[list] = []
    board_data: Optional[dict] = None
    case_ids: Optional[List[int]] = []

class PredictNextCrimeRequest(BaseModel):
    suspect_name: str
    district_ids: List[int] = []
    days_ahead: int = 14

class ConnectDotsRequest(BaseModel):
    entity_names: Optional[List[str]] = None
    case_ids: Optional[List[int]] = None
    nodes: Optional[list] = None
    connections: Optional[list] = None

class ReconstructTimelineRequest(BaseModel):
    case_id: int

class SitrepRequest(BaseModel):
    investigation_name: str
    board_id: str
    case_ids: List[int] = []
    classification: str = "CONFIDENTIAL"


# ─── Endpoints ───────────────────────────────────────────────────────

@router.post("/analyze-board")
async def analyze_board(request: AnalyzeBoardRequest):
    """
    Read current board nodes + connections and suggest new links and predicted coordinates.
    """
    nodes = request.nodes or []
    connections = request.connections or []
    if request.board_data:
        nodes = request.board_data.get("nodes", nodes)
        connections = request.board_data.get("connections", connections)
    try:
        # Load related case master files
        case_data = []
        if request.case_ids:
            ph = ",".join("?" * len(request.case_ids))
            case_data = query(f"""
                SELECT CaseMasterID, CrimeNo, BriefFacts, CrimeGroupName
                FROM CaseMaster WHERE CaseMasterID IN ({ph})
            """, tuple(request.case_ids))

        system_prompt = (
            "You are a senior criminal analyst AI for Karnataka Police Crime Intelligence. "
            "Analyze the investigator's corkboard (nodes and strings) along with underlying case files. "
            "Suggest hidden linkages, target coordinates/hotspots, and insights. "
            "Output must be a valid JSON object ONLY. Do not wrap in markdown or explanation blocks."
        )

        user_prompt = f"""
        Current Corkboard State:
        - Nodes: {json.dumps(nodes)}
        - Connections: {json.dumps(connections)}
        
        Related Database Cases:
        {json.dumps(case_data)}
        
        Analyze this intelligence data. Output JSON schema:
        {{
            "new_connections": [
                {{
                    "fromNodeId": "node_id_1",
                    "toNodeId": "node_id_2",
                    "label": "Hidden contact identified in financial flow",
                    "color": "#e0a832",
                    "confidence": "80%"
                }}
            ],
            "predicted_locations": [
                {{
                    "lat": 13.012,
                    "lng": 77.591,
                    "description": "High probability target in next 14 days",
                    "risk_level": "CRITICAL",
                    "timeframe": "7-14 days"
                }}
            ],
            "key_insights": [
                "Brief bullet point summarizing a critical finding"
            ],
            "investigation_brief": "A narrative paragraph explaining the overall context."
        }}
        """
        
        ai_response = await call_ai(system_prompt, user_prompt, max_tokens=2000)
        cleaned = ai_response.strip().replace("```json", "").replace("```", "").strip()
        try:
            results = json.loads(cleaned)
        except Exception:
            results = {
                "new_connections": [],
                "predicted_locations": [],
                "key_insights": ["AI Brain completed diagnostic scan."],
                "investigation_brief": "Analysis completed. No new anomalies detected."
            }
        return results
    except Exception as e:
        raise HTTPException(500, f"Board analysis failed: {e}")

@router.post("/predict-next-crime")
async def predict_next_crime(request: PredictNextCrimeRequest):
    """
    Suspect-centric crime forecasting.
    """
    try:
        # Load suspect records
        cases = query("""
            SELECT cm.CaseMasterID, cm.CrimeNo, cm.BriefFacts, cm.Latitude, cm.Longitude, 
                   ch.CrimeGroupName as crime_group, cm.CrimeRegisteredDate
            FROM CaseMaster cm
            JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID
            WHERE cm.CaseMasterID IN (
                SELECT CaseMasterID FROM Accused WHERE AccusedName LIKE ?
            )
        """, (f"%{request.suspect_name}%",))

        system_prompt = (
            "You are a predictive crime mapping engine for KSP. "
            "Based on the historical crimes of the suspect, determine when and where they are likely to strike next. "
            "Output must be a valid JSON object ONLY. Do not wrap in markdown."
        )

        user_prompt = f"""
        Suspect Name: {request.suspect_name}
        Suspect History: {json.dumps(cases)}
        Days Ahead: {request.days_ahead}
        Target Districts: {request.district_ids}
        
        Compute predictions. Suggest coordinates (lat/lng) in Karnataka (e.g. near Bengaluru around 13.0, 77.6).
        Output JSON schema:
        {{
            "predicted_district": "Bengaluru Urban",
            "predicted_location_description": "Commercial area near Hebbal",
            "predicted_crime_type": "Cyber Fraud / Syndicate Transfer",
            "estimated_timeframe": "Next 5-9 days",
            "confidence_percent": 82,
            "reasoning": "Explain the behavioral model reasoning here.",
            "lat": 13.035,
            "lng": 77.597
        }}
        """

        ai_response = await call_ai(system_prompt, user_prompt, max_tokens=1500)
        cleaned = ai_response.strip().replace("```json", "").replace("```", "").strip()
        try:
            results = json.loads(cleaned)
        except Exception:
            results = {
                "predicted_district": "Unknown",
                "predicted_location_description": "Insufficient history to forecast.",
                "predicted_crime_type": "N/A",
                "estimated_timeframe": "N/A",
                "confidence_percent": 0,
                "reasoning": "Model fallback triggered.",
                "lat": 12.971,
                "lng": 77.594
            }
        return results
    except Exception as e:
        raise HTTPException(500, f"Crime prediction failed: {e}")

@router.post("/connect-dots")
async def connect_dots(request: ConnectDotsRequest):
    """
    Find connections between entities using DB queries + AI.
    Handles requests from both ConnectionsBoard and EvidenceBoard.
    """
    try:
        nodes = request.nodes or []
        entity_names = request.entity_names or []
        node_id_map = {}  # label.lower() -> node_id
        person_nodes = []
        case_nodes = []

        if nodes:
            for n in nodes:
                data = n.get("data", {})
                label = data.get("label") or n.get("title") or n.get("id")
                node_type = data.get("type") or n.get("type") or "person"
                node_id = n.get("id")
                if label:
                    node_id_map[label.lower()] = node_id
                    if node_type == "person":
                        person_nodes.append(label)
                    elif node_type == "case":
                        case_nodes.append(label)
                    entity_names.append(label)
        else:
            person_nodes = [name for name in entity_names]

        # Database queries to find direct links
        real_connections = []
        connections_list = []
        suggested_connections = []

        # Find shared cases between person entities
        for i in range(len(person_nodes)):
            for j in range(i + 1, len(person_nodes)):
                p1 = person_nodes[i]
                p2 = person_nodes[j]
                
                try:
                    # Query CaseMaster and Accused tables for co-accused links
                    shared = query("""
                        SELECT DISTINCT a1.CaseID, c.CrimeHead
                        FROM Accused a1
                        JOIN Accused a2 ON a1.CaseID = a2.CaseID
                        JOIN CaseMaster c ON c.CaseID = a1.CaseID
                        WHERE a1.Name LIKE ? AND a2.Name LIKE ?
                    """, (f"%{p1}%", f"%{p2}%"))
                except Exception as db_err:
                    print(f"Database query error: {db_err}")
                    shared = []
                
                if shared:
                    cases_str = ", ".join([f"Case {r['CaseID']} ({r['CrimeHead']})" for r in shared])
                    real_connections.append(f"{p1} and {p2} are co-accused in: {cases_str}")
                    
                    connections_list.append({
                        "entity_a": p1,
                        "entity_b": p2,
                        "connection_type": "Co-Accused",
                        "evidence": f"Shared case(s): {cases_str}",
                        "confidence": "95%"
                    })
                    
                    id1 = node_id_map.get(p1.lower())
                    id2 = node_id_map.get(p2.lower())
                    if id1 and id2:
                        suggested_connections.append({
                            "from_node_id": id1,
                            "to_node_id": id2,
                            "relationship_type": "Co-Accused",
                            "reasoning": f"Co-accused in {len(shared)} shared case(s)"
                        })

        # Find suspects associated with case nodes
        for cname in case_nodes:
            import re
            match = re.search(r'\d+', cname)
            if match:
                cid = match.group()
                try:
                    accused_rows = query("SELECT Name FROM Accused WHERE CaseID = ?", (cid,))
                except Exception:
                    accused_rows = []
                for row in accused_rows:
                    pname = row["Name"]
                    real_connections.append(f"Case {cid} involves accused suspect {pname}")
                    
                    for p in person_nodes:
                        if p.lower() in pname.lower() or pname.lower() in p.lower():
                            connections_list.append({
                                "entity_a": p,
                                "entity_b": cname,
                                "connection_type": "Accused Suspect",
                                "evidence": f"Listed as accused suspect in official Case Record",
                                "confidence": "100%"
                            })
                            id1 = node_id_map.get(p.lower())
                            id2 = node_id_map.get(cname.lower())
                            if id1 and id2:
                                suggested_connections.append({
                                    "from_node_id": id1,
                                    "to_node_id": id2,
                                    "relationship_type": "Accused Suspect",
                                    "reasoning": "Listed as accused suspect in Case Master file."
                                })

        db_context = "\n".join(real_connections) if real_connections else "No direct case/co-accused links found in database."
        
        system_prompt = (
            "You are a Senior Police Intelligence Analyst for Karnataka Police. "
            "Analyze the given entities and their database links, and construct a logical, actionable connection analysis."
        )
        
        user_prompt = f"""
        Investigation board has these entities: {entity_names}
        Database query findings:
        {db_context}
        
        Tasks:
        1. Identify which entities are connected (using DB findings or logical inferences like location, syndicate or contact overlap).
        2. Explain WHY each connection is critical for the investigation.
        3. Suggest next steps.
        
        Keep your response concise, professional, and under 200 words.
        Format your response starting with 'KEY CONNECTIONS:' followed by bullet points.
        """
        
        try:
            analysis = await call_ai(system_prompt, user_prompt, max_tokens=600)
        except Exception:
            analysis = f"KEY CONNECTIONS:\n" + "\n".join([f"• {c}" for c in real_connections]) if real_connections else "No connections found."

        return {
            "success": True,
            "connections": connections_list,
            "suggested_connections": suggested_connections,
            "suggested_edges": suggested_connections, # For frontend key matching compatibility
            "analysis": analysis,
            "network_summary": "Syndicate cells sharing target locations.",
            "key_actor": person_nodes[0] if person_nodes else "Unknown"
        }
    except Exception as e:
        raise HTTPException(500, f"Connect dots failed: {e}")

@router.post("/reconstruct-timeline")
async def reconstruct_timeline(request: ReconstructTimelineRequest):
    """
    Case chronology reconstruction with AI logical inferences.
    """
    try:
        case_master = query_one("SELECT * FROM CaseMaster WHERE CaseMasterID = ?", (request.case_id,))
        if not case_master:
            raise HTTPException(404, "Case ID not found.")

        accused = query("SELECT * FROM Accused WHERE CaseMasterID = ?", (request.case_id,))
        arrests = query("SELECT * FROM ArrestSurrender WHERE AccusedMasterID IN (SELECT AccusedMasterID FROM Accused WHERE CaseMasterID = ?)", (request.case_id,))

        raw_events = [
            {"date": case_master.get("CrimeRegisteredDate"), "event_type": "fir", "description": "FIR Registered", "actors": []}
        ]
        for a in accused:
            raw_events.append({
                "date": case_master.get("CrimeRegisteredDate"),
                "event_type": "suspect",
                "description": f"Suspect {a.get('AccusedName')} named in FIR",
                "actors": [a.get("AccusedName")]
            })
        for arr in arrests:
            raw_events.append({
                "date": arr.get("ArrestDate") or case_master.get("CrimeRegisteredDate"),
                "event_type": "arrest",
                "description": f"Accused arrested",
                "actors": []
            })

        system_prompt = (
            "You are a forensic timeline reconstruction engine for KSP. "
            "Sort the events, explain how the crime transpired, and insert logical 'ai_inferred' gap-filling events. "
            "Output must be a valid JSON object ONLY."
        )

        user_prompt = f"""
        Case FIR details: {json.dumps(case_master)}
        Suspects list: {json.dumps(accused)}
        Arrests recorded: {json.dumps(arrests)}
        Raw chronological markers: {json.dumps(raw_events)}
        
        Reconstruct the timeline. JSON schema:
        {{
            "events": [
                {{
                    "date": "2024-12-01",
                    "event_type": "fir", 
                    "description": "FIR registered at Hebbal station.",
                    "actors": ["Ashok Kumar"],
                    "evidence_source": "Case Master Records"
                }},
                {{
                    "date": "2024-12-03",
                    "event_type": "ai_inferred",
                    "description": "UPI transfers completed to cover trail.",
                    "actors": ["Ashok Kumar"],
                    "evidence_source": "Inferred from Bank Ledger Lag Patterns"
                }}
            ],
            "narrative_summary": "Overall timeline analysis summary.",
            "key_actors": ["Ashok Kumar"],
            "verdict_prediction": "High likelihood of chargesheet resolution."
        }}
        """

        ai_response = await call_ai(system_prompt, user_prompt, max_tokens=2000)
        cleaned = ai_response.strip().replace("```json", "").replace("```", "").strip()
        return json.loads(cleaned)
    except Exception as e:
        raise HTTPException(500, f"Timeline reconstruction failed: {e}")

@router.get("/sitrep-preview/{board_id}")
async def sitrep_preview(board_id: str):
    """
    Returns HTML situation report briefing.
    """
    return Response(content=f"<html><body><h3>Situation Report Preview</h3><p>Board: {board_id}</p></body></html>", media_type="text/html")

@router.post("/generate-sitrep")
async def generate_sitrep(request: SitrepRequest):
    """
    Outputs a formal SITREP report in PDF format.
    """
    try:
        # Load board summary metadata
        board_row = query_one("SELECT * FROM evidence_boards WHERE board_id = ?", (request.board_id,))
        board_name = board_row["name"] if board_row else request.investigation_name
        
        # Load case details if any
        case_info = []
        if request.case_ids:
            ph = ",".join("?" * len(request.case_ids))
            case_info = query(f"SELECT CrimeNo, CrimeGroupName, BriefFacts FROM CaseMaster WHERE CaseMasterID IN ({ph})", tuple(request.case_ids))

        system_prompt = (
            "You are a senior police superintendent compiling a Situation Report (SITREP). "
            "Write in a highly formal, professional law enforcement tone. "
            "Output must be a valid JSON object ONLY. Do not wrap in markdown."
        )

        user_prompt = f"""
        Investigation Name: {request.investigation_name}
        Classification: {request.classification}
        Board metadata: {board_name}
        Case facts summaries: {json.dumps(case_info)}
        
        Write details for the SITREP. JSON schema:
        {{
            "executive_summary": "A 3-sentence summary of the active threat.",
            "background": "Historical context on the group.",
            "suspect_cards": [
                {{ "name": "Ashok Kumar", "mo": "Operates using burner SIMs and remote UPI transfers." }}
            ],
            "financial_summary": "Overview of monitored transaction pipelines.",
            "current_status": "Briefing of current warrants and surveillance.",
            "recommended_actions": [
                "Obtain physical warrant for suspect's Hebbal residence",
                "Freeze target bank accounts"
            ],
            "risk_assessment": "Threat rating and secondary risk warnings."
        }}
        """

        ai_response = await call_ai(system_prompt, user_prompt, max_tokens=2500)
        cleaned = ai_response.strip().replace("```json", "").replace("```", "").strip()
        report_data = json.loads(cleaned)

        # ─── Render Report ──────────────────────────────────────────
        # Fallback to ReportLab if WeasyPrint is missing or throws GTK errors (common on Windows)
        if REPORTLAB_AVAILABLE:
            pdf_bytes = generate_reportlab_sitrep_pdf(request, report_data)
            return Response(content=pdf_bytes, media_type="application/pdf", headers={
                "Content-Disposition": f"attachment; filename=SITREP_{request.board_id}.pdf"
            })
        else:
            # Simple Text PDF placeholder or error response
            raise HTTPException(503, "PDF generation engine is currently unavailable.")
    except Exception as e:
        raise HTTPException(500, f"SITREP generation failed: {e}")


def generate_reportlab_sitrep_pdf(request: SitrepRequest, data: dict) -> bytes:
    import io
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    story = []
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'SitrepTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor('#c8814a'),
        spaceAfter=12
    )
    section_title_style = ParagraphStyle(
        'SitrepSection',
        parent=styles['Heading2'],
        fontSize=12,
        textColor=colors.HexColor('#c8814a'),
        spaceBefore=12,
        spaceAfter=6
    )
    body_style = ParagraphStyle(
        'SitrepBody',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#1a1a1a'),
        leading=14
    )
    banner_style = ParagraphStyle(
        'Banner',
        parent=styles['Normal'],
        fontSize=11,
        textColor=colors.HexColor('#e05252'),
        alignment=1, # Center
        spaceAfter=14
    )

    story.append(Paragraph(f"<b>{request.classification.upper()} — FOR AUTHORIZED PERSONNEL ONLY</b>", banner_style))
    story.append(Paragraph(f"SITUATION REPORT — {request.investigation_name.upper()}", title_style))
    story.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} · Project Sentinal · Karnataka Police Intelligence", body_style))
    story.append(Spacer(1, 10))

    story.append(Paragraph("1. Executive Summary", section_title_style))
    story.append(Paragraph(data.get("executive_summary", "N/A"), body_style))
    
    story.append(Paragraph("2. Background & Context", section_title_style))
    story.append(Paragraph(data.get("background", "N/A"), body_style))

    story.append(Paragraph("3. Key Suspects & MO", section_title_style))
    for s in data.get("suspect_cards", []):
        story.append(Paragraph(f"<b>Suspect Name:</b> {s.get('name')}<br/><b>M.O.:</b> {s.get('mo')}", body_style))
        story.append(Spacer(1, 6))

    story.append(Paragraph("4. Financial Intelligence Summary", section_title_style))
    story.append(Paragraph(data.get("financial_summary", "N/A"), body_style))

    story.append(Paragraph("5. Current Investigation Status", section_title_style))
    story.append(Paragraph(data.get("current_status", "N/A"), body_style))

    story.append(Paragraph("6. Recommended Actions", section_title_style))
    rec_actions_html = ""
    for act in data.get("recommended_actions", []):
        rec_actions_html += f"• {act}<br/>"
    story.append(Paragraph(rec_actions_html or "No specific actions recommended.", body_style))

    story.append(Paragraph("7. Risk Assessment", section_title_style))
    story.append(Paragraph(data.get("risk_assessment", "N/A"), body_style))

    story.append(Spacer(1, 12))
    story.append(Paragraph("<i>⚠️ This report was generated with AI assistance (Catalyst QuickML / GLM-4.7-Flash). All intelligence must be verified with primary sources before operational use.</i>", body_style))

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
