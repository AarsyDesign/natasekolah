import { prisma } from "../prisma";
import type { TenantContext } from "../tenant/context";
import { requirePermission } from "../auth/permissions";
import { validateAuditLogFilter, type AuditLogFilter } from "../validation/audit";

/**
 * Phase 12.3 — AuditLog Query API.
 *
 * Layanan baca jejak audit (`AuditLog`) untuk kebutuhan audit internal lembaga.
 *
 * Invariant keamanan:
 * - Guard `institution:view` (izin resmi; sinonim legacy `audit:read` →
 *   `institution:view` lewat `LEGACY_PERMISSION_MAP`).
 * - Filter tenant MANDATORI dari `ctx.institutionId` — tidak pernah dari
 *   klien. Lembaga lain tidak bisa terbaca dengan cara apa pun.
 * - `detailsJson` diteruskan apa adanya sebagai objek (bila valid JSON) —
 *   penulis audit sudah bertanggung jawab tidak menyimpan rahasia di sana.
 * - Paginasi berbasis offset page (ringkas, batas pageSize 50) dengan
 *   `total` agar UI bisa merender paginasi stabil.
 */

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: Date;
  actor: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface AuditLogPage {
  items: AuditLogEntry[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Aksi & entitas unik (untuk mengisi dropdown filter UI). Terikat tenant. */
export interface AuditLogFacets {
  actions: string[];
  entityTypes: string[];
}

function parseDetails(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    // Detail bukan JSON valid → jangan membocorkan raw string ke UI.
    return null;
  }
}

/** Bangun where-clause Prisma dari filter tervalidasi + tenant boundary. */
export function buildAuditLogWhere(
  institutionId: string,
  filter: AuditLogFilter
) {
  const and: Record<string, unknown>[] = [{ institutionId }];

  if (filter.action) and.push({ action: filter.action });
  if (filter.entityType) and.push({ entityType: filter.entityType });
  if (filter.entityId) and.push({ entityId: filter.entityId });
  if (filter.userId) and.push({ userId: filter.userId });

  const range: Record<string, Date> = {};
  // `to` adalah tanggal inklusif → akhir hari.
  if (filter.from) range.gte = new Date(`${filter.from}T00:00:00.000Z`);
  if (filter.to) range.lte = new Date(`${filter.to}T23:59:59.999Z`);
  if (Object.keys(range).length > 0) and.push({ createdAt: range });

  return { AND: and };
}

/** Ambil satu halaman jejak audit milik lembaga. */
export async function listAuditLog(
  ctx: TenantContext,
  rawFilter?: unknown,
  tx: any = prisma
): Promise<AuditLogPage> {
  requirePermission(ctx, "institution:view");

  const filter = validateAuditLogFilter(rawFilter);
  const where = buildAuditLogWhere(ctx.institutionId, filter);

  const [total, rows] = await Promise.all([
    tx.auditLog.count({ where }),
    tx.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        detailsJson: true,
        ipAddress: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  return {
    items: rows.map((row: any) => ({
      id: row.id,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      details: parseDetails(row.detailsJson),
      ipAddress: row.ipAddress,
      createdAt: row.createdAt,
      actor: row.user
        ? { id: row.user.id, name: row.user.name, email: row.user.email }
        : null,
    })),
    page: filter.page,
    pageSize: filter.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / filter.pageSize)),
  };
}

/**
 * Opsi filter (aksi + entitas unik) untuk lembaga aktif.
 * Dipakai UI mengisi dropdown; batas 50 entri masing-masing agar murah.
 */
export async function getAuditLogFacets(
  ctx: TenantContext,
  tx: any = prisma
): Promise<AuditLogFacets> {
  requirePermission(ctx, "institution:view");

  const [actions, entityTypes] = await Promise.all([
    tx.auditLog.findMany({
      where: { institutionId: ctx.institutionId },
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
      take: 50,
    }),
    tx.auditLog.findMany({
      where: { institutionId: ctx.institutionId },
      distinct: ["entityType"],
      select: { entityType: true },
      orderBy: { entityType: "asc" },
      take: 50,
    }),
  ]);

  return {
    actions: actions.map((r: { action: string }) => r.action),
    entityTypes: entityTypes.map((r: { entityType: string }) => r.entityType),
  };
}
