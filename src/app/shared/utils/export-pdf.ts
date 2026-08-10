// src/app/shared/utils/export-pdf.ts
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Capture un élément du DOM (tel qu'affiché à l'écran, thème courant inclus)
 * et le télécharge en PDF, en découpant sur plusieurs pages si nécessaire.
 */
async function _exportElementAsPdf(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await html2canvas(element, { scale: 2, useCORS: true });
  const imgData = canvas.toDataURL('image/png');

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(filename);
}

// Exposed as a mutable binding (rather than a plain function declaration) so
// unit tests can substitute it — `import * as X` namespace objects are
// non-configurable per the ES module spec, so spyOn(X, 'fn') can never work
// here; reassigning this binding from within the module (via the test-only
// helpers below) is the supported way to make it swappable.
export let exportElementAsPdf: (element: HTMLElement, filename: string) => Promise<void> = _exportElementAsPdf;

/** Test-only: substitute the PDF export implementation. */
export function __setExportElementAsPdfForTests(fn: typeof exportElementAsPdf): void {
  exportElementAsPdf = fn;
}

/** Test-only: restore the real PDF export implementation. */
export function __resetExportElementAsPdf(): void {
  exportElementAsPdf = _exportElementAsPdf;
}
