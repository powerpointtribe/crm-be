import { StreamableFile, BadRequestException } from '@nestjs/common';
import { Readable } from 'stream';

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

    const headers = columns.map(col => col.header);
    const csvRows = [headers.join(',')];

    data.forEach(item => {
      const values = columns.map(col => {
        let value = item[col.key] ?? '';

        if (value instanceof Date) {
          value = value.toISOString().split('T')[0];
        }

        if (typeof value === 'object' && value !== null) {
          value = JSON.stringify(value);
        }

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
   * Generate Excel export using exceljs (dynamically imported)
   */
  static async generateExcel(
    data: any[],
    columns: ExportColumn[],
    sheetName: string = 'Export',
  ): Promise<StreamableFile> {
    if (data.length === 0) {
      throw new BadRequestException('No data to export');
    }

    let ExcelJS: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      ExcelJS = require('exceljs');
    } catch {
      throw new BadRequestException(
        'Excel export is not available. Please install the exceljs package: npm install exceljs',
      );
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
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      // Add data rows
      data.forEach(item => {
        const rowData: Record<string, any> = {};
        columns.forEach(col => {
          let value = item[col.key];

          if (value instanceof Date) {
            value = value.toISOString().split('T')[0];
          } else if (typeof value === 'object' && value !== null) {
            value = JSON.stringify(value);
          }

          rowData[col.key] = value ?? '';
        });

        worksheet.addRow(rowData);
      });

      // Auto-fit columns
      worksheet.columns.forEach(column => {
        let maxLength = String(column.header || '').length;
        column.eachCell({ includeEmpty: true }, cell => {
          const cellLength = cell.value ? cell.value.toString().length : 0;
          if (cellLength > maxLength) {
            maxLength = cellLength;
          }
        });
        column.width = Math.min(maxLength + 2, 50);
      });

      // Add borders
      worksheet.eachRow({ includeEmpty: false }, row => {
        row.eachCell({ includeEmpty: true }, cell => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const stream = Readable.from(Buffer.from(buffer));

      return new StreamableFile(stream, {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        disposition: `attachment; filename="export-${Date.now()}.xlsx"`,
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(`Excel export failed: ${error.message}`);
    }
  }

  /**
   * Generate PDF export using pdfkit (dynamically imported)
   */
  static async generatePDF(
    data: any[],
    columns: ExportColumn[],
    title: string = 'Export Report',
  ): Promise<StreamableFile> {
    if (data.length === 0) {
      throw new BadRequestException('No data to export');
    }

    let PDFDocument: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      PDFDocument = require('pdfkit');
    } catch {
      throw new BadRequestException(
        'PDF export is not available. Please install the pdfkit package: npm install pdfkit',
      );
    }

    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));

      // Title
      doc
        .fontSize(18)
        .font('Helvetica-Bold')
        .text(title, { align: 'center' })
        .moveDown(0.5);

      // Export date and record count
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(
          `Generated on: ${new Date().toLocaleDateString()} | Total records: ${data.length}`,
          { align: 'right' },
        )
        .moveDown();

      // Use up to 6 columns for landscape PDF
      const maxCols = Math.min(columns.length, 6);
      const visibleColumns = columns.slice(0, maxCols);
      const pageWidth =
        doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const colWidth = pageWidth / maxCols;

      // Draw table header
      const drawHeader = () => {
        const headerY = doc.y;
        doc
          .rect(
            doc.page.margins.left,
            headerY - 2,
            pageWidth,
            20,
          )
          .fill('#4472C4');

        let x = doc.page.margins.left;
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff');
        visibleColumns.forEach(col => {
          doc.text(col.header, x + 3, headerY + 2, {
            width: colWidth - 6,
            align: 'left',
            lineBreak: false,
          });
          x += colWidth;
        });

        doc.fillColor('#000000');
        doc.y = headerY + 22;
      };

      drawHeader();

      // Table rows
      data.forEach((item, index) => {
        if (doc.y > doc.page.height - 80) {
          doc.addPage();
          drawHeader();
        }

        const rowY = doc.y;

        // Alternate row background
        if (index % 2 === 0) {
          doc
            .rect(doc.page.margins.left, rowY - 2, pageWidth, 18)
            .fill('#F2F2F2');
          doc.fillColor('#000000');
        }

        let x = doc.page.margins.left;
        doc.fontSize(8).font('Helvetica');

        visibleColumns.forEach(col => {
          let value = item[col.key] ?? '';

          if (value instanceof Date) {
            value = value.toISOString().split('T')[0];
          } else if (typeof value === 'object') {
            value = JSON.stringify(value);
          }

          doc.text(String(value).substring(0, 40), x + 3, rowY + 1, {
            width: colWidth - 6,
            align: 'left',
            lineBreak: false,
          });
          x += colWidth;
        });

        doc.y = rowY + 18;
      });

      // Footer
      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#888888')
        .text(
          `Total records: ${data.length}`,
          doc.page.margins.left,
          doc.page.height - 40,
          { align: 'center', width: pageWidth },
        );

      doc.end();

      const buffer = await new Promise<Buffer>((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
      });

      const stream = Readable.from(buffer);

      return new StreamableFile(stream, {
        type: 'application/pdf',
        disposition: `attachment; filename="export-${Date.now()}.pdf"`,
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(`PDF export failed: ${error.message}`);
    }
  }
}
