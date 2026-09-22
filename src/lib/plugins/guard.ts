import { PluginId, parseEnabledPlugins, PLUGIN_REGISTRY } from "./registry";

/**
 * Kesalahan fitur domain (403 Forbidden) saat operasi mencoba mengakses domain plugin
 * yang belum diaktifkan pada institusi aktif.
 */
export class DomainFeatureDisabledError extends Error {
  readonly code = "DOMAIN_FEATURE_DISABLED";
  readonly status = 403;
  readonly pluginId: string;

  constructor(pluginId: string, message?: string) {
    const pluginMeta = PLUGIN_REGISTRY[pluginId as PluginId];
    const pluginName = pluginMeta ? pluginMeta.name : pluginId;
    super(
      message ||
        `Fitur domain [${pluginName}] (${pluginId}) belum diaktifkan pada lembaga ini. Hubungi administrator yayasan untuk mengaktifkannya.`
    );
    this.name = "DomainFeatureDisabledError";
    this.pluginId = pluginId;
  }
}

/**
 * Tipe sumber konfigurasi plugin yang dapat diinspeksi oleh guard.
 */
export type PluginConfigSource =
  | { enabledPlugins?: string | PluginId[] | null }
  | { institution?: { enabledPlugins?: string | PluginId[] | null } }
  | string
  | PluginId[]
  | null
  | undefined;

/**
 * Mengekstrak array plugin aktif dari berbagai bentuk objek sumber (Institution, Session, Context, atau Raw JSON).
 */
export function extractActivePlugins(source: PluginConfigSource): PluginId[] {
  if (!source) return [];

  if (Array.isArray(source)) {
    return parseEnabledPlugins(source);
  }

  if (typeof source === "string") {
    return parseEnabledPlugins(source);
  }

  if (typeof source === "object") {
    const obj = source as Record<string, unknown>;
    if ("enabledPlugins" in obj) {
      return parseEnabledPlugins(obj.enabledPlugins);
    }
    if (obj.institution && typeof obj.institution === "object") {
      const inst = obj.institution as Record<string, unknown>;
      if ("enabledPlugins" in inst) {
        return parseEnabledPlugins(inst.enabledPlugins);
      }
    }
  }

  return [];
}

/**
 * Memeriksa apakah suatu domain plugin aktif pada institusi.
 */
export function isPluginEnabled(source: PluginConfigSource, pluginId: PluginId): boolean {
  const activePlugins = extractActivePlugins(source);
  return activePlugins.includes(pluginId);
}

/**
 * Penjaga domain (Guard): Memastikan plugin yang dibutuhkan aktif pada institusi.
 * Melempar DomainFeatureDisabledError (403) jika dinonaktifkan.
 *
 * Catatan: requirePlugin BUKAN pengganti RBAC.
 * Rantai otorisasi wajib runut:
 * Session -> Tenant Isolation -> RBAC Permission -> Plugin Guard -> Domain Resource
 */
export function requirePlugin(source: PluginConfigSource, pluginId: PluginId): void {
  if (!isPluginEnabled(source, pluginId)) {
    throw new DomainFeatureDisabledError(pluginId);
  }
}
