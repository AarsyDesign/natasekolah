import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import type { TenantContext } from "../src/lib/tenant/context";
import {
  createSubject,
  updateSubject,
  getSubject,
  listSubjects,
  listTeachers,
  getTeacher,
  createTeacherAssignment,
  updateTeacherAssignment,
  deleteTeacherAssignment,
  listTeacherAssignments,
  getTeacherAssignments,
  DuplicateSubjectCodeError,
  DuplicateAssignmentError,
  TeacherAssignmentAccessDeniedError,
  InvalidTeacherRoleError,
} from "../src/lib/teaching";
import { ResourceNotFoundError, AcademicYearMismatchError } from "../src/lib/academic";
import { ValidationError } from "../src/lib/validation";
import { AuthorizationError } from "../src/lib/auth/permissions";

describe("Phase 2 — Subject, Teacher & Teaching Assignment Core Tests", () => {
  const instAId = "inst_pesantren_al_hikmah";
  const instBId = "inst_smpit_nurul_iman";

  // Contexts
  const adminA: TenantContext = {
    userId: "usr_admin_a",
    institutionId: instAId,
    roles: ["ADMIN"],
    permissions: ["academic:view", "academic:manage", "staff:view"],
    isSuperAdmin: false,
  };

  const teacherA1: TenantContext = {
    userId: "usr_teacher_a1",
    institutionId: instAId,
    roles: ["TEACHER"],
    permissions: ["academic:view"], // Not academic:manage
    isSuperAdmin: false,
  };

  const teacherA2: TenantContext = {
    userId: "usr_teacher_a2",
    institutionId: instAId,
    roles: ["TEACHER"],
    permissions: ["academic:view"],
    isSuperAdmin: false,
  };

  const adminB: TenantContext = {
    userId: "usr_admin_b",
    institutionId: instBId,
    roles: ["ADMIN"],
    permissions: ["academic:view", "academic:manage", "staff:view"],
    isSuperAdmin: false,
  };

  // In-Memory Tables
  let inMemorySubjects: any[] = [];
  let inMemoryUsers: any[] = [];
  let inMemoryAcademicYears: any[] = [];
  let inMemoryClassrooms: any[] = [];
  let inMemoryAssignments: any[] = [];

  beforeEach(() => {
    inMemorySubjects = [];
    inMemoryUsers = [
      {
        id: "usr_teacher_a1",
        institutionId: instAId,
        name: "Ust. Ahmad Fauzi",
        email: "ahmad.fauzi@alhikmah.sch.id",
        phoneWa: "081234567890",
        roles: JSON.stringify(["TEACHER"]),
        isActive: true,
        passwordHash: "secret_hash_a1",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "usr_teacher_a2",
        institutionId: instAId,
        name: "Ustzh. Siti Aminah",
        email: "siti.aminah@alhikmah.sch.id",
        phoneWa: "081234567891",
        roles: JSON.stringify(["TEACHER"]),
        isActive: true,
        passwordHash: "secret_hash_a2",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "usr_admin_a",
        institutionId: instAId,
        name: "Admin Al-Hikmah",
        email: "admin@alhikmah.sch.id",
        phoneWa: null,
        roles: JSON.stringify(["ADMIN"]),
        isActive: true,
        passwordHash: "secret_hash_admin",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "usr_teacher_b1",
        institutionId: instBId,
        name: "Ust. Zulkifli",
        email: "zulkifli@nuruliman.sch.id",
        phoneWa: "081234567892",
        roles: JSON.stringify(["TEACHER"]),
        isActive: true,
        passwordHash: "secret_hash_b1",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    inMemoryAcademicYears = [
      {
        id: "ay_2025_a",
        institutionId: instAId,
        name: "2025/2026 Ganjil",
        code: "2025-1",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "ay_2026_a",
        institutionId: instAId,
        name: "2026/2027 Ganjil",
        code: "2026-1",
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "ay_2025_b",
        institutionId: instBId,
        name: "2025/2026 Ganjil B",
        code: "2025-1-B",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    inMemoryClassrooms = [
      {
        id: "cls_7a",
        institutionId: instAId,
        academicYearId: "ay_2025_a",
        name: "VII A",
        gradeLevel: "7",
        capacity: 30,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "cls_7b",
        institutionId: instAId,
        academicYearId: "ay_2025_a",
        name: "VII B",
        gradeLevel: "7",
        capacity: 30,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "cls_8a_future",
        institutionId: instAId,
        academicYearId: "ay_2026_a", // belongs to 2026
        name: "VIII A",
        gradeLevel: "8",
        capacity: 30,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "cls_7b_inst_b",
        institutionId: instBId,
        academicYearId: "ay_2025_b",
        name: "VII B (Inst B)",
        gradeLevel: "7",
        capacity: 30,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    inMemoryAssignments = [];

    // Mock Prisma Subject
    (prisma.subject as any).findFirst = async ({ where }: any) => {
      return (
        inMemorySubjects.find((s) => {
          for (const key of Object.keys(where)) {
            if (s[key] !== where[key]) return false;
          }
          return true;
        }) || null
      );
    };

    (prisma.subject as any).create = async ({ data }: any) => {
      const record = {
        id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      inMemorySubjects.push(record);
      return record;
    };

    (prisma.subject as any).findUnique = async ({ where }: any) => {
      if (where?.id_institutionId) {
        return (
          inMemorySubjects.find(
            (s) =>
              s.id === where.id_institutionId.id &&
              s.institutionId === where.id_institutionId.institutionId
          ) || null
        );
      }
      if (where?.institutionId_code) {
        return (
          inMemorySubjects.find(
            (s) =>
              s.institutionId === where.institutionId_code.institutionId &&
              s.code === where.institutionId_code.code
          ) || null
        );
      }
      return inMemorySubjects.find((s) => s.id === where.id) || null;
    };

    (prisma.subject as any).update = async ({ where, data }: any) => {
      const targetId = where?.id_institutionId ? where.id_institutionId.id : where?.id;
      const idx = inMemorySubjects.findIndex((s) => s.id === targetId);
      if (idx === -1) throw new Error("Subject not found");
      inMemorySubjects[idx] = { ...inMemorySubjects[idx], ...data, updatedAt: new Date() };
      return inMemorySubjects[idx];
    };

    (prisma.subject as any).findMany = async ({ where, skip = 0, take = 50 }: any) => {
      let result = inMemorySubjects.filter((s) => s.institutionId === where?.institutionId);
      if (where?.isActive !== undefined) {
        result = result.filter((s) => s.isActive === where.isActive);
      }
      if (where?.category) {
        result = result.filter((s) => s.category === where.category);
      }
      if (where?.OR) {
        result = result.filter((s) => {
          return where.OR.some((clause: any) => {
            if (clause.name?.contains) {
              return s.name.toLowerCase().includes(clause.name.contains.toLowerCase());
            }
            if (clause.code?.contains) {
              return s.code?.toLowerCase().includes(clause.code.contains.toLowerCase());
            }
            return false;
          });
        });
      }
      return result.slice(skip, skip + take);
    };

    (prisma.subject as any).count = async ({ where }: any) => {
      let result = inMemorySubjects.filter((s) => s.institutionId === where?.institutionId);
      if (where?.isActive !== undefined) {
        result = result.filter((s) => s.isActive === where.isActive);
      }
      if (where?.category) {
        result = result.filter((s) => s.category === where.category);
      }
      if (where?.OR) {
        result = result.filter((s) => {
          return where.OR.some((clause: any) => {
            if (clause.name?.contains) {
              return s.name.toLowerCase().includes(clause.name.contains.toLowerCase());
            }
            if (clause.code?.contains) {
              return s.code?.toLowerCase().includes(clause.code.contains.toLowerCase());
            }
            return false;
          });
        });
      }
      return result.length;
    };

    // Mock Prisma User
    (prisma.user as any).findUnique = async ({ where, select, include }: any) => {
      let found: any = null;
      if (where?.id_institutionId) {
        found = inMemoryUsers.find(
          (u) =>
            u.id === where.id_institutionId.id &&
            u.institutionId === where.id_institutionId.institutionId
        );
      } else if (where?.id) {
        found = inMemoryUsers.find((u) => u.id === where.id);
      }
      if (!found) return null;

      const copy = { ...found };
      if (include?.teacherAssignments) {
        copy.teacherAssignments = inMemoryAssignments
          .filter((a) => a.teacherId === found.id)
          .map((a) => attachRelations(a, include.teacherAssignments.include));
      }
      if (include?._count?.select?.teacherAssignments) {
        copy._count = {
          teacherAssignments: inMemoryAssignments.filter((a) => a.teacherId === found.id).length,
        };
      }
      return copy;
    };

    (prisma.user as any).findMany = async ({ where, include, select }: any) => {
      let result = inMemoryUsers.filter((u) => u.institutionId === where?.institutionId);
      if (where?.isActive !== undefined) {
        result = result.filter((u) => u.isActive === where.isActive);
      }
      return result.map((u) => {
        const copy = { ...u };
        if (include?._count?.select?.teacherAssignments) {
          copy._count = {
            teacherAssignments: inMemoryAssignments.filter((a) => a.teacherId === u.id).length,
          };
        }
        return copy;
      });
    };

    (prisma.user as any).findFirst = async ({ where, select, include }: any) => {
      const found = inMemoryUsers.find((u) => {
        for (const key of Object.keys(where)) {
          if (u[key] !== where[key]) return false;
        }
        return true;
      });
      if (!found) return null;
      const copy = { ...found };
      if (include?.teacherAssignments) {
        copy.teacherAssignments = inMemoryAssignments
          .filter((a) => a.teacherId === found.id)
          .map((a) => attachRelations(a, include.teacherAssignments.include));
      }
      return copy;
    };

    // Mock Prisma AcademicYear
    (prisma.academicYear as any).findUnique = async ({ where }: any) => {
      if (where?.id_institutionId) {
        return (
          inMemoryAcademicYears.find(
            (ay) =>
              ay.id === where.id_institutionId.id &&
              ay.institutionId === where.id_institutionId.institutionId
          ) || null
        );
      }
      return inMemoryAcademicYears.find((ay) => ay.id === where.id) || null;
    };

    (prisma.academicYear as any).findFirst = async ({ where }: any) => {
      return (
        inMemoryAcademicYears.find((ay) => {
          for (const key of Object.keys(where)) {
            if (ay[key] !== where[key]) return false;
          }
          return true;
        }) || null
      );
    };

    // Mock Prisma Classroom
    (prisma.classroom as any).findUnique = async ({ where }: any) => {
      if (where?.id_institutionId) {
        return (
          inMemoryClassrooms.find(
            (c) =>
              c.id === where.id_institutionId.id &&
              c.institutionId === where.id_institutionId.institutionId
          ) || null
        );
      }
      if (where?.id_academicYearId_institutionId) {
        return (
          inMemoryClassrooms.find(
            (c) =>
              c.id === where.id_academicYearId_institutionId.id &&
              c.academicYearId === where.id_academicYearId_institutionId.academicYearId &&
              c.institutionId === where.id_academicYearId_institutionId.institutionId
          ) || null
        );
      }
      return inMemoryClassrooms.find((c) => c.id === where.id) || null;
    };

    (prisma.classroom as any).findFirst = async ({ where }: any) => {
      return (
        inMemoryClassrooms.find((c) => {
          for (const key of Object.keys(where)) {
            if (c[key] !== where[key]) return false;
          }
          return true;
        }) || null
      );
    };

    // Mock Prisma TeacherAssignment
    (prisma.teacherAssignment as any).findFirst = async ({ where }: any) => {
      return (
        inMemoryAssignments.find((a) => {
          for (const key of Object.keys(where)) {
            if (a[key] !== where[key]) return false;
          }
          return true;
        }) || null
      );
    };

    (prisma.teacherAssignment as any).create = async ({ data, include }: any) => {
      const record = {
        id: `asg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      inMemoryAssignments.push(record);
      return attachRelations(record, include);
    };

    (prisma.teacherAssignment as any).findUnique = async ({ where, include }: any) => {
      if (where?.teacherId_subjectId_classroomId_academicYearId) {
        const cond = where.teacherId_subjectId_classroomId_academicYearId;
        const found = inMemoryAssignments.find(
          (a) =>
            a.teacherId === cond.teacherId &&
            a.subjectId === cond.subjectId &&
            a.classroomId === cond.classroomId &&
            a.academicYearId === cond.academicYearId
        );
        return found ? attachRelations(found, include) : null;
      }
      const targetId = where?.id_institutionId ? where.id_institutionId.id : where?.id;
      const targetInst = where?.id_institutionId ? where.id_institutionId.institutionId : null;
      const found = inMemoryAssignments.find(
        (a) => a.id === targetId && (!targetInst || a.institutionId === targetInst)
      );
      if (!found) return null;
      return attachRelations(found, include);
    };

    (prisma.teacherAssignment as any).update = async ({ where, data, include }: any) => {
      const targetId = where?.id_institutionId ? where.id_institutionId.id : where?.id;
      const idx = inMemoryAssignments.findIndex((a) => a.id === targetId);
      if (idx === -1) throw new Error("Assignment not found");
      inMemoryAssignments[idx] = { ...inMemoryAssignments[idx], ...data, updatedAt: new Date() };
      return attachRelations(inMemoryAssignments[idx], include);
    };

    (prisma.teacherAssignment as any).delete = async ({ where }: any) => {
      const targetId = where?.id_institutionId ? where.id_institutionId.id : where?.id;
      const idx = inMemoryAssignments.findIndex((a) => a.id === targetId);
      if (idx === -1) throw new Error("Assignment not found");
      const deleted = inMemoryAssignments.splice(idx, 1)[0];
      return deleted;
    };

    (prisma.teacherAssignment as any).findMany = async ({ where, skip = 0, take = 50, include }: any) => {
      let result = inMemoryAssignments.filter((a) => a.institutionId === where?.institutionId);
      if (where?.academicYearId) {
        result = result.filter((a) => a.academicYearId === where.academicYearId);
      }
      if (where?.teacherId) {
        result = result.filter((a) => a.teacherId === where.teacherId);
      }
      if (where?.subjectId) {
        result = result.filter((a) => a.subjectId === where.subjectId);
      }
      if (where?.classroomId) {
        result = result.filter((a) => a.classroomId === where.classroomId);
      }
      return result.slice(skip, skip + take).map((a) => attachRelations(a, include));
    };

    (prisma.teacherAssignment as any).count = async ({ where }: any) => {
      let result = inMemoryAssignments.filter((a) => a.institutionId === where?.institutionId);
      if (where?.academicYearId) {
        result = result.filter((a) => a.academicYearId === where.academicYearId);
      }
      if (where?.teacherId) {
        result = result.filter((a) => a.teacherId === where.teacherId);
      }
      if (where?.subjectId) {
        result = result.filter((a) => a.subjectId === where.subjectId);
      }
      if (where?.classroomId) {
        result = result.filter((a) => a.classroomId === where.classroomId);
      }
      return result.length;
    };

    function attachRelations(assignment: any, include?: any) {
      const copy = { ...assignment };
      if (include?.teacher) {
        const teacher = inMemoryUsers.find((u) => u.id === copy.teacherId);
        copy.teacher = teacher
          ? { id: teacher.id, name: teacher.name, email: teacher.email, role: teacher.role, status: teacher.status }
          : null;
      }
      if (include?.subject) {
        const sub = inMemorySubjects.find((s) => s.id === copy.subjectId);
        copy.subject = sub ? { id: sub.id, name: sub.name, code: sub.code, category: sub.category } : null;
      }
      if (include?.classroom) {
        const cls = inMemoryClassrooms.find((c) => c.id === copy.classroomId);
        copy.classroom = cls ? { id: cls.id, name: cls.name, gradeLevel: cls.gradeLevel } : null;
      }
      if (include?.academicYear) {
        const ay = inMemoryAcademicYears.find((y) => y.id === copy.academicYearId);
        copy.academicYear = ay ? { id: ay.id, name: ay.name, isActive: ay.isActive } : null;
      }
      return copy;
    }
  });

  // =========================================================================
  // 1. SUBJECT TESTS
  // =========================================================================
  describe("1. Subject Management", () => {
    it("should successfully create a valid subject with code, shortName, and category", async () => {
      const subject = await createSubject(adminA, {
        name: "Matematika Dasar",
        code: "MTK",
        shortName: "MTK",
        category: "UMUM",
        isActive: true,
      });

      assert.ok(subject.id);
      assert.equal(subject.name, "Matematika Dasar");
      assert.equal(subject.code, "MTK");
      assert.equal(subject.category, "UMUM");
      assert.equal(subject.institutionId, instAId);
      assert.equal(subject.isActive, true);
    });

    it("should allow creating a subject without code (optional code)", async () => {
      const subject = await createSubject(adminA, {
        name: "Tahsin & Tajwid",
        category: "AGAMA",
      });

      assert.ok(subject.id);
      assert.equal(subject.name, "Tahsin & Tajwid");
      assert.equal(subject.code, null);
      assert.equal(subject.category, "AGAMA");
    });

    it("should reject invalid subject inputs with ValidationError", async () => {
      // Empty name
      await assert.rejects(
        async () => {
          await createSubject(adminA, { name: "" });
        },
        (err) => err instanceof ValidationError
      );

      // Invalid category
      await assert.rejects(
        async () => {
          await createSubject(adminA, { name: "Biologi", category: "INVALID_CAT" });
        },
        (err) => err instanceof ValidationError
      );
    });

    it("should reject duplicate subject code within the same tenant", async () => {
      await createSubject(adminA, {
        name: "Bahasa Indonesia",
        code: "BIND",
      });

      await assert.rejects(
        async () => {
          await createSubject(adminA, {
            name: "Bahasa Indonesia Tingkat Lanjut",
            code: "BIND",
          });
        },
        (err) => err instanceof DuplicateSubjectCodeError
      );
    });

    it("should allow identical subject code in a different tenant (tenant-scoped uniqueness)", async () => {
      const subA = await createSubject(adminA, {
        name: "Pendidikan Agama Islam",
        code: "PAI",
      });

      const subB = await createSubject(adminB, {
        name: "Pendidikan Agama Islam",
        code: "PAI",
      });

      assert.ok(subA.id);
      assert.ok(subB.id);
      assert.equal(subA.code, "PAI");
      assert.equal(subB.code, "PAI");
      assert.equal(subA.institutionId, instAId);
      assert.equal(subB.institutionId, instBId);
    });

    it("should update subject details and toggle active state", async () => {
      const created = await createSubject(adminA, {
        name: "Fisika Modern",
        code: "FIS",
        isActive: true,
      });

      const updated = await updateSubject(adminA, created.id, {
        name: "Fisika Terapan",
        isActive: false,
      });

      assert.equal(updated.name, "Fisika Terapan");
      assert.equal(updated.isActive, false);
      assert.equal(updated.code, "FIS");
    });

    it("should enforce tenant isolation when fetching a subject", async () => {
      const subA = await createSubject(adminA, {
        name: "Kimia Dasar",
        code: "KIM",
      });

      // Tenant B admin tries to access Tenant A subject
      await assert.rejects(
        async () => {
          await getSubject(adminB, subA.id);
        },
        (err) => err instanceof ResourceNotFoundError
      );
    });

    it("should filter subjects by search and active state", async () => {
      await createSubject(adminA, { name: "Biologi Sel", code: "BIO-1", isActive: true });
      await createSubject(adminA, { name: "Biologi Lingkungan", code: "BIO-2", isActive: false });
      await createSubject(adminA, { name: "Sejarah Kebudayaan Islam", code: "SKI", isActive: true });

      const searchBio = await listSubjects(adminA, { search: "Biologi" });
      assert.equal(searchBio.total, 2);

      const activeOnly = await listSubjects(adminA, { isActive: true });
      assert.equal(activeOnly.total, 2);

      const inactiveOnly = await listSubjects(adminA, { isActive: false });
      assert.equal(inactiveOnly.total, 1);
    });

    it("should reject subject modification by unauthorized role (TEACHER without academic:manage)", async () => {
      await assert.rejects(
        async () => {
          await createSubject(teacherA1, { name: "Sosiologi" });
        },
        (err) => err instanceof AuthorizationError
      );
    });
  });

  // =========================================================================
  // 2. TEACHER TESTS
  // =========================================================================
  describe("2. Teacher Management & Directory", () => {
    it("should list only users with role TEACHER and preserve safe fields", async () => {
      const teachers = await listTeachers(adminA);

      // In instA, we have 2 teachers and 1 admin
      assert.equal(teachers.length, 2);
      assert.ok(teachers.every((t) => t.roles.includes("TEACHER")));

      // Verify passwordHash is NOT exposed
      for (const t of teachers) {
        assert.equal((t as any).passwordHash, undefined);
      }
    });

    it("should enforce tenant isolation when listing teachers", async () => {
      const teachersA = await listTeachers(adminA);
      const teachersB = await listTeachers(adminB);

      assert.equal(teachersA.length, 2);
      assert.equal(teachersB.length, 1);
      assert.equal(teachersB[0].name, "Ust. Zulkifli");

      // Verify no cross-tenant leakage
      assert.ok(!teachersA.some((t) => t.id === "usr_teacher_b1"));
    });

    it("should fetch a specific teacher by ID within tenant", async () => {
      const teacher = await getTeacher(adminA, "usr_teacher_a1");
      assert.ok(teacher);
      assert.equal(teacher.name, "Ust. Ahmad Fauzi");
      assert.ok(teacher.roles.includes("TEACHER"));
    });

    it("should reject getting a teacher from another tenant", async () => {
      await assert.rejects(
        async () => {
          await getTeacher(adminA, "usr_teacher_b1");
        },
        (err) => err instanceof ResourceNotFoundError
      );
    });
  });

  // =========================================================================
  // 3. TEACHER ASSIGNMENT TESTS
  // =========================================================================
  describe("3. Teacher Assignment Core & Invariants", () => {
    let subjectMTK: any;
    let subjectIPA: any;
    let subjectInstB: any;

    beforeEach(async () => {
      subjectMTK = await createSubject(adminA, { name: "Matematika", code: "MTK" });
      subjectIPA = await createSubject(adminA, { name: "IPA Terpadu", code: "IPA" });
      subjectInstB = await createSubject(adminB, { name: "Matematika B", code: "MTK-B" });
    });

    it("should create a valid teaching assignment", async () => {
      const asg = await createTeacherAssignment(adminA, {
        teacherId: "usr_teacher_a1",
        subjectId: subjectMTK.id,
        classroomId: "cls_7a",
        academicYearId: "ay_2025_a",
      });

      assert.ok(asg.id);
      assert.equal(asg.teacherId, "usr_teacher_a1");
      assert.equal(asg.subjectId, subjectMTK.id);
      assert.equal(asg.classroomId, "cls_7a");
      assert.equal(asg.academicYearId, "ay_2025_a");
      assert.equal(asg.institutionId, instAId);
    });

    it("should reject duplicate assignment for same teacher, subject, classroom, and year", async () => {
      await createTeacherAssignment(adminA, {
        teacherId: "usr_teacher_a1",
        subjectId: subjectMTK.id,
        classroomId: "cls_7a",
        academicYearId: "ay_2025_a",
      });

      await assert.rejects(
        async () => {
          await createTeacherAssignment(adminA, {
            teacherId: "usr_teacher_a1",
            subjectId: subjectMTK.id,
            classroomId: "cls_7a",
            academicYearId: "ay_2025_a",
          });
        },
        (err) => err instanceof DuplicateAssignmentError
      );
    });

    it("should reject assignment if classroom academicYearId does NOT match assignment academicYearId", async () => {
      // cls_8a_future belongs to ay_2026_a, but we try to assign it under ay_2025_a
      await assert.rejects(
        async () => {
          await createTeacherAssignment(adminA, {
            teacherId: "usr_teacher_a1",
            subjectId: subjectMTK.id,
            classroomId: "cls_8a_future",
            academicYearId: "ay_2025_a",
          });
        },
        (err) => err instanceof AcademicYearMismatchError
      );
    });

    it("should reject assignment using teacher from another tenant (cross-tenant teacher)", async () => {
      await assert.rejects(
        async () => {
          await createTeacherAssignment(adminA, {
            teacherId: "usr_teacher_b1", // Teacher from Inst B
            subjectId: subjectMTK.id,
            classroomId: "cls_7a",
            academicYearId: "ay_2025_a",
          });
        },
        (err) => err instanceof ResourceNotFoundError
      );
    });

    it("should reject assignment using subject from another tenant (cross-tenant subject)", async () => {
      await assert.rejects(
        async () => {
          await createTeacherAssignment(adminA, {
            teacherId: "usr_teacher_a1",
            subjectId: subjectInstB.id, // Subject from Inst B
            classroomId: "cls_7a",
            academicYearId: "ay_2025_a",
          });
        },
        (err) => err instanceof ResourceNotFoundError
      );
    });

    it("should reject assignment using classroom from another tenant (cross-tenant classroom)", async () => {
      await assert.rejects(
        async () => {
          await createTeacherAssignment(adminA, {
            teacherId: "usr_teacher_a1",
            subjectId: subjectMTK.id,
            classroomId: "cls_7b_inst_b", // Classroom from Inst B
            academicYearId: "ay_2025_a",
          });
        },
        (err) => err instanceof ResourceNotFoundError
      );
    });

    it("should reject assignment using academic year from another tenant (cross-tenant academic year)", async () => {
      await assert.rejects(
        async () => {
          await createTeacherAssignment(adminA, {
            teacherId: "usr_teacher_a1",
            subjectId: subjectMTK.id,
            classroomId: "cls_7a",
            academicYearId: "ay_2025_b", // Academic year from Inst B
          });
        },
        (err) => err instanceof ResourceNotFoundError
      );
    });

    it("should reject assigning a user who does not have role TEACHER", async () => {
      await assert.rejects(
        async () => {
          await createTeacherAssignment(adminA, {
            teacherId: "usr_admin_a", // Role is ADMIN, not TEACHER
            subjectId: subjectMTK.id,
            classroomId: "cls_7a",
            academicYearId: "ay_2025_a",
          });
        },
        (err) => err instanceof InvalidTeacherRoleError
      );
    });

    it("should preserve historical integrity across academic years", async () => {
      // 2025: Ust. Ahmad Fauzi teaches MTK in VII A
      const asg2025 = await createTeacherAssignment(adminA, {
        teacherId: "usr_teacher_a1",
        subjectId: subjectMTK.id,
        classroomId: "cls_7a",
        academicYearId: "ay_2025_a",
      });

      // 2026: Ust. Ahmad Fauzi teaches MTK in VIII A
      const asg2026 = await createTeacherAssignment(adminA, {
        teacherId: "usr_teacher_a1",
        subjectId: subjectMTK.id,
        classroomId: "cls_8a_future",
        academicYearId: "ay_2026_a",
      });

      assert.ok(asg2025.id);
      assert.ok(asg2026.id);
      assert.notEqual(asg2025.id, asg2026.id);

      // Query history for Ust. Ahmad Fauzi
      const history = await getTeacherAssignments(adminA, "usr_teacher_a1");
      assert.equal(history.length, 2);
    });

    it("should delete teaching assignment when needed", async () => {
      const asg = await createTeacherAssignment(adminA, {
        teacherId: "usr_teacher_a1",
        subjectId: subjectIPA.id,
        classroomId: "cls_7b",
        academicYearId: "ay_2025_a",
      });

      const deleted = await deleteTeacherAssignment(adminA, asg.id);
      assert.equal(deleted.id, asg.id);

      // Verify it's no longer found
      await assert.rejects(
        async () => {
          await deleteTeacherAssignment(adminA, asg.id);
        },
        (err) => err instanceof ResourceNotFoundError
      );
    });
  });

  // =========================================================================
  // 4. TEACHER AUTHORIZATION & RESOURCE SCOPE
  // =========================================================================
  describe("4. Teacher Authorization & Resource Scope", () => {
    let subjectMTK: any;
    let subjectIPA: any;

    beforeEach(async () => {
      subjectMTK = await createSubject(adminA, { name: "Matematika", code: "MTK" });
      subjectIPA = await createSubject(adminA, { name: "IPA Terpadu", code: "IPA" });

      // Create assignment for Teacher A1
      await createTeacherAssignment(adminA, {
        teacherId: "usr_teacher_a1",
        subjectId: subjectMTK.id,
        classroomId: "cls_7a",
        academicYearId: "ay_2025_a",
      });

      // Create assignment for Teacher A2
      await createTeacherAssignment(adminA, {
        teacherId: "usr_teacher_a2",
        subjectId: subjectIPA.id,
        classroomId: "cls_7b",
        academicYearId: "ay_2025_a",
      });
    });

    it("should allow teacher to list and view their own assignments without academic:manage", async () => {
      // Teacher A1 lists assignments without filters -> automatically scoped to their own assignments
      const res = await listTeacherAssignments(teacherA1);
      assert.equal(res.total, 1);
      assert.equal(res.items[0].teacherId, "usr_teacher_a1");
      assert.equal(res.items[0].subject.name, "Matematika");
    });

    it("should forbid teacher from querying another teacher's assignments", async () => {
      // Teacher A1 tries to pass teacherId="usr_teacher_a2"
      await assert.rejects(
        async () => {
          await listTeacherAssignments(teacherA1, { teacherId: "usr_teacher_a2" });
        },
        (err) => err instanceof TeacherAssignmentAccessDeniedError
      );
    });

    it("should forbid teacher from accessing another teacher's assignment history directly", async () => {
      await assert.rejects(
        async () => {
          await getTeacherAssignments(teacherA1, "usr_teacher_a2");
        },
        (err) => err instanceof TeacherAssignmentAccessDeniedError
      );
    });

    it("should forbid teacher without academic:manage from creating assignments", async () => {
      await assert.rejects(
        async () => {
          await createTeacherAssignment(teacherA1, {
            teacherId: "usr_teacher_a1",
            subjectId: subjectIPA.id,
            classroomId: "cls_7a",
            academicYearId: "ay_2025_a",
          });
        },
        (err) => err instanceof AuthorizationError
      );
    });

    it("should forbid teacher without academic:manage from deleting assignments", async () => {
      const list = await listTeacherAssignments(adminA);
      const asg = list.items[0];

      await assert.rejects(
        async () => {
          await deleteTeacherAssignment(teacherA1, asg.id);
        },
        (err) => err instanceof AuthorizationError
      );
    });

    it("should allow admin with academic:manage to view and manage all assignments in their tenant", async () => {
      const allAsg = await listTeacherAssignments(adminA);
      assert.equal(allAsg.total, 2);

      const t1Asg = await getTeacherAssignments(adminA, "usr_teacher_a1");
      assert.equal(t1Asg.length, 1);

      const t2Asg = await getTeacherAssignments(adminA, "usr_teacher_a2");
      assert.equal(t2Asg.length, 1);
    });
  });
});
