import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { URL, fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

function readPort(
  value: string | undefined,
  fallback: number,
  name: string
): number {
  if (value === undefined || value === '') {
    return fallback;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${name} must be an integer between 1 and 65535.`);
  }

  return port;
}

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };

  return {
    plugins: [
      tanstackRouter({ autoCodeSplitting: true, target: 'react' }),
      react(),
      tailwindcss()
    ],
    clearScreen: false,
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@diwan-be': fileURLToPath(new URL('../be', import.meta.url))
      }
    },
    server: {
      host: '0.0.0.0',
      port: readPort(env.LAW_FE_DEV_PORT, 3000, 'LAW_FE_DEV_PORT'),
      strictPort: true
    },
    preview: {
      host: '0.0.0.0',
      port: readPort(env.LAW_FE_PREVIEW_PORT, 4300, 'LAW_FE_PREVIEW_PORT'),
      strictPort: true
    },
    build: {
      target: 'esnext',
      minify: 'esbuild'
    }
  };
});
