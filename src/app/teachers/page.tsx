"use client";

import React, { useState, useEffect } from "react";
import { NavHeader } from "../../components/nav-header";
import { getTeachersAction } from "../../actions/teaching";
import {
  GraduationCap,
  Mail,
  Briefcase,
  AlertCircle,
  Search,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface TeacherItem {
  id: string;
  institutionId: string;
  name: string;
  email: string;
  phoneWa: string | null;
  roles: string[];
  isActive: boolean;
  assignmentCount?: number;
  _count?: {
    teacherAssignments?: number;
  };
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getTeachersAction();
      if (res.success && res.data) {
        setTeachers(res.data as TeacherItem[]);
      } else {
        setError(res.error || "Gagal memuat daftar guru.");
      }
    } catch {
      setError("Terjadi kesalahan jaringan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredTeachers = teachers.filter((t) => {
    const q = searchQuery.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      (t.email && t.email.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <NavHeader subtitle="Direktori Pendidik" />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
              Direktori Guru & Asatidz
            </h1>
            <p className="mt-1 text-sm text-stone-500">
              Identitas resmi tenaga pendidik internal lembaga yang memegang peran TEACHER.
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6 flex items-center rounded-xl border border-stone-200 bg-white p-4 shadow-xs">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
            <input
              type="text"
              placeholder="Cari nama guru atau email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="touch-target w-full rounded-lg border border-stone-200 bg-stone-50 py-2 pl-9 pr-3 text-xs text-stone-800 focus:border-teal-700 focus:bg-white focus:outline-none"
            />
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
            <p className="mt-3 text-sm text-stone-500">Memuat direktori guru...</p>
          </div>
        ) : filteredTeachers.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center shadow-xs">
            <GraduationCap className="h-12 w-12 text-stone-300" />
            <h3 className="mt-2 text-base font-semibold text-stone-800">Tidak Ada Data Guru</h3>
            <p className="mt-1 text-sm text-stone-500">
              {searchQuery
                ? "Tidak ada guru yang cocok dengan pencarian."
                : "Belum ada user dengan role TEACHER pada lembaga ini."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTeachers.map((teacher) => (
              <div
                key={teacher.id}
                className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-6 shadow-xs transition hover:border-stone-300"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-800/10 text-teal-800 font-bold">
                        {teacher.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-stone-900">{teacher.name}</h3>
                        <span className="inline-flex items-center gap-1 rounded bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-700">
                          {teacher.roles.join(", ") || "TEACHER"}
                        </span>
                      </div>
                    </div>
                    {teacher.isActive ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="h-3 w-3" /> Aktif
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
                        <XCircle className="h-3 w-3" /> Nonaktif
                      </span>
                    )}
                  </div>

                  <div className="mt-4 space-y-1.5 text-xs text-stone-600">
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-stone-400 shrink-0" />
                      <span className="truncate">{teacher.email || "Email tidak dicatat"}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-stone-100 pt-4 text-xs text-stone-500">
                  <div className="flex items-center gap-1.5 font-medium text-teal-800">
                    <Briefcase className="h-3.5 w-3.5" />
                    <span>
                      {teacher.assignmentCount ?? teacher._count?.teacherAssignments ?? 0} Rombel Diampu
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
