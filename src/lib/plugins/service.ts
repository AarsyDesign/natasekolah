import { z } from "zod";
import { prisma } from "../prisma";
import {
  PluginId,
  PluginMetadata,
  PLUGIN_IDS,
  getAllPlugins,
  parseEnabledPlugins,
  serializeEnabledPlugins,
  PLUGINS,
} from "./registry";
import { validate } from "../validation/common";

/**
 * Skema validasi pembaruan konfigurasi plugin oleh pimpinan yayasan/lembaga.
 */
export const updatePluginsInputSchema = z.object({
  plugins: z.array(
    z.enum(
      [
        PLUGINS.FORMAL_ACADEMIC,
        PLUGINS.PESANTREN_LIVING,
        PLUGINS.TAHFIDZ,
        PLUGINS.PKBM,
      ],
      {
        message: `Plugin harus salah satu dari: ${PLUGIN_IDS.join(", ")}`,
      }
    )
  ),
});

export type UpdatePluginsInput = z.infer<typeof updatePluginsInputSchema>;

export interface InstitutionPluginsResponse {
  institutionId: string;
  enabledPlugins: PluginId[];
  availablePlugins: PluginMetadata[];
}

/**
 * Mengambil daftar plugin yang aktif pada suatu institusi dari basis data.
 */
export async function getInstitutionPlugins(
  institutionId: string
): Promise<InstitutionPluginsResponse | null> {
  const institution = await prisma.institution.findUnique({
    where: { id: institutionId },
    select: { id: true, enabledPlugins: true },
  });

  if (!institution) {
    return null;
  }

  const enabledPlugins = parseEnabledPlugins(institution.enabledPlugins);
  const availablePlugins = getAllPlugins();

  return {
    institutionId: institution.id,
    enabledPlugins,
    availablePlugins,
  };
}

/**
 * Memperbarui daftar plugin yang diaktifkan untuk suatu institusi.
 * Dilakukan secara aman di tingkat server dan divalidasi skema Zod.
 */
export async function updateInstitutionPlugins(
  institutionId: string,
  input: unknown
): Promise<PluginId[]> {
  const validated = validate(updatePluginsInputSchema, input);
  const serialized = serializeEnabledPlugins(validated.plugins);

  const updated = await prisma.institution.update({
    where: { id: institutionId },
    data: { enabledPlugins: serialized },
    select: { enabledPlugins: true },
  });

  return parseEnabledPlugins(updated.enabledPlugins);
}
