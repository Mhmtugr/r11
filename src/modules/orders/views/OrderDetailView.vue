<template>
  <div class="order-detail">
    <div v-if="isLoading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Yükleniyor...</span>
      </div>
    </div>
    
    <div v-else-if="!order" class="alert alert-warning">
      Sipariş bulunamadı veya erişim yetkiniz yok.
    </div>
    
    <div v-else>
      <!-- Header -->
      <div class="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h1>{{ order.orderNo }}</h1>
          <p class="text-muted">
            Sipariş Tarihi: {{ new Date(order.orderDate).toLocaleDateString('tr-TR') }}
          </p>
        </div>
        
        <div class="d-flex gap-2">
          <button v-if="!isEditing" @click="startEditing" class="btn btn-outline-primary">
            <i class="bi bi-pencil me-1"></i> Düzenle
          </button>
          <button v-if="!isEditing" @click="confirmClone" class="btn btn-outline-secondary">
            <i class="bi bi-copy me-1"></i> Kopyala
          </button>
          <button v-if="!isEditing" @click="confirmDelete" class="btn btn-outline-danger">
            <i class="bi bi-trash me-1"></i> Sil
          </button>
          <router-link :to="{ name: 'Orders' }" class="btn btn-outline-secondary">
            <i class="bi bi-arrow-left me-1"></i> Siparişler
          </router-link>
        </div>
      </div>
      
      <!-- Durum Bilgisi -->
      <div class="card mb-4">
        <div class="card-body">
          <div class="row">
            <div class="col-md-3">
              <div class="d-flex align-items-center">
                <span class="me-2">Durum:</span>
                <span class="badge" :class="getStatusBadgeClass(order.status)">
                  {{ getStatusText(order.status) }}
                </span>
              </div>
            </div>
            <div class="col-md-6">
              <div class="d-flex align-items-center">
                <span class="me-2">İlerleme:</span>
                <div class="progress flex-grow-1">
                  <div 
                    class="progress-bar" 
                    role="progressbar" 
                    :style="`width: ${orderProgress}%`"
                    :class="{
                      'bg-success': orderProgress === 100,
                      'bg-info': orderProgress >= 75 && orderProgress < 100,
                      'bg-primary': orderProgress >= 50 && orderProgress < 75,
                      'bg-warning': orderProgress >= 25 && orderProgress < 50,
                      'bg-danger': orderProgress < 25
                    }"
                    :aria-valuenow="orderProgress" 
                    aria-valuemin="0" 
                    aria-valuemax="100">
                    {{ orderProgress }}%
                  </div>
                </div>
              </div>
            </div>
            <div class="col-md-3">
              <div class="d-flex align-items-center">
                <span class="me-2">Öncelik:</span>
                <span class="badge" :class="{
                  'bg-danger': order.priority === 'high',
                  'bg-warning': order.priority === 'medium',
                  'bg-info': order.priority === 'low'
                }">
                  {{ order.priority === 'high' ? 'Yüksek' : 
                     order.priority === 'medium' ? 'Orta' : 
                     order.priority === 'low' ? 'Düşük' : 'Normal' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- AI Analizi ve Öneriler -->
      <div class="card mb-4">
        <div class="card-header d-flex justify-content-between align-items-center">
          <h5 class="mb-0">
            <i class="bi bi-robot me-2"></i>
            Yapay Zeka Analizi
          </h5>
          <button 
            class="btn btn-sm" 
            :class="isAnalyzing ? 'btn-secondary disabled' : 'btn-primary'" 
            @click="performAIAnalysis"
            :disabled="isAnalyzing">
            <span v-if="isAnalyzing" class="spinner-border spinner-border-sm me-1" role="status"></span>
            {{ isAnalyzing ? 'Analiz yapılıyor...' : 'Analizi Yenile' }}
          </button>
        </div>
        <div class="card-body">
          <div v-if="isAnalyzing" class="text-center py-3">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Analiz yapılıyor...</span>
            </div>
            <p class="mt-2 text-muted">Siparişiniz yapay zeka tarafından analiz ediliyor...</p>
          </div>
          
          <div v-else-if="!aiAnalysis && !aiSuggestions.length" class="text-center py-3">
            <i class="bi bi-lightbulb fs-1 text-warning"></i>
            <p class="mt-2">Henüz bir analiz yapılmamış. "Analizi Yenile" butonuna tıklayarak sipariş hakkında yapay zeka değerlendirmesi alabilirsiniz.</p>
          </div>
          
          <div v-else>
            <!-- Analiz Sonuçları -->
            <div v-if="aiAnalysis" class="mb-4">
              <h6>Sipariş Değerlendirmesi:</h6>
              <p class="analysis-text" v-html="formatAnalysisText(aiAnalysis)"></p>
            </div>
            
            <!-- Öneriler -->
            <div v-if="aiSuggestions.length" class="mt-4">
              <h6>Yapay Zeka Önerileri:</h6>
              <div class="row g-3 mt-1">
                <div v-for="suggestion in aiSuggestions" :key="suggestion.action" class="col-md-6 col-lg-4">
                  <div class="card h-100 suggestion-card">
                    <div class="card-body">
                      <p class="card-text">{{ suggestion.text }}</p>
                    </div>
                    <div class="card-footer bg-transparent">
                      <button class="btn btn-sm btn-outline-primary" @click="handleSuggestion(suggestion.action)">
                        <i class="bi bi-lightning me-1"></i>
                        Uygula
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Düzenleme Formu -->
      <div v-if="isEditing" class="card mb-4">
        <!-- ... Form içeriği ... -->
      </div>
      
      <div class="row">
        <!-- Müşteri ve Sipariş Detayları -->
        <div class="col-lg-6">
          <div class="card mb-4">
            <!-- ... Müşteri bilgileri ... -->
          </div>
        </div>
        
        <!-- Hücre Listesi -->
        <div class="col-lg-6">
          <div class="card mb-4">
            <!-- ... Hücre bilgileri ... -->
          </div>
        </div>
      </div>
      
      <!-- Üretim Aşamaları -->
      <div class="card mb-4">
        <!-- ... Üretim aşamaları ... -->
      </div>
      
      <!-- İlgili Dokümanlar -->
      <div class="card mb-4">
        <!-- ... Dokümanlar ... -->
      </div>
      
      <!-- Notlar -->
      <div class="card mb-4">
        <!-- ... Notlar ... -->
      </div>
    </div>
    
    <!-- Silme Onay Modalı -->
    <div v-if="showDeleteModal" class="modal fade show" style="display: block;">
      <!-- ... Modal içeriği ... -->
    </div>
    
    <!-- Kopyalama Onay Modalı -->
    <div v-if="showCloneModal" class="modal fade show" style="display: block;">
      <!-- ... Modal içeriği ... -->
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useOrderDetail } from '@/modules/orders/useOrderDetail';

const router = useRouter();

// useOrderDetail composable'dan gerekli state ve metotları al
const {
  order,
  isLoading,
  isEditing,
  isAnalyzing,
  aiAnalysis,
  aiSuggestions,
  productionStages,
  documents,
  editForm,
  orderProgress,
  orderCellCount,
  loadOrder, // Corrected: was loadOrderDetail
  performAIAnalysis,
  startEditing,
  cancelEditing,
  saveChanges,
  deleteOrder,
  cloneOrder,
  getStatusText,
  getStatusBadgeClass,
  formatAnalysisText,
  handleSuggestion,
  relatedMaterials,
  timeline,
  notes,
  newNote,
  noteLoading,
  productionSteps,
  productionData,
  orderId,
  orderNo,
  customerName,
  isDelayed,
  orderStatusClass,
  orderStatusText,
  hasCriticalNotes,
  hasWarningNotes,
  addNote,
  resolveNote,
  updateOrderStatus,
  goBack
} = useOrderDetail();

// Modal state
const showDeleteModal = ref(false);
const showCloneModal = ref(false);
const isActionLoading = ref(false);

// Sipariş silme onayı
function confirmDelete() {
  showDeleteModal.value = true;
}

// Sipariş kopyalama onayı
function confirmClone() {
  showCloneModal.value = true;
}

// Sipariş silme işlemi
async function handleDeleteOrder() {
  try {
    isActionLoading.value = true;
    const result = await deleteOrder();
    
    if (result) {
      // Başarılı silme sonrası liste sayfasına yönlendir
      router.push({ name: 'Orders' });
    }
    
    showDeleteModal.value = false;
  } catch (error) {
    console.error('Sipariş silinirken hata:', error);
  } finally {
    isActionLoading.value = false;
  }
}

// Sipariş kopyalama işlemi
async function handleCloneOrder() {
  try {
    isActionLoading.value = true;
    const result = await cloneOrder();
    
    if (result) {
      // Başarılı kopyalama sonrası yeni siparişe yönlendir
      showCloneModal.value = false;
    }
  } catch (error) {
    console.error('Sipariş kopyalanırken hata:', error);
  } finally {
    isActionLoading.value = false;
  }
}

// Dosya boyutunu biçimlendir
function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Doküman tipi metni
function getDocumentTypeText(type) {
  const types = {
    'contract': 'Sözleşme',
    'technical': 'Teknik Doküman',
    'drawing': 'Teknik Çizim',
    'invoice': 'Fatura',
    'report': 'Rapor'
  };
  
  return types[type] || type || 'Diğer';
}

// Tarih formatı
const formatDate = (dateStr, includeTime = false) => {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
    if (includeTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
    }
    return new Intl.DateTimeFormat('tr-TR', options).format(date);
  } catch (error) {
    return dateStr;
  }
};

const getProgressBarClass = (progress) => {
  if (progress >= 100) return 'bg-success';
  if (progress >= 75) return 'bg-info';
  if (progress >= 50) return 'bg-primary';
  if (progress >= 25) return 'bg-warning';
  return 'bg-danger';
};

const getCellStatusClass = (status) => {
  switch (status) {
    case 'planned': return 'bg-info';
    case 'in_progress': return 'bg-primary';
    case 'delayed': return 'bg-danger';
    case 'completed': return 'bg-success';
    default: return 'bg-secondary';
  }
};

const getCellStatusText = (status) => {
  switch (status) {
    case 'planned': return 'Planlandı';
    case 'in_progress': return 'Üretimde';
    case 'delayed': return 'Gecikmiş';
    case 'completed': return 'Tamamlandı';
    default: return 'Belirsiz';
  }
};

const getStepStatusClass = (status) => {
  switch (status) {
    case 'pending': return 'step-pending';
    case 'in-progress': return 'step-in-progress';
    case 'completed': return 'step-completed';
    case 'delayed': return 'step-delayed';
    case 'canceled': return 'step-canceled';
    default: return '';
  }
};

const getStepStatusIcon = (status) => {
  switch (status) {
    case 'pending': return 'bi bi-clock';
    case 'in-progress': return 'bi bi-arrow-right-circle';
    case 'completed': return 'bi bi-check-circle';
    case 'delayed': return 'bi bi-exclamation-circle';
    case 'canceled': return 'bi bi-x-circle';
    default: return 'bi bi-circle';
  }
};

const getMaterialRowClass = (material) => {
  if (material.status === 'missing') {
    return 'table-danger';
  } else if (material.status === 'critical') {
    return 'table-warning';
  } else if (material.status === 'ordered') {
    return 'table-info';
  }
  return '';
};

const getStockStatusClass = (material) => {
  switch (material.status) {
    case 'available': return 'bg-success';
    case 'partial': return 'bg-warning';
    case 'critical': return 'bg-warning';
    case 'missing': return 'bg-danger';
    case 'ordered': return 'bg-info';
    default: return 'bg-secondary';
  }
};

const getStockStatusText = (material) => {
  switch (material.status) {
    case 'available': return 'Stokta Var';
    case 'partial': return `Kısmen Mevcut (${material.availableQuantity}/${material.quantity})`;
    case 'critical': return 'Kritik Seviye';
    case 'missing': return 'Stokta Yok';
    case 'ordered': return 'Sipariş Edildi';
    default: return 'Bilinmiyor';
  }
};

const getNotePriorityClass = (priority) => {
  switch (priority) {
    case 'normal': return 'bg-primary';
    case 'warning': return 'bg-warning';
    case 'critical': return 'bg-danger';
    default: return 'bg-secondary';
  }
};

const getNotePriorityText = (priority) => {
  switch (priority) {
    case 'normal': return 'Normal';
    case 'warning': return 'Uyarı';
    case 'critical': return 'Kritik';
    default: return 'Bilinmiyor';
  }
};

const getEventTypeClass = (type) => {
  switch (type) {
    case 'created': return 'marker-created';
    case 'updated': return 'marker-updated';
    case 'status-change': return 'marker-status';
    case 'note': return 'marker-note';
    default: return '';
  }
};

// Sayfa yüklendiğinde sipariş detaylarını yükle
onMounted(() => {
  loadOrder(); // Corrected: was loadOrderDetail
});
</script>

<style scoped>
.badge {
  font-size: 0.9rem;
}

.analysis-text {
  line-height: 1.5;
}

.analysis-text .highlight {
  background-color: rgba(var(--bs-warning-rgb), 0.2);
  padding: 0 0.2rem;
  border-radius: 0.2rem;
}

.analysis-text .success {
  color: var(--bs-success);
  font-weight: 500;
}

.analysis-text .danger {
  color: var(--bs-danger);
  font-weight: 500;
}

.suggestion-card {
  transition: all 0.2s ease-in-out;
  border: 1px solid rgba(0,0,0,0.125);
}

.suggestion-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
  border-color: var(--bs-primary);
}
</style>

<style lang="scss" scoped>
.order-detail-page {
  .card {
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
    border: none;
    border-radius: 8px;
    
    .card-header {
      background-color: #fff;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
      padding: 15px 20px;
      font-weight: 600;
    }
  }
  
  // Üretim Adımları
  .production-timeline {
    padding: 10px 0;
    
    .production-step {
      display: flex;
      margin-bottom: 20px;
      
      &:last-child {
        margin-bottom: 0;
      }
      
      .step-status {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-right: 15px;
        
        .step-indicator {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #e9ecef;
          margin-bottom: 5px;
          z-index: 2;
          
          i {
            color: #fff;
          }
          
          &.step-pending {
            background-color: #adb5bd;
          }
          
          &.step-in-progress {
            background-color: #0d6efd;
          }
          
          &.step-completed {
            background-color: #198754;
          }
          
          &.step-delayed {
            background-color: #ffc107;
          }
          
          &.step-canceled {
            background-color: #dc3545;
          }
        }
        
        .step-line {
          width: 2px;
          background-color: #e9ecef;
          flex-grow: 1;
          z-index: 1;
        }
      }
      
      .step-content {
        flex: 1;
        padding-bottom: 15px;
      }
    }
  }
  
  // Not listesi
  .notes-list {
    margin-bottom: 0;
    
    .note-item {
      display: flex;
      padding: 15px;
      border: 1px solid #e9ecef;
      border-radius: 8px;
      margin-bottom: 15px;
      background-color: #fff;
      transition: background-color 0.2s;
      
      &:last-child {
        margin-bottom: 0;
      }
      
      &.note-resolved {
        background-color: #f8f9fa;
        opacity: 0.8;
      }
      
      .note-priority-indicator {
        width: 4px;
        border-radius: 4px;
        margin-right: 15px;
        
        &.priority-normal {
          background-color: #0d6efd;
        }
        
        &.priority-warning {
          background-color: #ffc107;
        }
        
        &.priority-critical {
          background-color: #dc3545;
        }
      }
      
      .note-content {
        flex: 1;
      }
    }
  }
  
  // Zaman çizelgesi
  .timeline-container {
    padding: 15px 0;
    
    .timeline-list {
      list-style: none;
      padding: 0;
      margin: 0;
      position: relative;
      
      &::before {
        content: '';
        position: absolute;
        top: 0;
        bottom: 0;
        left: 15px;
        width: 2px;
        background-color: #e9ecef;
      }
      
      .timeline-item {
        position: relative;
        padding-left: 40px;
        margin-bottom: 15px;
        
        &:last-child {
          margin-bottom: 0;
        }
        
        .timeline-marker {
          position: absolute;
          left: 10px;
          top: 0;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          border: 2px solid #fff;
          background-color: #0d6efd;
          z-index: 1;
          
          &.marker-created {
            background-color: #198754;
          }
          
          &.marker-updated {
            background-color: #0d6efd;
          }
          
          &.marker-status {
            background-color: #6c757d;
          }
          
          &.marker-note {
            background-color: #ffc107;
          }
        }
        
        .timeline-content {
          padding: 0 0 15px;
          
          .timeline-date {
            color: #6c757d;
            display: block;
            margin-bottom: 5px;
          }
        }
      }
    }
  }
  
  // AI Analizi
  .ai-analysis-report {
    .analysis-content {
      p {
        margin-bottom: 0.75rem;
        
        &:last-child {
          margin-bottom: 0;
        }
      }
    }
  }
  
  .ai-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px;
  }
  
  // Responsive düzenlemeler
  @media (max-width: 992px) {
    .timeline-container {
      .timeline-list {
        .timeline-item {
          padding-left: 30px;
          
          .timeline-marker {
            left: 5px;
          }
        }
      }
    }
  }
}
</style>