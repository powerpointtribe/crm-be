import { Injectable } from '@nestjs/common';
import { ServiceReportDocument } from './schemas/service-report.schema';

@Injectable()
export class ServiceReportsPdfService {
  generatePdfHtml(report: ServiceReportDocument): string {
    const reportedByName = report.reportedBy && typeof report.reportedBy === 'object'
      ? `${(report.reportedBy as any).firstName} ${(report.reportedBy as any).lastName}`
      : 'Unknown Reporter';
    const formattedDate = new Date(report.date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
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

        .demo-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 15px;
        }

        .demo-item {
            background: white;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .demo-percentage {
            font-size: 1.5em;
            font-weight: 700;
            color: #3b82f6;
            margin-bottom: 5px;
        }

        .demo-label {
            font-size: 0.85em;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.5px;
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
        <div class="demo-grid">
            <div class="demo-item">
                <div class="demo-percentage">${((report.numberOfMales / report.totalAttendance) * 100).toFixed(1)}%</div>
                <div class="demo-label">Male</div>
            </div>
            <div class="demo-item">
                <div class="demo-percentage">${((report.numberOfFemales / report.totalAttendance) * 100).toFixed(1)}%</div>
                <div class="demo-label">Female</div>
            </div>
            <div class="demo-item">
                <div class="demo-percentage">${((report.numberOfChildren / report.totalAttendance) * 100).toFixed(1)}%</div>
                <div class="demo-label">Children</div>
            </div>
            <div class="demo-item">
                <div class="demo-percentage">${(((report.numberOfMales + report.numberOfFemales) / report.totalAttendance) * 100).toFixed(1)}%</div>
                <div class="demo-label">Adults</div>
            </div>
            <div class="demo-item">
                <div class="demo-percentage">${((report.numberOfFirstTimers / report.totalAttendance) * 100).toFixed(1)}%</div>
                <div class="demo-label">First Timers</div>
            </div>
            <div class="demo-item">
                <div class="demo-percentage">${(((report.totalAttendance - report.numberOfFirstTimers) / report.totalAttendance) * 100).toFixed(1)}%</div>
                <div class="demo-label">Returning</div>
            </div>
        </div>
    </div>

    ${report.serviceTags && report.serviceTags.length > 0 ? `
    <div class="tags-section">
        <h2 class="attendance-title">Service Tags</h2>
        <div class="tags-container">
            ${report.serviceTags.map(tag => {
              const labels = {
                'invited_guest_minister': 'Invited Guest Minister',
                'sunday_after_saturday_outreach': 'Sunday after Saturday Outreach',
                'themed_service': 'Themed Service',
                'beginning_of_new_series': 'Beginning of New Series',
                'celebration_service': 'Celebration Service (Thanksgiving, Wedding, Baby Dedication etc.)',
                'sunday_after_viral_post': 'Sunday after Viral/Promoted Post on WhatsApp/Social Media',
                'others': 'Others'
              };
              return `<span class="tag">${labels[tag] || tag}</span>`;
            }).join('')}
        </div>
    </div>
    ` : ''}

    ${report.notes ? `
    <div class="notes-section">
        <h3 class="notes-title">Additional Notes</h3>
        <div class="notes-content">${report.notes}</div>
    </div>
    ` : ''}

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
