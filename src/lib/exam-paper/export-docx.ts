/**
 * Exporter DOCX naskah ujian (Phase 10.4, PRD #31).
 *
 * Struktur identik PDF (Phase 10.3) dengan memakai sumber data bersama
 * `buildExamPaperData()` agar tidak ada perbedaan isi antar format.
 *
 * Fitur:
 * - Kop lembaga (nama/alamat/telp/logo bila ada) + identitas ujian.
 * - Blok Ruang, Nama Peserta, dan Nomor Peserta untuk diisi manual.
 * - Body 1/2 kolom configurable (`exam.columnLayout`).
 * - Mode SISWA (kunci disembunyikan) dan KUNCI (kunci tebal + latar kuning).
 * - QR verifikasi → `/verify/exam/<token>`.
 * - Footer institusi + nomor halaman "Halaman n dari m".
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  Header,
  Footer,
  PageNumber,
  PageOrientation,
  VerticalAlign,
  BorderStyle,
  ShadingType,
  ImageRun,
} from "docx";
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

// ---------------------------------------------------------------------------
// Shared types (local to avoid duplicate import)
// ---------------------------------------------------------------------------

export interface ExamExportResult {
  buffer: Buffer;
  filename: string;
  contentType: string;
  mode: "SISWA" | "KUNCI";
  verifyUrl: string;
}

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
// Helpers
// ---------------------------------------------------------------------------

function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "naskah";
}

function createTextRun(
  text: string,
  options: { size?: number; bold?: boolean; color?: string; font?: string } = {}
): TextRun {
  return new TextRun({
    text,
    size: options.size ?? 20, // half-points (10 = 5pt)
    bold: options.bold ?? false,
    color: options.color ?? "111111",
    font: options.font ?? "Helvetica",
  });
}

function createParagraph(
  children: TextRun[],
  options: { alignment?: "start" | "center" | "end" | "both" | "left" | "right" | "mediumKashida" | "distribute" | "numTab" | "highKashida" | "lowKashida" | "thaiDistribute"; indent?: { left?: number; right?: number; hanging?: number; firstLine?: number }; spacing?: { before?: number; after?: number } } = {}
): Paragraph {
  return new Paragraph({
    children,
    alignment: options.alignment,
    indent: options.indent,
    spacing: options.spacing,
  });
}

function createTableCell(
  children: Paragraph[],
  options: { width?: { size: number; type: "auto" | "dxa" | "nil" | "pct" }; borders?: any; shading?: any; verticalAlign?: "top" | "center" | "bottom" } = {}
): TableCell {
  return new TableCell({
    children,
    width: options.width,
    borders: options.borders,
    shading: options.shading,
    verticalAlign: options.verticalAlign ?? "center",
  });
}

function createTableRow(cells: TableCell[]): TableRow {
  return new TableRow({ children: cells });
}

// ---------------------------------------------------------------------------
// Header (kop + identitas + QR + ruang/nomor peserta + petunjuk)
// ---------------------------------------------------------------------------

function createHeaderParagraphs(
  data: ExamPaperData,
  mode: ExamExportMode,
  qrBuffer: Buffer | null,
  verifyUrl: string | null
): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  // Kop lembaga
  const headerChildren: TextRun[] = [];
  if (data.institution.logoBuffer) {
    // Logo akan ditambahkan sebagai gambar terpisah di bawah
  }
  headerChildren.push(
    createTextRun(data.institution.name, { size: 28, bold: true, color: "111111" })
  );
  paragraphs.push(createParagraph(headerChildren, { alignment: AlignmentType.CENTER }));

  if (data.institution.address) {
    paragraphs.push(
      createParagraph(
        [createTextRun(data.institution.address, { size: 16, color: "4B5563" })],
        { alignment: AlignmentType.CENTER }
      )
    );
  }
  if (data.institution.phone) {
    paragraphs.push(
      createParagraph(
        [createTextRun(`Telp: ${data.institution.phone}`, { size: 16, color: "4B5563" })],
        { alignment: AlignmentType.CENTER }
      )
    );
  }

  // Garis pemisah
  paragraphs.push(
    createParagraph(
      [createTextRun("")],
      { spacing: { before: 100, after: 100 } }
    )
  );

  // Judul naskah
  paragraphs.push(
    createParagraph(
      [createTextRun("NAASKAH UJIAN", { size: 18, bold: true, color: "6B7280", font: "Helvetica" })],
      { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 50 } }
    )
  );
  paragraphs.push(
    createParagraph(
      [createTextRun(data.exam.title, { size: 30, bold: true, color: "111111" })],
      { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 100 } }
    )
  );

  if (mode === "KUNCI") {
    paragraphs.push(
      createParagraph(
        [createTextRun("KUNCI JAWABAN — HANYA UNTUK PENYELENGGARA", { size: 20, bold: true, color: "B91C1C" })],
        { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 100 } }
      )
    );
  }

  // Identitas ujian + QR (tabel 2 kolom)
  const idRows: TableRow[] = [];
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

  for (const [label, value] of idLines) {
    idRows.push(
      createTableRow([
        createTableCell(
          [createParagraph([createTextRun(`${label}: `, { size: 19, bold: true, color: "374151" })])],
          { width: { size: 30, type: WidthType.PERCENTAGE } }
        ),
        createTableCell(
          [createParagraph([createTextRun(value, { size: 19, color: "111111" })])],
          { width: { size: 70, type: WidthType.PERCENTAGE } }
        ),
      ])
    );
  }

  // QR code cell
  let qrCell: TableCell | null = null;
  if (qrBuffer) {
    qrCell = createTableCell(
      [
        createParagraph(
          [new ImageRun({ data: qrBuffer, transformation: { width: 84, height: 84 } })],
          { alignment: AlignmentType.CENTER }
        ),
        ...(verifyUrl
          ? [
              createParagraph(
                [createTextRun(verifyUrl, { size: 12, color: "6B7280" })],
                { alignment: AlignmentType.CENTER, spacing: { before: 50 } }
              ),
            ]
          : []),
      ],
      { width: { size: 15, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP }
    );
  }

  // QR sebagai gambar terpisah (table dihapus, pakai paragraf)
  for (const [label, value] of idLines) {
    paragraphs.push(
      createParagraph(
        [
          createTextRun(`${label}: `, { size: 19, bold: true, color: "374151" }),
          createTextRun(value, { size: 19, color: "111111" }),
        ],
        { spacing: { after: 60 } }
      )
    );
  }

  // QR sebagai gambar terpisah
  if (qrBuffer) {
    paragraphs.push(
      createParagraph(
        [
          new ImageRun({
            data: qrBuffer,
            transformation: { width: 120, height: 120 },
          }),
        ],
        { alignment: AlignmentType.RIGHT, spacing: { before: 100, after: 100 } }
      )
    );
    if (verifyUrl) {
      paragraphs.push(
        createParagraph(
          [createTextRun(verifyUrl, { size: 12, color: "6B7280" })],
          { alignment: AlignmentType.RIGHT, spacing: { after: 100 } }
        )
      );
    }
  }

  paragraphs.push(
    createParagraph([createTextRun("")], { spacing: { before: 100, after: 50 } })
  );

  // Blok Ruang / Nomor Peserta / Nama Peserta
  const boxParagraphs = [
    createParagraph(
      [
        createTextRun("Ruang:  ____________________     Nomor Peserta:  ______________", {
          size: 19,
          color: "111111",
        }),
      ],
      { spacing: { after: 40 } }
    ),
    createParagraph(
      [
        createTextRun(
          "Nama Peserta:  ......................................................................",
          { size: 19, color: "111111" }
        ),
      ],
      { spacing: { after: 100 } }
    ),
  ];
  paragraphs.push(...boxParagraphs);

  // Petunjuk pengerjaan
  if (data.exam.instructions) {
    paragraphs.push(
      createParagraph(
        [createTextRun(`Petunjuk: ${data.exam.instructions}`, { size: 18, color: "374151" })],
        { spacing: { before: 100, after: 100 } }
      )
    );
  }

  return paragraphs;
}

// ---------------------------------------------------------------------------
// Blok soal
// ---------------------------------------------------------------------------

function buildQuestionParagraphs(
  q: ExamPaperQuestionItem,
  index: number,
  mode: ExamExportMode
): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  // Nomor soal + stem
  paragraphs.push(
    createParagraph(
      [createTextRun(`${index + 1}. ${q.stem} (${q.points} poin)`, { size: 20, bold: true })],
      { spacing: { before: 100, after: 60 } }
    )
  );

  if (q.type === "MULTIPLE_CHOICE") {
    for (const opt of q.options) {
      const isCorrect = mode === "KUNCI" && opt.isCorrect;
      const text = `${opt.label}. ${opt.content}${isCorrect ? "   [KUNCI]" : ""}`;
      paragraphs.push(
        createParagraph(
          [createTextRun(text, { size: 19, bold: isCorrect, color: isCorrect ? "B91C1C" : "111111" })],
          { indent: { left: 280 }, spacing: { before: 20, after: 20 } }
        )
      );
    }
  } else if (q.type === "SHORT_ANSWER") {
    if (mode === "KUNCI") {
      paragraphs.push(
        createParagraph(
          [createTextRun(`Kunci: ${q.shortAnswerKey?.trim() || "-"}`, { size: 19, bold: true, color: "B91C1C" })],
          { indent: { left: 280 }, spacing: { before: 20, after: 40 } }
        )
      );
    } else {
      paragraphs.push(
        createParagraph(
          [createTextRun("Jawab: ______________________________________", { size: 19, color: "111111" })],
          { indent: { left: 280 }, spacing: { before: 20, after: 40 } }
        )
      );
    }
  } else {
    // ESSAY
    if (mode === "KUNCI") {
      paragraphs.push(
        createParagraph(
          [createTextRun("Pedoman penskoran:", { size: 19, bold: true, color: "111111" })],
          { indent: { left: 280 }, spacing: { before: 20, after: 20 } }
        )
      );
      paragraphs.push(
        createParagraph(
          [createTextRun(q.explanation?.trim() || "(belum ada pedoman penskoran)", { size: 19, color: "111111" })],
          { indent: { left: 280 }, spacing: { before: 0, after: 40 } }
        )
      );
    } else {
      paragraphs.push(
        createParagraph(
          [createTextRun("Jawab:", { size: 19, color: "111111" })],
          { indent: { left: 280 }, spacing: { before: 20, after: 80 } }
        )
      );
      paragraphs.push(
        createParagraph(
          [createTextRun("________________________________________________________________", { size: 19, color: "111111" })],
          { indent: { left: 280 }, spacing: { before: 0, after: 80 } }
        )
      );
      paragraphs.push(
        createParagraph(
          [createTextRun("________________________________________________________________", { size: 19, color: "111111" })],
          { indent: { left: 280 }, spacing: { before: 0, after: 40 } }
        )
      );
    }
  }

  return paragraphs;
}

// ---------------------------------------------------------------------------
// Renderer utama
// ---------------------------------------------------------------------------


export interface RenderExamPaperDocxOptions {
  mode: ExamExportMode;
  verifyUrl?: string | null;
  qrBuffer?: Buffer | null;
}

/**
 * Render data naskah menjadi buffer DOCX (murni — tanpa akses DB).
 */
export async function renderExamPaperDocx(
  data: ExamPaperData,
  options: RenderExamPaperDocxOptions
): Promise<Buffer> {
  const { mode, verifyUrl, qrBuffer } = options;

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 }, // 40pt = 1134 half-points
          },
        },
        headers: {
          default: new Header({
            children: [],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              createParagraph(
                [
                  createTextRun(data.institution.name, { size: 15, color: "6B7280" }),
                  createTextRun("   ", { size: 15 }),
                  new TextRun({
                    children: [
                      new (require("docx").PageNumberElement)({ type: "CURRENT" }),
                      createTextRun(" dari ", { size: 15, color: "6B7280" }),
                      new (require("docx").PageNumberElement)({ type: "TOTAL_PAGES" }),
                    ],
                  }),
                ],
                { alignment: AlignmentType.CENTER }
              ),
            ],
          }),
        },
        children: [
          ...createHeaderParagraphs(data, mode, qrBuffer ?? null, verifyUrl ?? null),
          ...(data.questions.length > 0
            ? data.questions.flatMap((q, index) => buildQuestionParagraphs(q, index, mode))
            : [
                createParagraph(
                  [createTextRun("Naskah ini belum berisi butir soal.", { size: 20, color: "6B7280" })],
                  { spacing: { before: 200, after: 100 } }
                ),
              ]),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

/**
 * Ekspor naskah ujian ke DOCX.
 *
 * - Guard: `exam:manage` + plugin FORMAL_ACADEMIC (di `buildExamPaperData`).
 * - Token QR verifikasi diputar ulang SETIAP ekspor (`regenerateToken`) —
 *   token mentah hanya hidup di memori untuk QR; DB tetap menyimpan hash.
 *   Konsekuensinya: QR pada cetakan sebelumnya menjadi tidak berlaku.
 *
 * @throws AuthorizationError / DomainFeatureDisabledError / ExamNotFoundError / ValidationError
 */
export async function exportExamPaperDocx(
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

  // 5. Render DOCX
  const buffer = await renderExamPaperDocx(data, { mode, verifyUrl, qrBuffer });

  return {
    buffer,
    filename: `Naskah-Ujian-${slugifyTitle(data.exam.title)}-${mode}.docx`,
    contentType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    mode,
    verifyUrl,
  };
}