"use client";

import React, { useState, useEffect, useTransition } from "react";
import { NavHeader } from "../../components/nav-header";
import {
  getTeacherAssignmentsAction,
  createTeacherAssignmentAction,
  deleteTeacherAssignmentAction,
  getTeachersAction,
  getSubjectsAction,
} from "../../actions/teaching";
import {
  getAcademicYearsAction,
  getClassroomsAction,
} from "../../actions/academic";
import {
  Briefcase,
  Plus,
  Filter,
  Trash2,
  AlertCircle,
  X,
  GraduationCap,
  BookOpen,
  School,
  Calendar,
} from "lucide-react";

interface AssignmentItem {
  id: string;
  teacherId: string;
  subjectId: string;
  classroomId: string;
  academicYearId: string;
  createdAt: string | Date;
  teacher: {
    id: string;
    name: string;
    email: string | null;
  };
  subject: {
    id: string;
    name: string;
    code: string | null;
    category: string | null;
  };
  classroom: {
    id: string;
    name: string;
    gradeLevel: string | null;
  };
  academicYear: {
    id: string;
    name: string;
    isActive: boolean;
  };
}

export default function TeacherAssignmentsPage() {
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [classrooms, setClassrooms] = useState<any[]>([]);

  // Filters
  const [yearFilter, setYearFilter] = useState<string>("");
  const [teacherFilter, setTeacherFilter] = useState<string>("");
  const [subjectFilter, setSubjectFilter] = useState<string>("");
  const [classroomFilter, setClassroomFilter] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal create
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState({
    academicYearId: "",
    teacherId: "",
    subjectId: "",
    classroomId: "",
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Available classrooms filtered by selected academic year in create form
  const [formAvailableClassrooms, setFormAvailableClassrooms] = useState<any[]>([]);

  // Load dropdown references
  const loadReferenceData = async () => {
    try {
      const [yearsRes, teachersRes, subjectsRes, roomsRes] = await Promise.all([
        getAcademicYearsAction(),
        getTeachersAction(),
        getSubjectsAction({ isActive: true }),
        getClassroomsAction(),
      ]);

      if (yearsRes.success && yearsRes.data) {
        setAcademicYears(yearsRes.data);
        const activeYear = yearsRes.data.find((y: any) => y.isActive);
        if (activeYear && !yearFilter) {
          setYearFilter(activeYear.id);
          setFormData((prev) => ({ ...prev, academicYearId: activeYear.id }));
        }
      }

      if (teachersRes.success && teachersRes.data) {
        setTeachers(teachersRes.data);
      }

      if (subjectsRes.success && subjectsRes.data) {
        setSubjects(((subjectsRes.data as any).items || (subjectsRes.data as any).data || []) as any[]);
      }

      if (roomsRes.success && roomsRes.data) {
        setClassrooms(roomsRes.data);
      }
    } catch {
      // Handled silently for dropdowns
    }
  };

  const loadAssignments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getTeacherAssignmentsAction({
        academicYearId: yearFilter || undefined,
        teacherId: teacherFilter || undefined,
        subjectId: subjectFilter || undefined,
        classroomId: classroomFilter || undefined,
      });

      if (res.success && res.data) {
        setAssignments(((res.data as any).items || (res.data as any).data || []) as AssignmentItem[]);
      } else {
        setError(res.error || "Gagal memuat daftar penugasan mengajar.");
      }
    } catch {
      setError("Terjadi kesalahan jaringan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReferenceData();
  }, []);

  useEffect(() => {
    loadAssignments();
  }, [yearFilter, teacherFilter, subjectFilter, classroomFilter]);

  // Update classrooms available in modal when year changes
  useEffect(() => {
    if (formData.academicYearId) {
      const filtered = classrooms.filter(
        (c) => c.academicYearId === formData.academicYearId
      );
      setFormAvailableClassrooms(filtered);
      if (!filtered.some((c) => c.id === formData.classroomId)) {
        setFormData((prev) => ({ ...prev, classroomId: "" }));
      }
    } else {
      setFormAvailableClassrooms([]);
    }
  }, [formData.academicYearId, classrooms]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    startTransition(async () => {
      const res = await createTeacherAssignmentAction({
        academicYearId: formData.academicYearId,
        teacherId: formData.teacherId,
        subjectId: formData.subjectId,
        classroomId: formData.classroomId,
      });

      if (res.success) {
        setIsModalOpen(false);
        setFormData((prev) => ({
          ...prev,
          teacherId: "",
          subjectId: "",
          classroomId: "",
        }));
        loadAssignments();
      } else {
        setFormError(res.error || "Gagal menyimpan penugasan.");
      }
    });
  };

  const handleDelete = (id: string, teacherName: string, subjectName: string) => {
    if (!confirm(`Batalkan penugasan ${teacherName} mengajar ${subjectName}?`)) {
      return;
    }

    startTransition(async () => {
      const res = await deleteTeacherAssignmentAction(id);
      if (res.success) {
        loadAssignments();
      } else {
        alert(res.error || "Gagal menghapus penugasan.");
      }
    });
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <NavHeader subtitle="Distribusi Pengajar" />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
              Penugasan Mengajar (Teaching Assignment)
            </h1>
            <p className="mt-1 text-sm text-stone-500">
              Fondasi pemetaan guru pengampu mata pelajaran pada rombel dan tahun akademik resmi.
            </p>
          </div>

          <button
            onClick={() => {
              setFormError(null);
              setIsModalOpen(true);
            }}
            className="touch-target inline-flex items-center gap-2 rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-teal-700"
          >
            <Plus className="h-4 w-4" />
            <span>Tugaskan Guru</span>
          </button>
        </div>

        {/* Filter Matrix */}
        <div className="mb-6 rounded-xl border border-stone-200 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-stone-700">
            <Filter className="h-4 w-4 text-stone-400" />
            <span>Filter Penugasan:</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-[11px] font-medium text-stone-500 mb-1">Tahun Ajaran</label>
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="touch-target w-full rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-xs text-stone-800 focus:border-teal-700 focus:bg-white focus:outline-none"
              >
                <option value="">Semua Tahun Ajaran</option>
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name} {y.isActive ? "(Aktif)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-stone-500 mb-1">Guru Pengampu</label>
              <select
                value={teacherFilter}
                onChange={(e) => setTeacherFilter(e.target.value)}
                className="touch-target w-full rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-xs text-stone-800 focus:border-teal-700 focus:bg-white focus:outline-none"
              >
                <option value="">Semua Guru</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-stone-500 mb-1">Mata Pelajaran</label>
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="touch-target w-full rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-xs text-stone-800 focus:border-teal-700 focus:bg-white focus:outline-none"
              >
                <option value="">Semua Mapel</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.code ? `(${s.code})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-stone-500 mb-1">Rombel</label>
              <select
                value={classroomFilter}
                onChange={(e) => setClassroomFilter(e.target.value)}
                className="touch-target w-full rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-xs text-stone-800 focus:border-teal-700 focus:bg-white focus:outline-none"
              >
                <option value="">Semua Rombel</option>
                {classrooms
                  .filter((c) => !yearFilter || c.academicYearId === yearFilter)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
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
            <p className="mt-3 text-sm text-stone-500">Memuat data penugasan mengajar...</p>
          </div>
        ) : assignments.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center shadow-xs">
            <Briefcase className="h-12 w-12 text-stone-300" />
            <h3 className="mt-2 text-base font-semibold text-stone-800">Belum Ada Penugasan Mengajar</h3>
            <p className="mt-1 text-sm text-stone-500">
              Petakan dewan guru ke mata pelajaran dan rombel yang diajar.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="touch-target mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
            >
              <Plus className="h-4 w-4" />
              <span>Tugaskan Guru Sekarang</span>
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xs">
            <div className="divide-y divide-stone-100">
              {assignments.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between transition hover:bg-stone-50/70"
                >
                  <div className="flex items-start gap-3 sm:items-center">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-800/10 text-teal-800">
                      <GraduationCap className="h-5 w-5" />
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-stone-900">
                          {item.teacher?.name}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-800 border border-teal-200">
                          <BookOpen className="h-3 w-3" />
                          {item.subject?.name}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-stone-500">
                        <span className="inline-flex items-center gap-1">
                          <School className="h-3.5 w-3.5 text-stone-400" />
                          Rombel: <strong>{item.classroom?.name}</strong>
                        </span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-stone-400" />
                          T.A: <strong>{item.academicYear?.name}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end">
                    <button
                      onClick={() =>
                        handleDelete(item.id, item.teacher?.name, item.subject?.name)
                      }
                      title="Batalkan Penugasan"
                      className="touch-target flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Modal Tambah Penugasan */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-base font-bold text-stone-900">Penugasan Guru Baru</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="touch-target rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700">Tahun Ajaran *</label>
                <select
                  required
                  value={formData.academicYearId}
                  onChange={(e) =>
                    setFormData({ ...formData, academicYearId: e.target.value })
                  }
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
                <label className="block text-xs font-semibold text-stone-700">Guru Pengampu *</label>
                <select
                  required
                  value={formData.teacherId}
                  onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
                  className="touch-target mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-700 focus:outline-none"
                >
                  <option value="">Pilih Guru...</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700">Mata Pelajaran *</label>
                <select
                  required
                  value={formData.subjectId}
                  onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                  className="touch-target mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-700 focus:outline-none"
                >
                  <option value="">Pilih Mata Pelajaran...</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.code ? `(${s.code})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700">Rombongan Belajar (Kelas) *</label>
                <select
                  required
                  disabled={!formData.academicYearId}
                  value={formData.classroomId}
                  onChange={(e) =>
                    setFormData({ ...formData, classroomId: e.target.value })
                  }
                  className="touch-target mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-700 focus:outline-none disabled:bg-stone-100 disabled:text-stone-400"
                >
                  <option value="">
                    {formData.academicYearId
                      ? "Pilih Rombel..."
                      : "Pilih Tahun Ajaran terlebih dahulu"}
                  </option>
                  {formAvailableClassrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-stone-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="touch-target rounded-lg border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={
                    isPending ||
                    !formData.academicYearId ||
                    !formData.teacherId ||
                    !formData.subjectId ||
                    !formData.classroomId
                  }
                  className="touch-target rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {isPending ? "Menyimpan..." : "Simpan Penugasan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
