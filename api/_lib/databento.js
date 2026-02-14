const API_KEY = process.env.DATABENTO_API_KEY;
const HIST_BASE = "https://hist.databento.com/v0";
const DATASET = "DBEQ.BASIC";

function authHeader() {
  return 'Basic ' + Buffer.from(API_KEY + ':').toString('base64');
}

// Convert Databento fixed-point price (1e-9 scale) to dollars
export function px(n) {
  if (n == null || n >= 9223372036854775000) return 0; // UNDEF_PRICE sentinel
  return Number(n) / 1e9;
}

// Convert nanosecond timestamp string to YYYY-MM-DD
export function tsDate(ns) {
  return new Date(Math.floor(Number(ns) / 1e6)).toISOString().slice(0, 10);
}

// Parse NDJSON response, extract symbol mappings and data records
function parseNDJSON(text) {
  const lines = text.trim().split('\n').filter(Boolean);
  const symbolMap = {};
  const records = [];
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      const rtype = obj.hd?.rtype;
      if (rtype === 20) {
        // SymbolMappingMsg
        const sym = obj.stype_out_symbol || '';
        if (sym) symbolMap[obj.hd.instrument_id] = sym;
      } else if (rtype !== 19 && rtype !== 21 && rtype !== 22) {
        // Data record (skip InstrumentDef=19, Error=21, System=22)
        records.push(obj);
      }
    } catch {}
  }
  return { symbolMap, records };
}

// Fetch OHLCV or other schema data from Databento Historical API
export async function getRange({ schema, symbols, start, end, dataset }) {
  const body = new URLSearchParams({
    dataset: dataset || DATASET,
    schema,
    symbols: Array.isArray(symbols) ? symbols.join(',') : symbols,
    start,
    end,
    encoding: 'json',
    stype_in: 'raw_symbol',
    stype_out: 'raw_symbol',
  });

  const r = await fetch(`${HIST_BASE}/timeseries.get_range`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Databento ${r.status}: ${t}`);
  }

  const { symbolMap, records } = parseNDJSON(await r.text());

  return records.map(rec => ({
    ...rec,
    symbol: symbolMap[rec.hd?.instrument_id] || '',
    date: tsDate(rec.hd?.ts_event),
  }));
}
