const API_KEY = process.env.FMP_API_KEY;
const BASE = "https://financialmodelingprep.com";

export default async function handler(req, res) {
  try {
    const tickers = (req.query.tickers || "SPY").split(",").slice(0, 9);
    const days = parseInt(req.query.days) || 90;
    const ago = new Date(); ago.setDate(ago.getDate() - days - 20);
    const from = ago.toISOString().slice(0, 10);
    const to = new Date().toISOString().slice(0, 10);

    const results = await Promise.all(tickers.map(async tk => {
      try {
        let hist = [];
        for (const suffix of ['full', 'light']) {
          const r = await fetch(`${BASE}/stable/historical-price-eod/${suffix}?symbol=${tk}&from=${from}&to=${to}&apikey=${API_KEY}`);
          if (r.ok) {
            const data = await r.json();
            if (Array.isArray(data) && data.length > 0) { hist = data; break; }
          }
        }
        hist.sort((a, b) => new Date(a.date) - new Date(b.date));
        return {
          ticker: tk,
          candles: hist.slice(-days).map(h => ({
            t: new Date(h.date).getTime(),
            o: h.open ?? h.price ?? 0,
            h: h.high ?? h.price ?? 0,
            l: h.low ?? h.price ?? 0,
            c: h.close ?? h.price ?? 0,
            v: h.volume ?? 0
          }))
        };
      } catch (e) { return { ticker: tk, candles: [] }; }
    }));

    res.json(results);
  } catch (e) { res.status(500).json({ error: e.message }); }
}
