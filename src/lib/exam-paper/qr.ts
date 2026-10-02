/**
 * QR verifikasi naskah ujian (Phase 10.3, PRD #31).
 *
 * QR berisi URL publik `/verify/exam/<token mentah>`; yang tersimpan di DB
 * hanyalah hash SHA-256-nya (lihat exam-paper-service.regenerateToken).
 */

import QRCode from "qrcode";

/**
 * Buat buffer PNG QR dari URL verifikasi.
 *
 * @param url URL absolut (hasil `buildVerifyUrl`)
 * @returns Buffer PNG siap ditanam ke PDF/DOCX
 */
export async function generateExamVerifyQr(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    type: "png",
    width: 240,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#111111ff", light: "#ffffffff" },
  });
}
