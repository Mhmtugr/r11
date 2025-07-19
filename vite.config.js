import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

// Mutlak dosya yolunu belirle
const resolveAbsolutePath = (p) => path.resolve(__dirname, p);

export default defineConfig({
  plugins: [
    vue(),
    // PWA eklentisi, 'npm run dev' komutundaki 'Unexpected "*"' sözdizimi hatasını çözmek için geçici olarak kaldırıldı.
    // Orijinal VitePWA yapılandırması buradaydı.
    // İlerleyen adımlarda PWA tekrar etkinleştirilecektir.
  ],
  base: '/', // Base URL'i kök dizin olarak ayarla
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV !== 'production', // Sadece geliştirme ortamında sourcemap
    minify: 'terser',
    assetsInlineLimit: 4096, // 4KB'den küçük dosyaları inline et
    chunkSizeWarningLimit: 1500, // Chunk boyutu uyarı limitini artır
    rollupOptions: {
      input: resolveAbsolutePath('index.html'),
      output: {
        manualChunks: {
          'vendor-vue': ['vue', 'vue-router', 'pinia'],
          'vendor-chart': ['chart.js'],
          'vendor-bootstrap': ['bootstrap'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage']
        },
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]'
      },
      external: []
    },
    target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
    // Build hatalarını daha net görüntülemek için
    reportCompressedSize: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'vue': 'vue/dist/vue.esm-bundler.js',
      // Hatalı dosya yollarını önlemek için ekstra alias'lar
      '@views': resolveAbsolutePath('src/modules'),
      '@components': resolveAbsolutePath('src/components'),
      '@modules': resolveAbsolutePath('src/modules'),
      '@services': resolveAbsolutePath('src/services'),
      '@utils': resolveAbsolutePath('src/utils'),
      '@styles': resolveAbsolutePath('src/styles'),
      '@assets': resolveAbsolutePath('src/assets'),
      '@store': resolveAbsolutePath('src/store'),
      '@composables': resolveAbsolutePath('src/composables'),
      '@config': resolveAbsolutePath('src/config')
    },
    // Modül çözümleme sorunlarını önlemek için
    dedupe: ['vue'],
    // Import sorunlarını önlemek için uzantı çözümlemesi
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue']
  },
  optimizeDeps: {
    include: [
      'vue',
      'vue-router',
      'pinia',
      'axios',
      'mitt',
      'chart.js',
      'firebase/app',
      'firebase/auth',
      'firebase/firestore',
      'firebase/storage',
      'bootstrap/dist/js/bootstrap.bundle.min.js',
      '@vueuse/core'
    ],
    exclude: []
  },
  server: {
    port: 3000,
    open: true,
    // IDE hata ayıklama için kaynak haritalarını etkinleştir
    cors: true,
    hmr: {
      overlay: true
    }
  },
  css: {
    devSourcemap: true,
    preprocessorOptions: {
      scss: {
        // Modern SASS API kullanımı için
        // additionalData: '@use "@/styles/base/_variables.scss" as *;', // GEÇİCİ OLARAK DEVRE DIŞI
      }
    },
    // Sass compiler options directly at the CSS level
    /* // GEÇİCİ OLARAK DEVRE DIŞI BAŞLANGIÇ
    sassOptions: {
      outputStyle: 'compressed',
      charset: false,
      logger: {
        warn: () => {} // Suppress all warnings
      },
      // Dart Sass 2.0.0'da kullanımdan kaldırılan JavaScript API yerine modern API kullanımı
      api: 'modern',
      quietDeps: true,
      quiet: true,
      // Uyarıları hataya dönüştürmeyi engelleme
      strict: false,
      // İçe aktarma çözümlemesini iyileştirme
      includePaths: [
        resolveAbsolutePath('src/styles'),
        resolveAbsolutePath('src'),
        resolveAbsolutePath('node_modules')
      ]
    }
    */ // GEÇİCİ OLARAK DEVRE DIŞI BİTİŞ
  },
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
    legalComments: 'none',
    // Kod içindeki hataları yakalamak için
    keepNames: true
  }
});