import { prisma } from "../prisma";
import type { TenantContext } from "../tenant/context";
import { requirePermission, hasPermission } from "../auth/permissions";
import { ResourceNotFoundError } from "../academic/types";
import {
  validateUpsertStudentClusterInput,
  validateGetStudentProfileInput,
  type ProfileCluster,
} from "../validation/student-profile";

/**
 * Phase 9.3 — Student Full Profile (5 Kluster Dapodik/EMIS).
 *
 * Kluster terstruktur siswa di luar profil inti (`Student`) dan relasi wali
 * (`Guardian`): FAMILY (keluarga), HEALTH (kesehatan/disabilitas), REGISTRY
 * (berkas administratif). Ketiganya tabel 1-to-1 dengan compound FK
 * `[studentId, institutionId]`.
 *
 * - Baca  : `student:view`  → `getStudentProfileClusters`
 * - Tulis : `student:edit`  → `upsertStudentCluster` (+ jejak AuditLog)
 * Semua operasi terikat TenantContext; siswa lintas lembaga ditolak
 * `ResourceNotFoundError` sebelum menyentuh tabel kluster.
 */

/** Peta kluster → delegate PrismaClient + entityType AuditLog. */
const CLUSTER_META: Record<
  ProfileCluster,
  { delegate: "studentFamilyData" | "studentHealthData" | "studentRegistryData"; entityType: string }
> = {
  FAMILY: { delegate: "studentFamilyData", entityType: "StudentFamilyData" },
  HEALTH: { delegate: "studentHealthData", entityType: "StudentHealthData" },
  REGISTRY: { delegate: "studentRegistryData", entityType: "StudentRegistryData" },
};

export interface StudentProfileClusters {
  student: {
    id: string;
    fullName: string;
    nis: string;
    nisn: string | null;
    status: string;
  };
  family: Record<string, unknown> | null;
  health: Record<string, unknown> | null;
  registry: Record<string, unknown> | null;
  /** true bila sesi memegang `student:edit` (form dapat disimpan). */
  canEdit: boolean;
}

async function assertStudentBelongsToTenant(
  tx: any,
  ctx: TenantContext,
  studentId: string
): Promise<{ id: string; fullName: string; nis: string; nisn?: string | null; status: string }> {
  const student = await tx.student.findUnique({
    where: { id_institutionId: { id: studentId, institutionId: ctx.institutionId } },
    select: { id: true, fullName: true, nis: true, nisn: true, status: true },
  });
  if (!student) {
    throw new ResourceNotFoundError("Siswa", studentId);
  }
  return student;
}

async function writeProfileAuditLog(
  ctx: TenantContext,
  action: "CREATE" | "UPDATE",
  cluster: ProfileCluster,
  studentId: string,
  fields: string[],
  tx: any
): Promise<void> {
  try {
    await tx.auditLog.create({
      data: {
        institutionId: ctx.institutionId,
        userId: ctx.userId ?? null,
        action,
        entityType: CLUSTER_META[cluster].entityType,
        entityId: studentId,
        detailsJson: JSON.stringify({ cluster, studentId, fields }),
      },
    });
  } catch (auditErr) {
    console.error("[StudentProfileAudit] Gagal menulis jejak audit:", auditErr);
  }
}

/**
 * Mengambil ketiga kluster profil siswa sekaligus.
 * Baris kluster yang belum pernah diisi dikembalikan `null` (bukan error) —
 * UI menampilkan empty state + form tambah.
 */
export async function getStudentProfileClusters(
  ctx: TenantContext,
  studentIdRaw: string,
  tx: any = prisma
): Promise<StudentProfileClusters> {
  requirePermission(ctx, "student:view");
  const { studentId } = validateGetStudentProfileInput({ studentId: studentIdRaw });

  const student = await assertStudentBelongsToTenant(tx, ctx, studentId);

  const [family, health, registry] = await Promise.all([
    tx.studentFamilyData.findUnique({
      where: { studentId_institutionId: { studentId, institutionId: ctx.institutionId } },
    }),
    tx.studentHealthData.findUnique({
      where: { studentId_institutionId: { studentId, institutionId: ctx.institutionId } },
    }),
    tx.studentRegistryData.findUnique({
      where: { studentId_institutionId: { studentId, institutionId: ctx.institutionId } },
    }),
  ]);

  return {
    student: {
      id: student.id,
      fullName: student.fullName,
      nis: student.nis,
      nisn: student.nisn ?? null,
      status: student.status,
    },
    family: family ?? null,
    health: health ?? null,
    registry: registry ?? null,
    canEdit: hasPermission(ctx, "student:edit"),
  };
}

/**
 * Upsert satu kluster profil siswa (create bila belum ada, timpa bila sudah).
 * Payload divalidasi Zod per kluster (discriminated union `cluster`).
 */
export async function upsertStudentCluster(
  ctx: TenantContext,
  rawInput: unknown,
  tx: any = prisma
): Promise<{ cluster: ProfileCluster; data: Record<string, unknown> }> {
  requirePermission(ctx, "student:edit");
  const validated = validateUpsertStudentClusterInput(rawInput);

  await assertStudentBelongsToTenant(tx, ctx, validated.studentId);

  const meta = CLUSTER_META[validated.cluster];
  const delegate = tx[meta.delegate];
  const key = { studentId: validated.studentId, institutionId: ctx.institutionId };
  // Hanya bidang yang benar-benar dikirim klien yang ikut disimpan/diaudit —
  // key dengan nilai undefined (tidak dikirim) dianyahkan agar upsert parsial
  // tidak menimpa bidang lain menjadi null.
  const payload = Object.fromEntries(
    Object.entries(validated.data as Record<string, unknown>).filter(
      ([, v]) => v !== undefined
    )
  );

  const existing = await delegate.findUnique({ where: { studentId_institutionId: key } });

  const saved = existing
    ? await delegate.update({ where: { studentId_institutionId: key }, data: payload })
    : await delegate.create({
        data: { institutionId: ctx.institutionId, studentId: validated.studentId, ...payload },
      });

  await writeProfileAuditLog(
    ctx,
    existing ? "UPDATE" : "CREATE",
    validated.cluster,
    validated.studentId,
    Object.keys(payload),
    tx
  );

  return { cluster: validated.cluster, data: saved as Record<string, unknown> };
}
