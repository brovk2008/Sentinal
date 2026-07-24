"""
Dark Web Intelligence Panel
Generates realistic synthetic threat intelligence data
seeded from actual syndicate names and districts in the DB.
All data is SIMULATED for demo purposes.
"""
import random
import json
from datetime import datetime, timedelta
from fastapi import APIRouter, Request
from database import query
from services.quickml_service import call_ai

router = APIRouter()

# Threat actor handles — realistic but fictional
THREAT_HANDLES = [
    'shadow_k', 'anon_7734', 'phantom_r', 'ghost_451',
    'dark_bengali', 'user_x99', 'operator_south', 'h4wk_eye',
    'silent_striker', 'neon_shadow', 'kr_operative', 'void_walker'
]

# Message templates seeded with real district/syndicate names
MESSAGE_TEMPLATES = [
    "operation moving to {district}",
    "confirmed {n} new members in {district}",
    "payment received, next target in {district}",
    "scanner showing increased patrols near {station}",
    "alternative route via {road} confirmed",
    "heat is on — laying low for {days} days",
    "package arrived at {district} contact",
    "meeting postponed — new location TBD",
    "transaction completed — amount {amount}",
    "new recruit initiated in {district}"
]

def _generate_chatter(syndicates, districts, stations):
    """Generate realistic-looking chatter messages."""
    messages = []
    now = datetime.now()

    for i in range(20):
        template = random.choice(MESSAGE_TEMPLATES)
        syndicate = random.choice(syndicates) if syndicates else {'syndicate_name': 'Unknown'}
        district = random.choice(districts)['DistrictName'] if districts else 'Karnataka'
        station = random.choice(stations)['UnitName'] if stations else 'PS'

        msg = template.format(
            district=district,
            station=station[:15],
            road=f"NH-{random.randint(4,75)}",
            days=random.randint(2, 10),
            amount=f"₹{random.randint(5,50)}L",
            n=random.randint(2, 8)
        )

        messages.append({
            'time': (now - timedelta(minutes=i * random.randint(3, 15))).strftime('%H:%M'),
            'handle': random.choice(THREAT_HANDLES),
            'message': msg,
            'linked_syndicate': syndicate['syndicate_name'] if random.random() > 0.5 else None,
            'is_flagged': random.random() > 0.7
        })

    return sorted(messages, key=lambda x: x['time'], reverse=True)


@router.get("/feed")
async def get_dark_web_feed():
    """Returns the simulated dark web intelligence feed."""
    # Use real DB data to seed realistic content
    syndicates = query("SELECT syndicate_name FROM crime_syndicates ORDER BY RANDOM() LIMIT 5")
    districts = query("SELECT DistrictName FROM District ORDER BY RANDOM() LIMIT 10")
    stations = query("SELECT UnitName FROM Unit WHERE TypeID = 1 ORDER BY RANDOM() LIMIT 10")

    chatter = _generate_chatter(syndicates, districts, stations)

    # Extract keywords
    all_words = ' '.join(m['message'] for m in chatter).split()
    stop = {'is','the','in','to','a','for','at','via','—','near', 'and', 'with', 'new', 'for', 'route'}
    keywords = [w for w in all_words if len(w) > 4 and w.lower() not in stop]
    keyword_freq = {}
    for w in keywords:
        clean_w = w.strip('",.?!()')
        if len(clean_w) > 4:
            keyword_freq[clean_w.lower()] = keyword_freq.get(clean_w.lower(), 0) + 1
    top_keywords = sorted(keyword_freq.items(), key=lambda x: x[1], reverse=True)[:10]

    # Threat actors
    actor_mentions = {}
    for m in chatter:
        actor_mentions[m['handle']] = actor_mentions.get(m['handle'], 0) + 1
    actors = [
        {
            'handle': h,
            'mentions': c,
            'risk_level': 'CRITICAL' if c >= 4 else 'HIGH' if c >= 3 else 'MEDIUM',
            'linked_syndicate': next(
                (m['linked_syndicate'] for m in chatter
                 if m['handle'] == h and m['linked_syndicate']), None
            )
        }
        for h, c in sorted(actor_mentions.items(), key=lambda x: x[1], reverse=True)[:5]
    ]

    # Active channels seeded from real syndicates
    channels = [
        {
            'name': f"#{s['syndicate_name'].lower().replace(' ', '-')[:25]}",
            'last_activity': f"{random.randint(1,60)}m ago",
            'threat_level': random.choice(['CRITICAL', 'HIGH', 'MEDIUM', 'MONITORED']),
            'message_count': random.randint(12, 89)
        }
        for s in syndicates[:4]
    ]

    # Overall threat level
    threat_score = min(100, 45 + len([m for m in chatter if m['is_flagged']]) * 3)
    threat_label = (
        'CRITICAL' if threat_score >= 80 else
        'HIGH' if threat_score >= 60 else
        'MEDIUM' if threat_score >= 40 else
        'LOW'
    )

    return {
        'channels':      channels,
        'chatter':       chatter,
        'actors':        actors,
        'top_keywords':  [k for k, _ in top_keywords],
        'threat_score':  threat_score,
        'threat_label':  threat_label,
        'generated_at':  datetime.now().isoformat(),
        'disclaimer':    'SIMULATED INTELLIGENCE — For demonstration purposes only'
    }


@router.get("/assessment/{syndicate_name}")
async def get_threat_assessment(syndicate_name: str, http_request: Request):
    """AI-generated threat assessment for a specific syndicate."""
    # Get syndicate data
    syndicate = query(
        "SELECT * FROM crime_syndicates WHERE syndicate_name LIKE ?",
        (f"%{syndicate_name}%",)
    )
    if not syndicate:
        return {"error": "Syndicate not found"}

    s = syndicate[0]
    prompt = f"""You are a cyber intelligence analyst for Karnataka Police.
Write a 3-sentence threat assessment for: {s['syndicate_name']}.
They operate in: {s['operating_districts']}.
Crime speciality: {s['crime_speciality']}.
They have {s['total_members']} known members and {s['total_cases']} linked cases.
Write in formal intelligence report style.
Focus on: current threat level, likely next actions, recommended response."""

    try:
        assessment = await call_ai(
            "You are a Karnataka Police cyber intelligence analyst.",
            prompt, max_tokens=200, request=http_request
        )
    except:
        assessment = (
            f"The {s['syndicate_name']} remains an active threat in "
            f"{s['operating_districts']}. Intelligence suggests ongoing "
            f"operational capacity with {s['total_members']} active members. "
            "Continued surveillance recommended."
        )

    return {
        'syndicate':  s['syndicate_name'],
        'assessment': assessment,
        'threat_level': 'HIGH',
        'generated_at': datetime.now().isoformat()
    }
