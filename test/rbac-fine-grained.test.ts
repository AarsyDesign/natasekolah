import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ROLES,
  PERMISSIONS,
  Role,
  isValidRole,
  isValidPermission,
  ROLE_PERMISSIONS,
  resolvePermissionsFromRoles,
  hasPermission,
  requirePermission,
  hasRole,
  requireRole,
  AuthorizationError,
  AuthenticationError,
} from "../src/lib/auth/permissions";
import { TenantContext } from "../src/lib/tenant/context";
import { assertTenantAccess, sanitizeClientInput } from "../src/lib/tenant/guard";
import { TenantAccessDeniedError } from "../src/lib/tenant/context";
import { ValidatedSessionPayload } from "../src/lib/auth/session";

describe("Phase 0.2 — Fine-Grained RBAC Tests", () => {
  // Mock Lembaga
  const instA = { id: "inst_sma_01", slug: "sma-1-jakarta" };
  const instB = { id: "inst_pesantren_02", slug: "pesantren-nurul-huda" };

  // Helper untuk membuat mock validated session internal
  function createMockUserSession(params: {
    userId: string;
    institutionId: string;
    roles: Role[];
  }): Extract<ValidatedSessionPayload, { subjectType: "INTERNAL_USER" }> {
    return {
      subjectType: "INTERNAL_USER",
      session: {
        id: `ses_${params.userId}`,
        tokenHash: "hash123",
        subjectType: "INTERNAL_USER",
        userId: params.userId,
        guardianId: null,
        institutionId: params.institutionId,
        ipAddress: null,
        userAgent: null,
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        lastUsedAt: new Date(),
        revokedAt: null,
      },
      user: {
        id: params.userId,
        institutionId: params.institutionId,
        name: `User ${params.userId}`,
        email: `${params.userId}@natasekolah.id`,
        phoneWa: "081234567890",
        passwordHash: "hash_pwd",
        roles: JSON.stringify(params.roles),
        isActive: true,
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      institution: {
        id: params.institutionId,
        name: "Mock Institution",
        slug: "mock-inst",
        type: "SEKOLAH",
        enabledPlugins: "[]",
        address: null,
        phone: null,
        logoUrl: null,
        settingsJson: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
  }

  // Helper untuk membuat mock validated session guardian
  function createMockGuardianSession(params: {
    guardianId: string;
    institutionId: string;
  }): Extract<ValidatedSessionPayload, { subjectType: "GUARDIAN" }> {
    return {
      subjectType: "GUARDIAN",
      session: {
        id: `ses_${params.guardianId}`,
        tokenHash: "hash_grd",
        subjectType: "GUARDIAN",
        userId: null,
        guardianId: params.guardianId,
        institutionId: params.institutionId,
        ipAddress: null,
        userAgent: null,
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        lastUsedAt: new Date(),
        revokedAt: null,
      },
      guardian: {
        id: params.guardianId,
        institutionId: params.institutionId,
        fullName: "Wali Santri",
        phoneWa: "081299998888",
        email: "wali@test.com",
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      institution: {
        id: params.institutionId,
        name: "Mock Institution",
        slug: "mock-inst",
        type: "SEKOLAH",
        enabledPlugins: "[]",
        address: null,
        phone: null,
        logoUrl: null,
        settingsJson: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
  }

  describe("1. Role Recognition & Validation", () => {
    it("harus mengakui 6 peran resmi internal lembaga NataSekolah", () => {
      const expectedRoles = [
        "SUPER_ADMIN",
        "FOUNDATION_HEAD",
        "PRINCIPAL",
        "ADMIN",
        "TEACHER",
        "FINANCE_STAFF",
      ];
      assert.deepEqual(Array.from(ROLES), expectedRoles);

      for (const role of expectedRoles) {
        assert.equal(isValidRole(role), true, `Role [${role}] harus valid`);
      }
    });

    it("harus menolak peran terlarang atau tidak resmi (PARENT, GUARDIAN, dll)", () => {
      assert.equal(isValidRole("PARENT"), false, "PARENT bukan peran internal RBAC");
      assert.equal(isValidRole("GUARDIAN"), false, "GUARDIAN bukan peran internal RBAC");
      assert.equal(isValidRole("STUDENT"), false);
      assert.equal(isValidRole("GUEST"), false);
      assert.equal(isValidRole(""), false);
    });

    it("harus mengakui seluruh permission granular resmi lintas domain", () => {
      assert(PERMISSIONS.includes("student:view"));
      assert(PERMISSIONS.includes("student:create"));
      assert(PERMISSIONS.includes("student:edit"));
      assert(PERMISSIONS.includes("student:archive"));
      assert(PERMISSIONS.includes("academic:view"));
      assert(PERMISSIONS.includes("academic:manage"));
      assert(PERMISSIONS.includes("attendance:view"));
      assert(PERMISSIONS.includes("attendance:manage"));
      assert(PERMISSIONS.includes("finance:view"));
      assert(PERMISSIONS.includes("finance:manage"));
      assert(PERMISSIONS.includes("staff:view"));
      assert(PERMISSIONS.includes("staff:manage"));
      assert(PERMISSIONS.includes("classroom:view"));
      assert(PERMISSIONS.includes("classroom:manage"));
      assert(PERMISSIONS.includes("report:view"));
      assert(PERMISSIONS.includes("report:manage"));
      assert(PERMISSIONS.includes("guardian:view"));
      assert(PERMISSIONS.includes("guardian:manage"));
      assert(PERMISSIONS.includes("institution:view"));
      assert(PERMISSIONS.includes("institution:manage"));
      assert(PERMISSIONS.includes("settings:view"));
      assert(PERMISSIONS.includes("settings:manage"));

      assert.equal(isValidPermission("student:view"), true);
      assert.equal(isValidPermission("non_existent:permission"), false);
    });
  });

  describe("2. Role -> Permission Matrix Semantics", () => {
    it("SUPER_ADMIN harus memiliki izin menyeluruh untuk administrasi platform", () => {
      const superPerms = ROLE_PERMISSIONS.SUPER_ADMIN;
      assert(superPerms.includes("institution:manage"));
      assert(superPerms.includes("settings:manage"));
      assert(superPerms.includes("staff:manage"));
      assert(superPerms.includes("finance:manage"));
      assert(superPerms.includes("student:archive"));
    });

    it("FOUNDATION_HEAD harus memiliki tata kelola lembaga dan keuangan, tanpa administrasi kelas harian", () => {
      const perms = ROLE_PERMISSIONS.FOUNDATION_HEAD;
      assert(perms.includes("institution:manage"));
      assert(perms.includes("finance:manage"));
      assert(perms.includes("staff:manage"));
      assert(perms.includes("settings:manage"));
      assert(perms.includes("report:manage"));
      // Tidak mengarsipkan siswa atau mengelola kelas harian
      assert(!perms.includes("student:archive"));
      assert(!perms.includes("classroom:manage"));
    });

    it("PRINCIPAL harus memimpin operasional akademik sekolah, namun akses keuangan terbatas pada view", () => {
      const perms = ROLE_PERMISSIONS.PRINCIPAL;
      assert(perms.includes("academic:manage"));
      assert(perms.includes("classroom:manage"));
      assert(perms.includes("report:manage"));
      assert(perms.includes("student:edit"));
      assert(perms.includes("finance:view"), "Kepala sekolah boleh melihat laporan keuangan");
      assert(!perms.includes("finance:manage"), "Kepala sekolah tidak boleh mengelola transaksi kas langsung");
      assert(!perms.includes("institution:manage"), "Manajemen lembaga berada pada ranah yayasan/owner");
      assert(!perms.includes("settings:manage"));
    });

    it("ADMIN harus mengelola administrasi siswa, kelas, presensi dan undangan wali, tanpa akses keuangan & settings kritis", () => {
      const perms = ROLE_PERMISSIONS.ADMIN;
      assert(perms.includes("student:create"));
      assert(perms.includes("student:edit"));
      assert(perms.includes("student:archive"));
      assert(perms.includes("classroom:manage"));
      assert(perms.includes("attendance:manage"));
      assert(perms.includes("guardian:manage"));
      assert(!perms.includes("finance:manage"), "Admin sekolah bukan bendahara/staf keuangan");
      assert(!perms.includes("institution:manage"));
      assert(!perms.includes("settings:manage"));
    });

    it("TEACHER harus berfokus pada kegiatan belajar mengajar dan presensi", () => {
      const perms = ROLE_PERMISSIONS.TEACHER;
      assert(perms.includes("student:view"));
      assert(perms.includes("academic:view"));
      assert(perms.includes("attendance:manage"));
      assert(perms.includes("classroom:view"));
      assert(perms.includes("report:view"));

      // Batasan ketat peran guru
      assert(!perms.includes("finance:manage"));
      assert(!perms.includes("finance:view"));
      assert(!perms.includes("staff:manage"));
      assert(!perms.includes("institution:manage"));
      assert(!perms.includes("settings:manage"));
      assert(!perms.includes("student:archive"));
      assert(!perms.includes("academic:manage"));
    });

    it("FINANCE_STAFF harus berfokus pada tagihan, kas, dan pembayaran", () => {
      const perms = ROLE_PERMISSIONS.FINANCE_STAFF;
      assert(perms.includes("finance:view"));
      assert(perms.includes("finance:manage"));
      assert(perms.includes("student:view"), "Staf keuangan perlu melihat data siswa untuk billing");
      assert(perms.includes("report:view"));

      // Batasan ketat peran keuangan
      assert(!perms.includes("academic:manage"));
      assert(!perms.includes("academic:view"));
      assert(!perms.includes("attendance:manage"));
      assert(!perms.includes("attendance:view"));
      assert(!perms.includes("classroom:manage"));
      assert(!perms.includes("staff:manage"));
      assert(!perms.includes("institution:manage"));
      assert(!perms.includes("settings:manage"));
    });
  });

  describe("3. Strict Negative Authorization Tests (Matrix Enforcement)", () => {
    it("TEACHER -> finance:manage = DENY", () => {
      const teacherSession = createMockUserSession({
        userId: "usr_guru_01",
        institutionId: instA.id,
        roles: ["TEACHER"],
      });

      assert.equal(hasPermission(teacherSession, "finance:manage"), false);
      assert.throws(
        () => requirePermission(teacherSession, "finance:manage"),
        (err: unknown) => {
          assert(err instanceof AuthorizationError);
          assert.equal(err.status, 403);
          assert.equal(err.requiredPermission, "finance:manage");
          return true;
        }
      );
    });

    it("FINANCE_STAFF -> academic:manage = DENY", () => {
      const financeSession = createMockUserSession({
        userId: "usr_fin_01",
        institutionId: instA.id,
        roles: ["FINANCE_STAFF"],
      });

      assert.equal(hasPermission(financeSession, "academic:manage"), false);
      assert.throws(
        () => requirePermission(financeSession, "academic:manage"),
        (err: unknown) => {
          assert(err instanceof AuthorizationError);
          assert.equal(err.status, 403);
          return true;
        }
      );
    });

    it("ADMIN -> institution:manage = DENY", () => {
      const adminSession = createMockUserSession({
        userId: "usr_adm_01",
        institutionId: instA.id,
        roles: ["ADMIN"],
      });

      assert.equal(hasPermission(adminSession, "institution:manage"), false);
      assert.throws(
        () => requirePermission(adminSession, "institution:manage"),
        (err: unknown) => {
          assert(err instanceof AuthorizationError);
          assert.equal(err.status, 403);
          return true;
        }
      );
    });

    it("TEACHER -> institution:manage = DENY", () => {
      const teacherSession = createMockUserSession({
        userId: "usr_guru_02",
        institutionId: instA.id,
        roles: ["TEACHER"],
      });

      assert.equal(hasPermission(teacherSession, "institution:manage"), false);
      assert.throws(
        () => requirePermission(teacherSession, "institution:manage"),
        (err: unknown) => {
          assert(err instanceof AuthorizationError);
          assert.equal(err.status, 403);
          return true;
        }
      );
    });
  });

  describe("4. Guardian Isolation from Staff RBAC", () => {
    it("Sesi GUARDIAN memanggil hasPermission() harus selalu return false", () => {
      const guardianSession = createMockGuardianSession({
        guardianId: "grd_ali_01",
        institutionId: instA.id,
      });

      assert.equal(hasPermission(guardianSession, "student:view"), false);
      assert.equal(hasPermission(guardianSession, "academic:view"), false);
      assert.equal(hasPermission(guardianSession, "attendance:view"), false);
      assert.equal(hasPermission(guardianSession, "finance:view"), false);
    });

    it("Sesi GUARDIAN memanggil requirePermission() harus selalu melempar AuthorizationError (403)", () => {
      const guardianSession = createMockGuardianSession({
        guardianId: "grd_ali_01",
        institutionId: instA.id,
      });

      assert.throws(
        () => requirePermission(guardianSession, "student:view"),
        (err: unknown) => {
          assert(err instanceof AuthorizationError);
          assert.equal(err.status, 403);
          assert(err.message.includes("Sesi wali (GUARDIAN) tidak memiliki izin internal"));
          return true;
        }
      );
    });

    it("Sesi GUARDIAN memanggil hasRole() atau requireRole() harus ditolak", () => {
      const guardianSession = createMockGuardianSession({
        guardianId: "grd_ali_01",
        institutionId: instA.id,
      });

      assert.equal(hasRole(guardianSession, "TEACHER"), false);
      assert.equal(hasRole(guardianSession, "ADMIN"), false);

      assert.throws(
        () => requireRole(guardianSession, "TEACHER"),
        (err: unknown) => {
          assert(err instanceof AuthorizationError);
          assert.equal(err.status, 403);
          assert(err.message.includes("Sesi wali (GUARDIAN) tidak memiliki peran staf internal"));
          return true;
        }
      );
    });
  });

  describe("5. Role Guard API (hasRole & requireRole)", () => {
    it("harus mengizinkan requireRole jika pengguna memiliki peran yang diminta", () => {
      const adminSession = createMockUserSession({
        userId: "usr_adm_02",
        institutionId: instA.id,
        roles: ["ADMIN"],
      });

      assert.equal(hasRole(adminSession, "ADMIN"), true);
      assert.doesNotThrow(() => requireRole(adminSession, "ADMIN"));
    });

    it("harus mendukung verifikasi multi-role (or logic)", () => {
      const principalSession = createMockUserSession({
        userId: "usr_prin_01",
        institutionId: instA.id,
        roles: ["PRINCIPAL"],
      });

      assert.equal(hasRole(principalSession, ["ADMIN", "PRINCIPAL"]), true);
      assert.doesNotThrow(() => requireRole(principalSession, ["ADMIN", "PRINCIPAL"]));

      assert.equal(hasRole(principalSession, ["TEACHER", "FINANCE_STAFF"]), false);
      assert.throws(
        () => requireRole(principalSession, ["TEACHER", "FINANCE_STAFF"]),
        (err: unknown) => {
          assert(err instanceof AuthorizationError);
          assert.equal(err.status, 403);
          return true;
        }
      );
    });

    it("harus menolak pemanggilan peran jika sesi bernilai null (AuthenticationError 401)", () => {
      assert.throws(
        () => requireRole(null, "ADMIN"),
        (err: unknown) => {
          assert(err instanceof AuthenticationError);
          assert.equal(err.status, 401);
          return true;
        }
      );

      assert.throws(
        () => requirePermission(null, "student:view"),
        (err: unknown) => {
          assert(err instanceof AuthenticationError);
          assert.equal(err.status, 401);
          return true;
        }
      );
    });
  });

  describe("6. Tenant Boundary Preservation over RBAC", () => {
    it("RBAC tidak boleh mengabaikan tenant isolation: ADMIN tenant A ditolak pada resource tenant B", () => {
      const adminTenantA = createMockUserSession({
        userId: "usr_admin_A",
        institutionId: instA.id,
        roles: ["ADMIN"],
      });

      // 1. Validasi bahwa admin memiliki izin student:edit
      assert.equal(hasPermission(adminTenantA, "student:edit"), true);

      // 2. Tetapi saat mencoba mengakses resource milik institusi B:
      // Harus ditolak oleh tenant security boundary!
      const tenantContextA: TenantContext = {
        userId: adminTenantA.user.id,
        institutionId: adminTenantA.session.institutionId,
        roles: ["ADMIN"],
        permissions: resolvePermissionsFromRoles(["ADMIN"]),
        isSuperAdmin: false,
      };

      assert.throws(
        () => assertTenantAccess(instB.id, tenantContextA),
        (err: unknown) => {
          assert(err instanceof TenantAccessDeniedError);
          assert.equal(err.status, 403);
          assert.equal(err.attemptedTenantId, instB.id);
          assert.equal(err.userTenantId, instA.id);
          return true;
        }
      );
    });

    it("Rantai otorisasi wajib runut: Sesi -> Tenant -> RBAC -> Resource", () => {
      const session = createMockUserSession({
        userId: "usr_guru_a",
        institutionId: instA.id,
        roles: ["TEACHER"],
      });

      // Langkah 1: Sesi tervalidasi
      assert.equal(session.subjectType, "INTERNAL_USER");

      // Langkah 2: Tenant boundary dicek
      const context: TenantContext = {
        userId: session.user.id,
        institutionId: session.session.institutionId,
        roles: ["TEACHER"],
        permissions: resolvePermissionsFromRoles(["TEACHER"]),
        isSuperAdmin: false,
      };
      assert.doesNotThrow(() => assertTenantAccess(instA.id, context));

      // Langkah 3: RBAC permission dicek
      assert.doesNotThrow(() => requirePermission(session, "attendance:manage"));
    });
  });

  describe("7. Anti-Tampering: Client Cannot Self-Assign Roles or Permissions", () => {
    it("sanitizeClientInput harus menghapus role, roles, permissions, dan isSuperAdmin dari payload klien", () => {
      const context: TenantContext = {
        userId: "usr_hacker",
        institutionId: instA.id,
        roles: ["TEACHER"],
        permissions: resolvePermissionsFromRoles(["TEACHER"]),
        isSuperAdmin: false,
      };

      const maliciousPayload = {
        name: "Santri Baru",
        role: "SUPER_ADMIN",
        roles: ["SUPER_ADMIN", "FOUNDATION_HEAD"],
        permissions: ["*"],
        isSuperAdmin: true,
        institutionId: "inst_korban_999",
      };

      const cleanPayload = sanitizeClientInput(maliciousPayload, context);

      // Verifikasi field terlarang telah dibersihkan total
      assert.equal("role" in cleanPayload, false, "Field role klien wajib dibuang");
      assert.equal("roles" in cleanPayload, false, "Field roles klien wajib dibuang");
      assert.equal("permissions" in cleanPayload, false, "Field permissions klien wajib dibuang");
      assert.equal("isSuperAdmin" in cleanPayload, false, "Field isSuperAdmin klien wajib dibuang");

      // Verifikasi institutionId diikat mutlak ke sesi
      assert.equal(cleanPayload.institutionId, instA.id);
      assert.equal(cleanPayload.name, "Santri Baru");
    });
  });

  describe("8. Teacher Assignment Boundary (Conceptual / Domain Separation)", () => {
    it("TEACHER memiliki permission role akademik, tetapi pembatasan data riil berada pada domain assignment", () => {
      const teacherSession = createMockUserSession({
        userId: "usr_ustadz_zulkifli",
        institutionId: instA.id,
        roles: ["TEACHER"],
      });

      // Role check: Guru sah memiliki izin akademik dan presensi
      assert.equal(hasPermission(teacherSession, "academic:view"), true);
      assert.equal(hasPermission(teacherSession, "attendance:manage"), true);

      // Domain-level restriction: Guru tidak otomatis boleh mengubah data semua kelas di seluruh sekolah
      // (Assignment boundary akan ditegakkan pada Domain Academic / Classroom Module)
      const assignedClassroomId = "cls_7a_fiqih";
      const targetClassroomId = "cls_9b_tahfidz";

      const canAccessClass = (assignedId: string, targetId: string) => assignedId === targetId;

      assert.equal(canAccessClass(assignedClassroomId, assignedClassroomId), true);
      assert.equal(canAccessClass(assignedClassroomId, targetClassroomId), false);
    });
  });

  describe("9. SUPER_ADMIN Special Case Without Global Bypass", () => {
    it("SUPER_ADMIN memiliki izin platform eksplisit, tetapi tetap terikat pada subjectType INTERNAL_USER", () => {
      const superAdminSession = createMockUserSession({
        userId: "usr_root_admin",
        institutionId: "inst_platform_hq",
        roles: ["SUPER_ADMIN"],
      });

      assert.equal(hasPermission(superAdminSession, "institution:manage"), true);
      assert.equal(hasPermission(superAdminSession, "settings:manage"), true);
      assert.equal(hasPermission(superAdminSession, "staff:manage"), true);
      assert.equal(hasRole(superAdminSession, "SUPER_ADMIN"), true);

      // Super admin bukanlah peran wali
      assert.equal(superAdminSession.subjectType, "INTERNAL_USER");
    });
  });
});
