import { prisma } from "../prisma";
import type { TenantContext } from "../tenant/context";
import { hasPermission } from "../auth/permissions";
import { parseEnabledPlugins, PLUGINS } from "../plugins/registry";
import { isPluginEnabled } from "../plugins/guard";
import type {
  OperationalDashboardData,
  OperationalDashboardStats,
  OperationalAttentionItem,
  QuickActionItem,
} from "./types";

/**
 * Mengambil data operasional komprehensif harian (Operational Command Center)
 * yang terikat penuh pada tenant session, RBAC, dan plugin aktif lembaga.
 */
export async function getOperationalDashboard(
  ctx: TenantContext
): Promise<OperationalDashboardData> {
  const institution = await prisma.institution.findUnique({
    where: { id: ctx.institutionId },
  });

  if (!institution) {
    throw new Error("Lembaga tidak ditemukan atau akses tidak valid.");
  }

  const user = ctx.userId
    ? await prisma.user.findUnique({
        where: { id: ctx.userId },
      })
    : null;

  const enabledPlugins = parseEnabledPlugins(institution.enabledPlugins);

  // Batasan rentang waktu hari ini (00:00:00.000 hingga 23:59:59.999 UTC)
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

  // Inisialisasi kontainer statistik
  const stats: OperationalDashboardStats = {
    students: null,
    attendance: null,
    finance: null,
    academic: null,
    tahfidz: null,
    living: null,
    notifications: null,
  };

  const attentionItems: OperationalAttentionItem[] = [];

  // 1. STATS: SISWA AKTIF (Memerlukan izin student:view atau academic:view)
  if (hasPermission(ctx, "student:view") || hasPermission(ctx, "academic:view")) {
    const totalActive = await prisma.student.count({
      where: {
        institutionId: ctx.institutionId,
        status: "ACTIVE",
      },
    });
    stats.students = { totalActive };
  }

  // 2. STATS & ATTENTION: PRESENSI (Memerlukan izin attendance:view)
  if (hasPermission(ctx, "attendance:view")) {
    const todaySessions = await prisma.attendanceSession.findMany({
      where: {
        institutionId: ctx.institutionId,
        attendanceDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      select: {
        id: true,
        status: true,
      },
    });

    const todaySessionsTotal = todaySessions.length;
    const openSessionsCount = todaySessions.filter((s) => s.status === "OPEN").length;
    const closedSessionsCount = todaySessions.filter((s) => s.status === "CLOSED").length;

    // Rekap record presensi hari ini
    const statusCounts = await prisma.attendanceRecord.groupBy({
      by: ["status"],
      where: {
        institutionId: ctx.institutionId,
        session: {
          attendanceDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      },
      _count: { id: true },
    });

    let totalPresent = 0;
    let totalSick = 0;
    let totalExcused = 0;
    let totalAbsent = 0;

    for (const sc of statusCounts) {
      if (sc.status === "PRESENT") totalPresent = sc._count.id;
      if (sc.status === "SICK") totalSick = sc._count.id;
      if (sc.status === "EXCUSED") totalExcused = sc._count.id;
      if (sc.status === "ABSENT") totalAbsent = sc._count.id;
    }

    stats.attendance = {
      todaySessionsTotal,
      openSessionsCount,
      closedSessionsCount,
      totalPresent,
      totalSick,
      totalExcused,
      totalAbsent,
    };

    // Attention: Sesi presensi gantung/belum ditutup (semua sesi OPEN di lembaga)
    const allOpenSessionsCount = await prisma.attendanceSession.count({
      where: {
        institutionId: ctx.institutionId,
        status: "OPEN",
      },
    });

    if (allOpenSessionsCount > 0) {
      attentionItems.push({
        id: "ATTENDANCE_OPEN_SESSIONS",
        category: "ATTENDANCE",
        title: "Sesi Presensi Belum Ditutup",
        description: `Terdapat ${allOpenSessionsCount} sesi presensi yang masih berstatus terbuka dan belum difinalisasi.`,
        count: allOpenSessionsCount,
        severity: allOpenSessionsCount > 5 ? "CRITICAL" : "WARNING",
        actionLabel: "Selesaikan Presensi",
        actionHref: "/attendance",
      });
    }
  }

  // 3. STATS & ATTENTION: KEUANGAN (Memerlukan izin finance:view)
  if (hasPermission(ctx, "finance:view")) {
    const unpaidAgg = await prisma.studentCharge.aggregate({
      where: {
        institutionId: ctx.institutionId,
        status: { in: ["UNPAID", "PARTIAL"] },
      },
      _count: { id: true },
      _sum: { amount: true },
    });

    const overdueAgg = await prisma.studentCharge.aggregate({
      where: {
        institutionId: ctx.institutionId,
        status: { in: ["UNPAID", "PARTIAL"] },
        dueDate: { lt: now },
      },
      _count: { id: true },
      _sum: { amount: true },
    });

    const todayPaymentsAgg = await prisma.paymentTransaction.aggregate({
      where: {
        institutionId: ctx.institutionId,
        paymentDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      _count: { id: true },
      _sum: { amount: true },
    });

    const overdueChargesCount = overdueAgg._count.id;
    const overdueChargesSum = overdueAgg._sum.amount || 0;

    stats.finance = {
      unpaidChargesCount: unpaidAgg._count.id,
      unpaidChargesSum: unpaidAgg._sum.amount || 0,
      overdueChargesCount,
      overdueChargesSum,
      todayPaymentsCount: todayPaymentsAgg._count.id,
      todayPaymentsSum: todayPaymentsAgg._sum.amount || 0,
    };

    if (overdueChargesCount > 0) {
      attentionItems.push({
        id: "FINANCE_OVERDUE_CHARGES",
        category: "FINANCE",
        title: "Tagihan Santri Melewati Jatuh Tempo",
        description: `Terdapat ${overdueChargesCount} tagihan santri yang telah melampaui tenggat pembayaran.`,
        count: overdueChargesCount,
        severity: "WARNING",
        actionLabel: "Tinjau Tagihan",
        actionHref: "/finance",
      });
    }
  }

  // 4. STATS & ATTENTION: AKADEMIK & RAPORT (Memerlukan plugin FORMAL_ACADEMIC dan izin academic:view / report:view)
  const isFormalAcademicActive = isPluginEnabled(institution, PLUGINS.FORMAL_ACADEMIC);
  if (isFormalAcademicActive && (hasPermission(ctx, "academic:view") || hasPermission(ctx, "report:view"))) {
    const totalAssessments = await prisma.assessment.count({
      where: { institutionId: ctx.institutionId },
    });

    const draftAssessmentsCount = await prisma.assessment.count({
      where: {
        institutionId: ctx.institutionId,
        isPublished: false,
      },
    });

    const draftReportsCount = await prisma.reportCard.count({
      where: {
        institutionId: ctx.institutionId,
        status: "DRAFT",
      },
    });

    stats.academic = {
      totalAssessments,
      draftAssessmentsCount,
      draftReportsCount,
    };

    if (draftAssessmentsCount > 0 && hasPermission(ctx, "academic:view")) {
      attentionItems.push({
        id: "ACADEMIC_DRAFT_ASSESSMENTS",
        category: "ACADEMIC",
        title: "Penilaian Akademik Belum Dirilis",
        description: `Terdapat ${draftAssessmentsCount} penilaian formatif/sumatif yang belum dipublikasikan ke buku nilai.`,
        count: draftAssessmentsCount,
        severity: "INFO",
        actionLabel: "Kelola Penilaian",
        actionHref: "/assessments",
      });
    }

    if (draftReportsCount > 0 && hasPermission(ctx, "report:view")) {
      attentionItems.push({
        id: "REPORT_DRAFT_CARDS",
        category: "ACADEMIC",
        title: "Buku Raport Masih Berstatus DRAFT",
        description: `Terdapat ${draftReportsCount} raport semester yang belum diverifikasi dan dibekukan snapshot resminya.`,
        count: draftReportsCount,
        severity: "INFO",
        actionLabel: "Periksa Raport",
        actionHref: "/reports",
      });
    }
  }

  // 5. ATTENTION: ROMBEL TANPA GURU PENGAJAR (Memerlukan izin classroom:view atau academic:manage)
  if (hasPermission(ctx, "classroom:view") || hasPermission(ctx, "academic:manage")) {
    const activeAcademicYear = await prisma.academicYear.findFirst({
      where: {
        institutionId: ctx.institutionId,
        isActive: true,
      },
    });

    if (activeAcademicYear) {
      const classroomsWithoutTeachers = await prisma.classroom.findMany({
        where: {
          institutionId: ctx.institutionId,
          academicYearId: activeAcademicYear.id,
          teacherAssignments: { none: {} },
        },
        select: { id: true },
      });

      if (classroomsWithoutTeachers.length > 0) {
        attentionItems.push({
          id: "CLASSROOM_UNASSIGNED_TEACHERS",
          category: "CLASSROOM",
          title: "Rombel Belum Memiliki Guru Pengajar",
          description: `Terdapat ${classroomsWithoutTeachers.length} rombel aktif pada tahun ajaran ${activeAcademicYear.name} yang belum memiliki penugasan guru.`,
          count: classroomsWithoutTeachers.length,
          severity: "WARNING",
          actionLabel: "Atur Penugasan",
          actionHref: "/teacher-assignments",
        });
      }
    }
  }

  // 6. STATS: TAHFIDZ (Memerlukan plugin TAHFIDZ dan izin tahfidz:view)
  const isTahfidzActive = isPluginEnabled(institution, PLUGINS.TAHFIDZ);
  if (isTahfidzActive && hasPermission(ctx, "tahfidz:view")) {
    const todayRecordsCount = await prisma.tahfidzRecord.count({
      where: {
        institutionId: ctx.institutionId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    stats.tahfidz = { todayRecordsCount };
  }

  // 7. STATS: ASRAMA & LIVING (Memerlukan plugin PESANTREN_LIVING dan izin dormitory:view)
  const isLivingActive = isPluginEnabled(institution, PLUGINS.PESANTREN_LIVING);
  if (isLivingActive && hasPermission(ctx, "dormitory:view")) {
    const activeResidentsCount = await prisma.studentDormitoryAssignment.count({
      where: {
        institutionId: ctx.institutionId,
        status: "ACTIVE",
      },
    });

    const todayDormSessionsCount = await prisma.attendanceSession.count({
      where: {
        institutionId: ctx.institutionId,
        context: "LIVING",
        attendanceDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    stats.living = {
      activeResidentsCount,
      todayDormSessionsCount,
    };
  }

  // 8. STATS & ATTENTION: OUTBOX NOTIFIKASI WHATSAPP
  // Dapat diakses oleh admin lembaga atau yang memiliki izin institution:view / staff:view
  if (hasPermission(ctx, "institution:view") || hasPermission(ctx, "staff:view") || ctx.isSuperAdmin) {
    const failedCount = await prisma.notificationOutbox.count({
      where: {
        institutionId: ctx.institutionId,
        status: "FAILED",
      },
    });

    const pendingCount = await prisma.notificationOutbox.count({
      where: {
        institutionId: ctx.institutionId,
        status: "PENDING",
      },
    });

    stats.notifications = {
      failedCount,
      pendingCount,
    };

    if (failedCount > 0) {
      attentionItems.push({
        id: "NOTIFICATION_OUTBOX_FAILED",
        category: "NOTIFICATION",
        title: "Pesan WhatsApp Gagal Terkirim",
        description: `Terdapat ${failedCount} pesan notifikasi outbox gagal terkirim dan memerlukan tindakan retry/perbaikan.`,
        count: failedCount,
        severity: "CRITICAL",
        actionLabel: "Buka Outbox WA",
        actionHref: "/notifications",
      });
    }
  }

  // 9. QUICK ACTIONS: Dihasilkan secara dinamis berdasarkan RBAC dan Plugin aktif
  const quickActions: QuickActionItem[] = [];

  if (ctx.roles.includes("TEACHER") || hasPermission(ctx, "academic:view")) {
    quickActions.push({
      id: "qa-teacher-workspace",
      label: "Workspace Guru",
      description: "Pusat kerja mengajar: pantau rombel, presensi, & nilai",
      href: "/teacher",
      category: "ACADEMIC",
      iconName: "GraduationCap",
    });
  }

  if (hasPermission(ctx, "student:create")) {
    quickActions.push({
      id: "qa-student-create",
      label: "Tambah Siswa Baru",
      description: "Daftarkan data santri baru ke buku induk",
      href: "/students",
      category: "STUDENT",
      iconName: "UserPlus",
    });
  }

  if (hasPermission(ctx, "classroom:manage")) {
    quickActions.push({
      id: "qa-classroom-manage",
      label: "Kelola Rombel & Kelas",
      description: "Tambah rombongan belajar baru tahun ajaran aktif",
      href: "/classrooms",
      category: "ACADEMIC",
      iconName: "School",
    });
  }

  if (hasPermission(ctx, "attendance:manage")) {
    quickActions.push({
      id: "qa-attendance-record",
      label: "Catat Presensi Harian",
      description: "Buka sesi presensi akademik dan isi kehadiran siswa",
      href: "/attendance",
      category: "ATTENDANCE",
      iconName: "ClipboardCheck",
    });
  }

  if (isFormalAcademicActive && hasPermission(ctx, "academic:manage")) {
    quickActions.push({
      id: "qa-assessment-create",
      label: "Input Nilai Penilaian",
      description: "Buat asesmen baru dan rekap nilai per kelas",
      href: "/assessments",
      category: "ACADEMIC",
      iconName: "FileCheck2",
    });
  }

  if (hasPermission(ctx, "finance:manage")) {
    quickActions.push({
      id: "qa-finance-charge",
      label: "Buat Tagihan Biaya",
      description: "Terbitkan tagihan SPP/syahriah siswa bulan ini",
      href: "/finance",
      category: "FINANCE",
      iconName: "Receipt",
    });

    quickActions.push({
      id: "qa-finance-payment",
      label: "Catat Pembayaran Kas",
      description: "Terima setoran tunai atau transfer dan cetak kwitansi",
      href: "/finance",
      category: "FINANCE",
      iconName: "CreditCard",
    });
  }

  if (hasPermission(ctx, "guardian:view") || hasPermission(ctx, "student:view")) {
    quickActions.push({
      id: "qa-guardian-manage",
      label: "Buka Data Wali Murid",
      description: "Lihat relasi dan kirim undangan aktivasi portal wali",
      href: "/students",
      category: "STUDENT",
      iconName: "Users",
    });
  }

  if (isTahfidzActive && hasPermission(ctx, "tahfidz:manage")) {
    quickActions.push({
      id: "qa-tahfidz-record",
      label: "Setoran Ziyadah / Muraja'ah",
      description: "Catat mutaba'ah hafalan Al-Qur'an santri hari ini",
      href: "/tahfidz",
      category: "PESANTREN",
      iconName: "BookMarked",
    });
  }

  if (isLivingActive && (hasPermission(ctx, "dormitory:manage") || hasPermission(ctx, "dormitory:view"))) {
    quickActions.push({
      id: "qa-dormitory-manage",
      label: "Kelola Kamar & Asrama",
      description: "Atur penempatan santri mukim dan presensi malam",
      href: "/dormitories",
      category: "PESANTREN",
      iconName: "Home",
    });
  }

  return {
    institution: {
      id: institution.id,
      name: institution.name,
      slug: institution.slug,
      type: institution.type,
      enabledPlugins,
    },
    user: {
      id: user ? user.id : ctx.userId || "",
      name: user ? user.name : "Pengguna Internal",
      email: user ? user.email : "",
      roles: ctx.roles,
      permissions: ctx.permissions,
    },
    stats,
    attentionItems,
    quickActions,
  };
}
