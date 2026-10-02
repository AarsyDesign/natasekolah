/**
 * Exporter PDF naskah ujian (Phase 10.3, PRD #31).
 *
 * Fitur (sesuai PRD #31 & PLAN-PHASE-10 §10.3):
 * - Kop lembaga (nama/alamat/telp/logo bila ada) + identitas ujian.
 * - Blok Ruang, Nama Peserta, dan Nomor Peserta untuk diisi manual.
 * - Body 1/2 kolom configurable (`exam.columnLayout`), aliran per halaman
 *   dengan pengukuran tinggi agar teks tidak terpotong di page break.
 * - Mode SISWA (kunci disembunyikan) dan KUNCI (kunci tebal + latar kuning).
 * - QR verifikasi → `/verify/exam/<token>` (token mentah hanya dipakai sesaat;
 *   yang disimpan di DB tetap hash SHA-256).
 * - Footer institusi + nomor halaman "Halaman n dari m".
 *
 * `compress: false` disengaja agar isi PDF bisa diaudit lewat teks pada test
 * (anti-leak mode SISWA) — tradeoff ukuran file masih wajar untuk naskah ujian.
 */

import PDFDocument from "pdfkit";
import type { TenantContext } from "../tenant/context";
import { requirePermission } from "../auth/permissions";
import {
  validateExportExamPaperInput,
  type ExamExportMode,
} from "../validation/exam-paper";
import { regenerateToken } from "./exam-paper-service";
import {
  buildExamPaperData,
  buildVerifyUrl,
  type ExamPaperData,
  type ExamPaperQuestionItem,
} from "./export-data";
import { generateExamVerifyQr } from "./qr";

// Re-export types for consumers (tests, other exporters)
export type { ExamPaperData, ExamPaperQuestionItem } from "./export-data";

// ---------------------------------------------------------------------------
// Label Indonesia (selaras dengan src/components/exam-paper/exam-paper-ui.ts)
// ---------------------------------------------------------------------------

const EXAM_TYPE_LABEL: Record<string, string> = {
  DAILY: "Harian",
  MIDTERM: "Tengah Semester",
  FINAL: "Akhir Semester",
  REMEDIAL: "Remedial",
  PRACTICAL: "Praktik",
};

const EXAM_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draf",
  READY: "Siap",
  ISSUED: "Diterbitkan",
  ARCHIVED: "Arsip",
};

// ---------------------------------------------------------------------------
// Konstanta layout
// ---------------------------------------------------------------------------

const PAGE_MARGIN = 40;
const GUTTER = 18;
const FOOTER_RESERVE = 26;
const BLOCK_GAP = 8;

interface Segment {
  text: string;
  size: number;
  bold?: boolean;
  indent?: number;
  gapAfter?: number;
  /** Latar kuning untuk penanda kunci (mode KUNCI). */
  highlight?: boolean;
  color?: string;
}

// ---------------------------------------------------------------------------
// Blok soal
// ---------------------------------------------------------------------------

function buildQuestionSegments(
  q: ExamPaperQuestionItem,
  index: number,
  mode: ExamExportMode
): Segment[] {
  const segs: Segment[] = [
    { text: `${index + 1}. ${q.stem} (${q.points} poin)`, size: 10, gapAfter: 3 },
  ];

  if (q.type === "MULTIPLE_CHOICE") {
    for (const opt of q.options) {
      const mark = mode === "KUNCI" && opt.isCorrect;
      segs.push({
        text: `${opt.label}. ${opt.content}${mark ? "   [KUNCI]" : ""}`,
        size: 9.5,
        indent: 14,
        bold: mark,
        highlight: mark,
        gapAfter: 1.5,
      });
    }
  } else if (q.type === "SHORT_ANSWER") {
    if (mode === "KUNCI") {
      segs.push({
        text: `Kunci: ${q.shortAnswerKey?.trim() || "-"}`,
        size: 9.5,
        indent: 14,
        bold: true,
        highlight: true,
        gapAfter: 2,
      });
    } else {
      segs.push({
        text: "Jawab: ______________________________________",
        size: 9.5,
        indent: 14,
        gapAfter: 2,
      });
    }
  } else {
    // ESSAY
    if (mode === "KUNCI") {
      segs.push({
        text: "Pedoman penskoran:",
        size: 9.5,
        indent: 14,
        bold: true,
        gapAfter: 1,
      });
      segs.push({
        text: q.explanation?.trim() || "(belum ada pedoman penskoran)",
        size: 9.5,
        indent: 14,
        gapAfter: 2,
      });
    } else {
      segs.push({ text: "Jawab:", size: 9.5, indent: 14, gapAfter: 4 });
      segs.push({
        text: "________________________________________________________________",
        size: 9.5,
        indent: 14,
        gapAfter: 6,
      });
      segs.push({
        text: "________________________________________________________________",
        size: 9.5,
        indent: 14,
        gapAfter: 2,
      });
    }
  }

  return segs;
}

type PdfDoc = InstanceType<typeof PDFDocument>;

function applyFont(doc: PdfDoc, seg: Segment): void {
  doc.font(seg.bold ? "Helvetica-Bold" : "Helvetica").fontSize(seg.size);
}

function measureBlock(doc: PdfDoc, segs: Segment[], colWidth: number): number {
  let height = 0;
  for (const seg of segs) {
    applyFont(doc, seg);
    const width = colWidth - (seg.indent ?? 0);
    height += doc.heightOfString(seg.text || " ", { width, lineGap: 1.2 });
    height += seg.gapAfter ?? 0;
  }
  return height;
}

function drawBlock(
  doc: PdfDoc,
  segs: Segment[],
  x: number,
  startY: number,
  colWidth: number
): number {
  let y = startY;
  for (const seg of segs) {
    applyFont(doc, seg);
    const indent = seg.indent ?? 0;
    const width = colWidth - indent;
    const opts = { width, lineGap: 1.2, align: "left" as const };
    const height = doc.heightOfString(seg.text, opts);
    if (seg.highlight && seg.text) {
      doc
        .save()
        .rect(x + indent - 3, y - 2, width + 6, height + 3)
        .fill("#FEF0C0")
        .restore();
    }
    doc.fillColor(seg.color ?? "#111111").text(seg.text, x + indent, y, opts);
    y += height + (seg.gapAfter ?? 0);
  }
  return y;
}

// ---------------------------------------------------------------------------
// Header (kop + identitas + ruang/nomor peserta + petunjuk)
// ---------------------------------------------------------------------------

interface HeaderOptions {
  mode: ExamExportMode;
  qrBuffer: Buffer | null;
  verifyUrl: string | null;
}

function drawHeader(doc: PdfDoc, data: ExamPaperData, opts: HeaderOptions): number {
  const contentWidth = doc.page.width - PAGE_MARGIN * 2;
  let y = PAGE_MARGIN;
  let textX = PAGE_MARGIN;
  let hasLogo = false;

  if (data.institution.logoBuffer) {
    try {
      doc.image(data.institution.logoBuffer, PAGE_MARGIN, y, { fit: [46, 46] });
      textX = PAGE_MARGIN + 56;
      hasLogo = true;
    } catch {
      // format gambar tidak didukung PDFKit -> kop tanpa logo
    }
  }

  const textWidth = PAGE_MARGIN + contentWidth - textX;
  doc.font("Helvetica-Bold").fontSize(13.5).fillColor("#111111");
  doc.text(data.institution.name, textX, y, { width: textWidth });
  doc.font("Helvetica").fontSize(8.5).fillColor("#4B5563");
  if (data.institution.address) {
    doc.text(data.institution.address, textX, doc.y + 1, { width: textWidth });
  }
  if (data.institution.phone) {
    doc.text(`Telp: ${data.institution.phone}`, textX, doc.y + 1, { width: textWidth });
  }
  y = Math.max(doc.y + 6, hasLogo ? PAGE_MARGIN + 52 : 0);

  doc
    .moveTo(PAGE_MARGIN, y)
    .lineTo(PAGE_MARGIN + contentWidth, y)
    .lineWidth(1)
    .strokeColor("#374151")
    .stroke();
  y += 12;

  // Judul naskah
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#6B7280");
  doc.text("NAASKAH UJIAN", PAGE_MARGIN, y, {
    width: contentWidth,
    align: "center",
    characterSpacing: 1.5,
  });
  y = doc.y + 2;
  doc.font("Helvetica-Bold").fontSize(15).fillColor("#111111");
  doc.text(data.exam.title, PAGE_MARGIN, y, { width: contentWidth, align: "center" });
  y = doc.y + 6;

  if (opts.mode === "KUNCI") {
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#B91C1C");
    doc.text("KUNCI JAWABAN — HANYA UNTUK PENYELENGGARA", PAGE_MARGIN, y, {
      width: contentWidth,
      align: "center",
    });
    y = doc.y + 8;
  }

  // Identitas ujian (kiri) + QR verifikasi (kanan)
  const qrSize = opts.qrBuffer ? 84 : 0;
  const idWidth = opts.qrBuffer ? contentWidth - qrSize - 14 : contentWidth;
  const idTop = y;

  const idLines: Array<[string, string]> = [
    [
      "Mata Pelajaran",
      data.subject
        ? `${data.subject.name}${data.subject.code ? ` (${data.subject.code})` : ""}`
        : "-",
    ],
    ["Tahun Ajaran", data.academicYear?.name ?? "-"],
    ["Jenis Ujian", EXAM_TYPE_LABEL[data.exam.examType] ?? data.exam.examType],
    ["Status Naskah", EXAM_STATUS_LABEL[data.exam.status] ?? data.exam.status],
  ];

  let lineY = idTop;
  doc.fontSize(9.5);
  const lineHeight = doc.currentLineHeight() + 3;
  for (const [label, value] of idLines) {
    doc
      .font("Helvetica-Bold")
      .fillColor("#374151")
      .text(`${label}: `, PAGE_MARGIN, lineY, { continued: true, width: idWidth });
    doc.font("Helvetica").fillColor("#111111").text(value);
    lineY += lineHeight;
  }
  y = lineY + 4;

  let qrBottom = idTop;
  if (opts.qrBuffer) {
    try {
      doc.image(opts.qrBuffer, PAGE_MARGIN + contentWidth - qrSize, idTop, {
        width: qrSize,
        height: qrSize,
      });
      qrBottom = idTop + qrSize + 4;
      if (opts.verifyUrl) {
        doc.font("Helvetica").fontSize(6.5).fillColor("#6B7280");
        const captionHeight = doc.heightOfString(opts.verifyUrl, { width: qrSize });
        doc.text(opts.verifyUrl, PAGE_MARGIN + contentWidth - qrSize, qrBottom, {
          width: qrSize,
          align: "center",
        });
        qrBottom += captionHeight + 2;
      }
    } catch {
      qrBottom = idTop; // gagal tanam QR tidak boleh mematikan ekspor
    }
  }
  y = Math.max(y, qrBottom + 4);

  // Blok Ruang / Nomor Peserta / Nama Peserta (diisi manual saat ujian)
  doc.font("Helvetica").fontSize(9.5);
  const pad = 6;
  const boxLineHeight = doc.currentLineHeight() + 6;
  const boxHeight = boxLineHeight * 2 + pad * 2;
  doc
    .rect(PAGE_MARGIN, y, contentWidth, boxHeight)
    .lineWidth(0.8)
    .strokeColor("#9CA3AF")
    .stroke();
  doc.fillColor("#111111");
  doc.text(
    "Ruang:  ____________________     Nomor Peserta:  ______________",
    PAGE_MARGIN + pad,
    y + pad,
    { width: contentWidth - pad * 2 }
  );
  doc.text(
    "Nama Peserta:  ......................................................................",
    PAGE_MARGIN + pad,
    y + pad + boxLineHeight,
    { width: contentWidth - pad * 2 }
  );
  y += boxHeight + 8;

  // Petunjuk pengerjaan (bila ada)
  if (data.exam.instructions) {
    doc.font("Helvetica").fontSize(9);
    const instructionText = `Petunjuk: ${data.exam.instructions}`;
    const textHeight = doc.heightOfString(instructionText, {
      width: contentWidth - 16,
      lineGap: 1.5,
    });
    const instructionBoxHeight = textHeight + 14;
    doc.save();
    doc
      .rect(PAGE_MARGIN, y, contentWidth, instructionBoxHeight)
      .fill("#F5F5F4");
    doc
      .rect(PAGE_MARGIN, y, contentWidth, instructionBoxHeight)
      .lineWidth(0.8)
      .strokeColor("#D6D3D1")
      .stroke();
    doc.restore();
    doc.fillColor("#374151");
    doc.text(instructionText, PAGE_MARGIN + 8, y + 7, {
      width: contentWidth - 16,
      lineGap: 1.5,
    });
    y += instructionBoxHeight + 8;
  }

  return y;
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function drawFooters(doc: PdfDoc, data: ExamPaperData): void {
  const range = doc.bufferedPageRange();
  const contentWidth = doc.page.width - PAGE_MARGIN * 2;

  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    const footerY = doc.page.height - PAGE_MARGIN - 14;
    doc
      .moveTo(PAGE_MARGIN, footerY)
      .lineTo(PAGE_MARGIN + contentWidth, footerY)
      .lineWidth(0.5)
      .strokeColor("#D1D5DB")
      .stroke();
    doc.font("Helvetica").fontSize(7.5).fillColor("#6B7280");
    doc.text(data.institution.name, PAGE_MARGIN, footerY + 4, {
      width: contentWidth * 0.6,
    });
    doc.text(`Halaman ${i + 1} dari ${range.count}`, PAGE_MARGIN + contentWidth * 0.6, footerY + 4, {
      width: contentWidth * 0.4,
      align: "right",
    });
  }
}

// ---------------------------------------------------------------------------
// Renderer utama
// ---------------------------------------------------------------------------

export interface RenderExamPaperOptions {
  mode: ExamExportMode;
  verifyUrl?: string | null;
  qrBuffer?: Buffer | null;
}

/**
 * Render data naskah menjadi buffer PDF (murni — tanpa akses DB).
 */
export async function renderExamPaperPdf(
  data: ExamPaperData,
  options: RenderExamPaperOptions
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margin: PAGE_MARGIN,
    bufferPages: true,
    compress: false,
    info: {
      Title: data.exam.title,
      Author: data.institution.name,
      Subject: `Naskah ujian (${options.mode})`,
      Producer: "NataSekolah Exam Paper Engine",
      Creator: "NataSekolah",
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const contentWidth = doc.page.width - PAGE_MARGIN * 2;
  const bodyTop = drawHeader(doc, data, {
    mode: options.mode,
    qrBuffer: options.qrBuffer ?? null,
    verifyUrl: options.verifyUrl ?? null,
  });

  const twoColumns = data.exam.columnLayout === "TWO";
  const columnCount = twoColumns ? 2 : 1;
  const columnWidth = twoColumns ? (contentWidth - GUTTER) / 2 : contentWidth;
  const columnX = (index: number) => PAGE_MARGIN + index * (columnWidth + GUTTER);
  const bottomLimit = () => doc.page.height - PAGE_MARGIN - FOOTER_RESERVE;

  let column = 0;
  let pageStartY = bodyTop;
  let cursorY = bodyTop;

  const advanceColumn = (): void => {
    column += 1;
    if (column >= columnCount) {
      doc.addPage();
      column = 0;
      pageStartY = PAGE_MARGIN;
      cursorY = pageStartY;
    } else {
      cursorY = pageStartY;
    }
  };

  const blocks =
    data.questions.length > 0
      ? data.questions.map((q, index) => buildQuestionSegments(q, index, options.mode))
      : [
          [
            {
              text: "Naskah ini belum berisi butir soal.",
              size: 10,
              color: "#6B7280",
            } as Segment,
          ],
        ];

  for (const block of blocks) {
    if (block.length === 0) continue;
    const height = measureBlock(doc, block, columnWidth);
    if (cursorY + height > bottomLimit()) {
      advanceColumn();
    }
    cursorY = drawBlock(doc, block, columnX(column), cursorY, columnWidth) + BLOCK_GAP;
  }

  drawFooters(doc, data);
  doc.end();

  return finished;
}

// ---------------------------------------------------------------------------
// Orkestrasi ekspor (guard + token QR + render)
// ---------------------------------------------------------------------------

export interface ExamExportResult {
  buffer: Buffer;
  filename: string;
  contentType: string;
  mode: ExamExportMode;
  verifyUrl: string;
}

function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "naskah";
}

/**
 * Ekspor naskah ujian ke PDF.
 *
 * - Guard: `exam:manage` + plugin FORMAL_ACADEMIC (di `buildExamPaperData`).
 * - Token QR verifikasi diputar ulang SETIAP ekspor (`regenerateToken`) —
 *   token mentah hanya hidup di memori untuk QR; DB tetap menyimpan hash.
 *   Konsekuensinya: QR pada cetakan sebelumnya menjadi tidak berlaku (dicatat
 *   pada pesan sukses UI agar operator paham).
 *
 * @throws AuthorizationError / DomainFeatureDisabledError / ExamNotFoundError / ValidationError
 */
export async function exportExamPaperPdf(
  ctx: TenantContext,
  examId: string,
  rawMode: unknown
): Promise<ExamExportResult> {
  // 1. RBAC Guard (dieksplisit agar mode divalidasi setelah izin)
  requirePermission(ctx, "exam:manage");

  // 2. Validasi mode (SISWA | KUNCI)
  const { mode } = validateExportExamPaperInput({ mode: rawMode });

  // 3. Data naskah (plugin + tenant guard menyusul di dalam builder)
  const data = await buildExamPaperData(ctx, examId);

  // 4. Token QR mentah (sekali jalan) + URL publik
  const { rawToken } = await regenerateToken(ctx, examId);
  const verifyUrl = buildVerifyUrl(rawToken);
  const qrBuffer = await generateExamVerifyQr(verifyUrl);

  // 5. Render PDF
  const buffer = await renderExamPaperPdf(data, { mode, verifyUrl, qrBuffer });

  return {
    buffer,
    filename: `Naskah-Ujian-${slugifyTitle(data.exam.title)}-${mode}.pdf`,
    contentType: "application/pdf",
    mode,
    verifyUrl,
  };
}
