const API_KEY = process.env.FMP_API_KEY;
const BASE = "https://financialmodelingprep.com";

async function fetchJSON(url) {
  const r = await fetch(url);
  const text = await r.text();
  try { return JSON.parse(text); } catch { return null; }
}

async function batchQuote(symbols, batchSize) {
  const CHUNK = batchSize || 100;
  const chunks = [];
  for (let i = 0; i < symbols.length; i += CHUNK) {
    chunks.push(symbols.slice(i, i + CHUNK).join(","));
  }
  // Process 5 chunks at a time to avoid rate limits
  const all = [];
  for (let i = 0; i < chunks.length; i += 5) {
    const batch = chunks.slice(i, i + 5);
    const results = await Promise.allSettled(batch.map(c =>
      fetchJSON(`${BASE}/stable/quote?symbol=${c}&apikey=${API_KEY}`)
    ));
    for (const r of results) {
      if (r.status === 'fulfilled' && Array.isArray(r.value)) {
        all.push(...r.value);
      }
    }
  }
  return all.filter(Boolean);
}

export async function getAllQuotes() {
  // Strategy 1: batch-exchange-quote (2 calls, most efficient)
  try {
    const [nyseRes, nasdaqRes] = await Promise.all([
      fetch(`${BASE}/stable/batch-exchange-quote?exchange=NYSE&apikey=${API_KEY}`),
      fetch(`${BASE}/stable/batch-exchange-quote?exchange=NASDAQ&apikey=${API_KEY}`)
    ]);
    if (nyseRes.ok && nasdaqRes.ok) {
      const [nyse, nasdaq] = await Promise.all([nyseRes.json(), nasdaqRes.json()]);
      if (Array.isArray(nyse) && Array.isArray(nasdaq)) {
        const all = [...nyse, ...nasdaq].filter(q => q && q.symbol);
        if (all.length > 100) return all;
      }
    }
  } catch {}

  // Strategy 2: legacy full exchange quotes (2 calls)
  try {
    const [nyseRes, nasdaqRes] = await Promise.all([
      fetch(`${BASE}/api/v3/quotes/NYSE?apikey=${API_KEY}`),
      fetch(`${BASE}/api/v3/quotes/NASDAQ?apikey=${API_KEY}`)
    ]);
    if (nyseRes.ok && nasdaqRes.ok) {
      const [nyse, nasdaq] = await Promise.all([nyseRes.json(), nasdaqRes.json()]);
      if (Array.isArray(nyse) && Array.isArray(nasdaq)) {
        const all = [...nyse, ...nasdaq].filter(q => q && q.symbol);
        if (all.length > 100) return all;
      }
    }
  } catch {}

  // Strategy 3: symbol list + chunked quotes (limited to 3000 stocks, 5 concurrent)
  try {
    const symbols = await fetchJSON(`${BASE}/stable/company-symbols-list?apikey=${API_KEY}`);
    if (Array.isArray(symbols)) {
      const usStocks = symbols
        .filter(s => s.exchangeShortName === "NYSE" || s.exchangeShortName === "NASDAQ")
        .map(s => s.symbol)
        .slice(0, 3000);
      if (usStocks.length > 0) {
        return await batchQuote(usStocks, 100);
      }
    }
  } catch {}

  return [];
}
