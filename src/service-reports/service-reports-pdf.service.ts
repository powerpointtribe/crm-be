import { Injectable } from '@nestjs/common';
import { ServiceReportDocument } from './schemas/service-report.schema';

@Injectable()
export class ServiceReportsPdfService {
  private generatePieChart(report: ServiceReportDocument): string {
    const data = [
      { label: 'Male', value: report.numberOfMales, color: '#3b82f6' },
      { label: 'Female', value: report.numberOfFemales, color: '#ec4899' },
      { label: 'Children', value: report.numberOfChildren, color: '#10b981' },
      {
        label: 'First Timers',
        value: report.numberOfFirstTimers,
        color: '#f59e0b',
      },
    ];

    const total = report.totalAttendance;
    let cumulativePercentage = 0;
    const center = 100;
    const radius = 80;

    const paths = data
      .map((item) => {
        const percentage = (item.value / total) * 100;
        if (percentage === 0) return '';

        const startAngle = (cumulativePercentage / 100) * 360;
        const endAngle = ((cumulativePercentage + percentage) / 100) * 360;

        const startAngleRad = (startAngle - 90) * (Math.PI / 180);
        const endAngleRad = (endAngle - 90) * (Math.PI / 180);

        const x1 = center + radius * Math.cos(startAngleRad);
        const y1 = center + radius * Math.sin(startAngleRad);
        const x2 = center + radius * Math.cos(endAngleRad);
        const y2 = center + radius * Math.sin(endAngleRad);

        const largeArcFlag = percentage > 50 ? 1 : 0;

        cumulativePercentage += percentage;

        return `<path d="M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z" fill="${item.color}" stroke="white" stroke-width="2"/>`;
      })
      .join('');

    return `
      <svg class="pie-chart" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        ${paths}
      </svg>
    `;
  }

  generatePdfHtml(report: ServiceReportDocument): string {
    const reportedByName =
      report.reportedBy && typeof report.reportedBy === 'object'
        ? `${(report.reportedBy as any).firstName} ${(report.reportedBy as any).lastName}`
        : 'Unknown Reporter';
    const formattedDate = new Date(report.date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Powerpoint Tribe Service Report - ${report.serviceName}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
            background: #fff;
        }

        .header {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 20px;
        }

        .header h1 {
            color: #1e40af;
            font-size: 2.5em;
            margin-bottom: 10px;
            font-weight: 700;
        }

        .header .subtitle {
            color: #64748b;
            font-size: 1.2em;
            font-weight: 500;
        }

        .service-info {
            background: #f8fafc;
            padding: 25px;
            border-radius: 12px;
            margin-bottom: 30px;
            border-left: 5px solid #2563eb;
        }

        .service-info h2 {
            color: #1e40af;
            margin-bottom: 15px;
            font-size: 1.8em;
        }

        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }

        .info-item {
            background: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .info-label {
            font-weight: 600;
            color: #64748b;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
        }

        .info-value {
            font-size: 1.2em;
            font-weight: 700;
            color: #1e293b;
        }

        .attendance-section {
            margin-bottom: 30px;
        }

        .attendance-title {
            color: #1e40af;
            font-size: 1.8em;
            margin-bottom: 20px;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 10px;
        }

        .attendance-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 20px;
            margin-bottom: 25px;
        }

        .attendance-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 12px;
            text-align: center;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }

        .attendance-number {
            font-size: 2.5em;
            font-weight: 800;
            margin-bottom: 5px;
        }

        .attendance-label {
            font-size: 0.9em;
            opacity: 0.9;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .total-attendance {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%) !important;
        }

        .first-timers {
            background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%) !important;
            color: #333 !important;
        }

        .demographics {
            background: #f1f5f9;
            padding: 25px;
            border-radius: 12px;
            margin-bottom: 30px;
        }

        .demographics h3 {
            color: #334155;
            margin-bottom: 15px;
            font-size: 1.4em;
        }

        .pie-chart-container {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 30px;
        }

        .pie-chart {
            width: 200px;
            height: 200px;
            border-radius: 50%;
            position: relative;
            flex-shrink: 0;
        }

        .pie-legend {
            flex: 1;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
        }

        .legend-item {
            background: white;
            padding: 15px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 12px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .legend-color {
            width: 16px;
            height: 16px;
            border-radius: 3px;
            flex-shrink: 0;
        }

        .legend-info {
            flex: 1;
        }

        .legend-label {
            font-size: 0.9em;
            color: #64748b;
            font-weight: 500;
            margin-bottom: 2px;
        }

        .legend-percentage {
            font-size: 1.1em;
            font-weight: 700;
            color: #1e293b;
        }

        @media (max-width: 600px) {
            .pie-chart-container {
                flex-direction: column;
                text-align: center;
            }

            .pie-chart {
                width: 180px;
                height: 180px;
            }
        }

        .tags-section {
            margin-bottom: 30px;
        }

        .tags-container {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 15px;
        }

        .tag {
            background: #e0e7ff;
            color: #3730a3;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.9em;
            font-weight: 500;
        }

        .notes-section {
            background: #fffbeb;
            border: 1px solid #fbbf24;
            border-radius: 12px;
            padding: 25px;
            margin-bottom: 30px;
        }

        .notes-title {
            color: #92400e;
            margin-bottom: 15px;
            font-size: 1.4em;
        }

        .notes-content {
            color: #451a03;
            line-height: 1.7;
            white-space: pre-wrap;
        }

        .footer {
            text-align: center;
            padding-top: 30px;
            border-top: 1px solid #e2e8f0;
            color: #64748b;
            font-size: 0.9em;
        }

        .generated-info {
            margin-top: 10px;
            font-style: italic;
        }

        @media print {
            body {
                padding: 20px;
            }

            .header h1 {
                font-size: 2em;
            }

            .attendance-card,
            .info-item,
            .demo-item {
                break-inside: avoid;
            }
        }

        @page {
            margin: 1in;
            size: A4;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Service Report</h1>
        <div class="subtitle">Attendance & Ministry Report</div>
    </div>

    <div class="service-info">
        <h2>${report.serviceName}</h2>
        <div class="info-grid">
            <div class="info-item">
                <div class="info-label">Service Date</div>
                <div class="info-value">${formattedDate}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Reported By</div>
                <div class="info-value">${reportedByName}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Report Generated</div>
                <div class="info-value">${new Date().toLocaleDateString()}</div>
            </div>
        </div>
    </div>

    <div class="attendance-section">
        <h2 class="attendance-title">Attendance Overview</h2>
        <div class="attendance-grid">
            <div class="attendance-card total-attendance">
                <div class="attendance-number">${report.totalAttendance}</div>
                <div class="attendance-label">Total Attendance</div>
            </div>
            <div class="attendance-card">
                <div class="attendance-number">${report.numberOfMales}</div>
                <div class="attendance-label">Males</div>
            </div>
            <div class="attendance-card">
                <div class="attendance-number">${report.numberOfFemales}</div>
                <div class="attendance-label">Females</div>
            </div>
            <div class="attendance-card">
                <div class="attendance-number">${report.numberOfChildren}</div>
                <div class="attendance-label">Children</div>
            </div>
            <div class="attendance-card first-timers">
                <div class="attendance-number">${report.numberOfFirstTimers}</div>
                <div class="attendance-label">First Timers</div>
            </div>
        </div>
    </div>

    <div class="demographics">
        <h3>Demographics Breakdown</h3>
        <div class="pie-chart-container">
            ${this.generatePieChart(report)}
            <div class="pie-legend">
                <div class="legend-item">
                    <div class="legend-color" style="background-color: #3b82f6;"></div>
                    <div class="legend-info">
                        <div class="legend-label">Male</div>
                        <div class="legend-percentage">${((report.numberOfMales / report.totalAttendance) * 100).toFixed(1)}%</div>
                    </div>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background-color: #ec4899;"></div>
                    <div class="legend-info">
                        <div class="legend-label">Female</div>
                        <div class="legend-percentage">${((report.numberOfFemales / report.totalAttendance) * 100).toFixed(1)}%</div>
                    </div>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background-color: #10b981;"></div>
                    <div class="legend-info">
                        <div class="legend-label">Children</div>
                        <div class="legend-percentage">${((report.numberOfChildren / report.totalAttendance) * 100).toFixed(1)}%</div>
                    </div>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background-color: #f59e0b;"></div>
                    <div class="legend-info">
                        <div class="legend-label">First Timers</div>
                        <div class="legend-percentage">${((report.numberOfFirstTimers / report.totalAttendance) * 100).toFixed(1)}%</div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    ${
      report.serviceTags && report.serviceTags.length > 0
        ? `
    <div class="tags-section">
        <h2 class="attendance-title">Service Tags</h2>
        <div class="tags-container">
            ${report.serviceTags
              .map((tag) => {
                const labels = {
                  invited_guest_minister: 'Invited Guest Minister',
                  sunday_after_saturday_outreach:
                    'Sunday after Saturday Outreach',
                  themed_service: 'Themed Service',
                  beginning_of_new_series: 'Beginning of New Series',
                  celebration_service:
                    'Celebration Service (Thanksgiving, Wedding, Baby Dedication etc.)',
                  sunday_after_viral_post:
                    'Sunday after Viral/Promoted Post on WhatsApp/Social Media',
                  others: 'Others',
                };
                return `<span class="tag">${labels[tag] || tag}</span>`;
              })
              .join('')}
        </div>
    </div>
    `
        : ''
    }

    ${
      report.notes
        ? `
    <div class="notes-section">
        <h3 class="notes-title">Additional Notes</h3>
        <div class="notes-content">${report.notes}</div>
    </div>
    `
        : ''
    }

    <div class="footer">
        <div>Church Management System - Service Report</div>
        <div class="generated-info">Generated on ${new Date().toLocaleString()}</div>
    </div>
</body>
</html>
`;
  }

  // For now, we'll return the HTML that can be converted to PDF on the frontend
  // In the future, you can integrate with puppeteer or another PDF generation library
  async generatePdf(report: ServiceReportDocument): Promise<string> {
    return this.generatePdfHtml(report);
  }
}
