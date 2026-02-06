const API_KEY = process.env.FMP_API_KEY;
const BASE = "https://financialmodelingprep.com";

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) return null;
  try { return await r.json(); } catch { return null; }
}

export default async function handler(req, res) {
  try {
    const constituents = await fetchJSON(`${BASE}/stable/sp500-constituent?apikey=${API_KEY}`);
    if (!Array.isArray(constituents) || !constituents.length) {
      return res.status(500).json({ error: 'Failed to fetch S&P 500 constituents' });
    }

    const symbols = constituents.map(c => c.symbol).filter(Boolean);
    const CHUNK = 200;
    const chunks = [];
    for (let i = 0; i < symbols.length; i += CHUNK) {
      chunks.push(symbols.slice(i, i + CHUNK).join(","));
    }

    const quotes = [];
    const results = await Promise.allSettled(chunks.map(c =>
      fetchJSON(`${BASE}/stable/batch-quote?symbols=${c}&apikey=${API_KEY}`)
    ));
    for (const r of results) {
      if (r.status === 'fulfilled' && Array.isArray(r.value)) quotes.push(...r.value);
    }

    const quoteMap = {};
    for (const q of quotes) {
      if (q.symbol) quoteMap[q.symbol] = q;
    }

    const sectors = {};
    for (const c of constituents) {
      const q = quoteMap[c.symbol];
      if (!q) continue;
      const sector = c.sector || 'Other';
      if (!sectors[sector]) sectors[sector] = { name: sector, stocks: [], totalMcap: 0 };
      const mcap = q.marketCap || 0;
      const chg = q.changePercentage ?? q.changesPercentage ?? 0;
      sectors[sector].stocks.push({
        ticker: c.symbol,
        name: c.name || c.symbol,
        sector,
        mcap,
        change: chg,
        price: q.price ?? 0,
        volume: q.volume ?? 0
      });
      sectors[sector].totalMcap += mcap;
    }

    for (const s of Object.values(sectors)) {
      s.stocks.sort((a, b) => b.mcap - a.mcap);
    }

    const result = Object.values(sectors).sort((a, b) => b.totalMcap - a.totalMcap);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
}
