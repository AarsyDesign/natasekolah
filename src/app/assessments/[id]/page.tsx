"use client";

import { useState, useEffect, useTransition, use } from "react";
import Link from "next/link";
import { NavHeader } from "@/components/nav-header";
import {
  getAssessmentRosterAction,
  recordBatchScoresAction,
} from "@/actions/formal-academic";
import {
  FileCheck2,
  ArrowLeft,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

export default function AssessmentScoringPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const assessmentId = resolvedParams.id;

  const [loading, setLoading] = useState(true);
  const [assessmentInfo, setAssessmentInfo] = useState<any>(null);
  const [roster, setRoster] = useState<Array<any>>([]);
  const [scoresMap, setScoresMap] = useState<Record<string, number | "">>({});
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});

  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getAssessmentRosterAction(assessmentId);
      if (res.success && res.data) {
        setAssessmentInfo(res.data.assessment);
        setRoster(res.data.roster);

        const initialScores: Record<string, number | ""> = {};
        const initialNotes: Record<string, string> = {};
        for (const item of res.data.roster) {
          initialScores[item.studentId] = item.score !== null ? item.score : "";
          initialNotes[item.studentId] = item.note || "";
        }
        setScoresMap(initialScores);
        setNotesMap(initialNotes);
      } else {
        setMessage({ text: res.error || "Gagal memuat roster penilaian.", type: "error" });
      }
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [assessmentId]);

  const handleScoreChange = (studentId: string, val: string) => {
    if (val === "") {
      setScoresMap((prev) => ({ ...prev, [studentId]: "" }));
      return;
    }
    const num = Number(val);
    if (!isNaN(num)) {
      setScoresMap((prev) => ({ ...prev, [studentId]: num }));
    }
  };

  const handleNoteChange = (studentId: string, val: string) => {
    setNotesMap((prev) => ({ ...prev, [studentId]: val }));
  };

  const handleSaveAll = () => {
    const scoresToSubmit: Array<{ studentId: string; score: number; note?: string }> = [];

    for (const item of roster) {
      const val = scoresMap[item.studentId];
      if (val !== "" && val !== undefined && val !== null) {
        scoresToSubmit.push({
          studentId: item.studentId,
          score: Number(val),
          note: notesMap[item.studentId] || undefined,
        });
      }
    }

    if (scoresToSubmit.length === 0) {
      setMessage({ text: "Masukkan minimal satu nilai untuk disimpan.", type: "error" });
      return;
    }

    startTransition(async () => {
      const res = await recordBatchScoresAction({
        assessmentId,
        scores: scoresToSubmit,
      });

      if (res.success) {
        setMessage({
          text: `Berhasil menyimpan nilai untuk ${res.data?.updatedCount || scoresToSubmit.length} siswa!`,
          type: "success",
        });
        loadData();
      } else {
        setMessage({ text: res.error || "Gagal menyimpan nilai", type: "error" });
      }
    });
  };

  const filledCount = Object.values(scoresMap).filter((v) => v !== "" && v !== undefined).length;

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 pb-20">
      <NavHeader subtitle="Input Nilai Siswa" />

      <main className="mx-auto max-w-5xl px-4 pt-6 sm:px-6 lg:px-8">
        {/* Navigation & Header */}
        <div className="flex items-center gap-3">
          <Link
            href="/assessments"
            className="touch-target inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white p-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-stone-900 sm:text-2xl flex items-center gap-2">
              <FileCheck2 className="h-6 w-6 text-teal-700" />
              {assessmentInfo ? assessmentInfo.title : "Input Nilai Penilaian"}
            </h1>
            {assessmentInfo && (
              <p className="text-xs text-stone-600 mt-0.5">
                {assessmentInfo.subjectName} • {assessmentInfo.classroomName} • Skor Maks:{" "}
                <span className="font-semibold text-stone-800">{assessmentInfo.maxScore}</span>
              </p>
            )}
          </div>
        </div>

        {/* Feedback message */}
        {message && (
          <div
            className={`mt-4 rounded-xl p-4 text-sm font-medium ${
              message.type === "success"
                ? "bg-teal-50 text-teal-800 border border-teal-200"
                : "bg-rose-50 text-rose-800 border border-rose-200"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Sticky Action Toolbar */}
        <div className="sticky top-20 z-20 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white/95 p-4 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-semibold text-stone-800">
              Terisi: <span className="text-teal-700 font-bold">{filledCount}</span> / {roster.length} Siswa
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="touch-target inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Reset
            </button>

            <button
              onClick={handleSaveAll}
              disabled={isPending || loading}
              className="touch-target inline-flex items-center gap-2 rounded-xl bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50 transition"
            >
              <Save className="h-4 w-4" />
              {isPending ? "Menyimpan..." : "Simpan Semua Nilai"}
            </button>
          </div>
        </div>

        {/* Roster Table */}
        <div className="mt-4 rounded-2xl border border-stone-200 bg-white shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-stone-500">
              <RefreshCw className="mx-auto h-8 w-8 animate-spin text-teal-700" />
              <p className="mt-3 text-sm">Memuat roster siswa...</p>
            </div>
          ) : roster.length === 0 ? (
            <div className="p-12 text-center text-stone-500">
              <AlertCircle className="mx-auto h-8 w-8 text-amber-600" />
              <p className="mt-3 text-sm font-semibold text-stone-800">Tidak ada siswa terdaftar</p>
              <p className="text-xs text-stone-500 mt-1">
                Pastikan rombel ini telah memiliki siswa aktif dengan pendaftaran (Enrollment).
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-stone-200 bg-stone-50 text-xs font-bold uppercase text-stone-500">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">No</th>
                    <th className="py-3 px-4">Nama Siswa</th>
                    <th className="py-3 px-4 w-28">NIS</th>
                    <th className="py-3 px-4 w-36">Nilai (0 - {assessmentInfo?.maxScore || 100})</th>
                    <th className="py-3 px-4">Catatan / Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {roster.map((item, idx) => {
                    const currentScore = scoresMap[item.studentId];
                    const isGraded = currentScore !== "" && currentScore !== undefined;

                    return (
                      <tr
                        key={item.studentId}
                        className={`hover:bg-stone-50/80 transition ${
                          isGraded ? "bg-teal-50/20" : ""
                        }`}
                      >
                        <td className="py-3 px-4 text-center font-semibold text-xs text-stone-400">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4 font-semibold text-stone-900">
                          {item.fullName}
                          {isGraded && (
                            <span className="ml-2 inline-flex items-center text-teal-600 text-xs">
                              <CheckCircle2 className="h-3.5 w-3.5 inline" />
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs font-mono text-stone-600">
                          {item.nis}
                        </td>
                        <td className="py-2 px-4">
                          <input
                            type="number"
                            min={0}
                            max={assessmentInfo?.maxScore || 100}
                            step="any"
                            placeholder="0"
                            value={currentScore}
                            onChange={(e) => handleScoreChange(item.studentId, e.target.value)}
                            className="w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-semibold text-stone-900 focus:border-teal-600 focus:bg-white focus:outline-none"
                          />
                        </td>
                        <td className="py-2 px-4">
                          <input
                            type="text"
                            placeholder="Catatan guru (opsional)..."
                            value={notesMap[item.studentId] || ""}
                            onChange={(e) => handleNoteChange(item.studentId, e.target.value)}
                            className="w-full rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-700 focus:border-teal-600 focus:outline-none"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
