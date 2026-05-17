import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: { globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'] },
      manifest: {
        name: 'Family Hub',
        short_name: 'FamilyHub',
        description: 'Chores, meals & schedules for the whole family',
        theme_color: '#6366F1',
        background_color: '#0f0f13',
        display: 'standalone',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ],
  server: { proxy: { '/api': 'http://localhost:3001', '/uploads': 'http://localhost:3001' } }
});

