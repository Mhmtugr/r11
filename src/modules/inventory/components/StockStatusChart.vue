<template>
  <div>
    <AIInsightsChart :data="data" type="bar" labelKey="label" valueKey="value" title="Stok Durumu" />
  </div>
</template>
<script setup>
import AIInsightsChart from '@/components/ui/charts/AIInsightsChart.vue';
const props = defineProps({
  data: { type: Array, default: () => [] }
});
</script>
