import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  TenantContext,
  TenantAccessDeniedError,
  TenantContextMissingError,
  runWithTenantContext,
  getTenantContext,
  requireTenantContext,
} from "../src/lib/tenant/context";
import {
  assertTenantAccess,
  enforceTenantFilter,
  sanitizeClientInput,
} from "../src/lib/tenant/guard";

describe("Phase 0 — Multi-Tenancy & Security Boundary Tests", () => {
  const tenantA: TenantContext = {
    userId: "user_ustadz_ahmad",
    institutionId: "inst_pesantren_darul_quran",
    roles: ["TEACHER"],
    permissions: ["student:read", "student:write"],
    isSuperAdmin: false,
  };

  const tenantB: TenantContext = {
    userId: "user_guru_budi",
    institutionId: "inst_smpit_al_hikmah",
    roles: ["TEACHER"],
    permissions: ["student:read"],
    isSuperAdmin: false,
  };

  const superAdmin: TenantContext = {
    userId: "user_platform_owner",
    institutionId: "inst_central_platform",
    roles: ["SUPER_ADMIN"],
    permissions: ["*"],
    isSuperAdmin: true,
  };

  describe("1. Tenant Context & AsyncLocalStorage Isolation", () => {
    it("harus melempar TenantContextMissingError jika dipanggil di luar konteks sesi", () => {
      assert.throws(
        () => {
          requireTenantContext();
        },
        (err: unknown) => {
          assert(err instanceof TenantContextMissingError);
          assert.equal(err.code, "TENANT_CONTEXT_MISSING");
          assert.equal(err.status, 401);
          return true;
        }
      );
    });

    it("harus mengembalikan konteks yang tepat di dalam runWithTenantContext", () => {
      runWithTenantContext(tenantA, () => {
        const ctx = requireTenantContext();
        assert.equal(ctx.userId, "user_ustadz_ahmad");
        assert.equal(ctx.institutionId, "inst_pesantren_darul_quran");
      });
    });

    it("harus mencegah kebocoran konteks (context bleeding) pada eksekusi asinkron paralel", async () => {
      // Simulasikan 2 request paralel dari institusi yang berbeda
      const request1 = runWithTenantContext(tenantA, async () => {
        await new Promise((r) => setTimeout(r, 20));
        const ctx = requireTenantContext();
        assert.equal(ctx.institutionId, "inst_pesantren_darul_quran");
        return ctx.institutionId;
      });

      const request2 = runWithTenantContext(tenantB, async () => {
        await new Promise((r) => setTimeout(r, 10));
        const ctx = requireTenantContext();
        assert.equal(ctx.institutionId, "inst_smpit_al_hikmah");
        return ctx.institutionId;
      });

      const [resA, resB] = await Promise.all([request1, request2]);
      assert.equal(resA, "inst_pesantren_darul_quran");
      assert.equal(resB, "inst_smpit_al_hikmah");
    });
  });

  describe("2. Tenant Authorization Guard (assertTenantAccess)", () => {
    it("harus mengizinkan akses jika target institutionId sama dengan sesi", () => {
      runWithTenantContext(tenantA, () => {
        assert.doesNotThrow(() => {
          assertTenantAccess("inst_pesantren_darul_quran");
        });
      });
    });

    it("harus menolak keras dan melempar TenantAccessDeniedError (403) jika mencoba mengakses tenant lain", () => {
      runWithTenantContext(tenantA, () => {
        assert.throws(
          () => {
            // Ustadz di Pesantren Darul Quran mencoba mengakses data SMPIT Al-Hikmah
            assertTenantAccess("inst_smpit_al_hikmah");
          },
          (err: unknown) => {
            assert(err instanceof TenantAccessDeniedError);
            assert.equal(err.code, "TENANT_ACCESS_DENIED");
            assert.equal(err.status, 403);
            assert.equal(err.attemptedTenantId, "inst_smpit_al_hikmah");
            assert.equal(err.userTenantId, "inst_pesantren_darul_quran");
            return true;
          }
        );
      });
    });

    it("tetap menolak Super Admin mengakses tenant lain tanpa alur impersonation eksplisit", () => {
      runWithTenantContext(superAdmin, () => {
        assert.throws(() => {
          assertTenantAccess("inst_pesantren_darul_quran");
        }, TenantAccessDeniedError);
      });
    });
  });

  describe("3. Database Query Enforcement (enforceTenantFilter)", () => {
    it("harus otomatis menyuntikkan institutionId dari sesi ke klausa where", () => {
      runWithTenantContext(tenantA, () => {
        const rawFilter = { status: "ACTIVE", name: "Ahmad" };
        const secureFilter = enforceTenantFilter(rawFilter);

        assert.deepEqual(secureFilter, {
          status: "ACTIVE",
          name: "Ahmad",
          institutionId: "inst_pesantren_darul_quran",
        });
      });
    });

    it("harus mendeteksi dan menggagalkan upaya spoofing institutionId dari query luar", () => {
      runWithTenantContext(tenantA, () => {
        // Query luar menyisipkan institutionId milik sekolah lain
        const maliciousFilter = {
          institutionId: "inst_smpit_al_hikmah",
          status: "ACTIVE",
        };

        assert.throws(
          () => {
            enforceTenantFilter(maliciousFilter);
          },
          (err: unknown) => {
            assert(err instanceof TenantAccessDeniedError);
            assert.equal(err.attemptedTenantId, "inst_smpit_al_hikmah");
            return true;
          }
        );
      });
    });

    it("harus membiarkan filter jika institutionId yang dikirim cocok dengan sesi", () => {
      runWithTenantContext(tenantA, () => {
        const legitimateFilter = {
          institutionId: "inst_pesantren_darul_quran",
          status: "ACTIVE",
        };
        const secureFilter = enforceTenantFilter(legitimateFilter);
        assert.equal(secureFilter.institutionId, "inst_pesantren_darul_quran");
      });
    });
  });

  describe("4. Client Input Sanitizer (sanitizeClientInput)", () => {
    it("harus membuang institutionId kiriman klien dan menggantinya dengan sesi", () => {
      runWithTenantContext(tenantB, () => {
        // Klien mencoba mendaftarkan siswa dengan menyuntikkan id lembaga lain
        const untrustedPayload = {
          fullName: "Fatimah Azzahra",
          gender: "P",
          institutionId: "inst_pesantren_darul_quran", // Serangan manipulasi tenant
        };

        const cleanPayload = sanitizeClientInput(untrustedPayload);

        // institutionId palsu wajib ditimpa secara mutlak oleh lembaga sesi
        assert.equal(cleanPayload.fullName, "Fatimah Azzahra");
        assert.equal(cleanPayload.institutionId, "inst_smpit_al_hikmah");
      });
    });
  });
});
