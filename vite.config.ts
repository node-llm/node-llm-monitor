import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [preact()],
  build: {
    lib: {
      entry: resolve(__dirname, "src/ui/entry.tsx"),
      name: "NodeLLMMonitorUI",
      fileName: "ui",
      formats: ["es"]
    },
    outDir: "dist/ui",
    emptyOutDir: true
  }
});
