import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    define: {
      'import.meta.env.VITE_MCP_ADMIN_ALLOW_ALL': JSON.stringify('false'),
      'import.meta.env.VITE_API_URL': JSON.stringify('/api'),
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}', 'apps/web-admin/**/*.test.{ts,tsx}'],
    },
  })
);
