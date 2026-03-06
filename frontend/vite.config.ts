import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiUrl = env.VITE_API_URL ?? 'http://localhost:3001';

  return {
    plugins: [react()],
    resolve: { alias: { '@': '/src' } },

    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'esbuild',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            axios: ['axios'],
          },
        },
      },
    },

    server: {
      port: 5173,
      // Proxy só é usado em `npm run dev` (modo development)
      proxy: {
        '/api': {
          target: apiUrl,
          changeOrigin: true,
          secure: false,
        },
      },
    },

    preview: {
      port: 4173,
    },

    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    },
  };
});
