const API_KEY = process.env.FMP_API_KEY;
const BASE = "https://financialmodelingprep.com";

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) return null;
  try { return await r.json(); } catch { return null; }
}

async function batchQuote(symbols) {
  const CHUNK = 200;
  const chunks = [];
  for (let i = 0; i < symbols.length; i += CHUNK) {
    chunks.push(symbols.slice(i, i + CHUNK).join(","));
  }
  const all = [];
  for (let i = 0; i < chunks.length; i += 15) {
    const batch = chunks.slice(i, i + 15);
    const results = await Promise.allSettled(batch.map(c =>
      fetchJSON(`${BASE}/stable/batch-quote?symbols=${c}&apikey=${API_KEY}`)
    ));
    for (const r of results) {
      if (r.status === 'fulfilled' && Array.isArray(r.value)) {
        all.push(...r.value);
      }
    }
  }
  return all.filter(Boolean);
}

export default async function handler(req, res) {
  try {
    // Quote-based filters (applied after fetching real-time data)
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
    const minRelVol = parseFloat(req.query.minRelVol) || 0;
    const sort = req.query.sort || "changeDesc";
    const limit = Math.min(parseInt(req.query.limit) || 9, 30);

    // Build FMP company-screener URL with API-level filters
    const scrParams = new URLSearchParams();
    scrParams.set('apikey', API_KEY);
    scrParams.set('isActivelyTrading', 'true');
    scrParams.set('limit', '5000');

    // Exchange filter
    const exchange = req.query.exchange || '';
    if (exchange) {
      scrParams.set('exchange', exchange);
    } else {
      scrParams.set('exchange', 'NYSE,NASDAQ,AMEX');
    }

    // Sector
    if (req.query.sector) scrParams.set('sector', req.query.sector);

    // Industry (FMP uses exact match)
    if (req.query.industry) scrParams.set('industry', req.query.industry);

    // Country
    if (req.query.country) scrParams.set('country', req.query.country);

    // Market cap
    if (req.query.minMcap) scrParams.set('marketCapMoreThan', req.query.minMcap);
    if (req.query.maxMcap) scrParams.set('marketCapLowerThan', req.query.maxMcap);

    // Beta
    if (req.query.minBeta) scrParams.set('betaMoreThan', req.query.minBeta);
    if (req.query.maxBeta) scrParams.set('betaLowerThan', req.query.maxBeta);

    // Dividend
    if (req.query.minDiv) scrParams.set('dividendMoreThan', req.query.minDiv);
    if (req.query.maxDiv) scrParams.set('dividendLowerThan', req.query.maxDiv);

    // Price (FMP also supports these)
    if (minPrice > 0) scrParams.set('priceMoreThan', minPrice);
    if (maxPrice < 999999) scrParams.set('priceLowerThan', maxPrice);

    // Volume
    if (minVol > 0) scrParams.set('volumeMoreThan', minVol);
    if (maxVol < 999999999999) scrParams.set('volumeLowerThan', maxVol);

    // Type (stocks vs ETFs)
    const type = req.query.type || 'stocks';
    if (type === 'stocks') { scrParams.set('isEtf', 'false'); scrParams.set('isFund', 'false'); }
    else if (type === 'etfs') { scrParams.set('isEtf', 'true'); }

    // Fetch screener results (metadata: symbol, sector, industry, marketCap, beta, etc.)
    const scrUrl = `${BASE}/stable/company-screener?${scrParams.toString()}`;
    const screenerData = await fetchJSON(scrUrl);

    if (!Array.isArray(screenerData) || screenerData.length === 0) {
      return res.json({ count: 0, total: 0, tickers: [] });
    }

    // Build a metadata map from screener results
    const metaMap = {};
    for (const s of screenerData) {
      if (s.symbol) {
        metaMap[s.symbol] = {
          sector: s.sector || '',
          industry: s.industry || '',
          mcap: s.marketCap || 0,
          beta: s.beta || 0,
          dividend: s.lastAnnualDividend || 0
        };
      }
    }

    // Get real-time quotes for the screener symbols
    const symbols = Object.keys(metaMap);
    const quotes = await batchQuote(symbols);

    // Build quote map
    const quoteMap = {};
    for (const q of quotes) {
      if (q.symbol) quoteMap[q.symbol] = q;
    }

    // Apply quote-based filters
    let tickers = symbols.filter(sym => {
      const q = quoteMap[sym];
      if (!q) return false;
      const price = q.price ?? 0;
      const vol = q.volume ?? 0;
      const chgVal = q.change ?? 0;
      const prevClose = q.previousClose ?? (price && chgVal ? price - chgVal : 0);
      const chg = q.changePercentage ?? q.changesPercentage ?? (prevClose > 0 ? chgVal / prevClose * 100 : 0);
      const open = q.open ?? 0;
      const high = q.dayHigh ?? 0;
      const low = q.dayLow ?? 0;
      const range = price > 0 ? ((high - low) / price) * 100 : 0;
      const gap = prevClose > 0 ? ((open - prevClose) / prevClose) * 100 : 0;
      const avgVol = q.avgVolume ?? 0;
      const relVol = avgVol > 0 ? vol / avgVol : 0;

      return chg >= minChange && chg <= maxChange &&
        open >= minOpen && open <= maxOpen &&
        range >= minRange && range <= maxRange &&
        gap >= minGap && gap <= maxGap &&
        relVol >= minRelVol;
    });

    // Sort
    const getQ = sym => quoteMap[sym] || {};
    const getChg = sym => { const q = getQ(sym); return q.changePercentage ?? q.changesPercentage ?? 0; };
    const getVol = sym => (getQ(sym).volume ?? 0);
    const getPrice = sym => (getQ(sym).price ?? 0);
    const getGap = sym => { const q = getQ(sym); const pc = q.previousClose ?? 0; return pc > 0 ? ((q.open ?? 0) - pc) / pc * 100 : 0; };
    const getRange = sym => { const q = getQ(sym); const p = q.price ?? 0; return p > 0 ? ((q.dayHigh ?? 0) - (q.dayLow ?? 0)) / p * 100 : 0; };
    const getRelVol = sym => { const q = getQ(sym); const av = q.avgVolume ?? 0; return av > 0 ? (q.volume ?? 0) / av : 0; };
    const getMcap = sym => (metaMap[sym]?.mcap ?? 0);

    if (sort === "changeDesc") tickers.sort((a, b) => getChg(b) - getChg(a));
    else if (sort === "changeAsc") tickers.sort((a, b) => getChg(a) - getChg(b));
    else if (sort === "volumeDesc") tickers.sort((a, b) => getVol(b) - getVol(a));
    else if (sort === "volumeAsc") tickers.sort((a, b) => getVol(a) - getVol(b));
    else if (sort === "priceDesc") tickers.sort((a, b) => getPrice(b) - getPrice(a));
    else if (sort === "priceAsc") tickers.sort((a, b) => getPrice(a) - getPrice(b));
    else if (sort === "gapDesc") tickers.sort((a, b) => getGap(b) - getGap(a));
    else if (sort === "rangeDesc") tickers.sort((a, b) => getRange(b) - getRange(a));
    else if (sort === "relVolDesc") tickers.sort((a, b) => getRelVol(b) - getRelVol(a));
    else if (sort === "mcapDesc") tickers.sort((a, b) => getMcap(b) - getMcap(a));
    else if (sort === "mcapAsc") tickers.sort((a, b) => getMcap(a) - getMcap(b));

    const total = tickers.length;
    const selected = tickers.slice(0, limit).map(sym => {
      const q = quoteMap[sym] || {};
      const meta = metaMap[sym] || {};
      const price = q.price ?? 0;
      const open = q.open ?? 0;
      const high = q.dayHigh ?? 0;
      const low = q.dayLow ?? 0;
      const vol = q.volume ?? 0;
      const avgVol = q.avgVolume ?? 0;
      const chgVal = q.change ?? 0;
      const prevClose = q.previousClose ?? (price && chgVal ? price - chgVal : 0);
      return {
        ticker: sym,
        price, open, high, low, volume: vol,
        change: chgVal,
        changePerc: q.changePercentage ?? q.changesPercentage ?? (prevClose > 0 ? +((chgVal / prevClose) * 100).toFixed(2) : 0),
        prevClose,
        prevVolume: avgVol,
        gap: prevClose > 0 ? +((open - prevClose) / prevClose * 100).toFixed(2) : 0,
        range: price > 0 ? +((high - low) / price * 100).toFixed(2) : 0,
        relVol: avgVol > 0 ? +(vol / avgVol).toFixed(2) : 0,
        fromOpen: open > 0 ? +((price - open) / open * 100).toFixed(2) : 0,
        sector: meta.sector,
        industry: meta.industry,
        mcap: meta.mcap,
        beta: meta.beta
      };
    });

    res.json({ count: selected.length, total, tickers: selected });
  } catch (e) { res.status(500).json({ error: e.message }); }
}
