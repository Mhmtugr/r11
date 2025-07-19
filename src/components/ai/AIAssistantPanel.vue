<template>
  <div class="ai-assistant-panel">
    <div v-if="loading" class="ai-panel-loading">AI özetleniyor...</div>
    <div v-else-if="error" class="ai-panel-error">AI özet alınamadı: {{ error }}</div>
    <div v-else class="ai-panel-content">
      <slot name="header">
        <h3>Yapay Zeka Asistanı</h3>
      </slot>
      <div v-if="summary && summary.intent === 'proactive_analysis'">
        <ProactiveAnalysisCard
          :intent="summary.intent"
          :data="summary.data"
          :actions="summary.data && summary.data.actions ? summary.data.actions : []"
          @action="handleProactiveAction"
          @open-order="openOrderDetail"
          @open-stock="openStockDetail"
        />
      </div>
      <div v-else-if="summary">
        <p>{{ typeof summary === 'string' ? summary : summary.summary }}</p>
      </div>
      <slot />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { aiService } from '@/services/ai-service.js';
import ProactiveAnalysisCard from './ProactiveAnalysisCard.vue';

const { getNotesSummaryForAI } = aiService;

const props = defineProps({
  module: { type: String, required: true },
  id: { type: [String, Number], default: null },
});

const summary = ref('');
const loading = ref(false);
const error = ref('');

const fetchSummary = async () => {
  loading.value = true;
  error.value = '';
  try {
    let result;
    switch (props.module) {
      case 'orders':
        result = await aiService.getSystemData({ context: 'order', id: props.id });
        break;
      case 'inventory':
        result = await aiService.getSystemData({ context: 'inventory' });
        break;
      case 'purchasing':
        result = await aiService.getSystemData({ context: 'purchasing' });
        break;
      case 'production':
        result = await aiService.getSystemData({ context: 'production' });
        break;
      case 'planning':
        result = await aiService.getSystemData({ context: 'planning' });
        break;
      case 'notes':
        result = await getNotesSummaryForAI({ id: props.id });
        break;
      case 'reports':
        result = await aiService.getSystemData({ context: 'reports' });
        break;
      default:
        result = { summary: 'Modül için AI özeti bulunamadı.' };
    }
    summary.value = result.summary || (typeof result === 'string' ? result : JSON.stringify(result));
  } catch (e) {
    error.value = e.message || 'Bilinmeyen hata';
  } finally {
    loading.value = false;
  }
};

// Proaktif analiz kartı aksiyonları
function handleProactiveAction(action) {
  // Burada aksiyona göre işlem yapılabilir
}
function openOrderDetail(orderNo) {
  // Sipariş detay modalı veya yönlendirme
}
function openStockDetail(stockName) {
  // Stok detay modalı veya yönlendirme
}

onMounted(fetchSummary);
watch(() => [props.module, props.id], fetchSummary);
</script>

<style scoped>
.ai-assistant-panel {
  background: #f8fafd;
  border: 1px solid #e0e6ed;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}
.ai-panel-loading {
  color: #888;
}
.ai-panel-error {
  color: #c00;
}
</style>
