const API_KEY = process.env.POLYGON_API_KEY;

export default async function handler(req, res) {
  try {
    const tk = req.query.ticker || "SPY";
    const ago = new Date(); ago.setDate(ago.getDate()-50);
    const from = ago.toISOString().slice(0,10);
    const to = new Date().toISOString().slice(0,10);
    const r = await fetch(`https://api.polygon.io/v2/aggs/ticker/${tk}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=5000&apiKey=${API_KEY}`);
    const data = await r.json();
    res.json({ticker:tk, results:(data.results||[]).map(r=>({date:new Date(r.t).toISOString().slice(0,10),close:r.c}))});
  } catch(e) { res.status(500).json({error:e.message}); }
}
