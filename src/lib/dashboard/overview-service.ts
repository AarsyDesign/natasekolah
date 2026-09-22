import { prisma } from "../prisma";
import type { TenantContext } from "../tenant/context";
import { hasPermission, requirePermission } from "../auth/permissions";
import { normalizeAttendanceDate, formatAttendanceDate } from "../attendance";

export interface DashboardAttendanceItem {
  assignmentId: string;
  teacherName: string;
  subjectName: string;
  classroomName: string;
  status: "NOT_STARTED" | "OPEN" | "CLOSED";
  sessionId: string | null;
  recordCount: number;
}

export interface DashboardSnapshot {
  institution: { id: string; name: string; type: string };
  today: string;
  activeAcademicYear: { id: string; name: string } | null;
  counts: {
    activeStudents: number | null;
    activeTeachers: number | null;
    activeClassrooms: number | null;
    activeSubjects: number | null;
  };
  dataQuality: { activeStudentsWithoutEnrollment: number | null };
  attendance: {
    visible: boolean;
    assignmentsToday: number;
    sessionsOpen: number;
    sessionsClosed: number;
    sessionsNotStarted: number;
    items: DashboardAttendanceItem[];
  };
}

function parseRoles(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((role): role is string => typeof role === "string") : [];
  } catch {
    return [];
  }
}

export async function getDashboardSnapshot(ctx: TenantContext): Promise<DashboardSnapshot> {
  requirePermission(ctx, "student:view");

  const today = normalizeAttendanceDate(new Date());
  const todayStr = formatAttendanceDate(today);
  const canViewAttendance = hasPermission(ctx, "attendance:view");
  const canViewAcademic = hasPermission(ctx, "academic:view");
  const canManageAcademic = hasPermission(ctx, "academic:manage");

  const [institution, activeAcademicYear] = await Promise.all([
    prisma.institution.findUnique({
      where: { id: ctx.institutionId },
      select: { id: true, name: true, type: true },
    }),
    prisma.academicYear.findFirst({
      where: { institutionId: ctx.institutionId, isActive: true },
      select: { id: true, name: true },
    }),
  ]);

  if (!institution) throw new Error("Institusi aktif tidak ditemukan.");

  const [activeStudents, activeTeachersRaw, activeClassrooms, activeSubjects, activeStudentsWithoutEnrollment] =
    await Promise.all([
      prisma.student.count({ where: { institutionId: ctx.institutionId, status: "ACTIVE" } }),
      prisma.user.findMany({
        where: { institutionId: ctx.institutionId, isActive: true },
        select: { roles: true },
      }),
      activeAcademicYear
        ? prisma.classroom.count({
            where: { institutionId: ctx.institutionId, academicYearId: activeAcademicYear.id },
          })
        : Promise.resolve(0),
      canViewAcademic
        ? prisma.subject.count({ where: { institutionId: ctx.institutionId, isActive: true } })
        : Promise.resolve(null),
      activeAcademicYear
        ? prisma.student.count({
            where: {
              institutionId: ctx.institutionId,
              status: "ACTIVE",
              enrollments: {
                none: {
                  institutionId: ctx.institutionId,
                  academicYearId: activeAcademicYear.id,
                  status: "ENROLLED",
                },
              },
            },
          })
        : Promise.resolve(null),
    ]);

  const activeTeachers = activeTeachersRaw.filter((user) => parseRoles(user.roles).includes("TEACHER")).length;

  let attendance: DashboardSnapshot["attendance"] = {
    visible: canViewAttendance,
    assignmentsToday: 0,
    sessionsOpen: 0,
    sessionsClosed: 0,
    sessionsNotStarted: 0,
    items: [],
  };

  if (canViewAttendance && activeAcademicYear) {
    const assignments = await prisma.teacherAssignment.findMany({
      where: {
        institutionId: ctx.institutionId,
        academicYearId: activeAcademicYear.id,
        ...(canManageAcademic ? {} : { teacherId: ctx.userId }),
      },
      select: {
        id: true,
        teacher: { select: { name: true } },
        subject: { select: { name: true } },
        classroom: { select: { name: true } },
      },
      orderBy: [{ classroom: { name: "asc" } }, { subject: { name: "asc" } }],
      take: 100,
    });

    const assignmentIds = assignments.map((assignment) => assignment.id);
    const sessions = assignmentIds.length
      ? await prisma.attendanceSession.findMany({
          where: {
            institutionId: ctx.institutionId,
            attendanceDate: today,
            teacherAssignmentId: { in: assignmentIds },
          },
          select: {
            id: true,
            status: true,
            teacherAssignmentId: true,
            records: { select: { id: true } },
          },
        })
      : [];

    const sessionByAssignment = new Map(sessions.map((session) => [session.teacherAssignmentId, session]));
    const items = assignments.map((assignment): DashboardAttendanceItem => {
      const session = sessionByAssignment.get(assignment.id);
      return {
        assignmentId: assignment.id,
        teacherName: assignment.teacher.name,
        subjectName: assignment.subject.name,
        classroomName: assignment.classroom.name,
        status: session ? (session.status === "OPEN" ? "OPEN" : "CLOSED") : "NOT_STARTED",
        sessionId: session?.id ?? null,
        recordCount: session?.records.length ?? 0,
      };
    });

    attendance = {
      visible: true,
      assignmentsToday: assignments.length,
      sessionsOpen: items.filter((item) => item.status === "OPEN").length,
      sessionsClosed: items.filter((item) => item.status === "CLOSED").length,
      sessionsNotStarted: items.filter((item) => item.status === "NOT_STARTED").length,
      items: items.slice(0, 12),
    };
  }

  return {
    institution,
    today: todayStr,
    activeAcademicYear,
    counts: { activeStudents, activeTeachers, activeClassrooms, activeSubjects },
    dataQuality: { activeStudentsWithoutEnrollment },
    attendance,
  };
}