const API_KEY = process.env.FMP_API_KEY;
const BASE = "https://financialmodelingprep.com";

function parseHist(data) {
  // Stable API returns array directly; legacy returns {historical: [...]}
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.historical)) return data.historical;
  return [];
}

export default async function handler(req, res) {
  try {
    const tk = req.query.ticker || "SPY";
    const ago = new Date(); ago.setDate(ago.getDate() - 50);
    const from = ago.toISOString().slice(0, 10);
    const to = new Date().toISOString().slice(0, 10);
    const r = await fetch(`${BASE}/stable/historical-price-eod?symbol=${tk}&from=${from}&to=${to}&apikey=${API_KEY}`);
    const data = await r.json();
    const hist = parseHist(data).slice().reverse();
    res.json({ ticker: tk, results: hist.map(h => ({ date: h.date, close: h.close })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
}
