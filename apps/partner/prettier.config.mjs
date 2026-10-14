import base from "@showbuzz/config/prettier";

/** @type {import("prettier").Config & import("prettier-plugin-tailwindcss").PluginOptions} */
const config = { ...base, tailwindStylesheet: "./src/app/globals.css" };

export default config;
