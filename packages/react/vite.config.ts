import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      include: ['src'],
      outDir: 'dist/types',
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'mjs' : 'cjs'}`,
    },
    rollupOptions: {
      external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
  },
});
