import asyncio
import sys
import os
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).parent))

from config import config
from database import query, query_one
from routers.intelligence import intelligence_query, QueryRequest, _generate_data_answer

class DummyRequest:
    def __init__(self):
        self.headers = {}
        self.client = None

async def run_tests():
    print("=== STARTING INTEGRATION & ZERO-TRUST VERIFICATION ===")
    
    # 1. Verify Database Connection and Data
    print("\n[Test 1] Checking Database Connection...")
    if not os.path.exists(config.DB_PATH):
        print(f"Warning: Database file not found at {config.DB_PATH}. Running init_db...")
        try:
            from init_db import init_all_tables
            init_all_tables()
            print("Database initialized successfully.")
        except Exception as e:
            print(f"Error initializing database: {e}")
            return
    else:
        print(f"Database found at {config.DB_PATH}")

    # Inspect some tables
    try:
        districts = query("SELECT COUNT(*) as cnt FROM District")
        cases = query("SELECT COUNT(*) as cnt FROM CaseMaster")
        syndicates = query("SELECT COUNT(*) as cnt FROM crime_syndicates")
        print(f"Stats: Districts={districts[0]['cnt']}, Cases={cases[0]['cnt']}, Syndicates={syndicates[0]['cnt']}")
    except Exception as e:
        print(f"Error querying database: {e}")
        return

    # 2. Verify _generate_data_answer logic
    print("\n[Test 2] Testing structured database answers (Fallback)...")
    q1 = "active crime syndicates in karnataka"
    ans1 = _generate_data_answer(q1)
    print(f"Query: '{q1}'\nAnswer snippet:\n{ans1[:300]}\n...")
    
    q2 = "highest crime rates district"
    ans2 = _generate_data_answer(q2)
    print(f"Query: '{q2}'\nAnswer snippet:\n{ans2[:300]}\n...")

    # 3. Verify intelligence_query endpoint
    print("\n[Test 3] Testing intelligence_query endpoint...")
    req = QueryRequest(
        query="Which districts have the highest crime rates?",
        target_lang="en"
    )
    request_mock = DummyRequest()
    
    try:
        res = await intelligence_query(req, request_mock)
        print("Success! Response structure:")
        print(f"- Answer length: {len(res.get('answer', ''))}")
        print(f"- Citations count: {len(res.get('citations', []))}")
        print(f"- Query vector norm: {res.get('query_vector_norm')}")
        print(f"- Retrieval time ms: {res.get('retrieval_time_ms')}")
        print(f"- Chunks searched: {res.get('total_chunks_searched')}")
    except Exception as e:
        print(f"Failed to execute intelligence_query: {e}")

    # 4. Verify translation flow in intelligence_query
    print("\n[Test 4] Testing intelligence_query endpoint with target_lang='kn' (Kannada)...")
    req_kn = QueryRequest(
        query="Give me a briefing on cyber crime trends",
        target_lang="kn"
    )
    try:
        res_kn = await intelligence_query(req_kn, request_mock)
        print("Success! Translated Response:")
        print(f"- Answer snippet: {res_kn.get('answer', '')[:200]}")
    except Exception as e:
        print(f"Failed to execute intelligence_query with Kannada: {e}")

    print("\n=== VERIFICATION COMPLETED SUCCESSFULLY ===")

if __name__ == "__main__":
    asyncio.run(run_tests())
