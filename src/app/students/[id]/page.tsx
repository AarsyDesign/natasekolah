"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { NavHeader } from "../../../components/nav-header";
import {
  getStudentByIdAction,
  getAcademicYearsAction,
  getClassroomsAction,
  enrollStudentAction,
  archiveStudentAction,
} from "../../../actions/academic";
import {
  getStudentProfileClustersAction,
  upsertStudentClusterAction,
} from "../../../actions/student-profile";
import {
  ArrowLeft,
  Calendar,
  School,
  History,
  ShieldCheck,
  UserCheck,
  AlertCircle,
  Clock,
  Archive,
  PlusCircle,
  X,
  Users,
  HeartPulse,
  FolderCog,
  Save,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Phase 9.3 — Kluster Student Full Profile (Dapodik/EMIS)
// ---------------------------------------------------------------------------

type ClusterKey = "FAMILY" | "HEALTH" | "REGISTRY";
type FieldDef = {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "textarea" | "checkbox";
  options?: readonly string[];
  placeholder?: string;
};

const BLOOD_TYPES = ["A", "B", "AB", "O"] as const;
const DISABILITY_TYPES = [
  "NETRA",
  "RUNGU",
  "GRAHITA",
  "WICARA",
  "INTELEKTUAL",
  "FISIK",
  "PSIKOSOSIAL",
  "LAINNYA",
] as const;
const NATIONALITIES = ["WNI", "WNA"] as const;

const CLUSTER_FIELDS: Record<ClusterKey, FieldDef[]> = {
  FAMILY: [
    { key: "fatherName", label: "Nama Ayah", type: "text" },
    { key: "fatherNik", label: "NIK Ayah", type: "text", placeholder: "16 digit" },
    { key: "fatherPhone", label: "Telepon Ayah", type: "text", placeholder: "0812…" },
    { key: "fatherOccupation", label: "Pekerjaan Ayah", type: "text" },
    { key: "motherName", label: "Nama Ibu", type: "text" },
    { key: "motherNik", label: "NIK Ibu", type: "text", placeholder: "16 digit" },
    { key: "motherPhone", label: "Telepon Ibu", type: "text", placeholder: "0812…" },
    { key: "motherOccupation", label: "Pekerjaan Ibu", type: "text" },
    { key: "parentAddress", label: "Alamat Orang Tua", type: "textarea" },
    { key: "emergencyContactName", label: "Nama Kontak Darurat", type: "text" },
    { key: "emergencyContactPhone", label: "Telepon Kontak Darurat", type: "text", placeholder: "0812…" },
    { key: "emergencyContactRelation", label: "Hubungan dgn Siswa", type: "text", placeholder: "Paman, Bibi, …" },
  ],
  HEALTH: [
    { key: "bloodType", label: "Golongan Darah", type: "select", options: BLOOD_TYPES },
    { key: "heightCm", label: "Tinggi Badan (cm)", type: "number" },
    { key: "weightKg", label: "Berat Badan (kg)", type: "number" },
    { key: "hasDisability", label: "Memiliki Disabilitas", type: "checkbox" },
    { key: "disabilityType", label: "Jenis Disabilitas", type: "select", options: DISABILITY_TYPES },
    { key: "disabilityNotes", label: "Keterangan Disabilitas", type: "textarea" },
    { key: "chronicIllness", label: "Penyakit Menahun", type: "text" },
    { key: "allergies", label: "Riwayat Alergi", type: "text" },
    { key: "lastCheckupAt", label: "Terakhir Medical Check-up", type: "date" },
    { key: "healthNotes", label: "Catatan Kesehatan", type: "textarea" },
  ],
  REGISTRY: [
    { key: "familyCardNo", label: "Nomor Kartu Keluarga", type: "text", placeholder: "16 digit" },
    { key: "birthCertificateNo", label: "Nomor Akta Kelahiran", type: "text" },
    { key: "bpjsNumber", label: "Nomor BPJS / KIS", type: "text" },
    { key: "bpjsProvider", label: "Provider BPJS", type: "text" },
    { key: "sktmNumber", label: "Nomor SKTM", type: "text" },
    { key: "nationality", label: "Kewarganegaraan", type: "select", options: NATIONALITIES },
    { key: "previousSchool", label: "Asal Sekolah (Mutasi Masuk)", type: "text" },
    { key: "registryNotes", label: "Catatan Registry", type: "textarea" },
  ],
};

function buildInitialForm(cluster: ClusterKey): Record<string, any> {
  const state: Record<string, any> = {};
  for (const f of CLUSTER_FIELDS[cluster]) {
    if (f.type === "checkbox") state[f.key] = false;
    else if (f.type === "date") state[f.key] = "";
    else if (f.type === "number") state[f.key] = "";
    else state[f.key] = "";
  }
  return state;
}

function hydrateForm(cluster: ClusterKey, row: any): Record<string, any> {
  const state = buildInitialForm(cluster);
  if (!row) return state;
  for (const f of CLUSTER_FIELDS[cluster]) {
    const v = row[f.key];
    if (f.type === "checkbox") state[f.key] = v === true;
    else if (f.type === "date") state[f.key] = v ? String(v).slice(0, 10) : "";
    else state[f.key] = v === null || v === undefined ? "" : String(v);
  }
  return state;
}

function buildPayload(cluster: ClusterKey, form: Record<string, any>): Record<string, any> {
  const data: Record<string, any> = {};
  for (const f of CLUSTER_FIELDS[cluster]) {
    const raw = form[f.key];
    if (f.type === "checkbox") {
      data[f.key] = raw === true;
      continue;
    }
    if (f.type === "number") {
      data[f.key] = raw === "" || raw === null || raw === undefined ? null : Number(raw);
      continue;
    }
    if (f.type === "date") {
      data[f.key] = raw === "" || raw === null || raw === undefined ? null : new Date(raw);
      continue;
    }
    const trimmed = typeof raw === "string" ? raw.trim() : raw;
    data[f.key] = trimmed === "" || trimmed === undefined ? null : trimmed;
  }
  if (cluster === "HEALTH" && !data.hasDisability) data.disabilityType = null;
  return data;
}

function ClusterForm({
  studentId,
  cluster,
  initialRow,
  canEdit,
  onSaved,
}: {
  studentId: string;
  cluster: ClusterKey;
  initialRow: any;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Record<string, any>>(() =>
    hydrateForm(cluster, initialRow)
  );
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  useEffect(() => {
    setForm(hydrateForm(cluster, initialRow));
    setFeedback(null);
  }, [cluster, initialRow]);

  const setField = (key: string, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSaving(true);
    (async () => {
      const res = await upsertStudentClusterAction({
        studentId,
        cluster,
        data: buildPayload(cluster, form),
      });
      setSaving(false);
      if (res.success) {
        setFeedback({ type: "ok", msg: "Data tersimpan." });
        onSaved();
      } else {
        setFeedback({ type: "err", msg: res.error || "Gagal menyimpan data." });
      }
    })();
  };

  const fields = CLUSTER_FIELDS[cluster];

  if (!canEdit) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs sm:p-8">
        {initialRow ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.key}>
                <div className="text-xs text-stone-500">{f.label}</div>
                <div className="mt-1 text-sm font-medium text-stone-800">
                  {f.type === "checkbox"
                    ? initialRow[f.key]
                      ? "Ya"
                      : "Tidak"
                    : initialRow[f.key] ?? "-"}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-stone-400">
            Belum ada data cluster ini. (Butuh izin student:edit untuk mengisi.)
          </div>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs sm:p-8"
    >
      {feedback && (
        <div
          className={`mb-4 rounded-lg p-3 text-xs ${
            feedback.type === "ok"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {feedback.msg}
        </div>
      )}

      {!initialRow && (
        <p className="mb-4 text-xs text-stone-500">
          Belum ada data tersimpan untuk cluster ini — isi form lalu tekan Simpan.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((f) => {
          if (f.type === "checkbox") {
            return (
              <label
                key={f.key}
                className="flex items-center gap-2 text-sm font-medium text-stone-700 sm:col-span-2"
              >
                <input
                  type="checkbox"
                  checked={form[f.key] === true}
                  onChange={(e) => setField(f.key, e.target.checked)}
                  className="h-4 w-4 rounded border-stone-300 text-teal-700 focus:ring-teal-700"
                />
                <span>{f.label}</span>
              </label>
            );
          }
          return (
            <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
              <label className="block text-xs font-semibold text-stone-700">{f.label}</label>
              {f.type === "select" ? (
                <select
                  value={form[f.key] ?? ""}
                  onChange={(e) => setField(f.key, e.target.value)}
                  className="touch-target mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-700 focus:outline-none"
                >
                  <option value="">— Pilih —</option>
                  {f.options?.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  value={form[f.key] ?? ""}
                  onChange={(e) => setField(f.key, e.target.value)}
                  rows={3}
                  placeholder={f.placeholder}
                  className="touch-target mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-700 focus:outline-none"
                />
              ) : (
                <input
                  type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                  value={form[f.key] ?? ""}
                  onChange={(e) => setField(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="touch-target mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-700 focus:outline-none"
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex justify-end border-t border-stone-100 pt-4">
        <button
          type="submit"
          disabled={saving}
          className="touch-target inline-flex items-center gap-1.5 rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? "Menyimpan..." : "Simpan Cluster"}
        </button>
      </div>
    </form>
  );
}

/** Tab navigasi kluster profil (Phase 9.3). */
const PROFILE_TABS = [
  { key: "profil", label: "Profil Inti", icon: School },
  { key: "FAMILY", label: "Keluarga", icon: Users },
  { key: "HEALTH", label: "Kesehatan", icon: HeartPulse },
  { key: "REGISTRY", label: "Registry", icon: FolderCog },
] as const;

export default function StudentDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [student, setStudent] = useState<any>(null);
  const [currentEnrollment, setCurrentEnrollment] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Enroll modal state
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [selectedYearId, setSelectedYearId] = useState("");
  const [selectedClassroomId, setSelectedClassroomId] = useState("");
  const [enrollError, setEnrollError] = useState<string | null>(null);

  // Archive modal state
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [archiveStatus, setArchiveStatus] = useState("GRADUATED");

  // Student Full Profile clusters (Phase 9.3)
  const [profile, setProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>("profil");

  const [isPending, startTransition] = useTransition();

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getStudentByIdAction(id);
      if (res.success && res.data) {
        setStudent(res.data.student);
        setCurrentEnrollment(res.data.currentEnrollment);
        setHistory(res.data.history);
      } else {
        setError(res.error || "Gagal memuat profil siswa.");
      }

      // Kluster Student Full Profile (Phase 9.3)
      const profRes = await getStudentProfileClustersAction(id);
      if (profRes.success && profRes.data) {
        setProfile(profRes.data);
      } else {
        setProfile(null);
      }

      // Load years and classrooms for enrollment modal
      const [yearsRes, roomsRes] = await Promise.all([
        getAcademicYearsAction(),
        getClassroomsAction(),
      ]);

      if (yearsRes.success && yearsRes.data) {
        setAcademicYears(yearsRes.data);
        const active = yearsRes.data.find((y: any) => y.isActive);
        if (active) setSelectedYearId(active.id);
      }
      if (roomsRes.success && roomsRes.data) {
        setClassrooms(roomsRes.data);
      }
    } catch {
      setError("Terjadi kesalahan sistem.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleEnrollSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEnrollError(null);

    startTransition(async () => {
      const res = await enrollStudentAction({
        studentId: id,
        academicYearId: selectedYearId,
        classroomId: selectedClassroomId,
        status: "ENROLLED",
      });

      if (res.success) {
        setIsEnrollModalOpen(false);
        loadData();
      } else {
        setEnrollError(res.error || "Gagal melakukan enrollment.");
      }
    });
  };

  const handleArchiveSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    startTransition(async () => {
      const res = await archiveStudentAction(id, {
        status: archiveStatus,
      });

      if (res.success) {
        setIsArchiveModalOpen(false);
        loadData();
      } else {
        alert(res.error || "Gagal mengubah status.");
      }
    });
  };

  const filteredClassrooms = classrooms.filter(
    (c) => c.academicYearId === selectedYearId
  );

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <NavHeader subtitle="Profil Buku Induk" />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/students"
            className="touch-target inline-flex items-center gap-2 text-xs font-semibold text-stone-600 hover:text-stone-900"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali ke Buku Induk</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsArchiveModalOpen(true)}
              className="touch-target inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
            >
              <Archive className="h-3.5 w-3.5 text-stone-500" />
              <span>Ubah Status / Arsip</span>
            </button>

            <button
              onClick={() => setIsEnrollModalOpen(true)}
              className="touch-target inline-flex items-center gap-1.5 rounded-lg bg-teal-800 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-teal-700"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>Penempatan Rombel</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-stone-200 bg-white p-8 text-center shadow-xs">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-800 border-t-transparent" />
            <p className="mt-3 text-sm text-stone-500">Memuat profil siswa...</p>
          </div>
        ) : !student ? (
          <div className="rounded-xl border border-stone-200 bg-white p-8 text-center">
            <p className="text-sm text-stone-500">Siswa tidak ditemukan.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header Identity Card */}
            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold tracking-tight text-stone-900">
                      {student.fullName}
                    </h1>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        student.status === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-stone-100 text-stone-700"
                      }`}
                    >
                      {student.status}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-600">
                    <div>
                      NIS: <span className="font-mono font-semibold text-stone-900">{student.nis}</span>
                    </div>
                    {student.nisn && (
                      <div>
                        NISN: <span className="font-mono font-semibold text-stone-900">{student.nisn}</span>
                      </div>
                    )}
                    {student.nik && (
                      <div>
                        NIK: <span className="font-mono text-stone-700">{student.nik}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Banner Status Rombel Saat Ini */}
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-left sm:text-right">
                  <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                    Rombel Tahun Aktif
                  </div>
                  {currentEnrollment?.classroom ? (
                    <div className="mt-1">
                      <span className="text-lg font-bold text-teal-800">
                        {currentEnrollment.classroom.name}
                      </span>
                      <div className="text-xs text-stone-500">
                        {currentEnrollment.academicYear.name}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 text-xs italic text-stone-400">
                      Belum terdaftar di rombel tahun ini
                    </div>
                  )}
                </div>
              </div>

              {/* Biodata details grid */}
              <div className="mt-6 grid grid-cols-1 gap-4 border-t border-stone-100 pt-6 sm:grid-cols-3">
                <div>
                  <div className="text-xs text-stone-500">Jenis Kelamin</div>
                  <div className="mt-1 text-sm font-medium text-stone-800">
                    {student.gender === "L" ? "Laki-laki" : "Perempuan"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-stone-500">Tempat, Tanggal Lahir</div>
                  <div className="mt-1 text-sm font-medium text-stone-800">
                    {student.birthPlace || "-"}
                    {student.birthDate
                      ? `, ${new Date(student.birthDate).toLocaleDateString("id-ID")}`
                      : ""}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-stone-500">Alamat Rumah</div>
                  <div className="mt-1 text-sm font-medium text-stone-800">
                    {student.address || "-"}
                  </div>
                </div>
              </div>
            </div>

            {/* Tab Navigasi Kluster Profil (Phase 9.3) */}
            <div className="flex gap-1 overflow-x-auto border-b border-stone-200 pb-px">
              {PROFILE_TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={`touch-target inline-flex shrink-0 items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 text-xs font-semibold transition ${
                    activeTab === t.key
                      ? "border-teal-800 bg-teal-50/60 text-teal-800"
                      : "border-transparent text-stone-500 hover:text-stone-800"
                  }`}
                >
                  <t.icon className="h-4 w-4" />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {activeTab === "profil" && (
            <>
            {/* Sacred History: Riwayat Penempatan Kelas (Enrollment History) */}
            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs sm:p-8">
              <div className="flex items-center gap-2 border-b border-stone-100 pb-4">
                <History className="h-5 w-5 text-teal-800" />
                <div>
                  <h2 className="text-base font-bold text-stone-900">
                    Histori Penempatan Kelas (Sacred History)
                  </h2>
                  <p className="text-xs text-stone-500">
                    Rekam jejak akademik abadi per tahun ajaran yang tidak pernah tertimpa saat naik kelas.
                  </p>
                </div>
              </div>

              {history.length === 0 ? (
                <div className="py-8 text-center text-sm text-stone-400">
                  Belum ada catatan enrollment tersimpan untuk siswa ini.
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {history.map((record) => (
                    <div
                      key={record.id}
                      className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-stone-50/70 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-800/10 text-teal-800">
                          <School className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-semibold text-stone-900">
                            {record.classroom.name}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-stone-500">
                            <Calendar className="h-3.5 w-3.5 text-stone-400" />
                            <span>Tahun Ajaran {record.academicYear.name}</span>
                            {record.academicYear.isActive && (
                              <span className="rounded bg-teal-100 px-1.5 py-0.2 text-[10px] font-semibold text-teal-800">
                                Aktif
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        <span className="rounded-full bg-stone-200/70 px-2.5 py-0.5 font-medium text-stone-700">
                          {record.status}
                        </span>
                        <span className="text-stone-400">
                          Terdaftar: {new Date(record.enrolledAt).toLocaleDateString("id-ID")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            </>
            )}

            {activeTab === "FAMILY" && (
              <ClusterForm
                studentId={id}
                cluster="FAMILY"
                initialRow={profile?.family ?? null}
                canEdit={profile?.canEdit === true}
                onSaved={loadData}
              />
            )}
            {activeTab === "HEALTH" && (
              <ClusterForm
                studentId={id}
                cluster="HEALTH"
                initialRow={profile?.health ?? null}
                canEdit={profile?.canEdit === true}
                onSaved={loadData}
              />
            )}
            {activeTab === "REGISTRY" && (
              <ClusterForm
                studentId={id}
                cluster="REGISTRY"
                initialRow={profile?.registry ?? null}
                canEdit={profile?.canEdit === true}
                onSaved={loadData}
              />
            )}
          </div>
        )}
      </main>

      {/* Modal Enroll Siswa */}
      {isEnrollModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-base font-bold text-stone-900">Penempatan Rombel Baru</h3>
              <button
                onClick={() => setIsEnrollModalOpen(false)}
                className="touch-target rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {enrollError && (
              <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">
                {enrollError}
              </div>
            )}

            <form onSubmit={handleEnrollSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700">Tahun Ajaran *</label>
                <select
                  value={selectedYearId}
                  onChange={(e) => {
                    setSelectedYearId(e.target.value);
                    setSelectedClassroomId("");
                  }}
                  className="touch-target mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-700 focus:outline-none"
                >
                  <option value="">Pilih Tahun Ajaran...</option>
                  {academicYears.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name} {y.isActive ? "(Aktif)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700">
                  Rombongan Belajar (Kelas) *
                </label>
                <select
                  required
                  value={selectedClassroomId}
                  onChange={(e) => setSelectedClassroomId(e.target.value)}
                  className="touch-target mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-700 focus:outline-none"
                  disabled={!selectedYearId}
                >
                  <option value="">Pilih Rombel...</option>
                  {filteredClassrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.gradeLevel ? `(Tingkat ${c.gradeLevel})` : ""}
                    </option>
                  ))}
                </select>
                {filteredClassrooms.length === 0 && selectedYearId && (
                  <p className="mt-1 text-xs text-amber-600">
                    Belum ada rombel pada tahun ajaran ini. Tambahkan rombel terlebih dahulu di menu Rombongan Belajar.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-stone-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEnrollModalOpen(false)}
                  className="touch-target rounded-lg border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending || !selectedClassroomId}
                  className="touch-target rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {isPending ? "Menyimpan..." : "Daftarkan ke Rombel"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ubah Status / Arsip */}
      {isArchiveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-stone-900">Ubah Status Siswa</h3>
            <p className="mt-1 text-xs text-stone-500">
              Perubahan status mempertahankan seluruh histori rombel dan pembayaran siswa secara abadi.
            </p>

            <form onSubmit={handleArchiveSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700">Pilih Status Baru</label>
                <select
                  value={archiveStatus}
                  onChange={(e) => setArchiveStatus(e.target.value)}
                  className="touch-target mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-700 focus:outline-none"
                >
                  <option value="ACTIVE">Aktif (ACTIVE)</option>
                  <option value="GRADUATED">Lulus (GRADUATED)</option>
                  <option value="TRANSFERRED">Pindah / Mutasi (TRANSFERRED)</option>
                  <option value="ALUMNI">Alumni (ALUMNI)</option>
                  <option value="INACTIVE">Nonaktif (INACTIVE)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-stone-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsArchiveModalOpen(false)}
                  className="touch-target rounded-lg border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="touch-target rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {isPending ? "Memproses..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
