import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { resolve } from 'path';

export default defineConfig({
  base: './', // Use relative paths for CEP compatibility
  plugins: [
    legacy({
      targets: ['chrome >= 58'], // CEP uses Chromium 58+ (CEP 9+)
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
      renderLegacyChunks: true,
      modernPolyfills: false
    }),
    viteStaticCopy({
      targets: [
        { src: 'public', dest: '.' }
      ]
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
        assetFileNames: 'assets/[name].[ext]',
        // Map Node.js built-ins to CEP's require
        globals: {
          'path': 'window.cep_node.require("path")',
          'fs': 'window.cep_node.require("fs")',
          'os': 'window.cep_node.require("os")',
          'child_process': 'window.cep_node.require("child_process")',
          'util': 'window.cep_node.require("util")',
          'assert': 'window.cep_node.require("assert")',
          'stream': 'window.cep_node.require("stream")',
          'constants': 'window.cep_node.require("constants")'
        }
      },
      external: [
        // Only exclude true Node.js built-ins that CEP provides
        'path',
        'os', 
        'child_process',
        'fs',
        'util',
        'assert',
        'stream',
        'constants'
      ]
    },
    
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
        drop_debugger: false
      },
      format: {
        comments: false
      }
    }
  },
  

  
  // Force bundling of Node.js dependencies
  optimizeDeps: {
    include: ['fs-extra']
  },
  
  // Development server config
  server: {
    port: 3000,
    open: false
  },
  
  // Define global constants
  define: {
    // Handle Node.js require in CEP environment
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
    global: 'globalThis'
  }
}); 