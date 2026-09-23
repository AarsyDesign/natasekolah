import { prisma } from "../prisma";
import type { TenantContext } from "../tenant/context";
import { requirePermission } from "../auth/permissions";
import { ResourceNotFoundError } from "../academic";
import {
  DormitoryNotFoundError,
  DormitoryRoomNotFoundError,
  DormitoryRoomCapacityExceededError,
  ActiveDormitoryAssignmentExistsError,
  DormitoryAssignmentNotFoundError,
  DormitoryDuplicateNameError,
  DormitoryRoomDuplicateNameError,
} from "./types";
import {
  validateCreateDormitoryInput,
  validateCreateDormitoryRoomInput,
  validateAssignStudentToRoomInput,
  validateEndDormitoryAssignmentInput,
  validateDormitoryAssignmentFilter,
} from "../validation/dormitory";
import type {
  Dormitory,
  DormitoryRoom,
  StudentDormitoryAssignment,
  Prisma,
} from "@prisma/client";

/**
 * Membuat gedung / kompleks asrama baru.
 */
export async function createDormitory(
  ctx: TenantContext,
  rawInput: unknown,
  tx: any = prisma
): Promise<Dormitory> {
  requirePermission(ctx, "dormitory:manage");
  const validated = validateCreateDormitoryInput(rawInput);

  // Cek duplikasi nama asrama dalam tenant
  const existing = await tx.dormitory.findUnique({
    where: {
      institutionId_name: {
        institutionId: ctx.institutionId,
        name: validated.name,
      },
    },
  });

  if (existing) {
    throw new DormitoryDuplicateNameError(validated.name);
  }

  return tx.dormitory.create({
    data: {
      institutionId: ctx.institutionId,
      name: validated.name,
      gender: validated.gender,
      description: validated.description,
      isActive: validated.isActive ?? true,
    },
  });
}

/**
 * Mengambil gedung asrama berdasarkan ID beserta kamar dan daftar santri aktif.
 */
export async function getDormitoryById(
  ctx: TenantContext,
  id: string,
  tx: any = prisma
): Promise<Dormitory> {
  requirePermission(ctx, "dormitory:view");

  const dormitory = await tx.dormitory.findUnique({
    where: {
      id_institutionId: {
        id,
        institutionId: ctx.institutionId,
      },
    },
    include: {
      rooms: {
        include: {
          assignments: {
            where: { status: "ACTIVE" },
            include: {
              student: { select: { id: true, fullName: true, nis: true } },
            },
          },
        },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!dormitory) {
    throw new DormitoryNotFoundError(id);
  }

  return dormitory;
}

/**
 * Menampilkan daftar seluruh gedung asrama pada tenant aktif.
 */
export async function listDormitories(
  ctx: TenantContext,
  tx: any = prisma
): Promise<Dormitory[]> {
  requirePermission(ctx, "dormitory:view");

  return tx.dormitory.findMany({
    where: {
      institutionId: ctx.institutionId,
    },
    include: {
      rooms: {
        include: {
          assignments: {
            where: { status: "ACTIVE" },
          },
        },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });
}

/**
 * Membuat kamar baru dalam suatu gedung asrama.
 */
export async function createDormitoryRoom(
  ctx: TenantContext,
  rawInput: unknown,
  tx: any = prisma
): Promise<DormitoryRoom> {
  requirePermission(ctx, "dormitory:manage");
  const validated = validateCreateDormitoryRoomInput(rawInput);

  // Verifikasi gedung asrama ada dan milik tenant
  const dormitory = await tx.dormitory.findUnique({
    where: {
      id_institutionId: {
        id: validated.dormitoryId,
        institutionId: ctx.institutionId,
      },
    },
  });

  if (!dormitory) {
    throw new DormitoryNotFoundError(validated.dormitoryId);
  }

  // Cek duplikasi nama kamar dalam gedung yang sama
  const existing = await tx.dormitoryRoom.findUnique({
    where: {
      dormitoryId_name: {
        dormitoryId: validated.dormitoryId,
        name: validated.name,
      },
    },
  });

  if (existing) {
    throw new DormitoryRoomDuplicateNameError(validated.name, dormitory.name);
  }

  return tx.dormitoryRoom.create({
    data: {
      institutionId: ctx.institutionId,
      dormitoryId: validated.dormitoryId,
      name: validated.name,
      capacity: validated.capacity,
      isActive: validated.isActive ?? true,
    },
  });
}

/**
 * Mengambil rincian kamar asrama berdasarkan ID.
 */
export async function getDormitoryRoomById(
  ctx: TenantContext,
  id: string,
  tx: any = prisma
): Promise<DormitoryRoom> {
  requirePermission(ctx, "dormitory:view");

  const room = await tx.dormitoryRoom.findUnique({
    where: {
      id_institutionId: {
        id,
        institutionId: ctx.institutionId,
      },
    },
    include: {
      dormitory: true,
      assignments: {
        where: { status: "ACTIVE" },
        include: {
          student: { select: { id: true, fullName: true, nis: true } },
        },
      },
    },
  });

  if (!room) {
    throw new DormitoryRoomNotFoundError(id);
  }

  return room;
}

/**
 * Menempatkan santri ke dalam kamar asrama.
 *
 * Invariant:
 * 1. Santri dan Kamar harus berada dalam tenant yang sama.
 * 2. Kapasitas kamar tidak boleh terlampaui.
 * 3. Santri tidak boleh memiliki lebih dari 1 penempatan aktif secara bersamaan.
 */
export async function assignStudentToRoom(
  ctx: TenantContext,
  rawInput: unknown,
  tx: any = prisma
): Promise<StudentDormitoryAssignment> {
  requirePermission(ctx, "dormitory:manage");
  const validated = validateAssignStudentToRoomInput(rawInput);

  // 1. Verifikasi santri
  const student = await tx.student.findUnique({
    where: {
      id_institutionId: {
        id: validated.studentId,
        institutionId: ctx.institutionId,
      },
    },
  });

  if (!student) {
    throw new ResourceNotFoundError("Santri", validated.studentId);
  }

  // 2. Verifikasi kamar
  const room = await tx.dormitoryRoom.findUnique({
    where: {
      id_institutionId: {
        id: validated.roomId,
        institutionId: ctx.institutionId,
      },
    },
    include: {
      assignments: {
        where: { status: "ACTIVE" },
      },
    },
  });

  if (!room) {
    throw new DormitoryRoomNotFoundError(validated.roomId);
  }

  // 3. Invariant: Kapasitas kamar
  if (room.assignments.length >= room.capacity) {
    throw new DormitoryRoomCapacityExceededError(room.name, room.capacity);
  }

  // 4. Invariant: Santri tidak boleh memiliki penempatan aktif ganda
  const activeAssignment = await tx.studentDormitoryAssignment.findFirst({
    where: {
      institutionId: ctx.institutionId,
      studentId: student.id,
      status: "ACTIVE",
    },
  });

  if (activeAssignment) {
    throw new ActiveDormitoryAssignmentExistsError(student.fullName);
  }

  // 5. Eksekusi penempatan
  return tx.studentDormitoryAssignment.create({
    data: {
      institutionId: ctx.institutionId,
      studentId: student.id,
      roomId: room.id,
      startDate: validated.startDate ?? new Date(),
      status: "ACTIVE",
      notes: validated.notes,
    },
    include: {
      student: { select: { id: true, fullName: true, nis: true } },
      room: { select: { id: true, name: true, capacity: true } },
    },
  });
}

/**
 * Mengakhiri penempatan santri di kamar asrama (misal pindah kamar, lulus, atau boyong).
 */
export async function endDormitoryAssignment(
  ctx: TenantContext,
  rawInput: unknown,
  tx: any = prisma
): Promise<StudentDormitoryAssignment> {
  requirePermission(ctx, "dormitory:manage");
  const validated = validateEndDormitoryAssignmentInput(rawInput);

  const assignment = await tx.studentDormitoryAssignment.findUnique({
    where: {
      id_institutionId: {
        id: validated.assignmentId,
        institutionId: ctx.institutionId,
      },
    },
  });

  if (!assignment) {
    throw new DormitoryAssignmentNotFoundError(validated.assignmentId);
  }

  const updatedNotes = validated.notes
    ? assignment.notes
      ? `${assignment.notes} | ${validated.notes}`
      : validated.notes
    : assignment.notes;

  return tx.studentDormitoryAssignment.update({
    where: {
      id_institutionId: {
        id: validated.assignmentId,
        institutionId: ctx.institutionId,
      },
    },
    data: {
      endDate: validated.endDate ?? new Date(),
      status: "ENDED",
      notes: updatedNotes,
    },
    include: {
      student: { select: { id: true, fullName: true, nis: true } },
      room: { select: { id: true, name: true } },
    },
  });
}

/**
 * Menampilkan riwayat penempatan kamar santri (Historical Sacred History).
 */
export async function listDormitoryAssignments(
  ctx: TenantContext,
  filter?: unknown,
  tx: any = prisma
): Promise<StudentDormitoryAssignment[]> {
  requirePermission(ctx, "dormitory:view");

  const validated = filter ? validateDormitoryAssignmentFilter(filter) : {};

  const whereClause: Prisma.StudentDormitoryAssignmentWhereInput = {
    institutionId: ctx.institutionId,
    ...(validated.studentId ? { studentId: validated.studentId } : {}),
    ...(validated.roomId ? { roomId: validated.roomId } : {}),
    ...(validated.status ? { status: validated.status } : {}),
  };

  return tx.studentDormitoryAssignment.findMany({
    where: whereClause,
    orderBy: { startDate: "desc" },
    include: {
      student: { select: { id: true, fullName: true, nis: true } },
      room: {
        include: {
          dormitory: { select: { id: true, name: true } },
        },
      },
    },
  });
}
