"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { NavHeader } from "@/components/nav-header";
import { listScoresAction, listAssessmentsAction } from "@/actions/formal-academic";
import {
  Award,
  Search,
  RefreshCw,
  FileCheck2,
  Calendar,
  Layers,
  ArrowRight,
} from "lucide-react";

export default function GradesOverviewPage() {
  const [scores, setScores] = useState<Array<any>>([]);
  const [assessments, setAssessments] = useState<Array<any>>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState("");
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [assessRes, scoreRes] = await Promise.all([
        listAssessmentsAction({ limit: 100 }),
        listScoresAction(selectedAssessmentId ? { assessmentId: selectedAssessmentId } : undefined),
      ]);

      if (assessRes.success && assessRes.data) {
        setAssessments(assessRes.data.items);
      }
      if (scoreRes.success && scoreRes.data) {
        setScores(scoreRes.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedAssessmentId]);

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 pb-16">
      <NavHeader subtitle="Rekap Nilai Siswa" />

      <main className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl flex items-center gap-3">
              <Award className="h-8 w-8 text-teal-700" />
              Rekapitulasi Nilai Siswa
            </h1>
            <p className="mt-1 text-sm text-stone-600">
              Audit data nilai hasil penilaian harian, kuis, dan ujian per siswa dan rombel.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/assessments"
              className="touch-target inline-flex items-center gap-2 rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 transition"
            >
              <FileCheck2 className="h-4 w-4" />
              Kelola Penilaian
            </Link>
          </div>
        </div>

        {/* Filter bar */}
        <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between border border-stone-200">
          <div className="flex-1">
            <select
              value={selectedAssessmentId}
              onChange={(e) => setSelectedAssessmentId(e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 focus:border-teal-600 focus:outline-none"
            >
              <option value="">Semua Penilaian Terakhir</option>
              {assessments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} ({a.teacherAssignment.subject.name} - {a.teacherAssignment.classroom.name})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="touch-target inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Table of Scores */}
        <div className="mt-6 rounded-2xl border border-stone-200 bg-white shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-stone-500">
              <RefreshCw className="mx-auto h-8 w-8 animate-spin text-teal-700" />
              <p className="mt-3 text-sm">Memuat rekap nilai...</p>
            </div>
          ) : scores.length === 0 ? (
            <div className="p-12 text-center text-stone-500">
              <Award className="mx-auto h-12 w-12 text-stone-400" />
              <h3 className="mt-3 text-base font-semibold text-stone-900">Belum ada nilai terekam</h3>
              <p className="mt-1 text-sm text-stone-500">
                Pilih penilaian dan input nilai siswa melalui menu Penilaian.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-stone-200 bg-stone-50 text-xs font-bold uppercase text-stone-500">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">No</th>
                    <th className="py-3 px-4">Siswa</th>
                    <th className="py-3 px-4">Penilaian</th>
                    <th className="py-3 px-4 w-28 text-center">Nilai</th>
                    <th className="py-3 px-4">Catatan</th>
                    <th className="py-3 px-4 w-32">Tanggal Catat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {scores.map((sc, idx) => (
                    <tr key={sc.id} className="hover:bg-stone-50/80 transition">
                      <td className="py-3 px-4 text-center font-semibold text-xs text-stone-400">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-stone-900">{sc.student.fullName}</div>
                        <div className="text-xs text-stone-500">NIS: {sc.student.nis}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-stone-800">{sc.assessment.title}</div>
                        <div className="text-xs text-stone-500">Maks: {sc.assessment.maxScore}</div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex rounded-lg bg-teal-50 px-2.5 py-1 text-sm font-bold text-teal-800 border border-teal-200">
                          {sc.score}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-stone-600">
                        {sc.note || "-"}
                      </td>
                      <td className="py-3 px-4 text-xs text-stone-500">
                        {new Date(sc.createdAt).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
