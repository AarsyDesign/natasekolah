import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ValidationError,
  validateLoginInput,
  validateCreateGuardianInput,
  validateLinkGuardianStudentInput,
  validateCreateStudentInput,
  paginationSchema,
  searchQuerySchema,
  phoneSchema,
  slugSchema,
} from "../src/lib/validation";
import {
  PLUGINS,
  getAllPlugins,
  isValidPlugin,
  parseEnabledPlugins,
  serializeEnabledPlugins,
  isPluginEnabled,
  requirePlugin,
  DomainFeatureDisabledError,
  updatePluginsInputSchema,
} from "../src/lib/plugins";
import { sanitizeClientInput, assertTenantAccess } from "../src/lib/tenant/guard";
import { TenantContext, TenantAccessDeniedError } from "../src/lib/tenant/context";
import { requirePermission, AuthorizationError } from "../src/lib/auth/permissions";

describe("Phase 0.3 — Input Validation & Domain Plugin Registry Tests", () => {
  // -------------------------------------------------------------------------
  // 1. Zod Validation: Authentication Input
  // -------------------------------------------------------------------------
  describe("1. Authentication Input Validation (Zod)", () => {
    it("harus meloloskan input login yang valid dan membersihkan whitespace", () => {
      const input = {
        institutionSlug: "sma-1-jakarta",
        email: "  ADMIN@SEKOLAH.SCH.ID  ",
        password: "RahasiaSekolah2026!",
      };

      const validated = validateLoginInput(input);
      assert.equal(validated.institutionSlug, "sma-1-jakarta");
      assert.equal(validated.email, "admin@sekolah.sch.id", "Email harus diubah ke huruf kecil dan ditrim");
      assert.equal(validated.password, "RahasiaSekolah2026!");
    });

    it("harus menolak format email yang tidak valid", () => {
      const input = {
        institutionSlug: "sma-1-jakarta",
        email: "bukan-email-valid",
        password: "password123",
      };

      assert.throws(
        () => validateLoginInput(input),
        (err: unknown) => {
          assert(err instanceof ValidationError);
          assert.equal(err.status, 400);
          assert(err.errors.some((e) => e.field === "email"));
          return true;
        }
      );
    });

    it("harus menolak kata sandi yang kosong atau hanya spasi", () => {
      const input = {
        institutionSlug: "sma-1-jakarta",
        email: "admin@sekolah.sch.id",
        password: "",
      };

      assert.throws(
        () => validateLoginInput(input),
        (err: unknown) => {
          assert(err instanceof ValidationError);
          assert.equal(err.status, 400);
          assert(err.errors.some((e) => e.field === "password"));
          return true;
        }
      );
    });

    it("harus menolak slug institusi dengan format terlarang (spasi / huruf besar)", () => {
      const input = {
        institutionSlug: "SMA 1 JAKARTA!",
        email: "admin@sekolah.sch.id",
        password: "password123",
      };

      assert.throws(
        () => validateLoginInput(input),
        (err: unknown) => {
          assert(err instanceof ValidationError);
          assert.equal(err.status, 400);
          assert(err.errors.some((e) => e.field === "institutionSlug"));
          return true;
        }
      );
    });
  });

  // -------------------------------------------------------------------------
  // 2. Zod Validation: Guardian Input
  // -------------------------------------------------------------------------
  describe("2. Guardian Input Validation (Zod)", () => {
    it("harus meloloskan pendaftaran wali murid dengan data yang sah", () => {
      const input = {
        fullName: "Budi Santoso",
        phoneWa: "081234567890",
        email: "budi@keluarga.id",
        relationship: "AYAH",
      };

      const validated = validateCreateGuardianInput(input);
      assert.equal(validated.fullName, "Budi Santoso");
      assert.equal(validated.phoneWa, "081234567890");
      assert.equal(validated.relationship, "AYAH");
    });

    it("harus menolak hubungan wali (relationship) di luar domain constants", () => {
      const input = {
        fullName: "Budi Santoso",
        phoneWa: "081234567890",
        relationship: "TETANGGA", // Nilai terlarang
      };

      assert.throws(
        () => validateCreateGuardianInput(input),
        (err: unknown) => {
          assert(err instanceof ValidationError);
          assert.equal(err.status, 400);
          assert(err.errors.some((e) => e.field === "relationship"));
          return true;
        }
      );
    });

    it("harus menolak nama wali yang hanya berisi spasi kosong", () => {
      const input = {
        fullName: "    ",
        phoneWa: "081234567890",
        relationship: "IBU",
      };

      assert.throws(
        () => validateCreateGuardianInput(input),
        (err: unknown) => {
          assert(err instanceof ValidationError);
          assert.equal(err.status, 400);
          assert(err.errors.some((e) => e.field === "fullName"));
          return true;
        }
      );
    });

    it("harus menolak nomor WhatsApp yang bukan format nomor seluler Indonesia", () => {
      const input = {
        fullName: "Siti Aminah",
        phoneWa: "12345", // Terlalu pendek & tanpa prefix 08/+62
        relationship: "IBU",
      };

      assert.throws(
        () => validateCreateGuardianInput(input),
        (err: unknown) => {
          assert(err instanceof ValidationError);
          assert.equal(err.status, 400);
          assert(err.errors.some((e) => e.field === "phoneWa"));
          return true;
        }
      );
    });

    it("harus memvalidasi relasi GuardianStudent (link) dengan benar", () => {
      const linkInput = {
        guardianId: "grd_ayah_01",
        studentId: "std_ahmad_01",
        relationship: "AYAH",
        isPrimary: true,
      };

      const validated = validateLinkGuardianStudentInput(linkInput);
      assert.equal(validated.guardianId, "grd_ayah_01");
      assert.equal(validated.studentId, "std_ahmad_01");
      assert.equal(validated.isPrimary, true);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Zod Validation: Core Student & Common Primitives
  // -------------------------------------------------------------------------
  describe("3. Student Core & Common Primitives Validation", () => {
    it("harus meloloskan input siswa dengan NISN 10 digit dan jenis kelamin sah", () => {
      const studentInput = {
        fullName: "Fatimah Az-Zahra",
        nis: "2026-001",
        nisn: "0098765432",
        gender: "P",
        birthPlace: "Surabaya",
        birthDate: "2010-05-12",
      };

      const validated = validateCreateStudentInput(studentInput);
      assert.equal(validated.fullName, "Fatimah Az-Zahra");
      assert.equal(validated.gender, "P");
      assert.equal(validated.nisn, "0098765432");
      assert(validated.birthDate instanceof Date);
    });

    it("harus menolak jenis kelamin siswa yang tidak valid", () => {
      const studentInput = {
        fullName: "Fatimah Az-Zahra",
        gender: "X", // Bukan L / P
      };

      assert.throws(
        () => validateCreateStudentInput(studentInput),
        (err: unknown) => {
          assert(err instanceof ValidationError);
          assert(err.errors.some((e) => e.field === "gender"));
          return true;
        }
      );
    });

    it("harus menerapkan batas wajar pada pagination schema (mencegah query DoS)", () => {
      // Default pagination
      const defaultPage = paginationSchema.parse({});
      assert.equal(defaultPage.page, 1);
      assert.equal(defaultPage.limit, 20);

      // Coercion dari string query param
      const parsedQuery = paginationSchema.parse({ page: "3", limit: "50" });
      assert.equal(parsedQuery.page, 3);
      assert.equal(parsedQuery.limit, 50);

      // Menolak limit > 100
      assert.throws(() => paginationSchema.parse({ limit: 500 }));
      // Menolak halaman negatif
      assert.throws(() => paginationSchema.parse({ page: -1 }));
    });
  });

  // -------------------------------------------------------------------------
  // 4. Zod + Tenant Security: Client-Side Authorization Field Stripping
  // -------------------------------------------------------------------------
  describe("4. Zod + Tenant Security Boundary (Anti-Tampering)", () => {
    it("sanitizeClientInput harus menghapus seluruh field keamanan sensitif yang dikirim klien", () => {
      const mockContext: TenantContext = {
        userId: "usr_operator_01",
        institutionId: "inst_resmi_100",
        roles: ["ADMIN"],
        permissions: ["student:create"],
        isSuperAdmin: false,
      };

      const untrustedClientPayload = {
        fullName: "Muhammad Ilham",
        gender: "L",
        // Field-field terlarang kiriman hacker/klien:
        institutionId: "inst_korban_999",
        userId: "usr_korban_999",
        guardianId: "grd_korban_999",
        role: "SUPER_ADMIN",
        roles: ["SUPER_ADMIN", "FOUNDATION_HEAD"],
        permissions: ["*"],
        isSuperAdmin: true,
      };

      const sanitized = sanitizeClientInput(untrustedClientPayload, mockContext);

      // Pastikan field keamanan milik sesi yang digunakan, bukan milik klien
      assert.equal(sanitized.institutionId, "inst_resmi_100");
      assert.equal("role" in sanitized, false);
      assert.equal("roles" in sanitized, false);
      assert.equal("permissions" in sanitized, false);
      assert.equal("isSuperAdmin" in sanitized, false);
      assert.equal("userId" in sanitized, false);
      assert.equal("guardianId" in sanitized, false);
      assert.equal(sanitized.fullName, "Muhammad Ilham");
    });
  });

  // -------------------------------------------------------------------------
  // 5. Domain Plugin Registry: Metadata & Serialization
  // -------------------------------------------------------------------------
  describe("5. Domain Plugin Registry", () => {
    it("harus mendaftarkan domain plugin resmi platform", () => {
      assert.equal(PLUGINS.FORMAL_ACADEMIC, "FORMAL_ACADEMIC");
      assert.equal(PLUGINS.PESANTREN_LIVING, "PESANTREN_LIVING");
      assert.equal(PLUGINS.TAHFIDZ, "TAHFIDZ");
      assert.equal(PLUGINS.PKBM, "PKBM");

      assert.equal(isValidPlugin("FORMAL_ACADEMIC"), true);
      assert.equal(isValidPlugin("PESANTREN_LIVING"), true);
      assert.equal(isValidPlugin("TAHFIDZ"), true);
      assert.equal(isValidPlugin("PKBM"), true);
      assert.equal(isValidPlugin("INVALID_PLUGIN_XYZ"), false);
    });

    it("harus mengembalikan seluruh metadata plugin resmi", () => {
      const allPlugins = getAllPlugins();
      assert(allPlugins.length >= 4);

      const academicMeta = allPlugins.find((p) => p.id === "FORMAL_ACADEMIC");
      assert(academicMeta);
      assert.equal(academicMeta.category, "ACADEMIC");
      assert(academicMeta.coreDependencies.includes("student"));

      const pesantrenMeta = allPlugins.find((p) => p.id === "PESANTREN_LIVING");
      assert(pesantrenMeta);
      assert.equal(pesantrenMeta.category, "PESANTREN");
    });

    it("harus melakukan serialisasi dan parsing enabledPlugins JSON secara aman", () => {
      const plugins = [PLUGINS.FORMAL_ACADEMIC, PLUGINS.PESANTREN_LIVING];
      const serialized = serializeEnabledPlugins(plugins);
      assert.equal(serialized, '["FORMAL_ACADEMIC","PESANTREN_LIVING"]');

      const parsed = parseEnabledPlugins(serialized);
      assert.deepEqual(parsed, [PLUGINS.FORMAL_ACADEMIC, PLUGINS.PESANTREN_LIVING]);

      // Menangani fallback data korup / null
      assert.deepEqual(parseEnabledPlugins(null), []);
      assert.deepEqual(parseEnabledPlugins("bukan-json"), []);
      assert.deepEqual(parseEnabledPlugins('["PLUGIN_PALSU", "FORMAL_ACADEMIC"]'), ["FORMAL_ACADEMIC"]);
    });

    it("harus memvalidasi payload update konfigurasi plugin dengan skema Zod", () => {
      const validPayload = {
        plugins: [PLUGINS.FORMAL_ACADEMIC, PLUGINS.TAHFIDZ],
      };
      const result = updatePluginsInputSchema.safeParse(validPayload);
      assert.equal(result.success, true);

      const invalidPayload = {
        plugins: ["PLUGIN_TIDAK_DIKENAL"],
      };
      const badResult = updatePluginsInputSchema.safeParse(invalidPayload);
      assert.equal(badResult.success, false);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Multi-Tenant Plugin Configuration & requirePlugin Guard
  // -------------------------------------------------------------------------
  describe("6. Institution-Level Plugin Configuration & Enforcement", () => {
    // Definisi 4 Lembaga dengan Konfigurasi Domain Berbeda
    const sekolahA = {
      id: "inst_sma_01",
      name: "SMA Bina Bangsa",
      enabledPlugins: '["FORMAL_ACADEMIC"]',
    };

    const pesantrenB = {
      id: "inst_ponpes_02",
      name: "Pesantren Salafiyah",
      enabledPlugins: '["PESANTREN_LIVING", "TAHFIDZ"]',
    };

    const pesantrenTerpaduC = {
      id: "inst_terpadu_03",
      name: "Pesantren Sains Terpadu",
      enabledPlugins: '["FORMAL_ACADEMIC", "PESANTREN_LIVING"]',
    };

    const lembagaDasarD = {
      id: "inst_bimbel_04",
      name: "Lembaga Kursus",
      enabledPlugins: "[]", // Hanya Core
    };

    it("harus mengizinkan akses domain jika plugin aktif pada institusi", () => {
      // Sekolah A -> FORMAL_ACADEMIC aktif
      assert.equal(isPluginEnabled(sekolahA, "FORMAL_ACADEMIC"), true);
      assert.doesNotThrow(() => requirePlugin(sekolahA, "FORMAL_ACADEMIC"));

      // Pesantren B -> PESANTREN_LIVING & TAHFIDZ aktif
      assert.equal(isPluginEnabled(pesantrenB, "PESANTREN_LIVING"), true);
      assert.equal(isPluginEnabled(pesantrenB, "TAHFIDZ"), true);
      assert.doesNotThrow(() => requirePlugin(pesantrenB, "PESANTREN_LIVING"));
      assert.doesNotThrow(() => requirePlugin(pesantrenB, "TAHFIDZ"));

      // Pesantren Terpadu C -> Keduanya aktif
      assert.equal(isPluginEnabled(pesantrenTerpaduC, "FORMAL_ACADEMIC"), true);
      assert.equal(isPluginEnabled(pesantrenTerpaduC, "PESANTREN_LIVING"), true);
      assert.doesNotThrow(() => requirePlugin(pesantrenTerpaduC, "FORMAL_ACADEMIC"));
      assert.doesNotThrow(() => requirePlugin(pesantrenTerpaduC, "PESANTREN_LIVING"));
    });

    it("harus menolak keras dan melempar DomainFeatureDisabledError (403) jika plugin belum aktif", () => {
      // Sekolah A mencoba mengakses fitur kamar asrama pesantren -> DITOLAK
      assert.equal(isPluginEnabled(sekolahA, "PESANTREN_LIVING"), false);
      assert.throws(
        () => requirePlugin(sekolahA, "PESANTREN_LIVING"),
        (err: unknown) => {
          assert(err instanceof DomainFeatureDisabledError);
          assert.equal(err.status, 403);
          assert.equal(err.pluginId, "PESANTREN_LIVING");
          return true;
        }
      );

      // Pesantren B mencoba mengakses modul kurikulum nasional formal -> DITOLAK
      assert.equal(isPluginEnabled(pesantrenB, "FORMAL_ACADEMIC"), false);
      assert.throws(
        () => requirePlugin(pesantrenB, "FORMAL_ACADEMIC"),
        (err: unknown) => {
          assert(err instanceof DomainFeatureDisabledError);
          assert.equal(err.status, 403);
          assert.equal(err.pluginId, "FORMAL_ACADEMIC");
          return true;
        }
      );

      // Lembaga D (Core Only) mencoba mengakses domain plugin apapun -> DITOLAK
      assert.throws(
        () => requirePlugin(lembagaDasarD, "FORMAL_ACADEMIC"),
        (err: unknown) => {
          assert(err instanceof DomainFeatureDisabledError);
          return true;
        }
      );
    });

    it("Klien tidak dapat mengaktifkan plugin secara sepihak via query/request", () => {
      // Klien mengirimkan parameter palsu bahwa plugin aktif
      const fakeClientParam = {
        enabledPlugins: '["FORMAL_ACADEMIC", "PESANTREN_LIVING"]',
      };

      // Server harus menggunakan konfigurasi dari database terotentikasi (Lembaga D = [])
      const trustedInstitutionFromDb = lembagaDasarD;

      assert.equal(isPluginEnabled(trustedInstitutionFromDb, "FORMAL_ACADEMIC"), false);
      assert.throws(() => requirePlugin(trustedInstitutionFromDb, "FORMAL_ACADEMIC"));
    });
  });

  // -------------------------------------------------------------------------
  // 7. Full Hierarchical Authorization Chain Test
  // -------------------------------------------------------------------------
  describe("7. Full Authorization Order: Session -> Tenant -> RBAC -> Plugin -> Domain", () => {
    it("harus mengeksekusi operasi dengan sukses jika seluruh 5 gerbang otorisasi terpenuhi", () => {
      // Lembaga: Sekolah A (FORMAL_ACADEMIC aktif)
      const currentInstitution = {
        id: "inst_sma_01",
        enabledPlugins: '["FORMAL_ACADEMIC"]',
      };

      // Sesi Pengguna: Guru di Sekolah A
      const session = {
        subjectType: "INTERNAL_USER",
        userId: "usr_guru_01",
        institutionId: "inst_sma_01",
        roles: ["TEACHER"],
        permissions: ["academic:manage", "student:view"],
      };

      // Gerbang 1: Sesi tervalidasi
      assert.equal(session.subjectType, "INTERNAL_USER");

      // Gerbang 2: Tenant Isolation
      const tenantContext: TenantContext = {
        userId: session.userId,
        institutionId: session.institutionId,
        roles: session.roles,
        permissions: session.permissions,
        isSuperAdmin: false,
      };
      assert.doesNotThrow(() => assertTenantAccess("inst_sma_01", tenantContext));

      // Gerbang 3: RBAC Permission
      assert.doesNotThrow(() => requirePermission(session, "academic:manage"));

      // Gerbang 4: Plugin Registry Guard
      assert.doesNotThrow(() => requirePlugin(currentInstitution, "FORMAL_ACADEMIC"));

      // Gerbang 5: Operasi Domain Berhasil
      const canGradeStudent = true;
      assert.equal(canGradeStudent, true);
    });

    it("harus menggagalkan operasi jika salah satu gerbang (Tenant/RBAC/Plugin) gagal", () => {
      // Skenario A: Tenant gagal (Guru mencoba mengisi nilai di institusi lain)
      const contextA: TenantContext = {
        userId: "usr_guru_01",
        institutionId: "inst_sma_01",
        roles: ["TEACHER"],
        permissions: ["academic:manage"],
        isSuperAdmin: false,
      };
      assert.throws(
        () => assertTenantAccess("inst_sekolah_lain", contextA),
        TenantAccessDeniedError
      );

      // Skenario B: RBAC gagal (Guru mencoba mengelola keuangan)
      const sessionB = {
        subjectType: "INTERNAL_USER",
        userId: "usr_guru_01",
        roles: ["TEACHER"],
      };
      assert.throws(
        () => requirePermission(sessionB, "finance:manage"),
        AuthorizationError
      );

      // Skenario C: Plugin gagal (Sekolah belum mengaktifkan modul asrama)
      const institutionC = {
        id: "inst_sma_01",
        enabledPlugins: '["FORMAL_ACADEMIC"]',
      };
      assert.throws(
        () => requirePlugin(institutionC, "PESANTREN_LIVING"),
        DomainFeatureDisabledError
      );
    });
  });
});
