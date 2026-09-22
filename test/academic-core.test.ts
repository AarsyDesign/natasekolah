import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import type { TenantContext } from "../src/lib/tenant/context";
import {
  STUDENT_STATUSES,
  ENROLLMENT_STATUSES,
  DuplicateNisError,
  DuplicateEnrollmentError,
  AcademicYearMismatchError,
  ResourceNotFoundError,
  createStudent,
  updateStudent,
  getStudent,
  listStudents,
  archiveStudent,
  createAcademicYear,
  setActiveAcademicYear,
  listAcademicYears,
  createClassroom,
  listClassrooms,
  getClassroom,
  enrollStudent,
  updateEnrollment,
  getStudentEnrollments,
  getCurrentEnrollment,
} from "../src/lib/academic";
import { ValidationError } from "../src/lib/validation";
import { AuthorizationError } from "../src/lib/auth/permissions";

describe("Phase 1 — Buku Induk & Academic Core Tests", () => {
  const instAId = "inst_pesantren_darul_ulum";
  const instBId = "inst_smpit_al_falah";

  // Contexts
  const adminA: TenantContext = {
    userId: "usr_admin_01",
    institutionId: instAId,
    roles: ["ADMIN"],
    permissions: [
      "student:view",
      "student:create",
      "student:edit",
      "student:archive",
      "academic:view",
      "academic:manage",
      "classroom:view",
      "classroom:manage",
    ],
    isSuperAdmin: false,
  };

  const teacherA: TenantContext = {
    userId: "usr_teacher_01",
    institutionId: instAId,
    roles: ["TEACHER"],
    permissions: [
      "student:view",
      "classroom:view",
      "academic:view",
    ], // Tidak memiliki student:create/archive atau academic:manage
    isSuperAdmin: false,
  };

  const adminB: TenantContext = {
    userId: "usr_admin_02",
    institutionId: instBId,
    roles: ["ADMIN"],
    permissions: [
      "student:view",
      "student:create",
      "student:edit",
      "student:archive",
      "academic:view",
      "academic:manage",
      "classroom:view",
      "classroom:manage",
    ],
    isSuperAdmin: false,
  };

  // In-Memory Mock Database
  let inMemoryStudents: any[] = [];
  let inMemoryAcademicYears: any[] = [];
  let inMemoryClassrooms: any[] = [];
  let inMemoryEnrollments: any[] = [];

  beforeEach(() => {
    inMemoryStudents = [];
    inMemoryAcademicYears = [];
    inMemoryClassrooms = [];
    inMemoryEnrollments = [];

    // Mock Prisma Student
    (prisma.student as any).create = async ({ data }: any) => {
      const record = {
        id: `std_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      inMemoryStudents.push(record);
      return record;
    };

    (prisma.student as any).findUnique = async ({ where }: any) => {
      if (where.id_institutionId) {
        return (
          inMemoryStudents.find(
            (s) =>
              s.id === where.id_institutionId.id &&
              s.institutionId === where.id_institutionId.institutionId
          ) || null
        );
      }
      if (where.institutionId_nis) {
        return (
          inMemoryStudents.find(
            (s) =>
              s.institutionId === where.institutionId_nis.institutionId &&
              s.nis === where.institutionId_nis.nis
          ) || null
        );
      }
      return null;
    };

    (prisma.student as any).update = async ({ where, data }: any) => {
      const idx = inMemoryStudents.findIndex(
        (s) =>
          s.id === where.id_institutionId.id &&
          s.institutionId === where.id_institutionId.institutionId
      );
      if (idx === -1) throw new Error("Student not found");
      inMemoryStudents[idx] = { ...inMemoryStudents[idx], ...data, updatedAt: new Date() };
      return inMemoryStudents[idx];
    };

    (prisma.student as any).findMany = async ({ where }: any) => {
      return inMemoryStudents.filter((s) => {
        if (s.institutionId !== where.institutionId) return false;
        if (where.status && s.status !== where.status) return false;
        if (where.OR) {
          const search = where.OR[0].fullName.contains.toLowerCase();
          const matchName = s.fullName.toLowerCase().includes(search);
          const matchNis = s.nis.toLowerCase().includes(search);
          const matchNisn = s.nisn?.toLowerCase().includes(search);
          return matchName || matchNis || matchNisn;
        }
        return true;
      });
    };

    (prisma.student as any).count = async ({ where }: any) => {
      const list = await (prisma.student as any).findMany({ where });
      return list.length;
    };

    // Mock Prisma AcademicYear
    (prisma.academicYear as any).create = async ({ data }: any) => {
      const record = {
        id: `ay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      inMemoryAcademicYears.push(record);
      return record;
    };

    (prisma.academicYear as any).findUnique = async ({ where }: any) => {
      if (where.id_institutionId) {
        return (
          inMemoryAcademicYears.find(
            (y) =>
              y.id === where.id_institutionId.id &&
              y.institutionId === where.id_institutionId.institutionId
          ) || null
        );
      }
      return null;
    };

    (prisma.academicYear as any).findFirst = async ({ where }: any) => {
      return (
        inMemoryAcademicYears.find(
          (y) =>
            y.institutionId === where.institutionId &&
            (where.isActive === undefined || y.isActive === where.isActive)
        ) || null
      );
    };

    (prisma.academicYear as any).findMany = async ({ where }: any) => {
      return inMemoryAcademicYears.filter((y) => y.institutionId === where.institutionId);
    };

    (prisma.academicYear as any).update = async ({ where, data }: any) => {
      const idx = inMemoryAcademicYears.findIndex(
        (y) =>
          y.id === where.id_institutionId.id &&
          y.institutionId === where.id_institutionId.institutionId
      );
      if (idx === -1) throw new Error("AcademicYear not found");
      inMemoryAcademicYears[idx] = { ...inMemoryAcademicYears[idx], ...data, updatedAt: new Date() };
      return inMemoryAcademicYears[idx];
    };

    (prisma.academicYear as any).updateMany = async ({ where, data }: any) => {
      let count = 0;
      for (let i = 0; i < inMemoryAcademicYears.length; i++) {
        const y = inMemoryAcademicYears[i];
        if (y.institutionId === where.institutionId && (where.isActive === undefined || y.isActive === where.isActive)) {
          inMemoryAcademicYears[i] = { ...y, ...data };
          count++;
        }
      }
      return { count };
    };

    // Mock Prisma Classroom
    (prisma.classroom as any).create = async ({ data }: any) => {
      const record = {
        id: `cls_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      inMemoryClassrooms.push(record);
      return record;
    };

    (prisma.classroom as any).findUnique = async ({ where }: any) => {
      if (where.id_institutionId) {
        return (
          inMemoryClassrooms.find(
            (c) =>
              c.id === where.id_institutionId.id &&
              c.institutionId === where.id_institutionId.institutionId
          ) || null
        );
      }
      return null;
    };

    (prisma.classroom as any).findMany = async ({ where }: any) => {
      return inMemoryClassrooms.filter((c) => {
        if (c.institutionId !== where.institutionId) return false;
        if (where.academicYearId && c.academicYearId !== where.academicYearId) return false;
        return true;
      });
    };

    // Mock Prisma Enrollment
    (prisma.enrollment as any).create = async ({ data }: any) => {
      const record = {
        id: `enr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      inMemoryEnrollments.push(record);
      return record;
    };

    (prisma.enrollment as any).findUnique = async ({ where }: any) => {
      if (where.id_institutionId) {
        return (
          inMemoryEnrollments.find(
            (e) =>
              e.id === where.id_institutionId.id &&
              e.institutionId === where.id_institutionId.institutionId
          ) || null
        );
      }
      if (where.studentId_academicYearId) {
        return (
          inMemoryEnrollments.find(
            (e) =>
              e.studentId === where.studentId_academicYearId.studentId &&
              e.academicYearId === where.studentId_academicYearId.academicYearId
          ) || null
        );
      }
      return null;
    };

    (prisma.enrollment as any).findMany = async ({ where }: any) => {
      return inMemoryEnrollments.filter((e) => {
        if (e.institutionId !== where.institutionId) return false;
        if (where.studentId && e.studentId !== where.studentId) return false;
        return true;
      });
    };

    (prisma.enrollment as any).update = async ({ where, data }: any) => {
      const idx = inMemoryEnrollments.findIndex(
        (e) =>
          e.id === where.id_institutionId.id &&
          e.institutionId === where.id_institutionId.institutionId
      );
      if (idx === -1) throw new Error("Enrollment not found");
      inMemoryEnrollments[idx] = { ...inMemoryEnrollments[idx], ...data, updatedAt: new Date() };
      return inMemoryEnrollments[idx];
    };

    // Mock $transaction
    (prisma as any).$transaction = async (fn: any) => {
      return fn(prisma);
    };
  });

  // -------------------------------------------------------------------------
  // 1. Student Core & Buku Induk Tests
  // -------------------------------------------------------------------------
  describe("1. Student Core & Buku Induk", () => {
    it("harus berhasil mendaftarkan siswa baru dengan data sah dan tenant terinjeksi dari sesi", async () => {
      const student = await createStudent(adminA, {
        fullName: "Ahmad Fatih Santoso",
        nis: "2026001",
        nisn: "0012345678",
        gender: "L",
        birthPlace: "Bandung",
        birthDate: "2012-05-15",
        status: "ACTIVE",
      });

      assert.equal(student.fullName, "Ahmad Fatih Santoso");
      assert.equal(student.nis, "2026001");
      assert.equal(student.institutionId, instAId, "institutionId wajib dari sesi");
      assert.equal(student.status, "ACTIVE");
      // Sacred rule check: Model Student TIDAK boleh memiliki property classroomId langsung!
      assert.equal((student as any).classroomId, undefined, "Student tidak boleh memiliki classroomId");
    });

    it("harus menolak pendaftaran siswa jika format NISN tidak tepat 10 digit", async () => {
      await assert.rejects(
        async () => {
          await createStudent(adminA, {
            fullName: "Zaki Mubarak",
            nis: "2026002",
            nisn: "12345", // Hanya 5 digit
            gender: "L",
          });
        },
        (err: unknown) => {
          assert(err instanceof ValidationError);
          assert(err.errors.some((e) => e.field === "nisn"));
          return true;
        }
      );
    });

    it("harus menolak pendaftaran siswa jika nama kosong atau hanya spasi", async () => {
      await assert.rejects(
        async () => {
          await createStudent(adminA, {
            fullName: "   ",
            nis: "2026003",
            gender: "L",
          });
        },
        (err: unknown) => {
          assert(err instanceof ValidationError);
          return true;
        }
      );
    });

    it("harus menolak duplicate NIS dalam institusi yang sama (DuplicateNisError)", async () => {
      await createStudent(adminA, {
        fullName: "Siswa Pertama",
        nis: "2026999",
        gender: "L",
      });

      await assert.rejects(
        async () => {
          await createStudent(adminA, {
            fullName: "Siswa Kedua",
            nis: "2026999", // Duplikat NIS di instAId
            gender: "P",
          });
        },
        (err: unknown) => {
          assert(err instanceof DuplicateNisError);
          assert.equal(err.status, 409);
          assert.equal(err.code, "DUPLICATE_NIS");
          return true;
        }
      );
    });

    it("harus mengizinkan NIS yang sama pada institusi yang berbeda (Tenant Isolated NIS)", async () => {
      const studentA = await createStudent(adminA, {
        fullName: "Santri Lembaga A",
        nis: "NIS-100",
        gender: "L",
      });

      const studentB = await createStudent(adminB, {
        fullName: "Siswa Lembaga B",
        nis: "NIS-100", // NIS sama, namun di instBId
        gender: "P",
      });

      assert.equal(studentA.nis, "NIS-100");
      assert.equal(studentB.nis, "NIS-100");
      assert.equal(studentA.institutionId, instAId);
      assert.equal(studentB.institutionId, instBId);
    });

    it("harus menolak manipulasi institutionId dari payload klien (Anti-Tampering)", async () => {
      const student = await createStudent(adminA, {
        fullName: "Santri Injeksi",
        nis: "2026777",
        gender: "L",
        institutionId: instBId, // Serangan spoofing tenant
      });

      // Nilai institutionId palsu wajib ditimpa oleh instAId dari sesi adminA
      assert.equal(student.institutionId, instAId);
    });

    it("harus menolak pembuatan siswa oleh peran tanpa izin student:create (RBAC)", async () => {
      await assert.rejects(
        async () => {
          await createStudent(teacherA, {
            fullName: "Siswa Guru",
            nis: "2026555",
            gender: "L",
          });
        },
        (err: unknown) => {
          assert(err instanceof AuthorizationError);
          assert.equal(err.status, 403);
          return true;
        }
      );
    });

    it("harus menolak akses melihat siswa dari lembaga lain (Tenant Isolation)", async () => {
      const studentB = await createStudent(adminB, {
        fullName: "Siswa Rahasia Lembaga B",
        nis: "2026888",
        gender: "L",
      });

      // Admin A mencoba mengambil data siswa milik Lembaga B
      await assert.rejects(
        async () => {
          await getStudent(adminA, studentB.id);
        },
        (err: unknown) => {
          assert(err instanceof ResourceNotFoundError);
          assert.equal(err.status, 404);
          return true;
        }
      );
    });

    it("harus berhasil memperbarui biodata siswa dan menolak tabrakan NIS baru", async () => {
      const student1 = await createStudent(adminA, {
        fullName: "Santri Lama",
        nis: "2026010",
        gender: "L",
      });

      const student2 = await createStudent(adminA, {
        fullName: "Santri Baru",
        nis: "2026011",
        gender: "L",
      });

      // Update sukses
      const updated = await updateStudent(adminA, student1.id, {
        nickname: "Fatih",
        address: "Jl. Pesantren No. 1",
      });
      assert.equal(updated.nickname, "Fatih");

      // Update gagal karena mengubah NIS menjadi NIS milik student2
      await assert.rejects(
        async () => {
          await updateStudent(adminA, student1.id, {
            nis: "2026011",
          });
        },
        (err: unknown) => {
          assert(err instanceof DuplicateNisError);
          return true;
        }
      );
    });

    it("harus mengarsipkan siswa (soft archive status) tanpa menghapus data historis", async () => {
      const student = await createStudent(adminA, {
        fullName: "Santri Lulus",
        nis: "2026012",
        gender: "L",
      });

      const archived = await archiveStudent(adminA, student.id, {
        status: "GRADUATED",
      });

      assert.equal(archived.status, "GRADUATED");
      assert.equal(archived.id, student.id);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Academic Year Domain Tests
  // -------------------------------------------------------------------------
  describe("2. Academic Year Domain", () => {
    it("harus membuat tahun ajaran baru dengan format nama yang sah", async () => {
      const year = await createAcademicYear(adminA, {
        name: "2025/2026",
        startDate: "2025-07-15",
        endDate: "2026-06-20",
        isActive: false,
      });

      assert.equal(year.name, "2025/2026");
      assert.equal(year.institutionId, instAId);
      assert.equal(year.isActive, false);
    });

    it("harus menegakkan invariant: hanya 1 tahun ajaran aktif per institusi", async () => {
      const year1 = await createAcademicYear(adminA, {
        name: "2025/2026",
        isActive: true,
      });
      assert.equal(year1.isActive, true);

      // Buat tahun kedua dengan isActive: true
      const year2 = await createAcademicYear(adminA, {
        name: "2026/2027",
        isActive: true,
      });
      assert.equal(year2.isActive, true);

      // Pastikan year1 otomatis dinonaktifkan
      const recheckedYear1 = await (prisma.academicYear as any).findUnique({
        where: { id_institutionId: { id: year1.id, institutionId: instAId } },
      });
      assert.equal(recheckedYear1.isActive, false, "Tahun ajaran lama harus dinonaktifkan");
    });

    it("harus mengizinkan pengaktifan tahun ajaran melalui setActiveAcademicYear", async () => {
      const year1 = await createAcademicYear(adminA, { name: "2025/2026", isActive: true });
      const year2 = await createAcademicYear(adminA, { name: "2026/2027", isActive: false });

      const activatedYear2 = await setActiveAcademicYear(adminA, year2.id);
      assert.equal(activatedYear2.isActive, true);

      const recheckedYear1 = await (prisma.academicYear as any).findUnique({
        where: { id_institutionId: { id: year1.id, institutionId: instAId } },
      });
      assert.equal(recheckedYear1.isActive, false);
    });

    it("harus menolak pengaktifan tahun ajaran milik lembaga lain", async () => {
      const yearB = await createAcademicYear(adminB, { name: "2026/2027", isActive: false });

      // Admin A mencoba mengaktifkan tahun ajaran milik Lembaga B
      await assert.rejects(
        async () => {
          await setActiveAcademicYear(adminA, yearB.id);
        },
        (err: unknown) => {
          assert(err instanceof ResourceNotFoundError);
          return true;
        }
      );
    });
  });

  // -------------------------------------------------------------------------
  // 3. Classroom Domain Tests
  // -------------------------------------------------------------------------
  describe("3. Classroom Domain", () => {
    it("harus membuat rombel yang terikat pada institusi dan tahun ajaran sah", async () => {
      const year = await createAcademicYear(adminA, { name: "2026/2027" });

      const classroom = await createClassroom(adminA, {
        name: "VII A",
        gradeLevel: "7",
        capacity: 32,
        academicYearId: year.id,
      });

      assert.equal(classroom.name, "VII A");
      assert.equal(classroom.gradeLevel, "7");
      assert.equal(classroom.capacity, 32);
      assert.equal(classroom.academicYearId, year.id);
      assert.equal(classroom.institutionId, instAId);
    });

    it("harus menolak pembuatan rombel jika academicYearId milik lembaga lain", async () => {
      const yearB = await createAcademicYear(adminB, { name: "2026/2027" });

      // Admin A mencoba membuat kelas dengan mengaitkan ke tahun ajaran milik Lembaga B
      await assert.rejects(
        async () => {
          await createClassroom(adminA, {
            name: "Kelas Bajakan",
            academicYearId: yearB.id,
          });
        },
        (err: unknown) => {
          assert(err instanceof ResourceNotFoundError);
          return true;
        }
      );
    });
  });

  // -------------------------------------------------------------------------
  // 4. Enrollment & Sacred History Engine Tests
  // -------------------------------------------------------------------------
  describe("4. Enrollment Engine & Sacred History", () => {
    it("harus berhasil menempatkan siswa ke rombel dan tahun ajaran sah", async () => {
      const year = await createAcademicYear(adminA, { name: "2026/2027", isActive: true });
      const room = await createClassroom(adminA, { name: "VII A", academicYearId: year.id });
      const student = await createStudent(adminA, { fullName: "Santri Baru", nis: "2026101", gender: "L" });

      const enrollment = await enrollStudent(adminA, {
        studentId: student.id,
        academicYearId: year.id,
        classroomId: room.id,
        status: "ENROLLED",
      });

      assert.equal(enrollment.studentId, student.id);
      assert.equal(enrollment.classroomId, room.id);
      assert.equal(enrollment.academicYearId, year.id);
      assert.equal(enrollment.institutionId, instAId);
      assert.equal(enrollment.status, "ENROLLED");
    });

    it("harus menolak duplikasi enrollment: satu siswa tidak boleh punya 2 rombel di tahun ajaran yang sama", async () => {
      const year = await createAcademicYear(adminA, { name: "2026/2027" });
      const roomA = await createClassroom(adminA, { name: "VII A", academicYearId: year.id });
      const roomB = await createClassroom(adminA, { name: "VII B", academicYearId: year.id });
      const student = await createStudent(adminA, { fullName: "Santri Gandar", nis: "2026102", gender: "L" });

      await enrollStudent(adminA, {
        studentId: student.id,
        academicYearId: year.id,
        classroomId: roomA.id,
      });

      // Coba daftarkan lagi ke rombel VII B di tahun ajaran yang sama
      await assert.rejects(
        async () => {
          await enrollStudent(adminA, {
            studentId: student.id,
            academicYearId: year.id,
            classroomId: roomB.id,
          });
        },
        (err: unknown) => {
          assert(err instanceof DuplicateEnrollmentError);
          assert.equal(err.status, 409);
          assert.equal(err.code, "DUPLICATE_ENROLLMENT");
          return true;
        }
      );
    });

    it("harus menolak enrollment jika classroom dan target academic year tidak cocok (Mismatch Error)", async () => {
      const year2025 = await createAcademicYear(adminA, { name: "2025/2026" });
      const year2026 = await createAcademicYear(adminA, { name: "2026/2027" });

      // Rombel terdaftar di tahun 2025
      const room2025 = await createClassroom(adminA, { name: "VII A (2025)", academicYearId: year2025.id });
      const student = await createStudent(adminA, { fullName: "Santri Mismatch", nis: "2026103", gender: "L" });

      // Coba enroll ke tahun 2026 menggunakan kelas tahun 2025
      await assert.rejects(
        async () => {
          await enrollStudent(adminA, {
            studentId: student.id,
            academicYearId: year2026.id, // Mismatch dengan room2025.academicYearId
            classroomId: room2025.id,
          });
        },
        (err: unknown) => {
          assert(err instanceof AcademicYearMismatchError);
          assert.equal(err.status, 400);
          assert.equal(err.code, "ACADEMIC_YEAR_MISMATCH");
          return true;
        }
      );
    });

    it("harus menolak cross-tenant enrollment (Siswa dari Lembaga B di-enroll di Lembaga A)", async () => {
      const yearA = await createAcademicYear(adminA, { name: "2026/2027" });
      const roomA = await createClassroom(adminA, { name: "VII A", academicYearId: yearA.id });
      const studentB = await createStudent(adminB, { fullName: "Siswa Sekolah B", nis: "2026B01", gender: "L" });

      // Admin A mencoba menempatkan siswa milik Sekolah B ke rombel Sekolah A
      await assert.rejects(
        async () => {
          await enrollStudent(adminA, {
            studentId: studentB.id,
            academicYearId: yearA.id,
            classroomId: roomA.id,
          });
        },
        (err: unknown) => {
          assert(err instanceof ResourceNotFoundError);
          assert.match(err.message, /Siswa/);
          return true;
        }
      );
    });

    it("harus mempertahankan riwayat penempatan kelas (Sacred History) saat siswa naik kelas tiap tahun", async () => {
      const year1 = await createAcademicYear(adminA, { name: "2024/2025", isActive: false });
      const year2 = await createAcademicYear(adminA, { name: "2025/2026", isActive: false });
      const year3 = await createAcademicYear(adminA, { name: "2026/2027", isActive: true });

      const room7A = await createClassroom(adminA, { name: "VII A", academicYearId: year1.id });
      const room8B = await createClassroom(adminA, { name: "VIII B", academicYearId: year2.id });
      const room9A = await createClassroom(adminA, { name: "IX A", academicYearId: year3.id });

      const student = await createStudent(adminA, { fullName: "Muhammad Fatih", nis: "2024001", gender: "L" });

      // Tahun 1: Kelas 7A
      await enrollStudent(adminA, {
        studentId: student.id,
        academicYearId: year1.id,
        classroomId: room7A.id,
        status: "PROMOTED",
      });

      // Tahun 2: Naik ke Kelas 8B
      await enrollStudent(adminA, {
        studentId: student.id,
        academicYearId: year2.id,
        classroomId: room8B.id,
        status: "PROMOTED",
      });

      // Tahun 3: Naik ke Kelas 9A
      await enrollStudent(adminA, {
        studentId: student.id,
        academicYearId: year3.id,
        classroomId: room9A.id,
        status: "ENROLLED",
      });

      // Ambil seluruh histori enrollment siswa
      const history = await getStudentEnrollments(adminA, student.id);
      assert.equal(history.length, 3, "Harus terdapat 3 rekam jejak enrollment utuh");

      const enrolledRooms = history.map((h) => h.classroomId);
      assert(enrolledRooms.includes(room7A.id), "Histori Kelas 7A tidak boleh hilang");
      assert(enrolledRooms.includes(room8B.id), "Histori Kelas 8B tidak boleh hilang");
      assert(enrolledRooms.includes(room9A.id), "Histori Kelas 9A tersimpan");

      // Current enrollment pada tahun aktif harus merujuk ke Kelas 9A
      const current = await getCurrentEnrollment(adminA, student.id);
      assert(current !== null);
      assert.equal(current.classroomId, room9A.id);
      assert.equal(current.academicYearId, year3.id);
    });
  });
});
