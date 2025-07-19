<template>
  <div class="page-container">
    <h1 class="page-title">Sipariş Raporları</h1>

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
        <i class="fas fa-search"></i> Raporu Getir
      </button>
    </div>

    <!-- Rapor Yükleniyor veya Boş Durumu -->
    <div v-if="loading" class="loading-state">Yükleniyor...</div>
    <div v-if="!loading && !reportData" class="empty-state">Lütfen bir tarih aralığı seçip raporu getirin.</div>

    <!-- Rapor İçeriği -->
    <div v-if="!loading && reportData" class="report-content">
      <!-- Özet Kartları -->
      <div class="summary-cards">
        <div class="summary-card">
          <div class="card-icon"><i class="fas fa-box-open"></i></div>
          <div class="card-content">
            <div class="card-title">Toplam Sipariş</div>
            <div class="card-value">{{ reportData.totalOrders }}</div>
          </div>
        </div>
        <div class="summary-card">
          <div class="card-icon"><i class="fas fa-coins"></i></div>
          <div class="card-content">
            <div class="card-title">Toplam Gelir</div>
            <div class="card-value">{{ formatCurrency(reportData.totalRevenue) }}</div>
          </div>
        </div>
        <div class="summary-card">
          <div class="card-icon"><i class="fas fa-chart-pie"></i></div>
          <div class="card-content">
            <div class="card-title">Ort. Sipariş Değeri</div>
            <div class="card-value">{{ formatCurrency(reportData.averageOrderValue) }}</div>
          </div>
        </div>
      </div>

      <!-- Grafikler -->
      <div class="charts-container">
        <div class="chart-wrapper">
          <h3 class="chart-title">Sipariş Durum Dağılımı</h3>
          <DoughnutChart :chart-data="statusChartData" />
        </div>
        <!-- Başka bir grafik eklenebilir -->
      </div>

      <!-- Detaylı Sipariş Listesi -->
      <div class="details-table">
        <h3 class="table-title">Detaylı Sipariş Listesi</h3>
        <p>{{ reportData.summary }}</p>
        <table class="data-table">
          <thead>
            <tr>
              <th>Sipariş ID</th>
              <th>Müşteri</th>
              <th>Tarih</th>
              <th>Tutar</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in reportData.orders" :key="order.id">
              <td>{{ order.id }}</td>
              <td>{{ order.customerName }}</td>
              <td>{{ formatDate(order.orderDate) }}</td>
              <td>{{ formatCurrency(order.totalAmount) }}</td>
              <td><span :class="getStatusClass(order.status)">{{ order.status }}</span></td>
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
import DoughnutChart from '@/components/ui/charts/DoughnutChart.vue'; // Grafik bileşeni

const { showToast } = useToast();

const loading = ref(false);
const reportData = ref(null);
const filters = reactive({
  startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
  endDate: new Date().toISOString().split('T')[0],
});

async function fetchReportData() {
  try {
    loading.value = true;
    reportData.value = await reportService.getOrderReports(
      new Date(filters.startDate),
      new Date(filters.endDate)
    );
  } catch (error) {
    showToast('Rapor verileri alınırken hata oluştu.', 'error');
    console.error(error);
  } finally {
    loading.value = false;
  }
}

const statusChartData = computed(() => {
  if (!reportData.value || !reportData.value.statusCounts) {
    return { labels: [], datasets: [] };
  }
  const labels = Object.keys(reportData.value.statusCounts);
  const data = Object.values(reportData.value.statusCounts);
  return {
    labels,
    datasets: [{
      label: 'Sipariş Durumları',
      data,
      backgroundColor: ['#36A2EB', '#FFCE56', '#FF6384', '#4BC0C0', '#9966FF'],
    }]
  };
});

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('tr-TR');
}

function formatCurrency(value) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);
}

function getStatusClass(status) {
    const statusMap = {
        'pending': 'badge-warning',
        'processing': 'badge-info',
        'shipped': 'badge-primary',
        'delivered': 'badge-success',
        'cancelled': 'badge-danger'
    };
    return `badge ${statusMap[status] || 'badge-secondary'}`;
}

</script>

<style scoped>
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
  color: #0d6efd;
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

.badge {
  padding: 0.4em 0.7em;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #fff;
}

.badge-success { background-color: #28a745; }
.badge-warning { background-color: #ffc107; color: #333; }
.badge-danger { background-color: #dc3545; }
.badge-info { background-color: #0dcaf0; }
.badge-primary { background-color: #0d6efd; }

@media (max-width: 768px) {
    .charts-container {
        grid-template-columns: 1fr;
    }
}
</style>
