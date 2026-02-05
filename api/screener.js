const API_KEY = process.env.POLYGON_API_KEY;

export default async function handler(req, res) {
  try {
    const minPrice = parseFloat(req.query.minPrice) || 0;
    const maxPrice = parseFloat(req.query.maxPrice) || 999999;
    const minVol = parseFloat(req.query.minVol) || 0;
    const maxVol = parseFloat(req.query.maxVol) || 999999999999;
    const minChange = parseFloat(req.query.minChange) || -999;
    const maxChange = parseFloat(req.query.maxChange) || 999;
    const minOpen = parseFloat(req.query.minOpen) || 0;
    const maxOpen = parseFloat(req.query.maxOpen) || 999999;
    const minHigh = parseFloat(req.query.minHigh) || 0;
    const minLow = parseFloat(req.query.minLow) || 0;
    const minRange = parseFloat(req.query.minRange) || 0;
    const maxRange = parseFloat(req.query.maxRange) || 999;
    const minGap = parseFloat(req.query.minGap) || -999;
    const maxGap = parseFloat(req.query.maxGap) || 999;
    const minRelVol = parseFloat(req.query.minRelVol) || 0;
    const sort = req.query.sort || "changeDesc";
    const limit = Math.min(parseInt(req.query.limit) || 21, 30);

    const r = await fetch(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?apiKey=${API_KEY}`);
    const data = await r.json();
    let tickers = (data.tickers || []).filter(t => {
      const price = t.day?.c ?? t.lastTrade?.p ?? 0;
      const vol = t.day?.v ?? 0;
      const chg = t.todaysChangePerc ?? 0;
      const open = t.day?.o ?? 0;
      const high = t.day?.h ?? 0;
      const low = t.day?.l ?? 0;
      const prevClose = t.prevDay?.c ?? 0;
      const range = price > 0 ? ((high - low) / price) * 100 : 0;
      const gap = prevClose > 0 ? ((open - prevClose) / prevClose) * 100 : 0;
      const prevVol = t.prevDay?.v ?? 0;
      const relVol = prevVol > 0 ? vol / prevVol : 0;

      return price >= minPrice && price <= maxPrice &&
        vol >= minVol && vol <= maxVol &&
        chg >= minChange && chg <= maxChange &&
        open >= minOpen && open <= maxOpen &&
        high >= minHigh && low >= minLow &&
        range >= minRange && range <= maxRange &&
        gap >= minGap && gap <= maxGap &&
        relVol >= minRelVol;
    });

    if (sort === "changeDesc") tickers.sort((a, b) => (b.todaysChangePerc || 0) - (a.todaysChangePerc || 0));
    else if (sort === "changeAsc") tickers.sort((a, b) => (a.todaysChangePerc || 0) - (b.todaysChangePerc || 0));
    else if (sort === "volumeDesc") tickers.sort((a, b) => (b.day?.v || 0) - (a.day?.v || 0));
    else if (sort === "volumeAsc") tickers.sort((a, b) => (a.day?.v || 0) - (b.day?.v || 0));
    else if (sort === "priceDesc") tickers.sort((a, b) => (b.day?.c || 0) - (a.day?.c || 0));
    else if (sort === "priceAsc") tickers.sort((a, b) => (a.day?.c || 0) - (b.day?.c || 0));
    else if (sort === "gapDesc") tickers.sort((a, b) => {
      const gA = (a.prevDay?.c > 0) ? ((a.day?.o - a.prevDay.c) / a.prevDay.c * 100) : 0;
      const gB = (b.prevDay?.c > 0) ? ((b.day?.o - b.prevDay.c) / b.prevDay.c * 100) : 0;
      return gB - gA;
    });
    else if (sort === "rangeDesc") tickers.sort((a, b) => {
      const rA = (a.day?.c > 0) ? ((a.day.h - a.day.l) / a.day.c * 100) : 0;
      const rB = (b.day?.c > 0) ? ((b.day.h - b.day.l) / b.day.c * 100) : 0;
      return rB - rA;
    });
    else if (sort === "relVolDesc") tickers.sort((a, b) => {
      const rvA = (a.prevDay?.v > 0) ? (a.day?.v || 0) / a.prevDay.v : 0;
      const rvB = (b.prevDay?.v > 0) ? (b.day?.v || 0) / b.prevDay.v : 0;
      return rvB - rvA;
    });

    const selected = tickers.slice(0, limit).map(t => {
      const prevClose = t.prevDay?.c ?? 0;
      const open = t.day?.o ?? 0;
      const price = t.day?.c ?? t.lastTrade?.p ?? 0;
      const high = t.day?.h ?? 0;
      const low = t.day?.l ?? 0;
      const vol = t.day?.v ?? 0;
      return {
        ticker: t.ticker,
        price, open, high, low, volume: vol,
        change: t.todaysChange ?? 0,
        changePerc: t.todaysChangePerc ?? 0,
        prevClose,
        prevVolume: t.prevDay?.v ?? 0,
        gap: prevClose > 0 ? +((open - prevClose) / prevClose * 100).toFixed(2) : 0,
        range: price > 0 ? +((high - low) / price * 100).toFixed(2) : 0,
        relVol: (t.prevDay?.v > 0) ? +(vol / t.prevDay.v).toFixed(2) : 0,
        fromOpen: open > 0 ? +((price - open) / open * 100).toFixed(2) : 0,
        vwap: t.day?.vw ?? 0,
        prevHigh: t.prevDay?.h ?? 0,
        prevLow: t.prevDay?.l ?? 0
      };
    });

    res.json({ count: selected.length, total: tickers.length, tickers: selected });
  } catch (e) { res.status(500).json({ error: e.message }); }
}
