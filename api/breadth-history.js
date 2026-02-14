import { getRange, px } from './_lib/databento.js';

export default async function handler(req, res) {
  try {
    const days = Math.min(parseInt(req.query.days) || 20, 30);
    // Extra calendar days to cover weekends/holidays + previous close
    const calDays = days + 15;
    const end = new Date(); end.setDate(end.getDate() + 1);
    const start = new Date(); start.setDate(start.getDate() - calDays);

    const records = await getRange({
      schema: 'ohlcv-1d',
      symbols: 'ALL_SYMBOLS',
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    });

    // Build: { symbol: { date: { close, volume } } }
    const bySymbol = {};
    for (const r of records) {
      if (!r.symbol || !r.date) continue;
      if (!bySymbol[r.symbol]) bySymbol[r.symbol] = {};
      bySymbol[r.symbol][r.date] = { close: px(r.close), volume: r.volume ?? 0 };
    }

    // Get sorted unique trading dates
    const allDates = new Set();
    for (const symDates of Object.values(bySymbol)) {
      for (const d of Object.keys(symDates)) allDates.add(d);
    }
    const dates = [...allDates].sort();

    // For each date (except the first), compute breadth vs previous day
    const history = [];
    for (let i = dates.length - 1; i >= 1 && history.length < days; i--) {
      const today = dates[i];
      const yesterday = dates[i - 1];

      const bk = { d10: 0, d5: 0, d2: 0, d0: 0, u0: 0, u2: 0, u5: 0, u10: 0 };
      let tot = 0, u4 = 0, d4 = 0, u8 = 0, d8 = 0;

      for (const symDates of Object.values(bySymbol)) {
        const todayBar = symDates[today];
        const yesterdayBar = symDates[yesterday];
        if (!todayBar || !yesterdayBar || !todayBar.volume || yesterdayBar.close <= 0) continue;

        const p = ((todayBar.close - yesterdayBar.close) / yesterdayBar.close) * 100;
        tot++;
        if (p >= 4) u4++;
        if (p <= -4) d4++;
        if (p >= 8) u8++;
        if (p <= -8) d8++;
        if (p <= -10) bk.d10++;
        else if (p <= -5) bk.d5++;
        else if (p <= -2) bk.d2++;
        else if (p < 0) bk.d0++;
        else if (p < 2) bk.u0++;
        else if (p < 5) bk.u2++;
        else if (p < 10) bk.u5++;
        else bk.u10++;
      }

      const adv = bk.u0 + bk.u2 + bk.u5 + bk.u10;
      const dec = bk.d0 + bk.d2 + bk.d5 + bk.d10;

      history.push({
        date: today,
        dateLabel: new Date(today + 'T12:00:00').toLocaleDateString('en-US'),
        universe: tot, u4, d4, u8, d8,
        r4: d4 > 0 ? +(u4 / d4).toFixed(2) : u4 > 0 ? 99 : 0,
        r8: d8 > 0 ? +(u8 / d8).toFixed(2) : u8 > 0 ? 99 : 0,
        buckets: bk, adv, dec,
      });
    }

    res.json(history);
  } catch (e) { res.status(500).json({ error: e.message }); }
}
