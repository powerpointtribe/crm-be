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

  private n(num: number): string {
    return num.toLocaleString('en-US');
  }

  private pct(v: number, t: number): string {
    return t > 0 ? ((v / t) * 100).toFixed(1) : '0';
  }

  private delta(cur: number, avg: number): string {
    if (!avg) return '';
    const d = cur - avg;
    const p = ((d / avg) * 100).toFixed(0);
    const up = d >= 0;
    return `<span style="font-size:10px;font-weight:600;color:${up ? '#059669' : '#DC2626'};">${up ? '▲' : '▼'} ${up ? '+' : ''}${p}%</span>`;
  }

  private donut(report: ServiceReportDocument): string {
    const segs = [
      { v: report.numberOfMales, c: '#6366F1', l: 'M' },
      { v: report.numberOfFemales, c: '#EC4899', l: 'F' },
      { v: report.numberOfChildren, c: '#14B8A6', l: 'C' },
    ];
    const total = report.totalAttendance;
    if (!total) return '<svg viewBox="0 0 80 80" width="80" height="80"><circle cx="40" cy="40" r="30" fill="#f1f5f9"/></svg>';

    const cx = 40, cy = 40, R = 36, r = 24;
    let cum = 0;
    const paths = segs.filter(s => s.v > 0).map(s => {
      const pct = (s.v / total) * 100;
      const s1 = (cum / 100) * 360, s2 = ((cum + pct) / 100) * 360;
      const a1 = (s1 - 90) * Math.PI / 180, a2 = (s2 - 90) * Math.PI / 180;
      const ox1 = cx + R * Math.cos(a1), oy1 = cy + R * Math.sin(a1);
      const ox2 = cx + R * Math.cos(a2), oy2 = cy + R * Math.sin(a2);
      const ix1 = cx + r * Math.cos(a1), iy1 = cy + r * Math.sin(a1);
      const ix2 = cx + r * Math.cos(a2), iy2 = cy + r * Math.sin(a2);
      const lg = pct > 50 ? 1 : 0;
      cum += pct;
      return `<path d="M${ox1},${oy1} A${R},${R} 0 ${lg} 1 ${ox2},${oy2} L${ix2},${iy2} A${r},${r} 0 ${lg} 0 ${ix1},${iy1}Z" fill="${s.c}"/>`;
    }).join('');

    return `<svg viewBox="0 0 80 80" width="80" height="80">${paths}<circle cx="40" cy="40" r="20" fill="#fff"/><text x="40" y="38" text-anchor="middle" style="font-size:14px;font-weight:700;fill:#1e293b;font-family:Inter,system-ui,sans-serif;">${total}</text><text x="40" y="48" text-anchor="middle" style="font-size:6px;fill:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;font-family:Inter,system-ui,sans-serif;">TOTAL</text></svg>`;
  }

  private bars(report: ServiceReportDocument, stats?: PdfComparisonStats): string {
    const items = [
      { l: 'Males', v: report.numberOfMales, a: stats ? Math.round(stats.averageMales) : 0, c: '#6366F1' },
      { l: 'Females', v: report.numberOfFemales, a: stats ? Math.round(stats.averageFemales) : 0, c: '#EC4899' },
      { l: 'Children', v: report.numberOfChildren, a: stats ? Math.round(stats.averageChildren) : 0, c: '#14B8A6' },
      { l: 'First Timers', v: report.numberOfFirstTimers, a: stats ? Math.round(stats.averageFirstTimers) : 0, c: '#F59E0B' },
    ];
    const max = Math.max(...items.map(i => Math.max(i.v, i.a)), 1);
    const W = 340, H = 110, PB = 18;
    const bw = stats ? 20 : 30, gap = stats ? 72 : 80;

    const b = items.map((it, i) => {
      const x = 25 + i * gap;
      const h = (it.v / max) * (H - 28 - PB);
      const y = H - PB - h;
      let ab = '';
      if (stats) {
        const ah = (it.a / max) * (H - 28 - PB);
        const ay = H - PB - ah;
        ab = `<rect x="${x + bw + 3}" y="${ay}" width="${bw}" height="${ah}" fill="#E2E8F0" rx="2"/><text x="${x + bw + 3 + bw / 2}" y="${ay - 3}" text-anchor="middle" style="font-size:7px;fill:#94a3b8;font-weight:600;font-family:Inter,system-ui,sans-serif;">${it.a}</text>`;
      }
      return `<rect x="${x}" y="${y}" width="${bw}" height="${h}" fill="${it.c}" rx="2"/><text x="${x + bw / 2}" y="${y - 3}" text-anchor="middle" style="font-size:7px;fill:#334155;font-weight:600;font-family:Inter,system-ui,sans-serif;">${it.v}</text>${ab}<text x="${x + (stats ? bw + 1 : bw / 2)}" y="${H - 5}" text-anchor="middle" style="font-size:6.5px;fill:#94a3b8;font-family:Inter,system-ui,sans-serif;">${it.l}</text>`;
    }).join('');

    const legend = stats ? `<g transform="translate(${W - 90},2)"><rect width="7" height="7" fill="#6366F1" rx="1"/><text x="10" y="6.5" style="font-size:6.5px;fill:#64748b;font-family:Inter,system-ui,sans-serif;">This Service</text><rect y="11" width="7" height="7" fill="#E2E8F0" rx="1"/><text x="10" y="17.5" style="font-size:6.5px;fill:#64748b;font-family:Inter,system-ui,sans-serif;">Year Avg</text></g>` : '';
    return `<svg viewBox="0 0 ${W} ${H}" width="100%">${b}${legend}</svg>`;
  }

  private trend(data: { month: string; attendance: number }[]): string {
    if (!data || data.length < 2) return '';
    const W = 340, H = 70, PL = 28, PR = 8, PT = 8, PB = 16;
    const gW = W - PL - PR, gH = H - PT - PB;
    const mx = Math.max(...data.map(d => d.attendance));
    const mn = Math.min(...data.map(d => d.attendance));
    const rng = mx - mn || 1;

    const pts = data.map((d, i) => ({
      x: PL + (i / (data.length - 1)) * gW,
      y: PT + gH - ((d.attendance - mn) / rng) * gH,
      ...d,
    }));

    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const area = `${line} L${pts[pts.length - 1].x},${PT + gH} L${pts[0].x},${PT + gH} Z`;
    const dots = pts.map(p => `<circle cx="${p.x}" cy="${p.y}" r="2" fill="#6366F1" stroke="#fff" stroke-width="1"/>`).join('');
    const labels = pts
      .filter((_, i) => i % Math.max(1, Math.ceil(pts.length / 6)) === 0 || i === pts.length - 1)
      .map(p => `<text x="${p.x}" y="${H - 3}" text-anchor="middle" style="font-size:6px;fill:#94a3b8;font-family:Inter,system-ui,sans-serif;">${p.month}</text>`)
      .join('');

    return `<svg viewBox="0 0 ${W} ${H}" width="100%"><defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6366F1" stop-opacity="0.15"/><stop offset="100%" stop-color="#6366F1" stop-opacity="0.01"/></linearGradient></defs><path d="${area}" fill="url(#tg)"/><path d="${line}" fill="none" stroke="#6366F1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>${dots}${labels}</svg>`;
  }

  generatePdfHtml(report: ServiceReportDocument, stats?: PdfComparisonStats): string {
    const year = new Date(report.date).getFullYear();
    const reportedBy = report.reportedBy && typeof report.reportedBy === 'object'
      ? `${(report.reportedBy as any).firstName} ${(report.reportedBy as any).lastName}`
      : 'Unknown';
    const branch = report.branch && typeof report.branch === 'object'
      ? (report.branch as any).name
      : 'Main Campus';
    const fDate = new Date(report.date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' });
    const total = report.totalAttendance;
    const adults = report.numberOfMales + report.numberOfFemales;

    const prevHtml = stats?.previousReport ? (() => {
      const pDate = new Date(stats.previousReport.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const attD = report.totalAttendance - stats.previousReport.totalAttendance;
      const ftD = report.numberOfFirstTimers - stats.previousReport.numberOfFirstTimers;
      return `<div style="display:flex;align-items:center;gap:12px;padding:8px 12px;background:#F0F9FF;border-radius:6px;margin-top:10px;">
        <div style="flex:1;"><span style="font-size:9px;font-weight:600;color:#0C4A6E;text-transform:uppercase;letter-spacing:.5px;">vs ${stats.previousReport.serviceName} (${pDate})</span></div>
        <div style="text-align:center;padding:0 10px;"><div style="font-size:8px;color:#64748b;">Attendance</div><div style="font-size:14px;font-weight:700;color:${attD >= 0 ? '#059669' : '#DC2626'};">${attD >= 0 ? '+' : ''}${attD}</div></div>
        <div style="text-align:center;padding:0 10px;"><div style="font-size:8px;color:#64748b;">First Timers</div><div style="font-size:14px;font-weight:700;color:${ftD >= 0 ? '#059669' : '#DC2626'};">${ftD >= 0 ? '+' : ''}${ftD}</div></div>
      </div>`;
    })() : '';

    const tags = report.serviceTags?.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:10px;">${report.serviceTags.map(t => `<span style="background:#EEF2FF;color:#4338CA;padding:2px 8px;border-radius:10px;font-size:8px;font-weight:500;">${this.tagLabels[t] || t}</span>`).join('')}</div>` : '';

    const notes = report.notes ? `<div style="background:#FFFBEB;border-left:3px solid #F59E0B;padding:8px 12px;margin-top:10px;border-radius:0 6px 6px 0;"><div style="font-size:8px;font-weight:600;color:#92400E;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;">Notes</div><div style="font-size:9px;color:#78350F;line-height:1.5;white-space:pre-wrap;">${report.notes}</div></div>` : '';

    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:Inter,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;background:#fff;font-size:10px;line-height:1.35;-webkit-font-smoothing:antialiased;}
.page{max-width:760px;margin:0 auto;}
</style></head><body><div class="page">

<!-- HEADER -->
<div class="header" style="background:linear-gradient(135deg,#312E81 0%,#4F46E5 50%,#6366F1 100%);color:#fff;padding:18px 24px 14px;position:relative;overflow:hidden;">
<div style="position:absolute;top:-30%;right:-10%;width:40%;height:160%;background:radial-gradient(ellipse,rgba(255,255,255,.06) 0%,transparent 70%);transform:rotate(-15deg);"></div>
<div style="position:relative;z-index:1;">
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
<div style="font-size:8px;text-transform:uppercase;letter-spacing:2.5px;opacity:.75;font-weight:500;">The PowerPoint Tribe • ${branch}</div>
<div style="background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.15);padding:3px 10px;border-radius:10px;font-size:8px;font-weight:500;letter-spacing:.3px;">Service Report</div>
</div>
<div style="font-size:18px;font-weight:700;letter-spacing:-.4px;margin-bottom:2px;">${report.serviceName}</div>
<div style="font-size:11px;opacity:.85;font-weight:400;">${fDate}</div>
<div style="display:flex;gap:16px;margin-top:6px;font-size:9px;opacity:.7;">
<span>Reported by ${reportedBy}</span>
<span>Generated ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
</div>
</div>
</div>

<!-- KPI STRIP -->
<div class="section" style="display:flex;border-bottom:1px solid #E2E8F0;background:#FAFBFC;">
<div style="flex:1;text-align:center;padding:10px 8px 8px;border-right:1px solid #F1F5F9;">
<div style="font-size:22px;font-weight:800;color:#4F46E5;line-height:1;">${this.n(total)}</div>
<div style="font-size:7.5px;color:#64748b;font-weight:500;text-transform:uppercase;letter-spacing:.8px;margin-top:2px;">Attendance</div>
${stats ? `<div style="margin-top:1px;">${this.delta(total, stats.averageAttendance)}</div>` : ''}
</div>
<div style="flex:1;text-align:center;padding:10px 8px 8px;border-right:1px solid #F1F5F9;">
<div style="font-size:22px;font-weight:800;color:#1e293b;line-height:1;">${this.n(adults)}</div>
<div style="font-size:7.5px;color:#64748b;font-weight:500;text-transform:uppercase;letter-spacing:.8px;margin-top:2px;">Adults</div>
</div>
<div style="flex:1;text-align:center;padding:10px 8px 8px;border-right:1px solid #F1F5F9;">
<div style="font-size:22px;font-weight:800;color:#14B8A6;line-height:1;">${this.n(report.numberOfChildren)}</div>
<div style="font-size:7.5px;color:#64748b;font-weight:500;text-transform:uppercase;letter-spacing:.8px;margin-top:2px;">Children</div>
</div>
<div style="flex:1;text-align:center;padding:10px 8px 8px;">
<div style="font-size:22px;font-weight:800;color:#F59E0B;line-height:1;">${this.n(report.numberOfFirstTimers)}</div>
<div style="font-size:7.5px;color:#64748b;font-weight:500;text-transform:uppercase;letter-spacing:.8px;margin-top:2px;">First Timers</div>
${stats ? `<div style="margin-top:1px;">${this.delta(report.numberOfFirstTimers, stats.averageFirstTimers)}</div>` : ''}
</div>
</div>

<!-- BODY -->
<div style="padding:14px 24px 10px;">

${stats ? `
<!-- YEAR INSIGHTS -->
<div class="section" style="margin-bottom:12px;">
<div style="font-size:9px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px;display:flex;align-items:center;gap:6px;"><div style="width:2px;height:10px;background:#4F46E5;border-radius:1px;"></div>${year} Performance</div>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
<div style="background:#F8FAFC;border:1px solid #F1F5F9;border-radius:8px;padding:8px 10px;">
<div style="font-size:16px;font-weight:700;color:#1e293b;line-height:1;">${this.n(Math.round(stats.averageAttendance))}</div>
<div style="font-size:7px;color:#64748b;margin-top:2px;font-weight:500;">Avg Attendance</div>
</div>
<div style="background:#F8FAFC;border:1px solid #F1F5F9;border-radius:8px;padding:8px 10px;">
<div style="font-size:16px;font-weight:700;color:#1e293b;line-height:1;">${this.n(stats.highestAttendance)}</div>
<div style="font-size:7px;color:#64748b;margin-top:2px;font-weight:500;">Peak</div>
</div>
<div style="background:#F8FAFC;border:1px solid #F1F5F9;border-radius:8px;padding:8px 10px;">
<div style="font-size:16px;font-weight:700;color:#1e293b;line-height:1;">${this.n(stats.lowestAttendance)}</div>
<div style="font-size:7px;color:#64748b;margin-top:2px;font-weight:500;">Lowest</div>
</div>
<div style="background:#F8FAFC;border:1px solid #F1F5F9;border-radius:8px;padding:8px 10px;">
<div style="font-size:16px;font-weight:700;color:#1e293b;line-height:1;">${stats.totalReports}</div>
<div style="font-size:7px;color:#64748b;margin-top:2px;font-weight:500;">Reports YTD</div>
</div>
</div>
</div>
` : ''}

<!-- DEMOGRAPHICS -->
<div class="section" style="margin-bottom:12px;">
<div style="font-size:9px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px;display:flex;align-items:center;gap:6px;"><div style="width:2px;height:10px;background:#4F46E5;border-radius:1px;"></div>Demographics</div>
<div style="display:flex;gap:14px;align-items:flex-start;">
<div style="text-align:center;flex-shrink:0;">
${this.donut(report)}
</div>
<div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:6px;">
<div style="display:flex;align-items:center;gap:8px;background:#F8FAFC;border-radius:6px;padding:6px 10px;">
<div style="width:6px;height:24px;background:#6366F1;border-radius:3px;flex-shrink:0;"></div>
<div><div style="font-size:14px;font-weight:700;color:#1e293b;">${report.numberOfMales} <span style="font-size:9px;color:#94a3b8;font-weight:400;">${this.pct(report.numberOfMales, total)}%</span></div><div style="font-size:7.5px;color:#64748b;">Males</div></div>
</div>
<div style="display:flex;align-items:center;gap:8px;background:#F8FAFC;border-radius:6px;padding:6px 10px;">
<div style="width:6px;height:24px;background:#EC4899;border-radius:3px;flex-shrink:0;"></div>
<div><div style="font-size:14px;font-weight:700;color:#1e293b;">${report.numberOfFemales} <span style="font-size:9px;color:#94a3b8;font-weight:400;">${this.pct(report.numberOfFemales, total)}%</span></div><div style="font-size:7.5px;color:#64748b;">Females</div></div>
</div>
<div style="display:flex;align-items:center;gap:8px;background:#F8FAFC;border-radius:6px;padding:6px 10px;">
<div style="width:6px;height:24px;background:#14B8A6;border-radius:3px;flex-shrink:0;"></div>
<div><div style="font-size:14px;font-weight:700;color:#1e293b;">${report.numberOfChildren} <span style="font-size:9px;color:#94a3b8;font-weight:400;">${this.pct(report.numberOfChildren, total)}%</span></div><div style="font-size:7.5px;color:#64748b;">Children</div></div>
</div>
<div style="display:flex;align-items:center;gap:8px;background:#F8FAFC;border-radius:6px;padding:6px 10px;">
<div style="width:6px;height:24px;background:#F59E0B;border-radius:3px;flex-shrink:0;"></div>
<div><div style="font-size:14px;font-weight:700;color:#1e293b;">${report.numberOfFirstTimers} <span style="font-size:9px;color:#94a3b8;font-weight:400;">${this.pct(report.numberOfFirstTimers, total)}%</span></div><div style="font-size:7.5px;color:#64748b;">First Timers</div></div>
</div>
</div>
</div>
</div>

${prevHtml}

${stats ? `
<!-- COMPARISON CHART -->
<div class="section" style="margin-top:12px;">
<div style="font-size:9px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px;display:flex;align-items:center;gap:6px;"><div style="width:2px;height:10px;background:#4F46E5;border-radius:1px;"></div>This Service vs ${year} Average</div>
<div style="background:#F8FAFC;border:1px solid #F1F5F9;border-radius:8px;padding:10px 12px;">
${this.bars(report, stats)}
</div>
</div>

${stats.monthlyTrend && stats.monthlyTrend.length >= 2 ? `
<!-- TREND -->
<div class="section" style="margin-top:12px;">
<div style="font-size:9px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px;display:flex;align-items:center;gap:6px;"><div style="width:2px;height:10px;background:#4F46E5;border-radius:1px;"></div>Attendance Trend</div>
<div style="background:#F8FAFC;border:1px solid #F1F5F9;border-radius:8px;padding:10px 12px;">
${this.trend(stats.monthlyTrend)}
</div>
</div>
` : ''}
` : ''}

${tags}
${notes}

</div>

<!-- FOOTER -->
<div class="footer" style="border-top:1px solid #E2E8F0;padding:8px 24px;display:flex;justify-content:space-between;align-items:center;background:#FAFBFC;">
<div style="font-size:8px;color:#94a3b8;font-weight:500;">The PowerPoint Tribe • ${branch}</div>
<div style="font-size:7px;color:#CBD5E1;font-family:monospace;">ID: ${(report as any)._id || 'N/A'}</div>
</div>

</div></body></html>`;
  }

  async generatePdf(report: ServiceReportDocument, stats?: PdfComparisonStats): Promise<string> {
    return this.generatePdfHtml(report, stats);
  }
}
