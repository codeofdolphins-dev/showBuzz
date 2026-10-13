import "server-only";
import { cache } from "react";
import { connect } from "@showbuzz/db/connect";
import { SETTINGS_KEY, Settings } from "@showbuzz/db/models/Settings";
import { log } from "@showbuzz/runtime/log";
import { SETTINGS_DEFAULTS, settingsSchema, type Settings as BusinessSettings } from "@showbuzz/schemas/settings";

/**
 * Business rules (fees, limits, cutoffs) from the `settings` document, read once per request. A missing
 * document or an invalid value falls back to the defaults so checkout keeps working.
 */
export const getSettings = cache(async (): Promise<BusinessSettings> => {
  await connect();
  const doc = await Settings.findOne({ key: SETTINGS_KEY }).lean();
  const parsed = settingsSchema.safeParse({ ...SETTINGS_DEFAULTS, ...doc });
  if (parsed.success) return parsed.data;
  log.warn("Invalid settings document, using defaults", { issues: parsed.error.issues.map((i) => i.path.join(".")) });
  return SETTINGS_DEFAULTS;
});
