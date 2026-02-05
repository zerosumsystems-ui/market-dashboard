const API_KEY = process.env.FMP_API_KEY;
const BASE = "https://financialmodelingprep.com";

export default async function handler(req, res) {
  try {
    const tk = req.query.ticker || "SPY";
    const ago = new Date(); ago.setDate(ago.getDate() - 50);
    const from = ago.toISOString().slice(0, 10);
    const to = new Date().toISOString().slice(0, 10);

    let hist = [];
    for (const suffix of ['full', 'light', '']) {
      const path = suffix ? `historical-price-eod/${suffix}` : 'historical-price-eod';
      const r = await fetch(`${BASE}/stable/${path}?symbol=${tk}&from=${from}&to=${to}&apikey=${API_KEY}`);
      if (r.ok) {
        const data = await r.json();
        if (Array.isArray(data) && data.length > 0) { hist = data; break; }
        if (data && Array.isArray(data.historical) && data.historical.length > 0) { hist = data.historical; break; }
      }
    }

    hist.sort((a, b) => new Date(a.date) - new Date(b.date));
    res.json({ ticker: tk, results: hist.map(h => ({ date: h.date, close: h.close ?? h.price })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
}
