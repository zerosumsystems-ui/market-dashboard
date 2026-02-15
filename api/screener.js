import { getAllQuotes } from './_lib/quotes.js';

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
    const minRange = parseFloat(req.query.minRange) || 0;
    const maxRange = parseFloat(req.query.maxRange) || 999;
    const minGap = parseFloat(req.query.minGap) || -999;
    const maxGap = parseFloat(req.query.maxGap) || 999;
    const minFromOpen = parseFloat(req.query.minFromOpen) || -999;
    const maxFromOpen = parseFloat(req.query.maxFromOpen) || 999;

    const nameFilter = (req.query.name || '').toLowerCase();
    const sort = req.query.sort || "changeDesc";
    const limit = Math.min(parseInt(req.query.limit) || 9, 30);

    const quotes = await getAllQuotes();

    let tickers = quotes.filter(q => {
      if (!q.symbol || !q.volume) return false;
      const price = q.price;
      const vol = q.volume;
      const chg = q.changePercentage;
      const open = q.open;
      const high = q.dayHigh;
      const low = q.dayLow;
      const prevClose = q.previousClose;
      const range = price > 0 ? ((high - low) / price) * 100 : 0;
      const gap = prevClose > 0 ? ((open - prevClose) / prevClose) * 100 : 0;
      const fromOpen = open > 0 ? ((price - open) / open) * 100 : 0;

      if (nameFilter && !q.symbol.toLowerCase().includes(nameFilter)) return false;
      if (price < minPrice || price > maxPrice) return false;
      if (vol < minVol || vol > maxVol) return false;
      if (chg < minChange || chg > maxChange) return false;
      if (open < minOpen || open > maxOpen) return false;
      if (range < minRange || range > maxRange) return false;
      if (gap < minGap || gap > maxGap) return false;
      if (fromOpen < minFromOpen || fromOpen > maxFromOpen) return false;
      return true;
    });

    const getChg = q => q.changePercentage;
    const getVol = q => q.volume;
    const getPrice = q => q.price;
    const getGap = q => { const pc = q.previousClose; return pc > 0 ? ((q.open - pc) / pc) * 100 : 0; };
    const getRange = q => { const p = q.price; return p > 0 ? ((q.dayHigh - q.dayLow) / p) * 100 : 0; };

    if (sort === "changeDesc") tickers.sort((a, b) => getChg(b) - getChg(a));
    else if (sort === "changeAsc") tickers.sort((a, b) => getChg(a) - getChg(b));
    else if (sort === "volumeDesc") tickers.sort((a, b) => getVol(b) - getVol(a));
    else if (sort === "volumeAsc") tickers.sort((a, b) => getVol(a) - getVol(b));
    else if (sort === "priceDesc") tickers.sort((a, b) => getPrice(b) - getPrice(a));
    else if (sort === "priceAsc") tickers.sort((a, b) => getPrice(a) - getPrice(b));
    else if (sort === "gapDesc") tickers.sort((a, b) => getGap(b) - getGap(a));
    else if (sort === "rangeDesc") tickers.sort((a, b) => getRange(b) - getRange(a));

    const total = tickers.length;
    const selected = tickers.slice(0, limit).map(q => {
      const price = q.price;
      const open = q.open;
      const high = q.dayHigh;
      const low = q.dayLow;
      const vol = q.volume;
      const prevClose = q.previousClose;
      return {
        ticker: q.symbol, name: '',
        price, open, high, low, volume: vol,
        change: q.change,
        changePerc: q.changePercentage,
        prevClose,
        gap: prevClose > 0 ? +((open - prevClose) / prevClose * 100).toFixed(2) : 0,
        range: price > 0 ? +((high - low) / price * 100).toFixed(2) : 0,
        fromOpen: open > 0 ? +((price - open) / open * 100).toFixed(2) : 0,
      };
    });

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.json({ count: selected.length, total, tickers: selected });
  } catch (e) { res.status(500).json({ error: e.message }); }
}
