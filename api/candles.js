const API_KEY = process.env.FMP_API_KEY;
const BASE = "https://financialmodelingprep.com";

export default async function handler(req, res) {
  try {
    const tickers = (req.query.tickers || "SPY").split(",").slice(0, 21);
    const days = parseInt(req.query.days) || 90;
    const ago = new Date(); ago.setDate(ago.getDate() - days - 20);
    const from = ago.toISOString().slice(0, 10);
    const to = new Date().toISOString().slice(0, 10);

    const results = await Promise.all(tickers.map(async tk => {
      try {
        const r = await fetch(`${BASE}/stable/historical-price-eod/full?symbol=${tk}&from=${from}&to=${to}&apikey=${API_KEY}`);
        const d = await r.json();
        const hist = (d.historical || []).slice().reverse();
        return {
          ticker: tk,
          candles: hist.slice(-days).map(h => ({
            t: new Date(h.date).getTime(), o: h.open, h: h.high, l: h.low, c: h.close, v: h.volume
          }))
        };
      } catch (e) { return { ticker: tk, candles: [] }; }
    }));

    res.json(results);
  } catch (e) { res.status(500).json({ error: e.message }); }
}
