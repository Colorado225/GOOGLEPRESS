import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
      include: [
        'src/lib/pricing.ts',
        'src/lib/dates.ts',
        'src/lib/logistics.ts',
        'src/lib/storage.ts',
        'src/lib/backup.ts',
        'src/lib/localPersistence.ts',
        'src/lib/orderTracking.ts',
        'src/lib/customerAuth.ts',
      ],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 72,
      },
    },
  },
});
