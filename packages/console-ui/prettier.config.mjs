import base from "@showbuzz/config/prettier";

/**
 * Class sorting needs the console theme tokens (admin-*), which the apps define by importing src/theme.css; the
 * admin stylesheet is used as the reference so the kit sorts exactly like the apps that render it.
 * @type {import("prettier").Config & import("prettier-plugin-tailwindcss").PluginOptions}
 */
const config = { ...base, tailwindStylesheet: "../../apps/admin/src/app/globals.css" };

export default config;
