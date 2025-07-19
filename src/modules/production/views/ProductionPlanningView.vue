<template>
  <div class="production-planning-container p-4">
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h1 class="page-title mb-0">Üretim Planlama ve Kapasite Yönetimi</h1>
      <div class="connection-status" :class="`status-${productionStatus.connectionStatus}`">
        <i class="bi" :class="connectionIcon"></i>
        <span>{{ connectionLabel }}</span>
      </div>
    </div>

    <!-- AI Insights -->
    <AIInsightsDashboard category="planlama" class="mb-4" />

    <!-- Capacity Utilization -->
    <div class="card mb-4">
      <div class="card-header">
        <h5 class="card-title mb-0">Üretim Birimi Kapasite Kullanımı</h5>
      </div>
      <div class="card-body">
        <div class="row">
          <div v-for="unit in productionCapacity.units" :key="unit.id" class="col-md-3 col-sm-6 mb-3">
            <label class="form-label">{{ unit.name }}</label>
            <div class="progress" style="height: 25px;">
              <div 
                class="progress-bar" 
                :class="getProgressBarClass(unit.utilization)"
                role="progressbar" 
                :style="{ width: unit.utilization + '%' }" 
                :aria-valuenow="unit.utilization"
                aria-valuemin="0" 
                aria-valuemax="100">
                {{ unit.utilization.toFixed(1) }}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Planning Board -->
    <div class="card">
        <div class="card-header">
            <h5 class="card-title mb-0">Planlama Panosu</h5>
        </div>
        <div class="card-body">
            <div class="row">
                <div v-for="status in Object.keys(groupedOrders)" :key="status" class="col-md-4">
                    <div class="card planning-column">
                        <div class="card-header text-white" :class="`bg-${statusColors[status]}`">
                           {{ statusLabels[status] }} ({{ groupedOrders[status].length }})
                        </div>
                        <div class="card-body">
                            <div v-if="groupedOrders[status].length === 0" class="text-center text-muted p-3">
                                Bu kategoride sipariş yok.
                            </div>
                            <div v-else>
                                <div v-for="order in groupedOrders[status]" :key="order.id" class="order-card card mb-2">
                                    <div class="card-body">
                                        <h6 class="card-title">{{ order.orderId }}</h6>
                                        <p class="card-text mb-1"><strong>Müşteri:</strong> {{ order.customerName }}</p>
                                        <p class="card-text mb-1"><strong>Ürün:</strong> {{ order.cellType }} ({{ order.quantity }} adet)</p>
                                        <span class="badge" :class="`bg-${priorityColors[order.priority]}`">{{ priorityLabels[order.priority] }}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
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
  productionCapacity,
  orders,
  startProductionMonitoring,
  stopProductionMonitoring,
  getProductionPlan,
  getCapacityUtilization
} = usePlanningService();

onMounted(() => {
  startProductionMonitoring();
  getProductionPlan();
  getCapacityUtilization();
});

onUnmounted(() => {
  stopProductionMonitoring();
});

const groupedOrders = computed(() => {
  const groups = { pending: [], production: [], approved: [] };
  orders.value.forEach(order => {
    if (groups[order.status]) {
      groups[order.status].push(order);
    } else {
        // Fallback for other statuses if any
        if(!groups.other) groups.other = [];
        groups.other.push(order);
    }
  });
  return groups;
});

const connectionIcon = computed(() => {
  const icons = {
    connected: 'bi-check-circle-fill',
    connecting: 'bi-arrow-repeat',
    disconnected: 'bi-x-circle-fill',
    error: 'bi-exclamation-triangle-fill'
  };
  return icons[productionStatus.connectionStatus] || 'bi-question-circle-fill';
});

const connectionLabel = computed(() => {
  const labels = {
    connected: 'Bağlandı',
    connecting: 'Bağlanıyor...',
    disconnected: 'Bağlantı Kesildi',
    error: 'Bağlantı Hatası'
  };
  return labels[productionStatus.connectionStatus] || 'Bilinmeyen Durum';
});

const getProgressBarClass = (utilization) => {
  if (utilization > 90) return 'bg-danger';
  if (utilization > 75) return 'bg-warning';
  if (utilization > 50) return 'bg-info';
  return 'bg-success';
};

const statusLabels = {
    pending: 'Bekleyen Siparişler',
    production: 'Üretimdeki Siparişler',
    approved: 'Onaylanan Siparişler'
};

const statusColors = {
    pending: 'secondary',
    production: 'primary',
    approved: 'success'
};

const priorityLabels = {
    high: 'Yüksek Öncelik',
    medium: 'Orta Öncelik',
    low: 'Düşük Öncelik'
};

const priorityColors = {
    high: 'danger',
    medium: 'warning',
    low: 'info'
};

</script>

<style scoped>
.production-planning-container {
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
}
.status-connected { background-color: #28a745; }
.status-connecting { background-color: #0dcaf0; animation: spin 2s linear infinite; }
.status-disconnected { background-color: #6c757d; }
.status-error { background-color: #dc3545; }

.planning-column .card-header {
    font-weight: bold;
}

.order-card {
    transition: box-shadow .2s ease-in-out;
}

.order-card:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
