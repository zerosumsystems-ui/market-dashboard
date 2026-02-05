const API_KEY = process.env.POLYGON_API_KEY;

export default async function handler(req, res) {
  try {
    const tickers = (req.query.tickers || "SPY").split(",").slice(0, 21);
    const days = parseInt(req.query.days) || 90;
    const ago = new Date(); ago.setDate(ago.getDate() - days - 20);
    const from = ago.toISOString().slice(0, 10);
    const to = new Date().toISOString().slice(0, 10);

    const results = await Promise.all(tickers.map(async tk => {
      try {
        const r = await fetch(`https://api.polygon.io/v2/aggs/ticker/${tk}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=5000&apiKey=${API_KEY}`);
        const d = await r.json();
        return {
          ticker: tk,
          candles: (d.results || []).slice(-days).map(c => ({
            t: c.t, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v
          }))
        };
      } catch (e) { return { ticker: tk, candles: [] }; }
    }));

    res.json(results);
  } catch (e) { res.status(500).json({ error: e.message }); }
}
