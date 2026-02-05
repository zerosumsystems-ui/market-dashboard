const API_KEY = process.env.FMP_API_KEY;
const BASE = "https://financialmodelingprep.com";

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

    const [rNYSE, rNASDAQ] = await Promise.all([
      fetch(`${BASE}/stable/batch-exchange-quote?exchange=NYSE&apikey=${API_KEY}`),
      fetch(`${BASE}/stable/batch-exchange-quote?exchange=NASDAQ&apikey=${API_KEY}`)
    ]);
    const [dNYSE, dNASDAQ] = await Promise.all([rNYSE.json(), rNASDAQ.json()]);
    const allQuotes = [...(dNYSE||[]), ...(dNASDAQ||[])];

    let tickers = allQuotes.filter(q => {
      const price = q.price ?? 0;
      const vol = q.volume ?? 0;
      const chg = q.changesPercentage ?? 0;
      const open = q.open ?? 0;
      const high = q.dayHigh ?? 0;
      const low = q.dayLow ?? 0;
      const prevClose = q.previousClose ?? 0;
      const range = price > 0 ? ((high - low) / price) * 100 : 0;
      const gap = prevClose > 0 ? ((open - prevClose) / prevClose) * 100 : 0;
      const avgVol = q.avgVolume ?? 0;
      const relVol = avgVol > 0 ? vol / avgVol : 0;

      return price >= minPrice && price <= maxPrice &&
        vol >= minVol && vol <= maxVol &&
        chg >= minChange && chg <= maxChange &&
        open >= minOpen && open <= maxOpen &&
        high >= minHigh && low >= minLow &&
        range >= minRange && range <= maxRange &&
        gap >= minGap && gap <= maxGap &&
        relVol >= minRelVol;
    });

    const getPrice = q => q.price ?? 0;
    const getChg = q => q.changesPercentage ?? 0;
    const getVol = q => q.volume ?? 0;
    const getGap = q => {
      const pc = q.previousClose ?? 0;
      return pc > 0 ? ((q.open ?? 0) - pc) / pc * 100 : 0;
    };
    const getRange = q => {
      const p = q.price ?? 0;
      return p > 0 ? (((q.dayHigh ?? 0) - (q.dayLow ?? 0)) / p * 100) : 0;
    };
    const getRelVol = q => {
      const av = q.avgVolume ?? 0;
      return av > 0 ? (q.volume ?? 0) / av : 0;
    };

    if (sort === "changeDesc") tickers.sort((a, b) => getChg(b) - getChg(a));
    else if (sort === "changeAsc") tickers.sort((a, b) => getChg(a) - getChg(b));
    else if (sort === "volumeDesc") tickers.sort((a, b) => getVol(b) - getVol(a));
    else if (sort === "volumeAsc") tickers.sort((a, b) => getVol(a) - getVol(b));
    else if (sort === "priceDesc") tickers.sort((a, b) => getPrice(b) - getPrice(a));
    else if (sort === "priceAsc") tickers.sort((a, b) => getPrice(a) - getPrice(b));
    else if (sort === "gapDesc") tickers.sort((a, b) => getGap(b) - getGap(a));
    else if (sort === "rangeDesc") tickers.sort((a, b) => getRange(b) - getRange(a));
    else if (sort === "relVolDesc") tickers.sort((a, b) => getRelVol(b) - getRelVol(a));

    const selected = tickers.slice(0, limit).map(q => {
      const prevClose = q.previousClose ?? 0;
      const open = q.open ?? 0;
      const price = q.price ?? 0;
      const high = q.dayHigh ?? 0;
      const low = q.dayLow ?? 0;
      const vol = q.volume ?? 0;
      const avgVol = q.avgVolume ?? 0;
      return {
        ticker: q.symbol,
        price, open, high, low, volume: vol,
        change: q.change ?? 0,
        changePerc: q.changesPercentage ?? 0,
        prevClose,
        prevVolume: avgVol,
        gap: prevClose > 0 ? +((open - prevClose) / prevClose * 100).toFixed(2) : 0,
        range: price > 0 ? +((high - low) / price * 100).toFixed(2) : 0,
        relVol: avgVol > 0 ? +(vol / avgVol).toFixed(2) : 0,
        fromOpen: open > 0 ? +((price - open) / open * 100).toFixed(2) : 0,
        vwap: 0,
        prevHigh: 0,
        prevLow: 0
      };
    });

    res.json({ count: selected.length, total: tickers.length, tickers: selected });
  } catch (e) { res.status(500).json({ error: e.message }); }
}
