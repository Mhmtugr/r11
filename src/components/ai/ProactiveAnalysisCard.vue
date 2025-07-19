<template>
  <div class="proactive-analysis-card" :class="intentClass">
    <div class="proactive-header">
      <i :class="iconClass"></i>
      <span class="proactive-title">{{ title }}</span>
    </div>
    <div class="proactive-content">
      <template v-if="data && data.delayedOrders && data.delayedOrders.length">
        <div class="proactive-section">
          <strong>Geciken Siparişler:</strong>
          <ul>
            <li v-for="order in data.delayedOrders" :key="order.orderNo">
              <span>{{ order.orderNo }} - {{ order.customer }}</span>
              <button class="btn btn-link btn-sm" @click="$emit('open-order', order.orderNo)">Detay</button>
            </li>
          </ul>
        </div>
      </template>
      <template v-if="data && data.criticalStocks && data.criticalStocks.length">
        <div class="proactive-section">
          <strong>Kritik Stoklar:</strong>
          <ul>
            <li v-for="item in data.criticalStocks" :key="item.name">
              <span>{{ item.name }} ({{ item.quantity }})</span>
              <button class="btn btn-link btn-sm" @click="$emit('open-stock', item.name)">Stok Detayı</button>
            </li>
          </ul>
        </div>
      </template>
      <template v-if="data && data.suggestions && data.suggestions.length">
        <div class="proactive-section">
          <strong>Öneriler:</strong>
          <ul>
            <li v-for="s in data.suggestions" :key="s">
              <span>{{ s }}</span>
            </li>
          </ul>
        </div>
      </template>
      <template v-if="data && data.predictions && data.predictions.length">
        <div class="proactive-section">
          <strong>Tahminler:</strong>
          <ul>
            <li v-for="p in data.predictions" :key="p.name">
              <span>{{ p.name }}: {{ p.value }} ({{ p.status }})</span>
            </li>
          </ul>
        </div>
      </template>
      <template v-if="!hasAnyData">
        <div class="proactive-section text-muted">Proaktif analiz sonucu mevcut değil.</div>
      </template>
    </div>
    <div class="proactive-footer" v-if="actions && actions.length">
      <button v-for="action in actions" :key="action" class="btn btn-primary btn-sm me-2" @click="$emit('action', action)">
        {{ action }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
const props = defineProps({
  intent: { type: String, default: '' },
  data: { type: Object, default: () => ({}) },
  actions: { type: Array, default: () => [] },
});
const iconClass = computed(() => {
  switch (props.intent) {
    case 'proactive_analysis': return 'bi bi-lightbulb text-warning';
    case 'query_order': return 'bi bi-file-earmark-text text-primary';
    case 'query_material': return 'bi bi-box-seam text-info';
    default: return 'bi bi-info-circle';
  }
});
const intentClass = computed(() => {
  switch (props.intent) {
    case 'proactive_analysis': return 'proactive-analysis';
    default: return '';
  }
});
const title = computed(() => {
  switch (props.intent) {
    case 'proactive_analysis': return 'Proaktif Analiz & Öneriler';
    default: return 'Analiz';
  }
});
const hasAnyData = computed(() => {
  const d = props.data;
  return (d && ((d.delayedOrders && d.delayedOrders.length) || (d.criticalStocks && d.criticalStocks.length) || (d.suggestions && d.suggestions.length) || (d.predictions && d.predictions.length)));
});
</script>

<style scoped>
.proactive-analysis-card {
  border: 1px solid #ffe066;
  border-radius: 8px;
  background: #fffbe6;
  margin-bottom: 16px;
  padding: 16px;
}
.proactive-header {
  display: flex;
  align-items: center;
  font-weight: 600;
  margin-bottom: 8px;
}
.proactive-header i {
  font-size: 1.5rem;
  margin-right: 8px;
}
.proactive-section {
  margin-bottom: 8px;
}
.proactive-footer {
  margin-top: 12px;
}
</style>
