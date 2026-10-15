import "server-only";
import { type Model, Schema, model, models } from "mongoose";
import { SETTINGS_DEFAULTS, type Settings as SettingsShape } from "@showbuzz/schemas/settings";

/** The single settings document (`key: "global"`). Read through settings.service, which falls back to defaults. */
export interface SettingsAttrs extends SettingsShape {
  key: "global";
}

export const SETTINGS_KEY = "global";

const settingsSchema = new Schema<SettingsAttrs>(
  {
    key: { type: String, enum: [SETTINGS_KEY], required: true, default: SETTINGS_KEY },
    gstBps: { type: Number, default: SETTINGS_DEFAULTS.gstBps },
    convenienceFeeBps: { type: Number, default: SETTINGS_DEFAULTS.convenienceFeeBps },
    maxTicketsPerOrder: { type: Number, default: SETTINGS_DEFAULTS.maxTicketsPerOrder },
    cancellationCutoffMinutes: { type: Number, default: SETTINGS_DEFAULTS.cancellationCutoffMinutes },
    cancellationFeePaise: { type: Number, default: SETTINGS_DEFAULTS.cancellationFeePaise },
    seatHoldMinutes: { type: Number, default: SETTINGS_DEFAULTS.seatHoldMinutes },
    defaultCommissionBps: { type: Number, default: SETTINGS_DEFAULTS.defaultCommissionBps },
    supportEmail: { type: String, default: SETTINGS_DEFAULTS.supportEmail },
    supportPhone: { type: String, default: SETTINGS_DEFAULTS.supportPhone },
    defaultCityId: { type: String, default: SETTINGS_DEFAULTS.defaultCityId },
  },
  { timestamps: true, versionKey: false },
);

settingsSchema.index({ key: 1 }, { unique: true });

export const Settings: Model<SettingsAttrs> =
  (models.Settings as Model<SettingsAttrs> | undefined) ?? model<SettingsAttrs>("Settings", settingsSchema, "settings");
