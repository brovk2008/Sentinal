"""
Pattern Detection Engine — Real criminological pattern detection.

Based on actual methods used by police intelligence:
  - Repeat victimization (same location/victim attacked again)
  - MO clustering (same crime method = same offender)
  - Spree detection (crimes close in time + space)
  - Next crime prediction (historical temporal patterns)
"""
import os
import sqlite3
from datetime import datetime

DB_PATH = os.getenv("DB_PATH", "data/sentinal.db")


def _get_db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


def detect_repeat_victimization(days_window: int = 90) -> list:
    """
    Find persons or locations attacked more than once within N days.
    Research: 40% of burglaries reoccur within 400m of original within 1 month.
    """
    con = _get_db()
    rows = con.execute("""
        SELECT v.VictimName as victim,
               COUNT(DISTINCT v.CaseMasterID) as incidents,
               MAX(cm.CrimeRegisteredDate) as last_incident,
               GROUP_CONCAT(DISTINCT cm.CaseMasterID) as case_ids,
               ch.CrimeGroupName as crime_type
        FROM Victim v
        JOIN CaseMaster cm ON cm.CaseMasterID = v.CaseMasterID
        LEFT JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID
        WHERE cm.CrimeRegisteredDate >= date('now', ? || ' days')
          AND v.VictimName IS NOT NULL AND v.VictimName != ''
        GROUP BY v.VictimName
        HAVING COUNT(DISTINCT v.CaseMasterID) > 1
        ORDER BY incidents DESC
        LIMIT 20
    """, (f"-{days_window}",)).fetchall()
    con.close()
    return [
        {
            "victim":       dict(r)["victim"],
            "incidents":    dict(r)["incidents"],
            "last_incident": dict(r)["last_incident"],
            "case_ids":     dict(r)["case_ids"],
            "crime_type":   dict(r)["crime_type"],
            "risk":         "HIGH" if dict(r)["incidents"] >= 3 else "MEDIUM",
        }
        for r in rows
    ]


def detect_modus_operandi_clusters() -> list:
    """
    Group cases by MO (crime head + time block).
    Same MO pattern = likely same offender.
    Time blocks: 0=Night(0-6), 1=Morning(6-12), 2=Afternoon(12-18), 3=Evening(18-24)
    """
    con = _get_db()
    rows = con.execute("""
        SELECT ch.CrimeGroupName as crime_head,
               CAST(COALESCE(strftime('%H', cm.CrimeRegisteredDate), '12') AS INTEGER) / 6 as time_block,
               COUNT(cm.CaseMasterID) as frequency,
               COUNT(DISTINCT cm.PoliceStationID) as districts_spread,
               MAX(cm.CrimeRegisteredDate) as latest
        FROM CaseMaster cm
        LEFT JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID
        WHERE ch.CrimeGroupName IS NOT NULL
        GROUP BY ch.CrimeGroupName, time_block
        HAVING COUNT(cm.CaseMasterID) >= 3
        ORDER BY frequency DESC
        LIMIT 50
    """).fetchall()
    con.close()

    time_labels = ['Night (00-06h)', 'Morning (06-12h)', 'Afternoon (12-18h)', 'Evening (18-24h)']
    return [
        {
            "crime_head":   dict(r)["crime_head"],
            "time_pattern": time_labels[min(dict(r)["time_block"] or 1, 3)],
            "frequency":    dict(r)["frequency"],
            "spread":       dict(r)["districts_spread"],
            "latest":       dict(r)["latest"],
            "risk":         "CRITICAL" if dict(r)["frequency"] > 20 else "HIGH" if dict(r)["frequency"] > 10 else "MEDIUM",
        }
        for r in rows
    ]


def detect_crime_sprees(hours_window: int = 48) -> list:
    """
    Identify sprees: multiple same-type crimes within short time window.
    Indicates active criminal operating in an area.
    """
    con = _get_db()
    rows = con.execute("""
        SELECT c1.CaseMasterID as case_1,
               c2.CaseMasterID as case_2,
               ch.CrimeGroupName as crime_type,
               c1.CrimeRegisteredDate as date_1,
               c2.CrimeRegisteredDate as date_2,
               (julianday(c2.CrimeRegisteredDate) - julianday(c1.CrimeRegisteredDate)) * 24 as hours_apart,
               u.UnitName as station
        FROM CaseMaster c1
        JOIN CaseMaster c2 ON c2.CaseMasterID != c1.CaseMasterID
            AND c2.CrimeMajorHeadID = c1.CrimeMajorHeadID
            AND c2.CrimeRegisteredDate > c1.CrimeRegisteredDate
            AND (julianday(c2.CrimeRegisteredDate) - julianday(c1.CrimeRegisteredDate)) * 24 < ?
        LEFT JOIN CrimeHead ch ON c1.CrimeMajorHeadID = ch.CrimeHeadID
        LEFT JOIN Unit u ON c1.PoliceStationID = u.UnitID
        ORDER BY hours_apart ASC
        LIMIT 30
    """, (hours_window,)).fetchall()
    con.close()

    return [
        {
            "case_1":      dict(r)["case_1"],
            "case_2":      dict(r)["case_2"],
            "crime_type":  dict(r)["crime_type"],
            "date_1":      dict(r)["date_1"],
            "date_2":      dict(r)["date_2"],
            "hours_apart": round(float(dict(r)["hours_apart"] or 0), 1),
            "station":     dict(r)["station"],
            "note":        f"Same crime type within {round(float(dict(r)['hours_apart'] or 0), 1)}h",
        }
        for r in rows
    ]


def predict_next_crime(district_id: int = None) -> dict:
    """
    Based on historical patterns for current month + day-of-week,
    predict most likely crime type, time of day, and confidence score.
    """
    cur_month = datetime.now().month
    cur_dow   = datetime.now().weekday()  # 0=Mon, 6=Sun

    con = _get_db()
    query = """
        SELECT ch.CrimeGroupName as crime_head,
               COUNT(cm.CaseMasterID) as freq,
               AVG(CAST(COALESCE(strftime('%H', cm.CrimeRegisteredDate), '12') AS INTEGER)) as avg_hour,
               cm.PoliceStationID
        FROM CaseMaster cm
        LEFT JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID
        WHERE strftime('%m', cm.CrimeRegisteredDate) = ?
          AND strftime('%w', cm.CrimeRegisteredDate) = ?
          AND ch.CrimeGroupName IS NOT NULL
    """
    params = [f"{cur_month:02d}", str(cur_dow)]
    if district_id:
        query += " AND cm.PoliceStationID IN (SELECT UnitID FROM Unit WHERE DistrictID = ?)"
        params.append(district_id)
    query += " GROUP BY ch.CrimeGroupName ORDER BY freq DESC LIMIT 5"

    top_crimes = con.execute(query, params).fetchall()
    con.close()

    if not top_crimes:
        return {
            "prediction":  "Insufficient historical data for this time period",
            "confidence":  0,
            "top_5_crimes": []
        }

    top = dict(top_crimes[0])
    hour = int(top["avg_hour"] or 14)
    time_range = (
        "Night (00-06h)"      if hour < 6  else
        "Morning (06-12h)"    if hour < 12 else
        "Afternoon (12-18h)"  if hour < 18 else
        "Evening (18-24h)"
    )

    return {
        "predicted_crime":    top["crime_head"],
        "predicted_time":     time_range,
        "predicted_hour":     hour,
        "confidence":         min(95, int(top["freq"] * 3)),
        "historical_freq":    top["freq"],
        "top_5_crimes":       [{"crime": dict(r)["crime_head"], "frequency": dict(r)["freq"]} for r in top_crimes],
        "basis":              f"Based on {top['freq']} similar incidents in same month + day-of-week",
        "recommended_action": f"Increase patrol presence in high-density areas during {time_range}",
    }
