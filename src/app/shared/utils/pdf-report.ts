// src/app/shared/utils/pdf-report.ts
//
// Générateur de rapport PDF natif (texte + images vectoriels via jsPDF) —
// contrairement à l'ancien export (screenshot du dashboard via html2canvas),
// ce rapport a sa propre mise en page "document professionnel" : en-tête,
// statistiques, étapes passées/échouées, captures d'écran d'échec, analyse
// IA. Le texte reste sélectionnable/copiable et le fichier est léger.
import jsPDF from 'jspdf';

export type StepResultVM = 'PASS' | 'FAIL' | 'SKIP' | 'RUNNING';

export interface ReportStepVM {
  index: number;
  label: string;
  result: StepResultVM;
  durationMs?: number | null;
  errorMessage?: string | null;
}

export interface AiFailureVM {
  stepIndex: number | null;
  action: string;
  causeLabel: string;
  explanation: string;
  recommendation: string;
}

export interface ScenarioReportVM {
  scenarioName: string;
  result: string;
  durationMs: number | null;
  passCount: number;
  failCount: number;
  totalCount: number;
  errorMessage?: string | null;
  steps: ReportStepVM[];
  screenshotUrl?: string | null;
  aiSummary?: string | null;
  aiFailures?: AiFailureVM[];
}

export interface SingleReportInput {
  projectName: string;
  executedAt: string | null;
  scenario: ScenarioReportVM;
}

export interface BatchReportInput {
  projectName: string;
  executedAt: string | null;
  totalCount: number;
  passCount: number;
  failCount: number;
  durationMs: number | null;
  scenarios: ScenarioReportVM[];
}

const REGRESSION_NOTE =
  "Corriger uniquement la cause identifiée pour chaque étape ci-dessous, sans modifier ni impacter d'autres modules de l'application.";

// ── Palette "document professionnel" — volontairement sobre, distincte du
// thème sombre néon du dashboard (c'est un rapport à imprimer/partager).
const COLOR = {
  ink:      [30, 32, 38]   as [number, number, number],
  muted:    [110, 116, 128] as [number, number, number],
  border:   [222, 226, 232] as [number, number, number],
  band:     [24, 28, 38]   as [number, number, number],
  bandText: [255, 255, 255] as [number, number, number],
  success:  [22, 163, 74]  as [number, number, number],
  successBg:[224, 245, 232] as [number, number, number],
  danger:   [220, 38, 38]  as [number, number, number],
  dangerBg: [253, 226, 226] as [number, number, number],
  warnBg:   [255, 247, 224] as [number, number, number],
  warnText: [146, 96, 4]   as [number, number, number],
  accent:   [79, 70, 229]  as [number, number, number],
};

class PdfCursor {
  doc: jsPDF;
  y: number;
  readonly margin = 40;
  readonly pageWidth: number;
  readonly pageHeight: number;
  readonly contentWidth: number;
  private title: string;

  constructor(title: string) {
    this.doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.contentWidth = this.pageWidth - this.margin * 2;
    this.y = this.margin;
    this.title = title;
  }

  ensureSpace(height: number): void {
    if (this.y + height > this.pageHeight - 50) {
      this.doc.addPage();
      this.y = this.margin;
    }
  }

  band(text: string): void {
    this.doc.setFillColor(...COLOR.band);
    this.doc.rect(0, 0, this.pageWidth, 56, 'F');
    this.doc.setTextColor(...COLOR.bandText);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(15);
    this.doc.text(text, this.margin, 34);
    this.y = 76;
  }

  metaLine(parts: { label: string; value: string }[]): void {
    this.doc.setFontSize(9.5);
    let x = this.margin;
    for (const p of parts) {
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(...COLOR.muted);
      this.doc.text(`${p.label} `, x, this.y);
      x += this.doc.getTextWidth(`${p.label} `);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(...COLOR.ink);
      this.doc.text(p.value, x, this.y);
      x += this.doc.getTextWidth(p.value) + 22;
    }
    this.y += 18;
    this.doc.setDrawColor(...COLOR.border);
    this.doc.line(this.margin, this.y, this.pageWidth - this.margin, this.y);
    this.y += 20;
  }

  sectionTitle(text: string): void {
    this.ensureSpace(28);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(11.5);
    this.doc.setTextColor(...COLOR.ink);
    this.doc.text(text, this.margin, this.y);
    this.y += 6;
    this.doc.setDrawColor(...COLOR.accent);
    this.doc.setLineWidth(1.4);
    this.doc.line(this.margin, this.y, this.margin + 26, this.y);
    this.doc.setLineWidth(0.5);
    this.y += 16;
  }

  scenarioSubTitle(text: string): void {
    this.ensureSpace(24);
    this.doc.setFillColor(...COLOR.border);
    this.doc.rect(this.margin, this.y - 12, this.contentWidth, 20, 'F');
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(10.5);
    this.doc.setTextColor(...COLOR.ink);
    this.doc.text(text, this.margin + 8, this.y + 2);
    this.y += 26;
  }

  statsGrid(stats: { label: string; value: string; tone?: 'success' | 'danger' | 'neutral' }[]): void {
    const h = 46;
    this.ensureSpace(h + 14);
    const gap = 8;
    const w = (this.contentWidth - gap * (stats.length - 1)) / stats.length;
    stats.forEach((s, i) => {
      const x = this.margin + i * (w + gap);
      this.doc.setDrawColor(...COLOR.border);
      this.doc.setFillColor(255, 255, 255);
      this.doc.roundedRect(x, this.y, w, h, 4, 4, 'FD');
      const color = s.tone === 'success' ? COLOR.success : s.tone === 'danger' ? COLOR.danger : COLOR.ink;
      this.doc.setTextColor(...color);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(15);
      this.doc.text(s.value, x + w / 2, this.y + 21, { align: 'center' });
      this.doc.setTextColor(...COLOR.muted);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(7.5);
      this.doc.text(s.label.toUpperCase(), x + w / 2, this.y + 35, { align: 'center' });
    });
    this.y += h + 18;
  }

  paragraph(text: string, opts: { size?: number; color?: [number, number, number]; bold?: boolean } = {}): void {
    const size = opts.size ?? 9.5;
    this.doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    this.doc.setFontSize(size);
    this.doc.setTextColor(...(opts.color ?? COLOR.ink));
    const lines: string[] = this.doc.splitTextToSize(text, this.contentWidth);
    const lineHeight = size * 1.35;
    this.ensureSpace(lines.length * lineHeight + 4);
    this.doc.text(lines, this.margin, this.y);
    this.y += lines.length * lineHeight + 6;
  }

  warningBox(text: string): void {
    const size = 8.5;
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(size);
    const lines: string[] = this.doc.splitTextToSize(`⚠ ${text}`, this.contentWidth - 16);
    const h = lines.length * (size * 1.35) + 12;
    this.ensureSpace(h + 8);
    this.doc.setFillColor(...COLOR.warnBg);
    this.doc.roundedRect(this.margin, this.y, this.contentWidth, h, 4, 4, 'F');
    this.doc.setTextColor(...COLOR.warnText);
    this.doc.text(lines, this.margin + 8, this.y + 13);
    this.y += h + 10;
  }

  stepRow(step: ReportStepVM): void {
    const size = 9;
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(size);
    const badgeW = 46;
    const durW = step.durationMs ? 44 : 0;
    const labelWidth = this.contentWidth - badgeW - durW - 30;
    const lines: string[] = this.doc.splitTextToSize(step.label, labelWidth);
    const rowH = Math.max(20, lines.length * (size * 1.3) + 8);
    this.ensureSpace(rowH + 2);

    const isFail = step.result === 'FAIL';
    this.doc.setDrawColor(...COLOR.border);
    this.doc.setFillColor(isFail ? COLOR.dangerBg[0] : 250, isFail ? COLOR.dangerBg[1] : 250, isFail ? COLOR.dangerBg[2] : 251);
    this.doc.roundedRect(this.margin, this.y, this.contentWidth, rowH, 3, 3, 'FD');

    this.doc.setTextColor(...COLOR.muted);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(String(step.index), this.margin + 8, this.y + 13);

    this.doc.setTextColor(...COLOR.ink);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(lines, this.margin + 24, this.y + 13);

    const badgeColor = isFail ? COLOR.danger : step.result === 'SKIP' ? COLOR.muted : COLOR.success;
    const badgeBg = isFail ? COLOR.dangerBg : step.result === 'SKIP' ? COLOR.border : COLOR.successBg;
    const badgeLabel = isFail ? 'ÉCHOUÉ' : step.result === 'SKIP' ? 'IGNORÉ' : 'PASSÉ';
    const badgeX = this.margin + this.contentWidth - badgeW - durW - 6;
    this.doc.setFillColor(...badgeBg);
    this.doc.roundedRect(badgeX, this.y + 4, badgeW, 13, 3, 3, 'F');
    this.doc.setTextColor(...badgeColor);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(7);
    this.doc.text(badgeLabel, badgeX + badgeW / 2, this.y + 13, { align: 'center' });

    if (durW) {
      this.doc.setTextColor(...COLOR.muted);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(7.5);
      this.doc.text(`${step.durationMs}ms`, this.margin + this.contentWidth - 4, this.y + 13, { align: 'right' });
    }

    this.y += rowH + 4;

    if (step.errorMessage) {
      this.paragraph(`Erreur : ${step.errorMessage}`, { size: 8, color: COLOR.danger });
    }
  }

  async image(dataUrl: string | null, caption: string): Promise<void> {
    if (!dataUrl) return;
    try {
      const dims = await _dataUrlDimensions(dataUrl);
      const maxW = this.contentWidth;
      const scale = Math.min(1, maxW / dims.width);
      const w = dims.width * scale;
      const h = dims.height * scale;
      this.ensureSpace(h + 26);
      this.doc.setFont('helvetica', 'italic');
      this.doc.setFontSize(8);
      this.doc.setTextColor(...COLOR.muted);
      this.doc.text(caption, this.margin, this.y);
      this.y += 10;
      this.doc.setDrawColor(...COLOR.border);
      this.doc.rect(this.margin, this.y, w, h);
      this.doc.addImage(dataUrl, 'PNG', this.margin, this.y, w, h);
      this.y += h + 14;
    } catch {
      // Capture indisponible (réseau/CORS) : on ne bloque jamais l'export pour ça.
      this.paragraph(`${caption} (capture indisponible)`, { size: 8, color: COLOR.muted });
    }
  }

  finish(filename: string): void {
    const pageCount = this.doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(7.5);
      this.doc.setTextColor(...COLOR.muted);
      this.doc.text(this.title, this.margin, this.pageHeight - 24);
      this.doc.text(`Page ${i} / ${pageCount}`, this.pageWidth - this.margin, this.pageHeight - 24, { align: 'right' });
    }
    this.doc.save(filename);
  }
}

function _dataUrlDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });
}

async function _fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function _causeBadge(cursor: PdfCursor, causeLabel: string): void {
  cursor.doc.setFont('helvetica', 'bold');
  cursor.doc.setFontSize(7.5);
  cursor.doc.setTextColor(...COLOR.accent);
  cursor.doc.text(`[${causeLabel.toUpperCase()}]`, cursor.margin, cursor.y);
  cursor.y += 12;
}

// Extrait de _renderScenarioBlock pour rester sous le seuil de complexité
// cognitive de Sonar — comportement inchangé, juste factorisé.
function _renderAiAnalysis(cursor: PdfCursor, s: ScenarioReportVM): void {
  const hasFailures = Boolean(s.aiFailures && s.aiFailures.length);
  if (!s.aiSummary && !hasFailures) return;

  cursor.y += 4;
  cursor.paragraph('Analyse IA', { size: 9.5, bold: true });
  if (s.aiSummary) cursor.paragraph(s.aiSummary, { size: 8.5, color: COLOR.muted });
  if (!hasFailures) return;

  cursor.warningBox(REGRESSION_NOTE);
  for (const f of s.aiFailures!) {
    cursor.paragraph(`Étape ${(f.stepIndex ?? 0) + 1} — ${f.action}`, { size: 8.5, bold: true });
    _causeBadge(cursor, f.causeLabel);
    cursor.paragraph(f.explanation, { size: 8.5 });
    cursor.paragraph(`Recommandation : ${f.recommendation}`, { size: 8.5, color: COLOR.accent });
  }
}

async function _renderScenarioBlock(cursor: PdfCursor, s: ScenarioReportVM, showSubTitle: boolean): Promise<void> {
  if (showSubTitle) {
    cursor.scenarioSubTitle(
      `${s.scenarioName}  —  ${s.result === 'PASS' ? 'SUCCÈS' : 'ÉCHEC'}${s.durationMs ? `  ·  ${_formatDuration(s.durationMs)}` : ''}`
    );
  }

  if (s.steps.length) {
    for (const step of s.steps) cursor.stepRow(step);
  } else {
    cursor.paragraph('Aucune étape enregistrée pour cette exécution.', { size: 8.5, color: COLOR.muted });
  }

  if (s.result !== 'PASS' && s.screenshotUrl) {
    const dataUrl = await _fetchAsDataUrl(s.screenshotUrl);
    await cursor.image(dataUrl, "Capture d'écran de l'échec");
  }

  _renderAiAnalysis(cursor, s);

  cursor.y += 10;
}

function _formatDuration(ms: number | null): string {
  if (!ms) return '—';
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function _formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function _generateSingleReportPdf(input: SingleReportInput): Promise<void> {
  const cursor = new PdfCursor(`Rapport d'exécution — ${input.scenario.scenarioName}`);
  cursor.band("RAPPORT D'EXÉCUTION");
  cursor.metaLine([
    { label: 'Projet :', value: input.projectName || '—' },
    { label: 'Scénario :', value: input.scenario.scenarioName },
    { label: "Date d'exécution :", value: _formatDate(input.executedAt) },
  ]);

  cursor.sectionTitle('Statistiques');
  const s = input.scenario;
  const rate = s.totalCount > 0 ? Math.round((s.passCount / s.totalCount) * 100) : s.result === 'PASS' ? 100 : 0;
  cursor.statsGrid([
    { label: 'Étapes passées', value: String(s.passCount), tone: 'success' },
    { label: 'Étapes échouées', value: String(s.failCount), tone: 'danger' },
    { label: 'Total', value: String(s.totalCount) },
    { label: 'Durée', value: _formatDuration(s.durationMs) },
    { label: 'Taux de succès', value: `${rate}%`, tone: rate >= 80 ? 'success' : 'danger' },
  ]);

  if (s.errorMessage) {
    cursor.sectionTitle("Détail de l'erreur");
    cursor.paragraph(s.errorMessage, { size: 8.5, color: COLOR.danger });
  }

  cursor.sectionTitle(`Étapes exécutées (${s.steps.length})`);
  await _renderScenarioBlock(cursor, s, false);

  cursor.finish(`rapport-${s.scenarioName}.pdf`);
}

async function _generateBatchReportPdf(input: BatchReportInput): Promise<void> {
  const cursor = new PdfCursor("Rapport d'exécution groupée");
  cursor.band("RAPPORT D'EXÉCUTION GROUPÉE");
  cursor.metaLine([
    { label: 'Projet :', value: input.projectName || '—' },
    { label: 'Type :', value: `Exécution groupée (${input.totalCount} scénarios)` },
    { label: "Date d'exécution :", value: _formatDate(input.executedAt) },
  ]);

  cursor.sectionTitle('Statistiques globales');
  const rate = input.totalCount > 0 ? Math.round((input.passCount / input.totalCount) * 100) : 0;
  cursor.statsGrid([
    { label: 'Scénarios passés', value: String(input.passCount), tone: 'success' },
    { label: 'Scénarios échoués', value: String(input.failCount), tone: 'danger' },
    { label: 'Total', value: String(input.totalCount) },
    { label: 'Durée totale', value: _formatDuration(input.durationMs) },
    { label: 'Taux de succès', value: `${rate}%`, tone: rate >= 80 ? 'success' : 'danger' },
  ]);

  cursor.sectionTitle('Résultats par scénario');
  for (const s of input.scenarios) {
    await _renderScenarioBlock(cursor, s, true);
  }

  cursor.finish(`rapport-batch-${new Date(input.executedAt || Date.now()).getTime()}.pdf`);
}

// Exposed as mutable bindings (rather than plain function declarations) so
// unit tests can substitute them — `import * as X` namespace objects are
// non-configurable per the ES module spec, so spyOn(X, 'fn') can never work
// here; reassigning these bindings from within the module (via the
// test-only helpers below) is the supported way to make them swappable.
export let generateSingleReportPdf: (input: SingleReportInput) => Promise<void> = _generateSingleReportPdf;
export let generateBatchReportPdf: (input: BatchReportInput) => Promise<void> = _generateBatchReportPdf;

/** Test-only: substitute the PDF report implementations. */
export function __setPdfReportForTests(fns: {
  single?: typeof generateSingleReportPdf;
  batch?: typeof generateBatchReportPdf;
}): void {
  if (fns.single) generateSingleReportPdf = fns.single;
  if (fns.batch) generateBatchReportPdf = fns.batch;
}

/** Test-only: restore the real PDF report implementations. */
export function __resetPdfReport(): void {
  generateSingleReportPdf = _generateSingleReportPdf;
  generateBatchReportPdf = _generateBatchReportPdf;
}
