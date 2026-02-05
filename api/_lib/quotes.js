const API_KEY = process.env.FMP_API_KEY;
const BASE = "https://financialmodelingprep.com";

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) return null;
  try { return await r.json(); } catch { return null; }
}

async function batchQuote(symbols) {
  const CHUNK = 200;
  const chunks = [];
  for (let i = 0; i < symbols.length; i += CHUNK) {
    chunks.push(symbols.slice(i, i + CHUNK).join(","));
  }
  const all = [];
  for (let i = 0; i < chunks.length; i += 10) {
    const batch = chunks.slice(i, i + 10);
    const results = await Promise.allSettled(batch.map(c =>
      fetchJSON(`${BASE}/stable/batch-quote?symbols=${c}&apikey=${API_KEY}`)
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
  // Strategy 1: batch-exchange-quote (fastest if available)
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

  // Strategy 2: S&P 500 + NASDAQ 100 constituents → batch-quote (~600 stocks, ~8 API calls)
  try {
    const [sp500, nasdaq100] = await Promise.all([
      fetchJSON(`${BASE}/stable/sp500-constituent?apikey=${API_KEY}`),
      fetchJSON(`${BASE}/stable/nasdaq-constituent?apikey=${API_KEY}`)
    ]);
    const combined = [...(sp500 || []), ...(nasdaq100 || [])];
    const symbols = [...new Set(combined.map(s => s.symbol).filter(Boolean))];
    if (symbols.length > 50) {
      return await batchQuote(symbols);
    }
  } catch {}

  // Strategy 3: company-screener for broader coverage
  try {
    const stocks = await fetchJSON(`${BASE}/stable/company-screener?exchange=NYSE,NASDAQ&isActivelyTrading=true&limit=5000&apikey=${API_KEY}`);
    if (Array.isArray(stocks) && stocks.length > 50) {
      const symbols = stocks.map(s => s.symbol).filter(Boolean);
      return await batchQuote(symbols);
    }
  } catch {}

  return [];
}
