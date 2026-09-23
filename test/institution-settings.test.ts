import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import type { TenantContext } from "../src/lib/tenant/context";
import {
  getInstitutionSettings,
  updateInstitutionProfile,
  updateInstitutionTerminology,
  updateInstitutionOperationalSettings,
} from "../src/lib/settings/institution-service";
import {
  resolveInstitutionTerminology,
  DEFAULT_SEKOLAH_TERMINOLOGY,
  DEFAULT_PESANTREN_TERMINOLOGY,
} from "../src/lib/settings/terminology";
import {
  listManagedUsers,
  updateUserRoles,
  toggleUserActiveStatus,
} from "../src/lib/settings/user-service";
import {
  updateInstitutionPlugins,
  requirePlugin,
  DomainFeatureDisabledError,
  PLUGINS,
} from "../src/lib/plugins";
import { AuthorizationError } from "../src/lib/auth/permissions";
import { ValidationError } from "../src/lib/validation/common";

describe("Milestone — Institution Configuration & Settings Tests", () => {
  const tenantAId = "inst_pesantren_al_falah";
  const tenantBId = "inst_smpit_darul_ilmi";

  // Contexts
  const foundationHeadCtxA: TenantContext = {
    userId: "usr_yayasan_a",
    institutionId: tenantAId,
    roles: ["FOUNDATION_HEAD"],
    permissions: [
      "institution:view",
      "institution:manage",
      "settings:view",
      "settings:manage",
      "staff:view",
      "staff:manage",
      "student:view",
      "finance:view",
      "finance:manage",
    ],
    isSuperAdmin: false,
  };

  const adminCtxA: TenantContext = {
    userId: "usr_admin_a",
    institutionId: tenantAId,
    roles: ["ADMIN"],
    permissions: [
      "institution:view",
      "settings:view",
      "staff:view",
      "student:view",
      "student:create",
      "classroom:manage",
      "attendance:manage",
    ],
    isSuperAdmin: false,
  };

  const teacherCtxA: TenantContext = {
    userId: "usr_guru_a",
    institutionId: tenantAId,
    roles: ["TEACHER"],
    permissions: [
      "student:view",
      "academic:view",
      "attendance:view",
      "attendance:manage",
    ],
    isSuperAdmin: false,
  };

  // Mock Institutions
  const mockInstitutionA = {
    id: tenantAId,
    name: "Pesantren Al-Falah",
    slug: "pesantren-al-falah",
    type: "PESANTREN_TERPADU",
    enabledPlugins: JSON.stringify(["FORMAL_ACADEMIC", "TAHFIDZ"]),
    address: "Jl. Pesantren No. 1",
    phone: "081234567890",
    logoUrl: "https://alfalah.id/logo.png",
    settingsJson: JSON.stringify({
      email: "kontak@alfalah.id",
      website: "https://alfalah.id",
      terminology: {
        student: "Santri",
        guardian: "Wali Santri",
        fee: "Syahriah",
      },
      operational: {
        attendance: {
          lateThresholdMinutes: 20,
          requireAttendanceNotes: true,
        },
      },
    }),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockInstitutionB = {
    id: tenantBId,
    name: "SMPIT Darul Ilmi",
    slug: "smpit-darul-ilmi",
    type: "SEKOLAH",
    enabledPlugins: JSON.stringify(["FORMAL_ACADEMIC"]),
    address: "Jl. Pendidikan No. 5",
    phone: "089876543210",
    logoUrl: null,
    settingsJson: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe("1. Institution Profile Tenant Isolation & Authorization", () => {
    it("harus mengambil profil dan settings sesuai institusi aktif di context", async () => {
      const origInstFind = prisma.institution.findUnique;
      (prisma.institution as any).findUnique = async ({ where }: any) => {
        if (where.id === tenantAId) return mockInstitutionA;
        if (where.id === tenantBId) return mockInstitutionB;
        return null;
      };

      try {
        const settingsA = await getInstitutionSettings(foundationHeadCtxA);
        assert.equal(settingsA.profile.id, tenantAId);
        assert.equal(settingsA.profile.name, "Pesantren Al-Falah");
        assert.equal(settingsA.profile.email, "kontak@alfalah.id");
        assert.equal(settingsA.terminology.student, "Santri");
        assert.equal(settingsA.operational.attendance.lateThresholdMinutes, 20);
      } finally {
        prisma.institution.findUnique = origInstFind;
      }
    });

    it("harus menolak pengguna tanpa izin institution:view atau settings:view", async () => {
      const origInstFind = prisma.institution.findUnique;
      (prisma.institution as any).findUnique = async () => mockInstitutionA;

      try {
        // Akun Guru tidak memiliki institution:view maupun settings:view
        await assert.rejects(
          async () => {
            await getInstitutionSettings(teacherCtxA);
          },
          (err: unknown) => {
            assert(err instanceof AuthorizationError);
            assert.equal(err.status, 403);
            return true;
          }
        );
      } finally {
        prisma.institution.findUnique = origInstFind;
      }
    });

    it("harus menolak pembaruan profil dari pengguna tanpa izin institution:manage", async () => {
      const origInstFind = prisma.institution.findUnique;
      (prisma.institution as any).findUnique = async () => mockInstitutionA;

      try {
        // Admin sekolah hanya punya institution:view, bukan institution:manage
        await assert.rejects(
          async () => {
            await updateInstitutionProfile(adminCtxA, {
              name: "Nama Baru Tidak Sah",
            });
          },
          (err: unknown) => {
            assert(err instanceof AuthorizationError);
            assert.equal(err.status, 403);
            return true;
          }
        );
      } finally {
        prisma.institution.findUnique = origInstFind;
      }
    });

    it("harus berhasil memperbarui profil lembaga dengan izin institution:manage secara terisolasi", async () => {
      const origInstFind = prisma.institution.findUnique;
      const origInstUpdate = prisma.institution.update;

      let updateWhere: any = null;
      let updateData: any = null;

      (prisma.institution as any).findUnique = async ({ where }: any) => {
        if (where.id === tenantAId) return mockInstitutionA;
        return null;
      };

      (prisma.institution as any).update = async ({ where, data }: any) => {
        updateWhere = where;
        updateData = data;
        return {
          ...mockInstitutionA,
          ...data,
        };
      };

      try {
        const updated = await updateInstitutionProfile(foundationHeadCtxA, {
          name: "Pesantren Al-Falah Pusat",
          address: "Jl. Baru No. 99",
          phone: "081122334455",
          email: "sekretariat@alfalah.id",
        });

        assert.equal(updateWhere.id, tenantAId, "Wajib update tenant A");
        assert.equal(updateData.name, "Pesantren Al-Falah Pusat");
        assert.equal(updated.name, "Pesantren Al-Falah Pusat");
        assert.equal(updated.email, "sekretariat@alfalah.id");
      } finally {
        prisma.institution.findUnique = origInstFind;
        prisma.institution.update = origInstUpdate;
      }
    });
  });

  describe("2. Plugin Configuration & Server Enforcement", () => {
    it("harus memperbarui daftar plugin aktif di basis data", async () => {
      const origInstUpdate = prisma.institution.update;
      let updatedSerialized: string = "";

      (prisma.institution as any).update = async ({ where, data }: any) => {
        assert.equal(where.id, tenantAId);
        updatedSerialized = data.enabledPlugins;
        return {
          enabledPlugins: data.enabledPlugins,
        };
      };

      try {
        const result = await updateInstitutionPlugins(tenantAId, {
          plugins: [PLUGINS.FORMAL_ACADEMIC, PLUGINS.TAHFIDZ, PLUGINS.PESANTREN_LIVING],
        });

        assert.deepEqual(result, [
          PLUGINS.FORMAL_ACADEMIC,
          PLUGINS.TAHFIDZ,
          PLUGINS.PESANTREN_LIVING,
        ]);
        assert(updatedSerialized.includes("PESANTREN_LIVING"));
      } finally {
        prisma.institution.update = origInstUpdate;
      }
    });

    it("harus menegakkan error 403 di server saat plugin dimatikan", () => {
      // Institusi B hanya mengaktifkan FORMAL_ACADEMIC
      assert.throws(
        () => {
          requirePlugin(mockInstitutionB, PLUGINS.TAHFIDZ);
        },
        (err: unknown) => {
          assert(err instanceof DomainFeatureDisabledError);
          assert.equal(err.status, 403);
          return true;
        }
      );
    });

    it("harus mengizinkan akses kembali saat plugin diaktifkan ulang tanpa merusak data lama", () => {
      const reEnabledInstitution = {
        ...mockInstitutionB,
        enabledPlugins: JSON.stringify(["FORMAL_ACADEMIC", "TAHFIDZ"]),
      };

      // Tidak boleh melempar error saat plugin diaktifkan kembali
      assert.doesNotThrow(() => {
        requirePlugin(reEnabledInstitution, PLUGINS.TAHFIDZ);
      });
    });
  });

  describe("3. Dynamic Terminology Dictionary & Preset Fallbacks", () => {
    it("harus mengembalikan preset Pesantren secara otomatis untuk institusi jenis PESANTREN", () => {
      const resolved = resolveInstitutionTerminology("PESANTREN");
      assert.equal(resolved.student, "Santri");
      assert.equal(resolved.teacher, "Ustadz");
      assert.equal(resolved.fee, "Syahriah");
      assert.equal(resolved.classroom, "Halaqah");
    });

    it("harus mengembalikan preset Sekolah Formal secara otomatis untuk institusi jenis SEKOLAH", () => {
      const resolved = resolveInstitutionTerminology("SEKOLAH");
      assert.equal(resolved.student, "Siswa");
      assert.equal(resolved.teacher, "Guru");
      assert.equal(resolved.fee, "SPP");
      assert.equal(resolved.classroom, "Kelas");
    });

    it("harus menggabungkan istilah kustom di atas preset bawaan dengan aman", () => {
      const custom = {
        student: "Thalib",
        fee: "Uang Madrasah",
      };

      const resolved = resolveInstitutionTerminology("PESANTREN", custom);
      assert.equal(resolved.student, "Thalib");
      assert.equal(resolved.fee, "Uang Madrasah");
      // Key lain tetap menggunakan fallback preset pesantren
      assert.equal(resolved.teacher, "Ustadz");
      assert.equal(resolved.classroom, "Halaqah");
    });

    it("harus menyimpan kustomisasi terminologi ke settingsJson", async () => {
      const origInstFind = prisma.institution.findUnique;
      const origInstUpdate = prisma.institution.update;

      let savedSettings: any = null;

      (prisma.institution as any).findUnique = async () => mockInstitutionA;
      (prisma.institution as any).update = async ({ data }: any) => {
        savedSettings = JSON.parse(data.settingsJson);
        return {
          type: mockInstitutionA.type,
        };
      };

      try {
        const updated = await updateInstitutionTerminology(foundationHeadCtxA, {
          student: "Santri Mukim",
          teacher: "Kiai & Asatidz",
        });

        assert.equal(savedSettings.terminology.student, "Santri Mukim");
        assert.equal(savedSettings.terminology.teacher, "Kiai & Asatidz");
        assert.equal(updated.student, "Santri Mukim");
      } finally {
        prisma.institution.findUnique = origInstFind;
        prisma.institution.update = origInstUpdate;
      }
    });
  });

  describe("4. Operational Settings Validation & Storage", () => {
    it("harus memperbarui aturan operasional presensi dan keuangan", async () => {
      const origInstFind = prisma.institution.findUnique;
      const origInstUpdate = prisma.institution.update;

      let savedSettings: any = null;

      (prisma.institution as any).findUnique = async () => mockInstitutionA;
      (prisma.institution as any).update = async ({ data }: any) => {
        savedSettings = JSON.parse(data.settingsJson);
        return {};
      };

      try {
        const opResult = await updateInstitutionOperationalSettings(foundationHeadCtxA, {
          attendance: {
            lateThresholdMinutes: 30,
            requireAttendanceNotes: true,
          },
          finance: {
            receiptNumberPrefix: "BUKTI",
            invoiceDueDays: 14,
            receiptFooterNote: "Pembayaran syahriah resmi pesantren.",
          },
        });

        assert.equal(opResult.attendance.lateThresholdMinutes, 30);
        assert.equal(opResult.finance.receiptNumberPrefix, "BUKTI");
        assert.equal(savedSettings.operational.attendance.lateThresholdMinutes, 30);
        assert.equal(savedSettings.operational.finance.receiptNumberPrefix, "BUKTI");
      } finally {
        prisma.institution.findUnique = origInstFind;
        prisma.institution.update = origInstUpdate;
      }
    });

    it("harus menolak input aturan operasional yang tidak valid (ValidationError)", async () => {
      const origInstFind = prisma.institution.findUnique;
      (prisma.institution as any).findUnique = async () => mockInstitutionA;

      try {
        await assert.rejects(
          async () => {
            await updateInstitutionOperationalSettings(foundationHeadCtxA, {
              attendance: {
                lateThresholdMinutes: -5, // Tidak boleh negatif
              },
            });
          },
          (err: unknown) => {
            assert(err instanceof ValidationError);
            assert.equal(err.status, 400);
            return true;
          }
        );
      } finally {
        prisma.institution.findUnique = origInstFind;
      }
    });
  });

  describe("5. User & Role Management Security", () => {
    const mockUsers = [
      {
        id: "usr_1",
        institutionId: tenantAId,
        name: "Ustadz Hasan",
        email: "hasan@alfalah.id",
        phoneWa: "0812345678",
        roles: '["TEACHER"]',
        isActive: true,
        lastLoginAt: new Date(),
        createdAt: new Date(),
      },
      {
        id: "usr_2",
        institutionId: tenantAId,
        name: "Bendahara Siti",
        email: "siti@alfalah.id",
        phoneWa: "0812345679",
        roles: '["FINANCE_STAFF"]',
        isActive: true,
        lastLoginAt: null,
        createdAt: new Date(),
      },
    ];

    it("harus mengambil daftar pengguna internal dengan isolasi tenant", async () => {
      const origUserFindMany = prisma.user.findMany;
      (prisma.user as any).findMany = async ({ where }: any) => {
        assert.equal(where.institutionId, tenantAId);
        return mockUsers;
      };

      try {
        const users = await listManagedUsers(foundationHeadCtxA);
        assert.equal(users.length, 2);
        assert.equal(users[0].name, "Ustadz Hasan");
        assert.deepEqual(users[0].roles, ["TEACHER"]);
      } finally {
        prisma.user.findMany = origUserFindMany;
      }
    });

    it("harus menolak mutasi peran dengan role tidak valid", async () => {
      const origUserFindUnique = prisma.user.findUnique;
      (prisma.user as any).findUnique = async () => mockUsers[0];

      try {
        await assert.rejects(
          async () => {
            await updateUserRoles(foundationHeadCtxA, "usr_1", {
              roles: ["ROLE_PALSU_HACKER"],
            });
          },
          (err: unknown) => {
            assert(err instanceof ValidationError);
            return true;
          }
        );
      } finally {
        prisma.user.findUnique = origUserFindUnique;
      }
    });

    it("harus menolak penonaktifan akun sendiri oleh pengguna yang sedang login", async () => {
      await assert.rejects(
        async () => {
          // Yayasan mencoba menonaktifkan akun yayasan sendiri
          await toggleUserActiveStatus(foundationHeadCtxA, foundationHeadCtxA.userId!, {
            isActive: false,
          });
        },
        (err: unknown) => {
          assert(err instanceof Error);
          assert.equal(err.message, "Anda tidak dapat menonaktifkan akun Anda sendiri.");
          return true;
        }
      );
    });

    it("harus menolak modifikasi pengguna dari tenant lain (cross-tenant)", async () => {
      const origUserFindUnique = prisma.user.findUnique;
      (prisma.user as any).findUnique = async ({ where }: any) => {
        // Return null jika id_institutionId tidak cocok
        return null;
      };

      try {
        await assert.rejects(
          async () => {
            await updateUserRoles(foundationHeadCtxA, "usr_tenant_b", {
              roles: ["TEACHER"],
            });
          },
          (err: unknown) => {
            assert(err instanceof Error);
            assert.equal(err.message, "Pengguna tidak ditemukan dalam lembaga ini.");
            return true;
          }
        );
      } finally {
        prisma.user.findUnique = origUserFindUnique;
      }
    });
  });
});
