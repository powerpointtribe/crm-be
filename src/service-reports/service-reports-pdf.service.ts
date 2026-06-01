import { Injectable } from '@nestjs/common';
import { ServiceReportDocument } from './schemas/service-report.schema';

export interface PdfComparisonStats {
  averageAttendance: number;
  averageFirstTimers: number;
  averageMales: number;
  averageFemales: number;
  averageChildren: number;
  highestAttendance: number;
  lowestAttendance: number;
  totalReports: number;
  previousReport?: {
    date: Date;
    serviceName: string;
    totalAttendance: number;
    numberOfFirstTimers: number;
  };
  monthlyTrend?: {
    month: string;
    attendance: number;
  }[];
}

@Injectable()
export class ServiceReportsPdfService {
  private readonly tagLabels: Record<string, string> = {
    invited_guest_minister: 'Invited Guest Minister',
    sunday_after_saturday_outreach: 'Sunday after Saturday Outreach',
    themed_service: 'Themed Service',
    beginning_of_new_series: 'Beginning of New Series',
    celebration_service: 'Celebration Service',
    sunday_after_viral_post: 'Sunday after Viral Post',
    others: 'Others',
  };

  private fmt(num: number): string {
    return num.toLocaleString('en-US');
  }

  private pct(value: number, total: number): string {
    return total > 0 ? ((value / total) * 100).toFixed(1) : '0';
  }

  private delta(current: number, average: number): string {
    if (average === 0) return '';
    const diff = current - average;
    const pct = ((diff / average) * 100).toFixed(0);
    const isUp = diff >= 0;
    const color = isUp ? '#10B981' : '#EF4444';
    const arrow = isUp ? '&#9650;' : '&#9660;';
    return `<span style="color:${color};font-size:11px;font-weight:600;">${arrow} ${isUp ? '+' : ''}${pct}%</span>`;
  }

  private miniBar(value: number, max: number, color: string): string {
    const w = max > 0 ? Math.round((value / max) * 100) : 0;
    return `<div style="height:4px;background:#f1f5f9;border-radius:2px;margin-top:4px;"><div style="height:100%;width:${w}%;background:${color};border-radius:2px;"></div></div>`;
  }

  private buildTrendSvg(trend: { month: string; attendance: number }[]): string {
    if (!trend || trend.length < 2) return '';

    const W = 460, H = 100, PL = 35, PR = 10, PT = 10, PB = 25;
    const gW = W - PL - PR, gH = H - PT - PB;
    const maxA = Math.max(...trend.map(d => d.attendance));
    const minA = Math.min(...trend.map(d => d.attendance));
    const range = maxA - minA || 1;

    const pts = trend.map((d, i) => ({
      x: PL + (i / (trend.length - 1)) * gW,
      y: PT + gH - ((d.attendance - minA) / range) * gH,
      ...d,
    }));

    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const area = `${line} L${pts[pts.length - 1].x},${PT + gH} L${pts[0].x},${PT + gH} Z`;

    const dots = pts.map(p =>
      `<circle cx="${p.x}" cy="${p.y}" r="3" fill="#6366F1" stroke="#fff" stroke-width="1.5"/>`
    ).join('');

    const labels = pts
      .filter((_, i) => i % Math.max(1, Math.ceil(pts.length / 6)) === 0 || i === pts.length - 1)
      .map(p => `<text x="${p.x}" y="${H - 5}" text-anchor="middle" style="font-size:8px;fill:#94a3b8;">${p.month}</text>`)
      .join('');

    return `
    <div style="margin-top:16px;">
      <div style="font-size:11px;font-weight:600;color:#475569;margin-bottom:6px;">Attendance Trend</div>
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block;">
        <defs>
          <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#6366F1" stop-opacity="0.2"/>
            <stop offset="100%" stop-color="#6366F1" stop-opacity="0.02"/>
          </linearGradient>
        </defs>
        <path d="${area}" fill="url(#tg)"/>
        <path d="${line}" fill="none" stroke="#6366F1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        ${dots}
        ${labels}
      </svg>
    </div>`;
  }

  private buildBarChart(report: ServiceReportDocument, stats?: PdfComparisonStats): string {
    const items = [
      { label: 'Males', val: report.numberOfMales, avg: stats ? Math.round(stats.averageMales) : 0, color: '#3B82F6' },
      { label: 'Females', val: report.numberOfFemales, avg: stats ? Math.round(stats.averageFemales) : 0, color: '#EC4899' },
      { label: 'Children', val: report.numberOfChildren, avg: stats ? Math.round(stats.averageChildren) : 0, color: '#10B981' },
      { label: 'First Timers', val: report.numberOfFirstTimers, avg: stats ? Math.round(stats.averageFirstTimers) : 0, color: '#F59E0B' },
    ];

    const maxVal = Math.max(...items.map(i => Math.max(i.val, i.avg)), 1);
    const W = 440, H = 140, PL = 10, PB = 20;
    const barW = stats ? 28 : 40;
    const gap = stats ? 90 : 100;

    const bars = items.map((item, idx) => {
      const x = PL + 30 + idx * gap;
      const h = (item.val / maxVal) * (H - 30 - PB);
      const y = H - PB - h;
      let avgBar = '';
      if (stats) {
        const ah = (item.avg / maxVal) * (H - 30 - PB);
        const ay = H - PB - ah;
        avgBar = `
          <rect x="${x + barW + 4}" y="${ay}" width="${barW}" height="${ah}" fill="#CBD5E1" rx="3"/>
          <text x="${x + barW + 4 + barW / 2}" y="${ay - 4}" text-anchor="middle" style="font-size:9px;fill:#94a3b8;font-weight:600;">${item.avg}</text>`;
      }
      return `
        <rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${item.color}" rx="3"/>
        <text x="${x + barW / 2}" y="${y - 4}" text-anchor="middle" style="font-size:9px;fill:#334155;font-weight:600;">${item.val}</text>
        ${avgBar}
        <text x="${x + (stats ? barW + 2 : barW / 2)}" y="${H - 5}" text-anchor="middle" style="font-size:8px;fill:#94a3b8;">${item.label}</text>`;
    }).join('');

    const legend = stats ? `
      <g transform="translate(${W - 130},5)">
        <rect x="0" y="0" width="10" height="10" fill="#3B82F6" rx="2"/>
        <text x="14" y="9" style="font-size:9px;fill:#64748b;">This Service</text>
        <rect x="0" y="16" width="10" height="10" fill="#CBD5E1" rx="2"/>
        <text x="14" y="25" style="font-size:9px;fill:#64748b;">Year Avg</text>
      </g>` : '';

    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block;">${bars}${legend}</svg>`;
  }

  generatePdfHtml(
    report: ServiceReportDocument,
    stats?: PdfComparisonStats,
  ): string {
    const year = new Date(report.date).getFullYear();
    const reportedBy = report.reportedBy && typeof report.reportedBy === 'object'
      ? `${(report.reportedBy as any).firstName} ${(report.reportedBy as any).lastName}`
      : 'Unknown';
    const branch = report.branch && typeof report.branch === 'object'
      ? (report.branch as any).name
      : 'Main Branch';

    const fDate = new Date(report.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const sDate = new Date(report.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const total = report.totalAttendance;
    const adults = report.numberOfMales + report.numberOfFemales;
    const returning = total - report.numberOfFirstTimers;

    const prevHtml = stats?.previousReport ? (() => {
      const pDate = new Date(stats.previousReport.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const attDiff = report.totalAttendance - stats.previousReport.totalAttendance;
      const ftDiff = report.numberOfFirstTimers - stats.previousReport.numberOfFirstTimers;
      const attColor = attDiff >= 0 ? '#10B981' : '#EF4444';
      const ftColor = ftDiff >= 0 ? '#10B981' : '#EF4444';
      return `
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:12px 16px;margin-top:12px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:11px;color:#0369a1;font-weight:600;">&#8644; vs Previous Service</div>
          <div style="font-size:12px;color:#475569;margin-top:2px;">${stats.previousReport.serviceName} &middot; ${pDate}</div>
        </div>
        <div style="display:flex;gap:20px;">
          <div style="text-align:center;">
            <div style="font-size:10px;color:#64748b;">Attendance</div>
            <div style="font-size:16px;font-weight:700;color:${attColor};">${attDiff >= 0 ? '+' : ''}${attDiff}</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:10px;color:#64748b;">First Timers</div>
            <div style="font-size:16px;font-weight:700;color:${ftColor};">${ftDiff >= 0 ? '+' : ''}${ftDiff}</div>
          </div>
        </div>
      </div>`;
    })() : '';

    const tagsHtml = report.serviceTags?.length ? `
      <div style="margin-top:16px;">
        <div style="font-size:11px;font-weight:600;color:#475569;margin-bottom:6px;">Service Tags</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${report.serviceTags.map(t =>
            `<span style="background:#EEF2FF;color:#4338CA;padding:4px 10px;border-radius:12px;font-size:10px;font-weight:500;">&#127991; ${this.tagLabels[t] || t}</span>`
          ).join('')}
        </div>
      </div>` : '';

    const notesHtml = report.notes ? `
      <div style="background:#FFFBEB;border:1px solid #FCD34D;border-radius:8px;padding:14px 16px;margin-top:16px;">
        <div style="font-size:11px;font-weight:600;color:#92400E;margin-bottom:4px;">&#128221; Notes</div>
        <div style="font-size:12px;color:#78350F;line-height:1.6;white-space:pre-wrap;">${report.notes}</div>
      </div>` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${branch} | ${report.serviceName} - ${sDate}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#1e293b; background:#fff; font-size:13px; line-height:1.4; }
  .page { max-width:780px; margin:0 auto; }

  .hdr { background:linear-gradient(135deg,#1e40af 0%,#6366f1 100%); color:#fff; padding:24px 32px; position:relative; overflow:hidden; }
  .hdr::after { content:''; position:absolute; top:-40%; right:-15%; width:50%; height:180%; background:radial-gradient(ellipse,rgba(255,255,255,.08) 0%,transparent 70%); transform:rotate(-12deg); }
  .hdr-inner { position:relative; z-index:1; }
  .hdr-top { display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; }
  .hdr-brand { font-size:10px; text-transform:uppercase; letter-spacing:2px; opacity:.85; }
  .hdr-badge { background:rgba(255,255,255,.18); padding:4px 12px; border-radius:14px; font-size:10px; font-weight:500; }
  .hdr h1 { font-size:22px; font-weight:700; letter-spacing:-.3px; margin-bottom:4px; }
  .hdr-sub { font-size:13px; opacity:.9; }
  .hdr-meta { display:flex; gap:20px; margin-top:10px; font-size:11px; opacity:.85; }

  .kpi { background:#f8fafc; padding:16px 32px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; }
  .kpi-item { text-align:center; flex:1; }
  .kpi-val { font-size:26px; font-weight:800; color:#0f172a; line-height:1; }
  .kpi-val.blue { color:#2563eb; }
  .kpi-val.green { color:#10b981; }
  .kpi-lbl { font-size:10px; color:#64748b; font-weight:500; margin-top:3px; }

  .body { padding:20px 32px; }

  .section-title { font-size:13px; font-weight:700; color:#1e293b; margin-bottom:10px; padding-bottom:6px; border-bottom:2px solid #e2e8f0; display:flex; align-items:center; gap:8px; }
  .section-title::before { content:''; width:3px; height:14px; background:#2563eb; border-radius:2px; }

  .insights { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:20px; }
  .ins-card { background:#fff; border:1px solid #f1f5f9; border-radius:10px; padding:12px; display:flex; align-items:center; gap:10px; box-shadow:0 1px 2px rgba(0,0,0,.04); }
  .ins-icon { width:34px; height:34px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0; }
  .ins-val { font-size:18px; font-weight:700; color:#0f172a; line-height:1; }
  .ins-lbl { font-size:9px; color:#64748b; margin-top:1px; }

  .demo-grid { display:grid; grid-template-columns:160px 1fr; gap:20px; align-items:start; margin-bottom:20px; }
  .donut-wrap { background:#fff; border:1px solid #f1f5f9; border-radius:12px; padding:14px; box-shadow:0 1px 3px rgba(0,0,0,.06); text-align:center; }
  .demo-cards { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .demo-card { background:#fff; border:1px solid #f1f5f9; border-radius:8px; padding:10px 12px; display:flex; align-items:center; gap:10px; box-shadow:0 1px 2px rgba(0,0,0,.03); }
  .demo-dot { width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:15px; flex-shrink:0; }
  .demo-val { font-size:18px; font-weight:700; color:#0f172a; }
  .demo-pct { font-size:11px; color:#94a3b8; margin-left:2px; }
  .demo-lbl { font-size:10px; color:#64748b; }

  .chart-box { background:#fff; border:1px solid #f1f5f9; border-radius:10px; padding:16px; box-shadow:0 1px 2px rgba(0,0,0,.04); margin-bottom:20px; }
  .chart-title { font-size:11px; font-weight:600; color:#475569; margin-bottom:8px; }

  .ftr { background:#f8fafc; padding:14px 32px; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; }
  .ftr-brand { font-size:11px; color:#475569; font-weight:500; }
  .ftr-info { text-align:right; font-size:10px; color:#94a3b8; }

  @media print {
    body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .hdr { padding:18px 24px; }
    .body { padding:16px 24px; }
    .kpi { padding:12px 24px; }
    .ftr { padding:10px 24px; }
  }
  @page { margin:.4in; size:A4; }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="hdr">
    <div class="hdr-inner">
      <div class="hdr-top">
        <div class="hdr-brand">&#9962; The PowerPoint Tribe &mdash; ${branch}</div>
        <div class="hdr-badge">Service Report</div>
      </div>
      <h1>${report.serviceName}</h1>
      <div class="hdr-sub">${fDate}</div>
      <div class="hdr-meta">
        <span>&#128100; ${reportedBy}</span>
        <span>&#128197; Generated ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
      </div>
    </div>
  </div>

  <!-- KPIs -->
  <div class="kpi">
    <div class="kpi-item">
      <div class="kpi-val blue">${this.fmt(total)}</div>
      <div class="kpi-lbl">Total Attendance</div>
      ${stats ? this.delta(total, stats.averageAttendance) : ''}
    </div>
    <div class="kpi-item">
      <div class="kpi-val">${this.fmt(report.numberOfMales)}</div>
      <div class="kpi-lbl">Males</div>
    </div>
    <div class="kpi-item">
      <div class="kpi-val">${this.fmt(report.numberOfFemales)}</div>
      <div class="kpi-lbl">Females</div>
    </div>
    <div class="kpi-item">
      <div class="kpi-val">${this.fmt(report.numberOfChildren)}</div>
      <div class="kpi-lbl">Children</div>
    </div>
    <div class="kpi-item">
      <div class="kpi-val green">${this.fmt(report.numberOfFirstTimers)}</div>
      <div class="kpi-lbl">First Timers</div>
      ${stats ? this.delta(report.numberOfFirstTimers, stats.averageFirstTimers) : ''}
    </div>
  </div>

  <div class="body">

    <!-- Year Insights -->
    ${stats ? `
    <div class="section-title">${year} Performance Snapshot</div>
    <div class="insights">
      <div class="ins-card">
        <div class="ins-icon" style="background:rgba(59,130,246,.1);">&#128200;</div>
        <div><div class="ins-val">${this.fmt(Math.round(stats.averageAttendance))}</div><div class="ins-lbl">Avg Attendance</div></div>
      </div>
      <div class="ins-card">
        <div class="ins-icon" style="background:rgba(16,185,129,.1);">&#128640;</div>
        <div><div class="ins-val">${this.fmt(stats.highestAttendance)}</div><div class="ins-lbl">Highest</div></div>
      </div>
      <div class="ins-card">
        <div class="ins-icon" style="background:rgba(245,158,11,.1);">&#128202;</div>
        <div><div class="ins-val">${stats.totalReports}</div><div class="ins-lbl">Reports</div></div>
      </div>
      <div class="ins-card">
        <div class="ins-icon" style="background:rgba(236,72,153,.1);">&#10024;</div>
        <div><div class="ins-val">${((report.numberOfFirstTimers / Math.max(stats.averageFirstTimers, 0.1)) * 100).toFixed(0)}%</div><div class="ins-lbl">FT Rate vs Avg</div></div>
      </div>
    </div>
    ` : ''}

    <!-- Demographics -->
    <div class="section-title">Demographics</div>
    <div class="demo-grid">
      <div class="donut-wrap">
        ${this.buildDonut(report)}
        <div style="font-size:9px;color:#94a3b8;margin-top:6px;">Distribution</div>
      </div>
      <div class="demo-cards">
        <div class="demo-card">
          <div class="demo-dot" style="background:rgba(59,130,246,.1);">&#9794;</div>
          <div>
            <div class="demo-lbl">Males</div>
            <div><span class="demo-val">${report.numberOfMales}</span><span class="demo-pct">${this.pct(report.numberOfMales, total)}%</span></div>
            ${this.miniBar(report.numberOfMales, total, '#3B82F6')}
          </div>
        </div>
        <div class="demo-card">
          <div class="demo-dot" style="background:rgba(236,72,153,.1);">&#9792;</div>
          <div>
            <div class="demo-lbl">Females</div>
            <div><span class="demo-val">${report.numberOfFemales}</span><span class="demo-pct">${this.pct(report.numberOfFemales, total)}%</span></div>
            ${this.miniBar(report.numberOfFemales, total, '#EC4899')}
          </div>
        </div>
        <div class="demo-card">
          <div class="demo-dot" style="background:rgba(16,185,129,.1);">&#128118;</div>
          <div>
            <div class="demo-lbl">Children</div>
            <div><span class="demo-val">${report.numberOfChildren}</span><span class="demo-pct">${this.pct(report.numberOfChildren, total)}%</span></div>
            ${this.miniBar(report.numberOfChildren, total, '#10B981')}
          </div>
        </div>
        <div class="demo-card">
          <div class="demo-dot" style="background:rgba(245,158,11,.1);">&#127775;</div>
          <div>
            <div class="demo-lbl">First Timers</div>
            <div><span class="demo-val">${report.numberOfFirstTimers}</span><span class="demo-pct">${this.pct(report.numberOfFirstTimers, total)}%</span></div>
            ${this.miniBar(report.numberOfFirstTimers, total, '#F59E0B')}
          </div>
        </div>
      </div>
    </div>

    ${prevHtml}

    <!-- Comparison Chart -->
    ${stats ? `
    <div style="margin-top:20px;">
      <div class="section-title">Attendance Comparison (${year})</div>
      <div class="chart-box">
        <div class="chart-title">This Service vs ${year} Average</div>
        ${this.buildBarChart(report, stats)}
      </div>
      ${stats.monthlyTrend ? this.buildTrendSvg(stats.monthlyTrend) : ''}
    </div>
    ` : ''}

    ${tagsHtml}
    ${notesHtml}
  </div>

  <!-- Footer -->
  <div class="ftr">
    <div class="ftr-brand">&#9962; The PowerPoint Tribe</div>
    <div class="ftr-info">
      <div>Generated ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</div>
      <div style="font-family:monospace;margin-top:1px;">ID: ${(report as any)._id || 'N/A'}</div>
    </div>
  </div>

</div>
</body>
</html>`;
  }

  private buildDonut(report: ServiceReportDocument): string {
    const data = [
      { label: 'Males', value: report.numberOfMales, color: '#3B82F6' },
      { label: 'Females', value: report.numberOfFemales, color: '#EC4899' },
      { label: 'Children', value: report.numberOfChildren, color: '#10B981' },
    ];
    const total = report.totalAttendance;
    if (total === 0) {
      return `<svg viewBox="0 0 120 120" style="width:120px;height:120px;"><circle cx="60" cy="60" r="45" fill="#f1f5f9"/><text x="60" y="62" text-anchor="middle" style="font-size:11px;fill:#94a3b8;">No Data</text></svg>`;
    }

    const cx = 60, cy = 60, R = 48, r = 32;
    let cum = 0;
    const paths = data.filter(d => d.value > 0).map(d => {
      const pct = (d.value / total) * 100;
      const s = (cum / 100) * 360, e = ((cum + pct) / 100) * 360;
      const sr = (s - 90) * Math.PI / 180, er = (e - 90) * Math.PI / 180;
      const ox1 = cx + R * Math.cos(sr), oy1 = cy + R * Math.sin(sr);
      const ox2 = cx + R * Math.cos(er), oy2 = cy + R * Math.sin(er);
      const ix1 = cx + r * Math.cos(sr), iy1 = cy + r * Math.sin(sr);
      const ix2 = cx + r * Math.cos(er), iy2 = cy + r * Math.sin(er);
      const lg = pct > 50 ? 1 : 0;
      cum += pct;
      return `<path d="M${ox1},${oy1} A${R},${R} 0 ${lg} 1 ${ox2},${oy2} L${ix2},${iy2} A${r},${r} 0 ${lg} 0 ${ix1},${iy1}Z" fill="${d.color}" stroke="#fff" stroke-width="1.5"/>`;
    }).join('');

    return `<svg viewBox="0 0 120 120" style="width:120px;height:120px;">${paths}<circle cx="60" cy="60" r="28" fill="#fff"/><text x="60" y="56" text-anchor="middle" style="font-size:20px;font-weight:800;fill:#0f172a;">${total}</text><text x="60" y="70" text-anchor="middle" style="font-size:8px;fill:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Total</text></svg>`;
  }

  async generatePdf(
    report: ServiceReportDocument,
    stats?: PdfComparisonStats,
  ): Promise<string> {
    return this.generatePdfHtml(report, stats);
  }
}
