import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 6031,
    host: true,
    proxy: { '/v1': 'http://localhost:6028' },
  },
});
