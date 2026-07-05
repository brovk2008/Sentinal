"""
Live Crime Feed Simulator
Streams synthetic incoming FIR events via Server-Sent Events (SSE).
Events are sampled from existing sentinel.db cases to feel realistic.
"""
import asyncio
import json
import random
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from datetime import datetime
from database import query

router = APIRouter()

# In-memory store of recent events (last 50)
_recent_events = []
_event_id_counter = 0

def _sample_new_event() -> dict:
    """Sample a random case from DB and format it as a live event."""
    global _event_id_counter
    _event_id_counter += 1

    # Pick a random case
    cases = query("""
        SELECT
            cm.CaseMasterID, cm.CrimeNo, cm.Latitude, cm.Longitude,
            cm.BriefFacts, cm.CrimeRegisteredDate,
            ch.CrimeGroupName, d.DistrictName, u.UnitName,
            s.syndicate_name
        FROM CaseMaster cm
        JOIN Unit u ON cm.PoliceStationID = u.UnitID
        JOIN District d ON u.DistrictID = d.DistrictID
        LEFT JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID
        LEFT JOIN Accused a ON cm.CaseMasterID = a.CaseMasterID
        LEFT JOIN syndicate_members sm ON a.AccusedMasterID = sm.accused_master_id
        LEFT JOIN crime_syndicates s ON sm.syndicate_id = s.syndicate_id
        WHERE cm.Latitude IS NOT NULL AND cm.Longitude IS NOT NULL
        ORDER BY RANDOM()
        LIMIT 1
    """)

    if not cases:
        return None

    case = cases[0]
    is_syndicate = bool(case.get('syndicate_name'))
    severity = 'CRITICAL' if is_syndicate else random.choice(['HIGH', 'MEDIUM', 'LOW'])

    event = {
        'event_id':      _event_id_counter,
        'timestamp':     datetime.now().isoformat(),
        'case_id':       case.get('CaseMasterID') or case.get('casemasterid'),
        'crime_no':      case.get('CrimeNo') or case.get('crimeno'),
        'crime_type':    case.get('CrimeGroupName') or case.get('crimegroupname') or 'Unknown',
        'district':      case.get('DistrictName') or case.get('districtname'),
        'station':       case.get('UnitName') or case.get('unitname'),
        'lat':           case.get('Latitude') or case.get('latitude'),
        'lng':           case.get('Longitude') or case.get('longitude'),
        'brief':         (case.get('BriefFacts') or case.get('brieffacts') or '')[:120] + '...',
        'severity':      severity,
        'is_syndicate':  is_syndicate,
        'syndicate_name': case.get('syndicate_name'),
        'type':          'FIR_REGISTERED'
    }

    _recent_events.append(event)
    if len(_recent_events) > 50:
        _recent_events.pop(0)

    return event


async def _event_generator():
    """Yields SSE events every 4-8 seconds."""
    while True:
        await asyncio.sleep(random.uniform(4, 8))
        event = _sample_new_event()
        if event:
            yield f"data: {json.dumps(event)}\n\n"


@router.get("/stream")
async def stream_live_feed():
    """
    SSE endpoint. Frontend connects and receives live FIR events.
    Usage: const es = new EventSource('/api/v1/livefeed/stream')
    """
    return StreamingResponse(
        _event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive"
        }
    )


@router.get("/recent")
def get_recent_events(limit: int = 20):
    """Returns the last N events (for initial page load)."""
    return {
        'events': _recent_events[-limit:],
        'total_streamed': _event_id_counter
    }


@router.get("/stats")
def get_feed_stats():
    """Live statistics about the feed."""
    if not _recent_events:
        return {'total': 0, 'critical': 0, 'syndicate_linked': 0}
    return {
        'total':           _event_id_counter,
        'critical':        sum(1 for e in _recent_events if e['severity'] == 'CRITICAL'),
        'syndicate_linked': sum(1 for e in _recent_events if e['is_syndicate']),
        'last_event_at':   _recent_events[-1]['timestamp'] if _recent_events else None
    }
