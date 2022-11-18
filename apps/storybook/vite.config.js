/** @type {import('vite').UserConfig} */

export default defineConfig({
  plugins: [react()],
  resolve: {
    preserveSymlinks: true,
  },
});
