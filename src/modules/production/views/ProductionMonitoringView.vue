<template>
  <div class="production-monitoring-container p-4">
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h1 class="page-title mb-0">Gerçek Zamanlı Üretim İzleme</h1>
      <div class="d-flex align-items-center">
        <div class="connection-status me-3" :class="`status-${productionStatus.connectionStatus}`">
          <i class="bi" :class="connectionIcon"></i>
          <span>{{ connectionLabel }}</span>
        </div>
        <button class="btn btn-sm btn-outline-secondary" @click="toggleMonitoring" :disabled="productionStatus.connectionStatus === 'connecting'">
          <i class="bi" :class="productionStatus.isMonitoring ? 'bi-stop-circle' : 'bi-play-circle'"></i>
          <span class="ms-1">{{ productionStatus.isMonitoring ? 'İzlemeyi Durdur' : 'İzlemeyi Başlat' }}</span>
        </button>
      </div>
    </div>

    <!-- AI Insights -->
    <AIInsightsDashboard category="üretim" class="mb-4" />

    <!-- KPIs -->
    <div class="row mb-4">
      <div class="col-md-4">
        <div class="card kpi-card text-center">
          <div class="card-body">
            <h5 class="card-title">Genel Ekipman Verimliliği (OEE)</h5>
            <p class="kpi-value text-primary">{{ (productionStatus.efficiencyMetrics.oee * 100).toFixed(1) }}%</p>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card kpi-card text-center">
          <div class="card-body">
            <h5 class="card-title">Kalite Oranı</h5>
            <p class="kpi-value text-success">{{ (productionStatus.efficiencyMetrics.qualityRate * 100).toFixed(1) }}%</p>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card kpi-card text-center">
          <div class="card-body">
            <h5 class="card-title">Aktif Uyarılar</h5>
            <p class="kpi-value text-danger">{{ productionStatus.alerts.length }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Production Lines -->
    <div class="card mb-4">
      <div class="card-header">
        <h5 class="card-title mb-0">Üretim Hatları</h5>
      </div>
      <div class="card-body">
        <div v-if="productionStatus.productionLines.length === 0" class="text-center text-muted p-3">
          Aktif üretim hattı verisi yok.
        </div>
        <div v-else class="row">
          <div v-for="line in productionStatus.productionLines" :key="line.id" class="col-md-6 mb-3">
            <div class="card h-100">
              <div class="card-header d-flex justify-content-between">
                <span>{{ line.name }}</span>
                <span class="badge" :class="`bg-${getLineStatusClass(line.status)}`">{{ line.status }}</span>
              </div>
              <div class="card-body">
                <p><strong>Aktif Sipariş:</strong> {{ line.currentOrder || 'N/A' }}</p>
                <div class="progress">
                  <div class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" :style="{width: line.progress + '%'}" :aria-valuenow="line.progress">{{ line.progress }}%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Machine Status & Alerts -->
    <div class="row">
      <div class="col-lg-8">
        <div class="card">
          <div class="card-header">
            <h5 class="card-title mb-0">Makine Durumları</h5>
          </div>
          <div class="card-body">
             <div v-if="Object.keys(productionStatus.machineStatuses).length === 0" class="text-center text-muted p-3">
                Makine verisi bekleniyor...
            </div>
            <div class="machine-grid">
              <div v-for="(status, id) in productionStatus.machineStatuses" :key="id" class="machine-card" :class="`status-border-${status.status}`">
                <div class="machine-card-header">
                    <i class="bi bi-gear-wide-connected me-2"></i>
                    <strong>{{ status.name }}</strong>
                </div>
                <div class="machine-card-body">
                    <span class="badge" :class="`bg-${getMachineStatusClass(status.status)}`">{{ getMachineStatusLabel(status.status) }}</span>
                    <div class="mt-2 small">
                        <p class="mb-1"><strong>Verimlilik:</strong> {{ (status.efficiency * 100).toFixed(0) }}%</p>
                        <p class="mb-0"><strong>Sıcaklık:</strong> {{ status.temperature.toFixed(1) }}°C</p>
                    </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-lg-4">
        <div class="card">
          <div class="card-header">
            <h5 class="card-title mb-0">Canlı Uyarılar</h5>
          </div>
          <div class="card-body alert-feed">
            <div v-if="productionStatus.alerts.length === 0" class="text-center text-muted pt-3">
              <i class="bi bi-bell-slash fs-2"></i>
              <p>Aktif uyarı bulunmuyor.</p>
            </div>
            <ul v-else class="list-group list-group-flush">
              <li v-for="alert in productionStatus.alerts" :key="alert.id" class="list-group-item alert-item" :class="`alert-${alert.type}`">
                <i class="bi me-2" :class="getAlertIcon(alert.type)"></i>
                <span>{{ alert.message }}</span>
                <small class="d-block text-muted mt-1">{{ new Date(alert.timestamp).toLocaleTimeString() }}</small>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { onMounted, onUnmounted, computed } from 'vue';
import { usePlanningService } from '@/modules/planning/usePlanningService.js';
import AIInsightsDashboard from '@/components/ai/AIInsightsDashboard.vue';

const { 
  productionStatus,
  startProductionMonitoring,
  stopProductionMonitoring
} = usePlanningService();

onMounted(() => {
  if (!productionStatus.isMonitoring) {
      startProductionMonitoring();
  }
});

onUnmounted(() => {
  // Component unmount olduğunda izlemeyi durdurma, 
  // kullanıcı başka sayfaya geçip döndüğünde state korunmalı.
  // stopProductionMonitoring(); 
});

const toggleMonitoring = () => {
    if (productionStatus.isMonitoring) {
        stopProductionMonitoring();
    } else {
        startProductionMonitoring();
    }
}

const connectionIcon = computed(() => ({
  connected: 'bi-check-circle-fill',
  connecting: 'bi-arrow-repeat',
  disconnected: 'bi-x-circle-fill',
  error: 'bi-exclamation-triangle-fill'
}[productionStatus.connectionStatus] || 'bi-question-circle-fill'));

const connectionLabel = computed(() => ({
  connected: 'Bağlandı',
  connecting: 'Bağlanıyor...',
  disconnected: 'Bağlantı Kesildi',
  error: 'Bağlantı Hatası'
}[productionStatus.connectionStatus] || 'Bilinmeyen Durum'));

const getLineStatusClass = (status) => ({
    running: 'success',
    idle: 'secondary',
    stopped: 'danger'
}[status] || 'light');

const getMachineStatusClass = (status) => ({
    running: 'success',
    idle: 'warning',
    maintenance: 'info',
    error: 'danger'
}[status] || 'secondary');

const getMachineStatusLabel = (status) => ({
    running: 'Çalışıyor',
    idle: 'Boşta',
    maintenance: 'Bakımda',
    error: 'Hata'
}[status] || 'Bilinmiyor');

const getAlertIcon = (type) => ({
    info: 'bi-info-circle-fill',
    warning: 'bi-exclamation-triangle-fill',
    error: 'bi-x-octagon-fill'
}[type] || 'bi-bell-fill');

</script>

<style scoped>
.production-monitoring-container {
  background-color: #f4f6f9;
}
.page-title {
  font-weight: 300;
}
.connection-status {
  display: flex;
  align-items: center;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  color: white;
  font-size: 0.9rem;
}
.status-connected { background-color: #198754; }
.status-connecting { background-color: #0dcaf0; animation: spin 2s linear infinite; }
.status-disconnected { background-color: #6c757d; }
.status-error { background-color: #dc3545; }

.kpi-card .kpi-value {
    font-size: 2.5rem;
    font-weight: 700;
}

.machine-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
}

.machine-card {
    border: 1px solid #dee2e6;
    border-radius: .375rem;
    padding: 1rem;
    transition: box-shadow .2s;
}
.machine-card:hover {
    box-shadow: 0 .5rem 1rem rgba(0,0,0,.15);
}
.machine-card-header {
    font-size: 1rem;
    margin-bottom: 0.5rem;
}
.status-border-running { border-left: 5px solid #198754; }
.status-border-idle { border-left: 5px solid #ffc107; }
.status-border-maintenance { border-left: 5px solid #0dcaf0; }
.status-border-error { border-left: 5px solid #dc3545; }

.alert-feed {
    max-height: 300px;
    overflow-y: auto;
}

.alert-item {
    border-right: 5px solid;
}
.alert-info { border-color: #0dcaf0; }
.alert-warning { border-color: #ffc107; }
.alert-error { border-color: #dc3545; }

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
