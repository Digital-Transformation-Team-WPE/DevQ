import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    },
    // Optimize HMR
    middlewareMode: false,
  },
  build: {
    // Optimize bundle
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console logs in production
        drop_debugger: true
      },
      format: {
        comments: false // Remove comments
      }
    },
    // Code splitting strategy
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['@mui/material', '@emotion/react', '@emotion/styled', 'react-bootstrap'],
          'vendor-charts': ['recharts'],
          'vendor-utils': ['exceljs', 'html2canvas', 'axios']
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    // Disable source maps in production for smaller bundle
    sourcemap: false,
    // Optimize CSS
    cssCodeSplit: true,
    // Production settings
    reportCompressedSize: false,
    target: 'esnext'
  },
  // Optimize deps
  optimizeDeps: {
    include: ['react', 'react-dom', 'recharts', '@mui/material'],
    exclude: ['@vite/preload-helper']
  }
})
