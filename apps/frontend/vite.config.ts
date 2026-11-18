import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import pkg from "./package.json";

const API_TARGET = "http://localhost:3333";
const API_PREFIXES = [
  "/auth",
  "/prontuarios",
  "/sync",
  "/admin",
  "/users",
  "/alunos",
  "/professores",
  "/fila-revisao",
  "/encaminhamentos",
  "/acessos",
  "/notificacoes",
  "/health",
  "/configuracoes",
  "/indicador-pacientes",
];

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  server: {
    proxy: Object.fromEntries(
      API_PREFIXES.map((p) => [
        p,
        {
          target: API_TARGET,
          bypass: (req: { method?: string; headers: { accept?: string; authorization?: string } }) =>
            req.method === "GET" && req.headers.accept?.includes("text/html") && !req.headers.authorization
              ? "/index.html"
              : undefined,
        },
      ]),
    ),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: false,
      includeAssets: ["favicon.svg", "icons/*.png"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest}"],
        navigateFallback: "index.html",
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.pathname === "/api/prontuarios" ||
              url.pathname.startsWith("/api/prontuarios/") ||
              url.pathname === "/api/acessos",
            handler: "NetworkOnly",
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api"),
            handler: "NetworkFirst",
            options: { cacheName: "api-cache", networkTimeoutSeconds: 5 },
          },
          {
            urlPattern: ({ url }) =>
              url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: { cacheName: "google-fonts", expiration: { maxEntries: 20, maxAgeSeconds: 31536000 } },
          },
        ],
      },
      devOptions: { enabled: true, type: "module", navigateFallback: "index.html" },
    }),
  ],
});