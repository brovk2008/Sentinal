import json
import os
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
NARRATIVES_PATH = BASE_DIR / "backend" / "data" / "investigation_narratives.json"
DATASET_PATH = Path("C:/Users/techp/Downloads/more projects/FIR ocr/master_dataset.jsonl")

def main():
    print("Reading and parsing new FIR dataset...")
    if not DATASET_PATH.exists():
        print(f"[ERROR] Source dataset not found at {DATASET_PATH}")
        return

    # Load existing narratives
    existing_narratives = []
    if NARRATIVES_PATH.exists():
        with open(NARRATIVES_PATH, "r", encoding="utf-8") as f:
            existing_narratives = json.load(f)
        # Filter out previously added fir_records to keep it idempotent
        existing_narratives = [n for n in existing_narratives if n.get("type") != "fir_record"]

    # Read master_dataset.jsonl and parse up to 500 valid records
    new_records = []
    count = 0
    max_records = 500

    with open(DATASET_PATH, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            if count >= max_records:
                break
            line = line.strip()
            if not line:
                continue
            try:
                item = json.loads(line)
                meta = item.get("metadata", {})
                
                # Check required fields
                if not meta or not item.get("raw_text"):
                    continue
                
                raw_text = item["raw_text"]
                # Limit raw_text size for summary to keep embedding size reasonable
                summary = raw_text[:3000] + ("\n... [TRUNCATED]" if len(raw_text) > 3000 else "")

                # Structure entities
                entities = {
                    "accused": meta.get("accused", []),
                    "cases": [meta.get("crime_no", "Unknown")],
                    "districts": [meta.get("district", "Unknown")],
                    "sections": meta.get("sections", []),
                    "amount_involved": 0.0
                }

                # Construct new narrative structure
                new_narrative = {
                    "narrative_id": 1000 + count,  # Distinct ID range for FIR records
                    "type": "fir_record",
                    "title": f"FIR {meta.get('crime_no', 'Unknown')} - {meta.get('ps', 'Unknown')} ({meta.get('district', 'Unknown')})",
                    "summary": summary,
                    "entities": entities,
                    "metadata": {
                        "date_range": meta.get("fir_date", ""),
                        "crime_head": meta.get("acts", ["Unknown"])[0] if meta.get("acts") else "Unknown",
                        "status": "Registered"
                    }
                }
                
                new_records.append(new_narrative)
                count += 1
            except Exception as e:
                # Skip malformed lines
                continue

    print(f"Parsed {len(new_records)} new FIR records from dataset.")

    # Combine and save
    all_narratives = existing_narratives + new_records
    with open(NARRATIVES_PATH, "w", encoding="utf-8") as f:
        json.dump(all_narratives, f, indent=2, ensure_ascii=False)

    print(f"Saved {len(all_narratives)} total narratives to {NARRATIVES_PATH}")

if __name__ == "__main__":
    main()
