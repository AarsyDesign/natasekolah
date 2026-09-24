import { TenantContext, requireTenantContext } from "./context";
import { assertTenantAccess, enforceTenantFilter, sanitizeClientInput } from "./guard";
import { prisma } from "../prisma";
import type { Prisma, Student, User } from "@prisma/client";

/**
 * Kelas abstrak fondasi untuk seluruh layanan/repository yang berorientasi tenant.
 * Memastikan bahwa setiap pemanggilan operasi database selalu membawa konteks tenant yang sah.
 */
export abstract class BaseTenantService {
  protected context: TenantContext;

  constructor(context?: TenantContext) {
    this.context = context || requireTenantContext();
  }

  /**
   * Mengembalikan ID lembaga dari sesi aktif.
   */
  public get institutionId(): string {
    return this.context.institutionId;
  }

  /**
   * Memastikan ID lembaga target selaras dengan sesi aktif.
   */
  protected verifyAccess(targetInstitutionId: string): void {
    assertTenantAccess(targetInstitutionId, this.context);
  }

  /**
   * Menyuntikkan filter institutionId ke dalam klausa where.
   */
  protected applyTenantFilter<T extends Record<string, unknown>>(where: T): T & { institutionId: string } {
    return enforceTenantFilter(where, this.context);
  }
}

/**
 * Service Kesiswaan Terisolasi Tenant (Contoh Implementasi Phase 0 Tenancy Guard)
 * Menjamin 100% bahwa query kesiswaan tidak pernah bocor lintas-lembaga.
 */
export class TenantStudentService extends BaseTenantService {
  /**
   * Mencari seluruh siswa dalam institusi aktif.
   */
  async findStudents(filter?: { status?: string; search?: string }): Promise<Student[]> {
    const whereClause: Prisma.StudentWhereInput = {
      institutionId: this.institutionId,
      ...(filter?.status ? { status: filter.status } : {}),
      ...(filter?.search
        ? {
            fullName: {
              contains: filter.search,
              mode: "insensitive",
            },
          }
        : {}),
    };

    return prisma.student.findMany({
      where: whereClause,
      orderBy: { fullName: "asc" },
    });
  }

  /**
   * Mengambil data satu siswa dengan penjagaan tenant yang ketat.
   */
  async findStudentById(id: string): Promise<Student | null> {
    return prisma.student.findFirst({
      where: {
        id,
        institutionId: this.institutionId,
      },
    });
  }

  /**
   * Mendaftarkan siswa baru. Input dari klien dibersihkan dari institutionId palsu.
   */
  async createStudent(input: {
    fullName: string;
    gender?: string;
    nis?: string;
    nisLocal?: string;
    parentWaPhone?: string;
    institutionId?: string; // Jika klien nakal mengirim ini, akan di-sanitize
  }): Promise<Student> {
    const sanitized = sanitizeClientInput(input, this.context);

    return prisma.student.create({
      data: {
        fullName: sanitized.fullName,
        gender: sanitized.gender || "L",
        nis: sanitized.nis || sanitized.nisLocal || `NIS-${Date.now()}`,
        parentWaPhone: sanitized.parentWaPhone,
        institutionId: this.institutionId, // Mutlak dari sesi
      },
    });
  }

  /**
   * Menghapus siswa dengan perlindungan batas lembaga.
   */
  async deleteStudent(id: string): Promise<Student> {
    // Verifikasi kepemilikan sebelum penghapusan
    const existing = await this.findStudentById(id);
    if (!existing) {
      throw new Error(`Siswa dengan ID ${id} tidak ditemukan.`);
    }

    return prisma.student.delete({
      where: { id },
    });
  }
}

/**
 * Layanan Audit Log Terisolasi Tenant
 */
export class TenantAuditService extends BaseTenantService {
  async log(
    params: {
      action: string;
      entityType: string;
      entityId?: string;
      detailsJson?: string;
    },
    txPrisma?: typeof prisma | any
  ) {
    const client = txPrisma || prisma;
    return client.auditLog.create({
      data: {
        institutionId: this.institutionId,
        userId: this.context.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        detailsJson: params.detailsJson,
      },
    });
  }
}
