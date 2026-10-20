/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the site from /<repo-name>/. Change REPO_NAME if you rename the repo.
const REPO_NAME = 'cartagena-wedding';

export default defineConfig({
  base: process.env.VITE_BASE ?? `/${REPO_NAME}/`,
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts', 'supabase/tests/**/*.test.ts'],
    environment: 'node',
  },
});
