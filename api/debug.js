export default async function handler(req, res) {
  try {
    const API_KEY = process.env.DATABENTO_API_KEY;
    if (!API_KEY) return res.json({ error: 'No API key' });

    const end = new Date();
    const start = new Date(); start.setDate(start.getDate() - 5);
    const today = new Date().toISOString().slice(0, 10);

    const body = new URLSearchParams({
      dataset: 'DBEQ.BASIC',
      schema: 'ohlcv-1d',
      symbols: 'SPY',
      start: start.toISOString().slice(0, 10),
      end: today,
      encoding: 'csv',
      stype_in: 'raw_symbol',
      stype_out: 'instrument_id',
    });

    const r = await fetch('https://hist.databento.com/v0/timeseries.get_range', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(API_KEY + ':').toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const text = await r.text();
    res.json({
      status: r.status,
      contentType: r.headers.get('content-type'),
      bodyLength: text.length,
      first500: text.slice(0, 500),
      params: { start: start.toISOString().slice(0, 10), end: today },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
