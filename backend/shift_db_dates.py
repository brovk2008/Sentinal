import sqlite3
import os
import re

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "sentinal.db")

def shift_date(date_str, years=2):
    if not date_str:
        return date_str
    # Matches YYYY-MM-DD or YYYY-MM-DD HH:MM:SS or DD/MM/YYYY
    # Let's do a simple regex translation for YYYY-MM-DD
    match = re.match(r"^(\d{4})-(\d{2})-(\d{2})(.*)$", date_str)
    if match:
        y, m, d, rest = match.groups()
        new_y = int(y) + years
        # Keep it capped or normal
        return f"{new_y}-{m}-{d}{rest}"
    
    # DD/MM/YYYY
    match2 = re.match(r"^(\d{2})/(\d{2})/(\d{4})(.*)$", date_str)
    if match2:
        d, m, y, rest = match2.groups()
        new_y = int(y) + years
        return f"{d}/{m}/{new_y}{rest}"
        
    return date_str

def main():
    print(f"Connecting to database: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    
    # Check if we already shifted
    test_row = conn.execute("SELECT CrimeRegisteredDate FROM CaseMaster LIMIT 1").fetchone()
    if test_row and test_row[0] and test_row[0].startswith("2026"):
        print("Database already seems shifted. Skipping.")
        conn.close()
        return

    # Shifting CaseMaster
    print("Shifting CaseMaster dates...")
    rows = conn.execute("SELECT CaseMasterID, CrimeRegisteredDate, IncidentFromDate, IncidentToDate, InfoReceivedPSDate FROM CaseMaster").fetchall()
    updated_cases = []
    for r in rows:
        updated_cases.append((
            shift_date(r["CrimeRegisteredDate"]),
            shift_date(r["IncidentFromDate"]),
            shift_date(r["IncidentToDate"]),
            shift_date(r["InfoReceivedPSDate"]),
            r["CaseMasterID"]
        ))
    conn.executemany("""
        UPDATE CaseMaster
        SET CrimeRegisteredDate = ?, IncidentFromDate = ?, IncidentToDate = ?, InfoReceivedPSDate = ?
        WHERE CaseMasterID = ?
    """, updated_cases)
    
    # Shifting ArrestSurrender
    print("Shifting ArrestSurrender dates...")
    rows = conn.execute("SELECT ArrestSurrenderID, ArrestSurrenderDate FROM ArrestSurrender").fetchall()
    updated_arrests = []
    for r in rows:
        updated_arrests.append((
            shift_date(r["ArrestSurrenderDate"]),
            r["ArrestSurrenderID"]
        ))
    conn.executemany("""
        UPDATE ArrestSurrender
        SET ArrestSurrenderDate = ?
        WHERE ArrestSurrenderID = ?
    """, updated_arrests)

    # Shifting ChargesheetDetails
    print("Shifting ChargesheetDetails dates...")
    rows = conn.execute("SELECT CSID, csdate FROM ChargesheetDetails").fetchall()
    updated_cs = []
    for r in rows:
        updated_cs.append((
            shift_date(r["csdate"]),
            r["CSID"]
        ))
    conn.executemany("""
        UPDATE ChargesheetDetails
        SET csdate = ?
        WHERE CSID = ?
    """, updated_cs)

    conn.commit()
    conn.close()
    print("Database shift completed successfully!")

if __name__ == "__main__":
    main()
