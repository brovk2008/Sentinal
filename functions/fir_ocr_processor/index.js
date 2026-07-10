"use strict";
/**
 * Catalyst Advanced I/O Function: fir_ocr_processor
 * ──────────────────────────────────────────────────
 * Express-based routing (required for Advanced I/O).
 * POST / — receive PDF b64 + metadata, run Zia OCR, parse, store in DataStore
 */

const catalyst = require("zcatalyst-sdk-node");
const express   = require("express");

const app = express();
app.use(express.json({ limit: "20mb" }));

// ── POST / ───────────────────────────────────────────────────────────────────
app.post("/", async (req, res) => {
  const context = req.catalyst_context || req.context;
  const catalystApp = catalyst.initialize(context || req);

  try {
    const { pdf_b64, fir_metadata = {} } = req.body || {};

    if (!pdf_b64) {
      return res.status(400).json({ success: false, error: "pdf_b64 is required" });
    }

    // ── Step 1: Zia OCR ───────────────────────────────────────────────────────
    let rawText = "";
    try {
      const ziaService = catalystApp.zia();
      const fileName = `FIR_${fir_metadata.fir_number || "UNKNOWN"}_${fir_metadata.year || "2024"}.pdf`;

      const ocrResult = await ziaService.ocr({
        file_content: pdf_b64,
        file_name: fileName,
        file_type: "application/pdf",
      });

      rawText =
        ocrResult?.data?.response?.result?.[0]?.text ||
        ocrResult?.data?.result?.[0]?.text ||
        "";
      console.log(`[OCR] Extracted ${rawText.length} chars from ${fileName}`);
    } catch (ocrErr) {
      console.error("[OCR] Zia OCR error:", ocrErr.message);
      rawText = "";
    }

    // ── Step 2: Parse FIR Fields ──────────────────────────────────────────────
    const parsed = parseFIRText(rawText, fir_metadata);

    // ── Step 3: Store in Catalyst Data Store ──────────────────────────────────
    let rowId = null;
    try {
      const datastore = catalystApp.datastore();
      const table = datastore.table("FIR_Records");

      // All 39 columns confirmed in FIR_Records table ✓
      const rowData = {
        FIR_Number:                   parsed.fir_number           || String(fir_metadata.fir_number || ""),
        Year:                         parsed.year                 || String(fir_metadata.year || ""),
        District:                     parsed.district             || String(fir_metadata.district_name || ""),
        Police_Station:               parsed.police_station       || String(fir_metadata.station_name || ""),
        Circle_SubDiv:                parsed.circle_subdivision   || "",
        FIR_Date:                     parsed.fir_date             || "",
        Crime_Number:                 parsed.crime_number         || "",
        Act_Section:                  parsed.act_section          || "",
        From_Date:                    parsed.occurrence_from_date || "",
        To_Date:                      parsed.occurrence_to_date   || "",
        Occurrence_Day:               parsed.occurrence_day       || "",
        Place_Of_Occurrence:          parsed.place_of_occurrence  || "",
        Distance_From_PS:             parsed.distance_from_ps     || "",
        Village:                      parsed.village              || "",
        Beat_Name:                    parsed.beat_name            || "",
        Complainant_Name:             parsed.complainant_name     || "",
        Complainant_Father:           parsed.complainant_father   || "",
        Complainant_Age:              parsed.complainant_age      || 0,
        Complainant_Gender:           parsed.complainant_sex      || "",
        Complainant_Religion:         parsed.complainant_religion || "",
        Complainant_Caste:            parsed.complainant_caste    || "",
        Complainant_Phone:            parsed.complainant_phone    || "",
        Complainant_Address:          parsed.complainant_address  || "",
        Court_Name:                   parsed.court_name           || "",
        Accused_JSON:                 JSON.stringify(parsed.accused  || []),
        Victims_JSON:                 JSON.stringify(parsed.victims  || []),
        Property_JSON:                JSON.stringify(parsed.property || []),
        FIR_Contents_Raw:             parsed.fir_contents         || "",
        Action_Taken:                 parsed.action_taken         || "",
        SHO_Name:                     parsed.sho_name             || "",
        PC_HC_Name:                   parsed.pc_hc_name           || "",
        Dispatch_DateTime:            parsed.dispatch_datetime    || "",
        Has_Complainant_Signature:    Boolean(parsed.has_complainant_signature),
        Has_SHO_Signature:            Boolean(parsed.has_sho_signature),
        Raw_OCR_Text:                 rawText.substring(0, 10000),
        PDF_B64:                      pdf_b64.substring(0, 50000),
        Station_ID:                   String(fir_metadata.station_id  || ""),
        District_ID:                  String(fir_metadata.district_id || ""),
        Scraped_At:                   new Date().toISOString().replace('T', ' ').substring(0, 19),
      };

      const result = await table.insertRow(rowData);
      rowId = result.ROWID;
      console.log(`[DataStore] Inserted FIR_Records row: ROWID=${rowId}`);
    } catch (dsErr) {
      console.error("[DataStore] Insert error:", dsErr.message);
    }

    return res.status(200).json({
      success: true,
      record_id: rowId,
      parsed_data: parsed,
    });

  } catch (err) {
    console.error("[fir_ocr_processor] Fatal error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── FIR Text Parser ───────────────────────────────────────────────────────────
function parseFIRText(text, meta) {
  const get = (pattern, flags = "i") => {
    try {
      const m = text.match(new RegExp(pattern, flags));
      return m ? m[1].trim() : "";
    } catch {
      return "";
    }
  };

  const parseAccused = () => {
    const accused = [];
    try {
      const section = text.match(/Details of known.*?accused([\s\S]*?)(?:Details of Victims|Particulars of Property|$)/i);
      if (!section) return accused;
      const lines = section[1].split("\n").filter(l => l.trim());
      let current = null;
      for (const line of lines) {
        const numberedRow = line.match(/^\s*(\d+)\s+(.+)/);
        if (numberedRow) {
          if (current) accused.push(current);
          current = { sl_no: parseInt(numberedRow[1]), raw: line.trim(), name: numberedRow[2].trim() };
        } else if (current) {
          current.raw += " " + line.trim();
        }
      }
      if (current) accused.push(current);
    } catch (e) { console.error("parseAccused error:", e); }
    return accused;
  };

  const parseVictims = () => {
    const victims = [];
    try {
      const section = text.match(/Details of Victims([\s\S]*?)(?:Particulars of Property|Action Taken|$)/i);
      if (!section) return victims;
      const lines = section[1].split("\n").filter(l => l.trim());
      let current = null;
      for (const line of lines) {
        const numberedRow = line.match(/^\s*(\d+)\s+(.+)/);
        if (numberedRow) {
          if (current) victims.push(current);
          current = { sl_no: parseInt(numberedRow[1]), raw: line.trim(), name: numberedRow[2].trim() };
        } else if (current) {
          current.raw += " " + line.trim();
        }
      }
      if (current) victims.push(current);
    } catch (e) { console.error("parseVictims error:", e); }
    return victims;
  };

  const ageVal = get("Age\\s*(\\d+)");

  return {
    fir_number:              meta.fir_number    || get("Crime No\\s*[:/]\\s*([\\d/]+)"),
    year:                    meta.year          || get("Year\\s*[:/]\\s*(\\d{4})"),
    district:                get("District\\s*[:/]\\s*([^\\n,]+)"),
    police_station:          get("PS\\s*[:/]\\s*([^\\n,]+)"),
    circle_subdivision:      get("Circle[/\\\\]Sub.?Division\\s*[:/]\\s*([^\\n]+)"),
    court_name:              get("Before the Honourable Court of\\s+([^\\n]+)"),
    fir_date:                get("FIR Date\\s*[:/]\\s*([\\d/]+)"),
    crime_number:            get("Crime No\\s*[:/]\\s*([\\d/]+)"),
    act_section:             get("Act\\s*&\\s*Section\\s*[:/]\\s*([^\\n]+)"),
    occurrence_from_date:    get("From Date\\s*[:/]\\s*([\\d/]+)"),
    occurrence_to_date:      get("To Date\\s*[:/]\\s*([\\d/]+)"),
    occurrence_from_time:    get("From Time\\s*[:/]\\s*([\\d:]+)"),
    occurrence_to_time:      get("To Time\\s*[:/]\\s*([\\d:]+)"),
    occurrence_day:          get("Day\\s*[:/]\\s*(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)"),
    place_of_occurrence:     get("Place of [Oo]ccur(?:e|a)nce[^\\n]*\\n([^\\n]+)"),
    distance_from_ps:        get("Distance from PS\\s*[:/]\\s*([^\\n]+)"),
    village:                 get("Village\\s*[:/]\\s*([^\\n]+)"),
    beat_name:               get("Beat Name\\s*[:/]\\s*([^\\n]+)"),
    complainant_name:        get("(?:Complainant|Name)\\s*[:/]\\s*([^\\n]+?)(?:\\s+Father|\\s+Age|$)"),
    complainant_father:      get("Father['s]*\\s*(?:Name|/Husband['s]*\\s*Name)\\s*[:/]\\s*([^\\n]+)"),
    complainant_age:         ageVal ? parseInt(ageVal) : null,
    complainant_sex:         get("Sex\\s*[:/]\\s*(Male|Female|Transgender)"),
    complainant_religion:    get("Religion\\s*[:/]?\\s*(\\S+)"),
    complainant_caste:       get("Caste\\s*[:/]?\\s*(\\S+)"),
    complainant_occupation:  get("Occupation\\s*[:/]?\\s*([^\\n:]+)"),
    complainant_phone:       get("Phone(?:\\s*No\\.?)?\\s*[:/]?\\s*([\\d]{10})"),
    complainant_nationality: get("Nationality\\s*[:/]\\s*(\\S+)"),
    complainant_address:     get("Address\\s*[:/]\\s*([^\\n]+)"),
    fir_contents:            get("F\\.?I\\.?R\\.?\\s*Contents[^\\n]*\\n([\\s\\S]*?)(?:Action Taken|Accused|$)"),
    action_taken:            get("Action Taken\\s*[:/]\\s*([^\\n]+)"),
    sho_name:                get("(?:Name of SHO|SHO Name)\\s*[:/]\\s*([^\\n]+)"),
    pc_hc_name:              get("PC\\/HC[^\\n]*[:/]\\s*([^\\n]+)"),
    dispatch_datetime:       get("Date and time of dispatch[^\\n]*[:/]\\s*([^\\n]+)"),
    has_complainant_signature: /Signature[\/\\]?Thumb\s*impression/i.test(text),
    has_sho_signature:       /Signature\s+of\s+the\s+SHO/i.test(text),
    accused:                 parseAccused(),
    victims:                 parseVictims(),
    property:                [],
  };
}

module.exports = app;
