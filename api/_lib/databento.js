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

// Parse CSV response into array of row objects
function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',');
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    if (values.length !== headers.length) continue;
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j];
    }
    records.push(row);
  }
  return records;
}

// Resolve symbols via Databento symbology API
async function resolveSymbols({ dataset, symbols, start, end, stypeIn, stypeOut }) {
  const body = new URLSearchParams({
    dataset,
    symbols: Array.isArray(symbols) ? symbols.join(',') : symbols,
    stype_in: stypeIn || 'raw_symbol',
    stype_out: stypeOut || 'instrument_id',
    start_date: start,
    end_date: end,
  });
  const r = await fetch(`${HIST_BASE}/symbology.resolve`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  if (!r.ok) return {};
  const data = await r.json();
  const mapping = {};
  for (const [sym, mappings] of Object.entries(data.result || {})) {
    for (const m of Array.isArray(mappings) ? mappings : []) {
      if (m.s != null) mapping[String(m.s)] = sym;
    }
  }
  return mapping;
}

// Build a normalized record from a CSV row
function buildRecord(row, sym, isPretty) {
  const open = isPretty ? Math.round(Number(row.open) * 1e9) : Number(row.open);
  const high = isPretty ? Math.round(Number(row.high) * 1e9) : Number(row.high);
  const low = isPretty ? Math.round(Number(row.low) * 1e9) : Number(row.low);
  const close = isPretty ? Math.round(Number(row.close) * 1e9) : Number(row.close);
  const volume = Number(row.volume) || 0;
  let tsEvent = row.ts_event;
  if (tsEvent && isNaN(Number(tsEvent))) {
    tsEvent = String(new Date(tsEvent).getTime() * 1e6);
  }
  return {
    hd: { ts_event: tsEvent, instrument_id: String(row.instrument_id) },
    open, high, low, close, volume,
    symbol: sym,
    date: tsDate(tsEvent),
  };
}

// Deduplicate multi-publisher rows: sum volumes, keep best-publisher prices
function dedup(allRecords) {
  const best = new Map();
  for (const rec of allRecords) {
    if (!rec.symbol) continue;
    const k = `${rec.symbol}|${rec.date}`;
    const prev = best.get(k);
    if (!prev) {
      best.set(k, { ...rec, _maxVol: rec.volume });
    } else {
      prev.volume += rec.volume;
      if (rec.volume > prev._maxVol) {
        prev.open = rec.open;
        prev.high = rec.high;
        prev.low = rec.low;
        prev.close = rec.close;
        prev._maxVol = rec.volume;
      }
    }
  }
  const result = [...best.values()];
  for (const r of result) delete r._maxVol;
  return result;
}

// Fetch OHLCV or other schema data from Databento Historical API
export async function getRange({ schema, symbols, start, end, dataset }) {
  // Databento Historical data is T+1; clamp end to yesterday
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const clampedEnd = end > yesterday ? yesterday : end;

  const ds = dataset || DATASET;
  const params = { schema, symbols, start, end: clampedEnd, dataset: ds };
  const key = cacheKey(params);
  const cached = cacheGet(key);
  if (cached) return cached;

  const symbolList = Array.isArray(symbols) ? symbols : symbols.split(',');
  const isAllSymbols = symbolList.length === 1 && symbolList[0] === 'ALL_SYMBOLS';
  const isSingleKnownSymbol = symbolList.length === 1 && !isAllSymbols;

  // Always use CSV encoding (JSON via HTTP API lacks symbol mappings)
  const body = new URLSearchParams({
    dataset: ds,
    schema,
    symbols: symbolList.join(','),
    start,
    end: clampedEnd,
    encoding: 'csv',
    stype_in: 'raw_symbol',
    stype_out: 'instrument_id',
  });

  // Fetch CSV data; for known multi-symbol lists, resolve symbols in parallel
  const [r, preResolvedMap] = await Promise.all([
    fetch(`${HIST_BASE}/timeseries.get_range`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    }),
    !isSingleKnownSymbol && !isAllSymbols
      ? resolveSymbols({ dataset: ds, symbols: symbolList, start, end: clampedEnd })
      : Promise.resolve(null),
  ]);

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Databento ${r.status}: ${t}`);
  }

  const text = await r.text();
  if (!text.trim()) {
    throw new Error('Databento returned empty response');
  }

  const rows = parseCSV(text);
  if (rows.length === 0) {
    throw new Error(`No CSV data rows. Headers: ${text.split('\n')[0]}`);
  }

  const sampleOpen = Number(rows[0].open);
  const isPretty = sampleOpen < 1e8;

  // For ALL_SYMBOLS: collect instrument_ids from CSV, resolve to symbols
  let idToSymbol = preResolvedMap;
  if (isAllSymbols) {
    const uniqueIds = [...new Set(rows.map(r => String(r.instrument_id)))];
    idToSymbol = await resolveSymbols({
      dataset: ds,
      symbols: uniqueIds.join(','),
      start,
      end: clampedEnd,
      stypeIn: 'instrument_id',
      stypeOut: 'raw_symbol',
    });
  }

  const allRecords = rows.map(row => {
    const id = String(row.instrument_id);
    const sym = isSingleKnownSymbol ? symbolList[0] : (idToSymbol?.[id] || '');
    return buildRecord(row, sym, isPretty);
  });

  const result = dedup(allRecords);
  cacheSet(key, result);
  return result;
}
