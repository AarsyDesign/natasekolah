import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import type { TenantContext } from "../src/lib/tenant/context";
import {
  createDormitory,
  getDormitoryById,
  listDormitories,
  createDormitoryRoom,
  getDormitoryRoomById,
  assignStudentToRoom,
  endDormitoryAssignment,
  listDormitoryAssignments,
  DormitoryDuplicateNameError,
  DormitoryRoomDuplicateNameError,
  DormitoryRoomCapacityExceededError,
  ActiveDormitoryAssignmentExistsError,
  DormitoryNotFoundError,
  DormitoryRoomNotFoundError,
  DormitoryAssignmentNotFoundError,
} from "../src/lib/dormitory";
import {
  createLivingAttendanceSession,
  getAttendanceSession,
  closeAttendanceSession,
  getAttendanceRoster,
  markAttendance,
  markAttendanceBatch,
  LivingAttendanceSessionAlreadyExistsError,
  AttendanceIncompleteError,
  InvalidAttendanceContextError,
} from "../src/lib/attendance";
import { SUBJECT_CATEGORIES } from "../src/lib/teaching/types";
import { createSubjectInputSchema } from "../src/lib/validation/teaching";
import { ResourceNotFoundError } from "../src/lib/academic";
import { AuthorizationError } from "../src/lib/auth/permissions";

describe("Phase 6 — Pesantren & Tahfidz Living Core Tests", () => {
  const instAId = "inst_pesantren_al_hikmah";
  const instBId = "inst_pesantren_darussalam";

  const adminA: TenantContext = {
    userId: "usr_admin_a",
    institutionId: instAId,
    roles: ["ADMIN"],
    permissions: [
      "academic:view",
      "academic:manage",
      "attendance:view",
      "attendance:manage",
      "dormitory:view",
      "dormitory:manage",
      "tahfidz:view",
      "tahfidz:manage",
    ],
    isSuperAdmin: false,
  };

  const ustadzMusrifA: TenantContext = {
    userId: "usr_musrif_a",
    institutionId: instAId,
    roles: ["TEACHER"],
    permissions: ["attendance:view", "attendance:manage", "dormitory:view"],
    isSuperAdmin: false,
  };

  const adminB: TenantContext = {
    userId: "usr_admin_b",
    institutionId: instBId,
    roles: ["ADMIN"],
    permissions: [
      "academic:view",
      "academic:manage",
      "attendance:view",
      "attendance:manage",
      "dormitory:view",
      "dormitory:manage",
    ],
    isSuperAdmin: false,
  };

  // In-Memory Data Stores
  let inMemoryDormitories: any[] = [];
  let inMemoryRooms: any[] = [];
  let inMemoryAssignments: any[] = [];
  let inMemoryStudents: any[] = [];
  let inMemoryEnrollments: any[] = [];
  let inMemorySessions: any[] = [];
  let inMemoryRecords: any[] = [];

  let dormAutoId = 1;
  let roomAutoId = 1;
  let assignAutoId = 1;
  let sessionAutoId = 1;
  let recordAutoId = 1;

  beforeEach(() => {
    dormAutoId = 1;
    roomAutoId = 1;
    assignAutoId = 1;
    sessionAutoId = 1;
    recordAutoId = 1;

    inMemoryStudents = [
      {
        id: "std_santri_1",
        institutionId: instAId,
        nis: "1001",
        fullName: "Zaid bin Tsabit",
        gender: "L",
        status: "ACTIVE",
      },
      {
        id: "std_santri_2",
        institutionId: instAId,
        nis: "1002",
        fullName: "Abdullah bin Umar",
        gender: "L",
        status: "ACTIVE",
      },
      {
        id: "std_santri_3",
        institutionId: instAId,
        nis: "1003",
        fullName: "Anas bin Malik",
        gender: "L",
        status: "ACTIVE",
      },
      {
        id: "std_santri_b",
        institutionId: instBId,
        nis: "9001",
        fullName: "Santri Luar B",
        gender: "L",
        status: "ACTIVE",
      },
    ];

    inMemoryEnrollments = [
      {
        id: "enr_santri_1",
        institutionId: instAId,
        studentId: "std_santri_1",
        academicYearId: "ay_2026",
        classroomId: "cls_diniyah_1",
        status: "ENROLLED",
      },
      {
        id: "enr_santri_2",
        institutionId: instAId,
        studentId: "std_santri_2",
        academicYearId: "ay_2026",
        classroomId: "cls_diniyah_1",
        status: "ENROLLED",
      },
      {
        id: "enr_santri_3",
        institutionId: instAId,
        studentId: "std_santri_3",
        academicYearId: "ay_2026",
        classroomId: "cls_diniyah_1",
        status: "ENROLLED",
      },
    ];

    inMemoryDormitories = [];
    inMemoryRooms = [];
    inMemoryAssignments = [];
    inMemorySessions = [];
    inMemoryRecords = [];

    // Mock prisma.dormitory
    (prisma.dormitory as any).findUnique = async ({ where }: any) => {
      const id = where?.id_institutionId?.id || where?.id;
      const instId = where?.id_institutionId?.institutionId;
      const instName = where?.institutionId_name;

      if (instName) {
        return (
          inMemoryDormitories.find(
            (d) => d.institutionId === instName.institutionId && d.name.toLowerCase() === instName.name.toLowerCase()
          ) || null
        );
      }

      const dorm = inMemoryDormitories.find((d) => d.id === id && (!instId || d.institutionId === instId));
      if (!dorm) return null;

      const rooms = inMemoryRooms
        .filter((r) => r.dormitoryId === dorm.id)
        .map((r) => ({
          ...r,
          assignments: inMemoryAssignments
            .filter((a) => a.roomId === r.id && a.status === "ACTIVE")
            .map((a) => ({
              ...a,
              student: inMemoryStudents.find((s) => s.id === a.studentId),
            })),
        }));

      return { ...dorm, rooms };
    };

    (prisma.dormitory as any).findMany = async ({ where }: any) => {
      let results = [...inMemoryDormitories];
      if (where?.institutionId) {
        results = results.filter((d) => d.institutionId === where.institutionId);
      }
      return results.map((dorm) => ({
        ...dorm,
        rooms: inMemoryRooms
          .filter((r) => r.dormitoryId === dorm.id)
          .map((r) => ({
            ...r,
            assignments: inMemoryAssignments
              .filter((a) => a.roomId === r.id && a.status === "ACTIVE")
              .map((a) => ({
                ...a,
                student: inMemoryStudents.find((s) => s.id === a.studentId),
              })),
          })),
      }));
    };

    (prisma.dormitory as any).create = async ({ data }: any) => {
      const newDorm = {
        id: `dorm_${dormAutoId++}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      inMemoryDormitories.push(newDorm);
      return { ...newDorm };
    };

    // Mock prisma.dormitoryRoom
    (prisma.dormitoryRoom as any).findUnique = async ({ where }: any) => {
      const id = where?.id_institutionId?.id || where?.id;
      const instId = where?.id_institutionId?.institutionId;
      const dormName = where?.dormitoryId_name;

      if (dormName) {
        return (
          inMemoryRooms.find(
            (r) => r.dormitoryId === dormName.dormitoryId && r.name.toLowerCase() === dormName.name.toLowerCase()
          ) || null
        );
      }

      const room = inMemoryRooms.find((r) => r.id === id && (!instId || r.institutionId === instId));
      if (!room) return null;

      const dorm = inMemoryDormitories.find((d) => d.id === room.dormitoryId);
      const assignments = inMemoryAssignments
        .filter((a) => a.roomId === room.id && a.status === "ACTIVE")
        .map((a) => ({
          ...a,
          student: inMemoryStudents.find((s) => s.id === a.studentId),
        }));

      return {
        ...room,
        dormitory: dorm,
        assignments,
      };
    };

    (prisma.dormitoryRoom as any).create = async ({ data }: any) => {
      const newRoom = {
        id: `room_${roomAutoId++}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      inMemoryRooms.push(newRoom);
      return { ...newRoom };
    };

    // Mock prisma.student
    (prisma.student as any).findUnique = async ({ where }: any) => {
      const id = where?.id_institutionId?.id || where?.id;
      const instId = where?.id_institutionId?.institutionId;
      const student = inMemoryStudents.find((s) => s.id === id && (!instId || s.institutionId === instId));
      return student ? { ...student } : null;
    };

    // Mock prisma.enrollment
    (prisma.enrollment as any).findFirst = async ({ where }: any) => {
      const match = inMemoryEnrollments.find((e) => {
        if (where?.institutionId && e.institutionId !== where.institutionId) return false;
        if (where?.studentId && e.studentId !== where.studentId) return false;
        if (where?.status && e.status !== where.status) return false;
        return true;
      });
      return match ? { ...match } : null;
    };

    // Mock prisma.studentDormitoryAssignment
    (prisma.studentDormitoryAssignment as any).findUnique = async ({ where }: any) => {
      const id = where?.id_institutionId?.id || where?.id;
      const instId = where?.id_institutionId?.institutionId;
      const item = inMemoryAssignments.find((a) => a.id === id && (!instId || a.institutionId === instId));
      return item ? { ...item } : null;
    };

    (prisma.studentDormitoryAssignment as any).findFirst = async ({ where }: any) => {
      const match = inMemoryAssignments.find((a) => {
        if (where?.institutionId && a.institutionId !== where.institutionId) return false;
        if (where?.studentId && a.studentId !== where.studentId) return false;
        if (where?.status && a.status !== where.status) return false;
        if (where?.roomId && a.roomId !== where.roomId) return false;
        return true;
      });
      return match ? { ...match } : null;
    };

    (prisma.studentDormitoryAssignment as any).findMany = async ({ where }: any) => {
      let results = [...inMemoryAssignments];
      if (where?.institutionId) results = results.filter((a) => a.institutionId === where.institutionId);
      if (where?.studentId) results = results.filter((a) => a.studentId === where.studentId);
      if (where?.roomId) results = results.filter((a) => a.roomId === where.roomId);
      if (where?.status) results = results.filter((a) => a.status === where.status);

      return results.map((a) => {
        const student = inMemoryStudents.find((s) => s.id === a.studentId);
        const room = inMemoryRooms.find((r) => r.id === a.roomId);
        const dorm = room ? inMemoryDormitories.find((d) => d.id === room.dormitoryId) : null;
        return {
          ...a,
          student: student ? { id: student.id, fullName: student.fullName, nis: student.nis } : null,
          room: room
            ? {
                id: room.id,
                name: room.name,
                capacity: room.capacity,
                dormitory: dorm ? { id: dorm.id, name: dorm.name } : null,
              }
            : null,
        };
      });
    };

    (prisma.studentDormitoryAssignment as any).create = async ({ data }: any) => {
      const newAssign = {
        id: `asg_${assignAutoId++}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      inMemoryAssignments.push(newAssign);
      const student = inMemoryStudents.find((s) => s.id === newAssign.studentId);
      const room = inMemoryRooms.find((r) => r.id === newAssign.roomId);
      return {
        ...newAssign,
        student: student ? { id: student.id, fullName: student.fullName, nis: student.nis } : null,
        room: room ? { id: room.id, name: room.name, capacity: room.capacity } : null,
      };
    };

    (prisma.studentDormitoryAssignment as any).update = async ({ where, data }: any) => {
      const id = where?.id_institutionId?.id || where?.id;
      const idx = inMemoryAssignments.findIndex((a) => a.id === id);
      if (idx === -1) throw new Error("Assignment not found");
      inMemoryAssignments[idx] = {
        ...inMemoryAssignments[idx],
        ...data,
        updatedAt: new Date(),
      };
      const updated = inMemoryAssignments[idx];
      const student = inMemoryStudents.find((s) => s.id === updated.studentId);
      const room = inMemoryRooms.find((r) => r.id === updated.roomId);
      return {
        ...updated,
        student: student ? { id: student.id, fullName: student.fullName, nis: student.nis } : null,
        room: room ? { id: room.id, name: room.name } : null,
      };
    };

    // Mock prisma.attendanceSession
    (prisma.attendanceSession as any).findUnique = async ({ where }: any) => {
      const id = where?.id_institutionId?.id || where?.id;
      const session = inMemorySessions.find((s) => s.id === id);
      if (!session) return null;

      const room = session.dormitoryRoomId
        ? inMemoryRooms.find((r) => r.id === session.dormitoryRoomId)
        : null;
      const dorm = room ? inMemoryDormitories.find((d) => d.id === room.dormitoryId) : null;

      const records = inMemoryRecords
        .filter((r) => r.attendanceSessionId === session.id)
        .map((r) => ({
          ...r,
          student: inMemoryStudents.find((s) => s.id === r.studentId),
        }));

      return {
        ...session,
        dormitoryRoom: room ? { ...room, dormitory: dorm } : null,
        teacherAssignment: null,
        records,
      };
    };

    (prisma.attendanceSession as any).findFirst = async ({ where }: any) => {
      const match = inMemorySessions.find((s) => {
        if (where?.institutionId && s.institutionId !== where.institutionId) return false;
        if (where?.dormitoryRoomId && s.dormitoryRoomId !== where.dormitoryRoomId) return false;
        if (where?.context && s.context !== where.context) return false;
        if (where?.attendanceDate && s.attendanceDate.toISOString().slice(0, 10) !== where.attendanceDate.toISOString().slice(0, 10)) return false;
        return true;
      });
      return match ? { ...match } : null;
    };

    (prisma.attendanceSession as any).create = async ({ data }: any) => {
      const newSession = {
        id: `sess_${sessionAutoId++}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      inMemorySessions.push(newSession);
      const room = newSession.dormitoryRoomId
        ? inMemoryRooms.find((r) => r.id === newSession.dormitoryRoomId)
        : null;
      const dorm = room ? inMemoryDormitories.find((d) => d.id === room.dormitoryId) : null;
      return {
        ...newSession,
        dormitoryRoom: room ? { ...room, dormitory: dorm } : null,
        teacherAssignment: null,
      };
    };

    (prisma.attendanceSession as any).update = async ({ where, data }: any) => {
      const id = where?.id_institutionId?.id || where?.id;
      const idx = inMemorySessions.findIndex((s) => s.id === id);
      if (idx === -1) throw new Error("Session not found");
      inMemorySessions[idx] = {
        ...inMemorySessions[idx],
        ...data,
        updatedAt: new Date(),
      };
      const session = inMemorySessions[idx];
      const room = session.dormitoryRoomId
        ? inMemoryRooms.find((r) => r.id === session.dormitoryRoomId)
        : null;
      const dorm = room ? inMemoryDormitories.find((d) => d.id === room.dormitoryId) : null;
      return {
        ...session,
        dormitoryRoom: room ? { ...room, dormitory: dorm } : null,
        teacherAssignment: null,
      };
    };

    // Mock prisma.attendanceRecord
    (prisma.attendanceRecord as any).upsert = async ({ where, update, create }: any) => {
      const sessionId = where?.attendanceSessionId_studentId?.attendanceSessionId;
      const studentId = where?.attendanceSessionId_studentId?.studentId;

      const idx = inMemoryRecords.findIndex(
        (r) => r.attendanceSessionId === sessionId && r.studentId === studentId
      );

      if (idx !== -1) {
        inMemoryRecords[idx] = {
          ...inMemoryRecords[idx],
          ...update,
          updatedAt: new Date(),
        };
        const updated = inMemoryRecords[idx];
        return {
          ...updated,
          student: inMemoryStudents.find((s) => s.id === updated.studentId),
        };
      } else {
        const newRecord = {
          id: `rec_${recordAutoId++}`,
          ...create,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        inMemoryRecords.push(newRecord);
        return {
          ...newRecord,
          student: inMemoryStudents.find((s) => s.id === newRecord.studentId),
        };
      }
    };
  });

  describe("1. Diniyah / Pesantren Subject Integration", () => {
    it("mendukung seluruh kategori mata pelajaran pesantren dan formal", () => {
      const expectedCategories = [
        "UMUM",
        "AGAMA",
        "MULOK",
        "PEMINATAN",
        "DINIAH",
        "KITAB",
        "TAHSIN",
        "TAJWID",
        "AKHLAQ",
        "FIQIH",
        "AQIDAH",
        "HADITS",
        "LAINNYA",
      ];

      for (const cat of expectedCategories) {
        assert.ok(
          (SUBJECT_CATEGORIES as readonly string[]).includes(cat),
          `Kategori ${cat} harus terdaftar di SUBJECT_CATEGORIES`
        );
      }
    });

    it("memvalidasi pembuatan mata pelajaran dengan kategori pesantren", () => {
      const input = {
        name: "Nahwu Wadih Jilid 1",
        code: "NW-01",
        category: "KITAB",
      };

      const validated = createSubjectInputSchema.parse(input);
      assert.equal(validated.name, "Nahwu Wadih Jilid 1");
      assert.equal(validated.category, "KITAB");
    });
  });

  describe("2. Dormitory & Room Management Core", () => {
    it("dapat membuat gedung asrama dan kamar dengan kapasitas", async () => {
      // 1. Buat Gedung Asrama
      const dorm = await createDormitory(adminA, {
        name: "Gedung Salman Al-Farisi",
        gender: "L",
        description: "Asrama santri putra tingkat wustha",
      });

      assert.equal(dorm.name, "Gedung Salman Al-Farisi");
      assert.equal(dorm.institutionId, instAId);
      assert.equal(dorm.isActive, true);

      // 2. Buat Kamar dalam Gedung
      const room = await createDormitoryRoom(adminA, {
        dormitoryId: dorm.id,
        name: "Kamar 101",
        capacity: 2,
      });

      assert.equal(room.name, "Kamar 101");
      assert.equal(room.capacity, 2);
      assert.equal(room.dormitoryId, dorm.id);
      assert.equal(room.institutionId, instAId);
    });

    it("menolak duplikasi nama asrama pada tenant yang sama", async () => {
      await createDormitory(adminA, {
        name: "Gedung Abu Bakar",
        gender: "L",
      });

      await assert.rejects(
        async () => {
          await createDormitory(adminA, {
            name: "Gedung Abu Bakar",
            gender: "L",
          });
        },
        (err: any) => err instanceof DormitoryDuplicateNameError
      );
    });

    it("menolak duplikasi nama kamar pada gedung yang sama", async () => {
      const dorm = await createDormitory(adminA, {
        name: "Gedung Utsman",
        gender: "L",
      });

      await createDormitoryRoom(adminA, {
        dormitoryId: dorm.id,
        name: "Kamar 201",
        capacity: 4,
      });

      await assert.rejects(
        async () => {
          await createDormitoryRoom(adminA, {
            dormitoryId: dorm.id,
            name: "Kamar 201",
            capacity: 4,
          });
        },
        (err: any) => err instanceof DormitoryRoomDuplicateNameError
      );
    });

    it("menegakkan isolasi tenant: Tenant B tidak bisa melihat atau membuat kamar di Asrama Tenant A", async () => {
      const dormA = await createDormitory(adminA, {
        name: "Gedung Ali",
        gender: "L",
      });

      // Admin B mencoba membuat kamar di asrama Tenant A
      await assert.rejects(
        async () => {
          await createDormitoryRoom(adminB, {
            dormitoryId: dormA.id,
            name: "Kamar Hack",
            capacity: 4,
          });
        },
        (err: any) => err instanceof DormitoryNotFoundError
      );

      // Admin B tidak melihat asrama Tenant A di list
      const listB = await listDormitories(adminB);
      assert.equal(listB.length, 0);
    });
  });

  describe("3. Student Dormitory Assignment & Historical Integrity", () => {
    it("dapat menempatkan santri ke dalam kamar", async () => {
      const dorm = await createDormitory(adminA, { name: "Gedung Bilal", gender: "L" });
      const room = await createDormitoryRoom(adminA, {
        dormitoryId: dorm.id,
        name: "Kamar A1",
        capacity: 2,
      });

      const assignment = await assignStudentToRoom(adminA, {
        studentId: "std_santri_1",
        roomId: room.id,
        startDate: new Date("2026-08-01"),
      });

      assert.equal(assignment.studentId, "std_santri_1");
      assert.equal(assignment.roomId, room.id);
      assert.equal(assignment.status, "ACTIVE");
    });

    it("menolak penempatan jika kapasitas kamar sudah penuh (DormitoryRoomCapacityExceededError)", async () => {
      const dorm = await createDormitory(adminA, { name: "Gedung Hamzah", gender: "L" });
      const room = await createDormitoryRoom(adminA, {
        dormitoryId: dorm.id,
        name: "Kamar Khusus",
        capacity: 1, // Kapasitas 1 santri
      });

      // Santri 1 masuk
      await assignStudentToRoom(adminA, {
        studentId: "std_santri_1",
        roomId: room.id,
      });

      // Santri 2 mencoba masuk kamar yang sudah penuh
      await assert.rejects(
        async () => {
          await assignStudentToRoom(adminA, {
            studentId: "std_santri_2",
            roomId: room.id,
          });
        },
        (err: any) => err instanceof DormitoryRoomCapacityExceededError
      );
    });

    it("menolak penempatan ganda aktif untuk santri yang sama (ActiveDormitoryAssignmentExistsError)", async () => {
      const dorm = await createDormitory(adminA, { name: "Gedung Umar", gender: "L" });
      const room1 = await createDormitoryRoom(adminA, {
        dormitoryId: dorm.id,
        name: "Kamar 01",
        capacity: 4,
      });
      const room2 = await createDormitoryRoom(adminA, {
        dormitoryId: dorm.id,
        name: "Kamar 02",
        capacity: 4,
      });

      // Tempatkan santri 1 di Kamar 01
      await assignStudentToRoom(adminA, {
        studentId: "std_santri_1",
        roomId: room1.id,
      });

      // Coba tempatkan santri 1 di Kamar 02 tanpa mengakhiri kamar 01
      await assert.rejects(
        async () => {
          await assignStudentToRoom(adminA, {
            studentId: "std_santri_1",
            roomId: room2.id,
          });
        },
        (err: any) => err instanceof ActiveDormitoryAssignmentExistsError
      );
    });

    it("mengakhiri penempatan kamar dan mempertahankan riwayat historis (Historical Sacred Integrity)", async () => {
      const dorm = await createDormitory(adminA, { name: "Gedung Khalid", gender: "L" });
      const roomA = await createDormitoryRoom(adminA, {
        dormitoryId: dorm.id,
        name: "Kamar A",
        capacity: 4,
      });
      const roomB = await createDormitoryRoom(adminA, {
        dormitoryId: dorm.id,
        name: "Kamar B",
        capacity: 4,
      });

      // 1. Semester 1 di Kamar A
      const assign1 = await assignStudentToRoom(adminA, {
        studentId: "std_santri_1",
        roomId: roomA.id,
        startDate: new Date("2026-01-10"),
      });

      // 2. Akhir semester pindah kamar -> end assignment
      const endedAssign = await endDormitoryAssignment(adminA, {
        assignmentId: assign1.id,
        endDate: new Date("2026-06-30"),
        notes: "Pindah ke Kamar B di semester berikutnya",
      });

      assert.equal(endedAssign.status, "ENDED");
      assert.ok(endedAssign.endDate !== null);

      // 3. Semester 2 masuk Kamar B
      const assign2 = await assignStudentToRoom(adminA, {
        studentId: "std_santri_1",
        roomId: roomB.id,
        startDate: new Date("2026-07-01"),
      });

      assert.equal(assign2.status, "ACTIVE");

      // 4. Verifikasi riwayat historis santri: terdapat 2 rekaman penempatan
      const history = await listDormitoryAssignments(adminA, {
        studentId: "std_santri_1",
      });

      assert.equal(history.length, 2);
      assert.ok(history.some((h) => h.roomId === roomA.id && h.status === "ENDED"));
      assert.ok(history.some((h) => h.roomId === roomB.id && h.status === "ACTIVE"));
    });

    it("menolak penempatan santri dari tenant lain (Tenant Isolation)", async () => {
      const dorm = await createDormitory(adminA, { name: "Gedung Sa'ad", gender: "L" });
      const room = await createDormitoryRoom(adminA, {
        dormitoryId: dorm.id,
        name: "Kamar 01",
        capacity: 2,
      });

      // Admin A mencoba menempatkan santri milik Tenant B
      await assert.rejects(
        async () => {
          await assignStudentToRoom(adminA, {
            studentId: "std_santri_b", // Tenant B
            roomId: room.id,
          });
        },
        (err: any) => err instanceof ResourceNotFoundError
      );
    });
  });

  describe("4. Living Attendance Integration Core", () => {
    it("dapat membuka sesi absensi asrama santri (context: LIVING)", async () => {
      const dorm = await createDormitory(adminA, { name: "Asrama Tahfidz", gender: "L" });
      const room = await createDormitoryRoom(adminA, {
        dormitoryId: dorm.id,
        name: "Paviliun 1",
        capacity: 4,
      });

      // Tempatkan penghuni kamar
      await assignStudentToRoom(adminA, { studentId: "std_santri_1", roomId: room.id });
      await assignStudentToRoom(adminA, { studentId: "std_santri_2", roomId: room.id });

      // Musrif / Admin membuka sesi absensi malam
      const session = await createLivingAttendanceSession(adminA, {
        dormitoryRoomId: room.id,
        attendanceDate: "2026-09-20",
      });

      assert.equal(session.context, "LIVING");
      assert.equal(session.dormitoryRoomId, room.id);
      assert.equal(session.status, "OPEN");
      assert.equal(session.institutionId, instAId);
    });

    it("menolak pembukaan sesi ganda untuk kamar dan tanggal yang sama", async () => {
      const dorm = await createDormitory(adminA, { name: "Asrama Diniyah", gender: "L" });
      const room = await createDormitoryRoom(adminA, {
        dormitoryId: dorm.id,
        name: "Paviliun 2",
        capacity: 4,
      });

      await createLivingAttendanceSession(adminA, {
        dormitoryRoomId: room.id,
        attendanceDate: "2026-09-21",
      });

      await assert.rejects(
        async () => {
          await createLivingAttendanceSession(adminA, {
            dormitoryRoomId: room.id,
            attendanceDate: "2026-09-21",
          });
        },
        (err: any) => err instanceof LivingAttendanceSessionAlreadyExistsError
      );
    });

    it("mengambil roster absensi asrama hanya berisi santri aktif penghuni kamar tersebut", async () => {
      const dorm = await createDormitory(adminA, { name: "Asrama Utama", gender: "L" });
      const room1 = await createDormitoryRoom(adminA, {
        dormitoryId: dorm.id,
        name: "Kamar Makkah",
        capacity: 4,
      });
      const room2 = await createDormitoryRoom(adminA, {
        dormitoryId: dorm.id,
        name: "Kamar Madinah",
        capacity: 4,
      });

      // Santri 1 & 2 di Kamar Makkah, Santri 3 di Kamar Madinah
      await assignStudentToRoom(adminA, { studentId: "std_santri_1", roomId: room1.id });
      await assignStudentToRoom(adminA, { studentId: "std_santri_2", roomId: room1.id });
      await assignStudentToRoom(adminA, { studentId: "std_santri_3", roomId: room2.id });

      const session = await createLivingAttendanceSession(adminA, {
        dormitoryRoomId: room1.id,
        attendanceDate: "2026-09-22",
      });

      const rosterResult = await getAttendanceRoster(adminA, session.id);

      assert.equal(rosterResult.roster.length, 2);
      const studentIds = rosterResult.roster.map((r) => r.studentId);
      assert.ok(studentIds.includes("std_santri_1"));
      assert.ok(studentIds.includes("std_santri_2"));
      assert.ok(!studentIds.includes("std_santri_3")); // Bukan penghuni Kamar Makkah
    });

    it("mencatat presensi kehadiran asrama santri secara granular (PRESENT, SICK, EXCUSED, ABSENT)", async () => {
      const dorm = await createDormitory(adminA, { name: "Asrama Raudhah", gender: "L" });
      const room = await createDormitoryRoom(adminA, {
        dormitoryId: dorm.id,
        name: "Kamar 01",
        capacity: 4,
      });

      await assignStudentToRoom(adminA, { studentId: "std_santri_1", roomId: room.id });
      await assignStudentToRoom(adminA, { studentId: "std_santri_2", roomId: room.id });

      const session = await createLivingAttendanceSession(adminA, {
        dormitoryRoomId: room.id,
        attendanceDate: "2026-09-23",
      });

      // Musrif menandai santri 1 hadir, santri 2 sakit di UKS
      const rec1 = await markAttendance(adminA, {
        attendanceSessionId: session.id,
        studentId: "std_santri_1",
        status: "PRESENT",
      });

      const rec2 = await markAttendance(adminA, {
        attendanceSessionId: session.id,
        studentId: "std_santri_2",
        status: "SICK",
        note: "Istirahat di pos kesehatan pesantren",
      });

      assert.equal(rec1.status, "PRESENT");
      assert.equal(rec2.status, "SICK");
      assert.equal(rec2.note, "Istirahat di pos kesehatan pesantren");
    });

    it("menolak santri luar kamar saat pengisian absensi asrama", async () => {
      const dorm = await createDormitory(adminA, { name: "Asrama Quba", gender: "L" });
      const room1 = await createDormitoryRoom(adminA, {
        dormitoryId: dorm.id,
        name: "Kamar Q1",
        capacity: 2,
      });

      await assignStudentToRoom(adminA, { studentId: "std_santri_1", roomId: room1.id });

      const session = await createLivingAttendanceSession(adminA, {
        dormitoryRoomId: room1.id,
        attendanceDate: "2026-09-24",
      });

      // std_santri_2 bukan penghuni Kamar Q1
      await assert.rejects(
        async () => {
          await markAttendance(adminA, {
            attendanceSessionId: session.id,
            studentId: "std_santri_2",
            status: "PRESENT",
          });
        },
        (err: any) => err instanceof InvalidAttendanceContextError
      );
    });

    it("menolak penutupan sesi jika belum seluruh santri kamar diabsen", async () => {
      const dorm = await createDormitory(adminA, { name: "Asrama Mina", gender: "L" });
      const room = await createDormitoryRoom(adminA, {
        dormitoryId: dorm.id,
        name: "Kamar M1",
        capacity: 4,
      });

      await assignStudentToRoom(adminA, { studentId: "std_santri_1", roomId: room.id });
      await assignStudentToRoom(adminA, { studentId: "std_santri_2", roomId: room.id });

      const session = await createLivingAttendanceSession(adminA, {
        dormitoryRoomId: room.id,
        attendanceDate: "2026-09-25",
      });

      // Hanya absen santri 1
      await markAttendance(adminA, {
        attendanceSessionId: session.id,
        studentId: "std_santri_1",
        status: "PRESENT",
      });

      // Coba tutup sesi saat santri 2 belum diabsen
      await assert.rejects(
        async () => {
          await closeAttendanceSession(adminA, {
            attendanceSessionId: session.id,
          });
        },
        (err: any) => err instanceof AttendanceIncompleteError
      );

      // Setelah santri 2 diabsen, penutupan sukses
      await markAttendance(adminA, {
        attendanceSessionId: session.id,
        studentId: "std_santri_2",
        status: "PRESENT",
      });

      const closed = await closeAttendanceSession(adminA, {
        attendanceSessionId: session.id,
      });

      assert.equal(closed.status, "CLOSED");
    });
  });
});
