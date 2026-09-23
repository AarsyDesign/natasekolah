import { prisma } from "../prisma";
import type { TenantContext } from "../tenant/context";
import { requirePermission, hasPermission } from "../auth/permissions";
import { parseEnabledPlugins } from "../plugins/registry";
import { validate } from "../validation/common";
import {
  updateInstitutionProfileSchema,
  updateTerminologySchema,
  updateOperationalSettingsSchema,
} from "./validation";
import { resolveInstitutionTerminology } from "./terminology";
import type {
  InstitutionProfileData,
  TerminologyDictionary,
  OperationalSettings,
  ParsedInstitutionSettings,
} from "./types";

export const DEFAULT_OPERATIONAL_SETTINGS: OperationalSettings = {
  attendance: {
    lateThresholdMinutes: 15,
    requireAttendanceNotes: false,
  },
  finance: {
    receiptNumberPrefix: "KW",
    invoiceDueDays: 10,
    receiptFooterNote: "Kwitansi resmi diterbitkan secara digital oleh sistem.",
  },
  communication: {
    enableWhatsAppNotifications: true,
    whatsappProvider: "deeplink",
  },
  academic: {
    passingGradeDefault: 75,
    reportCardHeader: "Laporan Capaian Kompetensi Peserta Didik",
  },
};

/**
 * Mengurai string JSON settingsJson secara aman dengan fallback objek kosong.
 */
export function parseSettingsJson(raw: string | null | undefined): ParsedInstitutionSettings {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as ParsedInstitutionSettings;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Mengambil seluruh konfigurasi lembaga (Profil, Terminologi, dan Operasional)
 * dengan isolasi tenant dan validasi hak akses institusi.
 */
export async function getInstitutionSettings(ctx: TenantContext): Promise<{
  profile: InstitutionProfileData;
  terminology: TerminologyDictionary;
  operational: OperationalSettings;
}> {
  // Guard: memerlukan institution:view atau settings:view
  if (!hasPermission(ctx, "institution:view") && !hasPermission(ctx, "settings:view")) {
    requirePermission(ctx, "institution:view");
  }

  const institution = await prisma.institution.findUnique({
    where: { id: ctx.institutionId },
  });

  if (!institution) {
    throw new Error("Data lembaga tidak ditemukan.");
  }

  const parsedSettings = parseSettingsJson(institution.settingsJson);
  const enabledPlugins = parseEnabledPlugins(institution.enabledPlugins);
  const terminology = resolveInstitutionTerminology(institution.type, parsedSettings.terminology);

  const operational: OperationalSettings = {
    attendance: {
      ...DEFAULT_OPERATIONAL_SETTINGS.attendance,
      ...(parsedSettings.operational?.attendance || {}),
    },
    finance: {
      ...DEFAULT_OPERATIONAL_SETTINGS.finance,
      ...(parsedSettings.operational?.finance || {}),
    },
    communication: {
      ...DEFAULT_OPERATIONAL_SETTINGS.communication,
      ...(parsedSettings.operational?.communication || {}),
    },
    academic: {
      ...DEFAULT_OPERATIONAL_SETTINGS.academic,
      ...(parsedSettings.operational?.academic || {}),
    },
  };

  const profile: InstitutionProfileData = {
    id: institution.id,
    name: institution.name,
    slug: institution.slug,
    type: institution.type,
    address: institution.address,
    phone: institution.phone,
    logoUrl: institution.logoUrl,
    email: parsedSettings.email || null,
    website: parsedSettings.website || null,
    enabledPlugins,
  };

  return {
    profile,
    terminology,
    operational,
  };
}

/**
 * Memperbarui profil dan identitas lembaga.
 * Memerlukan izin institution:manage.
 */
export async function updateInstitutionProfile(
  ctx: TenantContext,
  rawInput: unknown
): Promise<InstitutionProfileData> {
  requirePermission(ctx, "institution:manage");

  const validated = validate(updateInstitutionProfileSchema, rawInput);

  const current = await prisma.institution.findUnique({
    where: { id: ctx.institutionId },
  });

  if (!current) {
    throw new Error("Lembaga tidak ditemukan.");
  }

  const currentSettings = parseSettingsJson(current.settingsJson);
  const updatedSettings: ParsedInstitutionSettings = {
    ...currentSettings,
    email: validated.email !== undefined ? validated.email : currentSettings.email,
    website: validated.website !== undefined ? validated.website : currentSettings.website,
  };

  const updated = await prisma.institution.update({
    where: { id: ctx.institutionId },
    data: {
      name: validated.name,
      type: validated.type || current.type,
      address: validated.address !== undefined ? validated.address : current.address,
      phone: validated.phone !== undefined ? validated.phone : current.phone,
      logoUrl: validated.logoUrl !== undefined ? validated.logoUrl : current.logoUrl,
      settingsJson: JSON.stringify(updatedSettings),
    },
  });

  return {
    id: updated.id,
    name: updated.name,
    slug: updated.slug,
    type: updated.type,
    address: updated.address,
    phone: updated.phone,
    logoUrl: updated.logoUrl,
    email: updatedSettings.email || null,
    website: updatedSettings.website || null,
    enabledPlugins: parseEnabledPlugins(updated.enabledPlugins),
  };
}

/**
 * Memperbarui kamus terminologi lembaga.
 * Memerlukan izin settings:manage atau institution:manage.
 */
export async function updateInstitutionTerminology(
  ctx: TenantContext,
  rawInput: unknown
): Promise<TerminologyDictionary> {
  if (!hasPermission(ctx, "settings:manage") && !hasPermission(ctx, "institution:manage")) {
    requirePermission(ctx, "settings:manage");
  }

  const validated = validate(updateTerminologySchema, rawInput);

  const current = await prisma.institution.findUnique({
    where: { id: ctx.institutionId },
  });

  if (!current) {
    throw new Error("Lembaga tidak ditemukan.");
  }

  const currentSettings = parseSettingsJson(current.settingsJson);
  const updatedTerminology = {
    ...(currentSettings.terminology || {}),
    ...validated,
  };

  const updatedSettings: ParsedInstitutionSettings = {
    ...currentSettings,
    terminology: updatedTerminology,
  };

  const updated = await prisma.institution.update({
    where: { id: ctx.institutionId },
    data: {
      settingsJson: JSON.stringify(updatedSettings),
    },
  });

  return resolveInstitutionTerminology(updated.type, updatedTerminology);
}

/**
 * Memperbarui aturan operasional domain lembaga (Presensi, Keuangan, Komunikasi, Akademik).
 * Memerlukan izin settings:manage atau institution:manage.
 */
export async function updateInstitutionOperationalSettings(
  ctx: TenantContext,
  rawInput: unknown
): Promise<OperationalSettings> {
  if (!hasPermission(ctx, "settings:manage") && !hasPermission(ctx, "institution:manage")) {
    requirePermission(ctx, "settings:manage");
  }

  const validated = validate(updateOperationalSettingsSchema, rawInput);

  const current = await prisma.institution.findUnique({
    where: { id: ctx.institutionId },
  });

  if (!current) {
    throw new Error("Lembaga tidak ditemukan.");
  }

  const currentSettings = parseSettingsJson(current.settingsJson);
  const currentOp = currentSettings.operational || {};

  const mergedOperational: OperationalSettings = {
    attendance: {
      ...DEFAULT_OPERATIONAL_SETTINGS.attendance,
      ...currentOp.attendance,
      ...(validated.attendance || {}),
    },
    finance: {
      ...DEFAULT_OPERATIONAL_SETTINGS.finance,
      ...currentOp.finance,
      ...(validated.finance || {}),
    },
    communication: {
      ...DEFAULT_OPERATIONAL_SETTINGS.communication,
      ...currentOp.communication,
      ...(validated.communication || {}),
    },
    academic: {
      ...DEFAULT_OPERATIONAL_SETTINGS.academic,
      ...currentOp.academic,
      ...(validated.academic || {}),
    },
  };

  const updatedSettings: ParsedInstitutionSettings = {
    ...currentSettings,
    operational: mergedOperational,
  };

  await prisma.institution.update({
    where: { id: ctx.institutionId },
    data: {
      settingsJson: JSON.stringify(updatedSettings),
    },
  });

  return mergedOperational;
}
