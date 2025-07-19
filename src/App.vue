<template>
  <div id="app-container">
    <AINotificationList />
    <Suspense>
      <template #default>
        <div>
          <div v-if="authIsLoading" class="loading-container">
            <p>Auth Yükleniyor...</p>
          </div>
          <div v-else>
            <component :is="layoutComponent">
              <router-view />
            </component>
          </div>
        </div>
      </template>
      <template #fallback>
        <div class="loading-container">
          <p>Uygulama Yükleniyor...</p>
        </div>
      </template>
    </Suspense>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useAuthStore } from '@/store/auth';
import { useRouter } from 'vue-router';

import DefaultLayout from '@/layouts/DefaultLayout.vue';
import BlankLayout from '@/layouts/BlankLayout.vue';
import AINotificationList from '@/components/ai/AINotificationList.vue';

const authStore = useAuthStore();
const router = useRouter();
const authIsLoading = ref(true);

console.log('App.vue script setup: onMounted non-async olarak değiştirildi.');

onMounted(() => { // async kaldırıldı
  console.log('App.vue onMounted: Başladı (non-async)');
  authStore.initialize()
    .then(() => {
      console.log('App.vue onMounted: authStore.initialize() tamamlandı.');
    })
    .catch(error => {
      console.error('App.vue onMounted: Auth store başlatılırken hata:', error);
    })
    .finally(() => {
      authIsLoading.value = false;
      console.log(`App.vue onMounted: Tamamlandı. authIsLoading: ${authIsLoading.value}`);
      // Yönlendirme mantığı
      const currentRoute = router.currentRoute.value;
      if (authStore.isAuthenticated && currentRoute && currentRoute.name === 'Login') {
        console.log('App.vue: Kullanıcı giriş yapmış ve Login sayfasında. Dashboard\'a yönlendiriliyor.');
        router.push({ name: 'Dashboard' });
      } else if (!authStore.isAuthenticated && currentRoute && currentRoute.meta && currentRoute.meta.requiresAuth) {
        console.log('App.vue: Kimlik doğrulaması gerektiren sayfa, kullanıcı giriş yapmamış. Login sayfasına yönlendiriliyor.');
        router.push({ name: 'Login' });
      }
    });
});

const layoutComponent = computed(() => {
  const route = router.currentRoute.value;
  if (!route || !route.meta) {
    console.warn('App.vue layoutComponent: currentRoute veya meta tanımsız, DefaultLayout\'a dönülüyor.');
    return DefaultLayout;
  }
  const layoutName = route.meta.layout;
  if (layoutName === 'blank') {
    return BlankLayout;
  }
  return DefaultLayout;
});
</script>

<style scoped>
.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  font-size: 1.5rem;
}
#app-container {
  height: 100%;
  width: 100%;
}
</style>