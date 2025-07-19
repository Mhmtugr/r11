<template>
  <div class="ai-insights-chart">
    <canvas ref="chartRef"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import Chart from 'chart.js/auto';

const props = defineProps({
  data: { type: Array, default: () => [] },
  type: { type: String, default: 'bar' },
  labelKey: { type: String, default: 'title' },
  valueKey: { type: String, default: 'value' },
  title: { type: String, default: '' }
});

const chartRef = ref(null);
let chartInstance = null;

const renderChart = () => {
  if (chartInstance) {
    chartInstance.destroy();
  }
  if (!props.data || !props.data.length) return;
  const labels = props.data.map(item => item[props.labelKey]);
  const values = props.data.map(item => item[props.valueKey]);
  chartInstance = new Chart(chartRef.value, {
    type: props.type,
    data: {
      labels,
      datasets: [{
        label: props.title || 'Değerler',
        data: values,
        backgroundColor: '#0d6efd88',
        borderColor: '#0d6efd',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: !!props.title, text: props.title }
      }
    }
  });
};

onMounted(renderChart);
watch(() => [props.data, props.type], renderChart);
</script>

<style scoped>
.ai-insights-chart {
  width: 100%;
  min-height: 240px;
}
canvas {
  width: 100% !important;
  height: 320px !important;
}
</style>
