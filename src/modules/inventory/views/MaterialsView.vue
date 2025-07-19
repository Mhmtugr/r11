<template>
  <div class="materials-page">
    <AIInsightsDashboard class="mb-4" ref="insightsDashboard" category="stok" @insights-loaded="onInsightsLoaded" />
    <div v-if="proactiveCard" class="alert alert-danger d-flex align-items-center mb-3 proactive-card" tabindex="0" :title="proactiveCard.title">
      <i class="bi bi-exclamation-triangle-fill text-danger me-2 fs-3" title="Kritik Uyarı"></i>
      <div>
        <strong>{{ proactiveCard.title }}</strong>
        <div>{{ proactiveCard.description }}</div>
        <button v-if="proactiveCard.action" class="btn btn-sm btn-primary mt-2" @click="proactiveCard.action.handler" :title="proactiveCard.action.label">
          <i class="bi bi-lightning-charge me-1"></i>{{ proactiveCard.action.label }}
        </button>
      </div>
    </div>
    <div class="page-header">
      <div>
        <h1>Malzemeler</h1>
        <p class="text-muted">Stok takibi ve malzeme yönetimi yapabilirsiniz.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" @click="openNewMaterialModal">
          <i class="bi bi-plus-lg"></i> Yeni Malzeme
        </button>
        <button class="btn btn-outline-secondary" @click="openImportModal">
          <i class="bi bi-upload"></i> İçe Aktar
        </button>
      </div>
    </div>

    <div class="card">
      <div class="card-header bg-transparent">
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div class="d-flex align-items-center gap-3 flex-wrap">
            <div class="search-box">
              <div class="input-group">
                <span class="input-group-text">
                  <i class="bi bi-search"></i>
                </span>
                <input
                  type="text"
                  class="form-control"
                  placeholder="Malzeme Ara..."
                  v-model="searchTerm"
                  @input="filterMaterials"
                />
              </div>
            </div>
            
            <div class="filter-dropdown">
              <div class="dropdown">
                <button class="btn btn-outline-secondary dropdown-toggle" type="button" id="categoryFilter" data-bs-toggle="dropdown">
                  <i class="bi bi-funnel"></i> Kategori
                </button>
                <ul class="dropdown-menu" aria-labelledby="categoryFilter">
                  <li>
                    <button class="dropdown-item" @click="filterByCategory('')">Tümü</button>
                  </li>
                  <li v-for="category in categories" :key="category">
                    <button class="dropdown-item" @click="filterByCategory(category)">{{ category }}</button>
                  </li>
                </ul>
              </div>
            </div>
            
            <div class="filter-dropdown">
              <div class="dropdown">
                <button class="btn btn-outline-secondary dropdown-toggle" type="button" id="stockFilter" data-bs-toggle="dropdown">
                  <i class="bi bi-funnel"></i> Stok Durumu
                </button>
                <ul class="dropdown-menu" aria-labelledby="stockFilter">
                  <li>
                    <button class="dropdown-item" @click="filterByStock('all')">Tümü</button>
                  </li>
                  <li>
                    <button class="dropdown-item" @click="filterByStock('low')">Düşük Stok</button>
                  </li>
                  <li>
                    <button class="dropdown-item" @click="filterByStock('out')">Tükenen</button>
                  </li>
                  <li>
                    <button class="dropdown-item" @click="filterByStock('available')">Yeterli Stok</button>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          
          <div class="d-flex align-items-center gap-2">
            <button class="btn btn-outline-secondary" @click="refreshMaterials">
              <i class="bi bi-arrow-clockwise"></i>
            </button>
            <div class="btn-group">
              <button type="button" class="btn btn-outline-secondary" @click="toggleView('table')" :class="{'active': viewMode === 'table'}">
                <i class="bi bi-table"></i>
              </button>
              <button type="button" class="btn btn-outline-secondary" @click="toggleView('cards')" :class="{'active': viewMode === 'cards'}">
                <i class="bi bi-grid"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="card-body p-0">
        <!-- Table View -->
        <div v-if="viewMode === 'table'" class="table-responsive">
          <table class="table table-hover table-striped">
            <thead>
              <tr>
                <th @click="sortBy('code')">
                  Kod
                  <i v-if="sortKey === 'code'" class="bi" :class="sortDirection === 'asc' ? 'bi-sort-down' : 'bi-sort-up'"></i>
                </th>
                <th @click="sortBy('name')">
                  Malzeme Adı
                  <i v-if="sortKey === 'name'" class="bi" :class="sortDirection === 'asc' ? 'bi-sort-down' : 'bi-sort-up'"></i>
                </th>
                <th @click="sortBy('category')">
                  Kategori
                  <i v-if="sortKey === 'category'" class="bi" :class="sortDirection === 'asc' ? 'bi-sort-down' : 'bi-sort-up'"></i>
                </th>
                <th @click="sortBy('quantity')">
                  Stok Miktarı
                  <i v-if="sortKey === 'quantity'" class="bi" :class="sortDirection === 'asc' ? 'bi-sort-down' : 'bi-sort-up'"></i>
                </th>
                <th @click="sortBy('unit')">
                  Birim
                  <i v-if="sortKey === 'unit'" class="bi" :class="sortDirection === 'asc' ? 'bi-sort-down' : 'bi-sort-up'"></i>
                </th>
                <th @click="sortBy('price')">
                  Birim Fiyat
                  <i v-if="sortKey === 'price'" class="bi" :class="sortDirection === 'asc' ? 'bi-sort-down' : 'bi-sort-up'"></i>
                </th>
                <th>Stok Durumu</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="material in paginatedMaterials" :key="material.id">
                <td>{{ material.code }}</td>
                <td>{{ material.name }}</td>
                <td>{{ material.category }}</td>
                <td>{{ material.quantity }}</td>
                <td>{{ material.unit }}</td>
                <td>{{ formatCurrency(material.price) }}</td>
                <td>
                  <div class="stock-status">
                    <div class="stock-bar">
                      <div 
                        class="stock-level" 
                        :class="getStockLevelClass(material)"
                        :style="{ width: `${getStockPercentage(material)}%` }"
                      ></div>
                    </div>
                    <span class="stock-text" :class="getStockTextClass(material)">
                      {{ getStockStatus(material) }}
                    </span>
                  </div>
                </td>
                <td>
                  <div class="btn-group">
                    <button class="btn btn-sm btn-outline-primary" @click="editMaterial(material)">
                      <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-secondary" @click="openStockAdjustmentModal(material)">
                      <i class="bi bi-plus-minus"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" @click="confirmDelete(material)">
                      <i class="bi bi-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="paginatedMaterials.length === 0">
                <td colspan="8" class="text-center py-4">
                  <div class="empty-state">
                    <i class="bi bi-search text-muted"></i>
                    <p>Aradığınız kriterlere uygun malzeme bulunamadı.</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Cards View -->
        <div v-if="viewMode === 'cards'" class="materials-grid">
          <div v-for="material in paginatedMaterials" :key="material.id" class="material-card">
            <div class="material-card-header">
              <div class="d-flex align-items-center">
                <div class="material-icon">
                  <i class="bi bi-box-seam"></i>
                </div>
                <div>
                  <h5 class="material-name">{{ material.name }}</h5>
                  <span class="material-code">{{ material.code }}</span>
                </div>
              </div>
              <div class="stock-pill" :class="getStockPillClass(material)">
                {{ getStockPillText(material) }}
              </div>
            </div>
            <div class="material-card-body">
              <div class="material-info">
                <div class="info-label">Kategori:</div>
                <div class="info-value">{{ material.category }}</div>
              </div>
              <div class="material-info">
                <div class="info-label">Stok:</div>
                <div class="info-value">{{ material.quantity }} {{ material.unit }}</div>
              </div>
              <div class="material-info">
                <div class="info-label">Birim Fiyat:</div>
                <div class="info-value">{{ formatCurrency(material.price) }}</div>
              </div>
              <div class="stock-status mt-2">
                <div class="stock-bar">
                  <div 
                    class="stock-level" 
                    :class="getStockLevelClass(material)"
                    :style="{ width: `${getStockPercentage(material)}%` }"
                  ></div>
                </div>
              </div>
            </div>
            <div class="material-card-footer">
              <button class="btn btn-sm btn-outline-primary" @click="editMaterial(material)">
                <i class="bi bi-pencil"></i> Düzenle
              </button>
              <button class="btn btn-sm btn-outline-secondary" @click="openStockAdjustmentModal(material)">
                <i class="bi bi-plus-minus"></i> Stok Ayarla
              </button>
              <button class="btn btn-sm btn-outline-danger" @click="confirmDelete(material)">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
          <div v-if="paginatedMaterials.length === 0" class="empty-state-grid">
            <div class="empty-state">
              <i class="bi bi-search text-muted"></i>
              <p>Aradığınız kriterlere uygun malzeme bulunamadı.</p>
            </div>
          </div>
        </div>
      </div>

      <div class="card-footer d-flex justify-content-between align-items-center flex-wrap">
        <div class="pagination-info">
          {{ startIndex + 1 }}-{{ endIndex }} / {{ filteredMaterials.length }} Malzeme
        </div>
        <nav>
          <ul class="pagination mb-0">
            <li class="page-item" :class="{ disabled: currentPage === 1 }">
              <a class="page-link" href="#" @click.prevent="goToPage(currentPage - 1)">
                <i class="bi bi-chevron-left"></i>
              </a>
            </li>
            <li v-for="page in pageNumbers" :key="page" class="page-item" :class="{ active: page === currentPage }">
              <a class="page-link" href="#" @click.prevent="goToPage(page)">{{ page }}</a>
            </li>
            <li class="page-item" :class="{ disabled: currentPage === totalPages }">
              <a class="page-link" href="#" @click.prevent="goToPage(currentPage + 1)">
                <i class="bi bi-chevron-right"></i>
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </div>

    <!-- New Material Modal -->
    <div class="modal fade" id="materialModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ isEditing ? 'Malzeme Düzenle' : 'Yeni Malzeme Ekle' }}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="saveMaterial">
              <div class="mb-3">
                <label for="materialCode" class="form-label">Malzeme Kodu</label>
                <input type="text" class="form-control" id="materialCode" v-model="materialForm.code" required>
              </div>
              <div class="mb-3">
                <label for="materialName" class="form-label">Malzeme Adı</label>
                <input type="text" class="form-control" id="materialName" v-model="materialForm.name" required>
              </div>
              <div class="mb-3">
                <label for="materialCategory" class="form-label">Kategori</label>
                <select class="form-select" id="materialCategory" v-model="materialForm.category" required>
                  <option value="" disabled>Kategori Seçin</option>
                  <option v-for="category in categories" :key="category" :value="category">{{ category }}</option>
                  <option value="new">+ Yeni Kategori Ekle</option>
                </select>
              </div>
              <div class="mb-3" v-if="materialForm.category === 'new'">
                <label for="newCategory" class="form-label">Yeni Kategori</label>
                <input type="text" class="form-control" id="newCategory" v-model="newCategory">
              </div>
              <div class="row mb-3">
                <div class="col">
                  <label for="materialQuantity" class="form-label">Stok Miktarı</label>
                  <input type="number" class="form-control" id="materialQuantity" v-model="materialForm.quantity" min="0" step="0.01" required>
                </div>
                <div class="col">
                  <label for="materialUnit" class="form-label">Birim</label>
                  <select class="form-select" id="materialUnit" v-model="materialForm.unit" required>
                    <option value="adet">Adet</option>
                    <option value="kg">Kilogram (kg)</option>
                    <option value="m">Metre (m)</option>
                    <option value="m2">Metrekare (m²)</option>
                    <option value="lt">Litre (lt)</option>
                  </select>
                </div>
              </div>
              <div class="row mb-3">
                <div class="col">
                  <label for="materialPrice" class="form-label">Birim Fiyat (₺)</label>
                  <input type="number" class="form-control" id="materialPrice" v-model="materialForm.price" min="0" step="0.01" required>
                </div>
                <div class="col">
                  <label for="materialMinQuantity" class="form-label">Minimum Stok</label>
                  <input type="number" class="form-control" id="materialMinQuantity" v-model="materialForm.minQuantity" min="0" step="0.01" required>
                </div>
              </div>
              <div class="mb-3">
                <label for="materialDescription" class="form-label">Açıklama</label>
                <textarea class="form-control" id="materialDescription" v-model="materialForm.description" rows="3"></textarea>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">İptal</button>
            <button type="button" class="btn btn-primary" @click="saveMaterial">{{ isEditing ? 'Güncelle' : 'Kaydet' }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Stock Adjustment Modal -->
    <div class="modal fade" id="stockModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Stok Ayarla</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body" v-if="selectedMaterial">
            <h6>{{ selectedMaterial.name }} ({{ selectedMaterial.code }})</h6>
            <p>Mevcut Stok: {{ selectedMaterial.quantity }} {{ selectedMaterial.unit }}</p>
            
            <div class="mb-3 mt-4">
              <label class="form-label">İşlem Tipi</label>
              <div class="btn-group w-100">
                <button type="button" class="btn" :class="stockAdjustment.type === 'add' ? 'btn-primary' : 'btn-outline-primary'"
                  @click="setAdjustmentType('add')">
                  <i class="bi bi-plus-lg"></i> Giriş
                </button>
                <button type="button" class="btn" :class="stockAdjustment.type === 'subtract' ? 'btn-primary' : 'btn-outline-primary'"
                  @click="setAdjustmentType('subtract')">
                  <i class="bi bi-dash-lg"></i> Çıkış
                </button>
                <button type="button" class="btn" :class="stockAdjustment.type === 'set' ? 'btn-primary' : 'btn-outline-primary'"
                  @click="setAdjustmentType('set')">
                  <i class="bi bi-arrow-right"></i> Ayarla
                </button>
              </div>
            </div>
            
            <div class="mb-3">
              <label for="adjustmentQuantity" class="form-label">Miktar</label>
              <input type="number" class="form-control" id="adjustmentQuantity" v-model="stockAdjustment.quantity" min="0" step="0.01" required>
            </div>
            
            <div class="mb-3">
              <label for="adjustmentReason" class="form-label">İşlem Nedeni</label>
              <select class="form-select" id="adjustmentReason" v-model="stockAdjustment.reason">
                <option value="purchase">Satın Alma</option>
                <option value="sale">Satış</option>
                <option value="production">Üretim</option>
                <option value="return">İade</option>
                <option value="damaged">Hasar/Fire</option>
                <option value="count">Sayım Düzeltme</option>
                <option value="other">Diğer</option>
              </select>
            </div>
            
            <div class="mb-3" v-if="stockAdjustment.reason === 'other'">
              <label for="adjustmentOtherReason" class="form-label">Diğer Neden</label>
              <input type="text" class="form-control" id="adjustmentOtherReason" v-model="stockAdjustment.otherReason">
            </div>
            
            <div class="mb-3">
              <label for="adjustmentNotes" class="form-label">Notlar</label>
              <textarea class="form-control" id="adjustmentNotes" v-model="stockAdjustment.notes" rows="2"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">İptal</button>
            <button type="button" class="btn btn-primary" @click="saveStockAdjustment">Stok Güncelle</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div class="modal fade" id="deleteConfirmModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Malzeme Sil</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body" v-if="materialToDelete">
            <p>
              <strong>{{ materialToDelete.code }} - {{ materialToDelete.name }}</strong> malzemesini silmek istediğinize emin misiniz?
            </p>
            <p class="text-danger">Bu işlem geri alınamaz!</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">İptal</button>
            <button type="button" class="btn btn-danger" @click="deleteMaterial">Malzemeyi Sil</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { Modal } from 'bootstrap';
import { useMaterials } from '@/modules/inventory/useMaterials';
import AIInsightsDashboard from '@/components/ai/AIInsightsDashboard.vue';

// Composable for materials logic
const {
  loading,
  searchTerm,
  categoryFilter,
  stockFilter,
  sortKey,
  sortDirection,
  currentPage,
  perPage,
  categories,
  paginatedMaterials,
  totalPages,
  startIndex,
  endIndex,
  filteredMaterialsCount,
  loadMaterials,
  applyCategoryFilter,
  applyStockFilter,
  sortBy,
  goToPage,
  saveMaterial,
  deleteMaterial,
  adjustStock,
  addNewCategory,
} = useMaterials();

// Component-specific state
const viewMode = ref('table');
const isEditing = ref(false);
const materialForm = ref({});
const newCategory = ref('');
const selectedMaterial = ref(null);
const materialToDelete = ref(null);
const stockAdjustment = ref({
  type: 'add',
  quantity: 0,
  reason: 'purchase',
  otherReason: '',
  notes: ''
});
const proactiveCard = ref(null);

// Modals
let materialModal = null;
let stockModal = null;
let deleteModal = null;

// Methods
function onInsightsLoaded(insights) {
  const critical = insights.find(i => i.type === 'critical');
  if (critical) {
    proactiveCard.value = {
      title: 'Kritik Malzeme Uyarısı',
      description: critical.description,
      action: critical.actions && critical.actions.length ? { label: 'Malzeme Detayını Aç', handler: () => alert('Malzeme detayına gidiliyor!') } : null
    };
  } else {
    proactiveCard.value = null;
  }
}

const toggleView = (mode) => {
  viewMode.value = mode;
};

const refreshMaterials = () => {
  loadMaterials();
};

const openNewMaterialModal = () => {
  isEditing.value = false;
  materialForm.value = {
    id: null,
    code: '',
    name: '',
    category: '',
    quantity: 0,
    unit: 'adet',
    price: 0,
    minQuantity: 0,
    description: ''
  };
  newCategory.value = '';
  if (materialModal) {
    materialModal.show();
  }
};

const openImportModal = () => {
  alert('Bu özellik henüz geliştirilme aşamasındadır.');
};

const editMaterial = (material) => {
  isEditing.value = true;
  materialForm.value = { ...material };
  if (materialModal) {
    materialModal.show();
  }
};

const handleSaveMaterial = async () => {
  if (materialForm.value.category === 'new' && newCategory.value) {
    addNewCategory(newCategory.value);
    materialForm.value.category = newCategory.value;
  }
  
  const success = await saveMaterial(materialForm.value);
  if (success && materialModal) {
    materialModal.hide();
  }
};

const openStockAdjustmentModal = (material) => {
  selectedMaterial.value = material;
  stockAdjustment.value = {
    type: 'add',
    quantity: 0,
    reason: 'purchase',
    otherReason: '',
    notes: ''
  };
  if (stockModal) {
    stockModal.show();
  }
};

const setAdjustmentType = (type) => {
  stockAdjustment.value.type = type;
};

const handleSaveStockAdjustment = async () => {
  if (selectedMaterial.value && stockAdjustment.value.quantity > 0) {
    const success = await adjustStock(selectedMaterial.value.id, stockAdjustment.value);
    if (success && stockModal) {
      stockModal.hide();
    }
  }
};

const confirmDelete = (material) => {
  materialToDelete.value = material;
  if (deleteModal) {
    deleteModal.show();
  }
};

const handleDeleteMaterial = async () => {
  if (materialToDelete.value) {
    const success = await deleteMaterial(materialToDelete.value.id);
    if (success && deleteModal) {
      deleteModal.hide();
    }
  }
};

// Helper functions
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2
  }).format(amount || 0);
};

const getStockStatus = (material) => {
  if (material.quantity === 0) return 'Stokta Yok';
  if (material.quantity <= material.minQuantity) return `Kritik Seviye (${material.quantity}/${material.minQuantity})`;
  return `Yeterli (${material.quantity}/${material.minQuantity})`;
};

const getStockTextClass = (material) => {
  if (material.quantity === 0) return 'text-danger';
  if (material.quantity <= material.minQuantity) return 'text-warning';
  return 'text-success';
};

const getStockLevelClass = (material) => {
  if (material.quantity === 0) return 'bg-danger';
  if (material.quantity <= material.minQuantity) return 'bg-warning';
  return 'bg-success';
};

const getStockPercentage = (material) => {
  if (material.quantity <= 0) return 0;
  if (material.quantity >= material.minQuantity) return 100;
  return (material.quantity / material.minQuantity) * 100;
};

const getStockPillClass = (material) => {
  if (material.quantity === 0) return 'bg-danger';
  if (material.quantity <= material.minQuantity) return 'bg-warning';
  return 'bg-success';
};

const getStockPillText = (material) => {
  if (material.quantity === 0) return 'Stokta Yok';
  if (material.quantity <= material.minQuantity) return 'Kritik Seviye';
  return 'Stokta';
};

const pageNumbers = computed(() => {
  const pages = [];
  const maxVisiblePages = 5;
  
  if (totalPages.value <= maxVisiblePages) {
    for (let i = 1; i <= totalPages.value; i++) pages.push(i);
  } else {
    pages.push(1);
    const start = Math.max(2, currentPage.value - 1);
    const end = Math.min(totalPages.value - 1, currentPage.value + 1);
    if (start > 2) pages.push('...');
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages.value - 1) pages.push('...');
    pages.push(totalPages.value);
  }
  return pages;
});


// Lifecycle hooks
onMounted(() => {
  loadMaterials();
  materialModal = new Modal(document.getElementById('materialModal'));
  stockModal = new Modal(document.getElementById('stockModal'));
  deleteModal = new Modal(document.getElementById('deleteConfirmModal'));
});
</script>

<style scoped>
.materials-page {
  margin-bottom: 2rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

.page-header h1 {
  margin-bottom: 0.25rem;
}

.page-actions {
  display: flex;
  gap: 0.5rem;
}

.search-box {
  width: 280px;
}

.table {
  margin-bottom: 0;
}

.table th {
  cursor: pointer;
  white-space: nowrap;
}

.stock-bar {
  width: 100%;
  height: 6px;
  background-color: var(--bs-gray-200);
  border-radius: 3px;
  overflow: hidden;
}

.stock-level {
  height: 100%;
  transition: width 0.3s ease;
}

.stock-text {
  font-size: 0.75rem;
  display: block;
  margin-top: 2px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
  color: var(--text-muted);
}

.empty-state i {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.pagination-info {
  color: var(--text-muted);
  font-size: 0.875rem;
}

.materials-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
  padding: 1rem;
}

.material-card {
  background-color: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  overflow: hidden;
  transition: transform 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}

.material-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
}

.material-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-color);
}

.material-icon {
  font-size: 1.75rem;
  color: var(--primary-color);
  margin-right: 0.75rem;
}

.material-name {
  margin-bottom: 0;
  font-size: 1rem;
}

.material-code {
  font-size: 0.75rem;
  color: var(--text-muted);
  display: block;
}

.stock-pill {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 1rem;
  color: white;
}

.material-card-body {
  padding: 1rem;
}

.material-info {
  display: flex;
  margin-bottom: 0.5rem;
}

.material-info:last-child {
  margin-bottom: 0;
}

.info-label {
  font-weight: 500;
  margin-right: 0.5rem;
  width: 100px;
}

.material-card-footer {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--border-color);
  background-color: var(--bg-subtle);
}

.empty-state-grid {
  grid-column: 1 / -1;
}

.proactive-card {
  border-left: 6px solid #dc3545;
  background: #fff0f3;
  box-shadow: 0 2px 8px rgba(220,53,69,0.08);
  border-radius: 8px;
  padding: 14px 18px;
  margin-bottom: 12px;
  transition: box-shadow 0.2s, border-color 0.2s;
}
.proactive-card:focus, .proactive-card:hover {
  box-shadow: 0 4px 16px rgba(220,53,69,0.18);
  border-color: #b02a37;
}

@media (max-width: 992px) {
  .page-header {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }
  
  .page-actions {
    justify-content: flex-start;
  }
}

@media (max-width: 768px) {
  .search-box {
    width: 100%;
  }
}
</style>