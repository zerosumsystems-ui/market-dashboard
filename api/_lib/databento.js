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

// Parse NDJSON response — extract symbol mappings from metadata + data records
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
            if (interval.symbol != null && m.raw_symbol) {
              symbolMap[String(interval.symbol)] = m.raw_symbol;
            }
          }
        }
        continue;
      }
      // Skip non-data records (SymbolMapping=20, InstrumentDef=19, Error=21, System=22)
      const rtype = obj.hd?.rtype ?? obj.rtype;
      if (rtype === 19 || rtype === 20 || rtype === 21 || rtype === 22) continue;
      // Push any line that has OHLCV data fields
      if (rtype != null || obj.open != null) records.push(obj);
    } catch {}
  }
  return { symbolMap, records };
}

// Resolve raw_symbol → instrument_id via Databento symbology API
async function resolveSymbols({ dataset, symbols, start, end }) {
  const body = new URLSearchParams({
    dataset,
    symbols: Array.isArray(symbols) ? symbols.join(',') : symbols,
    stype_in: 'raw_symbol',
    stype_out: 'instrument_id',
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
  const idToSymbol = {};
  for (const [sym, mappings] of Object.entries(data.result || {})) {
    for (const m of Array.isArray(mappings) ? mappings : []) {
      if (m.s != null) idToSymbol[String(m.s)] = sym;
    }
  }
  return idToSymbol;
}

// Build a normalized record from either CSV row or JSON object
function buildRecord(row, sym, isPretty, isJson) {
  let open, high, low, close, volume, tsEvent, instrumentId;

  if (isJson) {
    open = Number(row.open);
    high = Number(row.high);
    low = Number(row.low);
    close = Number(row.close);
    volume = Number(row.volume) || 0;
    tsEvent = String(row.hd?.ts_event ?? row.ts_event);
    instrumentId = String(row.hd?.instrument_id ?? row.instrument_id);
  } else {
    open = isPretty ? Math.round(Number(row.open) * 1e9) : Number(row.open);
    high = isPretty ? Math.round(Number(row.high) * 1e9) : Number(row.high);
    low = isPretty ? Math.round(Number(row.low) * 1e9) : Number(row.low);
    close = isPretty ? Math.round(Number(row.close) * 1e9) : Number(row.close);
    volume = Number(row.volume) || 0;
    tsEvent = row.ts_event;
    instrumentId = String(row.instrument_id);
    if (tsEvent && isNaN(Number(tsEvent))) {
      tsEvent = String(new Date(tsEvent).getTime() * 1e6);
    }
  }

  return {
    hd: { ts_event: tsEvent, instrument_id: instrumentId },
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
  // Databento Historical data is T+1; clamp end to yesterday (available_end)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const clampedEnd = end > yesterday ? yesterday : end;

  const params = { schema, symbols, start, end: clampedEnd, dataset: dataset || DATASET };
  const key = cacheKey(params);
  const cached = cacheGet(key);
  if (cached) return cached;

  const symbolList = Array.isArray(symbols) ? symbols : symbols.split(',');
  const isAllSymbols = symbolList.length === 1 && symbolList[0] === 'ALL_SYMBOLS';
  const isSingleKnownSymbol = symbolList.length === 1 && !isAllSymbols;

  // Use JSON for ALL_SYMBOLS (includes symbol mappings inline),
  // CSV for specific symbols (simpler, proven)
  const encoding = isAllSymbols ? 'json' : 'csv';

  const body = new URLSearchParams({
    dataset: params.dataset,
    schema,
    symbols: symbolList.join(','),
    start,
    end: clampedEnd,
    encoding,
    stype_in: 'raw_symbol',
    stype_out: 'instrument_id',
  });

  // Fetch data (and symbol mapping in parallel for multi-symbol CSV requests)
  const [r, preResolvedMap] = await Promise.all([
    fetch(`${HIST_BASE}/timeseries.get_range`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    }),
    !isSingleKnownSymbol && !isAllSymbols && symbolList.length > 1
      ? resolveSymbols({ dataset: params.dataset, symbols: symbolList, start, end: clampedEnd })
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

  let allRecords;

  if (isAllSymbols) {
    // JSON path: parse NDJSON, extract symbol mappings from metadata
    const { symbolMap, records } = parseNDJSON(text);
    allRecords = records.map(rec => {
      const id = String(rec.hd?.instrument_id);
      const sym = symbolMap[id] || '';
      return buildRecord(rec, sym, false, true);
    });
  } else {
    // CSV path: parse rows, resolve symbols
    const rows = parseCSV(text);
    if (rows.length === 0) {
      throw new Error(`No CSV data rows. Headers: ${text.split('\n')[0]}`);
    }
    const sampleOpen = Number(rows[0].open);
    const isPretty = sampleOpen < 1e8;
    const idToSymbol = preResolvedMap;

    allRecords = rows.map(row => {
      const id = String(row.instrument_id);
      const sym = isSingleKnownSymbol ? symbolList[0] : (idToSymbol?.[id] || '');
      return buildRecord(row, sym, isPretty, false);
    });
  }

  const result = dedup(allRecords);
  cacheSet(key, result);
  return result;
}
