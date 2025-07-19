<template>
  <div class="dashboard-home container-fluid py-4">
    <div class="row mb-4">
      <div class="col-12 col-lg-8">
        <AIInsightsDashboard ref="insightsDashboard" category="dashboard" @insights-loaded="onInsightsLoaded" />
        <!-- Proaktif analiz/öneri kartı örneği -->
        <div v-if="proactiveCard" class="alert alert-warning d-flex align-items-center mt-3 proactive-card" tabindex="0" :title="proactiveCard.title">
          <i class="bi bi-exclamation-triangle-fill text-danger me-2 fs-3" title="Proaktif Uyarı"></i>
          <div>
            <strong>{{ proactiveCard.title }}</strong>
            <div>{{ proactiveCard.description }}</div>
            <button v-if="proactiveCard.action" class="btn btn-sm btn-primary mt-2" @click="proactiveCard.action.handler" :title="proactiveCard.action.label">
              <i class="bi bi-lightning-charge me-1"></i>{{ proactiveCard.action.label }}
            </button>
          </div>
        </div>
      </div>
      <div class="col-12 col-lg-4">
        <div class="summary-cards">
          <div class="card mb-3" v-for="card in summaryCards" :key="card.title">
            <div class="card-body d-flex align-items-center summary-stat-card" tabindex="0" :title="card.title">
              <i :class="card.icon + ' stat-icon'" class="me-3 fs-2" :title="card.title"></i>
              <div>
                <div class="fw-bold">{{ card.value }}</div>
                <div class="text-muted small">{{ card.title }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="row">
      <div class="col-12 col-lg-6 mb-4">
        <AIInsightsChart :data="chartData" type="bar" labelKey="label" valueKey="value" title="Departman Bazlı İçgörü Dağılımı" />
      </div>
      <div class="col-12 col-lg-6 mb-4">
        <AIInsightsChart :data="importanceChartData" type="pie" labelKey="label" valueKey="value" title="Önem Dağılımı" />
      </div>
    </div>
  </div>
</template>

<script setup>
import AIInsightsDashboard from '@/components/ai/AIInsightsDashboard.vue';
import AIInsightsChart from '@/components/ui/charts/AIInsightsChart.vue';
import { ref, computed, onMounted } from 'vue';

const summaryCards = ref([
  { title: 'Toplam İçgörü', value: 0, icon: 'bi bi-lightbulb' },
  { title: 'Kritik İçgörü', value: 0, icon: 'bi bi-exclamation-triangle text-danger' },
  { title: 'Tahminler', value: 0, icon: 'bi bi-graph-up' },
]);

const chartData = ref([]);
const importanceChartData = ref([]);
const proactiveCard = ref(null);

function onInsightsLoaded(insights) {
  // Özet kartları güncelle
  summaryCards.value[0].value = insights.length;
  summaryCards.value[1].value = insights.filter(i => i.importance === 'high').length;
  summaryCards.value[2].value = insights.filter(i => i.type === 'prediction').length;
  // Grafik verileri güncelle
  const deptCounts = {};
  const importanceCounts = { 'Yüksek': 0, 'Orta': 0, 'Düşük': 0 };
  insights.forEach(i => {
    deptCounts[i.department] = (deptCounts[i.department] || 0) + 1;
    if (i.importance === 'high') importanceCounts['Yüksek']++;
    else if (i.importance === 'medium') importanceCounts['Orta']++;
    else if (i.importance === 'low') importanceCounts['Düşük']++;
  });
  chartData.value = Object.entries(deptCounts).map(([label, value]) => ({ label, value }));
  importanceChartData.value = Object.entries(importanceCounts).map(([label, value]) => ({ label, value }));
  // Proaktif analiz/öneri kartı örneği (ilk kritik insight)
  const critical = insights.find(i => i.type === 'critical');
  if (critical) {
    proactiveCard.value = {
      title: 'Kritik İçgörü',
      description: critical.description,
      action: critical.actions && critical.actions.length ? { label: 'Aksiyon Al', handler: () => alert('Aksiyon alındı!') } : null
    };
  } else {
    proactiveCard.value = null;
  }
}
</script>

<style scoped>
.dashboard-home {
  min-height: 100vh;
  background: #f8fafc;
}
.summary-cards .card {
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.proactive-card {
  border-left: 6px solid #ffc107;
  background: #fffbe6;
  box-shadow: 0 2px 8px rgba(255,193,7,0.08);
  border-radius: 8px;
  padding: 14px 18px;
  margin-bottom: 12px;
  transition: box-shadow 0.2s, border-color 0.2s;
}
.proactive-card:focus, .proactive-card:hover {
  box-shadow: 0 4px 16px rgba(255,193,7,0.18);
  border-color: #fd7e14;
}
.stat-icon {
  filter: drop-shadow(0 1px 2px #ffe082);
}
.summary-stat-card:focus, .summary-stat-card:hover {
  background: #f8f9fa;
  box-shadow: 0 2px 8px #ffe08244;
}
</style>
