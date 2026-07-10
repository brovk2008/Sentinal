"""
Ingest half of master_dataset.jsonl into the RAG knowledge base.

Writes compact FIR records to backend/data/fir_records_rag.jsonl
Run build_embeddings.py afterwards to vectorize.
"""
import json
import re
import sys
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
FIR_RAG_PATH = BASE_DIR / "backend" / "data" / "fir_records_rag.jsonl"
DEFAULT_DATASET = Path(r"C:\Users\techp\Downloads\more projects\FIR ocr\master_dataset.jsonl")


def count_lines(path: Path) -> int:
    count = 0
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            if line.strip():
                count += 1
    return count


def extract_accused_names(raw_text: str) -> list[str]:
    names = re.findall(
        r"(?:Accused|A\d+\))\s+([A-Z][A-Z\s./]+?)(?:\s+Accused|\s+Adult|\s+Common|\s+Unknown|\n)",
        raw_text or "",
    )
    cleaned = []
    for n in names:
        n = re.sub(r"\s+", " ", n.strip())
        if len(n) > 3 and n not in cleaned:
            cleaned.append(n[:80])
    return cleaned[:8]


def build_summary(item: dict) -> str:
    meta = item.get("metadata") or {}
    legal = item.get("legal") or {}
    loc = item.get("location") or {}
    raw = item.get("raw_text") or ""

    crime_no = meta.get("crime_number") or meta.get("fir_number") or "Unknown"
    ps = meta.get("circle_sub_division") or meta.get("police_station") or "Unknown PS"
    district = loc.get("village") or meta.get("district") or loc.get("district") or ""
    fir_date = meta.get("fir_date") or ""
    acts = ", ".join((legal.get("acts") or [])[:2])
    sections = ", ".join((legal.get("sections") or [])[:6])
    accused = extract_accused_names(raw)
    prop_val = (item.get("property") or {}).get("total_value_inr")

    header = (
        f"FIR {crime_no} | {ps} | {district} | Date: {fir_date} | "
        f"Acts: {acts} | Sections: {sections}"
    )
    if accused:
        header += f" | Accused: {', '.join(accused)}"
    if prop_val:
        header += f" | Property value: Rs.{prop_val}"

    body = raw[:1200]
    if len(raw) > 1200:
        body += "\n... [TRUNCATED]"
    return f"{header}\n{body}"


def parse_record(line: str, narrative_id: int) -> dict | None:
    try:
        item = json.loads(line)
    except json.JSONDecodeError:
        return None

    raw = item.get("raw_text")
    if not raw or len(raw) < 50:
        return None

    meta = item.get("metadata") or {}
    legal = item.get("legal") or {}
    loc = item.get("location") or {}
    crime_no = meta.get("crime_number") or meta.get("fir_number") or "Unknown"
    ps = meta.get("circle_sub_division") or "Unknown PS"

    return {
        "narrative_id": narrative_id,
        "type": "fir_record",
        "title": f"FIR {crime_no} — {ps}",
        "summary": build_summary(item),
        "entities": {
            "accused": extract_accused_names(raw),
            "cases": [crime_no],
            "districts": [loc.get("village") or meta.get("district") or "Karnataka"],
            "sections": legal.get("sections") or [],
        },
        "metadata": {
            "date_range": meta.get("fir_date", ""),
            "crime_head": (legal.get("acts") or ["Unknown"])[0],
            "status": "Registered",
            "source_pdf": (item.get("source") or {}).get("pdf_path", ""),
        },
    }


def main():
    dataset_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DATASET
    fraction = float(sys.argv[2]) if len(sys.argv) > 2 else 0.5

    if not dataset_path.exists():
        print(f"[ERROR] Dataset not found: {dataset_path}")
        sys.exit(1)

    total_lines = count_lines(dataset_path)
    max_records = int(total_lines * fraction)
    print(f"Dataset: {total_lines} records — ingesting {max_records} ({fraction:.0%})")

    FIR_RAG_PATH.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    skipped = 0
    narrative_id = 1_000_000

    with open(dataset_path, "r", encoding="utf-8", errors="ignore") as src, \
         open(FIR_RAG_PATH, "w", encoding="utf-8") as out:
        for line in src:
            if count >= max_records:
                break
            line = line.strip()
            if not line:
                continue
            record = parse_record(line, narrative_id)
            if not record:
                skipped += 1
                continue
            out.write(json.dumps(record, ensure_ascii=False) + "\n")
            count += 1
            narrative_id += 1
            if count % 5000 == 0:
                print(f"  ... {count} records written")

    print(f"[SUCCESS] Wrote {count} FIR records to {FIR_RAG_PATH} (skipped {skipped})")
    print("Next: python scripts/build_embeddings.py")


if __name__ == "__main__":
    main()
