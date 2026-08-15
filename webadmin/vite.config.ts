import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 6030,
    host: true,
    proxy: {
      '/admin': 'http://localhost:6029',
    },
  },
});
