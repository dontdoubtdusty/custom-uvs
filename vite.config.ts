// Vite settings. A relative base path lets the built site work from any GitHub Pages subfolder.
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
