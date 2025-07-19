<template>
  <div class="ai-insights-dashboard">
    <div class="ai-insights-header">
      <h4 class="ai-insights-title">
        <i class="bi bi-cpu text-primary" title="Yapay Zeka İçgörüleri"></i>
        Yapay Zeka İçgörüleri
      </h4>
      <div class="ai-insights-controls">
        <button class="btn btn-sm btn-outline-secondary" @click="refreshInsights" title="İçgörüleri Yenile">
          <i class="bi bi-arrow-clockwise"></i>
          <span class="d-none d-md-inline ms-1">Yenile</span>
        </button>
        <button class="btn btn-sm btn-outline-secondary ms-2" @click="toggleFilter" :title="showFilter ? 'Filtreyi Kapat' : 'Filtrele'">
          <i class="bi" :class="showFilter ? 'bi-funnel-fill' : 'bi-funnel'"></i>
          <span class="d-none d-md-inline ms-1">Filtrele</span>
        </button>
      </div>
    </div>

    <!-- Bağlama özel özet kutusu ve hızlı aksiyonlar -->
    <div class="ai-insights-summary mb-4">
      <div class="summary-box">
        <div class="summary-title">
          <i class="bi bi-lightbulb text-warning" title="Özet"></i>
          <span>{{ summaryTitle }}</span>
        </div>
        <div class="summary-content">
          <span>{{ summaryText }}</span>
        </div>
        <div class="summary-actions mt-2">
          <button class="btn btn-sm btn-primary me-2" @click="refreshInsights" title="İçgörüleri hızlıca yenile">
            <i class="bi bi-arrow-repeat me-1"></i> Hızlı Yenile
          </button>
          <button class="btn btn-sm btn-success me-2" @click="analyzeAllInsights" title="Tüm içgörüleri analiz et">
            <i class="bi bi-graph-up-arrow me-1"></i> Tümünü Analiz Et
          </button>
          <button class="btn btn-sm btn-outline-info" @click="downloadReport" title="İçgörü raporunu indir">
            <i class="bi bi-download me-1"></i> Rapor Al
          </button>
        </div>
      </div>
    </div>
    
    <!-- Grafik: Önem dağılımı -->
    <div class="mb-4">
      <AIInsightsChart
        v-if="filteredInsights.length > 0"
        :data="importanceChartData"
        type="bar"
        labelKey="label"
        valueKey="value"
        title="Önem Dağılımı"
      />
    </div>
    <!-- Filtreler -->
    <div class="ai-insights-filter mb-3" v-if="showFilter">
      <div class="row g-2">
        <div class="col-md-4">
          <div class="form-group">
            <label class="form-label">Departman</label>
            <select class="form-select" v-model="filter.department">
              <option value="">Tümü</option>
              <option v-for="dept in departments" :key="dept" :value="dept">{{ dept }}</option>
            </select>
          </div>
        </div>
        <div class="col-md-4">
          <div class="form-group">
            <label class="form-label">Kategori</label>
            <select class="form-select" v-model="filter.category">
              <option value="">Tümü</option>
              <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
            </select>
          </div>
        </div>
        <div class="col-md-4">
          <div class="form-group">
            <label class="form-label">Önem</label>
            <select class="form-select" v-model="filter.importance">
              <option value="">Tümü</option>
              <option value="high">Yüksek</option>
              <option value="medium">Orta</option>
              <option value="low">Düşük</option>
            </select>
          </div>
        </div>
        <div class="col-12">
          <div class="d-flex justify-content-end">
            <button class="btn btn-sm btn-secondary" @click="resetFilter">
              <i class="bi bi-x-circle me-1"></i>
              Sıfırla
            </button>
            <button class="btn btn-sm btn-primary ms-2" @click="applyFilter">
              <i class="bi bi-check-circle me-1"></i>
              Uygula
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- İçgörüler listesi -->
    <div class="ai-insights-summary mb-3" v-if="filteredInsights.length > 0">
      <div class="summary-box d-flex align-items-center justify-content-between p-3 rounded bg-light border">
        <div>
          <strong>{{ filteredInsights.length }}</strong> içgörü bulundu.
          <span v-if="summary.high > 0" class="ms-3 text-danger">Yüksek: {{ summary.high }}</span>
          <span v-if="summary.medium > 0" class="ms-2 text-warning">Orta: {{ summary.medium }}</span>
          <span v-if="summary.low > 0" class="ms-2 text-info">Düşük: {{ summary.low }}</span>
        </div>
        <div>
          <button class="btn btn-sm btn-outline-primary me-2" @click="analyzeAllInsights">
            <i class="bi bi-lightning-charge me-1"></i> Tümünü Analiz Et
          </button>
          <button class="btn btn-sm btn-outline-success" @click="downloadReport">
            <i class="bi bi-file-earmark-arrow-down me-1"></i> Rapor Al
          </button>
        </div>
      </div>
    </div>
    <div class="ai-insights-content">
      <div v-if="isLoading" class="ai-insights-loading">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Yükleniyor...</span>
        </div>
        <span class="mt-2">İçgörüler yükleniyor...</span>
      </div>
      
      <div v-else-if="filteredInsights.length === 0" class="ai-insights-empty">
        <i class="bi bi-search"></i>
        <p>İçgörü bulunamadı.</p>
      </div>
      
      <div v-else class="ai-insights-grid">
        <div v-for="insight in filteredInsights" :key="insight.id" class="ai-insight-card" tabindex="0" :title="insight.title">
          <div class="ai-insight-card-header">
            <div class="ai-insight-card-title">
              <i :class="getInsightIcon(insight) + ' insight-icon'" :title="insight.category"></i>
              <h6 class="m-0 ms-2">{{ insight.title }}</h6>
              <span v-if="insight.type === 'critical'" class="badge bg-danger ms-2" title="Kritik İçgörü">Kritik</span>
              <span v-else-if="insight.type === 'delayed'" class="badge bg-warning text-dark ms-2" title="Geciken İçgörü">Geciken</span>
              <span v-else-if="insight.type === 'suggestion'" class="badge bg-info text-dark ms-2" title="Öneri">Öneri</span>
              <span v-else-if="insight.type === 'prediction'" class="badge bg-primary ms-2" title="Tahmin">Tahmin</span>
            </div>
            <div class="ai-insight-card-badges">
              <span class="badge" :class="getImportanceBadge(insight.importance)" :title="getImportanceLabel(insight.importance)">
                {{ getImportanceLabel(insight.importance) }}
              </span>
            </div>
          </div>
          
          <div class="ai-insight-card-content">
            <p class="mb-2">{{ insight.description }}</p>
            
            <!-- Tahmin sonuçları varsa -->
            <div v-if="insight.predictions && insight.predictions.length > 0" class="mt-3">
              <PredictionResults 
                :predictions="insight.predictions" 
                :confidence="insight.confidence || 0.7"
              />
            </div>
            
            <!-- CAD model önizlemesi varsa -->
            <div v-if="insight.modelId" class="mt-3">
              <ModelPreview 
                :modelId="insight.modelId"
                :name="insight.modelName"
              />
            </div>
            
            <!-- İlgili dokümanlar varsa -->
            <div v-if="insight.relatedDocuments && insight.relatedDocuments.length > 0" class="mt-3">
              <RelatedDocuments 
                :documents="insight.relatedDocuments"
                @view="viewDocument"
              />
            </div>
          </div>
          
          <div class="ai-insight-card-footer">
            <div class="ai-insight-card-meta">
              <span class="ai-insight-card-department">{{ insight.department }}</span>
              <span class="ai-insight-card-date">
                <i class="bi bi-clock me-1"></i>
                {{ formatDate(insight.date) }}
              </span>
            </div>
            <div class="ai-insight-card-actions">
              <button 
                v-if="insight.actions && insight.actions.includes('analyze')" 
                class="btn btn-sm btn-outline-primary"
                @click="analyzeInsight(insight)"
              >
                <i class="bi bi-graph-up me-1"></i>
                Analiz Et
              </button>
              <button 
                v-if="insight.actions && insight.actions.includes('view3d')" 
                class="btn btn-sm btn-outline-info ms-1"
                @click="viewModel(insight.modelId)"
              >
                <i class="bi bi-box me-1"></i>
                3D Görünüm
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Analizler için ML Panel -->
    <MachineLearningPanel 
      v-if="showMlPanel" 
      @close="showMlPanel = false"
      @run-prediction="runPrediction"
    />
    
    <!-- 3D Model Görüntüleme -->
    <CADViewerModal
      v-if="selectedModelId"
      :modelId="selectedModelId"
      @close="selectedModelId = null"
    />
    
    <!-- ML Çalıştırma Sonucu -->
    <div v-if="mlResult" class="ml-result-modal" @click="closeMlResult">
      <div class="ml-result-content" @click.stop>
        <div class="ml-result-header">
          <h5>Analiz Sonucu</h5>
          <button class="btn-close" @click="closeMlResult"></button>
        </div>
        <div class="ml-result-body">
          <PredictionResults 
            :predictions="mlResult.predictions"
            :confidence="mlResult.confidence"
          />
        </div>
      </div>
    </div>

    <!-- Üretim öğrenme özeti kutusu (sadece üretim modülünde göster) -->
    <div v-if="category === 'üretim' && productionLearningSummary" class="ai-insights-summary mb-3">
      <div class="summary-box bg-warning bg-opacity-10 border border-warning rounded p-3">
        <div class="summary-title mb-2">
          <i class="bi bi-bar-chart-line"></i>
          <span>Üretim Öğrenme Özeti</span>
        </div>
        <div class="summary-content">
          <span><strong>Toplam Sipariş:</strong> {{ productionLearningSummary.totalOrders }}</span>
          <span class="ms-3"><strong>Ortalama Gecikme:</strong> {{ productionLearningSummary.avgDelay.toFixed(2) }} gün</span>
          <span class="ms-3"><strong>Ortalama Kalite Skoru:</strong> {{ productionLearningSummary.avgQualityScore.toFixed(2) }}</span>
          <span class="ms-3"><strong>Son Güncelleme:</strong> {{ formatDate(productionLearningSummary.lastUpdated) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, reactive } from 'vue';
import { aiService, getProductionLearningSummary } from '@/services/ai-service.js';
import PredictionResults from '@/components/ai/PredictionResults.vue';
import MachineLearningPanel from './MachineLearningPanel.vue'
import ModelPreview from './ModelPreview.vue'
import RelatedDocuments from './RelatedDocuments.vue'
import CADViewerModal from './CADViewerModal.vue'
import AIInsightsChart from '@/components/ui/charts/AIInsightsChart.vue'
import logger from '@/utils/logger';
import { useToast } from '@/composables/useToast';

const emit = defineEmits(['insights-loaded']);

// --- YENİ: Modül bazlı filtreleme için context/category prop'u ---
const props = defineProps({
  category: { type: String, default: '' }, // Örn: 'stok', 'üretim', 'planlama' vb.
  context: { type: String, default: '' }, // Gerekirse daha esnek context
});

const toast = useToast();

// State
const insights = ref([]) // Initialize as an empty array
const isLoading = ref(false)
const showFilter = ref(false)
const filter = reactive({
  department: '',
  category: '',
  importance: ''
})
const showMlPanel = ref(false)
const selectedModelId = ref(null)
const mlResult = ref(null)

// --- Üretim öğrenme özeti state'i ---
const productionLearningSummary = ref(null);

// --- Üretim öğrenme özetini güncel tutan gelişmiş watcher ---
watch(
  () => [filteredInsights.value, props.category],
  async ([insights, category]) => {
    if (category === 'üretim') {
      // getProductionLearningSummary her zaman güncel state döner
      productionLearningSummary.value = getProductionLearningSummary();
    }
  },
  { immediate: true, deep: true }
);

// Filtrelenmiş içgörüler
const filteredInsights = computed(() => {
  if (!Array.isArray(insights.value)) {
    return [];
  }
  let result = [...insights.value];

  // --- YENİ: Modül bazlı otomatik kategori filtreleme ---
  if (props.category) {
    result = result.filter(insight => insight.category === props.category);
  }
  if (props.context) {
    // Gerekirse context'e göre ek filtreleme yapılabilir
  }

  if (filter.department) {
    result = result.filter(insight => insight.department === filter.department)
  }
  if (filter.category) {
    result = result.filter(insight => insight.category === filter.category)
  }
  if (filter.importance) {
    result = result.filter(insight => insight.importance === filter.importance)
  }
  return result
})

// Departman listesi
const departments = computed(() => {
  const depts = new Set()
  let sourceArray = [];
  if (Array.isArray(insights.value)) {
    sourceArray = insights.value;
  } else if (insights.value && Array.isArray(insights.value.insightsArray)) {
    sourceArray = insights.value.insightsArray;
  } else if (insights.value && Array.isArray(insights.value.value)) {
    sourceArray = insights.value.value;
  }

  sourceArray.forEach(insight => {
    if (insight.department) {
      depts.add(insight.department)
    }
  })
  return [...depts]
})

// Kategori listesi
const categories = computed(() => {
  const cats = new Set()
  let sourceArray = [];
  if (Array.isArray(insights.value)) {
    sourceArray = insights.value;
  } else if (insights.value && Array.isArray(insights.value.insightsArray)) {
    sourceArray = insights.value.insightsArray;
  } else if (insights.value && Array.isArray(insights.value.value)) {
    sourceArray = insights.value.value;
  }

  sourceArray.forEach(insight => {
    if (insight.category) {
      cats.add(insight.category)
    }
  })
  return [...cats]
})

// --- YENİ: Önem derecesine göre ikon ve badge renkleri için yardımcı fonksiyonlar ---
const getImportanceIcon = (importance) => {
  switch (importance) {
    case 'high':
      return 'bi bi-exclamation-triangle-fill text-danger';
    case 'medium':
      return 'bi bi-exclamation-circle-fill text-warning';
    case 'low':
      return 'bi bi-info-circle-fill text-info';
    default:
      return 'bi bi-dot text-secondary';
  }
};

// İçgörü tipine göre ikon al
const getInsightIcon = (insight) => {
  const category = insight.category ? insight.category.toLowerCase() : ''
  switch (category) {
    case 'üretim':
    case 'production':
      return 'bi bi-gear-fill text-primary';
    case 'stok':
    case 'inventory':
      return 'bi bi-box-seam-fill text-success';
    case 'kalite':
    case 'quality':
      return 'bi bi-check-circle-fill text-info';
    case 'analiz':
    case 'analysis':
      return 'bi bi-graph-up text-secondary';
    case 'bakım':
    case 'maintenance':
      return 'bi bi-tools text-warning';
    case 'planlama':
    case 'planning':
      return 'bi bi-calendar-event text-primary';
    default:
      return 'bi bi-lightbulb-fill text-secondary';
  }
}

// Önem derecesine göre sınıf
const getImportanceBadge = (importance) => {
  switch (importance) {
    case 'high':
      return 'bg-danger'
    case 'medium':
      return 'bg-warning'
    case 'low':
      return 'bg-info'
    default:
      return 'bg-secondary'
  }
}

// Önem derecesi etiketi
const getImportanceLabel = (importance) => {
  switch (importance) {
    case 'high':
      return 'Yüksek'
    case 'medium':
      return 'Orta'
    case 'low':
      return 'Düşük'
    default:
      return 'Normal'
  }
}

// Tarihi formatla
const formatDate = (dateString) => {
  if (!dateString) return ''
  
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return dateString
  
  return new Intl.DateTimeFormat('tr-TR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date)
}

// İçgörüleri yükle
const loadInsights = async () => {
  // FIX: 'options' is not defined hatası düzeltildi ve tekrar eden kontrol kaldırıldı.
  if (isLoading.value) {
    logger.warn('[AIInsightsDashboard] Zaten bir yükleme işlemi devam ediyor. Yeni istek başlatılmadı.');
    return;
  }
  try {
    isLoading.value = true
    const data = await aiService.getInsights();
    if (Array.isArray(data)) {
      insights.value = data;
    } else if (data && data.isDemo && Array.isArray(data.insightsArray)) {
      insights.value = data.insightsArray;
    } else if (data && data.isDemo && Array.isArray(data.value)) {
      insights.value = data.value;
    } else {
      insights.value = [];
      logger.warn('[AIInsightsDashboard] getInsights beklenen formatta veri döndürmedi, boş dizi kullanılıyor.', data);
    }
    // --- insights-loaded emit ---
    emit('insights-loaded', insights.value);
  } catch (error) {
    logger.error('İçgörüler yüklenirken hata:', error)
    toast.error('İçgörüler yüklenirken bir hata oluştu.'); // UX: Hata durumunda kullanıcıyı bilgilendir.
    insights.value = [];
  } finally {
    isLoading.value = false
  }
}

// İçgörüleri yenile
const refreshInsights = () => {
  // UX: Yenileme sırasında kullanıcıya geri bildirim ver.
  if (isLoading.value) {
    toast.info('İçgörüler zaten yenileniyor, lütfen bekleyin.');
    return;
  }
  toast.success('İçgörüler yenileniyor...');
  loadInsights();
}

// Filtre panelini göster/gizle
const toggleFilter = () => {
  showFilter.value = !showFilter.value
}

// Filtre uygula
const applyFilter = () => {
  showFilter.value = false
}

// Filtreyi sıfırla
const resetFilter = () => {
  filter.department = ''
  filter.category = ''
  filter.importance = ''
}

// İçgörü analizi yap
const analyzeInsight = (insight) => {
  showMlPanel.value = true
}

// 3D Modeli görüntüle
const viewModel = (modelId) => {
  selectedModelId.value = modelId
}

// Dokümanı görüntüle
const viewDocument = (document) => {
  const url = document.url || document.path
  if (url) {
    window.open(url, '_blank')
  } else {
    alert('Doküman bulunamadı')
  }
}

// ML tahmin çalıştır
const runPrediction = async (analysisType, options) => {
  try {
    const result = await aiService.runPrediction(analysisType, options)
    mlResult.value = result
    showMlPanel.value = false
  } catch (error) {
    console.error('Tahmin çalıştırılırken hata:', error)
    alert('Tahmin çalıştırılırken bir hata oluştu')
  }
}

// ML sonuçlarını kapat
const closeMlResult = () => {
  mlResult.value = null
}

// Component oluşturulduğunda
onMounted(() => {
  // Tekrar eden `isLoading` kontrolü kaldırıldı, artık `loadInsights` içinde yönetiliyor.
  loadInsights();
  
  if (props.category === 'üretim') {
    productionLearningSummary.value = getProductionLearningSummary();
  }
})

// Eğer üretim verisi güncellendiğinde özetin de güncellenmesi gerekiyorsa:
watch(filteredInsights, () => {
  if (props.category === 'üretim') {
    productionLearningSummary.value = getProductionLearningSummary();
  }
});

// Grafik için önem dağılımı verisi
const importanceChartData = computed(() => {
  const counts = { Yüksek: 0, Orta: 0, Düşük: 0, Normal: 0 };
  filteredInsights.value.forEach(insight => {
    const label = getImportanceLabel(insight.importance);
    counts[label] = (counts[label] || 0) + 1;
  });
  return Object.entries(counts).map(([label, value]) => ({ label, value }));
});

// --- YENİ: Bağlama özel özet verileri için computed property'ler ---
const summaryTitle = computed(() => {
  if (props.category) {
    return `${props.category} Modülü İçgörüleri`;
  }
  return 'Genel İçgörüler';
});

const summaryText = computed(() => {
  const total = filteredInsights.value.length;
  const highImportance = filteredInsights.value.filter(i => i.importance === 'high').length;
  const mediumImportance = filteredInsights.value.filter(i => i.importance === 'medium').length;
  const lowImportance = filteredInsights.value.filter(i => i.importance === 'low').length;
  
  return `Toplam ${total} içgörü bulundu. (Yüksek: ${highImportance}, Orta: ${mediumImportance}, Düşük: ${lowImportance})`;
});

// --- YENİ: Özet istatistikler ---
const summary = computed(() => {
  const high = filteredInsights.value.filter(i => i.importance === 'high').length;
  const medium = filteredInsights.value.filter(i => i.importance === 'medium').length;
  const low = filteredInsights.value.filter(i => i.importance === 'low').length;
  return { high, medium, low };
});

// --- YENİ: Tümünü Analiz Et fonksiyonu ---
const analyzeAllInsights = () => {
  if (filteredInsights.value.length === 0) {
    toast.warn('Analiz edilecek içgörü bulunamadı.');
    return;
  }
  showMlPanel.value = true;
  toast.success('Tüm içgörüler için analiz başlatıldı. Sonuçlar ML panelinde görüntülenecek.');
};

// --- YENİ: Rapor Al fonksiyonu ---
const downloadReport = () => {
  if (filteredInsights.value.length === 0) {
    toast.warn('Rapor için içgörü bulunamadı.');
    return;
  }
  try {
    const headers = ['Başlık', 'Açıklama', 'Departman', 'Kategori', 'Önem', 'Tarih'];
    const rows = filteredInsights.value.map(i => [
      i.title,
      i.description,
      i.department,
      i.category,
      getImportanceLabel(i.importance),
      formatDate(i.date)
    ]);
    const csv = [headers, ...rows].map(r => r.map(x => '"' + (x || '') + '"').join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ai-insights-report.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Rapor başarıyla indirildi.');
  } catch (e) {
    toast.error('Rapor indirilirken bir hata oluştu.');
  }
};
</script>

<style scoped>
.ai-insights-dashboard {
  padding: 20px;
}

.ai-insights-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.ai-insights-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ai-insights-summary {
  background-color: var(--bg-light, #f8f9fa);
  border: 1px solid var(--border-color, #dee2e6);
  border-radius: 8px;
  padding: 15px;
}

.summary-box {
  display: flex;
  flex-direction: column;
}

.summary-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  color: var(--primary-color, #0d6efd);
}

.summary-content {
  margin-top: 8px;
  color: var(--text-muted, #6c757d);
}

.summary-actions {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.ai-insight-card {
  background: #fff;
  border: 1px solid #e3e6ea;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.03);
  padding: 18px 16px 12px 16px;
  margin-bottom: 18px;
  transition: box-shadow 0.2s, border-color 0.2s, transform 0.15s;
  outline: none;
}
.ai-insight-card:focus, .ai-insight-card:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,0.08);
  border-color: #0d6efd;
  transform: translateY(-2px) scale(1.01);
}
.insight-icon {
  font-size: 1.5rem;
  vertical-align: middle;
  margin-right: 2px;
  filter: drop-shadow(0 1px 2px #f8e9a1);
}
.badge {
  font-size: 0.85em;
  padding: 0.4em 0.7em;
  border-radius: 0.7em;
  letter-spacing: 0.01em;
}

/* Responsive */
@media (max-width: 576px) {
  .ai-insights-dashboard {
    padding: 10px;
  }
  .ai-insights-grid {
    grid-template-columns: 1fr;
  }
  .ai-insight-card {
    padding: 12px 8px 8px 8px;
  }
}
</style>