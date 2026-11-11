import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Only expose NEXT_PUBLIC_* / VITE_* environment variables to the client mobile bundle
  const env = loadEnv(mode, process.cwd(), ['NEXT_PUBLIC_', 'VITE_']);

  const clientEnvDefines: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    clientEnvDefines[`process.env.${key}`] = JSON.stringify(value);
  }

  return {
    plugins: [react(), tailwindcss()],
    define: {
      ...clientEnvDefines,
      'process.env.NODE_ENV': JSON.stringify(mode === 'development' ? 'development' : 'production'),
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      chunkSizeWarningLimit: 1600,
    },
    server: {
      port: 3002,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
