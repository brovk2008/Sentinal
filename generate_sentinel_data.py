#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════╗
║  PROJECT SENTINAL v2 — Synthetic Crime Intelligence Data Generator  ║
║  Karnataka Police Ecosystem · 2023-2024                             ║
║  50,000+ rows · 30+ tables · SQLite + CSV                           ║
╚══════════════════════════════════════════════════════════════════════╝

Author : Project Sentinal Team
Version: 2.0.0
Python : 3.9+
Deps   : faker
Usage  : python generate_sentinal_data.py
Output : ./output/sentinal.db  +  ./output/csv/*.csv
"""

import os
import csv
import json
import math
import time
import random
import sqlite3
import hashlib
from datetime import datetime, timedelta, date
from collections import defaultdict

try:
    from faker import Faker
except ImportError:
    print("ERROR: faker is required.  Run:  pip install faker")
    raise SystemExit(1)

# ═══════════════════════════════════════════════════════════════════
# GLOBAL SEED — deterministic runs
# ═══════════════════════════════════════════════════════════════════
SEED = 42
random.seed(SEED)
fake = Faker("en_IN")
Faker.seed(SEED)

START_TIME = time.time()

# ═══════════════════════════════════════════════════════════════════
# OUTPUT PATHS
# ═══════════════════════════════════════════════════════════════════
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
CSV_DIR    = os.path.join(OUTPUT_DIR, "csv")
DB_PATH    = os.path.join(OUTPUT_DIR, "sentinal.db")

os.makedirs(CSV_DIR, exist_ok=True)

# ═══════════════════════════════════════════════════════════════════
# CONSTANTS — Karnataka Geography & Police Hierarchy
# ═══════════════════════════════════════════════════════════════════

KARNATAKA_DISTRICTS = [
    ("Bengaluru Urban",    12.9716, 77.5946),
    ("Bengaluru Rural",    13.1986, 77.3506),
    ("Mysuru",             12.2958, 76.6394),
    ("Tumakuru",           13.3379, 77.1173),
    ("Belagavi",           15.8497, 74.4977),
    ("Kalaburagi",         17.3297, 76.8200),
    ("Mangaluru",          12.9141, 74.8560),
    ("Shivamogga",         13.9299, 75.5681),
    ("Davanagere",         14.4644, 75.9218),
    ("Ballari",            15.1394, 76.9214),
    ("Vijayapura",         16.8302, 75.7100),
    ("Bagalkote",          16.1691, 75.6615),
    ("Dharwad",            15.4589, 75.0078),
    ("Gadag",              15.4314, 75.6355),
    ("Haveri",             14.7951, 75.3991),
    ("Uttara Kannada",     14.6819, 74.6899),
    ("Udupi",              13.3409, 74.7421),
    ("Chikkamagaluru",     13.3161, 75.7720),
    ("Hassan",             13.0033, 76.1004),
    ("Kodagu",             12.4244, 75.7382),
    ("Mandya",             12.5222, 76.8951),
    ("Chamarajanagara",    11.9261, 76.9437),
    ("Ramanagara",         12.7159, 77.2810),
    ("Chikkaballapura",    13.4355, 77.7315),
    ("Kolar",              13.1360, 78.1292),
    ("Koppal",             15.3547, 76.1548),
    ("Raichur",            16.2076, 77.3463),
    ("Yadgir",             16.7700, 77.1383),
    ("Bidar",              17.9104, 77.5199),
    ("Chitradurga",        14.2226, 76.3980),
]

# Bengaluru localities for realistic BriefFacts
BENGALURU_AREAS = [
    "Jayanagar", "Koramangala", "Vijayanagar", "Rajajinagar",
    "Indiranagar", "Whitefield", "Electronic City", "Marathahalli",
    "BTM Layout", "HSR Layout", "Banashankari", "Basavanagudi",
    "Majestic", "K.R. Market", "Malleswaram", "Hebbal",
    "Yelahanka", "JP Nagar", "Bannerghatta Road", "Sarjapur Road",
    "Bommanahalli", "Peenya", "Yeshwanthpur", "Wilson Garden",
]

GENERAL_AREAS = [
    "Main Road", "Bus Stand Area", "Market Area", "Railway Station Area",
    "Town Center", "Industrial Area", "Temple Road", "Hospital Road",
    "College Road", "Ring Road", "Bypass Road", "Housing Colony",
    "Old Town", "New Extension", "Lake View Area", "Agricultural Land",
]

HOSPITALS = [
    "District General Hospital", "Government Hospital", "Taluk Hospital",
    "Community Health Centre", "Victoria Hospital", "Bowring Hospital",
    "K.C. General Hospital", "NIMHANS", "St. John's Hospital",
    "Manipal Hospital", "Apollo Hospital", "Columbia Asia Hospital",
]

# ── Acts & Sections ──────────────────────────────────────────────
ACTS_AND_SECTIONS = {
    "IPC": {
        "desc": "Indian Penal Code, 1860",
        "short": "IPC",
        "sections": {
            "302":  "Murder",
            "307":  "Attempt to Murder",
            "376":  "Rape",
            "420":  "Cheating",
            "379":  "Theft",
            "392":  "Robbery",
            "395":  "Dacoity",
            "498A": "Cruelty by Husband",
            "304B": "Dowry Death",
            "324":  "Voluntarily Causing Hurt",
        },
    },
    "IT_ACT": {
        "desc": "Information Technology Act, 2000",
        "short": "IT Act",
        "sections": {
            "66C": "Identity Theft",
            "66D": "Cheating by Impersonation",
            "67":  "Publishing Obscene Material",
            "43":  "Damage to Computer",
        },
    },
    "NDPS": {
        "desc": "Narcotic Drugs and Psychotropic Substances Act, 1985",
        "short": "NDPS Act",
        "sections": {
            "20": "Cannabis",
            "21": "Heroin/Opium",
            "22": "Psychotropic",
            "29": "Abetment",
        },
    },
    "POCSO": {
        "desc": "Protection of Children from Sexual Offences Act, 2012",
        "short": "POCSO",
        "sections": {
            "4":  "Penetrative Sexual Assault",
            "8":  "Sexual Assault",
            "12": "Sexual Harassment",
        },
    },
    "SC_ST": {
        "desc": "Scheduled Castes and Scheduled Tribes (Prevention of Atrocities) Act, 1989",
        "short": "SC/ST Act",
        "sections": {
            "3":  "Atrocities",
            "3A": "Grievous Hurt",
        },
    },
    "ARMS": {
        "desc": "Arms Act, 1959",
        "short": "Arms Act",
        "sections": {
            "25": "Possession",
            "27": "Use of Arms",
        },
    },
    "MVA": {
        "desc": "Motor Vehicles Act, 1988",
        "short": "Motor Vehicles Act",
        "sections": {
            "184":  "Dangerous Driving",
            "185":  "Drunk Driving",
            "304A": "Causing Death by Negligence",
        },
    },
    "CRPC": {
        "desc": "Code of Criminal Procedure, 1973",
        "short": "CrPC",
        "sections": {
            "41":  "Arrest",
            "107": "Security for Peace",
            "151": "Preventive",
        },
    },
}

# ── Crime Heads & Sub-Heads ──────────────────────────────────────
CRIME_HEADS = [
    (1,  "Murder & Culpable Homicide"),
    (2,  "Attempt to Murder"),
    (3,  "Robbery & Dacoity"),
    (4,  "Theft & Burglary"),
    (5,  "Cheating & Fraud"),
    (6,  "Cyber Crime"),
    (7,  "Narcotics"),
    (8,  "Crimes Against Women"),
    (9,  "Crimes Against Children"),
    (10, "SC/ST Atrocities"),
    (11, "Arms Act Offences"),
    (12, "Motor Vehicle Offences"),
    (13, "Preventive Actions"),
    (14, "Economic Offences"),
    (15, "Kidnapping & Abduction"),
]

CRIME_SUB_HEADS = {
    1:  [("Murder", 1), ("Culpable Homicide", 2)],
    2:  [("Attempt to Murder with Weapon", 1), ("Attempt to Murder by Poisoning", 2)],
    3:  [("Armed Robbery", 1), ("Highway Robbery", 2), ("Dacoity", 3)],
    4:  [("House Breaking", 1), ("Vehicle Theft", 2), ("Pickpocketing", 3), ("Cattle Theft", 4)],
    5:  [("Bank Fraud", 1), ("Insurance Fraud", 2), ("Land Fraud", 3), ("Impersonation", 4)],
    6:  [("Online Banking Fraud", 1), ("Phishing", 2), ("Identity Theft", 3), ("Social Media Crime", 4)],
    7:  [("Cannabis Possession", 1), ("Heroin Trafficking", 2), ("Psychotropic Substances", 3)],
    8:  [("Dowry Harassment", 1), ("Domestic Violence", 2), ("Rape", 3), ("Molestation", 4)],
    9:  [("POCSO Cases", 1), ("Child Labour", 2), ("Child Trafficking", 3)],
    10: [("Caste-based Violence", 1), ("Social Boycott", 2)],
    11: [("Illegal Possession of Firearms", 1), ("Use of Arms in Crime", 2)],
    12: [("Hit and Run", 1), ("Drunk Driving", 2), ("Dangerous Driving", 3)],
    13: [("Preventive Detention", 1), ("Security Bond", 2)],
    14: [("Money Laundering", 1), ("Hawala", 2), ("Counterfeit Currency", 3)],
    15: [("Kidnapping for Ransom", 1), ("Child Abduction", 2)],
}

# Map crime head → relevant act/section combos
CRIME_HEAD_TO_ACTS = {
    1:  [("IPC", "302")],
    2:  [("IPC", "307")],
    3:  [("IPC", "392"), ("IPC", "395")],
    4:  [("IPC", "379")],
    5:  [("IPC", "420")],
    6:  [("IT_ACT", "66C"), ("IT_ACT", "66D"), ("IT_ACT", "43")],
    7:  [("NDPS", "20"), ("NDPS", "21"), ("NDPS", "22"), ("NDPS", "29")],
    8:  [("IPC", "498A"), ("IPC", "304B"), ("IPC", "376")],
    9:  [("POCSO", "4"), ("POCSO", "8"), ("POCSO", "12")],
    10: [("SC_ST", "3"), ("SC_ST", "3A")],
    11: [("ARMS", "25"), ("ARMS", "27")],
    12: [("MVA", "184"), ("MVA", "185"), ("MVA", "304A")],
    13: [("CRPC", "107"), ("CRPC", "151")],
    14: [("IPC", "420"), ("IT_ACT", "66D")],
    15: [("IPC", "307"), ("IPC", "392")],
}

# Crime distribution weights (maps to crime_head_ids)
# Property=30%, Body=20%, Cyber=18%, Narcotics=12%, Women/Child=10%, Other=10%
CRIME_DISTRIBUTION = {
    4: 18, 5: 12,           # Property crimes = 30%
    1: 8, 2: 7, 3: 5,      # Crimes against body = 20%
    6: 18,                  # Cyber = 18%
    7: 12,                  # Narcotics = 12%
    8: 7, 9: 3,             # Women/Child = 10%
    10: 2, 11: 2, 12: 3, 13: 1, 14: 1, 15: 1,  # Other = 10%
}

# ── Case categories ──────────────────────────────────────────────
CASE_CATEGORIES = [
    (1, "FIR"),
    (2, "UDR"),
    (3, "Zero FIR"),
    (4, "PAR"),
]
CATEGORY_CODE_MAP = {1: "1", 2: "3", 3: "8", 4: "4"}

# ── Case statuses ────────────────────────────────────────────────
CASE_STATUSES = [
    (1, "Registered"),
    (2, "Under Investigation"),
    (3, "Charge Sheeted"),
    (4, "Court Trial"),
    (5, "Closed"),
]
STATUS_WEIGHTS = [25, 35, 22, 13, 5]

# ── Gravity ──────────────────────────────────────────────────────
GRAVITY_OFFENCES = [
    (1, "Heinous"),
    (2, "Non-Heinous"),
]
HEINOUS_CRIME_HEADS = {1, 2, 3, 7, 8, 9, 15}

# ── Religions ────────────────────────────────────────────────────
RELIGIONS = [
    (1, "Hindu"),
    (2, "Muslim"),
    (3, "Christian"),
    (4, "Jain"),
    (5, "Buddhist"),
    (6, "Sikh"),
    (7, "Other"),
]
RELIGION_WEIGHTS = [68, 16, 8, 4, 2, 1, 1]

# ── Occupations ──────────────────────────────────────────────────
OCCUPATIONS = [
    (1, "Farmer"),
    (2, "Daily Wage Labourer"),
    (3, "Government Employee"),
    (4, "Private Employee"),
    (5, "Business Owner"),
    (6, "Student"),
    (7, "Housewife"),
    (8, "Auto/Taxi Driver"),
    (9, "Teacher"),
    (10, "Doctor"),
    (11, "Engineer"),
    (12, "Advocate"),
    (13, "Shopkeeper"),
    (14, "Construction Worker"),
    (15, "Unemployed"),
    (16, "Retired"),
    (17, "IT Professional"),
    (18, "Police/Security"),
    (19, "Vendor/Hawker"),
    (20, "Other"),
]

# ── Castes ───────────────────────────────────────────────────────
CASTES = [
    (1, "General"),
    (2, "OBC"),
    (3, "SC"),
    (4, "ST"),
    (5, "Minority"),
]
CASTE_WEIGHTS = [30, 35, 18, 10, 7]

# ── Ranks ────────────────────────────────────────────────────────
RANKS = [
    (1,  "Director General of Police",      1),
    (2,  "Additional Director General",      2),
    (3,  "Inspector General of Police",      3),
    (4,  "Deputy Inspector General",         4),
    (5,  "Superintendent of Police",         5),
    (6,  "Additional SP",                    6),
    (7,  "Deputy SP",                        7),
    (8,  "Circle Inspector",                 8),
    (9,  "Police Inspector",                 9),
    (10, "Police Sub-Inspector",            10),
    (11, "Assistant Sub-Inspector",         11),
    (12, "Head Constable",                  12),
    (13, "Police Constable",               13),
]

# ── Designations ─────────────────────────────────────────────────
DESIGNATIONS = [
    (1,  "Station House Officer",       1),
    (2,  "Investigating Officer",       2),
    (3,  "Beat Officer",                3),
    (4,  "Traffic Inspector",           4),
    (5,  "Cyber Crime Inspector",       5),
    (6,  "Desk Officer",               6),
    (7,  "Wireless Operator",           7),
    (8,  "Dog Squad Handler",           8),
    (9,  "Forensic Officer",            9),
    (10, "Intelligence Officer",       10),
    (11, "Law and Order Inspector",    11),
    (12, "Women Help Desk Officer",    12),
]

# ── Unit Types ───────────────────────────────────────────────────
UNIT_TYPES = [
    (1, "State Headquarters",    "State",    1),
    (2, "Commissionerate",       "City",     2),
    (3, "District Headquarters", "District", 3),
    (4, "Sub-Division",         "District", 4),
    (5, "Police Station",       "District", 5),
    (6, "Outpost",              "District", 6),
    (7, "Traffic PS",           "City",     5),
    (8, "Cyber Crime PS",       "City",     5),
    (9, "Women PS",             "District", 5),
    (10, "CEN PS",              "State",    5),
]

# ── Syndicate definitions ────────────────────────────────────────
SYNDICATE_DEFS = [
    ("Bengaluru Cyber Fraud Collective",         "Cyber Fraud",          ["Bengaluru Urban", "Bengaluru Rural"]),
    ("Mysuru Land Grabbing Syndicate",           "Land Fraud",           ["Mysuru", "Mandya"]),
    ("Belagavi Drug Trafficking Network",        "Narcotics",            ["Belagavi", "Dharwad", "Haveri"]),
    ("Kalaburagi Extortion Ring",                "Extortion",            ["Kalaburagi", "Yadgir", "Bidar"]),
    ("Mangaluru Hawala Network",                 "Hawala",               ["Mangaluru", "Udupi"]),
    ("Tumakuru Vehicle Theft Gang",              "Vehicle Theft",        ["Tumakuru", "Bengaluru Rural"]),
    ("Davanagere Robbery Syndicate",             "Robbery",              ["Davanagere", "Chitradurga", "Haveri"]),
    ("Ballari Mining Fraud Network",             "Mining Fraud",         ["Ballari", "Koppal", "Raichur"]),
    ("Vijayapura Cattle Smuggling Ring",         "Cattle Smuggling",     ["Vijayapura", "Bagalkote"]),
    ("Shivamogga Forest Mafia",                  "Forest Crime",         ["Shivamogga", "Chikkamagaluru"]),
    ("Hubballi-Dharwad Counterfeit Currency Gang","Counterfeit Currency", ["Dharwad", "Gadag"]),
    ("Bengaluru North Narcotics Cell",           "Narcotics",            ["Bengaluru Urban", "Chikkaballapura"]),
    ("Chikkaballapura Sand Mining Mafia",        "Sand Mining",          ["Chikkaballapura", "Kolar"]),
    ("Raichur Human Trafficking Network",        "Human Trafficking",    ["Raichur", "Yadgir", "Kalaburagi"]),
    ("Kolar Gold Fields Robbery Gang",           "Robbery",              ["Kolar", "Chikkaballapura", "Bengaluru Rural"]),
    ("Bidar Cheating Syndicate",                 "Cheating",             ["Bidar", "Kalaburagi"]),
    ("Hassan Dowry Death Network",               "Dowry",                ["Hassan", "Kodagu"]),
    ("Mandya Sugar Factory Fraud Ring",          "Economic Fraud",       ["Mandya", "Mysuru"]),
    ("Udupi Coastal Smuggling Network",          "Smuggling",            ["Udupi", "Uttara Kannada"]),
    ("Bengaluru South Financial Fraud Cell",     "Financial Fraud",      ["Bengaluru Urban", "Ramanagara"]),
]

# Map syndicate speciality → crime_head_id
SYNDICATE_CRIME_MAP = {
    "Cyber Fraud":          6,
    "Land Fraud":           5,
    "Narcotics":            7,
    "Extortion":            3,
    "Hawala":              14,
    "Vehicle Theft":        4,
    "Robbery":              3,
    "Mining Fraud":        14,
    "Cattle Smuggling":     4,
    "Forest Crime":        11,
    "Counterfeit Currency": 14,
    "Sand Mining":         14,
    "Human Trafficking":   15,
    "Cheating":             5,
    "Dowry":                8,
    "Economic Fraud":       5,
    "Smuggling":           11,
    "Financial Fraud":      6,
}

# ── Indian Name Components ───────────────────────────────────────
MALE_FIRST = [
    "Rajesh", "Suresh", "Venkatesh", "Manjunath", "Ravi", "Prakash",
    "Arun", "Manoj", "Srinivas", "Ramesh", "Ganesh", "Naveen",
    "Kiran", "Mahesh", "Sachin", "Deepak", "Harish", "Vinay",
    "Anand", "Basavaraj", "Siddaraju", "Chandrashekar", "Shivakumar",
    "Nagesh", "Prasad", "Santosh", "Vishwanath", "Girish", "Umesh",
    "Jagadish", "Ashok", "Shivanand", "Madhu", "Sagar", "Kumaraswamy",
    "Nagaraj", "Hanumanthappa", "Lakshman", "Shankar", "Mohan",
    "Krishna", "Gopal", "Darshan", "Pavan", "Chetan", "Anil",
    "Surya", "Yogesh", "Bharath", "Nandish",
]

FEMALE_FIRST = [
    "Savitha", "Lakshmi", "Meena", "Rekha", "Sunitha", "Kavitha",
    "Asha", "Geetha", "Padma", "Shobha", "Bharathi", "Suma",
    "Roopa", "Priya", "Divya", "Deepa", "Nandini", "Pooja",
    "Anitha", "Renuka", "Pushpa", "Sharada", "Mangala", "Shilpa",
    "Vidya", "Sneha", "Swathi", "Rashmi", "Jyothi", "Latha",
    "Chandrika", "Radha", "Ambika", "Saraswathi", "Yashodha",
    "Indira", "Vasantha", "Kamala", "Parvathi", "Rajeshwari",
]

LAST_NAMES = [
    "Kumar", "Naik", "Gowda", "Reddy", "Shankar", "Hegde",
    "Devi", "Kumari", "Bai", "Rao", "Shetty", "Patil",
    "Nayak", "Swamy", "Yadav", "Gupta", "Raju", "Prasad",
    "Murthy", "Acharya", "Bhat", "Kulkarni", "Joshi", "Desai",
    "Hosamani", "Hiremath", "Kattimani", "Angadi", "Bagewadi",
    "Lamani", "Naikar", "Meti", "Ganiger", "Savanur",
    "Siddi", "Kambli", "Poojary", "Salian", "Bangera",
]


# ═══════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════

def progress(count, table):
    """Print progress indicator."""
    print(f"  ✓ Generated {count:>7,} rows → {table}")


def random_date(start_str, end_str):
    """Random date between two YYYY-MM-DD strings."""
    start = datetime.strptime(start_str, "%Y-%m-%d")
    end   = datetime.strptime(end_str,   "%Y-%m-%d")
    delta = (end - start).days
    return start + timedelta(days=random.randint(0, max(delta, 0)))


def random_datetime(start_str, end_str):
    """Random datetime between two date strings."""
    d = random_date(start_str, end_str)
    return d.replace(
        hour=random.randint(0, 23),
        minute=random.randint(0, 59),
        second=random.randint(0, 59),
    )


def gen_indian_name(gender_id):
    """Generate a realistic Karnataka name for given gender."""
    if gender_id == 1:  # Male
        first = random.choice(MALE_FIRST)
    elif gender_id == 2:  # Female
        first = random.choice(FEMALE_FIRST)
    else:  # Transgender — mix
        first = random.choice(MALE_FIRST + FEMALE_FIRST)
    last = random.choice(LAST_NAMES)
    return f"{first} {last}"


def clamp(val, lo, hi):
    return max(lo, min(hi, val))


def weighted_choice(items, weights):
    """Pick from items using weights."""
    return random.choices(items, weights=weights, k=1)[0]


# ═══════════════════════════════════════════════════════════════════
# STEP 0 — Database Setup
# ═══════════════════════════════════════════════════════════════════

def create_tables(conn):
    """Create all tables with proper schema."""
    c = conn.cursor()

    c.executescript("""
    -- Lookup / Master Tables
    CREATE TABLE IF NOT EXISTS State (
        StateID       INTEGER PRIMARY KEY,
        StateName     TEXT NOT NULL,
        NationalityID INTEGER,
        Active        INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS District (
        DistrictID   INTEGER PRIMARY KEY,
        DistrictName TEXT NOT NULL,
        StateID      INTEGER,
        Active       INTEGER DEFAULT 1,
        FOREIGN KEY (StateID) REFERENCES State(StateID)
    );

    CREATE TABLE IF NOT EXISTS UnitType (
        UnitTypeID   INTEGER PRIMARY KEY,
        UnitTypeName TEXT NOT NULL,
        CityDistState TEXT,
        Hierarchy    INTEGER,
        Active       INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS Unit (
        UnitID        INTEGER PRIMARY KEY,
        UnitName      TEXT NOT NULL,
        TypeID        INTEGER,
        ParentUnit    INTEGER,
        NationalityID INTEGER,
        StateID       INTEGER,
        DistrictID    INTEGER,
        Active        INTEGER DEFAULT 1,
        FOREIGN KEY (TypeID)     REFERENCES UnitType(UnitTypeID),
        FOREIGN KEY (ParentUnit) REFERENCES Unit(UnitID),
        FOREIGN KEY (StateID)    REFERENCES State(StateID),
        FOREIGN KEY (DistrictID) REFERENCES District(DistrictID)
    );

    CREATE TABLE IF NOT EXISTS Rank (
        RankID    INTEGER PRIMARY KEY,
        RankName  TEXT NOT NULL,
        Hierarchy INTEGER,
        Active    INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS Designation (
        DesignationID   INTEGER PRIMARY KEY,
        DesignationName TEXT NOT NULL,
        Active          INTEGER DEFAULT 1,
        SortOrder       INTEGER
    );

    CREATE TABLE IF NOT EXISTS Employee (
        EmployeeID        INTEGER PRIMARY KEY,
        DistrictID        INTEGER,
        UnitID            INTEGER,
        RankID            INTEGER,
        DesignationID     INTEGER,
        KGID              TEXT UNIQUE,
        FirstName         TEXT,
        EmployeeDOB       TEXT,
        GenderID          INTEGER,
        BloodGroupID      INTEGER,
        PhysicallyChallenged INTEGER DEFAULT 0,
        AppointmentDate   TEXT,
        FOREIGN KEY (DistrictID)    REFERENCES District(DistrictID),
        FOREIGN KEY (UnitID)        REFERENCES Unit(UnitID),
        FOREIGN KEY (RankID)        REFERENCES Rank(RankID),
        FOREIGN KEY (DesignationID) REFERENCES Designation(DesignationID)
    );

    CREATE TABLE IF NOT EXISTS CaseCategory (
        CaseCategoryID INTEGER PRIMARY KEY,
        LookupValue    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS GravityOffence (
        GravityOffenceID INTEGER PRIMARY KEY,
        LookupValue      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS CaseStatusMaster (
        CaseStatusID   INTEGER PRIMARY KEY,
        CaseStatusName TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ReligionMaster (
        ReligionID   INTEGER PRIMARY KEY,
        ReligionName TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS OccupationMaster (
        OccupationID   INTEGER PRIMARY KEY,
        OccupationName TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS CasteMaster (
        caste_master_id   INTEGER PRIMARY KEY,
        caste_master_name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS Court (
        CourtID      INTEGER PRIMARY KEY,
        CourtName    TEXT NOT NULL,
        DistrictID   INTEGER,
        StateID      INTEGER,
        Active       INTEGER DEFAULT 1,
        FOREIGN KEY (DistrictID) REFERENCES District(DistrictID),
        FOREIGN KEY (StateID)    REFERENCES State(StateID)
    );

    CREATE TABLE IF NOT EXISTS Act (
        ActCode        TEXT PRIMARY KEY,
        ActDescription TEXT,
        ShortName      TEXT,
        Active         INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS Section (
        ActCode            TEXT,
        SectionCode        TEXT,
        SectionDescription TEXT,
        Active             INTEGER DEFAULT 1,
        FOREIGN KEY (ActCode) REFERENCES Act(ActCode)
    );

    CREATE TABLE IF NOT EXISTS CrimeHead (
        CrimeHeadID    INTEGER PRIMARY KEY,
        CrimeGroupName TEXT NOT NULL,
        Active         INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS CrimeSubHead (
        CrimeSubHeadID INTEGER PRIMARY KEY,
        CrimeHeadID    INTEGER,
        CrimeHeadName  TEXT,
        SeqID          INTEGER,
        FOREIGN KEY (CrimeHeadID) REFERENCES CrimeHead(CrimeHeadID)
    );

    CREATE TABLE IF NOT EXISTS CrimeHeadActSection (
        CrimeHeadID INTEGER,
        ActCode     TEXT,
        SectionCode TEXT,
        FOREIGN KEY (CrimeHeadID) REFERENCES CrimeHead(CrimeHeadID),
        FOREIGN KEY (ActCode)     REFERENCES Act(ActCode)
    );

    -- Main Crime Tables
    CREATE TABLE IF NOT EXISTS CaseMaster (
        CaseMasterID       INTEGER PRIMARY KEY,
        CrimeNo            TEXT,
        CaseNo             TEXT,
        CrimeRegisteredDate TEXT,
        PolicePersonID     INTEGER,
        PoliceStationID    INTEGER,
        CaseCategoryID     INTEGER,
        GravityOffenceID   INTEGER,
        CrimeMajorHeadID   INTEGER,
        CrimeMinorHeadID   INTEGER,
        CaseStatusID       INTEGER,
        CourtID            INTEGER,
        IncidentFromDate   TEXT,
        IncidentToDate     TEXT,
        InfoReceivedPSDate TEXT,
        latitude           REAL,
        longitude          REAL,
        BriefFacts         TEXT,
        FOREIGN KEY (PolicePersonID)  REFERENCES Employee(EmployeeID),
        FOREIGN KEY (PoliceStationID) REFERENCES Unit(UnitID),
        FOREIGN KEY (CaseCategoryID)  REFERENCES CaseCategory(CaseCategoryID),
        FOREIGN KEY (GravityOffenceID) REFERENCES GravityOffence(GravityOffenceID),
        FOREIGN KEY (CrimeMajorHeadID) REFERENCES CrimeHead(CrimeHeadID),
        FOREIGN KEY (CrimeMinorHeadID) REFERENCES CrimeSubHead(CrimeSubHeadID),
        FOREIGN KEY (CaseStatusID)    REFERENCES CaseStatusMaster(CaseStatusID),
        FOREIGN KEY (CourtID)         REFERENCES Court(CourtID)
    );

    CREATE TABLE IF NOT EXISTS ComplainantDetails (
        ComplainantID  INTEGER PRIMARY KEY,
        CaseMasterID   INTEGER,
        ComplainantName TEXT,
        AgeYear        INTEGER,
        OccupationID   INTEGER,
        ReligionID     INTEGER,
        CasteID        INTEGER,
        GenderID       INTEGER,
        FOREIGN KEY (CaseMasterID) REFERENCES CaseMaster(CaseMasterID),
        FOREIGN KEY (OccupationID) REFERENCES OccupationMaster(OccupationID),
        FOREIGN KEY (ReligionID)   REFERENCES ReligionMaster(ReligionID),
        FOREIGN KEY (CasteID)      REFERENCES CasteMaster(caste_master_id)
    );

    CREATE TABLE IF NOT EXISTS Victim (
        VictimMasterID INTEGER PRIMARY KEY,
        CaseMasterID   INTEGER,
        VictimName     TEXT,
        AgeYear        INTEGER,
        GenderID       INTEGER,
        VictimPolice   TEXT DEFAULT '0',
        FOREIGN KEY (CaseMasterID) REFERENCES CaseMaster(CaseMasterID)
    );

    CREATE TABLE IF NOT EXISTS Accused (
        AccusedMasterID INTEGER PRIMARY KEY,
        CaseMasterID    INTEGER,
        AccusedName     TEXT,
        AgeYear         INTEGER,
        GenderID        INTEGER,
        PersonID        TEXT,
        FOREIGN KEY (CaseMasterID) REFERENCES CaseMaster(CaseMasterID)
    );

    CREATE TABLE IF NOT EXISTS ActSectionAssociation (
        CaseMasterID   INTEGER,
        ActID          TEXT,
        SectionID      TEXT,
        ActOrderID     INTEGER,
        SectionOrderID INTEGER,
        FOREIGN KEY (CaseMasterID) REFERENCES CaseMaster(CaseMasterID),
        FOREIGN KEY (ActID)        REFERENCES Act(ActCode)
    );

    CREATE TABLE IF NOT EXISTS ArrestSurrender (
        ArrestSurrenderID         INTEGER PRIMARY KEY,
        CaseMasterID              INTEGER,
        ArrestSurrenderTypeID     INTEGER,
        ArrestSurrenderDate       TEXT,
        ArrestSurrenderStateId    INTEGER,
        ArrestSurrenderDistrictId INTEGER,
        PoliceStationID           INTEGER,
        IOID                      INTEGER,
        CourtID                   INTEGER,
        AccusedMasterID           INTEGER,
        IsAccused                 INTEGER DEFAULT 1,
        IsComplainantAccused      INTEGER DEFAULT 0,
        FOREIGN KEY (CaseMasterID)              REFERENCES CaseMaster(CaseMasterID),
        FOREIGN KEY (ArrestSurrenderStateId)     REFERENCES State(StateID),
        FOREIGN KEY (ArrestSurrenderDistrictId)  REFERENCES District(DistrictID),
        FOREIGN KEY (PoliceStationID)            REFERENCES Unit(UnitID),
        FOREIGN KEY (IOID)                       REFERENCES Employee(EmployeeID),
        FOREIGN KEY (CourtID)                    REFERENCES Court(CourtID),
        FOREIGN KEY (AccusedMasterID)            REFERENCES Accused(AccusedMasterID)
    );

    CREATE TABLE IF NOT EXISTS ChargesheetDetails (
        CSID           INTEGER PRIMARY KEY,
        CaseMasterID   INTEGER,
        csdate         TEXT,
        cstype         TEXT,
        PolicePersonID INTEGER,
        FOREIGN KEY (CaseMasterID)  REFERENCES CaseMaster(CaseMasterID),
        FOREIGN KEY (PolicePersonID) REFERENCES Employee(EmployeeID)
    );

    -- Intelligence Tables
    CREATE TABLE IF NOT EXISTS financial_transactions (
        txn_id            INTEGER PRIMARY KEY,
        sender_name       TEXT,
        receiver_name     TEXT,
        amount            REAL,
        txn_date          TEXT,
        txn_type          TEXT,
        linked_case_id    INTEGER,
        linked_accused_id INTEGER,
        is_suspicious     INTEGER DEFAULT 0,
        FOREIGN KEY (linked_case_id)    REFERENCES CaseMaster(CaseMasterID),
        FOREIGN KEY (linked_accused_id) REFERENCES Accused(AccusedMasterID)
    );

    CREATE TABLE IF NOT EXISTS cdr_records (
        cdr_id             INTEGER PRIMARY KEY,
        caller_name        TEXT,
        receiver_name      TEXT,
        call_date          TEXT,
        call_duration_seconds INTEGER,
        tower_district_id  INTEGER,
        linked_accused_id  INTEGER,
        linked_case_id     INTEGER,
        FOREIGN KEY (tower_district_id) REFERENCES District(DistrictID),
        FOREIGN KEY (linked_accused_id) REFERENCES Accused(AccusedMasterID),
        FOREIGN KEY (linked_case_id)    REFERENCES CaseMaster(CaseMasterID)
    );

    CREATE TABLE IF NOT EXISTS crime_syndicates (
        syndicate_id       INTEGER PRIMARY KEY,
        syndicate_name     TEXT,
        crime_speciality   TEXT,
        leader_name        TEXT,
        operating_districts TEXT,
        active_from        TEXT,
        active_to          TEXT,
        total_cases        INTEGER DEFAULT 0,
        total_members      INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS syndicate_members (
        member_id         INTEGER PRIMARY KEY,
        syndicate_id      INTEGER,
        accused_master_id INTEGER,
        role              TEXT,
        FOREIGN KEY (syndicate_id)      REFERENCES crime_syndicates(syndicate_id),
        FOREIGN KEY (accused_master_id) REFERENCES Accused(AccusedMasterID)
    );
    """)
    conn.commit()


# ═══════════════════════════════════════════════════════════════════
# CSV WRITER HELPER
# ═══════════════════════════════════════════════════════════════════

def write_csv(filename, headers, rows):
    """Write a list of dicts or tuples to a CSV file."""
    path = os.path.join(CSV_DIR, filename)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        for row in rows:
            if isinstance(row, dict):
                writer.writerow([row.get(h, "") for h in headers])
            else:
                writer.writerow(row)


# ═══════════════════════════════════════════════════════════════════
# STEP 1 — Fixed Constants / Lookup Tables
# ═══════════════════════════════════════════════════════════════════

def generate_lookup_tables(conn):
    """Insert all lookup / master data."""
    c = conn.cursor()
    print("\n── STEP 1: Fixed Constants & Lookup Tables ──")

    # State
    c.execute("INSERT INTO State VALUES (1, 'Karnataka', 1, 1)")
    write_csv("State.csv", ["StateID", "StateName", "NationalityID", "Active"],
              [(1, "Karnataka", 1, 1)])
    progress(1, "State")

    # Districts
    district_rows = []
    for i, (name, lat, lon) in enumerate(KARNATAKA_DISTRICTS, start=1):
        c.execute("INSERT INTO District VALUES (?, ?, 1, 1)", (i, name))
        district_rows.append((i, name, 1, 1))
    write_csv("District.csv", ["DistrictID", "DistrictName", "StateID", "Active"],
              district_rows)
    progress(len(KARNATAKA_DISTRICTS), "District")

    # UnitType
    ut_rows = []
    for uid, uname, cds, hier in UNIT_TYPES:
        c.execute("INSERT INTO UnitType VALUES (?, ?, ?, ?, 1)",
                  (uid, uname, cds, hier))
        ut_rows.append((uid, uname, cds, hier, 1))
    write_csv("UnitType.csv",
              ["UnitTypeID", "UnitTypeName", "CityDistState", "Hierarchy", "Active"],
              ut_rows)
    progress(len(UNIT_TYPES), "UnitType")

    # Ranks
    rank_rows = []
    for rid, rname, hier in RANKS:
        c.execute("INSERT INTO Rank VALUES (?, ?, ?, 1)", (rid, rname, hier))
        rank_rows.append((rid, rname, hier, 1))
    write_csv("Rank.csv", ["RankID", "RankName", "Hierarchy", "Active"], rank_rows)
    progress(len(RANKS), "Rank")

    # Designations
    des_rows = []
    for did, dname, sort in DESIGNATIONS:
        c.execute("INSERT INTO Designation VALUES (?, ?, 1, ?)", (did, dname, sort))
        des_rows.append((did, dname, 1, sort))
    write_csv("Designation.csv",
              ["DesignationID", "DesignationName", "Active", "SortOrder"], des_rows)
    progress(len(DESIGNATIONS), "Designation")

    # CaseCategory
    cc_rows = []
    for ccid, ccv in CASE_CATEGORIES:
        c.execute("INSERT INTO CaseCategory VALUES (?, ?)", (ccid, ccv))
        cc_rows.append((ccid, ccv))
    write_csv("CaseCategory.csv", ["CaseCategoryID", "LookupValue"], cc_rows)
    progress(len(CASE_CATEGORIES), "CaseCategory")

    # GravityOffence
    go_rows = []
    for goid, gov in GRAVITY_OFFENCES:
        c.execute("INSERT INTO GravityOffence VALUES (?, ?)", (goid, gov))
        go_rows.append((goid, gov))
    write_csv("GravityOffence.csv", ["GravityOffenceID", "LookupValue"], go_rows)
    progress(len(GRAVITY_OFFENCES), "GravityOffence")

    # CaseStatusMaster
    cs_rows = []
    for csid, csname in CASE_STATUSES:
        c.execute("INSERT INTO CaseStatusMaster VALUES (?, ?)", (csid, csname))
        cs_rows.append((csid, csname))
    write_csv("CaseStatusMaster.csv", ["CaseStatusID", "CaseStatusName"], cs_rows)
    progress(len(CASE_STATUSES), "CaseStatusMaster")

    # ReligionMaster
    rel_rows = []
    for rid, rname in RELIGIONS:
        c.execute("INSERT INTO ReligionMaster VALUES (?, ?)", (rid, rname))
        rel_rows.append((rid, rname))
    write_csv("ReligionMaster.csv", ["ReligionID", "ReligionName"], rel_rows)
    progress(len(RELIGIONS), "ReligionMaster")

    # OccupationMaster
    occ_rows = []
    for oid, oname in OCCUPATIONS:
        c.execute("INSERT INTO OccupationMaster VALUES (?, ?)", (oid, oname))
        occ_rows.append((oid, oname))
    write_csv("OccupationMaster.csv", ["OccupationID", "OccupationName"], occ_rows)
    progress(len(OCCUPATIONS), "OccupationMaster")

    # CasteMaster
    caste_rows = []
    for cid, cname in CASTES:
        c.execute("INSERT INTO CasteMaster VALUES (?, ?)", (cid, cname))
        caste_rows.append((cid, cname))
    write_csv("CasteMaster.csv", ["caste_master_id", "caste_master_name"], caste_rows)
    progress(len(CASTES), "CasteMaster")

    # Acts
    act_rows = []
    for act_code, act_info in ACTS_AND_SECTIONS.items():
        c.execute("INSERT INTO Act VALUES (?, ?, ?, 1)",
                  (act_code, act_info["desc"], act_info["short"]))
        act_rows.append((act_code, act_info["desc"], act_info["short"], 1))
    write_csv("Act.csv", ["ActCode", "ActDescription", "ShortName", "Active"], act_rows)
    progress(len(ACTS_AND_SECTIONS), "Act")

    # Sections
    sec_rows = []
    for act_code, act_info in ACTS_AND_SECTIONS.items():
        for sec_code, sec_desc in act_info["sections"].items():
            c.execute("INSERT INTO Section VALUES (?, ?, ?, 1)",
                      (act_code, sec_code, sec_desc))
            sec_rows.append((act_code, sec_code, sec_desc, 1))
    write_csv("Section.csv",
              ["ActCode", "SectionCode", "SectionDescription", "Active"], sec_rows)
    progress(len(sec_rows), "Section")

    # CrimeHead
    ch_rows = []
    for chid, chname in CRIME_HEADS:
        c.execute("INSERT INTO CrimeHead VALUES (?, ?, 1)", (chid, chname))
        ch_rows.append((chid, chname, 1))
    write_csv("CrimeHead.csv", ["CrimeHeadID", "CrimeGroupName", "Active"], ch_rows)
    progress(len(CRIME_HEADS), "CrimeHead")

    # CrimeSubHead
    csh_rows = []
    sub_id = 1
    for chid, subs in CRIME_SUB_HEADS.items():
        for sname, seq in subs:
            c.execute("INSERT INTO CrimeSubHead VALUES (?, ?, ?, ?)",
                      (sub_id, chid, sname, seq))
            csh_rows.append((sub_id, chid, sname, seq))
            sub_id += 1
    write_csv("CrimeSubHead.csv",
              ["CrimeSubHeadID", "CrimeHeadID", "CrimeHeadName", "SeqID"], csh_rows)
    progress(len(csh_rows), "CrimeSubHead")

    # Build sub_head lookup: crime_head_id → list of sub_head_ids
    sub_head_lookup = defaultdict(list)
    for row in csh_rows:
        sub_head_lookup[row[1]].append(row[0])

    # CrimeHeadActSection
    chas_rows = []
    for chid, act_secs in CRIME_HEAD_TO_ACTS.items():
        for act_code, sec_code in act_secs:
            c.execute("INSERT INTO CrimeHeadActSection VALUES (?, ?, ?)",
                      (chid, act_code, sec_code))
            chas_rows.append((chid, act_code, sec_code))
    write_csv("CrimeHeadActSection.csv",
              ["CrimeHeadID", "ActCode", "SectionCode"], chas_rows)
    progress(len(chas_rows), "CrimeHeadActSection")

    conn.commit()
    return sub_head_lookup


# ═══════════════════════════════════════════════════════════════════
# STEP 1b — Units (Police Stations)
# ═══════════════════════════════════════════════════════════════════

def generate_units(conn):
    """Generate police station units — ~300 stations across 30 districts."""
    c = conn.cursor()
    print("\n── STEP 1b: Police Station Units ──")

    unit_id = 1
    unit_rows = []

    # State HQ
    c.execute("INSERT INTO Unit VALUES (?, ?, ?, ?, 1, 1, 1, 1)",
              (unit_id, "Karnataka State Police HQ", 1, None))
    unit_rows.append((unit_id, "Karnataka State Police HQ", 1, None, 1, 1, 1, 1))
    state_hq_id = unit_id
    unit_id += 1

    station_units = []  # (unit_id, district_id) for police stations
    district_hq_map = {}  # district_id → district_hq unit_id

    for dist_idx, (dist_name, _, _) in enumerate(KARNATAKA_DISTRICTS, start=1):
        # District HQ
        dhq_name = f"{dist_name} District Police HQ"
        c.execute("INSERT INTO Unit VALUES (?, ?, 3, ?, 1, 1, ?, 1)",
                  (unit_id, dhq_name, state_hq_id, dist_idx))
        unit_rows.append((unit_id, dhq_name, 3, state_hq_id, 1, 1, dist_idx, 1))
        dist_hq_id = unit_id
        district_hq_map[dist_idx] = dist_hq_id
        unit_id += 1

        # Generate 8-12 police stations per district
        station_suffixes = [
            "Town PS", "Rural PS", "North PS", "South PS", "East PS",
            "West PS", "Central PS", "Traffic PS", "Women PS", "Cyber PS",
            "City Market PS", "Industrial Area PS",
        ]
        num_stations = random.randint(8, 12)
        for j in range(num_stations):
            suffix = station_suffixes[j % len(station_suffixes)]
            ps_name = f"{dist_name} {suffix}"
            type_id = 5  # Police Station
            if "Traffic" in suffix:
                type_id = 7
            elif "Cyber" in suffix:
                type_id = 8
            elif "Women" in suffix:
                type_id = 9

            c.execute("INSERT INTO Unit VALUES (?, ?, ?, ?, 1, 1, ?, 1)",
                      (unit_id, ps_name, type_id, dist_hq_id, dist_idx))
            unit_rows.append((unit_id, ps_name, type_id, dist_hq_id, 1, 1, dist_idx, 1))
            station_units.append((unit_id, dist_idx))
            unit_id += 1

    write_csv("Unit.csv",
              ["UnitID", "UnitName", "TypeID", "ParentUnit",
               "NationalityID", "StateID", "DistrictID", "Active"],
              unit_rows)
    progress(len(unit_rows), "Unit")
    conn.commit()
    return station_units, district_hq_map


# ═══════════════════════════════════════════════════════════════════
# STEP 1c — Courts
# ═══════════════════════════════════════════════════════════════════

def generate_courts(conn):
    """Generate courts — ~90 across districts."""
    c = conn.cursor()
    print("\n── STEP 1c: Courts ──")

    court_types = [
        "Sessions Court", "JMFC Court", "Civil Court",
        "Family Court", "Fast Track Court",
    ]
    court_id = 1
    court_rows = []
    court_by_district = defaultdict(list)

    for dist_idx, (dist_name, _, _) in enumerate(KARNATAKA_DISTRICTS, start=1):
        # 2-4 courts per district
        num_courts = random.randint(2, 4)
        for j in range(num_courts):
            ct = court_types[j % len(court_types)]
            cname = f"{dist_name} {ct}"
            c.execute("INSERT INTO Court VALUES (?, ?, ?, 1, 1)",
                      (court_id, cname, dist_idx))
            court_rows.append((court_id, cname, dist_idx, 1, 1))
            court_by_district[dist_idx].append(court_id)
            court_id += 1

    write_csv("Court.csv",
              ["CourtID", "CourtName", "DistrictID", "StateID", "Active"],
              court_rows)
    progress(len(court_rows), "Court")
    conn.commit()
    return court_by_district


# ═══════════════════════════════════════════════════════════════════
# STEP 1d — Employees
# ═══════════════════════════════════════════════════════════════════

def generate_employees(conn, station_units):
    """Generate ~2,500 police employees across stations."""
    c = conn.cursor()
    print("\n── STEP 1d: Employees ──")

    emp_rows = []
    emp_id = 1
    blood_groups = [1, 2, 3, 4, 5, 6, 7, 8]  # A+, A-, B+, B-, O+, O-, AB+, AB-

    # Build a list of station-ids per district
    district_stations = defaultdict(list)
    for uid, did in station_units:
        district_stations[did].append(uid)

    for dist_idx in range(1, len(KARNATAKA_DISTRICTS) + 1):
        stations_in_dist = district_stations.get(dist_idx, [])
        if not stations_in_dist:
            continue

        # ~80 employees per district
        num_emps = random.randint(70, 90)
        for _ in range(num_emps):
            unit_id = random.choice(stations_in_dist)
            # Rank distribution: mostly constables & SIs
            rank_id = random.choices(
                [9, 10, 11, 12, 13, 8, 7, 6, 5],
                weights=[15, 20, 10, 20, 25, 5, 3, 1, 1],
                k=1
            )[0]
            des_id = random.randint(1, len(DESIGNATIONS))
            gender_id = random.choices([1, 2], weights=[82, 18], k=1)[0]
            name = gen_indian_name(gender_id)
            year = random.randint(2005, 2022)
            serial = random.randint(1, 999999)
            kgid = f"KG{year}{serial:06d}"

            dob = random_date("1970-01-01", "2000-12-31").strftime("%Y-%m-%d")
            appt = random_date("2005-01-01", "2023-06-30").strftime("%Y-%m-%d")
            bg = random.choice(blood_groups)
            pc = random.choices([0, 1], weights=[97, 3], k=1)[0]

            c.execute(
                "INSERT INTO Employee VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                (emp_id, dist_idx, unit_id, rank_id, des_id, kgid,
                 name, dob, gender_id, bg, pc, appt)
            )
            emp_rows.append((emp_id, dist_idx, unit_id, rank_id, des_id, kgid,
                             name, dob, gender_id, bg, pc, appt))
            emp_id += 1

    write_csv("Employee.csv",
              ["EmployeeID", "DistrictID", "UnitID", "RankID", "DesignationID",
               "KGID", "FirstName", "EmployeeDOB", "GenderID", "BloodGroupID",
               "PhysicallyChallenged", "AppointmentDate"],
              emp_rows)
    progress(len(emp_rows), "Employee")
    conn.commit()

    # Build district→employee map and Pareto officer distribution
    emp_by_district = defaultdict(list)
    for row in emp_rows:
        emp_by_district[row[1]].append(row[0])  # district_id → [emp_id, ...]

    # Top 20% officers get 60% of cases (Pareto)
    all_emp_ids = [r[0] for r in emp_rows]
    random.shuffle(all_emp_ids)
    cutoff = max(1, int(len(all_emp_ids) * 0.2))
    top_officers = all_emp_ids[:cutoff]
    other_officers = all_emp_ids[cutoff:]

    return emp_rows, emp_by_district, top_officers, other_officers


# ═══════════════════════════════════════════════════════════════════
# STEP 2 — Citizen Pool (5,000 people)
# ═══════════════════════════════════════════════════════════════════

def generate_citizen_pool():
    """Create 5,000 reusable citizen profiles."""
    print("\n── STEP 2: Citizen Pool (5,000 people) ──")

    citizens = []
    for i in range(5000):
        # Gender: 60% M, 38% F, 2% T
        gender_id = random.choices([1, 2, 3], weights=[60, 38, 2], k=1)[0]
        name = gen_indian_name(gender_id)
        age = clamp(int(random.gauss(32, 12)), 15, 70)
        religion_id = weighted_choice(
            [r[0] for r in RELIGIONS],
            RELIGION_WEIGHTS
        )
        caste_id = weighted_choice(
            [c[0] for c in CASTES],
            CASTE_WEIGHTS
        )
        occ_id = random.randint(1, len(OCCUPATIONS))

        citizens.append({
            "idx": i,
            "name": name,
            "age": age,
            "gender_id": gender_id,
            "religion_id": religion_id,
            "caste_id": caste_id,
            "occupation_id": occ_id,
        })

    progress(len(citizens), "citizen_pool (in-memory)")
    return citizens


# ═══════════════════════════════════════════════════════════════════
# STEP 3 — Crime Syndicates
# ═══════════════════════════════════════════════════════════════════

def generate_syndicates(conn, citizens):
    """Generate 20 syndicates and assign 8-20 members each from citizen pool."""
    c = conn.cursor()
    print("\n── STEP 3: Crime Syndicates ──")

    syndicate_rows = []
    syndicate_member_citizens = {}  # syndicate_id → [citizen_idx, ...]
    used_citizen_indices = set()

    for sid, (sname, specialty, districts) in enumerate(SYNDICATE_DEFS, start=1):
        num_members = random.randint(8, 20)

        # Pick members from citizen pool (try to avoid overlap but allow some)
        available = [i for i in range(len(citizens)) if i not in used_citizen_indices]
        if len(available) < num_members:
            available = list(range(len(citizens)))

        member_indices = random.sample(available, num_members)
        for mi in member_indices:
            used_citizen_indices.add(mi)

        syndicate_member_citizens[sid] = member_indices
        leader_idx = member_indices[0]
        leader_name = citizens[leader_idx]["name"]

        active_from = random_date("2022-06-01", "2023-06-30").strftime("%Y-%m-%d")
        active_to = random_date("2024-06-01", "2024-12-31").strftime("%Y-%m-%d")

        c.execute(
            "INSERT INTO crime_syndicates VALUES (?,?,?,?,?,?,?,0,?)",
            (sid, sname, specialty, leader_name, ", ".join(districts),
             active_from, active_to, num_members)
        )
        syndicate_rows.append((
            sid, sname, specialty, leader_name, ", ".join(districts),
            active_from, active_to, 0, num_members
        ))

    write_csv("crime_syndicates.csv",
              ["syndicate_id", "syndicate_name", "crime_speciality", "leader_name",
               "operating_districts", "active_from", "active_to",
               "total_cases", "total_members"],
              syndicate_rows)
    progress(len(syndicate_rows), "crime_syndicates")
    conn.commit()
    return syndicate_member_citizens


# ═══════════════════════════════════════════════════════════════════
# STEP 4 — Case Master (10,000 cases)
# ═══════════════════════════════════════════════════════════════════

def generate_brief_facts(crime_head_id, accused_name, victim_name,
                         complainant_name, district_name, incident_date,
                         amount=None):
    """Generate realistic 2-3 sentence BriefFacts."""
    date_str = incident_date.strftime("%d-%m-%Y")

    # Pick area name
    if "Bengaluru" in district_name:
        area = random.choice(BENGALURU_AREAS)
    else:
        area = random.choice(GENERAL_AREAS)
    location = f"{area}, {district_name}"
    hospital = random.choice(HOSPITALS)

    templates = {
        1: [  # Murder
            f"On {date_str} at {location}, accused {accused_name} allegedly attacked "
            f"victim {victim_name} with a sharp weapon following a dispute over property. "
            f"The victim sustained fatal injuries and was declared dead at {hospital}. "
            f"FIR registered based on complaint by {complainant_name}.",
            f"The complainant {complainant_name} reported that on {date_str}, the accused "
            f"{accused_name} stabbed {victim_name} during a quarrel at {location}. "
            f"Victim succumbed to injuries at {hospital}.",
        ],
        2: [  # Attempt to Murder
            f"On {date_str}, at {location}, accused {accused_name} attempted to murder "
            f"{victim_name} by attacking with a lethal weapon. Victim sustained serious "
            f"injuries and was admitted to {hospital}. Case registered on complaint of {complainant_name}.",
        ],
        3: [  # Robbery & Dacoity
            f"On {date_str}, a group of accused led by {accused_name} committed robbery "
            f"at {location}, threatening {victim_name} with weapons and looting "
            f"Rs.{amount or random.randint(10000, 500000):,}. "
            f"Complaint filed by {complainant_name}.",
        ],
        4: [  # Theft
            f"Complainant {complainant_name} reported that on {date_str}, accused "
            f"{accused_name} committed theft of valuables worth Rs.{amount or random.randint(5000, 200000):,} "
            f"from the residence/vehicle at {location}. Investigation initiated.",
            f"On {date_str}, a two-wheeler bearing registration KA-XX-XXXX was stolen from "
            f"{location}. Complainant {complainant_name} suspects involvement of "
            f"{accused_name} and gang based on CCTV footage.",
        ],
        5: [  # Cheating & Fraud
            f"Complainant {complainant_name} reported that accused {accused_name} cheated "
            f"by posing as a government official and fraudulently obtained "
            f"Rs.{amount or random.randint(50000, 2000000):,} through fake documents at "
            f"{location} on {date_str}. Total loss: Rs.{amount or random.randint(50000, 2000000):,}.",
        ],
        6: [  # Cyber Crime
            f"Complainant {complainant_name} reported receiving a call from accused posing "
            f"as bank official on {date_str}. Accused {accused_name} fraudulently obtained "
            f"OTP and transferred Rs.{amount or random.randint(10000, 1000000):,} from "
            f"complainant's account. Cyber cell investigation initiated from {location}.",
            f"On {date_str}, complainant {complainant_name} from {location} was defrauded "
            f"via a fake investment scheme online. Accused {accused_name} siphoned "
            f"Rs.{amount or random.randint(100000, 5000000):,} through multiple UPI transactions.",
        ],
        7: [  # Narcotics
            f"On {date_str}, during a raid at {location}, accused {accused_name} was found "
            f"in possession of {random.choice(['ganja', 'hashish', 'heroin', 'MDMA pills'])} "
            f"weighing {random.randint(1, 50)} kgs. Seizure effected under NDPS Act. "
            f"Complaint by {complainant_name} (PSI).",
        ],
        8: [  # Crimes Against Women
            f"Complainant {complainant_name} reported that her husband {accused_name} and "
            f"in-laws have been subjecting her to cruelty and demanding additional dowry of "
            f"Rs.{random.randint(100000, 1000000):,} at {location}. "
            f"Complaint filed on {date_str}.",
            f"Victim {victim_name} reported that on {date_str}, accused {accused_name} "
            f"committed sexual assault at {location}. Medical examination conducted at "
            f"{hospital}. Case registered under relevant sections.",
        ],
        9: [  # POCSO
            f"On {date_str}, a minor victim (age {random.randint(8, 17)}) was sexually "
            f"assaulted by accused {accused_name} at {location}. Complaint registered by "
            f"{complainant_name} (parent/guardian). Victim examined at {hospital}.",
        ],
        10: [ # SC/ST
            f"On {date_str}, complainant {complainant_name} reported that accused "
            f"{accused_name} committed atrocities based on caste at {location}. "
            f"Verbal abuse and social boycott reported. FIR registered under SC/ST Act.",
        ],
        11: [ # Arms Act
            f"During a search operation on {date_str} at {location}, accused {accused_name} "
            f"was found in illegal possession of a {random.choice(['country-made pistol', 'revolver', 'knife'])} "
            f"without valid licence. Seized and case registered under Arms Act.",
        ],
        12: [ # Motor Vehicle
            f"On {date_str}, accused {accused_name} driving a "
            f"{random.choice(['lorry', 'bus', 'car', 'two-wheeler'])} rashly and negligently "
            f"caused accident at {location}, resulting in "
            f"{random.choice(['grievous injuries', 'death'])} of {victim_name}. "
            f"Complaint by {complainant_name}.",
        ],
        13: [ # Preventive
            f"On {date_str}, accused {accused_name} was detained preventively at {location} "
            f"to maintain public peace and tranquility. Bond executed before Executive Magistrate.",
        ],
        14: [ # Economic Offences
            f"Investigation revealed that accused {accused_name} was involved in "
            f"{random.choice(['hawala transactions', 'money laundering', 'counterfeit currency circulation'])} "
            f"totalling Rs.{amount or random.randint(500000, 10000000):,} at {location}. "
            f"Complaint by {complainant_name} on {date_str}.",
        ],
        15: [ # Kidnapping
            f"On {date_str}, victim {victim_name} was kidnapped by accused {accused_name} "
            f"from {location} and a ransom of Rs.{random.randint(100000, 5000000):,} was "
            f"demanded. Complainant {complainant_name} reported the matter to police.",
        ],
    }

    options = templates.get(crime_head_id, templates[5])
    return random.choice(options)


def generate_cases(conn, station_units, citizens, syndicate_member_citizens,
                   sub_head_lookup, court_by_district,
                   top_officers, other_officers, emp_by_district):
    """Generate 10,000 CaseMaster records."""
    c = conn.cursor()
    print("\n── STEP 4: CaseMaster (10,000 cases) ──")

    NUM_CASES = 10000
    SYNDICATE_CASES = 3000
    STANDALONE_CASES = NUM_CASES - SYNDICATE_CASES

    # District name→id lookup
    dist_name_to_id = {}
    for i, (name, _, _) in enumerate(KARNATAKA_DISTRICTS, start=1):
        dist_name_to_id[name] = i

    # Station lookup: district_id → [unit_id, ...]
    stations_by_district = defaultdict(list)
    for uid, did in station_units:
        stations_by_district[did].append(uid)

    # Crime distribution weighted list
    crime_heads_list = list(CRIME_DISTRIBUTION.keys())
    crime_weights = [CRIME_DISTRIBUTION[ch] for ch in crime_heads_list]

    # Case serial counters per year
    case_serial = {"2023": 0, "2024": 0}
    crime_no_serial = 0

    case_rows = []
    case_metadata = []  # Store metadata for connected tables

    # Pre-build syndicate case assignments
    # Each syndicate gets proportional cases
    syndicate_case_counts = {}
    base_per_synd = SYNDICATE_CASES // 20
    remainder = SYNDICATE_CASES % 20
    for sid in range(1, 21):
        syndicate_case_counts[sid] = base_per_synd + (1 if sid <= remainder else 0)

    # ── Generate syndicate-linked cases ──
    case_id = 1
    for sid in range(1, 21):
        sname, specialty, districts = SYNDICATE_DEFS[sid - 1]
        member_indices = syndicate_member_citizens[sid]
        crime_head_id = SYNDICATE_CRIME_MAP.get(specialty, 5)

        operating_dist_ids = [dist_name_to_id[d] for d in districts if d in dist_name_to_id]

        for _ in range(syndicate_case_counts[sid]):
            # Pick district from syndicate's operating area
            dist_id = random.choice(operating_dist_ids)
            dist_name, lat_center, lon_center = KARNATAKA_DISTRICTS[dist_id - 1]

            # Station
            available_stations = stations_by_district.get(dist_id, [])
            if not available_stations:
                continue
            station_id = random.choice(available_stations)

            # Officer (Pareto: 60% chance top officer from any district)
            if random.random() < 0.6 and top_officers:
                officer_id = random.choice(top_officers)
            elif emp_by_district.get(dist_id):
                officer_id = random.choice(emp_by_district[dist_id])
            else:
                officer_id = random.choice(top_officers) if top_officers else 1

            # Case category
            cat_id = random.choices([1, 2, 3, 4], weights=[70, 15, 10, 5], k=1)[0]

            # Status
            status_id = random.choices(
                [1, 2, 3, 4, 5], weights=STATUS_WEIGHTS, k=1
            )[0]

            # Gravity
            gravity_id = 1 if crime_head_id in HEINOUS_CRIME_HEADS else 2

            # Sub-head
            sub_heads = sub_head_lookup.get(crime_head_id, [1])
            minor_head_id = random.choice(sub_heads)

            # Dates
            incident_dt = random_datetime("2023-01-01", "2024-12-31")
            incident_from = incident_dt
            incident_to = incident_dt + timedelta(hours=random.randint(0, 4))
            reg_date = (incident_dt + timedelta(days=random.randint(0, 3))).strftime("%Y-%m-%d")
            info_received = (incident_dt + timedelta(hours=random.randint(1, 12)))

            year_str = incident_dt.strftime("%Y")
            if year_str not in case_serial:
                case_serial[year_str] = 0
            case_serial[year_str] += 1
            crime_no_serial += 1

            # CrimeNo format
            cat_code = CATEGORY_CODE_MAP.get(cat_id, "1")
            crime_no = f"{cat_code}{dist_id:04d}{station_id:04d}{year_str}{crime_no_serial:05d}"
            case_no = f"{year_str}{case_serial[year_str]:05d}"

            # Court (only for Court Trial status)
            court_id = None
            if status_id == 4:
                courts = court_by_district.get(dist_id, [])
                court_id = random.choice(courts) if courts else None

            # Lat/Lon with offset
            lat = round(lat_center + random.uniform(-0.2, 0.2), 4)
            lon = round(lon_center + random.uniform(-0.2, 0.2), 4)
            lat = clamp(lat, 11.5, 18.5)
            lon = clamp(lon, 74.0, 78.5)

            # Pick accused/victim/complainant from syndicate members or citizens
            accused_citizen_idx = random.choice(member_indices)
            complainant_idx = random.choice([i for i in range(len(citizens)) if i not in member_indices][:500])
            victim_idx = complainant_idx  # often complainant is victim

            accused_name = citizens[accused_citizen_idx]["name"]
            victim_name = citizens[victim_idx]["name"]
            complainant_name = citizens[complainant_idx]["name"]

            brief = generate_brief_facts(
                crime_head_id, accused_name, victim_name,
                complainant_name, dist_name, incident_dt
            )

            row = (
                case_id, crime_no, case_no, reg_date,
                officer_id, station_id, cat_id, gravity_id,
                crime_head_id, minor_head_id, status_id, court_id,
                incident_from.strftime("%Y-%m-%d %H:%M:%S"),
                incident_to.strftime("%Y-%m-%d %H:%M:%S"),
                info_received.strftime("%Y-%m-%d %H:%M:%S"),
                lat, lon, brief
            )

            c.execute(
                "INSERT INTO CaseMaster VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                row
            )
            case_rows.append(row)
            case_metadata.append({
                "case_id": case_id,
                "district_id": dist_id,
                "station_id": station_id,
                "officer_id": officer_id,
                "crime_head_id": crime_head_id,
                "minor_head_id": minor_head_id,
                "status_id": status_id,
                "court_id": court_id,
                "cat_id": cat_id,
                "incident_dt": incident_dt,
                "is_syndicate": True,
                "syndicate_id": sid,
                "member_indices": member_indices,
                "accused_citizen_idx": accused_citizen_idx,
                "complainant_idx": complainant_idx,
                "victim_idx": victim_idx,
            })
            case_id += 1

    # ── Generate standalone cases ──
    for _ in range(STANDALONE_CASES):
        crime_head_id = random.choices(crime_heads_list, weights=crime_weights, k=1)[0]
        dist_id = random.randint(1, len(KARNATAKA_DISTRICTS))
        dist_name, lat_center, lon_center = KARNATAKA_DISTRICTS[dist_id - 1]

        available_stations = stations_by_district.get(dist_id, [])
        if not available_stations:
            continue
        station_id = random.choice(available_stations)

        if random.random() < 0.6 and top_officers:
            officer_id = random.choice(top_officers)
        elif emp_by_district.get(dist_id):
            officer_id = random.choice(emp_by_district[dist_id])
        else:
            officer_id = random.choice(top_officers) if top_officers else 1

        cat_id = random.choices([1, 2, 3, 4], weights=[70, 15, 10, 5], k=1)[0]
        status_id = random.choices([1, 2, 3, 4, 5], weights=STATUS_WEIGHTS, k=1)[0]
        gravity_id = 1 if crime_head_id in HEINOUS_CRIME_HEADS else 2

        sub_heads = sub_head_lookup.get(crime_head_id, [1])
        minor_head_id = random.choice(sub_heads)

        incident_dt = random_datetime("2023-01-01", "2024-12-31")
        incident_from = incident_dt
        incident_to = incident_dt + timedelta(hours=random.randint(0, 4))
        reg_date = (incident_dt + timedelta(days=random.randint(0, 3))).strftime("%Y-%m-%d")
        info_received = (incident_dt + timedelta(hours=random.randint(1, 12)))

        year_str = incident_dt.strftime("%Y")
        if year_str not in case_serial:
            case_serial[year_str] = 0
        case_serial[year_str] += 1
        crime_no_serial += 1

        cat_code = CATEGORY_CODE_MAP.get(cat_id, "1")
        crime_no = f"{cat_code}{dist_id:04d}{station_id:04d}{year_str}{crime_no_serial:05d}"
        case_no = f"{year_str}{case_serial[year_str]:05d}"

        court_id = None
        if status_id == 4:
            courts = court_by_district.get(dist_id, [])
            court_id = random.choice(courts) if courts else None

        lat = round(lat_center + random.uniform(-0.2, 0.2), 4)
        lon = round(lon_center + random.uniform(-0.2, 0.2), 4)
        lat = clamp(lat, 11.5, 18.5)
        lon = clamp(lon, 74.0, 78.5)

        # Random citizens for standalone
        accused_citizen_idx = random.randint(0, len(citizens) - 1)
        complainant_idx = random.randint(0, len(citizens) - 1)
        while complainant_idx == accused_citizen_idx:
            complainant_idx = random.randint(0, len(citizens) - 1)
        victim_idx = complainant_idx if random.random() < 0.6 else random.randint(0, len(citizens) - 1)

        accused_name = citizens[accused_citizen_idx]["name"]
        victim_name = citizens[victim_idx]["name"]
        complainant_name = citizens[complainant_idx]["name"]

        brief = generate_brief_facts(
            crime_head_id, accused_name, victim_name,
            complainant_name, dist_name, incident_dt
        )

        row = (
            case_id, crime_no, case_no, reg_date,
            officer_id, station_id, cat_id, gravity_id,
            crime_head_id, minor_head_id, status_id, court_id,
            incident_from.strftime("%Y-%m-%d %H:%M:%S"),
            incident_to.strftime("%Y-%m-%d %H:%M:%S"),
            info_received.strftime("%Y-%m-%d %H:%M:%S"),
            lat, lon, brief
        )
        c.execute(
            "INSERT INTO CaseMaster VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            row
        )
        case_rows.append(row)
        case_metadata.append({
            "case_id": case_id,
            "district_id": dist_id,
            "station_id": station_id,
            "officer_id": officer_id,
            "crime_head_id": crime_head_id,
            "minor_head_id": minor_head_id,
            "status_id": status_id,
            "court_id": court_id,
            "cat_id": cat_id,
            "incident_dt": incident_dt,
            "is_syndicate": False,
            "syndicate_id": None,
            "member_indices": None,
            "accused_citizen_idx": accused_citizen_idx,
            "complainant_idx": complainant_idx,
            "victim_idx": victim_idx,
        })
        case_id += 1

    write_csv("CaseMaster.csv",
              ["CaseMasterID", "CrimeNo", "CaseNo", "CrimeRegisteredDate",
               "PolicePersonID", "PoliceStationID", "CaseCategoryID",
               "GravityOffenceID", "CrimeMajorHeadID", "CrimeMinorHeadID",
               "CaseStatusID", "CourtID", "IncidentFromDate", "IncidentToDate",
               "InfoReceivedPSDate", "latitude", "longitude", "BriefFacts"],
              case_rows)
    progress(len(case_rows), "CaseMaster")
    conn.commit()
    return case_metadata


# ═══════════════════════════════════════════════════════════════════
# STEP 5 — Connected Tables
# ═══════════════════════════════════════════════════════════════════

def generate_complainants(conn, case_metadata, citizens):
    """Generate ComplainantDetails — 1-2 per case."""
    c = conn.cursor()
    print("\n── STEP 5a: ComplainantDetails ──")

    comp_rows = []
    comp_id = 1

    for meta in case_metadata:
        num = random.choices([1, 2], weights=[70, 30], k=1)[0]
        for j in range(num):
            if j == 0:
                cit_idx = meta["complainant_idx"]
            else:
                cit_idx = random.randint(0, len(citizens) - 1)

            cit = citizens[cit_idx]
            row = (
                comp_id, meta["case_id"], cit["name"], cit["age"],
                cit["occupation_id"], cit["religion_id"], cit["caste_id"],
                cit["gender_id"]
            )
            c.execute(
                "INSERT INTO ComplainantDetails VALUES (?,?,?,?,?,?,?,?)", row
            )
            comp_rows.append(row)
            comp_id += 1

    write_csv("ComplainantDetails.csv",
              ["ComplainantID", "CaseMasterID", "ComplainantName", "AgeYear",
               "OccupationID", "ReligionID", "CasteID", "GenderID"],
              comp_rows)
    progress(len(comp_rows), "ComplainantDetails")
    conn.commit()
    return comp_rows


def generate_victims(conn, case_metadata, citizens):
    """Generate Victim table — 1-3 per case."""
    c = conn.cursor()
    print("\n── STEP 5b: Victim ──")

    victim_rows = []
    victim_id = 1

    for meta in case_metadata:
        num = random.choices([1, 2, 3], weights=[55, 30, 15], k=1)[0]
        for j in range(num):
            if j == 0:
                cit_idx = meta["victim_idx"]
            else:
                cit_idx = random.randint(0, len(citizens) - 1)

            cit = citizens[cit_idx]
            # 2% chance victim is police
            victim_police = "1" if random.random() < 0.02 else "0"
            row = (
                victim_id, meta["case_id"], cit["name"], cit["age"],
                cit["gender_id"], victim_police
            )
            c.execute("INSERT INTO Victim VALUES (?,?,?,?,?,?)", row)
            victim_rows.append(row)
            victim_id += 1

    write_csv("Victim.csv",
              ["VictimMasterID", "CaseMasterID", "VictimName", "AgeYear",
               "GenderID", "VictimPolice"],
              victim_rows)
    progress(len(victim_rows), "Victim")
    conn.commit()
    return victim_rows


def generate_accused(conn, case_metadata, citizens, syndicate_member_citizens):
    """Generate Accused table — 1-4 per case. Syndicate cases use syndicate members."""
    c = conn.cursor()
    print("\n── STEP 5c: Accused ──")

    accused_rows = []
    accused_id = 1
    accused_by_case = defaultdict(list)  # case_id → [accused_master_id, ...]
    accused_citizen_map = {}  # accused_master_id → citizen_idx

    for meta in case_metadata:
        if meta["is_syndicate"]:
            # Use 1-4 syndicate members
            member_indices = meta["member_indices"]
            num = min(random.randint(1, 4), len(member_indices))
            chosen = random.sample(member_indices, num)
        else:
            # Random citizens
            num = random.choices([1, 2, 3, 4], weights=[40, 30, 20, 10], k=1)[0]
            chosen = [random.randint(0, len(citizens) - 1) for _ in range(num)]

        for j, cit_idx in enumerate(chosen):
            cit = citizens[cit_idx]
            person_id = f"A{j+1}"
            row = (
                accused_id, meta["case_id"], cit["name"], cit["age"],
                cit["gender_id"], person_id
            )
            c.execute("INSERT INTO Accused VALUES (?,?,?,?,?,?)", row)
            accused_rows.append(row)
            accused_by_case[meta["case_id"]].append(accused_id)
            accused_citizen_map[accused_id] = cit_idx
            accused_id += 1

    write_csv("Accused.csv",
              ["AccusedMasterID", "CaseMasterID", "AccusedName", "AgeYear",
               "GenderID", "PersonID"],
              accused_rows)
    progress(len(accused_rows), "Accused")
    conn.commit()
    return accused_rows, accused_by_case, accused_citizen_map


def generate_act_section_assoc(conn, case_metadata):
    """Generate ActSectionAssociation — 1-3 per case, matching CrimeHead."""
    c = conn.cursor()
    print("\n── STEP 5d: ActSectionAssociation ──")

    asa_rows = []
    for meta in case_metadata:
        ch_id = meta["crime_head_id"]
        available = CRIME_HEAD_TO_ACTS.get(ch_id, [("IPC", "420")])
        num = min(random.randint(1, 3), len(available))
        chosen = random.sample(available, num)

        for order_idx, (act_code, sec_code) in enumerate(chosen, start=1):
            row = (meta["case_id"], act_code, sec_code, order_idx, order_idx)
            c.execute("INSERT INTO ActSectionAssociation VALUES (?,?,?,?,?)", row)
            asa_rows.append(row)

    write_csv("ActSectionAssociation.csv",
              ["CaseMasterID", "ActID", "SectionID", "ActOrderID", "SectionOrderID"],
              asa_rows)
    progress(len(asa_rows), "ActSectionAssociation")
    conn.commit()
    return asa_rows


def generate_arrests(conn, case_metadata, accused_by_case, station_units,
                     court_by_district, emp_by_district, top_officers):
    """Generate ArrestSurrender — ~40% of cases."""
    c = conn.cursor()
    print("\n── STEP 5e: ArrestSurrender ──")

    arrest_rows = []
    arrest_id = 1

    for meta in case_metadata:
        if random.random() > 0.4:
            continue  # 40% of cases get arrests

        accused_ids = accused_by_case.get(meta["case_id"], [])
        if not accused_ids:
            continue

        # Arrest 1-2 accused per case
        num_arrests = min(random.randint(1, 2), len(accused_ids))
        chosen_accused = random.sample(accused_ids, num_arrests)

        for acc_id in chosen_accused:
            arrest_type = random.choices([1, 2], weights=[85, 15], k=1)[0]
            arrest_date = (meta["incident_dt"] + timedelta(days=random.randint(0, 30))
                          ).strftime("%Y-%m-%d")

            dist_id = meta["district_id"]
            courts = court_by_district.get(dist_id, [])
            court_id = random.choice(courts) if courts else 1

            # IO
            if emp_by_district.get(dist_id):
                io_id = random.choice(emp_by_district[dist_id])
            else:
                io_id = random.choice(top_officers) if top_officers else 1

            row = (
                arrest_id, meta["case_id"], arrest_type, arrest_date,
                1, dist_id, meta["station_id"], io_id, court_id,
                acc_id, 1, 0
            )
            c.execute(
                "INSERT INTO ArrestSurrender VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                row
            )
            arrest_rows.append(row)
            arrest_id += 1

    write_csv("ArrestSurrender.csv",
              ["ArrestSurrenderID", "CaseMasterID", "ArrestSurrenderTypeID",
               "ArrestSurrenderDate", "ArrestSurrenderStateId",
               "ArrestSurrenderDistrictId", "PoliceStationID", "IOID",
               "CourtID", "AccusedMasterID", "IsAccused", "IsComplainantAccused"],
              arrest_rows)
    progress(len(arrest_rows), "ArrestSurrender")
    conn.commit()
    return arrest_rows


def generate_chargesheets(conn, case_metadata, top_officers, emp_by_district):
    """Generate ChargesheetDetails — for Charge Sheeted and Court Trial cases."""
    c = conn.cursor()
    print("\n── STEP 5f: ChargesheetDetails ──")

    cs_rows = []
    cs_id = 1

    for meta in case_metadata:
        # Only for status 3 (Charge Sheeted) or 4 (Court Trial)
        if meta["status_id"] not in (3, 4):
            continue

        cs_date = (meta["incident_dt"] + timedelta(days=random.randint(30, 180))
                  ).strftime("%Y-%m-%d %H:%M:%S")
        cs_type = random.choices(
            ["A", "B", "C"], weights=[80, 10, 10], k=1
        )[0]

        if emp_by_district.get(meta["district_id"]):
            pp_id = random.choice(emp_by_district[meta["district_id"]])
        else:
            pp_id = random.choice(top_officers) if top_officers else 1

        row = (cs_id, meta["case_id"], cs_date, cs_type, pp_id)
        c.execute("INSERT INTO ChargesheetDetails VALUES (?,?,?,?,?)", row)
        cs_rows.append(row)
        cs_id += 1

    write_csv("ChargesheetDetails.csv",
              ["CSID", "CaseMasterID", "csdate", "cstype", "PolicePersonID"],
              cs_rows)
    progress(len(cs_rows), "ChargesheetDetails")
    conn.commit()
    return cs_rows


def generate_syndicate_members(conn, syndicate_member_citizens, accused_rows,
                               citizens):
    """Generate syndicate_members table — link accused to syndicates."""
    c = conn.cursor()
    print("\n── STEP 5g: syndicate_members ──")

    roles = ["Leader", "Financier", "Executor", "Lookout", "Mule"]
    member_rows = []
    member_id = 1

    # Build citizen_idx → [accused_master_id, ...] lookup
    citizen_to_accused = defaultdict(list)
    for row in accused_rows:
        acc_id = row[0]
        acc_name = row[2]
        # Find matching citizen by name
        for idx, cit in enumerate(citizens):
            if cit["name"] == acc_name:
                citizen_to_accused[idx].append(acc_id)
                break

    for sid, member_indices in syndicate_member_citizens.items():
        for i, cit_idx in enumerate(member_indices):
            accused_ids = citizen_to_accused.get(cit_idx, [])
            if not accused_ids:
                continue
            # Link to first accused record
            acc_id = accused_ids[0]
            role = roles[0] if i == 0 else random.choice(roles[1:])

            row = (member_id, sid, acc_id, role)
            c.execute("INSERT INTO syndicate_members VALUES (?,?,?,?)", row)
            member_rows.append(row)
            member_id += 1

    write_csv("syndicate_members.csv",
              ["member_id", "syndicate_id", "accused_master_id", "role"],
              member_rows)
    progress(len(member_rows), "syndicate_members")
    conn.commit()

    # Update total_cases in crime_syndicates
    syndicate_case_count = defaultdict(int)
    for meta_item in case_metadata_global:
        if meta_item.get("syndicate_id"):
            syndicate_case_count[meta_item["syndicate_id"]] += 1
    for sid, count in syndicate_case_count.items():
        c.execute("UPDATE crime_syndicates SET total_cases = ? WHERE syndicate_id = ?",
                  (count, sid))
    conn.commit()

    return member_rows


# ═══════════════════════════════════════════════════════════════════
# STEP 6 — Intelligence Tables
# ═══════════════════════════════════════════════════════════════════

def generate_financial_transactions(conn, accused_rows, accused_by_case,
                                     case_metadata, citizens):
    """Generate 15,000 financial transaction records."""
    c = conn.cursor()
    print("\n── STEP 6a: financial_transactions (15,000 rows) ──")

    txn_types = ["NEFT", "IMPS", "UPI", "Cash"]
    txn_rows = []

    # Build accused name list for syndicate members
    syndicate_accused_ids = set()
    for meta in case_metadata:
        if meta["is_syndicate"]:
            for acc_id in accused_by_case.get(meta["case_id"], []):
                syndicate_accused_ids.add(acc_id)

    syndicate_accused_list = list(syndicate_accused_ids)
    all_accused_list = [r[0] for r in accused_rows]

    for txn_id in range(1, 15001):
        # 40% are between syndicate members
        if random.random() < 0.4 and len(syndicate_accused_list) >= 2:
            sender_acc_id = random.choice(syndicate_accused_list)
            receiver_acc_id = random.choice(syndicate_accused_list)
            while receiver_acc_id == sender_acc_id and len(syndicate_accused_list) > 1:
                receiver_acc_id = random.choice(syndicate_accused_list)

            sender_name = None
            receiver_name = None
            for r in accused_rows:
                if r[0] == sender_acc_id:
                    sender_name = r[2]
                if r[0] == receiver_acc_id:
                    receiver_name = r[2]
                if sender_name and receiver_name:
                    break

            is_suspicious = 1 if random.random() < 0.5 else 0
            linked_acc_id = sender_acc_id
        else:
            # Random people
            cit1 = random.choice(citizens)
            cit2 = random.choice(citizens)
            sender_name = cit1["name"]
            receiver_name = cit2["name"]
            is_suspicious = 1 if random.random() < 0.15 else 0
            linked_acc_id = random.choice(all_accused_list) if random.random() < 0.3 else None
            sender_acc_id = None

        # Amount: 500 to 50,00,000 (log-normal for realistic spread)
        amount = round(min(5000000, max(500, random.lognormvariate(9, 2))), 2)

        txn_date = random_date("2023-01-01", "2024-12-31").strftime("%Y-%m-%d")
        txn_type = random.choice(txn_types)

        # Link to case
        linked_case = None
        if linked_acc_id:
            for r in accused_rows:
                if r[0] == linked_acc_id:
                    linked_case = r[1]  # CaseMasterID
                    break

        row = (
            txn_id, sender_name or "Unknown", receiver_name or "Unknown",
            amount, txn_date, txn_type, linked_case, linked_acc_id, is_suspicious
        )
        c.execute("INSERT INTO financial_transactions VALUES (?,?,?,?,?,?,?,?,?)", row)
        txn_rows.append(row)

    write_csv("financial_transactions.csv",
              ["txn_id", "sender_name", "receiver_name", "amount", "txn_date",
               "txn_type", "linked_case_id", "linked_accused_id", "is_suspicious"],
              txn_rows)
    progress(len(txn_rows), "financial_transactions")
    conn.commit()
    return txn_rows


def generate_cdr_records(conn, accused_rows, accused_by_case, case_metadata, citizens):
    """Generate 10,000 CDR (Call Detail Records)."""
    c = conn.cursor()
    print("\n── STEP 6b: cdr_records (10,000 rows) ──")

    cdr_rows = []

    # Build syndicate accused list
    syndicate_accused_ids = set()
    syndicate_case_map = {}  # accused_id → case metadata
    for meta in case_metadata:
        if meta["is_syndicate"]:
            for acc_id in accused_by_case.get(meta["case_id"], []):
                syndicate_accused_ids.add(acc_id)
                syndicate_case_map[acc_id] = meta

    syndicate_accused_list = list(syndicate_accused_ids)
    all_accused_list = [r[0] for r in accused_rows]

    for cdr_id in range(1, 10001):
        # 50% calls between syndicate members
        if random.random() < 0.5 and len(syndicate_accused_list) >= 2:
            caller_acc_id = random.choice(syndicate_accused_list)
            receiver_acc_id = random.choice(syndicate_accused_list)
            while receiver_acc_id == caller_acc_id and len(syndicate_accused_list) > 1:
                receiver_acc_id = random.choice(syndicate_accused_list)

            caller_name = None
            receiver_name = None
            for r in accused_rows:
                if r[0] == caller_acc_id:
                    caller_name = r[2]
                if r[0] == receiver_acc_id:
                    receiver_name = r[2]
                if caller_name and receiver_name:
                    break

            # Call 1-3 days before incident
            meta = syndicate_case_map.get(caller_acc_id)
            if meta:
                call_dt = meta["incident_dt"] - timedelta(days=random.randint(1, 3))
                linked_case = meta["case_id"]
                dist_id = meta["district_id"]
            else:
                call_dt = random_date("2023-01-01", "2024-12-31")
                linked_case = None
                dist_id = random.randint(1, len(KARNATAKA_DISTRICTS))
            linked_acc = caller_acc_id
        else:
            # Random
            cit1 = random.choice(citizens)
            cit2 = random.choice(citizens)
            caller_name = cit1["name"]
            receiver_name = cit2["name"]
            call_dt = random_date("2023-01-01", "2024-12-31")
            linked_acc = random.choice(all_accused_list) if random.random() < 0.2 else None
            linked_case = None
            dist_id = random.randint(1, len(KARNATAKA_DISTRICTS))

            if linked_acc:
                for r in accused_rows:
                    if r[0] == linked_acc:
                        linked_case = r[1]
                        break

        duration = random.randint(30, 600)

        row = (
            cdr_id, caller_name or "Unknown", receiver_name or "Unknown",
            call_dt.strftime("%Y-%m-%d") if isinstance(call_dt, datetime) else call_dt.strftime("%Y-%m-%d"),
            duration, dist_id, linked_acc, linked_case
        )
        c.execute("INSERT INTO cdr_records VALUES (?,?,?,?,?,?,?,?)", row)
        cdr_rows.append(row)

    write_csv("cdr_records.csv",
              ["cdr_id", "caller_name", "receiver_name", "call_date",
               "call_duration_seconds", "tower_district_id",
               "linked_accused_id", "linked_case_id"],
              cdr_rows)
    progress(len(cdr_rows), "cdr_records")
    conn.commit()
    return cdr_rows


# ═══════════════════════════════════════════════════════════════════
# VERIFICATION
# ═══════════════════════════════════════════════════════════════════

def verify_integrity(db_path):
    """Verify foreign key integrity and print summary stats."""
    print("\n" + "═" * 65)
    print("  INTEGRITY VERIFICATION")
    print("═" * 65)

    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    # ── Row counts ──
    tables = [
        "State", "District", "UnitType", "Unit", "Rank", "Designation",
        "Employee", "CaseCategory", "GravityOffence", "CaseStatusMaster",
        "ReligionMaster", "OccupationMaster", "CasteMaster", "Court",
        "Act", "Section", "CrimeHead", "CrimeSubHead", "CrimeHeadActSection",
        "CaseMaster", "ComplainantDetails", "Victim", "Accused",
        "ActSectionAssociation", "ArrestSurrender", "ChargesheetDetails",
        "financial_transactions", "cdr_records", "crime_syndicates",
        "syndicate_members",
    ]

    total_rows = 0
    print("\n  Table Row Counts:")
    print("  " + "─" * 50)
    for tbl in tables:
        try:
            c.execute(f"SELECT COUNT(*) FROM [{tbl}]")
            count = c.fetchone()[0]
            total_rows += count
            print(f"    {tbl:<30s} {count:>8,}")
        except Exception as e:
            print(f"    {tbl:<30s} ERROR: {e}")

    print(f"\n  {'TOTAL ROWS':<30s} {total_rows:>8,}")

    # ── FK checks ──
    print("\n  Foreign Key Checks:")
    print("  " + "─" * 50)

    fk_checks = [
        ("District.StateID", "District", "StateID", "State", "StateID"),
        ("Unit.TypeID", "Unit", "TypeID", "UnitType", "UnitTypeID"),
        ("Unit.StateID", "Unit", "StateID", "State", "StateID"),
        ("Unit.DistrictID", "Unit", "DistrictID", "District", "DistrictID"),
        ("Employee.DistrictID", "Employee", "DistrictID", "District", "DistrictID"),
        ("Employee.UnitID", "Employee", "UnitID", "Unit", "UnitID"),
        ("Employee.RankID", "Employee", "RankID", "Rank", "RankID"),
        ("Employee.DesignationID", "Employee", "DesignationID", "Designation", "DesignationID"),
        ("Court.DistrictID", "Court", "DistrictID", "District", "DistrictID"),
        ("CaseMaster.PolicePersonID", "CaseMaster", "PolicePersonID", "Employee", "EmployeeID"),
        ("CaseMaster.PoliceStationID", "CaseMaster", "PoliceStationID", "Unit", "UnitID"),
        ("CaseMaster.CaseCategoryID", "CaseMaster", "CaseCategoryID", "CaseCategory", "CaseCategoryID"),
        ("CaseMaster.GravityOffenceID", "CaseMaster", "GravityOffenceID", "GravityOffence", "GravityOffenceID"),
        ("CaseMaster.CrimeMajorHeadID", "CaseMaster", "CrimeMajorHeadID", "CrimeHead", "CrimeHeadID"),
        ("CaseMaster.CrimeMinorHeadID", "CaseMaster", "CrimeMinorHeadID", "CrimeSubHead", "CrimeSubHeadID"),
        ("CaseMaster.CaseStatusID", "CaseMaster", "CaseStatusID", "CaseStatusMaster", "CaseStatusID"),
        ("ComplainantDetails.CaseMasterID", "ComplainantDetails", "CaseMasterID", "CaseMaster", "CaseMasterID"),
        ("ComplainantDetails.OccupationID", "ComplainantDetails", "OccupationID", "OccupationMaster", "OccupationID"),
        ("ComplainantDetails.ReligionID", "ComplainantDetails", "ReligionID", "ReligionMaster", "ReligionID"),
        ("ComplainantDetails.CasteID", "ComplainantDetails", "CasteID", "CasteMaster", "caste_master_id"),
        ("Victim.CaseMasterID", "Victim", "CaseMasterID", "CaseMaster", "CaseMasterID"),
        ("Accused.CaseMasterID", "Accused", "CaseMasterID", "CaseMaster", "CaseMasterID"),
        ("ActSectionAssociation.CaseMasterID", "ActSectionAssociation", "CaseMasterID", "CaseMaster", "CaseMasterID"),
        ("ArrestSurrender.CaseMasterID", "ArrestSurrender", "CaseMasterID", "CaseMaster", "CaseMasterID"),
        ("ArrestSurrender.AccusedMasterID", "ArrestSurrender", "AccusedMasterID", "Accused", "AccusedMasterID"),
        ("ArrestSurrender.IOID", "ArrestSurrender", "IOID", "Employee", "EmployeeID"),
        ("ArrestSurrender.CourtID", "ArrestSurrender", "CourtID", "Court", "CourtID"),
        ("ChargesheetDetails.CaseMasterID", "ChargesheetDetails", "CaseMasterID", "CaseMaster", "CaseMasterID"),
        ("ChargesheetDetails.PolicePersonID", "ChargesheetDetails", "PolicePersonID", "Employee", "EmployeeID"),
        ("syndicate_members.syndicate_id", "syndicate_members", "syndicate_id", "crime_syndicates", "syndicate_id"),
        ("syndicate_members.accused_master_id", "syndicate_members", "accused_master_id", "Accused", "AccusedMasterID"),
    ]

    pass_count = 0
    fail_count = 0

    for label, child_tbl, child_col, parent_tbl, parent_col in fk_checks:
        try:
            query = f"""
                SELECT COUNT(*) FROM [{child_tbl}] ct
                WHERE ct.[{child_col}] IS NOT NULL
                AND ct.[{child_col}] NOT IN (SELECT [{parent_col}] FROM [{parent_tbl}])
            """
            c.execute(query)
            orphans = c.fetchone()[0]
            if orphans == 0:
                print(f"    ✓ PASS  {label}")
                pass_count += 1
            else:
                print(f"    ✗ FAIL  {label}  ({orphans} orphan rows)")
                fail_count += 1
        except Exception as e:
            print(f"    ✗ ERROR {label}: {e}")
            fail_count += 1

    print(f"\n  FK Results: {pass_count} PASS, {fail_count} FAIL")

    # ── Top 5 syndicates by case count ──
    print("\n  Top 5 Syndicates by Case Count:")
    print("  " + "─" * 50)
    try:
        c.execute("""
            SELECT syndicate_name, total_cases, total_members
            FROM crime_syndicates
            ORDER BY total_cases DESC LIMIT 5
        """)
        for row in c.fetchall():
            print(f"    {row[0]:<45s} {row[1]:>4} cases, {row[2]:>3} members")
    except Exception as e:
        print(f"    Error: {e}")

    # ── Top 5 most wanted accused ──
    print("\n  Top 5 Most Wanted Accused (most cases):")
    print("  " + "─" * 50)
    try:
        c.execute("""
            SELECT AccusedName, COUNT(DISTINCT CaseMasterID) as case_count
            FROM Accused
            GROUP BY AccusedName
            ORDER BY case_count DESC
            LIMIT 5
        """)
        for row in c.fetchall():
            print(f"    {row[0]:<40s} {row[1]:>4} cases")
    except Exception as e:
        print(f"    Error: {e}")

    conn.close()
    return pass_count, fail_count, total_rows


# ═══════════════════════════════════════════════════════════════════
# MAIN EXECUTION
# ═══════════════════════════════════════════════════════════════════

case_metadata_global = []  # Module-level reference for syndicate member gen

def main():
    global case_metadata_global

    print("╔══════════════════════════════════════════════════════════════════╗")
    print("║  PROJECT SENTINAL v2 — Data Generation Starting...             ║")
    print("╚══════════════════════════════════════════════════════════════════╝")
    print(f"  Output: {OUTPUT_DIR}")
    print(f"  Seed:   {SEED}")
    print()

    # Remove old DB if exists
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)

    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=OFF")
    conn.execute("PRAGMA cache_size=10000")

    # ── Create schema ──
    create_tables(conn)

    # ── Step 1: Lookups ──
    sub_head_lookup = generate_lookup_tables(conn)

    # ── Step 1b: Units ──
    station_units, district_hq_map = generate_units(conn)

    # ── Step 1c: Courts ──
    court_by_district = generate_courts(conn)

    # ── Step 1d: Employees ──
    emp_rows, emp_by_district, top_officers, other_officers = generate_employees(
        conn, station_units
    )

    # ── Step 2: Citizen pool ──
    citizens = generate_citizen_pool()

    # ── Step 3: Syndicates ──
    syndicate_member_citizens = generate_syndicates(conn, citizens)

    # ── Step 4: Cases ──
    case_metadata = generate_cases(
        conn, station_units, citizens, syndicate_member_citizens,
        sub_head_lookup, court_by_district, top_officers, other_officers,
        emp_by_district
    )
    case_metadata_global = case_metadata

    # ── Step 5: Connected tables ──
    comp_rows = generate_complainants(conn, case_metadata, citizens)
    victim_rows = generate_victims(conn, case_metadata, citizens)
    accused_rows, accused_by_case, accused_citizen_map = generate_accused(
        conn, case_metadata, citizens, syndicate_member_citizens
    )
    asa_rows = generate_act_section_assoc(conn, case_metadata)
    arrest_rows = generate_arrests(
        conn, case_metadata, accused_by_case, station_units,
        court_by_district, emp_by_district, top_officers
    )
    cs_rows = generate_chargesheets(conn, case_metadata, top_officers, emp_by_district)
    member_rows = generate_syndicate_members(
        conn, syndicate_member_citizens, accused_rows, citizens
    )

    # ── Step 6: Intelligence ──
    txn_rows = generate_financial_transactions(
        conn, accused_rows, accused_by_case, case_metadata, citizens
    )
    cdr_rows = generate_cdr_records(
        conn, accused_rows, accused_by_case, case_metadata, citizens
    )

    conn.close()

    # ── Summary ──
    elapsed = time.time() - START_TIME
    print("\n" + "═" * 65)
    print(f"  ✅ GENERATION COMPLETE in {elapsed:.1f} seconds")
    print(f"  📁 SQLite: {DB_PATH}")
    print(f"  📁 CSVs:   {CSV_DIR}")
    print("═" * 65)

    # ── Verify ──
    passes, fails, total = verify_integrity(DB_PATH)
    print(f"\n  🏁 Final: {total:,} total rows | {passes} FK checks passed | {fails} FK checks failed")
    print()


if __name__ == "__main__":
    main()
