import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		include: ['src/**/*.test.ts'],
		// Expliciete imports in elk testbestand, zodat `astro check` ze
		// typecontroleert zonder extra ambient types.
		globals: false,
	},
});
