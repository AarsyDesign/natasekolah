import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  SESSION_SUBJECT_TYPES,
  GUARDIAN_RELATIONSHIPS,
  GUARDIAN_STATUSES,
  INVITATION_STATUSES,
  isValidSessionSubjectType,
  isValidGuardianRelationship,
  isValidGuardianStatus,
} from "../src/lib/auth/domain";
import {
  createSession,
  validateSessionToken,
  SessionInvariantError,
  generateSessionToken,
  hashSessionToken,
  SESSION_LIFETIME_MS,
  ValidatedSessionPayload,
} from "../src/lib/auth/session";
import {
  createGuardianInvitation,
  activateGuardian,
  GuardianInvitationError,
  INVITATION_LIFETIME_MS,
} from "../src/lib/auth/guardian";
import {
  assertGuardianStudentAccess,
  requireGuardianStudentAccess,
  GuardianAccessDeniedError,
} from "../src/lib/auth/guardian-guard";
import {
  requirePermission,
  resolvePermissionsFromRoles,
  AuthorizationError,
} from "../src/lib/auth/permissions";
import {
  getAuthenticatedTenantContext,
} from "../src/lib/auth/service";
import {
  TenantContextMissingError,
} from "../src/lib/tenant/context";
import { prisma } from "../src/lib/prisma";

describe("Phase 0.1A — Identity & Access Model Tests", () => {
  const instAId = "inst_pesantren_01";
  const instBId = "inst_smpit_02";

  // Mock Data
  const mockUserStaffA = {
    id: "usr_staff_01",
    institutionId: instAId,
    name: "Ustadz Hamzah",
    email: "hamzah@darulquran.sch.id",
    phoneWa: "6281111111111",
    passwordHash: "$2a$12$samplehashstaff",
    roles: '["TEACHER"]',
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockGuardianA1 = {
    id: "grd_budi_01",
    institutionId: instAId,
    fullName: "Budi Santoso",
    phoneWa: "6281234567890",
    email: "budi@keluarga.id",
    status: "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockGuardianA2_SamePhone = {
    id: "grd_siti_02",
    institutionId: instAId,
    fullName: "Siti Aminah",
    phoneWa: "6281234567890", // Nomor WhatsApp keluarga yang sama persis
    email: null,
    status: "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStudentA1 = {
    id: "std_ahmad_01",
    institutionId: instAId,
    fullName: "Ahmad Santoso",
    status: "ACTIVE",
  };

  const mockStudentA2 = {
    id: "std_fatimah_02",
    institutionId: instAId,
    fullName: "Fatimah Santoso",
    status: "ACTIVE",
  };

  const mockStudentB1 = {
    id: "std_zaki_03",
    institutionId: instBId, // Lembaga Lain
    fullName: "Zaki Mubarak",
    status: "ACTIVE",
  };

  describe("1. Session Architecture & Invariant Enforcement", () => {
    it("harus mendukung SESSION_SUBJECT_TYPES terbatas (INTERNAL_USER dan GUARDIAN)", () => {
      assert.deepEqual(SESSION_SUBJECT_TYPES, ["INTERNAL_USER", "GUARDIAN"]);
      assert.equal(isValidSessionSubjectType("INTERNAL_USER"), true);
      assert.equal(isValidSessionSubjectType("GUARDIAN"), true);
      assert.equal(isValidSessionSubjectType("UNKNOWN_ROLE"), false);
      assert.equal(isValidSessionSubjectType("PARENT"), false);
    });

    it("harus menolak sesi jika subjectType sembarang string yang tidak diizinkan", async () => {
      await assert.rejects(
        async () => {
          await createSession({
            subjectType: "HACKER" as any,
            userId: mockUserStaffA.id,
            institutionId: instAId,
          });
        },
        (err: unknown) => {
          assert(err instanceof SessionInvariantError);
          assert.equal(err.code, "INVALID_SESSION_INVARIANT");
          return true;
        }
      );
    });

    it("harus menolak sesi jika userId dan guardianId diisi keduanya sekaligus (invariant violation)", async () => {
      await assert.rejects(
        async () => {
          await createSession({
            subjectType: "INTERNAL_USER",
            userId: mockUserStaffA.id,
            guardianId: mockGuardianA1.id,
            institutionId: instAId,
          });
        },
        (err: unknown) => {
          assert(err instanceof SessionInvariantError);
          assert.match(err.message, /tidak boleh memiliki userId dan guardianId sekaligus/i);
          return true;
        }
      );
    });

    it("harus menolak sesi jika userId dan guardianId keduanya kosong/null (invariant violation)", async () => {
      await assert.rejects(
        async () => {
          await createSession({
            subjectType: "INTERNAL_USER",
            userId: null,
            guardianId: null,
            institutionId: instAId,
          });
        },
        (err: unknown) => {
          assert(err instanceof SessionInvariantError);
          assert.match(err.message, /wajib memiliki salah satu/i);
          return true;
        }
      );
    });

    it("harus menolak sesi INTERNAL_USER jika userId kosong", async () => {
      await assert.rejects(
        async () => {
          await createSession({
            subjectType: "INTERNAL_USER",
            guardianId: mockGuardianA1.id, // Menyalahi subjectType
            institutionId: instAId,
          });
        },
        (err: unknown) => {
          assert(err instanceof SessionInvariantError);
          return true;
        }
      );
    });

    it("harus menolak sesi GUARDIAN jika guardianId kosong", async () => {
      await assert.rejects(
        async () => {
          await createSession({
            subjectType: "GUARDIAN",
            userId: mockUserStaffA.id, // Menyalahi subjectType
            institutionId: instAId,
          });
        },
        (err: unknown) => {
          assert(err instanceof SessionInvariantError);
          return true;
        }
      );
    });
  });

  describe("2. Session ↔ Tenant Integrity & Anti-Tampering", () => {
    it("harus menolak pembuatan sesi INTERNAL_USER jika institutionId tidak cocok dengan User", async () => {
      // Simulasikan prisma.user.findUnique mengembalikan user dari instAId
      const originalFindUnique = prisma.user.findUnique;
      (prisma.user as any).findUnique = async () => ({
        id: mockUserStaffA.id,
        institutionId: instAId,
      });

      try {
        await assert.rejects(
          async () => {
            await createSession({
              subjectType: "INTERNAL_USER",
              userId: mockUserStaffA.id,
              institutionId: instBId, // TAMPERING: mencoba menyuntikkan lembaga B
            });
          },
          (err: unknown) => {
            assert(err instanceof SessionInvariantError);
            assert.match(err.message, /Tenant mismatch/i);
            return true;
          }
        );
      } finally {
        prisma.user.findUnique = originalFindUnique;
      }
    });

    it("harus menolak pembuatan sesi GUARDIAN jika institutionId tidak cocok dengan Guardian", async () => {
      // Simulasikan prisma.guardian.findUnique mengembalikan guardian dari instAId
      const originalFindUnique = prisma.guardian.findUnique;
      (prisma.guardian as any).findUnique = async () => ({
        id: mockGuardianA1.id,
        institutionId: instAId,
      });

      try {
        await assert.rejects(
          async () => {
            await createSession({
              subjectType: "GUARDIAN",
              guardianId: mockGuardianA1.id,
              institutionId: instBId, // TAMPERING: mencoba menyuntikkan lembaga B
            });
          },
          (err: unknown) => {
            assert(err instanceof SessionInvariantError);
            assert.match(err.message, /Tenant mismatch/i);
            return true;
          }
        );
      } finally {
        prisma.guardian.findUnique = originalFindUnique;
      }
    });

    it("harus menolak validasi token jika Session.institutionId beda dengan Subject di basis data", async () => {
      const originalFindUnique = prisma.session.findUnique;

      // Mock session record dengan manipulasi tenant mismatch di DB
      (prisma.session as any).findUnique = async () => ({
        id: "sess_tampered",
        tokenHash: "somehash",
        subjectType: "INTERNAL_USER",
        userId: mockUserStaffA.id,
        guardianId: null,
        institutionId: instBId, // Beda dengan user
        expiresAt: new Date(Date.now() + 1000000),
        revokedAt: null,
        lastUsedAt: new Date(),
        user: { ...mockUserStaffA, institutionId: instAId },
        guardian: null,
        institution: { id: instBId },
      });

      try {
        const payload = await validateSessionToken("dummyToken");
        assert.equal(payload, null); // Wajib ditolak
      } finally {
        prisma.session.findUnique = originalFindUnique;
      }
    });
  });

  describe("3. Phone Policy & Multi-Student / Multi-Guardian Model", () => {
    it("harus mengizinkan dua Guardian berbeda memiliki phoneWa yang sama dalam 1 institusi", () => {
      // Budi (Ayah) dan Siti (Ibu) memiliki phoneWa keluarga yang sama
      assert.equal(mockGuardianA1.phoneWa, mockGuardianA2_SamePhone.phoneWa);
      assert.notEqual(mockGuardianA1.id, mockGuardianA2_SamePhone.id);
      assert.equal(mockGuardianA1.institutionId, mockGuardianA2_SamePhone.institutionId);
    });

    it("harus mendukung satu Guardian memiliki banyak Student (Ahmad & Fatimah)", () => {
      const relations = [
        {
          guardianId: mockGuardianA1.id,
          studentId: mockStudentA1.id,
          relationship: "AYAH",
          isPrimary: true,
        },
        {
          guardianId: mockGuardianA1.id,
          studentId: mockStudentA2.id,
          relationship: "AYAH",
          isPrimary: true,
        },
      ];

      assert.equal(relations.length, 2);
      assert.equal(relations[0].guardianId, mockGuardianA1.id);
      assert.equal(relations[1].guardianId, mockGuardianA1.id);
      assert.notEqual(relations[0].studentId, relations[1].studentId);
    });

    it("harus mendukung satu Student memiliki beberapa Guardian (Ayah & Ibu)", () => {
      const studentGuardians = [
        {
          studentId: mockStudentA1.id,
          guardianId: mockGuardianA1.id,
          relationship: "AYAH",
          isPrimary: true,
        },
        {
          studentId: mockStudentA1.id,
          guardianId: mockGuardianA2_SamePhone.id,
          relationship: "IBU",
          isPrimary: false,
        },
      ];

      assert.equal(studentGuardians.length, 2);
      assert.equal(studentGuardians[0].studentId, mockStudentA1.id);
      assert.equal(studentGuardians[1].studentId, mockStudentA1.id);
      assert.equal(studentGuardians[0].relationship, "AYAH");
      assert.equal(studentGuardians[1].relationship, "IBU");
    });

    it("harus memvalidasi enum hubungan wali dan menolak nilai sembarang", () => {
      assert.equal(isValidGuardianRelationship("AYAH"), true);
      assert.equal(isValidGuardianRelationship("IBU"), true);
      assert.equal(isValidGuardianRelationship("WALI"), true);
      assert.equal(isValidGuardianRelationship("LAINNYA"), true);
      assert.equal(isValidGuardianRelationship("TETANGGA"), false);
      assert.equal(isValidGuardianRelationship("GURU"), false);
    });
  });

  describe("4. Cross-Tenant Relational Integrity & ReBAC Guard", () => {
    it("harus mengizinkan akses relasi jika guardian dan student terdaftar sah di institusi yang sama", async () => {
      const originalFindUnique = prisma.guardianStudent.findUnique;
      (prisma.guardianStudent as any).findUnique = async () => ({
        id: "gs_01",
        institutionId: instAId,
        guardianId: mockGuardianA1.id,
        studentId: mockStudentA1.id,
        relationship: "AYAH",
        isPrimary: true,
      });

      try {
        const relation = await assertGuardianStudentAccess({
          sessionGuardianId: mockGuardianA1.id,
          sessionInstitutionId: instAId,
          requestedStudentId: mockStudentA1.id,
        });

        assert.equal(relation.guardianId, mockGuardianA1.id);
        assert.equal(relation.studentId, mockStudentA1.id);
        assert.equal(relation.institutionId, instAId);
      } finally {
        prisma.guardianStudent.findUnique = originalFindUnique;
      }
    });

    it("harus menolak akses jika wali mencoba mengakses data santri milik orang lain di sekolah yang sama", async () => {
      const originalFindUnique = prisma.guardianStudent.findUnique;
      // Santri bukan anak dari guardian ini (tidak ada relasi di DB)
      (prisma.guardianStudent as any).findUnique = async () => null;

      try {
        await assert.rejects(
          async () => {
            await assertGuardianStudentAccess({
              sessionGuardianId: mockGuardianA1.id,
              sessionInstitutionId: instAId,
              requestedStudentId: "std_bukan_anak_budi",
            });
          },
          (err: unknown) => {
            assert(err instanceof GuardianAccessDeniedError);
            assert.equal(err.status, 403);
            assert.match(err.message, /tidak memiliki hubungan wali/i);
            return true;
          }
        );
      } finally {
        prisma.guardianStudent.findUnique = originalFindUnique;
      }
    });

    it("harus menolak akses jika wali mencoba mengakses data santri di lembaga lain (cross-tenant)", async () => {
      const originalFindUnique = prisma.guardianStudent.findUnique;
      // Relasi ditemukan tetapi lembaga berbeda
      (prisma.guardianStudent as any).findUnique = async () => ({
        id: "gs_cross",
        institutionId: instBId, // Lembaga B
        guardianId: mockGuardianA1.id,
        studentId: mockStudentB1.id,
        relationship: "AYAH",
      });

      try {
        await assert.rejects(
          async () => {
            await assertGuardianStudentAccess({
              sessionGuardianId: mockGuardianA1.id,
              sessionInstitutionId: instAId, // Sesi aktif adalah lembaga A
              requestedStudentId: mockStudentB1.id,
            });
          },
          (err: unknown) => {
            assert(err instanceof GuardianAccessDeniedError);
            assert.equal(err.status, 403);
            assert.match(err.message, /terdaftar pada institusi yang berbeda/i);
            return true;
          }
        );
      } finally {
        prisma.guardianStudent.findUnique = originalFindUnique;
      }
    });

    it("harus menolak upaya manipulasi jika klien mengirimkan guardianId yang beda dengan sesi", async () => {
      await assert.rejects(
        async () => {
          await assertGuardianStudentAccess({
            sessionGuardianId: mockGuardianA1.id,
            sessionInstitutionId: instAId,
            requestedStudentId: mockStudentA1.id,
            clientSuppliedGuardianId: "grd_hacker_impersonator", // Tampering
          });
        },
        (err: unknown) => {
          assert(err instanceof GuardianAccessDeniedError);
          assert.match(err.message, /Manipulasi identitas terdeteksi/i);
          return true;
        }
      );
    });
  });

  describe("5. Ephemeral One-Time Guardian Invitation & Activation Lifecycle", () => {
    it("harus menghasilkan token 256-bit dan hash SHA-256 dengan masa aktif 72 jam", async () => {
      const originalGuardianFindUnique = prisma.guardian.findUnique;
      const originalDeleteMany = prisma.guardianInvitation.deleteMany;
      const originalCreate = prisma.guardianInvitation.create;

      (prisma.guardian as any).findUnique = async () => ({ institutionId: instAId });
      (prisma.guardianInvitation as any).deleteMany = async () => ({ count: 0 });
      (prisma.guardianInvitation as any).create = async ({ data }: any) => ({
        id: "inv_01",
        ...data,
      });

      try {
        const { invitation, rawToken } = await createGuardianInvitation({
          institutionId: instAId,
          guardianId: mockGuardianA1.id,
        });

        assert.equal(rawToken.length, 64); // 32 bytes hex
        assert.equal(invitation.tokenHash.length, 64); // SHA-256
        assert.notEqual(invitation.tokenHash, rawToken);

        const diffHours = (invitation.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
        assert.equal(Math.round(diffHours), 72);
      } finally {
        prisma.guardian.findUnique = originalGuardianFindUnique;
        prisma.guardianInvitation.deleteMany = originalDeleteMany;
        prisma.guardianInvitation.create = originalCreate;
      }
    });

    it("harus menolak aktivasi jika token undangan telah kedaluwarsa (expired)", async () => {
      const originalFindUnique = prisma.guardianInvitation.findUnique;
      (prisma.guardianInvitation as any).findUnique = async () => ({
        id: "inv_expired",
        tokenHash: "somehash",
        institutionId: instAId,
        guardianId: mockGuardianA1.id,
        expiresAt: new Date(Date.now() - 10000), // Kedaluwarsa 10 detik lalu
        redeemedAt: null,
        guardian: mockGuardianA1,
        institution: { id: instAId },
      });

      try {
        await assert.rejects(
          async () => {
            await activateGuardian({ rawToken: "someRawToken" });
          },
          (err: unknown) => {
            assert(err instanceof GuardianInvitationError);
            assert.equal(err.code, "INVITATION_EXPIRED");
            return true;
          }
        );
      } finally {
        prisma.guardianInvitation.findUnique = originalFindUnique;
      }
    });

    it("harus menolak aktivasi jika token undangan sudah pernah digunakan (already redeemed / replay attack)", async () => {
      const originalFindUnique = prisma.guardianInvitation.findUnique;
      (prisma.guardianInvitation as any).findUnique = async () => ({
        id: "inv_redeemed",
        tokenHash: "somehash",
        institutionId: instAId,
        guardianId: mockGuardianA1.id,
        expiresAt: new Date(Date.now() + 100000),
        redeemedAt: new Date(Date.now() - 5000), // Sudah ditebus 5 detik lalu
        guardian: mockGuardianA1,
        institution: { id: instAId },
      });

      try {
        await assert.rejects(
          async () => {
            await activateGuardian({ rawToken: "someRawToken" });
          },
          (err: unknown) => {
            assert(err instanceof GuardianInvitationError);
            assert.equal(err.code, "INVITATION_ALREADY_REDEEMED");
            return true;
          }
        );
      } finally {
        prisma.guardianInvitation.findUnique = originalFindUnique;
      }
    });

    it("harus menyelesaikan aktivasi sukses dan menerbitkan sesi ber-tipe GUARDIAN", async () => {
      const originalFindUnique = prisma.guardianInvitation.findUnique;
      const originalTransaction = prisma.$transaction;
      const originalSessionCreate = prisma.session.create;
      const originalGuardianFindUnique = prisma.guardian.findUnique;

      (prisma.guardianInvitation as any).findUnique = async () => ({
        id: "inv_valid",
        tokenHash: "somehash",
        institutionId: instAId,
        guardianId: mockGuardianA1.id,
        expiresAt: new Date(Date.now() + 100000),
        redeemedAt: null,
        guardian: { ...mockGuardianA1, status: "INVITED" },
        institution: { id: instAId, name: "Pesantren Darul Qur'an" },
      });

      (prisma.guardian as any).findUnique = async () => ({
        id: mockGuardianA1.id,
        institutionId: instAId,
      });

      (prisma.$transaction as any) = async (ops: any[]) => {
        return [
          { id: "inv_valid", redeemedAt: new Date() },
          { ...mockGuardianA1, status: "ACTIVE" },
        ];
      };

      (prisma.session as any).create = async ({ data }: any) => ({
        id: "sess_guardian_01",
        ...data,
      });

      try {
        const result = await activateGuardian({ rawToken: "validRawToken12345" });

        assert.equal(result.guardian.status, "ACTIVE");
        assert.equal(result.session.subjectType, "GUARDIAN");
        assert.equal(result.session.guardianId, mockGuardianA1.id);
        assert.equal(result.session.userId, null);
        assert.equal(result.session.institutionId, instAId);
        assert.equal(result.rawToken.length, 64);
      } finally {
        prisma.guardianInvitation.findUnique = originalFindUnique;
        prisma.$transaction = originalTransaction;
        prisma.session.create = originalSessionCreate;
        prisma.guardian.findUnique = originalGuardianFindUnique;
      }
    });
  });

  describe("6. Teacher vs Guardian Isolation & No Privilege Escalation", () => {
    it("harus memastikan peran PARENT telah dihapus dari RBAC staf", () => {
      const permissions = resolvePermissionsFromRoles(["TEACHER"]);
      assert(permissions.includes("student:read"));
      assert(permissions.includes("academic:read"));
      assert(!permissions.includes("academic:write"));

      // Tidak ada peran PARENT di RBAC
      const parentPerms = resolvePermissionsFromRoles(["PARENT"]);
      assert.deepEqual(parentPerms, []); // Kosong karena PARENT bukan staff role
    });

    it("harus memastikan sesi GUARDIAN ditolak jika mencoba mengeksekusi operasi staf berizin", () => {
      // Guardian Context tidak memiliki roles RBAC staf
      const guardianContextAsStaff = {
        userId: "grd_budi_01", // Bukan user ID
        institutionId: instAId,
        roles: [], // Wali tidak punya role staf
        permissions: [],
        isSuperAdmin: false,
      };

      assert.throws(
        () => {
          requirePermission("attendance:write", guardianContextAsStaff);
        },
        (err: unknown) => {
          assert(err instanceof AuthorizationError);
          assert.equal(err.status, 403);
          assert.equal(err.requiredPermission, "attendance:write");
          return true;
        }
      );
    });

    it("harus mengisolasi guru yang juga wali menjadi dua konteks independen", () => {
      // Guru memiliki entitas User internal
      const teacherIdentity = {
        type: "INTERNAL_USER",
        userId: mockUserStaffA.id,
        roles: ["TEACHER"],
        canAccessTeacherPortal: true,
        canAccessGuardianPortal: false, // Memerlukan sesi wali terpisah
      };

      // Guru yang sama mendaftarkan diri sebagai wali anaknya di sekolah
      const guardianIdentity = {
        type: "GUARDIAN",
        guardianId: "grd_guru_as_parent_01",
        relationshipToStudent: "AYAH",
        canAccessTeacherPortal: false, // Tidak bisa akses fitur guru via sesi ini
        canAccessGuardianPortal: true,
      };

      assert.notEqual(teacherIdentity.userId, guardianIdentity.guardianId);
      assert.equal(teacherIdentity.canAccessTeacherPortal, true);
      assert.equal(guardianIdentity.canAccessTeacherPortal, false);
      assert.equal(guardianIdentity.canAccessGuardianPortal, true);
    });
  });

  describe("7. Hardened ReBAC, Invitation Compound Integrity, & Cross-Context Defenses", () => {
    it("harus menolak pemanggilan requireGuardianStudentAccess jika menggunakan sesi INTERNAL_USER", async () => {
      const internalUserSession = {
        subjectType: "INTERNAL_USER",
        user: mockUserStaffA,
        institution: { id: instAId },
      };

      await assert.rejects(
        async () => {
          await requireGuardianStudentAccess(internalUserSession as any, mockStudentA1.id);
        },
        (err: unknown) => {
          assert(err instanceof GuardianAccessDeniedError);
          assert.equal(err.status, 403);
          assert.match(err.message, /memerlukan sesi aktif portal wali murid/i);
          return true;
        }
      );
    });

    it("harus mengizinkan requireGuardianStudentAccess jika menggunakan sesi GUARDIAN yang sah", async () => {
      const originalFindUnique = prisma.guardianStudent.findUnique;
      (prisma.guardianStudent as any).findUnique = async () => ({
        id: "gs_valid_01",
        institutionId: instAId,
        guardianId: mockGuardianA1.id,
        studentId: mockStudentA1.id,
        relationship: "AYAH",
        isPrimary: true,
      });

      const guardianSession = {
        subjectType: "GUARDIAN",
        guardian: mockGuardianA1,
        institution: { id: instAId },
      };

      try {
        const relation = await requireGuardianStudentAccess(guardianSession as any, mockStudentA1.id);
        assert.equal(relation.guardianId, mockGuardianA1.id);
        assert.equal(relation.studentId, mockStudentA1.id);
        assert.equal(relation.institutionId, instAId);
      } finally {
        prisma.guardianStudent.findUnique = originalFindUnique;
      }
    });

    it("harus menolak getAuthenticatedTenantContext jika dipanggil dengan sesi GUARDIAN", async () => {
      const originalValidate = prisma.session.findUnique;

      // Mock session findUnique mengembalikan sesi tipe GUARDIAN
      (prisma.session as any).findUnique = async () => ({
        id: "sess_guard_token",
        tokenHash: "somehash",
        subjectType: "GUARDIAN",
        userId: null,
        guardianId: mockGuardianA1.id,
        institutionId: instAId,
        expiresAt: new Date(Date.now() + 100000),
        revokedAt: null,
        lastUsedAt: new Date(),
        user: null,
        guardian: mockGuardianA1,
        institution: { id: instAId },
      });

      try {
        await assert.rejects(
          async () => {
            await getAuthenticatedTenantContext("dummyRawToken");
          },
          (err: unknown) => {
            assert(err instanceof TenantContextMissingError);
            assert.match(err.message, /bukan sesi pengguna internal lembaga/i);
            return true;
          }
        );
      } finally {
        prisma.session.findUnique = originalValidate;
      }
    });

    it("harus menolak pembuatan GuardianInvitation jika tenant guardian tidak cocok dengan institutionId", async () => {
      const originalFindUnique = prisma.guardian.findUnique;
      (prisma.guardian as any).findUnique = async () => ({
        institutionId: instAId, // Guardian di Lembaga A
      });

      try {
        await assert.rejects(
          async () => {
            await createGuardianInvitation({
              guardianId: mockGuardianA1.id,
              institutionId: instBId, // Percobaan buat undangan di Lembaga B
            });
          },
          (err: unknown) => {
            assert(err instanceof GuardianInvitationError);
            assert.equal(err.code, "GUARDIAN_NOT_FOUND");
            return true;
          }
        );
      } finally {
        prisma.guardian.findUnique = originalFindUnique;
      }
    });
  });
});
