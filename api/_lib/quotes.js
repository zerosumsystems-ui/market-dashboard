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
  // Run 15 concurrent requests at a time for speed
  for (let i = 0; i < chunks.length; i += 15) {
    const batch = chunks.slice(i, i + 15);
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

const US_EXCHANGES = new Set(['NYSE', 'NASDAQ', 'AMEX', 'NYSEArca', 'NYSEAMERICAN', 'NasdaqGS', 'NasdaqGM', 'NasdaqCM']);

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
        if (all.length > 1000) return all;
      }
    }
  } catch {}

  // Strategy 2: stock-list → filter US stocks → batch-quote (8000+ stocks)
  try {
    const list = await fetchJSON(`${BASE}/stable/stock-list?apikey=${API_KEY}`);
    if (Array.isArray(list) && list.length > 1000) {
      const usStocks = list.filter(s =>
        s.symbol &&
        s.type === 'stock' &&
        s.exchangeShortName &&
        US_EXCHANGES.has(s.exchangeShortName)
      );
      const symbols = [...new Set(usStocks.map(s => s.symbol))];
      if (symbols.length > 1000) {
        return await batchQuote(symbols);
      }
    }
  } catch {}

  // Strategy 3: company-screener with pagination for broad coverage
  try {
    const pages = await Promise.all([
      fetchJSON(`${BASE}/stable/company-screener?exchange=NYSE,NASDAQ,AMEX&isActivelyTrading=true&limit=5000&offset=0&apikey=${API_KEY}`),
      fetchJSON(`${BASE}/stable/company-screener?exchange=NYSE,NASDAQ,AMEX&isActivelyTrading=true&limit=5000&offset=5000&apikey=${API_KEY}`)
    ]);
    const combined = [...(pages[0] || []), ...(pages[1] || [])];
    if (combined.length > 100) {
      const symbols = [...new Set(combined.map(s => s.symbol).filter(Boolean))];
      return await batchQuote(symbols);
    }
  } catch {}

  // Strategy 4: S&P 500 + NASDAQ 100 as last resort
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

  return [];
}
