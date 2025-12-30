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

  private generateDonutChart(report: ServiceReportDocument): string {
    const data = [
      { label: 'Males', value: report.numberOfMales, color: '#3B82F6' },
      { label: 'Females', value: report.numberOfFemales, color: '#EC4899' },
      { label: 'Children', value: report.numberOfChildren, color: '#10B981' },
    ];

    const total = report.totalAttendance;
    if (total === 0) {
      return `<svg viewBox="0 0 200 200" class="donut-chart">
        <circle cx="100" cy="100" r="70" fill="#f1f5f9" />
        <text x="100" y="100" text-anchor="middle" dy="0.3em" class="donut-center-text">No Data</text>
      </svg>`;
    }

    const center = 100;
    const outerRadius = 80;
    const innerRadius = 50;
    let cumulativePercentage = 0;

    const paths = data
      .filter((item) => item.value > 0)
      .map((item) => {
        const percentage = (item.value / total) * 100;
        const startAngle = (cumulativePercentage / 100) * 360;
        const endAngle = ((cumulativePercentage + percentage) / 100) * 360;

        const startAngleRad = (startAngle - 90) * (Math.PI / 180);
        const endAngleRad = (endAngle - 90) * (Math.PI / 180);

        const outerX1 = center + outerRadius * Math.cos(startAngleRad);
        const outerY1 = center + outerRadius * Math.sin(startAngleRad);
        const outerX2 = center + outerRadius * Math.cos(endAngleRad);
        const outerY2 = center + outerRadius * Math.sin(endAngleRad);

        const innerX1 = center + innerRadius * Math.cos(startAngleRad);
        const innerY1 = center + innerRadius * Math.sin(startAngleRad);
        const innerX2 = center + innerRadius * Math.cos(endAngleRad);
        const innerY2 = center + innerRadius * Math.sin(endAngleRad);

        const largeArcFlag = percentage > 50 ? 1 : 0;

        cumulativePercentage += percentage;

        return `<path d="M ${outerX1} ${outerY1} A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerX2} ${outerY2} L ${innerX2} ${innerY2} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerX1} ${innerY1} Z" fill="${item.color}" stroke="white" stroke-width="2">
          <title>${item.label}: ${item.value} (${percentage.toFixed(1)}%)</title>
        </path>`;
      })
      .join('');

    return `
      <svg viewBox="0 0 200 200" class="donut-chart">
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.15"/>
          </filter>
        </defs>
        <g filter="url(#shadow)">
          ${paths}
        </g>
        <circle cx="100" cy="100" r="45" fill="white" />
        <text x="100" y="92" text-anchor="middle" class="donut-center-value">${total}</text>
        <text x="100" y="112" text-anchor="middle" class="donut-center-label">Total</text>
      </svg>
    `;
  }

  private generateBarChart(
    report: ServiceReportDocument,
    stats?: PdfComparisonStats,
  ): string {
    const currentData = [
      { label: 'Males', value: report.numberOfMales, color: '#3B82F6' },
      { label: 'Females', value: report.numberOfFemales, color: '#EC4899' },
      { label: 'Children', value: report.numberOfChildren, color: '#10B981' },
      {
        label: 'First Timers',
        value: report.numberOfFirstTimers,
        color: '#F59E0B',
      },
    ];

    const avgData = stats
      ? [
          { label: 'Males', value: Math.round(stats.averageMales) },
          { label: 'Females', value: Math.round(stats.averageFemales) },
          { label: 'Children', value: Math.round(stats.averageChildren) },
          { label: 'First Timers', value: Math.round(stats.averageFirstTimers) },
        ]
      : null;

    const maxValue = Math.max(
      ...currentData.map((d) => d.value),
      ...(avgData ? avgData.map((d) => d.value) : [0]),
    );
    const chartHeight = 180;
    const chartWidth = 400;
    const barWidth = avgData ? 35 : 50;
    const groupGap = avgData ? 80 : 90;
    const startX = 50;

    const bars = currentData
      .map((item, index) => {
        const x = startX + index * groupGap;
        const barHeight = maxValue > 0 ? (item.value / maxValue) * chartHeight : 0;
        const y = 200 - barHeight;

        let avgBar = '';
        if (avgData) {
          const avgHeight =
            maxValue > 0 ? (avgData[index].value / maxValue) * chartHeight : 0;
          const avgY = 200 - avgHeight;
          avgBar = `
            <rect x="${x + barWidth + 5}" y="${avgY}" width="${barWidth}" height="${avgHeight}" fill="#CBD5E1" rx="4">
              <title>Avg ${avgData[index].label}: ${avgData[index].value}</title>
            </rect>
            <text x="${x + barWidth + 5 + barWidth / 2}" y="${avgY - 5}" text-anchor="middle" class="bar-value" fill="#64748b">${avgData[index].value}</text>
          `;
        }

        return `
          <g class="bar-group">
            <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${item.color}" rx="4">
              <title>${item.label}: ${item.value}</title>
            </rect>
            <text x="${x + barWidth / 2}" y="${y - 5}" text-anchor="middle" class="bar-value">${item.value}</text>
            ${avgBar}
            <text x="${x + (avgData ? barWidth + 2.5 : barWidth / 2)}" y="220" text-anchor="middle" class="bar-label">${item.label}</text>
          </g>
        `;
      })
      .join('');

    const legend = avgData
      ? `
      <g class="chart-legend" transform="translate(${chartWidth - 150}, 10)">
        <rect x="0" y="0" width="12" height="12" fill="#3B82F6" rx="2"/>
        <text x="18" y="10" class="legend-text">This Service</text>
        <rect x="0" y="20" width="12" height="12" fill="#CBD5E1" rx="2"/>
        <text x="18" y="30" class="legend-text">Average</text>
      </g>
    `
      : '';

    return `
      <svg viewBox="0 0 ${chartWidth + 50} 250" class="bar-chart">
        <defs>
          <linearGradient id="gridGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#f8fafc;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#f1f5f9;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect x="40" y="10" width="${chartWidth - 30}" height="200" fill="url(#gridGradient)" rx="8"/>
        <!-- Grid lines -->
        <line x1="40" y1="60" x2="${chartWidth + 10}" y2="60" stroke="#e2e8f0" stroke-dasharray="4"/>
        <line x1="40" y1="110" x2="${chartWidth + 10}" y2="110" stroke="#e2e8f0" stroke-dasharray="4"/>
        <line x1="40" y1="160" x2="${chartWidth + 10}" y2="160" stroke="#e2e8f0" stroke-dasharray="4"/>
        ${bars}
        ${legend}
      </svg>
    `;
  }

  private generateTrendChart(monthlyTrend?: { month: string; attendance: number }[]): string {
    if (!monthlyTrend || monthlyTrend.length < 2) {
      return '';
    }

    const chartWidth = 500;
    const chartHeight = 150;
    const padding = { top: 20, right: 30, bottom: 40, left: 50 };
    const graphWidth = chartWidth - padding.left - padding.right;
    const graphHeight = chartHeight - padding.top - padding.bottom;

    const maxAttendance = Math.max(...monthlyTrend.map((d) => d.attendance));
    const minAttendance = Math.min(...monthlyTrend.map((d) => d.attendance));
    const range = maxAttendance - minAttendance || 1;

    const points = monthlyTrend.map((d, i) => {
      const x = padding.left + (i / (monthlyTrend.length - 1)) * graphWidth;
      const y =
        padding.top +
        graphHeight -
        ((d.attendance - minAttendance) / range) * graphHeight;
      return { x, y, ...d };
    });

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + graphHeight} L ${points[0].x} ${padding.top + graphHeight} Z`;

    const dots = points
      .map(
        (p) => `
        <circle cx="${p.x}" cy="${p.y}" r="4" fill="#3B82F6" stroke="white" stroke-width="2">
          <title>${p.month}: ${p.attendance}</title>
        </circle>
      `,
      )
      .join('');

    const labels = points
      .filter((_, i) => i % Math.ceil(points.length / 6) === 0 || i === points.length - 1)
      .map(
        (p) => `
        <text x="${p.x}" y="${chartHeight - 10}" text-anchor="middle" class="trend-label">${p.month}</text>
      `,
      )
      .join('');

    return `
      <div class="trend-section">
        <h3 class="section-title">Attendance Trend (Last ${monthlyTrend.length} Months)</h3>
        <svg viewBox="0 0 ${chartWidth} ${chartHeight}" class="trend-chart">
          <defs>
            <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:#3B82F6;stop-opacity:0.3" />
              <stop offset="100%" style="stop-color:#3B82F6;stop-opacity:0.05" />
            </linearGradient>
          </defs>
          <rect x="${padding.left}" y="${padding.top}" width="${graphWidth}" height="${graphHeight}" fill="#f8fafc" rx="4"/>
          <path d="${areaPath}" fill="url(#areaGradient)" />
          <path d="${linePath}" fill="none" stroke="#3B82F6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          ${dots}
          ${labels}
          <text x="15" y="${padding.top + graphHeight / 2}" text-anchor="middle" transform="rotate(-90, 15, ${padding.top + graphHeight / 2})" class="axis-label">Attendance</text>
        </svg>
      </div>
    `;
  }

  private generateComparisonIndicator(
    current: number,
    average: number,
    label: string,
  ): string {
    if (average === 0) return '';

    const diff = current - average;
    const percentChange = ((diff / average) * 100).toFixed(1);
    const isPositive = diff >= 0;
    const color = isPositive ? '#10B981' : '#EF4444';
    const arrow = isPositive ? '&#9650;' : '&#9660;';

    return `
      <div class="comparison-indicator ${isPositive ? 'positive' : 'negative'}">
        <span class="indicator-arrow" style="color: ${color}">${arrow}</span>
        <span class="indicator-value" style="color: ${color}">${isPositive ? '+' : ''}${percentChange}%</span>
        <span class="indicator-label">vs avg ${label}</span>
      </div>
    `;
  }

  private formatNumber(num: number): string {
    return num.toLocaleString('en-US');
  }

  generatePdfHtml(
    report: ServiceReportDocument,
    stats?: PdfComparisonStats,
  ): string {
    const reportedByName =
      report.reportedBy && typeof report.reportedBy === 'object'
        ? `${(report.reportedBy as any).firstName} ${(report.reportedBy as any).lastName}`
        : 'Unknown Reporter';

    const branchName =
      report.branch && typeof report.branch === 'object'
        ? (report.branch as any).name
        : 'Main Branch';

    const formattedDate = new Date(report.date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const shortDate = new Date(report.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const malePercentage =
      report.totalAttendance > 0
        ? ((report.numberOfMales / report.totalAttendance) * 100).toFixed(1)
        : '0';
    const femalePercentage =
      report.totalAttendance > 0
        ? ((report.numberOfFemales / report.totalAttendance) * 100).toFixed(1)
        : '0';
    const childrenPercentage =
      report.totalAttendance > 0
        ? ((report.numberOfChildren / report.totalAttendance) * 100).toFixed(1)
        : '0';
    const firstTimerPercentage =
      report.totalAttendance > 0
        ? ((report.numberOfFirstTimers / report.totalAttendance) * 100).toFixed(1)
        : '0';
    const adultsCount = report.numberOfMales + report.numberOfFemales;
    const adultsPercentage =
      report.totalAttendance > 0
        ? ((adultsCount / report.totalAttendance) * 100).toFixed(1)
        : '0';
    const returningMembers = report.totalAttendance - report.numberOfFirstTimers;

    const attendanceVsAvg = stats
      ? this.generateComparisonIndicator(
          report.totalAttendance,
          stats.averageAttendance,
          '',
        )
      : '';

    const firstTimersVsAvg = stats
      ? this.generateComparisonIndicator(
          report.numberOfFirstTimers,
          stats.averageFirstTimers,
          '',
        )
      : '';

    const previousCompareHtml =
      stats?.previousReport
        ? `
      <div class="previous-compare">
        <div class="compare-header">
          <span class="compare-icon">&#8644;</span>
          <span>Compared to Previous Service</span>
        </div>
        <div class="compare-details">
          <div class="compare-item">
            <span class="compare-label">${stats.previousReport.serviceName}</span>
            <span class="compare-date">${new Date(stats.previousReport.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          </div>
          <div class="compare-metrics">
            <div class="compare-metric">
              <span class="metric-label">Attendance</span>
              <span class="metric-diff ${report.totalAttendance >= stats.previousReport.totalAttendance ? 'positive' : 'negative'}">
                ${report.totalAttendance >= stats.previousReport.totalAttendance ? '+' : ''}${report.totalAttendance - stats.previousReport.totalAttendance}
              </span>
            </div>
            <div class="compare-metric">
              <span class="metric-label">First Timers</span>
              <span class="metric-diff ${report.numberOfFirstTimers >= stats.previousReport.numberOfFirstTimers ? 'positive' : 'negative'}">
                ${report.numberOfFirstTimers >= stats.previousReport.numberOfFirstTimers ? '+' : ''}${report.numberOfFirstTimers - stats.previousReport.numberOfFirstTimers}
              </span>
            </div>
          </div>
        </div>
      </div>
    `
        : '';

    const statsInsightsHtml = stats
      ? `
      <div class="insights-section">
        <h3 class="section-title">Performance Insights</h3>
        <div class="insights-grid">
          <div class="insight-card">
            <div class="insight-icon blue">&#128200;</div>
            <div class="insight-content">
              <div class="insight-value">${this.formatNumber(Math.round(stats.averageAttendance))}</div>
              <div class="insight-label">Average Attendance</div>
            </div>
          </div>
          <div class="insight-card">
            <div class="insight-icon green">&#128640;</div>
            <div class="insight-content">
              <div class="insight-value">${this.formatNumber(stats.highestAttendance)}</div>
              <div class="insight-label">Highest Recorded</div>
            </div>
          </div>
          <div class="insight-card">
            <div class="insight-icon amber">&#128202;</div>
            <div class="insight-content">
              <div class="insight-value">${stats.totalReports}</div>
              <div class="insight-label">Total Reports</div>
            </div>
          </div>
          <div class="insight-card">
            <div class="insight-icon pink">&#10024;</div>
            <div class="insight-content">
              <div class="insight-value">${((report.numberOfFirstTimers / Math.max(stats.averageFirstTimers, 0.1)) * 100).toFixed(0)}%</div>
              <div class="insight-label">First Timer Rate vs Avg</div>
            </div>
          </div>
        </div>
      </div>
    `
      : '';

    const trendChartHtml = this.generateTrendChart(stats?.monthlyTrend);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>The PowerPoint Tribe - ${branchName} | ${report.serviceName} - ${shortDate}</title>
    <style>
        :root {
            --primary: #2563EB;
            --primary-dark: #1E40AF;
            --primary-light: #DBEAFE;
            --secondary: #7C3AED;
            --success: #10B981;
            --warning: #F59E0B;
            --danger: #EF4444;
            --pink: #EC4899;
            --gray-50: #F9FAFB;
            --gray-100: #F3F4F6;
            --gray-200: #E5E7EB;
            --gray-300: #D1D5DB;
            --gray-400: #9CA3AF;
            --gray-500: #6B7280;
            --gray-600: #4B5563;
            --gray-700: #374151;
            --gray-800: #1F2937;
            --gray-900: #111827;
            --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
            --shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);
            --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
            --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.5;
            color: var(--gray-800);
            background: white;
            font-size: 14px;
        }

        .container {
            max-width: 850px;
            margin: 0 auto;
            padding: 0;
        }

        /* Header Styles */
        .header {
            background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
            color: white;
            padding: 30px 40px;
            position: relative;
            overflow: hidden;
        }

        .header::before {
            content: '';
            position: absolute;
            top: -50%;
            right: -20%;
            width: 60%;
            height: 200%;
            background: radial-gradient(ellipse, rgba(255,255,255,0.1) 0%, transparent 70%);
            transform: rotate(-15deg);
        }

        .header-content {
            position: relative;
            z-index: 1;
        }

        .header-top {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 20px;
        }

        .brand {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .brand-logo {
            width: 50px;
            height: 50px;
            background: rgba(255,255,255,0.2);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
        }

        .brand-text {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 2px;
            opacity: 0.9;
        }

        .report-badge {
            background: rgba(255,255,255,0.2);
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
            backdrop-filter: blur(10px);
        }

        .header-main {
            margin-bottom: 15px;
        }

        .header-main h1 {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
            letter-spacing: -0.5px;
        }

        .header-subtitle {
            font-size: 16px;
            opacity: 0.9;
            font-weight: 400;
        }

        .header-meta {
            display: flex;
            gap: 25px;
            flex-wrap: wrap;
        }

        .meta-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            opacity: 0.9;
        }

        .meta-icon {
            font-size: 16px;
        }

        /* Executive Summary */
        .executive-summary {
            background: var(--gray-50);
            padding: 25px 40px;
            border-bottom: 1px solid var(--gray-200);
        }

        .summary-title {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            color: var(--gray-500);
            margin-bottom: 15px;
            font-weight: 600;
        }

        .summary-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 20px;
        }

        .summary-item {
            text-align: center;
        }

        .summary-value {
            font-size: 32px;
            font-weight: 800;
            color: var(--gray-900);
            line-height: 1;
            margin-bottom: 4px;
        }

        .summary-label {
            font-size: 12px;
            color: var(--gray-500);
            font-weight: 500;
        }

        .summary-item.highlight .summary-value {
            color: var(--primary);
        }

        .summary-item.accent .summary-value {
            color: var(--success);
        }

        .comparison-indicator {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 11px;
            margin-top: 4px;
            padding: 2px 8px;
            border-radius: 10px;
            background: var(--gray-100);
        }

        .comparison-indicator.positive {
            background: rgba(16, 185, 129, 0.1);
        }

        .comparison-indicator.negative {
            background: rgba(239, 68, 68, 0.1);
        }

        /* Main Content */
        .main-content {
            padding: 30px 40px;
        }

        .section {
            margin-bottom: 35px;
        }

        .section:last-child {
            margin-bottom: 0;
        }

        .section-title {
            font-size: 16px;
            font-weight: 700;
            color: var(--gray-800);
            margin-bottom: 18px;
            padding-bottom: 10px;
            border-bottom: 2px solid var(--gray-200);
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .section-title::before {
            content: '';
            width: 4px;
            height: 20px;
            background: var(--primary);
            border-radius: 2px;
        }

        /* Demographics Section */
        .demographics-container {
            display: grid;
            grid-template-columns: 220px 1fr;
            gap: 30px;
            align-items: start;
        }

        .donut-container {
            background: white;
            border-radius: 16px;
            padding: 20px;
            box-shadow: var(--shadow-md);
            border: 1px solid var(--gray-100);
        }

        .donut-chart {
            width: 180px;
            height: 180px;
            display: block;
            margin: 0 auto;
        }

        .donut-center-value {
            font-size: 28px;
            font-weight: 800;
            fill: var(--gray-900);
        }

        .donut-center-label {
            font-size: 11px;
            fill: var(--gray-500);
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .demographics-details {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
        }

        .demo-card {
            background: white;
            border-radius: 12px;
            padding: 18px;
            box-shadow: var(--shadow);
            border: 1px solid var(--gray-100);
            display: flex;
            align-items: center;
            gap: 15px;
            transition: transform 0.2s, box-shadow 0.2s;
        }

        .demo-icon {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
            flex-shrink: 0;
        }

        .demo-icon.male { background: rgba(59, 130, 246, 0.1); }
        .demo-icon.female { background: rgba(236, 72, 153, 0.1); }
        .demo-icon.children { background: rgba(16, 185, 129, 0.1); }
        .demo-icon.first-timer { background: rgba(245, 158, 11, 0.1); }
        .demo-icon.adults { background: rgba(124, 58, 237, 0.1); }
        .demo-icon.returning { background: rgba(20, 184, 166, 0.1); }

        .demo-info {
            flex: 1;
        }

        .demo-label {
            font-size: 12px;
            color: var(--gray-500);
            font-weight: 500;
            margin-bottom: 2px;
        }

        .demo-value {
            font-size: 24px;
            font-weight: 700;
            color: var(--gray-900);
            line-height: 1;
        }

        .demo-percent {
            font-size: 13px;
            color: var(--gray-400);
            font-weight: 500;
            margin-left: 4px;
        }

        .demo-bar {
            height: 4px;
            background: var(--gray-100);
            border-radius: 2px;
            margin-top: 8px;
            overflow: hidden;
        }

        .demo-bar-fill {
            height: 100%;
            border-radius: 2px;
            transition: width 0.3s ease;
        }

        .demo-bar-fill.male { background: #3B82F6; }
        .demo-bar-fill.female { background: #EC4899; }
        .demo-bar-fill.children { background: #10B981; }
        .demo-bar-fill.first-timer { background: #F59E0B; }
        .demo-bar-fill.adults { background: #7C3AED; }
        .demo-bar-fill.returning { background: #14B8A6; }

        /* Comparison Bar Chart */
        .chart-section {
            background: white;
            border-radius: 16px;
            padding: 25px;
            box-shadow: var(--shadow-md);
            border: 1px solid var(--gray-100);
            margin-bottom: 25px;
        }

        .chart-title {
            font-size: 14px;
            font-weight: 600;
            color: var(--gray-700);
            margin-bottom: 15px;
        }

        .bar-chart {
            width: 100%;
            max-width: 500px;
            height: auto;
            display: block;
            margin: 0 auto;
        }

        .bar-value {
            font-size: 11px;
            font-weight: 600;
            fill: var(--gray-700);
        }

        .bar-label {
            font-size: 10px;
            fill: var(--gray-500);
            font-weight: 500;
        }

        .legend-text {
            font-size: 10px;
            fill: var(--gray-600);
        }

        /* Trend Chart */
        .trend-section {
            margin-top: 25px;
        }

        .trend-chart {
            width: 100%;
            max-width: 550px;
            height: auto;
            display: block;
            margin: 0 auto;
        }

        .trend-label {
            font-size: 10px;
            fill: var(--gray-500);
        }

        .axis-label {
            font-size: 10px;
            fill: var(--gray-500);
            font-weight: 500;
        }

        /* Insights Section */
        .insights-section {
            margin-bottom: 25px;
        }

        .insights-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
        }

        .insight-card {
            background: white;
            border-radius: 12px;
            padding: 16px;
            box-shadow: var(--shadow);
            border: 1px solid var(--gray-100);
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .insight-icon {
            width: 40px;
            height: 40px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            flex-shrink: 0;
        }

        .insight-icon.blue { background: rgba(59, 130, 246, 0.1); }
        .insight-icon.green { background: rgba(16, 185, 129, 0.1); }
        .insight-icon.amber { background: rgba(245, 158, 11, 0.1); }
        .insight-icon.pink { background: rgba(236, 72, 153, 0.1); }

        .insight-value {
            font-size: 20px;
            font-weight: 700;
            color: var(--gray-900);
            line-height: 1;
        }

        .insight-label {
            font-size: 11px;
            color: var(--gray-500);
            margin-top: 2px;
        }

        /* Previous Compare */
        .previous-compare {
            background: linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 100%);
            border: 1px solid #BAE6FD;
            border-radius: 12px;
            padding: 18px;
            margin-top: 20px;
        }

        .compare-header {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            font-weight: 600;
            color: var(--primary-dark);
            margin-bottom: 12px;
        }

        .compare-icon {
            font-size: 16px;
        }

        .compare-details {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .compare-item {
            display: flex;
            flex-direction: column;
        }

        .compare-label {
            font-size: 14px;
            font-weight: 600;
            color: var(--gray-800);
        }

        .compare-date {
            font-size: 12px;
            color: var(--gray-500);
        }

        .compare-metrics {
            display: flex;
            gap: 25px;
        }

        .compare-metric {
            text-align: center;
        }

        .metric-label {
            font-size: 11px;
            color: var(--gray-500);
            display: block;
            margin-bottom: 2px;
        }

        .metric-diff {
            font-size: 18px;
            font-weight: 700;
        }

        .metric-diff.positive { color: var(--success); }
        .metric-diff.negative { color: var(--danger); }

        /* Tags Section */
        .tags-section {
            margin-top: 25px;
        }

        .tags-container {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }

        .tag {
            background: linear-gradient(135deg, var(--primary-light) 0%, #C7D2FE 100%);
            color: var(--primary-dark);
            padding: 8px 16px;
            border-radius: 25px;
            font-size: 13px;
            font-weight: 500;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            border: 1px solid rgba(37, 99, 235, 0.2);
        }

        .tag-icon {
            font-size: 14px;
        }

        /* Notes Section */
        .notes-section {
            background: linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%);
            border: 1px solid #FCD34D;
            border-radius: 12px;
            padding: 20px;
            margin-top: 25px;
        }

        .notes-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
        }

        .notes-icon {
            font-size: 18px;
        }

        .notes-title {
            font-size: 14px;
            font-weight: 600;
            color: #92400E;
        }

        .notes-content {
            color: #78350F;
            line-height: 1.7;
            white-space: pre-wrap;
            font-size: 14px;
        }

        /* Footer */
        .footer {
            background: var(--gray-50);
            padding: 25px 40px;
            border-top: 1px solid var(--gray-200);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .footer-brand {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .footer-logo {
            width: 32px;
            height: 32px;
            background: var(--primary);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 14px;
        }

        .footer-text {
            font-size: 12px;
            color: var(--gray-600);
            font-weight: 500;
        }

        .footer-info {
            text-align: right;
        }

        .footer-generated {
            font-size: 11px;
            color: var(--gray-500);
        }

        .footer-id {
            font-size: 10px;
            color: var(--gray-400);
            font-family: 'Courier New', monospace;
            margin-top: 2px;
        }

        /* Print Styles */
        @media print {
            body {
                font-size: 12px;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }

            .header {
                padding: 20px 30px;
            }

            .main-content {
                padding: 20px 30px;
            }

            .executive-summary {
                padding: 20px 30px;
            }

            .footer {
                padding: 15px 30px;
            }

            .demo-card,
            .insight-card,
            .chart-section {
                break-inside: avoid;
            }

            .section {
                break-inside: avoid;
            }

            .summary-grid {
                grid-template-columns: repeat(5, 1fr);
            }

            .demographics-container {
                grid-template-columns: 200px 1fr;
            }

            .insights-grid {
                grid-template-columns: repeat(4, 1fr);
            }
        }

        @page {
            margin: 0.5in;
            size: A4;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <header class="header">
            <div class="header-content">
                <div class="header-top">
                    <div class="brand">
                        <div class="brand-logo">&#9962;</div>
                        <div class="brand-text">The PowerPoint Tribe - ${branchName}</div>
                    </div>
                    <div class="report-badge">Service Report</div>
                </div>
                <div class="header-main">
                    <h1>${report.serviceName}</h1>
                    <div class="header-subtitle">${formattedDate}</div>
                </div>
                <div class="header-meta">
                    <div class="meta-item">
                        <span class="meta-icon">&#128100;</span>
                        <span>Reported by ${reportedByName}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-icon">&#128197;</span>
                        <span>Generated ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                </div>
            </div>
        </header>

        <!-- Executive Summary -->
        <div class="executive-summary">
            <div class="summary-title">Executive Summary</div>
            <div class="summary-grid">
                <div class="summary-item highlight">
                    <div class="summary-value">${this.formatNumber(report.totalAttendance)}</div>
                    <div class="summary-label">Total Attendance</div>
                    ${attendanceVsAvg}
                </div>
                <div class="summary-item">
                    <div class="summary-value">${this.formatNumber(adultsCount)}</div>
                    <div class="summary-label">Adults</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">${this.formatNumber(report.numberOfChildren)}</div>
                    <div class="summary-label">Children</div>
                </div>
                <div class="summary-item accent">
                    <div class="summary-value">${this.formatNumber(report.numberOfFirstTimers)}</div>
                    <div class="summary-label">First Timers</div>
                    ${firstTimersVsAvg}
                </div>
                <div class="summary-item">
                    <div class="summary-value">${this.formatNumber(returningMembers)}</div>
                    <div class="summary-label">Returning</div>
                </div>
            </div>
        </div>

        <!-- Main Content -->
        <main class="main-content">
            <!-- Performance Insights -->
            ${statsInsightsHtml}

            <!-- Demographics Section -->
            <div class="section">
                <h3 class="section-title">Attendance Demographics</h3>
                <div class="demographics-container">
                    <div class="donut-container">
                        ${this.generateDonutChart(report)}
                        <div style="text-align: center; margin-top: 12px; font-size: 11px; color: var(--gray-500);">Gender & Age Distribution</div>
                    </div>
                    <div class="demographics-details">
                        <div class="demo-card">
                            <div class="demo-icon male">&#9794;</div>
                            <div class="demo-info">
                                <div class="demo-label">Males</div>
                                <div>
                                    <span class="demo-value">${report.numberOfMales}</span>
                                    <span class="demo-percent">(${malePercentage}%)</span>
                                </div>
                                <div class="demo-bar"><div class="demo-bar-fill male" style="width: ${malePercentage}%"></div></div>
                            </div>
                        </div>
                        <div class="demo-card">
                            <div class="demo-icon female">&#9792;</div>
                            <div class="demo-info">
                                <div class="demo-label">Females</div>
                                <div>
                                    <span class="demo-value">${report.numberOfFemales}</span>
                                    <span class="demo-percent">(${femalePercentage}%)</span>
                                </div>
                                <div class="demo-bar"><div class="demo-bar-fill female" style="width: ${femalePercentage}%"></div></div>
                            </div>
                        </div>
                        <div class="demo-card">
                            <div class="demo-icon children">&#128118;</div>
                            <div class="demo-info">
                                <div class="demo-label">Children</div>
                                <div>
                                    <span class="demo-value">${report.numberOfChildren}</span>
                                    <span class="demo-percent">(${childrenPercentage}%)</span>
                                </div>
                                <div class="demo-bar"><div class="demo-bar-fill children" style="width: ${childrenPercentage}%"></div></div>
                            </div>
                        </div>
                        <div class="demo-card">
                            <div class="demo-icon first-timer">&#127775;</div>
                            <div class="demo-info">
                                <div class="demo-label">First Timers</div>
                                <div>
                                    <span class="demo-value">${report.numberOfFirstTimers}</span>
                                    <span class="demo-percent">(${firstTimerPercentage}%)</span>
                                </div>
                                <div class="demo-bar"><div class="demo-bar-fill first-timer" style="width: ${firstTimerPercentage}%"></div></div>
                            </div>
                        </div>
                    </div>
                </div>
                ${previousCompareHtml}
            </div>

            <!-- Comparison Chart -->
            ${
              stats
                ? `
            <div class="section">
                <h3 class="section-title">Attendance Comparison</h3>
                <div class="chart-section">
                    <div class="chart-title">This Service vs Historical Average</div>
                    ${this.generateBarChart(report, stats)}
                </div>
                ${trendChartHtml}
            </div>
            `
                : ''
            }

            ${
              report.serviceTags && report.serviceTags.length > 0
                ? `
            <!-- Service Tags -->
            <div class="section tags-section">
                <h3 class="section-title">Service Categories</h3>
                <div class="tags-container">
                    ${report.serviceTags
                      .map(
                        (tag) => `
                        <span class="tag">
                            <span class="tag-icon">&#127991;</span>
                            ${this.tagLabels[tag] || tag}
                        </span>
                    `,
                      )
                      .join('')}
                </div>
            </div>
            `
                : ''
            }

            ${
              report.notes
                ? `
            <!-- Notes Section -->
            <div class="notes-section">
                <div class="notes-header">
                    <span class="notes-icon">&#128221;</span>
                    <span class="notes-title">Additional Notes</span>
                </div>
                <div class="notes-content">${report.notes}</div>
            </div>
            `
                : ''
            }
        </main>

        <!-- Footer -->
        <footer class="footer">
            <div class="footer-brand">
                <div class="footer-logo">&#9962;</div>
                <div class="footer-text">The PowerPoint Tribe</div>
            </div>
            <div class="footer-info">
                <div class="footer-generated">Generated on ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                <div class="footer-id">Report ID: ${(report as any)._id || 'N/A'}</div>
            </div>
        </footer>
    </div>
</body>
</html>
`;
  }

  async generatePdf(
    report: ServiceReportDocument,
    stats?: PdfComparisonStats,
  ): Promise<string> {
    return this.generatePdfHtml(report, stats);
  }
}
