import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PayrollItem } from './entities/payroll-item.entity';
import { PayrollItemDetail } from './entities/payroll-item-detail.entity';
import { SalaryComponentType } from './entities/salary-component.entity';
import { parseDecimal } from '../../common/utils/currency.util';

function formatRupiah(value: string | number): string {
  const amount = typeof value === 'string' ? parseDecimal(value) : value;
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/**
 * Render PDF slip gaji dari `payroll_items` + `payroll_item_details`
 * (§5.5, "rincian per komponen untuk slip gaji transparan"). Dipisah dari
 * `PayrollService` (Single Responsibility) — service mengurus data/DB,
 * class ini murni tata letak dokumen. `pdfkit` dipilih karena pure-JS
 * (tanpa native binding), aman di image `node:20-alpine` tanpa dependency
 * sistem tambahan (mis. Chromium untuk Puppeteer).
 */
@Injectable()
export class PayslipPdfGenerator {
  async generate(item: PayrollItem, details: PayrollItemDetail[]): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const finished = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    this.renderHeader(doc, item);
    this.renderDetailTable(doc, details);
    this.renderSummary(doc, item);
    this.renderFooter(doc);
    doc.end();

    return finished;
  }

  private renderHeader(doc: PDFKit.PDFDocument, item: PayrollItem): void {
    const period = item.payrollPeriod;
    const employee = item.employee;

    doc.fontSize(16).text('SLIP GAJI', { align: 'center' });
    doc.fontSize(10).fillColor('#555').text(
      `Periode ${MONTH_NAMES[period.periodMonth - 1]} ${period.periodYear}`,
      { align: 'center' },
    );
    doc.fillColor('#000').moveDown(1.5);

    doc.fontSize(11);
    doc.text(`Nama: ${employee.fullName}`);
    doc.text(`Kode Karyawan: ${employee.employeeCode}`);
    doc.text(`Jenis Kepegawaian: ${employee.employmentType}`);
    doc.moveDown(1);
  }

  private renderDetailTable(doc: PDFKit.PDFDocument, details: PayrollItemDetail[]): void {
    const earnings = details.filter((d) => d.componentType === SalaryComponentType.EARNING);
    const deductions = details.filter((d) => d.componentType === SalaryComponentType.DEDUCTION);

    doc.fontSize(12).text('Pendapatan', { underline: true });
    doc.fontSize(10);
    for (const row of earnings) {
      this.renderLineItem(doc, row.componentName, row.amount);
    }
    doc.moveDown(0.5);

    doc.fontSize(12).text('Potongan', { underline: true });
    doc.fontSize(10);
    for (const row of deductions) {
      this.renderLineItem(doc, row.componentName, row.amount);
    }
    doc.moveDown(1);
  }

  private renderLineItem(doc: PDFKit.PDFDocument, label: string, amount: string): void {
    const y = doc.y;
    doc.text(label, 50, y);
    doc.text(formatRupiah(amount), 400, y, { width: 145, align: 'right' });
    doc.moveDown(0.3);
  }

  private renderSummary(doc: PDFKit.PDFDocument, item: PayrollItem): void {
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ccc').stroke();
    doc.moveDown(0.5);

    doc.fontSize(10);
    this.renderLineItem(doc, 'Gaji Kotor (Gross)', item.grossSalary);
    this.renderLineItem(doc, 'Lembur', item.totalOvertime);
    this.renderLineItem(doc, 'Potongan Unpaid Leave', item.totalDeductionUnpaid);
    this.renderLineItem(doc, 'BPJS (ditanggung karyawan)', item.bpjsEmployeeTotal);
    this.renderLineItem(doc, 'PPh 21', item.pph21Amount);

    doc.moveDown(0.3);
    doc.fontSize(12);
    this.renderLineItem(doc, 'Gaji Bersih (Net)', item.netSalary);
  }

  private renderFooter(doc: PDFKit.PDFDocument): void {
    doc.moveDown(3);
    doc
      .fontSize(8)
      .fillColor('#888')
      .text(
        `Dokumen ini digenerate otomatis oleh sistem pada ${new Date().toISOString()} — tidak memerlukan tanda tangan basah.`,
        { align: 'center' },
      );
  }
}
