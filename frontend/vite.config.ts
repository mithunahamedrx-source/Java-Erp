import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// TEC-090 - React 19.x + TypeScript + Vite, communicating with Spring Boot over REST/JSON.
// TEC-094 - no breakpoint is invented here; this build config defines no responsive behaviour.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
  },
});
