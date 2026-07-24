import asyncio, sys, logging
logging.basicConfig(level=logging.INFO)
sys.path.insert(0, ".")

async def test():
    from routers.fir_scraper import scrape_live_fir
    print("Testing: Bagalkot (1) / Ilakal Rural PS (2189) / FIR 5 / 2024")
    result = await scrape_live_fir("1", "2189", "5", "2024")
    if result:
        print("SUCCESS! Found FIR")
        meta = result.get("fir_metadata", {})
        print("Metadata:", meta)
        b64 = result.get("pdf_b64", "")
        print("PDF b64 length:", len(b64))
    else:
        print("FAILED - returned None, checking why...")

asyncio.run(test())
