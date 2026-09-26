import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // tsconfig.json の paths と対応させること
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` は node_modules に実体が無く、Next のバンドラが内部 alias で
      // 解決している。Vitest では解決できず import した時点でテストが落ちるため、
      // 空スタブへ向ける（src/lib/turnstile.ts・src/lib/translate.ts が使用）
      "server-only": fileURLToPath(
        new URL("./tests/stubs/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}"],
  },
});
