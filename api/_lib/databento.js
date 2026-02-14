const API_KEY = process.env.DATABENTO_API_KEY;
const HIST_BASE = "https://hist.databento.com/v0";
const DATASET = "DBEQ.BASIC";

// In-memory cache (survives warm starts, ~2 min TTL)
const _cache = new Map();
const CACHE_TTL = 2 * 60 * 1000;

function cacheKey(params) {
  return JSON.stringify(params);
}

function cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { _cache.delete(key); return null; }
  return entry.data;
}

function cacheSet(key, data) {
  // Limit cache size to prevent memory leaks
  if (_cache.size > 20) _cache.clear();
  _cache.set(key, { data, ts: Date.now() });
}

function authHeader() {
  if (!API_KEY) throw new Error('DATABENTO_API_KEY is not configured');
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
      // Metadata object: extract instrument_id → raw_symbol from mappings
      if (obj.mappings && Array.isArray(obj.mappings)) {
        for (const m of obj.mappings) {
          for (const interval of m.intervals || []) {
            if (interval.symbol && m.raw_symbol) {
              symbolMap[interval.symbol] = m.raw_symbol;
            }
          }
        }
        continue;
      }
      const rtype = obj.hd?.rtype;
      if (rtype === 20) {
        // SymbolMappingMsg
        const sym = obj.stype_in_symbol || '';
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
  // Databento Historical data is T+1; clamp end to today so we don't overshoot
  const today = new Date().toISOString().slice(0, 10);
  const clampedEnd = end > today ? today : end;

  const params = { schema, symbols, start, end: clampedEnd, dataset: dataset || DATASET };
  const key = cacheKey(params);
  const cached = cacheGet(key);
  if (cached) return cached;

  const body = new URLSearchParams({
    dataset: params.dataset,
    schema,
    symbols: Array.isArray(symbols) ? symbols.join(',') : symbols,
    start,
    end: clampedEnd,
    encoding: 'json',
    stype_in: 'raw_symbol',
    stype_out: 'instrument_id',
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

  const result = records.map(rec => ({
    ...rec,
    symbol: symbolMap[rec.hd?.instrument_id] || symbolMap[rec.symbol] || '',
    date: tsDate(rec.hd?.ts_event),
  }));

  cacheSet(key, result);
  return result;
}
