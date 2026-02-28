import { StreamableFile, BadRequestException } from '@nestjs/common';
import { Readable } from 'stream';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
}

export class ExportUtil {
  /**
   * Generate CSV export
   */
  static generateCSV(data: any[], columns: ExportColumn[]): StreamableFile {
    if (data.length === 0) {
      throw new BadRequestException('No data to export');
    }

    // Create CSV headers
    const headers = columns.map(col => col.header);
    const csvRows = [headers.join(',')];

    // Add data rows
    data.forEach(item => {
      const values = columns.map(col => {
        let value = item[col.key] || '';

        // Handle dates
        if (value instanceof Date) {
          value = value.toISOString().split('T')[0];
        }

        // Handle objects/arrays
        if (typeof value === 'object' && value !== null) {
          value = JSON.stringify(value);
        }

        // Escape commas and quotes
        value = String(value);
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          value = `"${value.replace(/"/g, '""')}"`;
        }

        return value;
      });

      csvRows.push(values.join(','));
    });

    const csvContent = csvRows.join('\n');
    const stream = Readable.from(csvContent);

    return new StreamableFile(stream, {
      type: 'text/csv',
      disposition: `attachment; filename="export-${Date.now()}.csv"`,
    });
  }

  /**
   * Generate Excel export
   */
  static async generateExcel(
    data: any[],
    columns: ExportColumn[],
    sheetName: string = 'Export',
  ): Promise<StreamableFile> {
    if (data.length === 0) {
      throw new BadRequestException('No data to export');
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(sheetName);

      // Set columns
      worksheet.columns = columns.map(col => ({
        header: col.header,
        key: col.key,
        width: col.width || 20,
      }));

      // Style header row
      worksheet.getRow(1).font = { bold: true, size: 12 };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      };
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

      // Add data rows
      data.forEach(item => {
        const rowData = {};
        columns.forEach(col => {
          let value = item[col.key];

          // Handle dates
          if (value instanceof Date) {
            value = value.toISOString().split('T')[0];
          }

          // Handle objects/arrays
          if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
            value = JSON.stringify(value);
          }

          rowData[col.key] = value || '';
        });

        worksheet.addRow(rowData);
      });

      // Auto-fit columns
      worksheet.columns.forEach(column => {
        let maxLength = column.header.length;
        column.eachCell({ includeEmpty: true }, cell => {
          const cellLength = cell.value ? cell.value.toString().length : 0;
          if (cellLength > maxLength) {
            maxLength = cellLength;
          }
        });
        column.width = Math.min(maxLength + 2, 50);
      });

      // Add borders
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        row.eachCell({ includeEmpty: true }, cell => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };
        });
      });

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();
      const stream = Readable.from(buffer);

      return new StreamableFile(stream, {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        disposition: `attachment; filename="export-${Date.now()}.xlsx"`,
      });
    } catch (error) {
      throw new BadRequestException(`Excel export failed: ${error.message}`);
    }
  }

  /**
   * Generate PDF export
   */
  static async generatePDF(
    data: any[],
    columns: ExportColumn[],
    title: string = 'Export Report',
  ): Promise<StreamableFile> {
    if (data.length === 0) {
      throw new BadRequestException('No data to export');
    }

    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));

      // Title
      doc
        .fontSize(18)
        .font('Helvetica-Bold')
        .text(title, { align: 'center' })
        .moveDown();

      // Add export date
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'right' })
        .moveDown();

      // Calculate column widths
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const columnWidth = pageWidth / Math.min(columns.length, 5); // Max 5 columns per page

      // Table header
      doc.fontSize(10).font('Helvetica-Bold');
      let x = doc.page.margins.left;
      const headerY = doc.y;

      columns.slice(0, 5).forEach(col => {
        doc.text(col.header, x, headerY, {
          width: columnWidth,
          align: 'left',
        });
        x += columnWidth;
      });

      doc.moveDown();
      doc
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .stroke();
      doc.moveDown(0.5);

      // Table rows
      doc.fontSize(9).font('Helvetica');

      data.forEach((item, index) => {
        // Check if we need a new page
        if (doc.y > doc.page.height - 100) {
          doc.addPage();
          doc.y = doc.page.margins.top;
        }

        const rowY = doc.y;
        x = doc.page.margins.left;

        columns.slice(0, 5).forEach(col => {
          let value = item[col.key] || '';

          if (value instanceof Date) {
            value = value.toISOString().split('T')[0];
          } else if (typeof value === 'object') {
            value = JSON.stringify(value);
          }

          doc.text(String(value).substring(0, 50), x, rowY, {
            width: columnWidth - 5,
            align: 'left',
          });
          x += columnWidth;
        });

        doc.moveDown(0.5);

        // Add separator line every 5 rows
        if ((index + 1) % 5 === 0) {
          doc
            .moveTo(doc.page.margins.left, doc.y)
            .lineTo(doc.page.width - doc.page.margins.right, doc.y)
            .stroke();
          doc.moveDown(0.5);
        }
      });

      // Footer
      doc
        .fontSize(8)
        .text(
          `Total records: ${data.length}`,
          doc.page.margins.left,
          doc.page.height - 50,
          { align: 'center' }
        );

      doc.end();

      // Wait for PDF generation to complete
      const buffer = await new Promise<Buffer>((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
      });

      const stream = Readable.from(buffer);

      return new StreamableFile(stream, {
        type: 'application/pdf',
        disposition: `attachment; filename="export-${Date.now()}.pdf"`,
      });
    } catch (error) {
      throw new BadRequestException(`PDF export failed: ${error.message}`);
    }
  }
}
