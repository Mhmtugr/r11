<template>
  <div class="chart-container">
    <Pie v-if="chartData.datasets.length > 0" :data="chartData" :options="chartOptions" />
    <div v-else class="text-center text-muted">
      Grafik verisi yükleniyor veya bulunmuyor...
    </div>
  </div>
</template>

<script setup>
import { computed, defineProps } from 'vue';
import { Pie } from 'vue-chartjs';
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  CategoryScale
} from 'chart.js';

ChartJS.register(Title, Tooltip, Legend, ArcElement, CategoryScale);

const props = defineProps({
  data: {
    type: Array,
    default: () => []
  }
});

const chartData = computed(() => ({
  labels: props.data.map(d => d.label),
  datasets: [
    {
      backgroundColor: props.data.map(d => d.color || getRandomColor()),
      data: props.data.map(d => d.value)
    }
  ]
}));

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top',
    },
    title: {
      display: true,
      text: 'Stok Durumu Dağılımı'
    }
  }
};

function getRandomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}
</script>

<style scoped>
.chart-container {
  position: relative;
  height: 300px;
}
</style>
