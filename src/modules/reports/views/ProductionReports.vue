<template>
  <div class="page-container">
    <h1 class="page-title">Üretim Raporları</h1>

    <!-- Filtreleme Alanı -->
    <div class="filter-bar">
      <div class="form-group">
        <label for="startDate">Başlangıç Tarihi</label>
        <input type="date" v-model="filters.startDate" id="startDate" class="form-control">
      </div>
      <div class="form-group">
        <label for="endDate">Bitiş Tarihi</label>
        <input type="date" v-model="filters.endDate" id="endDate" class="form-control">
      </div>
      <button @click="fetchReportData" class="btn btn-primary" :disabled="loading">
        <i class="fas fa-cogs"></i> Raporu Oluştur
      </button>
    </div>

    <div v-if="loading" class="loading-state">Üretim verileri analiz ediliyor...</div>
    <div v-if="!loading && !reportData" class="empty-state">Lütfen bir tarih aralığı seçip raporu oluşturun.</div>

    <!-- Rapor İçeriği -->
    <div v-if="!loading && reportData" class="report-content">
      <!-- Özet Kartları -->
      <div class="summary-cards">
        <div class="summary-card">
          <div class="card-icon text-success"><i class="fas fa-industry"></i></div>
          <div class="card-content">
            <div class="card-title">Toplam Üretim</div>
            <div class="card-value">{{ reportData.totalOutput }} adet</div>
          </div>
        </div>
        <div class="summary-card">
          <div class="card-icon text-danger"><i class="fas fa-exclamation-triangle"></i></div>
          <div class="card-content">
            <div class="card-title">Hatalı Ürün Oranı</div>
            <div class="card-value">{{ reportData.defectRate.toFixed(2) }}%</div>
          </div>
        </div>
        <div class="summary-card">
          <div class="card-icon text-primary"><i class="fas fa-chart-line"></i></div>
          <div class="card-content">
            <div class="card-title">Genel Ekipman Verimliliği (OEE)</div>
            <div class="card-value">{{ reportData.oee.toFixed(2) }}%</div>
          </div>
        </div>
      </div>

      <!-- Grafikler -->
      <div class="charts-container">
        <div class="chart-wrapper">
          <h3 class="chart-title">Makine Performansı (Üretim Adedi)</h3>
          <BarChart :chart-data="machinePerformanceChartData" />
        </div>
        <div class="chart-wrapper">
          <h3 class="chart-title">Operatör Performansı (Üretim Adedi)</h3>
          <BarChart :chart-data="operatorPerformanceChartData" />
        </div>
      </div>

      <!-- Detaylı Üretim Listesi -->
      <div class="details-table">
        <h3 class="table-title">Detaylı Üretim Kayıtları</h3>
        <p>{{ reportData.summary }}</p>
        <table class="data-table">
          <thead>
            <tr>
              <th>Sipariş ID</th>
              <th>Makine</th>
              <th>Operatör</th>
              <th>Üretim (Adet)</th>
              <th>Hatalı (Adet)</th>
              <th>Başlangıç</th>
              <th>Bitiş</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="prod in reportData.productionData" :key="prod.id">
              <td>{{ prod.orderId }}</td>
              <td>{{ prod.machine }}</td>
              <td>{{ prod.operator }}</td>
              <td>{{ prod.output }}</td>
              <td>{{ prod.defects }}</td>
              <td>{{ formatDateTime(prod.startTime) }}</td>
              <td>{{ formatDateTime(prod.endTime) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import { reportService } from '@/services/report-service.js';
import { useToast } from '@/composables/useToast.js';
import BarChart from '@/components/ui/charts/BarChart.vue'; // Bar Grafik bileşeni

const { showToast } = useToast();

const loading = ref(false);
const reportData = ref(null);
const filters = reactive({
  startDate: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
  endDate: new Date().toISOString().split('T')[0],
});

async function fetchReportData() {
  try {
    loading.value = true;
    reportData.value = await reportService.getProductionReports(
      new Date(filters.startDate),
      new Date(filters.endDate)
    );
  } catch (error) {
    showToast('Üretim raporu alınırken hata oluştu.', 'error');
    console.error(error);
  } finally {
    loading.value = false;
  }
}

const machinePerformanceChartData = computed(() => {
  if (!reportData.value || !reportData.value.machinePerformance) {
    return { labels: [], datasets: [] };
  }
  const labels = reportData.value.machinePerformance.map(m => m.name);
  const data = reportData.value.machinePerformance.map(m => m.output);
  return {
    labels,
    datasets: [{
      label: 'Üretim Adedi',
      data,
      backgroundColor: '#4BC0C0',
    }]
  };
});

const operatorPerformanceChartData = computed(() => {
  if (!reportData.value || !reportData.value.operatorPerformance) {
    return { labels: [], datasets: [] };
  }
  const labels = reportData.value.operatorPerformance.map(o => o.name);
  const data = reportData.value.operatorPerformance.map(o => o.output);
  return {
    labels,
    datasets: [{
      label: 'Üretim Adedi',
      data,
      backgroundColor: '#FFCE56',
    }]
  };
});

function formatDateTime(dateStr) {
  return new Date(dateStr).toLocaleString('tr-TR');
}

</script>

<style scoped>
/* Sipariş Raporları ile aynı stilin çoğunu paylaşır, gerekirse özelleştirilebilir */
.page-container {
  padding: 2rem;
}
.page-title {
  margin-bottom: 1.5rem;
}
.filter-bar {
  display: flex;
  gap: 1rem;
  align-items: flex-end;
  margin-bottom: 2rem;
  background: #fff;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.summary-card {
  background: #fff;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0,0,0,0.05);
  display: flex;
  align-items: center;
}

.card-icon {
  font-size: 2.5rem;
  margin-right: 1.5rem;
}

.card-title {
  font-size: 1rem;
  color: #6c757d;
  margin-bottom: 0.25rem;
}

.card-value {
  font-size: 1.75rem;
  font-weight: 600;
}

.charts-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin-bottom: 2rem;
}

.chart-wrapper {
  background: #fff;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0,0,0,0.05);
  height: 400px; /* Fixed height for chart */
}

.chart-title {
  margin-bottom: 1rem;
  font-size: 1.2rem;
}

.details-table {
    background: #fff;
    padding: 1.5rem;
    border-radius: 8px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th, .data-table td {
  padding: 1rem 1.25rem;
  text-align: left;
  border-bottom: 1px solid #e0e0e0;
}

.data-table th {
  background-color: #f7f7f7;
  font-weight: 600;
  color: #555;
}

@media (max-width: 768px) {
    .charts-container {
        grid-template-columns: 1fr;
    }
}
</style>
