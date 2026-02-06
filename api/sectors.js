const API_KEY = process.env.FMP_API_KEY;
const BASE = "https://financialmodelingprep.com";

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) return null;
  try { return await r.json(); } catch { return null; }
}

export default async function handler(req, res) {
  try {
    const data = await fetchJSON(`${BASE}/stable/sector-performance?apikey=${API_KEY}`);
    if (Array.isArray(data) && data.length > 0) {
      return res.json(data.map(s => ({
        sector: s.sector,
        change: parseFloat(s.changesPercentage) || 0
      })).sort((a, b) => b.change - a.change));
    }

    // Fallback: compute from screener data
    const screener = await fetchJSON(`${BASE}/stable/company-screener?exchange=NYSE,NASDAQ&isActivelyTrading=true&limit=5000&apikey=${API_KEY}`);
    if (!Array.isArray(screener)) return res.json([]);

    const symbols = screener.map(s => s.symbol).filter(Boolean);
    const CHUNK = 200;
    const chunks = [];
    for (let i = 0; i < symbols.length; i += CHUNK) {
      chunks.push(symbols.slice(i, i + CHUNK).join(","));
    }

    const quotes = [];
    for (let i = 0; i < chunks.length; i += 10) {
      const batch = chunks.slice(i, i + 10);
      const results = await Promise.allSettled(batch.map(c =>
        fetchJSON(`${BASE}/stable/batch-quote?symbols=${c}&apikey=${API_KEY}`)
      ));
      for (const r of results) {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) quotes.push(...r.value);
      }
    }

    const quoteMap = {};
    for (const q of quotes) { if (q.symbol) quoteMap[q.symbol] = q; }

    const sectorData = {};
    for (const s of screener) {
      const q = quoteMap[s.symbol];
      if (!q || !s.sector) continue;
      if (!sectorData[s.sector]) sectorData[s.sector] = { total: 0, count: 0 };
      const chg = q.changePercentage ?? q.changesPercentage ?? 0;
      sectorData[s.sector].total += chg;
      sectorData[s.sector].count++;
    }

    const result = Object.entries(sectorData).map(([sector, d]) => ({
      sector,
      change: +(d.total / d.count).toFixed(2)
    })).sort((a, b) => b.change - a.change);

    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
}
