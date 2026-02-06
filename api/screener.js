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
    // Quote-based filters
    const minPrice = parseFloat(req.query.minPrice) || 0;
    const maxPrice = parseFloat(req.query.maxPrice) || 999999;
    const minVol = parseFloat(req.query.minVol) || 0;
    const maxVol = parseFloat(req.query.maxVol) || 999999999999;
    const minAvgVol = parseFloat(req.query.minAvgVol) || 0;
    const maxAvgVol = parseFloat(req.query.maxAvgVol) || 999999999999;
    const minChange = parseFloat(req.query.minChange) || -999;
    const maxChange = parseFloat(req.query.maxChange) || 999;
    const minOpen = parseFloat(req.query.minOpen) || 0;
    const maxOpen = parseFloat(req.query.maxOpen) || 999999;
    const minRange = parseFloat(req.query.minRange) || 0;
    const maxRange = parseFloat(req.query.maxRange) || 999;
    const minGap = parseFloat(req.query.minGap) || -999;
    const maxGap = parseFloat(req.query.maxGap) || 999;
    const minRelVol = parseFloat(req.query.minRelVol) || 0;
    const minFromOpen = parseFloat(req.query.minFromOpen) || -999;
    const maxFromOpen = parseFloat(req.query.maxFromOpen) || 999;
    const minPE = req.query.minPE ? parseFloat(req.query.minPE) : null;
    const maxPE = req.query.maxPE ? parseFloat(req.query.maxPE) : null;
    const minEPS = req.query.minEPS ? parseFloat(req.query.minEPS) : null;
    const maxEPS = req.query.maxEPS ? parseFloat(req.query.maxEPS) : null;
    const maxFrom52H = req.query.maxFrom52H ? parseFloat(req.query.maxFrom52H) : null;
    const minFrom52L = req.query.minFrom52L ? parseFloat(req.query.minFrom52L) : null;
    const vs50MA = req.query.vs50MA || '';
    const vs200MA = req.query.vs200MA || '';
    const nameFilter = (req.query.name || '').toLowerCase();
    const sort = req.query.sort || "changeDesc";
    const limit = Math.min(parseInt(req.query.limit) || 9, 30);

    // Build FMP company-screener URL
    const scrParams = new URLSearchParams();
    scrParams.set('apikey', API_KEY);
    scrParams.set('isActivelyTrading', 'true');
    scrParams.set('limit', '5000');

    const exchange = req.query.exchange || '';
    if (exchange) scrParams.set('exchange', exchange);
    else scrParams.set('exchange', 'NYSE,NASDAQ,AMEX');

    if (req.query.sector) scrParams.set('sector', req.query.sector);
    if (req.query.industry) scrParams.set('industry', req.query.industry);
    if (req.query.country) scrParams.set('country', req.query.country);
    if (req.query.minMcap) scrParams.set('marketCapMoreThan', req.query.minMcap);
    if (req.query.maxMcap) scrParams.set('marketCapLowerThan', req.query.maxMcap);
    if (req.query.minBeta) scrParams.set('betaMoreThan', req.query.minBeta);
    if (req.query.maxBeta) scrParams.set('betaLowerThan', req.query.maxBeta);
    if (req.query.minDiv) scrParams.set('dividendMoreThan', req.query.minDiv);
    if (req.query.maxDiv) scrParams.set('dividendLowerThan', req.query.maxDiv);
    if (minPrice > 0) scrParams.set('priceMoreThan', minPrice);
    if (maxPrice < 999999) scrParams.set('priceLowerThan', maxPrice);
    if (minVol > 0) scrParams.set('volumeMoreThan', minVol);
    if (maxVol < 999999999999) scrParams.set('volumeLowerThan', maxVol);

    const type = req.query.type || 'stocks';
    if (type === 'stocks') { scrParams.set('isEtf', 'false'); scrParams.set('isFund', 'false'); }
    else if (type === 'etfs') { scrParams.set('isEtf', 'true'); }

    // Fetch screener results
    const screenerData = await fetchJSON(`${BASE}/stable/company-screener?${scrParams.toString()}`);

    if (!Array.isArray(screenerData) || screenerData.length === 0) {
      return res.json({ count: 0, total: 0, tickers: [] });
    }

    // Build metadata map, apply name filter at this stage
    const metaMap = {};
    for (const s of screenerData) {
      if (!s.symbol) continue;
      if (nameFilter) {
        const sym = (s.symbol || '').toLowerCase();
        const name = (s.companyName || '').toLowerCase();
        if (!sym.includes(nameFilter) && !name.includes(nameFilter)) continue;
      }
      metaMap[s.symbol] = {
        name: s.companyName || '',
        sector: s.sector || '',
        industry: s.industry || '',
        mcap: s.marketCap || 0,
        beta: s.beta || 0,
        dividend: s.lastAnnualDividend || 0
      };
    }

    // Get real-time quotes
    const symbols = Object.keys(metaMap);
    if (symbols.length === 0) return res.json({ count: 0, total: 0, tickers: [] });
    const quotes = await batchQuote(symbols);

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
      const avgVol = q.avgVolume ?? 0;
      const chgVal = q.change ?? 0;
      const prevClose = q.previousClose ?? (price && chgVal ? price - chgVal : 0);
      const chg = q.changePercentage ?? q.changesPercentage ?? (prevClose > 0 ? chgVal / prevClose * 100 : 0);
      const open = q.open ?? 0;
      const high = q.dayHigh ?? 0;
      const low = q.dayLow ?? 0;
      const range = price > 0 ? ((high - low) / price) * 100 : 0;
      const gap = prevClose > 0 ? ((open - prevClose) / prevClose) * 100 : 0;
      const relVol = avgVol > 0 ? vol / avgVol : 0;
      const fromOpen = open > 0 ? ((price - open) / open) * 100 : 0;
      const pe = q.pe ?? 0;
      const eps = q.eps ?? 0;
      const yearHigh = q.yearHigh ?? 0;
      const yearLow = q.yearLow ?? 0;
      const priceAvg50 = q.priceAvg50 ?? 0;
      const priceAvg200 = q.priceAvg200 ?? 0;
      const from52H = yearHigh > 0 ? ((price - yearHigh) / yearHigh) * 100 : null;
      const from52L = yearLow > 0 ? ((price - yearLow) / yearLow) * 100 : null;

      if (chg < minChange || chg > maxChange) return false;
      if (open < minOpen || open > maxOpen) return false;
      if (range < minRange || range > maxRange) return false;
      if (gap < minGap || gap > maxGap) return false;
      if (relVol < minRelVol) return false;
      if (avgVol < minAvgVol || avgVol > maxAvgVol) return false;
      if (fromOpen < minFromOpen || fromOpen > maxFromOpen) return false;
      if (minPE != null && (pe <= 0 || pe < minPE)) return false;
      if (maxPE != null && (pe <= 0 || pe > maxPE)) return false;
      if (minEPS != null && eps < minEPS) return false;
      if (maxEPS != null && eps > maxEPS) return false;
      if (maxFrom52H != null && (from52H == null || Math.abs(from52H) > maxFrom52H)) return false;
      if (minFrom52L != null && (from52L == null || from52L < minFrom52L)) return false;
      if (vs50MA === 'above' && (priceAvg50 <= 0 || price <= priceAvg50)) return false;
      if (vs50MA === 'below' && (priceAvg50 <= 0 || price >= priceAvg50)) return false;
      if (vs200MA === 'above' && (priceAvg200 <= 0 || price <= priceAvg200)) return false;
      if (vs200MA === 'below' && (priceAvg200 <= 0 || price >= priceAvg200)) return false;

      return true;
    });

    // Sort helpers
    const getQ = sym => quoteMap[sym] || {};
    const getChg = sym => { const q = getQ(sym); return q.changePercentage ?? q.changesPercentage ?? 0; };
    const getVol = sym => (getQ(sym).volume ?? 0);
    const getPrice = sym => (getQ(sym).price ?? 0);
    const getGap = sym => { const q = getQ(sym); const pc = q.previousClose ?? 0; return pc > 0 ? ((q.open ?? 0) - pc) / pc * 100 : 0; };
    const getRange = sym => { const q = getQ(sym); const p = q.price ?? 0; return p > 0 ? ((q.dayHigh ?? 0) - (q.dayLow ?? 0)) / p * 100 : 0; };
    const getRelVol = sym => { const q = getQ(sym); const av = q.avgVolume ?? 0; return av > 0 ? (q.volume ?? 0) / av : 0; };
    const getMcap = sym => (metaMap[sym]?.mcap ?? 0);
    const getPE = sym => (getQ(sym).pe ?? 0);
    const getEPS = sym => (getQ(sym).eps ?? 0);
    const getFrom52H = sym => { const q = getQ(sym); const yh = q.yearHigh ?? 0; return yh > 0 ? Math.abs(((q.price ?? 0) - yh) / yh * 100) : 999; };
    const getFrom52L = sym => { const q = getQ(sym); const yl = q.yearLow ?? 0; return yl > 0 ? ((q.price ?? 0) - yl) / yl * 100 : 0; };

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
    else if (sort === "peAsc") tickers.sort((a, b) => (getPE(a) || 9999) - (getPE(b) || 9999));
    else if (sort === "peDesc") tickers.sort((a, b) => getPE(b) - getPE(a));
    else if (sort === "epsDesc") tickers.sort((a, b) => getEPS(b) - getEPS(a));
    else if (sort === "near52High") tickers.sort((a, b) => getFrom52H(a) - getFrom52H(b));
    else if (sort === "near52Low") tickers.sort((a, b) => getFrom52L(a) - getFrom52L(b));

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
      const yearHigh = q.yearHigh ?? 0;
      const yearLow = q.yearLow ?? 0;
      return {
        ticker: sym,
        name: meta.name,
        price, open, high, low, volume: vol,
        change: chgVal,
        changePerc: q.changePercentage ?? q.changesPercentage ?? (prevClose > 0 ? +((chgVal / prevClose) * 100).toFixed(2) : 0),
        prevClose,
        prevVolume: avgVol,
        gap: prevClose > 0 ? +((open - prevClose) / prevClose * 100).toFixed(2) : 0,
        range: price > 0 ? +((high - low) / price * 100).toFixed(2) : 0,
        relVol: avgVol > 0 ? +(vol / avgVol).toFixed(2) : 0,
        fromOpen: open > 0 ? +((price - open) / open * 100).toFixed(2) : 0,
        pe: q.pe ?? null,
        eps: q.eps ?? null,
        yearHigh, yearLow,
        from52H: yearHigh > 0 ? +(((price - yearHigh) / yearHigh) * 100).toFixed(2) : null,
        from52L: yearLow > 0 ? +(((price - yearLow) / yearLow) * 100).toFixed(2) : null,
        priceAvg50: q.priceAvg50 ?? null,
        priceAvg200: q.priceAvg200 ?? null,
        sector: meta.sector,
        industry: meta.industry,
        mcap: meta.mcap,
        beta: meta.beta
      };
    });

    res.json({ count: selected.length, total, tickers: selected });
  } catch (e) { res.status(500).json({ error: e.message }); }
}
