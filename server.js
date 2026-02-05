import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.POLYGON_API_KEY || "YOUR_POLYGON_API_KEY";
const BASE = "https://api.polygon.io";

async function polygonGet(endpoint) {
  const sep = endpoint.includes("?") ? "&" : "?";
  const url = `${BASE}${endpoint}${sep}apiKey=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Polygon ${res.status}`);
  return res.json();
}

function tradingDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - Math.ceil(n * 1.45));
  return d.toISOString().slice(0, 10);
}

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/indices", async (req, res) => {
  try {
    const tickers = ["SPY","QQQ","DIA","IWM"];
    const data = await polygonGet(`/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${tickers.join(",")}`);
    res.json((data.tickers||[]).map(t=>({
      ticker:t.ticker,
      name:{SPY:"S&P 500",QQQ:"NASDAQ 100",DIA:"DOW 30",IWM:"Russell 2000"}[t.ticker]||t.ticker,
      price:t.day?.c??t.lastTrade?.p??0, open:t.day?.o??0, high:t.day?.h??0, low:t.day?.l??0,
      volume:t.day?.v??0, change:t.todaysChange??0, changePerc:t.todaysChangePerc??0, prevClose:t.prevDay?.c??0
    })));
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.get("/api/movers/:direction", async (req, res) => {
  try {
    const dir = req.params.direction==="losers"?"losers":"gainers";
    const data = await polygonGet(`/v2/snapshot/locale/us/markets/stocks/${dir}`);
    res.json((data.tickers||[]).slice(0,15).map(t=>({
      ticker:t.ticker, price:t.day?.c??t.lastTrade?.p??0,
      change:t.todaysChange??0, changePerc:t.todaysChangePerc??0, volume:t.day?.v??0
    })));
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.get("/api/breadth/distribution", async (req, res) => {
  try {
    const data = await polygonGet(`/v2/snapshot/locale/us/markets/stocks/tickers`);
    const tickers = data.tickers||[];
    const buckets = {down10plus:0,down5to10:0,down2to5:0,down0to2:0,up0to2:0,up2to5:0,up5to10:0,up10plus:0};
    let total=0,up4=0,down4=0,up8=0,down8=0;
    for (const t of tickers) {
      const pct=t.todaysChangePerc; if(pct==null||!t.day?.v) continue; total++;
      if(pct>=4)up4++; if(pct<=-4)down4++; if(pct>=8)up8++; if(pct<=-8)down8++;
      if(pct<=-10)buckets.down10plus++; else if(pct<=-5)buckets.down5to10++;
      else if(pct<=-2)buckets.down2to5++; else if(pct<0)buckets.down0to2++;
      else if(pct<2)buckets.up0to2++; else if(pct<5)buckets.up2to5++;
      else if(pct<10)buckets.up5to10++; else buckets.up10plus++;
    }
    res.json({
      date:new Date().toISOString().slice(0,10), universe:total,
      up4,down4,up8,down8,
      ratio4:down4>0?+(up4/down4).toFixed(2):up4>0?99:0,
      ratio8:down8>0?+(up8/down8).toFixed(2):up8>0?99:0,
      buckets,
      advancing:buckets.up0to2+buckets.up2to5+buckets.up5to10+buckets.up10plus,
      declining:buckets.down0to2+buckets.down2to5+buckets.down5to10+buckets.down10plus
    });
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.get("/api/aggs/:ticker", async (req, res) => {
  try {
    const {ticker}=req.params; const days=parseInt(req.query.days)||30;
    const from=tradingDaysAgo(days); const to=new Date().toISOString().slice(0,10);
    const data = await polygonGet(`/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=5000`);
    res.json({ticker, results:(data.results||[]).map(r=>({
      date:new Date(r.t).toISOString().slice(0,10), open:r.o, high:r.h, low:r.l, close:r.c, volume:r.v
    }))});
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.listen(PORT, () => {
  console.log(`\n  🟢  Market Dashboard running at http://localhost:${PORT}`);
  console.log(`  📡  Polygon API Key: ${API_KEY==="YOUR_POLYGON_API_KEY"?"⚠️  NOT SET":"✓ configured"}\n`);
});
