<template>
  <div class="order-list-view">
    <div class="card border-0">
      <div class="card-header bg-transparent border-0 d-flex justify-content-between align-items-center">
        <h5 class="mb-0">Sipariş Yönetimi</h5>
        <button class="btn btn-primary" @click="openNewOrderModal">
          <i class="bi bi-plus"></i> Yeni Sipariş Ekle
        </button>
      </div>
      <div class="card-body">
        <!-- Filtreleme Bölümü -->
        <div class="mb-3">
          <div class="row g-2">
            <div class="col-md-4">
              <input type="text" class="form-control" placeholder="Sipariş No, Müşteri Ara..." v-model="filters.searchQuery">
            </div>
            <div class="col-md-3">
              <select class="form-select" v-model="filters.cellType">
                <option value="">Hücre Tipi Seçin</option>
                <option>RM 36 CB</option>
                <option>RM 36 LB</option>
                <option>RM 36 FL</option>
                <option>RMU</option>
              </select>
            </div>
            <div class="col-md-3">
              <select class="form-select" v-model="filters.status">
                <option value="">Durum Seçin</option>
                <option value="pending">Beklemede</option>
                <option value="planned">Planlandı</option>
                <option value="in_progress">Devam Ediyor</option>
                <option value="delayed">Gecikmiş</option>
                <option value="completed">Tamamlandı</option>
              </select>
            </div>
            <div class="col-md-2">
              <button class="btn btn-outline-secondary w-100" @click="applyFilters">Filtrele</button>
            </div>
          </div>
        </div>

        <!-- AI Asistan Paneli: Sipariş modülü için özet/öneri -->
        <AIAssistantPanel module="orders" />

        <!-- Sipariş Tablosu -->
        <div class="table-responsive">
          <table class="table table-hover custom-table">
            <thead>
              <tr>
                <th>Sipariş No</th>
                <th>Müşteri</th>
                <th>Hücre Tipi</th>
                <th>Miktar</th>
                <th>Sipariş Tarihi</th>
                <th>Durum</th>
                <th>İlerleme</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="order in paginatedOrders" :key="order.id" :class="getPriorityClass(order)">
                <td>{{ order.orderNo }}</td>
                <td>{{ order.customer }}</td>
                <td>{{ order.cellType }}</td>
                <td>{{ order.quantity }}</td>
                <td>{{ new Date(order.orderDate).toLocaleDateString() }}</td>
                <td><span :class="getStatusBadgeClass(order.status)">{{ order.status }}</span></td>
                <td>
                  <div class="progress progress-thin">
                    <div :class="getProgressBarClass(order.status)" role="progressbar" :style="{ width: order.progress + '%' }"></div>
                  </div>
                </td>
                <td>
                  <router-link :to="{ name: 'OrderDetail', params: { id: order.id } }" class="btn btn-sm btn-outline-primary me-1"><i class="bi bi-eye"></i></router-link>
                  <button class="btn btn-sm btn-outline-secondary" @click="editOrder(order)"><i class="bi bi-pencil"></i></button>
                </td>
              </tr>
              <tr v-if="paginatedOrders.length === 0 && !isLoading">
                 <td colspan="8" class="text-center">Gösterilecek sipariş bulunamadı.</td>
              </tr>
              <tr v-if="isLoading">
                <td colspan="8" class="text-center">Siparişler yükleniyor...</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Sayfalama -->
        <nav aria-label="Page navigation" v-if="pagination.totalPages > 1">
          <ul class="pagination justify-content-center">
            <li class="page-item" :class="{ disabled: pagination.currentPage === 1 }">
              <a class="page-link" href="#" @click.prevent="changePage(pagination.currentPage - 1)">Önceki</a>
            </li>
            <li class="page-item" v-for="page in pagination.totalPages" :key="page" :class="{ active: pagination.currentPage === page }">
              <a class="page-link" href="#" @click.prevent="changePage(page)">{{ page }}</a>
            </li>
            <li class="page-item" :class="{ disabled: pagination.currentPage === pagination.totalPages }">
              <a class="page-link" href="#" @click.prevent="changePage(pagination.currentPage + 1)">Sonraki</a>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useOrders } from '@/modules/orders/useOrders';
import AIAssistantPanel from '@/components/ai/AIAssistantPanel.vue';
import eventBus from '@/utils/event-bus';

// Router
const router = useRouter();

// Composable'dan state ve metodları al
const { 
  isLoading,
  filters, 
  pagination, 
  paginatedOrders, 
  applyFilters,
  changePage,
  getPriorityClass,
  loadOrders
} = useOrders();

// Status sınıfları
const getStatusBadgeClass = (status) => {
  switch(status?.toLowerCase()) {
    case 'planned': return 'status-badge status-planned';
    case 'in_progress': return 'status-badge status-in-progress';
    case 'delayed': return 'status-badge status-delayed';
    case 'completed': return 'status-badge status-completed';
    case 'pending': return 'status-badge status-pending';
    default: return 'status-badge';
  }
};

// İlerleme çubuğu sınıfları
const getProgressBarClass = (status) => {
 switch(status?.toLowerCase()) {
    case 'planned': return 'progress-bar bg-info';
    case 'in_progress': return 'progress-bar bg-warning';
    case 'delayed': return 'progress-bar bg-danger';
    case 'completed': return 'progress-bar bg-success';
    case 'pending': return 'progress-bar bg-secondary';
    default: return 'progress-bar';
  }
};

// Metodlar
const openNewOrderModal = () => {
  router.push({ name: 'OrderCreate' });
};

const editOrder = (order) => {
  router.push({ 
    name: 'OrderDetail', 
    params: { id: order.id }, 
    query: { edit: 'true' }
  });
};

// Event listener for when a new order is created
const handleOrderCreated = () => {
  console.log('[OrderListView] order-created event received, calling loadOrders.');
  loadOrders();
};

onMounted(() => {
  console.log('[OrderListView] Mounted, calling loadOrders.');
  loadOrders();
  eventBus.on('order-created', handleOrderCreated);
});

onUnmounted(() => {
  eventBus.off('order-created', handleOrderCreated);
});

</script>

<style lang="scss" scoped>
/* Sipariş listesi özel stilleri */
.table th {
  background-color: var(--bs-light); 
  font-weight: 600;
}

.status-badge {
  display: inline-block;
  padding: 5px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  text-align: center;
  text-transform: capitalize;
}

.status-planned {
  background-color: #e3f2fd;
  color: #1976d2;
}

.status-in-progress {
  background-color: #fff8e1;
  color: #ff8f00;
}

.status-delayed {
  background-color: #ffebee;
  color: #d32f2f;
}

.status-completed {
  background-color: #e8f5e9;
  color: #388e3c;
}

.status-pending {
  background-color: #f5f5f5;
  color: #616161;
}

.progress-thin {
  height: 6px;
  border-radius: 3px;
}

/* Öncelik renkleri */
.priority-high {
  border-left: 4px solid var(--danger-color, #e74c3c);
}

.priority-medium {
  border-left: 4px solid var(--warning-color, #f39c12);
}

.priority-low {
  border-left: 4px solid var(--success-color, #27ae60);
}

/* Kart stilleri */
.card {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s;
  border-radius: 10px;
}

.card:hover {
  transform: translateY(-5px);
}

.card-header {
  font-weight: 600;
}

.custom-table {
  margin-bottom: 0;
}

@media (max-width: 768px) {
  .status-badge {
    padding: 3px 6px;
    font-size: 10px;
  }
}
</style>