const API_KEY = process.env.DATABENTO_API_KEY;
const HIST_BASE = "https://hist.databento.com/v0";
const DATASET = "DBEQ.BASIC";

function authHeader() {
  return 'Basic ' + Buffer.from(API_KEY + ':').toString('base64');
}

export default async function handler(req, res) {
  const results = {};

  // Raw diagnostic: fetch ALL_SYMBOLS as JSON and show first few lines
  try {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const start = new Date(); start.setDate(start.getDate() - 3);
    const startStr = start.toISOString().slice(0, 10);

    const body = new URLSearchParams({
      dataset: DATASET,
      schema: 'ohlcv-1d',
      symbols: 'ALL_SYMBOLS',
      start: startStr,
      end: yesterday,
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

    results.rawRequest = { status: r.status, ok: r.ok, start: startStr, end: yesterday };

    if (!r.ok) {
      results.rawError = await r.text();
    } else {
      const text = await r.text();
      const lines = text.trim().split('\n').filter(Boolean);
      results.rawResponse = {
        totalLines: lines.length,
        totalBytes: text.length,
        firstThreeLines: lines.slice(0, 3).map(line => {
          try { return JSON.parse(line); } catch { return line.substring(0, 300); }
        }),
        lastLine: (() => {
          try { return JSON.parse(lines[lines.length - 1]); } catch { return lines[lines.length - 1]?.substring(0, 300); }
        })(),
      };
    }
  } catch (e) { results.rawDiag = { error: e.message, stack: e.stack?.split('\n').slice(0, 3) }; }

  res.json(results);
}
