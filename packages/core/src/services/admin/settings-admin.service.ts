import "server-only";
import { connect } from "@showbuzz/db/connect";
import { ACTIVE_CITY_FILTER, City } from "@showbuzz/db/models/City";
import { SETTINGS_KEY, Settings } from "@showbuzz/db/models/Settings";
import { bpsToPercent, percentToBps } from "@showbuzz/schemas/admin-marketplace";
import { type SettingsInput, settingsInputSchema } from "@showbuzz/schemas/admin-platform";
import type { Settings as BusinessSettings } from "@showbuzz/schemas/settings";
import { AppError } from "../../http/app-error";
import { getSettings } from "../settings.service";
import { changedKeys } from "./shared";

/**
 * Platform settings (prompt 7). Fees, commission and the cancellation policy here are the defaults new vendors get
 * (each vendor then has its own terms); max tickets and seat hold minutes apply to every new checkout; support
 * contact and the default city show on the public site.
 */

/** The settings as the form edits them (percentages, not basis points). */
export async function getSettingsForm(): Promise<{ values: SettingsInput; updatedAt?: string }> {
  const settings = await getSettings();
  await connect();
  const doc = await Settings.findOne({ key: SETTINGS_KEY }, { updatedAt: 1 }).lean<{ updatedAt?: Date } | null>();
  return {
    values: {
      gstPercent: bpsToPercent(settings.gstBps),
      convenienceFeePercent: bpsToPercent(settings.convenienceFeeBps),
      commissionPercent: bpsToPercent(settings.defaultCommissionBps),
      cancellationCutoffMinutes: settings.cancellationCutoffMinutes,
      cancellationFeePaise: settings.cancellationFeePaise,
      maxTicketsPerOrder: settings.maxTicketsPerOrder,
      seatHoldMinutes: settings.seatHoldMinutes,
      supportEmail: settings.supportEmail,
      supportPhone: settings.supportPhone,
      defaultCityId: settings.defaultCityId,
    },
    ...(doc?.updatedAt ? { updatedAt: doc.updatedAt.toISOString() } : {}),
  };
}

export async function updateSettings(input: unknown): Promise<{ changedFields: string[] }> {
  const data = settingsInputSchema.parse(input);
  await connect();
  if (!(await City.exists({ slug: data.defaultCityId, ...ACTIVE_CITY_FILTER }))) {
    throw new AppError("VALIDATION_FAILED", "Choose an active city.", 422, {
      fieldErrors: { defaultCityId: ["Choose an active city."] },
    });
  }
  const before = await getSettings();
  const next: BusinessSettings = {
    gstBps: percentToBps(data.gstPercent),
    convenienceFeeBps: percentToBps(data.convenienceFeePercent),
    defaultCommissionBps: percentToBps(data.commissionPercent),
    cancellationCutoffMinutes: data.cancellationCutoffMinutes,
    cancellationFeePaise: data.cancellationFeePaise,
    maxTicketsPerOrder: data.maxTicketsPerOrder,
    seatHoldMinutes: data.seatHoldMinutes,
    supportEmail: data.supportEmail,
    supportPhone: data.supportPhone,
    defaultCityId: data.defaultCityId,
  };
  await Settings.updateOne(
    { key: SETTINGS_KEY },
    { $set: next, $setOnInsert: { key: SETTINGS_KEY } },
    { upsert: true },
  );
  return { changedFields: changedKeys({ ...before }, { ...next }) };
}
