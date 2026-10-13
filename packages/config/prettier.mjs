import * as tailwind from "prettier-plugin-tailwindcss";

/**
 * Shared Prettier options. Workspaces with Tailwind classes add `tailwindStylesheet`; the plugin is passed as a
 * module so it resolves from this package, not from each workspace.
 * @type {import("prettier").Config & import("prettier-plugin-tailwindcss").PluginOptions}
 */
const config = {
  // Matches how the code was already wrapped (99% of lines fit in 127 columns).
  printWidth: 120,
  plugins: [tailwind],
  tailwindFunctions: ["cn", "clsx"],
};

export default config;
