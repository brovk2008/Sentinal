from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from database import query, query_one
import os
import httpx
from datetime import datetime

router = APIRouter()

try:
    from weasyprint import HTML
    WEASYPRINT_AVAILABLE = True
except Exception as e:
    print(f"[Reports Router] Weasyprint import failed (this is common if GTK is missing on Windows): {e}")
    WEASYPRINT_AVAILABLE = False

try:
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False


def generate_reportlab_pdf(case_data: dict, accused: list, victims: list, sections: list) -> bytes:
    """Generate a clean PDF report using ReportLab as a fallback."""
    import io
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    story = []
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor('#c8814a'),
        spaceAfter=12
    )
    section_title_style = ParagraphStyle(
        'SectionTitleStyle',
        parent=styles['Heading2'],
        fontSize=13,
        textColor=colors.HexColor('#c8814a'),
        spaceBefore=12,
        spaceAfter=6
    )
    body_style = ParagraphStyle(
        'BodyStyle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#1a1a1a'),
        leading=14
    )
    
    story.append(Paragraph("KARNATAKA STATE POLICE — CASE REPORT", title_style))
    story.append(Paragraph(f"PROJECT SENTINAL v2 — CONFIDENTIAL — {datetime.now().strftime('%d %b %Y')}", body_style))
    story.append(Spacer(1, 10))
    
    # Overview Table
    overview_data = [
        [Paragraph("<b>Crime No</b>", body_style), Paragraph(case_data.get('CrimeNo', 'N/A'), body_style)],
        [Paragraph("<b>Status</b>", body_style), Paragraph(case_data.get('CaseStatusName', 'N/A'), body_style)],
        [Paragraph("<b>Date Registered</b>", body_style), Paragraph(case_data.get('CrimeRegisteredDate', 'N/A'), body_style)],
        [Paragraph("<b>Police Station</b>", body_style), Paragraph(f"{case_data.get('StationName', 'N/A')}, {case_data.get('DistrictName', 'N/A')}", body_style)],
        [Paragraph("<b>Investigating Officer</b>", body_style), Paragraph(case_data.get('OfficerName', 'N/A'), body_style)],
    ]
    t = Table(overview_data, colWidths=[150, 350])
    t.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
        ('BACKGROUND', (0,0), (0,-1), colors.lightgrey),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t)
    story.append(Spacer(1, 12))
    
    story.append(Paragraph("Brief Facts", section_title_style))
    story.append(Paragraph(case_data.get('BriefFacts', 'No facts provided.'), body_style))
    story.append(Spacer(1, 12))
    
    # Accused
    story.append(Paragraph("Accused Details", section_title_style))
    if accused:
        accused_data = [["Person ID", "Accused Name", "Age", "Priority"]]
        for a in accused:
            accused_data.append([
                a.get("PersonID", "N/A"),
                a.get("AccusedName", "N/A"),
                str(a.get("AgeYear", "N/A")),
                "HIGH PRIORITY" if a.get("is_priority") else "Normal"
            ])
        t_acc = Table(accused_data, colWidths=[100, 220, 80, 100])
        t_acc.setStyle(TableStyle([
            ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f5f5f5')),
            ('PADDING', (0,0), (-1,-1), 5),
        ]))
        story.append(t_acc)
    else:
        story.append(Paragraph("No accused records registered.", body_style))
    story.append(Spacer(1, 12))
    
    # Sections
    story.append(Paragraph("Sections Invoked", section_title_style))
    sections_text = ", ".join([f"{s.get('ShortName')} {s.get('SectionID')}" for s in sections])
    story.append(Paragraph(sections_text or "No acts/sections specified.", body_style))
    
    doc.build(story)
    return buffer.getvalue()


@router.get("/case/{case_id}")
async def generate_case_report(case_id: int):
    # Fetch case detail
    case = query_one("""
        SELECT cm.CaseMasterID, cm.CrimeNo, cm.CaseNo, cm.CrimeRegisteredDate,
               cm.BriefFacts, ch.CrimeGroupName, cs.CaseStatusName,
               d.DistrictName, u.UnitName as StationName,
               e.FirstName as OfficerName, cm.CaseStatusID,
               cm.IncidentFromDate, cm.IncidentToDate, cm.latitude, cm.longitude
        FROM CaseMaster cm
        JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID
        JOIN CaseStatusMaster cs ON cm.CaseStatusID = cs.CaseStatusID
        JOIN Unit u ON cm.PoliceStationID = u.UnitID
        JOIN District d ON u.DistrictID = d.DistrictID
        JOIN Employee e ON cm.PolicePersonID = e.EmployeeID
        WHERE cm.CaseMasterID = ?
    """, (case_id,))
    
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
        
    accused = query("SELECT * FROM Accused WHERE CaseMasterID = ?", (case_id,))
    victims = query("SELECT * FROM Victim WHERE CaseMasterID = ?", (case_id,))
    sections = query("""
        SELECT asa.ActID, asa.SectionID, a.ShortName
        FROM ActSectionAssociation asa
        JOIN Act a ON asa.ActID = a.ActCode
        WHERE asa.CaseMasterID = ?
    """, (case_id,))

    # Compile sections lists
    sections_list = ", ".join([f"{s['ShortName']} {s['SectionID']}" for s in sections])
    
    # Accused rows HTML
    accused_rows = ""
    for a in accused:
        priority_label = '<span class="badge" style="background:#e05252;color:white;">PRIORITY</span>' if a.get('is_priority') else 'Normal'
        accused_rows += f"<tr><td>{a['PersonID']}</td><td>{a['AccusedName']}</td><td>{a['AgeYear']}</td><td>{a['GenderID']}</td><td>{priority_label}</td></tr>"
        
    # Victim rows HTML
    victim_rows = ""
    for v in victims:
        victim_rows += f"<tr><td>{v['VictimName']}</td><td>{v['AgeYear']}</td><td>{v['GenderID']}</td></tr>"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: 'Helvetica Neue', Arial, sans-serif; color: #222; padding: 40px; line-height: 1.5; }}
        .header {{ background: #0a0a0f; color: #c8814a; padding: 25px; border-radius: 6px; margin-bottom: 20px; }}
        .header h1 {{ margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 0.05em; }}
        .header p {{ margin: 5px 0 0 0; font-size: 11px; opacity: 0.8; }}
        .case-number {{ font-family: monospace; font-size: 22px; color: #c8814a; font-weight: bold; margin: 15px 0; }}
        .badge {{ background: #c8814a; color: white; padding: 4px 10px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase; display: inline-block; margin-right: 6px; }}
        .section {{ margin: 25px 0; border-left: 3px solid #c8814a; padding-left: 16px; }}
        .section h2 {{ font-size: 14px; text-transform: uppercase; color: #c8814a; margin-top: 0; margin-bottom: 12px; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }}
        td, th {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
        th {{ background: #f5f5f5; font-weight: bold; }}
        .watermark {{ position: fixed; bottom: 20px; right: 20px; opacity: 0.08; font-size: 48px; font-weight: bold; }}
      </style>
    </head>
    <body>
      <div class="header">
        <h1>KARNATAKA STATE POLICE — CASE BRIEF</h1>
        <p>PROJECT SENTINAL v2 — CONFIDENTIAL INTEL REPORT</p>
      </div>

      <div class="case-number">{case['CrimeNo']}</div>
      <div>
        <span class="badge" style="background:#0a0a0f; border: 1px solid #c8814a;">{case['CaseStatusName']}</span>
        <span class="badge">{case['CrimeGroupName']}</span>
      </div>

      <div class="section">
        <h2>Case Overview</h2>
        <table>
          <tr><td><b>Police Station</b></td><td>{case['StationName']}, {case['DistrictName']}</td></tr>
          <tr><td><b>Date Registered</b></td><td>{case['CrimeRegisteredDate']}</td></tr>
          <tr><td><b>Investigating Officer</b></td><td>{case['OfficerName']}</td></tr>
          <tr><td><b>Incident Period</b></td><td>{case['IncidentFromDate']} to {case['IncidentToDate']}</td></tr>
          <tr><td><b>Location Coordinates</b></td><td>Lat: {case['latitude']}, Lng: {case['longitude']}</td></tr>
        </table>
      </div>

      <div class="section">
        <h2>Brief Facts</h2>
        <p style="font-size: 12px; line-height: 1.6;">{case['BriefFacts']}</p>
      </div>

      <div class="section">
        <h2>Accused Persons</h2>
        <table>
          <thead>
            <tr><th>Person ID</th><th>Name</th><th>Age</th><th>Gender ID</th><th>Priority Status</th></tr>
          </thead>
          <tbody>
            {accused_rows or '<tr><td colspan="5">No accused registered.</td></tr>'}
          </tbody>
        </table>
      </div>

      <div class="section">
        <h2>Victims</h2>
        <table>
          <thead>
            <tr><th>Name</th><th>Age</th><th>Gender ID</th></tr>
          </thead>
          <tbody>
            {victim_rows or '<tr><td colspan="3">No victims registered.</td></tr>'}
          </tbody>
        </table>
      </div>

      <div class="section">
        <h2>Sections Invoked</h2>
        <p style="font-size: 12px; font-family: monospace; background:#f9f9f9; padding: 10px; border-radius: 4px; border: 1px solid #eee;">
          {sections_list or 'No sections specified.'}
        </p>
      </div>

      <div class="watermark">SENTINAL</div>

      <footer style="margin-top: 50px; border-top: 1px solid #eee; padding-top: 10px; font-size: 10px; color: #888; text-align: center;">
        Generated by Project Sentinal v2 · Confidential Law Enforcement Platform
      </footer>
    </body>
    </html>
    """

    # 1. Try Catalyst SmartBrowz first
    smartbrowz_url = os.getenv("ZCAT_SMARTBROWZ_URL") or os.getenv("CATALYST_SMARTBROWZ_URL")
    smartbrowz_key = os.getenv("ZCAT_SMARTBROWZ_KEY") or os.getenv("CATALYST_SMARTBROWZ_KEY")
    if smartbrowz_url and smartbrowz_key:
        try:
            async with httpx.AsyncClient() as client:
                r = await client.post(
                    smartbrowz_url,
                    headers={"Authorization": f"Bearer {smartbrowz_key}"},
                    json={"html": html_content},
                    timeout=30
                )
                if r.status_code == 200:
                    return Response(content=r.content, media_type="application/pdf")
        except Exception as e:
            print(f"[SmartBrowz Report] SmartBrowz API call failed: {e}")

    # 2. Try WeasyPrint locally
    if WEASYPRINT_AVAILABLE:
        try:
            pdf_bytes = HTML(string=html_content).write_pdf()
            return Response(content=pdf_bytes, media_type="application/pdf")
        except Exception as e:
            print(f"[Weasyprint Report] Failed compiling PDF with weasyprint: {e}")

    # 3. Try ReportLab locally
    if REPORTLAB_AVAILABLE:
        try:
            pdf_bytes = generate_reportlab_pdf(case, accused, victims, sections)
            return Response(content=pdf_bytes, media_type="application/pdf",
                            headers={"Content-Disposition": f"attachment; filename=Sentinal_Case_{case['CrimeNo'].replace('/', '-')}.pdf"})
        except Exception as e:
            print(f"[ReportLab Report] Failed compiling PDF with reportlab: {e}")

    # 4. Final fallback — generate a minimal valid PDF manually (without any library)
    #    Uses the most basic PDF structure that Acrobat can open.
    crime_no  = str(case.get('CrimeNo', 'UNKNOWN')).replace('/', '-')
    station   = str(case.get('StationName', 'N/A'))
    district  = str(case.get('DistrictName', 'N/A'))
    officer   = str(case.get('OfficerName', 'N/A'))
    facts     = str(case.get('BriefFacts', 'No facts available.'))[:400]
    from datetime import datetime
    report_date = datetime.now().strftime('%d %b %Y')

    # Minimal but valid PDF blob
    pdf_content = f"""%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 500>>
stream
BT /F1 18 Tf 50 740 Td (SENTINAL v2 - CASE REPORT) Tj
0 -30 Td /F1 12 Tf (Crime No: {crime_no}) Tj
0 -20 Td (Date: {report_date}) Tj
0 -20 Td (Station: {station}, {district}) Tj
0 -20 Td (Officer: {officer}) Tj
0 -30 Td /F1 10 Tf (Brief Facts:) Tj
0 -15 Td ({facts[:100]}) Tj
0 -15 Td ({facts[100:200] if len(facts)>100 else ''}) Tj
0 -15 Td ({facts[200:300] if len(facts)>200 else ''}) Tj
ET
endstream
endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 6
0000000000 65535 f
trailer<</Size 6/Root 1 0 R>>
startxref 0
%%EOF"""
    return Response(
        content=pdf_content.encode("latin-1"),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Sentinal_Report_{crime_no}.pdf"}
    )



@router.get("/district/{district_name}")
async def generate_district_report(district_name: str):
    # Fetch all cases for this district in last 12 months (or last registered cases in the database)
    cases = query("""
        SELECT cm.CaseMasterID, cm.CrimeNo, cm.CrimeRegisteredDate,
               ch.CrimeGroupName, cs.CaseStatusName, cm.BriefFacts
        FROM CaseMaster cm
        JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID
        JOIN CaseStatusMaster cs ON cm.CaseStatusID = cs.CaseStatusID
        JOIN Unit u ON cm.PoliceStationID = u.UnitID
        JOIN District d ON u.DistrictID = d.DistrictID
        WHERE d.DistrictName = ?
        ORDER BY cm.CrimeRegisteredDate DESC
        LIMIT 50
    """, (district_name,))
    
    case_rows = ""
    for c in cases:
        case_rows += f"<tr><td>{c['CrimeNo']}</td><td>{c['CrimeRegisteredDate']}</td><td>{c['CrimeGroupName']}</td><td>{c['CaseStatusName']}</td></tr>"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: Arial, sans-serif; color: #333; padding: 40px; }}
        .header {{ background: #0a0a0f; color: #c8814a; padding: 20px; text-align: center; border-radius: 6px; }}
        .header h1 {{ margin: 0; font-size: 20px; }}
        .title {{ font-size: 18px; font-weight: bold; margin: 20px 0; color: #c8814a; text-transform: uppercase; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }}
        td, th {{ border: 1px solid #ddd; padding: 6px; text-align: left; }}
        th {{ background: #f5f5f5; font-weight: bold; }}
        .watermark {{ position: fixed; bottom: 20px; right: 20px; opacity: 0.08; font-size: 48px; }}
      </style>
    </head>
    <body>
      <div class="header">
        <h1>PROJECT SENTINAL v2 — DISTRICT INTELLIGENCE AGGREGATION</h1>
        <p>KARNATAKA STATE POLICE — CONFIDENTIAL</p>
      </div>

      <div class="title">District: {district_name} (Recent Activity Overview)</div>
      <p style="font-size: 12px; color: #555;">This summary reflects the active cases registered within the jurisdiction of {district_name}.</p>

      <table>
        <thead>
          <tr><th>Crime No</th><th>Date Registered</th><th>Crime Head</th><th>Status</th></tr>
        </thead>
        <tbody>
          {case_rows or '<tr><td colspan="4">No cases registered for this district.</td></tr>'}
        </tbody>
      </table>

      <div class="watermark">SENTINAL</div>
      
      <footer style="margin-top: 40px; font-size: 9px; color: #888; text-align: center;">
        Generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} · Project Sentinal v2
      </footer>
    </body>
    </html>
    """

    # 1. Try SmartBrowz
    smartbrowz_url = os.getenv("ZCAT_SMARTBROWZ_URL") or os.getenv("CATALYST_SMARTBROWZ_URL")
    smartbrowz_key = os.getenv("ZCAT_SMARTBROWZ_KEY") or os.getenv("CATALYST_SMARTBROWZ_KEY")
    if smartbrowz_url and smartbrowz_key:
        try:
            async with httpx.AsyncClient() as client:
                r = await client.post(smartbrowz_url, headers={"Authorization": f"Bearer {smartbrowz_key}"}, json={"html": html_content}, timeout=30)
                if r.status_code == 200:
                    return Response(content=r.content, media_type="application/pdf")
        except Exception as e:
            print(f"[SmartBrowz District] API failed: {e}")

    # 2. Try WeasyPrint
    if WEASYPRINT_AVAILABLE:
        try:
            pdf_bytes = HTML(string=html_content).write_pdf()
            return Response(content=pdf_bytes, media_type="application/pdf")
        except Exception as e:
            print(f"[Weasyprint District] Failed: {e}")

    # 3. Fallback text file
    plain_text = f"CONFIDENTIAL DISTRICT REPORT: {district_name}\n"
    plain_text += f"Total recent cases analyzed: {len(cases)}\n\n"
    for c in cases[:10]:
         plain_text += f"{c['CrimeNo']} | {c['CrimeRegisteredDate']} | {c['CrimeGroupName']} | {c['CaseStatusName']}\n"
         
    return Response(
        content=plain_text.encode("utf-8"),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=District_Report_{district_name}.txt"}
    )
