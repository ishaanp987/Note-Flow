import { defineConfig } from 'vite';
export default defineConfig({ build: { outDir: 'dist/client' }, server: { host: '127.0.0.1', watch: { ignored: ['**/tools/**', '**/models/**', '**/data/**', '**/work/**', '**/outputs/**'] } } });
