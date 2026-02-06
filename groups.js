// Sector & Industry Groups module
const GROUPS = {
  sectorData: null,
  heatmapData: null,

  async load() {
    const container = document.getElementById('groupsContent');
    container.innerHTML = '<div class="shimmer" style="min-height:200px"></div>';

    try {
      const [sectorsRes, heatmapRes] = await Promise.all([
        fetch('/api/sectors'),
        fetch('/api/heatmap')
      ]);
      const sectors = await sectorsRes.json();
      const heatmap = await heatmapRes.json();

      if (sectors.error) throw new Error(sectors.error);

      this.sectorData = sectors;
      this.heatmapData = heatmap;
      this.renderSectors(container, sectors, heatmap);
    } catch (e) {
      container.innerHTML = '<div class="err">' + e.message + '</div>';
    }
  },

  renderSectors(container, sectors, heatmap) {
    // Sector performance bar chart
    let html = '<div class="sec"><h2>Sector Performance</h2><div class="line"></div><div class="badge">TODAY</div></div>';
    html += '<div class="groups-bars">';

    for (const s of sectors) {
      const isUp = s.change >= 0;
      const barWidth = Math.min(Math.abs(s.change) * 15, 100);
      html += '<div class="group-bar-row">' +
        '<div class="group-bar-label">' + s.sector + '</div>' +
        '<div class="group-bar-track">' +
          '<div class="group-bar-center"></div>' +
          '<div class="group-bar-fill ' + (isUp ? 'up' : 'dn') + '" style="width:' + barWidth + '%;' + (isUp ? '' : 'right:50%;left:auto;transform:scaleX(-1)') + '"></div>' +
        '</div>' +
        '<div class="group-bar-val ' + (isUp ? 'up-c' : 'dn-c') + '">' + (isUp ? '+' : '') + s.change.toFixed(2) + '%</div>' +
      '</div>';
    }
    html += '</div>';

    // Sector detail table
    if (Array.isArray(heatmap) && heatmap.length > 0) {
      html += '<div class="sec" style="margin-top:2rem"><h2>Sector Breakdown</h2><div class="line"></div><div class="badge">S&P 500</div></div>';
      html += '<div class="tw"><table><thead><tr><th>Sector</th><th>Stocks</th><th>Avg Change</th><th>Best</th><th>Worst</th><th>Market Cap</th></tr></thead><tbody>';

      for (const sec of heatmap) {
        const stocks = sec.stocks;
        const avgChg = stocks.length > 0 ? stocks.reduce((s, st) => s + st.change, 0) / stocks.length : 0;
        const best = stocks.length > 0 ? stocks.reduce((b, s) => s.change > b.change ? s : b) : null;
        const worst = stocks.length > 0 ? stocks.reduce((w, s) => s.change < w.change ? s : w) : null;
        const mcap = sec.totalMcap >= 1e12 ? '$' + (sec.totalMcap / 1e12).toFixed(1) + 'T' : '$' + (sec.totalMcap / 1e9).toFixed(0) + 'B';
        const isUp = avgChg >= 0;

        html += '<tr>' +
          '<td style="text-align:left;padding-left:1rem;color:var(--t1);font-weight:600">' + sec.name + '</td>' +
          '<td>' + stocks.length + '</td>' +
          '<td class="' + (isUp ? 'up-c' : 'dn-c') + '">' + (isUp ? '+' : '') + avgChg.toFixed(2) + '%</td>' +
          '<td class="up-c">' + (best ? best.ticker + ' +' + best.change.toFixed(2) + '%' : '--') + '</td>' +
          '<td class="dn-c">' + (worst ? worst.ticker + ' ' + worst.change.toFixed(2) + '%' : '--') + '</td>' +
          '<td style="color:var(--t2)">' + mcap + '</td>' +
        '</tr>';
      }
      html += '</tbody></table></div>';

      // Top stocks per sector
      html += '<div class="sec" style="margin-top:2rem"><h2>Top Stocks by Sector</h2><div class="line"></div></div>';
      html += '<div class="groups-sector-grid">';
      for (const sec of heatmap) {
        const topStocks = sec.stocks.slice(0, 5);
        html += '<div class="groups-sector-card">' +
          '<div class="groups-sector-title">' + sec.name + '</div>';
        for (const s of topStocks) {
          const isUp = s.change >= 0;
          const mcap = s.mcap >= 1e12 ? '$' + (s.mcap / 1e12).toFixed(1) + 'T' : s.mcap >= 1e9 ? '$' + (s.mcap / 1e9).toFixed(0) + 'B' : '$' + (s.mcap / 1e6).toFixed(0) + 'M';
          html += '<div class="groups-stock-row">' +
            '<span class="groups-stock-tk">' + s.ticker + '</span>' +
            '<span class="groups-stock-mcap">' + mcap + '</span>' +
            '<span class="' + (isUp ? 'up-c' : 'dn-c') + '">' + (isUp ? '+' : '') + s.change.toFixed(2) + '%</span>' +
          '</div>';
        }
        html += '</div>';
      }
      html += '</div>';
    }

    container.innerHTML = html;
  }
};
