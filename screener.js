const SCREENER = {
  filters: {},

  init() {
    document.getElementById('scrFilterToggle').addEventListener('click', () => {
      const p = document.getElementById('scrFilterPanel');
      p.style.display = p.style.display === 'none' ? 'block' : 'none';
      document.getElementById('scrFilterToggle').textContent = p.style.display === 'none' ? 'SHOW FILTERS' : 'HIDE FILTERS';
    });
    document.getElementById('scrApply').addEventListener('click', () => this.applyAndLoad());
    document.getElementById('scrReset').addEventListener('click', () => this.resetFilters());
  },

  getVal(id, fallback) {
    const v = document.getElementById(id)?.value;
    return v === '' || v == null ? fallback : parseFloat(v);
  },

  getStr(id) {
    const v = document.getElementById(id)?.value;
    return v || '';
  },

  applyAndLoad() {
    this.filters = {
      // FMP API-level filters
      name: this.getStr('fName'),
      sector: this.getStr('fSector'),
      industry: this.getStr('fIndustry'),
      exchange: this.getStr('fExchange'),
      country: this.getStr('fCountry'),
      minMcap: this.getStr('fMinMcap'),
      maxMcap: this.getStr('fMaxMcap'),
      minBeta: this.getVal('fMinBeta', null),
      maxBeta: this.getVal('fMaxBeta', null),
      minDiv: this.getVal('fMinDiv', null),
      maxDiv: this.getVal('fMaxDiv', null),
      type: this.getStr('fType'),
      // Quote-based filters
      minPrice: this.getVal('fMinPrice', 0),
      maxPrice: this.getVal('fMaxPrice', 999999),
      minVol: this.getVal('fMinVol', 0),
      maxVol: this.getVal('fMaxVol', 999999999999),
      minAvgVol: this.getVal('fMinAvgVol', 0),
      maxAvgVol: this.getVal('fMaxAvgVol', 999999999999),
      minChange: this.getVal('fMinChg', -999),
      maxChange: this.getVal('fMaxChg', 999),
      minGap: this.getVal('fMinGap', -999),
      maxGap: this.getVal('fMaxGap', 999),
      minRange: this.getVal('fMinRange', 0),
      maxRange: this.getVal('fMaxRange', 999),
      minRelVol: this.getVal('fMinRelVol', 0),
      minOpen: this.getVal('fMinOpen', 0),
      maxOpen: this.getVal('fMaxOpen', 999999),
      minFromOpen: this.getVal('fMinFromOpen', -999),
      maxFromOpen: this.getVal('fMaxFromOpen', 999),
      minPE: this.getVal('fMinPE', null),
      maxPE: this.getVal('fMaxPE', null),
      minEPS: this.getVal('fMinEPS', null),
      maxEPS: this.getVal('fMaxEPS', null),
      maxFrom52H: this.getVal('fMaxFrom52H', null),
      minFrom52L: this.getVal('fMinFrom52L', null),
      vs50MA: this.getStr('fVs50MA'),
      vs200MA: this.getStr('fVs200MA'),
      sort: document.getElementById('fSort').value,
      limit: 9
    };
    this.load();
  },

  resetFilters() {
    document.getElementById('fName').value = '';
    document.getElementById('fSector').value = '';
    document.getElementById('fIndustry').value = '';
    document.getElementById('fExchange').value = '';
    document.getElementById('fCountry').value = 'US';
    document.getElementById('fMinMcap').value = '';
    document.getElementById('fMaxMcap').value = '';
    document.getElementById('fMinBeta').value = '';
    document.getElementById('fMaxBeta').value = '';
    document.getElementById('fMinDiv').value = '';
    document.getElementById('fMaxDiv').value = '';
    document.getElementById('fType').value = 'stocks';
    document.getElementById('fMinPrice').value = '2';
    document.getElementById('fMaxPrice').value = '';
    document.getElementById('fMinVol').value = '50000';
    document.getElementById('fMaxVol').value = '';
    document.getElementById('fMinAvgVol').value = '';
    document.getElementById('fMaxAvgVol').value = '';
    document.getElementById('fMinChg').value = '';
    document.getElementById('fMaxChg').value = '';
    document.getElementById('fMinGap').value = '';
    document.getElementById('fMaxGap').value = '';
    document.getElementById('fMinRange').value = '';
    document.getElementById('fMaxRange').value = '';
    document.getElementById('fMinRelVol').value = '';
    document.getElementById('fMinOpen').value = '';
    document.getElementById('fMaxOpen').value = '';
    document.getElementById('fMinFromOpen').value = '';
    document.getElementById('fMaxFromOpen').value = '';
    document.getElementById('fMinPE').value = '';
    document.getElementById('fMaxPE').value = '';
    document.getElementById('fMinEPS').value = '';
    document.getElementById('fMaxEPS').value = '';
    document.getElementById('fMaxFrom52H').value = '';
    document.getElementById('fMinFrom52L').value = '';
    document.getElementById('fVs50MA').value = '';
    document.getElementById('fVs200MA').value = '';
    document.getElementById('fSort').value = 'changeDesc';
    this.filters = {};
    this.load();
  },

  async load() {
    const grid = document.getElementById('scrGrid');
    grid.innerHTML = Array(9).fill('<div class="scr-card shimmer" style="min-height:220px"></div>').join('');
    const f = this.filters;
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) { if (v != null && v !== '') params.set(k, v); }
    try {
      const r = await fetch('/api/screener?' + params.toString());
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      document.getElementById('scrCount').textContent = d.count + ' shown / ' + d.total + ' matched';
      if (!d.tickers.length) { grid.innerHTML = '<div class="err" style="grid-column:1/-1">No stocks match your filters</div>'; return; }
      grid.innerHTML = d.tickers.map((t, i) => {
        const u = t.changePerc >= 0;
        const gu = t.gap >= 0;
        return '<div class="scr-card" id="scr-' + i + '">' +
          '<div class="scr-head">' +
            '<span class="scr-tk">' + t.ticker + '</span>' +
            '<span class="scr-px">' + t.price.toFixed(2) + '</span>' +
          '</div>' +
          '<div class="scr-meta">' +
            '<span class="' + (u ? 'up-c' : 'dn-c') + '">' + (u ? '+' : '') + t.changePerc.toFixed(2) + '%</span>' +
            '<span style="color:' + (gu ? 'var(--grn2)' : 'var(--red2)') + '">Gap ' + (gu ? '+' : '') + t.gap + '%</span>' +
            '<span class="scr-vol">RVol: ' + t.relVol + 'x</span>' +
            '<span class="scr-vol">Vol: ' + fmtVol(t.volume) + '</span>' +
          '</div>' +
          '<div style="font-family:JetBrains Mono,monospace;font-size:.5rem;color:var(--t3);margin-bottom:.3rem;display:flex;flex-wrap:wrap;gap:.4rem">' +
            (t.sector ? '<span>' + t.sector + '</span>' : '') +
            (t.mcap ? '<span>' + fmtMcap(t.mcap) + '</span>' : '') +
            (t.pe ? '<span>PE: ' + t.pe.toFixed(1) + '</span>' : '') +
            (t.eps ? '<span>EPS: $' + t.eps.toFixed(2) + '</span>' : '') +
            (t.from52H != null ? '<span style="color:' + (Math.abs(t.from52H) < 5 ? 'var(--grn2)' : 'var(--t3)') + '">52wH: ' + t.from52H + '%</span>' : '') +
          '</div>' +
          '<canvas id="candle-' + i + '" class="scr-canvas"></canvas>' +
        '</div>';
      }).join('');
      this.loadCandles(d.tickers.map(t => t.ticker));
    } catch (e) { grid.innerHTML = '<div class="err" style="grid-column:1/-1">' + e.message + '</div>'; }
  },

  async loadCandles(tickers) {
    try {
      const r = await fetch('/api/candles?tickers=' + tickers.join(',') + '&days=90');
      const data = await r.json();
      data.forEach((d, i) => { if (d.candles.length) this.drawCandles('candle-' + i, d.candles); });
    } catch (e) { console.error(e); }
  },

  drawCandles(id, candles) {
    const c = document.getElementById(id);
    if (!c) return;
    const ctx = c.getContext('2d');
    const dp = window.devicePixelRatio || 1;
    const r = c.getBoundingClientRect();
    c.width = r.width * dp; c.height = r.height * dp;
    ctx.scale(dp, dp);
    const w = r.width, h = r.height;
    const pad = { t: 5, b: 25, l: 5, r: 5 };
    const cw = (w - pad.l - pad.r) / candles.length;
    const allH = candles.map(c => c.h), allL = candles.map(c => c.l);
    const mn = Math.min(...allL), mx = Math.max(...allH);
    const rng = mx - mn || 1;
    const yS = (v) => pad.t + (1 - (v - mn) / rng) * (h - pad.t - pad.b);

    const maxV = Math.max(...candles.map(c => c.v));
    candles.forEach((bar, i) => {
      const x = pad.l + i * cw;
      const vH = (bar.v / maxV) * 20;
      ctx.fillStyle = bar.c >= bar.o ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)';
      ctx.fillRect(x + 1, h - pad.b, cw - 2, -vH);
    });

    candles.forEach((bar, i) => {
      const x = pad.l + i * cw;
      const cx = x + cw / 2;
      const up = bar.c >= bar.o;
      const color = up ? '#10b981' : '#ef4444';
      ctx.beginPath(); ctx.moveTo(cx, yS(bar.h)); ctx.lineTo(cx, yS(bar.l));
      ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
      const oY = yS(bar.o), cY = yS(bar.c);
      ctx.fillStyle = color;
      ctx.fillRect(x + 1, Math.min(oY, cY), Math.max(cw - 2, 1), Math.max(Math.abs(cY - oY), 1));
    });

    ctx.fillStyle = '#4f6484'; ctx.font = '9px JetBrains Mono';
    const step = Math.floor(candles.length / 3);
    for (let i = step; i < candles.length; i += step) {
      const d = new Date(candles[i].t);
      ctx.fillText((d.getMonth()+1) + '/' + d.getDate(), pad.l + i * cw - 10, h - 5);
    }
  }
};

function fmtVol(v) {
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v;
}

function fmtMcap(v) {
  if (v >= 1e12) return '$' + (v / 1e12).toFixed(1) + 'T';
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(0) + 'M';
  return '$' + v;
}
