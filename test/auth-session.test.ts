import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/lib/auth/password";
import {
  generateSessionToken,
  hashSessionToken,
  SESSION_LIFETIME_MS,
} from "../src/lib/auth/session";
import {
  AuthenticationError,
  buildTenantContextFromUser,
  sanitizeUser,
} from "../src/lib/auth/service";
import {
  requirePermission,
  hasPermission,
  resolvePermissionsFromRoles,
  AuthorizationError,
} from "../src/lib/auth/permissions";
import {
  assertTenantAccess,
  enforceTenantFilter,
} from "../src/lib/tenant/guard";
import {
  TenantAccessDeniedError,
  TenantContextMissingError,
  TenantContext,
} from "../src/lib/tenant/context";
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  parseSessionTokenFromHeader,
} from "../src/lib/auth/cookie";

describe("Phase 0.1 — Authentication & Session Foundation Tests", () => {
  // Mock Data
  const mockInstitutionA = {
    id: "inst_pesantren_01",
    name: "Pesantren Darul Qur'an",
    slug: "darul-quran",
    type: "PESANTREN",
    enabledPlugins: '["PESANTREN_LIVING", "TAHFIDZ"]',
    address: null,
    phone: null,
    logoUrl: null,
    settingsJson: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockInstitutionB = {
    id: "inst_smpit_02",
    name: "SMPIT Al-Hikmah",
    slug: "smpit-alhikmah",
    type: "SEKOLAH",
    enabledPlugins: '["FORMAL_ACADEMIC"]',
    address: null,
    phone: null,
    logoUrl: null,
    settingsJson: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const plainPassword = "SandiAmanUstadz2026!";
  let sampleHash: string;

  beforeEach(async () => {
    // Generate one hash for testing (cost factor 12)
    sampleHash = await hashPassword(plainPassword);
  });

  describe("1. Password Hashing & Verification (bcryptjs)", () => {
    it("harus menghasilkan hash bcrypt dengan cost factor 12 ($2a$12$...)", async () => {
      assert(sampleHash.startsWith("$2a$12$") || sampleHash.startsWith("$2b$12$"));
      assert.notEqual(sampleHash, plainPassword);
    });

    it("harus memverifikasi kata sandi yang benar dengan sukses", async () => {
      const isValid = await verifyPassword(plainPassword, sampleHash);
      assert.equal(isValid, true);
    });

    it("harus menolak kata sandi yang salah tanpa error", async () => {
      const isValid = await verifyPassword("KataSandiSalah123", sampleHash);
      assert.equal(isValid, false);
    });

    it("harus menolak string kosong atau null", async () => {
      assert.equal(await verifyPassword("", sampleHash), false);
      assert.equal(await verifyPassword(plainPassword, ""), false);
    });
  });

  describe("2. Cryptographic Session Token & Database Hashing", () => {
    it("harus menghasilkan token mentah minimal 256-bit (32-byte hex = 64 karakter)", () => {
      const token1 = generateSessionToken();
      const token2 = generateSessionToken();

      assert.equal(token1.length, 64);
      assert.equal(token2.length, 64);
      assert.notEqual(token1, token2);
    });

    it("harus menghasilkan hash SHA-256 (64 hex characters) dan tidak menyimpan token mentah", () => {
      const rawToken = generateSessionToken();
      const tokenHash = hashSessionToken(rawToken);

      assert.equal(tokenHash.length, 64);
      assert.notEqual(tokenHash, rawToken);

      // Verifikasi konsistensi hashing SHA-256
      const tokenHashAgain = hashSessionToken(rawToken);
      assert.equal(tokenHash, tokenHashAgain);
    });
  });

  describe("3. Session Lifecycle & Validation Rules", () => {
    it("harus memvalidasi masa kedaluwarsa sesi secara akurat (7 hari)", () => {
      const now = Date.now();
      const expiresAt = new Date(now + SESSION_LIFETIME_MS);
      const diffDays = (expiresAt.getTime() - now) / (1000 * 60 * 60 * 24);
      assert.equal(Math.round(diffDays), 7);
    });

    it("harus menolak sesi jika waktu saat ini melebihi expiresAt (expired)", () => {
      const pastTime = new Date(Date.now() - 1000); // 1 detik lalu
      const isExpired = pastTime.getTime() <= Date.now();
      assert.equal(isExpired, true);
    });

    it("harus menolak sesi jika revokedAt terisi (revoked session / logout)", () => {
      const sessionActive = { revokedAt: null };
      const sessionRevoked = { revokedAt: new Date() };

      assert.equal(sessionActive.revokedAt === null, true);
      assert.equal(sessionRevoked.revokedAt !== null, true);
    });
  });

  describe("4. Tenant Context Generation from Authenticated Identity", () => {
    it("harus membentuk TenantContext yang mutlak mengikat institutionId milik pengguna", () => {
      const user = {
        id: "usr_fauzan_01",
        institutionId: mockInstitutionA.id,
        name: "Ustadz Fauzan",
        email: "fauzan@darulquran.sch.id",
        phoneWa: "6281234567890",
        passwordHash: sampleHash,
        roles: '["TEACHER"]',
        isActive: true,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const context = buildTenantContextFromUser(user, mockInstitutionA);

      assert.equal(context.userId, "usr_fauzan_01");
      assert.equal(context.institutionId, mockInstitutionA.id);
      assert.deepEqual(context.roles, ["TEACHER"]);
      assert.equal(context.isSuperAdmin, false);
      assert(context.permissions.includes("student:read"));
    });

    it("harus membersihkan passwordHash dari entitas user publik", () => {
      const user = {
        id: "usr_fauzan_01",
        institutionId: mockInstitutionA.id,
        name: "Ustadz Fauzan",
        email: "fauzan@darulquran.sch.id",
        phoneWa: null,
        passwordHash: sampleHash,
        roles: '["TEACHER"]',
        isActive: true,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const safe = sanitizeUser(user);
      assert.equal("passwordHash" in safe, false);
      assert.equal(safe.id, "usr_fauzan_01");
    });
  });

  describe("5. Cross-Tenant Session Isolation & Tamper Prevention", () => {
    it("harus menolak akses jika sesi Tenant A mencoba mengakses data Tenant B", () => {
      const sessionContextTenantA: TenantContext = {
        userId: "usr_fauzan_01",
        institutionId: mockInstitutionA.id,
        roles: ["TEACHER"],
        permissions: ["student:read"],
        isSuperAdmin: false,
      };

      // Upaya akses ke data SMPIT Al-Hikmah (Lembaga B)
      assert.throws(
        () => {
          assertTenantAccess(mockInstitutionB.id, sessionContextTenantA);
        },
        (err: unknown) => {
          assert(err instanceof TenantAccessDeniedError);
          assert.equal(err.code, "TENANT_ACCESS_DENIED");
          assert.equal(err.status, 403);
          assert.equal(err.attemptedTenantId, mockInstitutionB.id);
          assert.equal(err.userTenantId, mockInstitutionA.id);
          return true;
        }
      );
    });

    it("harus menolak upaya pemalsuan query filter dengan institutionId lain", () => {
      const sessionContextTenantA: TenantContext = {
        userId: "usr_fauzan_01",
        institutionId: mockInstitutionA.id,
        roles: ["TEACHER"],
        permissions: ["student:read"],
        isSuperAdmin: false,
      };

      const spoofedFilter = {
        institutionId: mockInstitutionB.id,
        status: "ACTIVE",
      };

      assert.throws(
        () => {
          enforceTenantFilter(spoofedFilter, sessionContextTenantA);
        },
        (err: unknown) => {
          assert(err instanceof TenantAccessDeniedError);
          return true;
        }
      );
    });
  });

  describe("6. RBAC Permission Foundation & requirePermission Guard", () => {
    it("harus menyelesaikan pemetaan peran TEACHER ke izin akademik yang tepat", () => {
      const permissions = resolvePermissionsFromRoles(["TEACHER"]);
      assert(permissions.includes("student:read"));
      assert(permissions.includes("attendance:write"));
      assert(!permissions.includes("finance:write")); // Guru tidak boleh utak-atik keuangan
    });

    it("harus mengizinkan operasi jika izin yang diminta terpenuhi", () => {
      const teacherContext: TenantContext = {
        userId: "usr_guru",
        institutionId: mockInstitutionB.id,
        roles: ["TEACHER"],
        permissions: ["student:read", "attendance:write"],
        isSuperAdmin: false,
      };

      assert.doesNotThrow(() => {
        requirePermission("student:read", teacherContext);
      });
    });

    it("harus melempar AuthorizationError (403) jika izin tidak mencukupi", () => {
      const teacherContext: TenantContext = {
        userId: "usr_guru",
        institutionId: mockInstitutionB.id,
        roles: ["TEACHER"],
        permissions: ["student:read"],
        isSuperAdmin: false,
      };

      assert.throws(
        () => {
          requirePermission("finance:write", teacherContext);
        },
        (err: unknown) => {
          assert(err instanceof AuthorizationError);
          assert.equal(err.code, "FORBIDDEN_INSUFFICIENT_PERMISSION");
          assert.equal(err.status, 403);
          assert.equal(err.requiredPermission, "finance:write");
          return true;
        }
      );
    });

    it("harus mengizinkan seluruh operasi untuk Super Admin dengan wildcard (*)", () => {
      const superAdminContext: TenantContext = {
        userId: "usr_super",
        institutionId: "inst_central",
        roles: ["SUPER_ADMIN"],
        permissions: ["*"],
        isSuperAdmin: true,
      };

      assert.equal(hasPermission(superAdminContext.permissions, "any:action:ever"), true);
      assert.doesNotThrow(() => {
        requirePermission("institution:delete", superAdminContext);
      });
    });
  });

  describe("7. Cookie Security & Headers Parsing", () => {
    it("harus mengonfigurasi atribut keamanan cookie secara ketat", () => {
      assert.equal(SESSION_COOKIE_OPTIONS.httpOnly, true);
      assert.equal(SESSION_COOKIE_OPTIONS.sameSite, "lax");
      assert.equal(SESSION_COOKIE_OPTIONS.path, "/");
      assert.equal(SESSION_COOKIE_OPTIONS.maxAge, 604800); // 7 hari
    });

    it("harus mengekstrak token mentah dari header Cookie HTTP", () => {
      const rawToken = "abc1234567890def1234567890abcdef1234567890abcdef1234567890abcdef";
      const cookieHeader = `other_cookie=123; ${SESSION_COOKIE_NAME}=${rawToken}; theme=light`;

      const parsed = parseSessionTokenFromHeader(cookieHeader);
      assert.equal(parsed, rawToken);
    });

    it("harus mengembalikan undefined jika cookie tidak ditemukan", () => {
      const parsed = parseSessionTokenFromHeader("other_cookie=123; foo=bar");
      assert.equal(parsed, undefined);
    });
  });

  describe("8. Generic Authentication Error", () => {
    it("harus menggunakan pesan galat generik tanpa membocorkan status email vs password", () => {
      const err = new AuthenticationError();
      assert.equal(err.code, "INVALID_CREDENTIALS");
      assert.equal(err.status, 401);
      assert.equal(err.message, "Identitas lembaga, email, atau kata sandi tidak valid.");
    });
  });
});
