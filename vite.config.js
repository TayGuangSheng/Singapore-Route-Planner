import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { handleOneMapRouteRequest } from './server/onemapRouteProxy.js';

const oneMapRouteProxy = () => ({
  name: 'onemap-route-proxy',
  configureServer(server) {
    server.middlewares.use('/api/onemap-route', handleOneMapRouteRequest);
  }
});

export default defineConfig({
  plugins: [react(), oneMapRouteProxy()],
  server: {
    port: 5173
  }
});
