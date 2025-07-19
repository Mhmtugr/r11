<template>
  <div class="stock-container">
    <!-- AI Insights Dashboard -->
    <AIInsightsDashboard category="stok" class="mb-4" />

    <h1 class="page-title">Stok Yönetimi</h1>

    <!-- Action Buttons & Search -->
    <div class="row mb-4 align-items-center">
      <div class="col-md-6">
        <div class="input-group">
          <input 
            type="text" 
            class="form-control" 
            placeholder="Malzeme adı veya kodu ile ara..." 
            :value="searchTerm"
            @input="applySearchTerm($event.target.value)"
          />
          <button class="btn btn-outline-secondary" type="button">
            <i class="bi bi-search"></i>
          </button>
        </div>
      </div>
      <div class="col-md-6 text-end mt-3 mt-md-0">
        <button class="btn btn-primary me-2" @click="openMaterialModal()">
          <i class="bi bi-plus-circle me-1"></i> Yeni Malzeme Ekle
        </button>
        <button class="btn btn-outline-secondary" @click="loadMaterials">
          <i class="bi bi-arrow-clockwise me-1"></i> Yenile
        </button>
      </div>
    </div>

    <!-- Summary Stats Cards -->
    <div class="row mb-4">
      <div class="col-md-3 mb-3">
        <div class="card summary-card h-100">
          <div class="card-body">
            <h5 class="card-title">Toplam Kalem</h5>
            <h2 class="card-value">{{ stockStats.totalItems }}</h2>
            <p class="card-trend text-muted">Farklı malzeme sayısı</p>
          </div>
        </div>
      </div>
      <div class="col-md-3 mb-3">
        <div class="card summary-card h-100" :class="{ 'border-warning': stockStats.lowStockItems > 0 }">
          <div class="card-body">
            <h5 class="card-title">Düşük Stok</h5>
            <h2 class="card-value text-warning">{{ stockStats.lowStockItems }}</h2>
            <p class="card-trend warning">Kritik seviyedeki kalemler</p>
          </div>
        </div>
      </div>
      <div class="col-md-3 mb-3">
        <div class="card summary-card h-100" :class="{ 'border-danger': stockStats.outOfStockItems > 0 }">
          <div class="card-body">
            <h5 class="card-title">Stokta Olmayan</h5>
            <h2 class="card-value text-danger">{{ stockStats.outOfStockItems }}</h2>
            <p class="card-trend danger">Tükenen kalemler</p>
          </div>
        </div>
      </div>
      <div class="col-md-3 mb-3">
        <div class="card summary-card h-100">
          <div class="card-body">
            <h5 class="card-title">Toplam Stok Değeri</h5>
            <h2 class="card-value">₺{{ stockStats.totalValue.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</h2>
            <p class="card-trend text-success">Mevcut envanter değeri</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content: Table and Chart -->
    <div class="row">
      <div class="col-lg-8">
        <div class="card">
          <div class="card-header">
            <h5 class="card-title mb-0">Malzeme Listesi</h5>
          </div>
          <div class="card-body">
            <!-- Filters -->
            <div class="d-flex justify-content-between mb-3">
              <select class="form-select w-auto" :value="categoryFilter" @change="applyCategoryFilter($event.target.value)">
                <option value="">Tüm Kategoriler</option>
                <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
              </select>
              <select class="form-select w-auto" :value="stockFilter" @change="applyStockFilter($event.target.value)">
                <option value="all">Tüm Stok Durumları</option>
                <option value="available">Stokta Var</option>
                <option value="low">Düşük Stok</option>
                <option value="out">Stok Tükendi</option>
              </select>
            </div>
            
            <!-- Materials Table -->
            <MaterialsTable 
              :materials="paginatedMaterials"
              :loading="loading"
              :sort-key="sortKey"
              :sort-direction="sortDirection"
              @sort="sortBy"
              @edit="openMaterialModal"
              @delete="handleDeleteMaterial"
            />

            <!-- Pagination -->
            <Pagination 
              v-if="totalPages > 1"
              :current-page="currentPage"
              :total-pages="totalPages"
              @page-changed="goToPage"
            />
          </div>
        </div>
      </div>
      <div class="col-lg-4">
        <div class="card">
          <div class="card-header">
            <h5 class="card-title mb-0">Stok Durum Özeti</h5>
          </div>
          <div class="card-body">
            <StockStatusChart :stock-data="stockChartData" />
          </div>
        </div>
      </div>
    </div>

    <!-- Material Edit/Create Modal -->
    <MaterialFormModal
      :material="selectedMaterial"
      :modal-id="'materialFormModal'"
      @submit="handleSaveMaterial"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useMaterials } from '@/modules/inventory/useMaterials.js';
import { useToast } from '@/composables/useToast.js';
import AIInsightsDashboard from '@/components/ai/AIInsightsDashboard.vue';
import MaterialsTable from '@/components/tables/MaterialsTable.vue';
import StockStatusChart from '@/components/ui/charts/StockStatusChart.vue';
import Pagination from '@/components/ui/Pagination.vue';
import MaterialFormModal from '@/components/modals/MaterialFormModal.vue';
import { Modal } from 'bootstrap';

const { 
  materials,
  paginatedMaterials,
  loading,
  stockStats,
  totalPages,
  currentPage,
  sortKey,
  sortDirection,
  searchTerm,
  categoryFilter,
  stockFilter,
  categories,
  loadMaterials,
  addMaterial,
  updateMaterial,
  deleteMaterial,
  goToPage,
  sortBy,
  applySearchTerm,
  applyCategoryFilter,
  applyStockFilter,
} = useMaterials();

const { showToast } = useToast();

const selectedMaterial = ref(null);
let materialModalInstance = null;

onMounted(async () => {
  await loadMaterials();
  const modalElement = document.getElementById('materialFormModal');
  if (modalElement) {
    materialModalInstance = new Modal(modalElement);
  }
});

const openMaterialModal = (material = null) => {
  selectedMaterial.value = material;
  if (materialModalInstance) {
    materialModalInstance.show();
  }
};

const handleSaveMaterial = async (materialData) => {
  try {
    if (materialData.id) {
      await updateMaterial(materialData.id, materialData);
      showToast('Malzeme başarıyla güncellendi.', 'success');
    } else {
      await addMaterial(materialData);
      showToast('Yeni malzeme başarıyla eklendi.', 'success');
    }
  } catch (error) {
    console.error('Failed to save material:', error);
    showToast(`Malzeme kaydedilemedi: ${error.message}`, 'error');
  }
};

const handleDeleteMaterial = async (materialId) => {
  if (confirm('Bu malzemeyi silmek istediğinizden emin misiniz?')) {
    try {
      await deleteMaterial(materialId);
      showToast('Malzeme başarıyla silindi.', 'success');
    } catch (error) {
      console.error('Failed to delete material:', error);
      showToast(`Malzeme silinemedi: ${error.message}`, 'error');
    }
  }
};

const stockChartData = computed(() => ({
  labels: ['Stokta Var', 'Düşük Stok', 'Stok Tükendi'],
  datasets: [
    {
      label: 'Stok Durumu',
      backgroundColor: ['#28a745', '#ffc107', '#dc3545'],
      data: [
        stockStats.value.totalItems - stockStats.value.lowStockItems - stockStats.value.outOfStockItems, 
        stockStats.value.lowStockItems, 
        stockStats.value.outOfStockItems
      ],
    },
  ],
}));

</script>

<style scoped>
.stock-container {
  padding: 2rem;
  background-color: #f4f6f9;
}

.page-title {
  font-weight: 300;
  margin-bottom: 2rem;
}

.summary-card {
  border: none;
  border-radius: 0.5rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  transition: transform 0.2s;
}

.summary-card:hover {
    transform: translateY(-5px);
}

.summary-card .card-title {
  font-size: 1rem;
  color: #6c757d;
}

.summary-card .card-value {
  font-size: 2rem;
  font-weight: 700;
}

.summary-card .card-trend {
    font-size: 0.85rem;
}

.card {
    border-radius: 0.5rem;
}
</style>