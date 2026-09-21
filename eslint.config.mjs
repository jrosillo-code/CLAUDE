import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Next 16 dropped `next lint`; this is the same rule set it used to apply,
// run through ESLint directly (npm run lint).
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "node_modules/**", "public/**", "out/**", "next-env.d.ts"]),
  {
    rules: {
      // Plain <img> is deliberate: photos come from Supabase Storage signed
      // URLs and the demo's placeholder services, sized by CSS.
      "@next/next/no-img-element": "off",
      // React Compiler advisories. Real, but each is a refactor inside a
      // working component; kept visible as warnings rather than blocking.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/static-components": "warn",
    },
  },
]);
