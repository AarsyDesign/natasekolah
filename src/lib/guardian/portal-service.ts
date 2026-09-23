import { prisma } from "../prisma";
import { assertGuardianStudentAccess, GuardianAccessDeniedError } from "../auth/guardian-guard";
import { QURAN_SURAHS } from "../tahfidz/quran";
import type {
  GuardianProfileData,
  GuardianLinkedStudent,
  GuardianStudentOverview,
  GuardianAttendanceSummary,
  GuardianFinanceSummary,
  GuardianAcademicSummary,
  GuardianTahfidzSummary,
  GuardianDormitorySummary,
  GuardianNotificationItem,
  FrozenReportCardSnapshot,
} from "./types";

export class GuardianResourceNotFoundError extends Error {
  readonly code = "RESOURCE_NOT_FOUND";
  readonly status = 404;

  constructor(message: string) {
    super(message);
    this.name = "GuardianResourceNotFoundError";
  }
}

/**
 * Mengambil profil wali murid berserta daftar anak santri asuh yang terhubung.
 */
export async function getGuardianProfile(
  sessionGuardianId: string,
  sessionInstitutionId: string
): Promise<GuardianProfileData> {
  const guardian = await prisma.guardian.findUnique({
    where: { id: sessionGuardianId },
    include: {
      institution: {
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          address: true,
          phone: true,
        },
      },
      students: {
        include: {
          student: {
            include: {
              enrollments: {
                where: {
                  status: "ENROLLED",
                },
                orderBy: {
                  createdAt: "desc",
                },
                take: 1,
                include: {
                  classroom: true,
                  academicYear: true,
                },
              },
            },
          },
        },
        orderBy: [
          { isPrimary: "desc" },
          { createdAt: "asc" },
        ],
      },
    },
  });

  if (!guardian || guardian.institutionId !== sessionInstitutionId) {
    throw new GuardianAccessDeniedError(
      "UNKNOWN",
      sessionGuardianId,
      "Profil wali murid tidak ditemukan pada lembaga ini."
    );
  }

  const children: GuardianLinkedStudent[] = guardian.students.map((gs) => ({
    student: gs.student,
    relationship: gs.relationship,
    isPrimary: gs.isPrimary,
    activeEnrollment: gs.student.enrollments[0] || null,
  }));

  return {
    guardian,
    institution: guardian.institution,
    children,
  };
}

/**
 * Mengambil daftar santri yang terhubung dengan wali murid (ReBAC).
 */
export async function getGuardianChildren(
  sessionGuardianId: string,
  sessionInstitutionId: string
): Promise<GuardianLinkedStudent[]> {
  const profile = await getGuardianProfile(sessionGuardianId, sessionInstitutionId);
  return profile.children;
}

/**
 * Mengambil ringkasan komprehensif dasbor santri asuh (Dashboard Wali).
 */
export async function getGuardianStudentOverview(params: {
  sessionGuardianId: string;
  sessionInstitutionId: string;
  requestedStudentId: string;
}): Promise<GuardianStudentOverview> {
  const { sessionGuardianId, sessionInstitutionId, requestedStudentId } = params;

  // 1. Validasi ReBAC ketat: Sesi wali wajib terhubung resmi ke santri ini
  const relation = await assertGuardianStudentAccess({
    sessionGuardianId,
    sessionInstitutionId,
    requestedStudentId,
  });

  // 2. Ambil master data santri & enrollment aktif
  const student = await prisma.student.findUnique({
    where: { id: requestedStudentId },
    include: {
      enrollments: {
        where: { status: "ENROLLED" },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          classroom: true,
          academicYear: true,
        },
      },
    },
  });

  if (!student || student.institutionId !== sessionInstitutionId) {
    throw new GuardianResourceNotFoundError("Data peserta didik tidak ditemukan.");
  }

  // 3. Ambil ringkasan tiap domain secara paralel
  const [attendance, finance, academic, tahfidz, dormitory] = await Promise.all([
    getGuardianStudentAttendance({
      sessionGuardianId,
      sessionInstitutionId,
      requestedStudentId,
      limit: 5,
    }),
    getGuardianStudentFinance({
      sessionGuardianId,
      sessionInstitutionId,
      requestedStudentId,
      limit: 5,
    }),
    getGuardianStudentAcademic({
      sessionGuardianId,
      sessionInstitutionId,
      requestedStudentId,
      limitScores: 5,
    }),
    getGuardianStudentTahfidz({
      sessionGuardianId,
      sessionInstitutionId,
      requestedStudentId,
      limit: 5,
    }),
    getGuardianStudentDormitory({
      sessionGuardianId,
      sessionInstitutionId,
      requestedStudentId,
      limitAttendance: 5,
    }),
  ]);

  return {
    student,
    relationship: relation.relationship,
    isPrimary: relation.isPrimary,
    activeEnrollment: student.enrollments[0] || null,
    attendance,
    finance,
    academic,
    tahfidz,
    dormitory,
  };
}

/**
 * Mengambil rekap dan riwayat presensi santri asuh.
 */
export async function getGuardianStudentAttendance(params: {
  sessionGuardianId: string;
  sessionInstitutionId: string;
  requestedStudentId: string;
  limit?: number;
}): Promise<GuardianAttendanceSummary> {
  const { sessionGuardianId, sessionInstitutionId, requestedStudentId, limit } = params;

  await assertGuardianStudentAccess({
    sessionGuardianId,
    sessionInstitutionId,
    requestedStudentId,
  });

  // Ambil seluruh rekap status presensi santri di institusi ini
  const allRecords = await prisma.attendanceRecord.findMany({
    where: {
      studentId: requestedStudentId,
      institutionId: sessionInstitutionId,
    },
    include: {
      session: {
        include: {
          teacherAssignment: {
            include: {
              subject: true,
            },
          },
          dormitoryRoom: true,
        },
      },
    },
    orderBy: {
      session: {
        attendanceDate: "desc",
      },
    },
  });

  let presentCount = 0;
  let sickCount = 0;
  let excusedCount = 0;
  let absentCount = 0;

  for (const r of allRecords) {
    if (r.status === "PRESENT") presentCount++;
    else if (r.status === "SICK") sickCount++;
    else if (r.status === "EXCUSED") excusedCount++;
    else if (r.status === "ABSENT") absentCount++;
  }

  const totalSessions = allRecords.length;
  const attendanceRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0;

  const targetRecords = limit ? allRecords.slice(0, limit) : allRecords;

  const recentRecords = targetRecords.map((r) => ({
    id: r.id,
    date: r.session.attendanceDate,
    status: r.status,
    note: r.note,
    context: r.session.context,
    subjectName: r.session.teacherAssignment?.subject.name || null,
    roomName: r.session.dormitoryRoom?.name || null,
  }));

  return {
    totalSessions,
    presentCount,
    sickCount,
    excusedCount,
    absentCount,
    attendanceRate,
    recentRecords,
  };
}

/**
 * Mengambil informasi keuangan (tagihan, sisa kewajiban, riwayat pembayaran, kwitansi) santri asuh.
 * Murni READ-ONLY.
 */
export async function getGuardianStudentFinance(params: {
  sessionGuardianId: string;
  sessionInstitutionId: string;
  requestedStudentId: string;
  limit?: number;
}): Promise<GuardianFinanceSummary> {
  const { sessionGuardianId, sessionInstitutionId, requestedStudentId, limit } = params;

  await assertGuardianStudentAccess({
    sessionGuardianId,
    sessionInstitutionId,
    requestedStudentId,
  });

  // Ambil tagihan santri berserta alokasi pembayaran yang telah dilakukan
  const charges = await prisma.studentCharge.findMany({
    where: {
      studentId: requestedStudentId,
      institutionId: sessionInstitutionId,
      status: { not: "VOID" },
    },
    include: {
      feeCategory: true,
      academicYear: true,
      allocations: true,
    },
    orderBy: [
      { status: "asc" }, // UNPAID / PARTIAL lebih dulu
      { createdAt: "desc" },
    ],
  });

  // Ambil transaksi pembayaran santri beserta alokasi dan kwitansi resmi
  const transactions = await prisma.paymentTransaction.findMany({
    where: {
      studentId: requestedStudentId,
      institutionId: sessionInstitutionId,
    },
    include: {
      receipt: true,
      allocations: {
        include: {
          studentCharge: {
            include: {
              feeCategory: true,
            },
          },
        },
      },
    },
    orderBy: {
      paymentDate: "desc",
    },
  });

  let unpaidChargesCount = 0;
  let totalUnpaidAmount = 0;
  let totalPaidAmount = 0;

  const mappedCharges = charges.map((c) => {
    const paidAmount = c.allocations.reduce((sum, a) => sum + a.amount, 0);
    const remaining = Math.max(0, c.amount - paidAmount);

    if (c.status === "UNPAID" || c.status === "PARTIAL") {
      unpaidChargesCount++;
      totalUnpaidAmount += remaining;
    }
    totalPaidAmount += paidAmount;

    return {
      id: c.id,
      categoryName: c.feeCategory.name,
      amount: c.amount,
      paidAmount,
      remainingAmount: remaining,
      status: c.status,
      dueDate: c.dueDate,
    };
  });

  const targetCharges = limit ? mappedCharges.slice(0, limit) : mappedCharges;
  const targetTransactions = limit ? transactions.slice(0, limit) : transactions;

  const recentTransactions = targetTransactions.map((t) => {
    const categoryNames = Array.from(
      new Set(t.allocations.map((a) => a.studentCharge.feeCategory.name))
    );
    return {
      id: t.id,
      transactionNo: t.transactionNumber,
      date: t.paymentDate,
      totalAmount: t.amount,
      receiptNo: t.receipt?.receiptNumber || null,
      categoryNames,
    };
  });

  return {
    unpaidChargesCount,
    totalUnpaidAmount,
    totalPaidAmount,
    recentCharges: targetCharges,
    recentTransactions,
  };
}

/**
 * Mengambil ringkasan nilai akademik dan daftar raport resmi (PUBLISHED) santri asuh.
 * CATATAN KEAMANAN KRITIS: Raport berstatus "DRAFT" MUTLAK disembunyikan dari wali murid.
 */
export async function getGuardianStudentAcademic(params: {
  sessionGuardianId: string;
  sessionInstitutionId: string;
  requestedStudentId: string;
  limitScores?: number;
}): Promise<GuardianAcademicSummary> {
  const { sessionGuardianId, sessionInstitutionId, requestedStudentId, limitScores } = params;

  await assertGuardianStudentAccess({
    sessionGuardianId,
    sessionInstitutionId,
    requestedStudentId,
  });

  // 1. Ambil raport yang berstatus PUBLISHED saja!
  const publishedReports = await prisma.reportCard.findMany({
    where: {
      studentId: requestedStudentId,
      institutionId: sessionInstitutionId,
      status: "PUBLISHED", // DILARANG MENGAMBIL STATUS DRAFT!
    },
    include: {
      academicYear: true,
      classroom: true,
      subjects: true,
    },
    orderBy: {
      publishedAt: "desc",
    },
  });

  // 2. Ambil nilai penilaian (assessment scores)
  const scores = await prisma.assessmentScore.findMany({
    where: {
      studentId: requestedStudentId,
      institutionId: sessionInstitutionId,
      assessment: {
        isPublished: true, // Hanya penilaian yang sudah dipublikasi guru
      },
    },
    include: {
      assessment: {
        include: {
          teacherAssignment: {
            include: {
              subject: true,
            },
          },
        },
      },
    },
    orderBy: {
      assessment: {
        assessmentDate: "desc",
      },
    },
  });

  const latestReport = publishedReports[0];
  let latestPublishedReportCard: GuardianAcademicSummary["latestPublishedReportCard"] = null;

  if (latestReport) {
    const totalSubjects = latestReport.subjects.length;
    const totalScore = latestReport.subjects.reduce((sum, s) => sum + s.finalScore, 0);
    const averageScore = totalSubjects > 0 ? Math.round((totalScore / totalSubjects) * 10) / 10 : 0;

    latestPublishedReportCard = {
      id: latestReport.id,
      academicYearName: latestReport.academicYear.name,
      classroomName: latestReport.classroom.name,
      semester: latestReport.semester,
      publishedAt: latestReport.publishedAt,
      totalSubjects,
      averageScore,
    };
  }

  const targetScores = limitScores ? scores.slice(0, limitScores) : scores;
  const recentScores = targetScores.map((s) => ({
    id: s.id,
    assessmentTitle: s.assessment.title,
    assessmentType: s.assessment.type,
    subjectName: s.assessment.teacherAssignment.subject.name,
    score: s.score,
    maxScore: s.assessment.maxScore,
    date: s.assessment.assessmentDate,
  }));

  const publishedReportCards = publishedReports.map((r) => ({
    id: r.id,
    academicYearName: r.academicYear.name,
    classroomName: r.classroom.name,
    semester: r.semester,
    publishedAt: r.publishedAt,
    notes: r.notes,
  }));

  return {
    latestPublishedReportCard,
    recentScores,
    publishedReportCards,
  };
}

/**
 * Mengambil detail snapshot raport resmi (Frozen Data) santri asuh.
 * Melempar error jika raport tidak berstatus PUBLISHED atau santri tidak terhubung.
 */
export async function getGuardianStudentReportCard(params: {
  sessionGuardianId: string;
  sessionInstitutionId: string;
  requestedStudentId: string;
  reportCardId: string;
}): Promise<FrozenReportCardSnapshot> {
  const { sessionGuardianId, sessionInstitutionId, requestedStudentId, reportCardId } = params;

  await assertGuardianStudentAccess({
    sessionGuardianId,
    sessionInstitutionId,
    requestedStudentId,
  });

  const report = await prisma.reportCard.findUnique({
    where: { id: reportCardId },
  });

  if (!report || report.institutionId !== sessionInstitutionId || report.studentId !== requestedStudentId) {
    throw new GuardianResourceNotFoundError("Buku raport tidak ditemukan untuk santri ini.");
  }

  // Proteksi DRAFT: Wali murid MUTLAK dilarang melihat raport yang masih DRAFT
  if (report.status !== "PUBLISHED") {
    throw new GuardianAccessDeniedError(
      requestedStudentId,
      sessionGuardianId,
      "Akses ditolak: Buku raport ini masih berupa draf internal dan belum diterbitkan resmi oleh pihak sekolah."
    );
  }

  if (!report.frozenData) {
    throw new GuardianResourceNotFoundError("Dokumen snapshot raport resmi belum tersedia.");
  }

  try {
    return JSON.parse(report.frozenData) as FrozenReportCardSnapshot;
  } catch {
    throw new Error("Gagal membaca dokumen snapshot raport.");
  }
}

/**
 * Mengambil capaian dan riwayat setoran tahfidz Al-Qur'an santri asuh.
 */
export async function getGuardianStudentTahfidz(params: {
  sessionGuardianId: string;
  sessionInstitutionId: string;
  requestedStudentId: string;
  limit?: number;
}): Promise<GuardianTahfidzSummary> {
  const { sessionGuardianId, sessionInstitutionId, requestedStudentId, limit } = params;

  await assertGuardianStudentAccess({
    sessionGuardianId,
    sessionInstitutionId,
    requestedStudentId,
  });

  const records = await prisma.tahfidzRecord.findMany({
    where: {
      studentId: requestedStudentId,
      institutionId: sessionInstitutionId,
    },
    orderBy: {
      date: "desc",
    },
  });

  let totalZiyadahAyat = 0;
  let totalMurajaahAyat = 0;

  for (const rec of records) {
    const verseCount = Math.max(1, rec.endAyah - rec.startAyah + 1);
    if (rec.type === "SETORAN") {
      totalZiyadahAyat += verseCount;
    } else {
      totalMurajaahAyat += verseCount;
    }
  }

  const latest = records[0];
  let lastRecord: GuardianTahfidzSummary["lastRecord"] = null;

  if (latest) {
    const surahMeta = QURAN_SURAHS[latest.surah];
    lastRecord = {
      surahNumber: latest.surah,
      surahName: latest.surahName || (surahMeta ? surahMeta.name : `Surah ke-${latest.surah}`),
      startAyah: latest.startAyah,
      endAyah: latest.endAyah,
      type: latest.type,
      quality: latest.quality,
      date: latest.date,
      note: latest.note,
    };
  }

  const targetRecords = limit ? records.slice(0, limit) : records;
  const recentRecords = targetRecords.map((r) => {
    const surahMeta = QURAN_SURAHS[r.surah];
    return {
      id: r.id,
      date: r.date,
      surahNumber: r.surah,
      surahName: r.surahName || (surahMeta ? surahMeta.name : `Surah ke-${r.surah}`),
      startAyah: r.startAyah,
      endAyah: r.endAyah,
      type: r.type,
      quality: r.quality,
      note: r.note,
    };
  });

  return {
    totalRecords: records.length,
    totalZiyadahAyat,
    totalMurajaahAyat,
    lastRecord,
    recentRecords,
  };
}

/**
 * Mengambil informasi penempatan kamar asrama santri asuh dan kehadiran living jika tinggal di asrama.
 * Jika santri tidak mukim / tidak memiliki penempatan aktif, mengembalikan isResident: false.
 */
export async function getGuardianStudentDormitory(params: {
  sessionGuardianId: string;
  sessionInstitutionId: string;
  requestedStudentId: string;
  limitAttendance?: number;
}): Promise<GuardianDormitorySummary> {
  const { sessionGuardianId, sessionInstitutionId, requestedStudentId, limitAttendance } = params;

  await assertGuardianStudentAccess({
    sessionGuardianId,
    sessionInstitutionId,
    requestedStudentId,
  });

  const assignment = await prisma.studentDormitoryAssignment.findFirst({
    where: {
      studentId: requestedStudentId,
      institutionId: sessionInstitutionId,
      status: "ACTIVE",
    },
    include: {
      room: {
        include: {
          dormitory: true,
          assignments: {
            where: { status: "ACTIVE" },
          },
        },
      },
    },
  });

  if (!assignment) {
    return {
      isResident: false,
      assignment: null,
      recentLivingAttendance: [],
    };
  }

  // Ambil absensi living (asrama) santri ini
  const livingAttendance = await prisma.attendanceRecord.findMany({
    where: {
      studentId: requestedStudentId,
      institutionId: sessionInstitutionId,
      session: {
        context: "LIVING",
      },
    },
    include: {
      session: true,
    },
    orderBy: {
      session: {
        attendanceDate: "desc",
      },
    },
    take: limitAttendance || 10,
  });

  const recentLivingAttendance = livingAttendance.map((la) => ({
    id: la.id,
    date: la.session.attendanceDate,
    status: la.status,
    note: la.note,
  }));

  return {
    isResident: true,
    assignment: {
      dormitoryName: assignment.room.dormitory.name,
      roomName: assignment.room.name,
      status: assignment.status,
      startDate: assignment.startDate,
      capacity: assignment.room.capacity,
      currentOccupants: assignment.room.assignments.length,
    },
    recentLivingAttendance,
  };
}

/**
 * Mengambil riwayat pesan notifikasi WhatsApp resmi yang ditujukan kepada nomor telepon wali murid.
 */
export async function getGuardianNotifications(params: {
  sessionGuardianId: string;
  sessionInstitutionId: string;
  phoneWa: string;
  limit?: number;
}): Promise<GuardianNotificationItem[]> {
  const { sessionGuardianId, sessionInstitutionId, phoneWa, limit } = params;

  // Verifikasi wali
  const guardian = await prisma.guardian.findUnique({
    where: { id: sessionGuardianId },
    select: { id: true, institutionId: true, phoneWa: true },
  });

  if (!guardian || guardian.institutionId !== sessionInstitutionId) {
    throw new GuardianAccessDeniedError(
      "UNKNOWN",
      sessionGuardianId,
      "Identitas wali murid tidak cocok dengan sesi aktif."
    );
  }

  // Bersihkan format nomor WA
  const cleanPhone = phoneWa.replace(/\D/g, "");

  const notifications = await prisma.notificationOutbox.findMany({
    where: {
      institutionId: sessionInstitutionId,
      OR: [
        { recipient: phoneWa },
        { recipient: cleanPhone },
        { recipient: { contains: cleanPhone.slice(-8) } }, // Fallback prefix 62 / 08
      ],
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit || 50,
  });

  return notifications.map((n) => {
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(n.payloadJson);
    } catch {
      payload = {};
    }

    return {
      id: n.id,
      templateKey: n.templateKey,
      channel: n.channel,
      recipient: n.recipient,
      payload,
      status: n.status,
      createdAt: n.createdAt,
    };
  });
}
