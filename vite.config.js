import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.JPG', '**/*.jpg', '**/*.jpeg', '**/*.png'],
  resolve: {
    alias: {
      '@styles': path.resolve(__dirname, 'src/styles'),
      '@img': path.resolve(__dirname, 'src/assets/img'),
    },
  },
  base: './',
  build: {
    outDir: 'build', 
  },
})
