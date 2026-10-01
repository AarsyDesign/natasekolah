"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedTenantContext } from "../lib/auth/service";
import {
  generateStudentImportPreview,
  executeStudentImport,
  generateStudentImportTemplateBuffer,
  type SanitizedStudentImportData,
} from "../lib/importer";
import { rethrowIfSessionExpired } from "../lib/auth/action-session";

/**
 * Server Action: Unggah & Preview File Spreadsheet Siswa.
 */
export async function previewStudentImportAction(formData: FormData) {
  try {
    const ctx = await getAuthenticatedTenantContext();

    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return { success: false, error: "Harap pilih file spreadsheet untuk diunggah." };
    }

    // Validasi ukuran file (maksimal 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return { success: false, error: "Ukuran file maksimal adalah 5MB." };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const preview = await generateStudentImportPreview(ctx, buffer, file.name);

    return {
      success: true,
      data: preview,
    };
  } catch (err: unknown) {
    rethrowIfSessionExpired(err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memproses file spreadsheet.",
    };
  }
}

/**
 * Server Action: Konfirmasi & Eksekusi Impor Siswa ke Database.
 */
export async function executeStudentImportAction(
  items: SanitizedStudentImportData[]
) {
  try {
    const ctx = await getAuthenticatedTenantContext();

    if (!items || items.length === 0) {
      return { success: false, error: "Tidak ada baris data valid yang dipilih untuk diimpor." };
    }

    const result = await executeStudentImport(ctx, items);

    revalidatePath("/students");
    revalidatePath("/classrooms");

    return {
      success: true,
      data: result,
    };
  } catch (err: unknown) {
    rethrowIfSessionExpired(err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal mengeksekusi impor data siswa.",
    };
  }
}

/**
 * Server Action: Mengunduh Template File Excel Siswa (Base64).
 */
export async function getStudentImportTemplateAction() {
  try {
    const buffer = generateStudentImportTemplateBuffer();
    const base64 = buffer.toString("base64");
    return {
      success: true,
      data: {
        fileName: "Template_Import_Siswa_NataSekolah.xlsx",
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        base64,
      },
    };
  } catch (err: unknown) {
    rethrowIfSessionExpired(err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal membuat template spreadsheet.",
    };
  }
}
