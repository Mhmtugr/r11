/**
 * METS - MehmetEndüstriyelTakip Ana Uygulama Giriş Noktası
 * Version: 2.0.0
 * Author: MehmetMETS Team
 */

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from '@/App.vue'
import router from '@/router'

// Styles
import 'bootstrap/dist/css/bootstrap.min.css'
import '@/styles/main.scss'
import 'bootstrap-icons/font/bootstrap-icons.css'

// Bootstrap JS
import 'bootstrap/dist/js/bootstrap.bundle.min.js'

// Utils and Config
import { aiService } from './services/ai-service.js'
import { apiService } from '@/services/api-service'
import { useEventBus } from '@/utils/event-bus'
import { registerServiceWorker, checkForUpdates, listenToNetworkChanges } from '@/utils/service-worker'
import logger from '@/utils/logger' // Güvenli logger

// Service Worker Kaydı ve PWA Özellikleri
/*
window.addEventListener('load', async () => {
  try {
    // Service Worker'ı kaydet
    const registration = await registerServiceWorker();
    
    if (registration) {
      // Güncellemeleri kontrol et
      checkForUpdates();
      
      // Online/offline durumu dinle ve kullanıcıya bildir
      listenToNetworkChanges(
        // Çevrimdışı olunduğunda
        () => {
          console.log('Bağlantı kesildi, çevrimdışı moduna geçildi');
          useEventBus().emit('network:offline');
        },
        // Çevrimiçi olunduğunda
        () => {
          console.log('Bağlantı kuruldu, çevrimiçi moduna geçildi');
          useEventBus().emit('network:online');
        }
      );
    }
  } catch (error) {
    console.error('Service Worker başlatılırken hata:', error);
  }
});
*/

// Oluştur ve ayarla
const app = createApp(App)

// Pinia store
const pinia = createPinia()
app.use(pinia)

// Router kullan
app.use(router)

// Global özellikleri ayarla
app.config.globalProperties.$eventBus = useEventBus()
app.config.globalProperties.$apiService = apiService
app.config.globalProperties.$aiService = aiService

// Geliştirme sırasında faydalı konsol mesajları
if (import.meta.env.DEV) {
  console.log('🚀 MehmetEndüstriyelTakip - Geliştirme Modu')
  console.log('🔌 API URL:', import.meta.env.VITE_API_URL || 'Not configured')
  console.log('📊 Version:', import.meta.env.VITE_APP_VERSION || '1.0.0')
  
  // Daha temiz bir Development deneyimi için konsol grupları kullan
  console.groupCollapsed('🛠️ Geliştirme Bilgileri')
  console.log('Pinia Store:', pinia)
  console.log('Router:', router)
  console.log('Environment:', import.meta.env)
  console.groupEnd()
}

// Vue uygulaması için global hata yakalayıcı
app.config.errorHandler = (err, instance, info) => {
  logger.error('VueApp', `Global Vue error: ${err.message}`, {
    error: err,
    componentName: instance?.$options?.name || 'UnknownComponent',
    propsData: instance?.$props,
    lifecycleHook: info,
    stack: err.stack
  });
  // Geliştirme ortamında konsola daha detaylı bilgi basılabilir
  if (import.meta.env.DEV) {
    console.error('[VueApp Error]', err, instance, info);
  }
  // Kullanıcıya genel bir hata mesajı gösterilebilir
  // store.dispatch('notification/addNotification', { type: 'error', message: 'Uygulamada bir hata oluştu.' });
};

// Global olarak ele alınmayan Promise rejection'ları için yakalayıcı
window.addEventListener('unhandledrejection', (event) => {
  logger.error('UnhandledPromise', `Unhandled promise rejection: ${event.reason?.message || 'Unknown reason'}`, {
    reason: event.reason,
    promise: event.promise
  });
  if (import.meta.env.DEV) {
    console.error('[Unhandled Promise Rejection]', event.reason);
  }
});

// Service Worker Güncelleme Olayını Dinle
document.addEventListener('swUpdateAvailable', (event) => {
  // Kullanıcıya güncelleme bildirimi göster
  const isConfirmed = confirm('Uygulamanın yeni sürümü mevcut. Yüklemek için sayfayı yenilemek ister misiniz?');
  if (isConfirmed && event.detail && typeof event.detail.reload === 'function') {
    event.detail.reload();
  }
});

// Mount et
app.mount('#app')