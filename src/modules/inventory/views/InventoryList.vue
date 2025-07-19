<template>
  <div class="inventory-container p-4">
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
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h2>Envanter ve Malzeme Yönetimi</h2>
      <!-- TODO: Genel arama veya aksiyon butonu eklenebilir -->
    </div>

    <!-- Sekmeler -->
    <ul class="nav nav-tabs mb-3">
      <li class="nav-item">
        <button class="nav-link" :class="{ active: activeTab === 'lists' }" @click="activeTab = 'lists'">
          Malzeme Listeleri
        </button>
      </li>
      <li class="nav-item">
        <button class="nav-link" :class="{ active: activeTab === 'stock' }" @click="activeTab = 'stock'">
          Stok Durumu
        </button>
      </li>
      <!-- Başka sekmeler eklenebilir (örn: Malzeme Detayları) -->
    </ul>

    <!-- Sekme İçeriği -->
    <div class="tab-content">
      <!-- Malzeme Listeleri Sekmesi -->
      <div v-show="activeTab === 'lists'" class="tab-pane fade show active">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <div class="filters d-flex gap-2">
            <input type="text" class="form-control form-control-sm w-auto" placeholder="Listelerde ara...">
            <select class="form-select form-select-sm w-auto">
              <option value="">Tüm Tipler</option>
              <option value="primer">Primer</option>
              <option value="sekonder">Sekonder</option>
            </select>
             <select class="form-select form-select-sm w-auto">
              <option value="">Tüm Hücre Tipleri</option>
              <option value="RM 36 CB">RM 36 CB</option>
              <option value="RM 36 LB">RM 36 LB</option>
            </select>
          </div>
          <button class="btn btn-success btn-sm" @click="openAddMaterialListModal">
            <i class="bi bi-plus-circle"></i> Yeni Malzeme Listesi
          </button>
        </div>
        <MaterialListsTable :lists="materialLists" />
      </div>

      <!-- Stok Durumu Sekmesi -->
      <div v-show="activeTab === 'stock'" class="tab-pane fade show active">
         <h4>Stok Durumu Kontrolü</h4>
         <StockStatusChart :data="stockStatusData" />
      </div>
    </div>

    <!-- TODO: Modallar (Liste Detay/Düzenle, Malzeme Ekle/Düzenle, İçe Aktar vb.) -->
    <!-- Örnek: <MaterialListDetailModal v-model:visible="isDetailModalVisible" :list-id="currentListId" @list-updated="refreshLists" /> -->

  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import AIInsightsDashboard from '@/components/ai/AIInsightsDashboard.vue';
import MaterialListsTable from '@/components/tables/MaterialListsTable.vue';
import StockStatusChart from '@/components/ui/charts/StockStatusChart.vue';
import { useMaterialLists } from '@/modules/inventory/useMaterialLists';
import { useStockManagement } from '@/modules/inventory/useStockManagement';
import { useToast } from '@/composables/useToast';

const activeTab = ref('lists');
const { showToast } = useToast();

// Composables'ı kullanarak state ve fonksiyonları al
const { 
  lists: materialLists, 
  isLoading: isLoadingLists, 
  error: errorLists, 
  fetchLists, 
  addList 
} = useMaterialLists();

const { 
  stockData: stockStatusData, 
  isLoading: isLoadingStock, 
  error: errorStock, 
  fetchStockData 
} = useStockManagement();


const proactiveCard = ref(null);
const insightsDashboard = ref(null);

const isLoading = computed(() => isLoadingLists.value || isLoadingStock.value);
const error = computed(() => errorLists.value || errorStock.value);

const loadInitialData = async () => {
  console.log('InventoryView: Initial data loading...');
  await Promise.all([
    fetchLists(),
    fetchStockData()
  ]).catch(err => {
    console.error('InventoryView: Veri yükleme hatası:', err);
    showToast('Veri yüklenirken bir hata oluştu.', 'error');
  });
};

const openAddMaterialListModal = () => {
  console.log('Yeni malzeme listesi modalı açılacak');
  // Örnek bir liste ekleme, normalde bu modal'dan gelmeli
  addList({ name: 'Yeni Test Listesi', type: 'primer', cellType: 'RM 36 CB', materials: [] });
  showToast('Yeni malzeme listesi başarıyla eklendi!', 'success');
};

const refreshLists = () => {
  console.log('Liste yenileme tetiklendi');
  fetchLists();
};

function onInsightsLoaded(insights) {
  const critical = insights.find(i => i.type === 'critical');
  if (critical) {
    proactiveCard.value = {
      title: 'Kritik Stok Uyarısı',
      description: critical.description,
      action: critical.actions && critical.actions.length > 0 ? { 
        label: critical.actions[0].label, 
        handler: () => {
          console.log('Proaktif aksiyon tetiklendi:', critical.actions[0].action);
          // Örnek: ilgili sekmeyi aç ve detaya git
          activeTab.value = 'stock';
          alert('Kritik stok seviyesindeki malzemeler için stok sekmesi açıldı.');
        }
      } : null
    };
  } else {
    proactiveCard.value = null;
  }
}

onMounted(() => {
  loadInitialData();
});

</script>

<style scoped>
/* inventory/styles içindeki stiller buraya taşınabilir */
.nav-link {
  cursor: pointer;
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
</style>