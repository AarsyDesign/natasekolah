import { prisma } from "../prisma";
import type { TenantContext } from "../tenant/context";
import { calculateLetterGrade } from "./types";

export interface SubjectAssessmentScoreItem {
  assessmentId: string;
  title: string;
  type: string;
  score: number;
  maxScore: number;
  assessmentDate: Date;
}

export interface SubjectGradeResult {
  subjectId: string;
  subjectCode: string | null;
  subjectName: string;
  totalAssessments: number;
  completedAssessments: number;
  finalScore: number;
  letterGrade: "A" | "B" | "C" | "D";
  scores: SubjectAssessmentScoreItem[];
}

export interface IGradeCalculationStrategy {
  calculate(scores: Array<{ score: number; maxScore: number; type: string }>): {
    finalScore: number;
    letterGrade: "A" | "B" | "C" | "D";
  };
}

export class StandardAverageStrategy implements IGradeCalculationStrategy {
  calculate(scores: Array<{ score: number; maxScore: number; type: string }>): {
    finalScore: number;
    letterGrade: "A" | "B" | "C" | "D";
  } {
    if (scores.length === 0) {
      return { finalScore: 0, letterGrade: "D" };
    }

    // Normalisasi setiap nilai ke skala 100
    const normalizedSum = scores.reduce((sum, item) => {
      const normalized = (item.score / (item.maxScore || 100)) * 100;
      return sum + normalized;
    }, 0);

    const rawAverage = normalizedSum / scores.length;
    const finalScore = Math.round(rawAverage * 100) / 100; // 2 decimal places

    return {
      finalScore,
      letterGrade: calculateLetterGrade(finalScore),
    };
  }
}

const defaultStrategy = new StandardAverageStrategy();

/**
 * Menghitung rekapitulasi nilai per mata pelajaran untuk seorang siswa pada enrollment tertentu.
 */
export async function calculateStudentSubjectGrades(
  ctx: TenantContext,
  params: {
    studentId: string;
    enrollmentId: string;
    classroomId: string;
    academicYearId: string;
  },
  strategy: IGradeCalculationStrategy = defaultStrategy,
  txPrisma?: typeof prisma
): Promise<SubjectGradeResult[]> {
  const db = txPrisma || prisma;

  // 1. Ambil seluruh penugasan guru di rombel dan tahun ajaran ini
  const assignments = await db.teacherAssignment.findMany({
    where: {
      institutionId: ctx.institutionId,
      classroomId: params.classroomId,
      academicYearId: params.academicYearId,
    },
    include: {
      subject: true,
      assessments: {
        where: {
          institutionId: ctx.institutionId,
        },
        include: {
          scores: {
            where: {
              institutionId: ctx.institutionId,
              studentId: params.studentId,
              enrollmentId: params.enrollmentId,
            },
          },
        },
      },
    },
    orderBy: {
      subject: {
        name: "asc",
      },
    },
  });

  // 2. Kelompokkan penugasan dan assessment berdasarkan subjectId
  const subjectMap = new Map<
    string,
    {
      subject: { id: string; name: string; code: string | null };
      assessments: any[];
    }
  >();

  for (const assign of assignments) {
    if (!subjectMap.has(assign.subject.id)) {
      subjectMap.set(assign.subject.id, {
        subject: assign.subject,
        assessments: [],
      });
    }
    const group = subjectMap.get(assign.subject.id)!;
    group.assessments.push(...assign.assessments);
  }

  const results: SubjectGradeResult[] = [];

  for (const group of subjectMap.values()) {
    const scoredList: SubjectAssessmentScoreItem[] = [];
    const calcInputs: Array<{ score: number; maxScore: number; type: string }> = [];

    for (const assess of group.assessments) {
      const studentScore = assess.scores.find(
        (s: any) => s.studentId === params.studentId
      );
      if (studentScore) {
        scoredList.push({
          assessmentId: assess.id,
          title: assess.title,
          type: assess.type,
          score: studentScore.score,
          maxScore: assess.maxScore,
          assessmentDate: assess.assessmentDate,
        });
        calcInputs.push({
          score: studentScore.score,
          maxScore: assess.maxScore,
          type: assess.type,
        });
      }
    }

    const { finalScore, letterGrade } = strategy.calculate(calcInputs);

    results.push({
      subjectId: group.subject.id,
      subjectCode: group.subject.code,
      subjectName: group.subject.name,
      totalAssessments: group.assessments.length,
      completedAssessments: scoredList.length,
      finalScore,
      letterGrade,
      scores: scoredList,
    });
  }

  return results;
}
