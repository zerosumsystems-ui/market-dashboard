const API_KEY = process.env.FMP_API_KEY;
const BASE = "https://financialmodelingprep.com";

async function fetchJSON(url) {
  const r = await fetch(url);
  const text = await r.text();
  try { return JSON.parse(text); } catch { return null; }
}

export async function getAllQuotes() {
  // Try batch exchange quote first (2 API calls instead of 60+)
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

  // Fallback: chunked symbol list + quote batches
  const symbols = await fetchJSON(`${BASE}/stable/company-symbols-list?apikey=${API_KEY}`);
  if (!Array.isArray(symbols)) return [];
  const usStocks = symbols
    .filter(s => s.exchangeShortName === "NYSE" || s.exchangeShortName === "NASDAQ")
    .map(s => s.symbol);

  const CHUNK = 100;
  const chunks = [];
  for (let i = 0; i < usStocks.length; i += CHUNK) {
    chunks.push(usStocks.slice(i, i + CHUNK).join(","));
  }
  const results = await Promise.allSettled(chunks.map(c =>
    fetchJSON(`${BASE}/stable/quote?symbol=${c}&apikey=${API_KEY}`)
  ));
  return results
    .filter(r => r.status === 'fulfilled' && Array.isArray(r.value))
    .flatMap(r => r.value)
    .filter(Boolean);
}
