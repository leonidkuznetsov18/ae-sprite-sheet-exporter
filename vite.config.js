import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';
import { resolve } from 'path';

export default defineConfig({
  base: './', // Use relative paths for CEP compatibility
  plugins: [
    legacy({
      targets: ['ie >= 8'], // CEP uses older Chromium, target ES3/5
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
      renderLegacyChunks: true,
      modernPolyfills: false
    })
  ],
  
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
      output: {
        // Ensure compatibility with CEP
        format: 'iife',
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      },
      external: [
        // All Node.js modules will be loaded via window.cep_node.require at runtime
        'fs-extra',
        'path',
        'os',
        'sharp',
        'child_process',
        'fs'
      ]
    },
    
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console logs for debugging
        drop_debugger: false
      },
      format: {
        comments: false
      }
    }
  },
  
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  
  // Development server config
  server: {
    port: 3000,
    open: false
  },
  
  // Define global constants
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development')
  }
}); 