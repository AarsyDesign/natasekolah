/**
 * Daftar identifier resmi Domain Plugin NataSekolah (Phase 0.3).
 *
 * Seluruh domain ini bersifat opsional (toggleable) per institusi.
 * Fitur inti (CORE) selalu aktif untuk semua lembaga tanpa plugin.
 */
export const PLUGINS = {
  FORMAL_ACADEMIC: "FORMAL_ACADEMIC",
  PESANTREN_LIVING: "PESANTREN_LIVING",
  TAHFIDZ: "TAHFIDZ",
  PKBM: "PKBM",
} as const;

export type PluginId = (typeof PLUGINS)[keyof typeof PLUGINS];

export const PLUGIN_IDS = Object.values(PLUGINS);

/**
 * Metadata deskriptif masing-masing domain plugin.
 */
export interface PluginMetadata {
  id: PluginId;
  name: string;
  description: string;
  category: "ACADEMIC" | "PESANTREN" | "COMMUNITY";
  coreDependencies: string[];
}

/**
 * Registri terpusat seluruh plugin domain yang didukung oleh platform.
 */
export const PLUGIN_REGISTRY: Record<PluginId, PluginMetadata> = {
  FORMAL_ACADEMIC: {
    id: "FORMAL_ACADEMIC",
    name: "Akademik Formal & Raport Merdeka",
    description:
      "Modul kurikulum formal, Capaian Pembelajaran (CP), penilaian formatif/sumatif, ledger nilai, dan cetak raport.",
    category: "ACADEMIC",
    coreDependencies: ["student", "classroom", "attendance"],
  },
  PESANTREN_LIVING: {
    id: "PESANTREN_LIVING",
    name: "Living & Pengasuhan Asrama",
    description:
      "Modul asrama santri, pembagian kamar/kobong, izin pulang (tasrih), pelanggaran tata tertib santri, dan mutaba'ah ubudiyah.",
    category: "PESANTREN",
    coreDependencies: ["student", "attendance"],
  },
  TAHFIDZ: {
    id: "TAHFIDZ",
    name: "Tahfidz & Halaqah Al-Qur'an",
    description:
      "Modul setoran halaqah tahfidz, pelacakan target ziyadah, muraja'ah, dan ujian mutqin.",
    category: "PESANTREN",
    coreDependencies: ["student"],
  },
  PKBM: {
    id: "PKBM",
    name: "Pendidikan Kesetaraan (PKBM)",
    description:
      "Modul fleksibilitas warga belajar paket A/B/C, modul mandiri, dan ujian kesetaraan.",
    category: "COMMUNITY",
    coreDependencies: ["student"],
  },
};

/**
 * Memvalidasi apakah string merupakan PluginId yang valid.
 */
export function isValidPlugin(id: string): id is PluginId {
  return (PLUGIN_IDS as string[]).includes(id);
}

/**
 * Mengambil daftar seluruh metadata plugin yang terdaftar di sistem.
 */
export function getAllPlugins(): PluginMetadata[] {
  return Object.values(PLUGIN_REGISTRY);
}

/**
 * Mengurai string JSON enabledPlugins dari kolom basis data Institution menjadi array PluginId tervalidasi.
 */
export function parseEnabledPlugins(enabledPluginsRaw: unknown): PluginId[] {
  if (!enabledPluginsRaw) {
    return [];
  }

  if (Array.isArray(enabledPluginsRaw)) {
    return enabledPluginsRaw.filter(isValidPlugin);
  }

  if (typeof enabledPluginsRaw === "string") {
    try {
      const parsed = JSON.parse(enabledPluginsRaw);
      if (Array.isArray(parsed)) {
        return parsed.filter(isValidPlugin);
      }
    } catch {
      return [];
    }
  }

  return [];
}

/**
 * Mengonversi array PluginId menjadi format JSON string untuk disimpan ke kolom basis data.
 */
export function serializeEnabledPlugins(plugins: PluginId[]): string {
  const uniquePlugins = Array.from(new Set(plugins.filter(isValidPlugin)));
  return JSON.stringify(uniquePlugins);
}
