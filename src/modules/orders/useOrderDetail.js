/**
 * useOrderDetail.js
 * Sipariş detay sayfası için composable
 */

import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { apiService } from '@/services/api-service';
import { aiService } from '@/services/ai-service.js';
import { useNotificationStore } from '@/store/notification';

export const useOrderDetail = () => {
  const route = useRoute();
  const router = useRouter();
  const notificationStore = useNotificationStore();
  
  // State
  const order = ref(null);
  const isLoading = ref(true);
  const isAnalyzing = ref(false);
  const aiAnalysis = ref(null);
  const aiSuggestions = ref([]);
  const relatedMaterials = ref([]);
  const timeline = ref([]);
  const notes = ref([]);
  const newNote = ref({ text: '', priority: 'normal', assignedTo: null });
  const noteLoading = ref(false);
  const productionSteps = ref([]);
  const productionData = ref([]);
  
  // Computed
  const orderId = computed(() => route.params.id);
  const orderNo = computed(() => order.value?.orderNo || '');
  const customerName = computed(() => order.value?.customerInfo?.name || '');
  const isDelayed = computed(() => {
    if (!order.value) return false;
    
    // Sipariş gecikmesi kontrolü
    const today = new Date();
    const deliveryDate = new Date(order.value.deliveryDate);
    
    if (order.value.status === 'completed') return false;
    
    return deliveryDate < today;
  });
  
  const orderStatusClass = computed(() => {
    if (!order.value) return '';
    
    switch (order.value.status) {
      case 'planned': return 'bg-info';
      case 'in_progress': return 'bg-primary';
      case 'delayed': return 'bg-danger';
      case 'completed': return 'bg-success';
      default: return 'bg-secondary';
    }
  });
  
  const orderStatusText = computed(() => {
    if (!order.value) return '';
    
    switch (order.value.status) {
      case 'planned': return 'Planlandı';
      case 'in_progress': return 'Üretimde';
      case 'delayed': return 'Gecikmiş';
      case 'completed': return 'Tamamlandı';
      default: return 'Belirsiz';
    }
  });
  
  const hasCriticalNotes = computed(() => {
    return notes.value.some(note => note.priority === 'critical' && !note.resolved);
  });
  
  const hasWarningNotes = computed(() => {
    return notes.value.some(note => note.priority === 'warning' && !note.resolved);
  });
  
  // Methods
  const loadOrder = async () => {
    isLoading.value = true;
    order.value = null; // Reset order state before loading
    aiAnalysis.value = null;
    aiSuggestions.value = [];
    
    try {
      // Sipariş verisini API'den al
      const fetchedOrder = await apiService.get(`/orders/${orderId.value}`);
      order.value = fetchedOrder; // Directly assign if API returns the order object as data
      
      // İlgili verileri yükle
      if (order.value) { // Proceed only if order was successfully fetched
        await Promise.all([
          loadOrderNotes(),
          loadOrderTimeline(),
          loadProductionSteps(),
          loadRelatedMaterials()
        ]);
      } else {
        // Handle case where order is not found or error in fetching order itself
        notificationStore.addNotification({ title: 'Hata', content: 'Sipariş bulunamadı veya yüklenemedi.', type: 'danger' });
        router.push({ name: 'Orders' }); // Redirect to orders list or a 404 page
        return; // Stop further execution if order is not loaded
      }
      
    } catch (error) {
      console.error('Sipariş yüklenirken hata:', error);
      notificationStore.addNotification({ title: 'Hata', content: `Sipariş bilgileri yüklenemedi: ${error.message}`, type: 'danger' });
      order.value = null; // Ensure order is null on error
    } finally {
      isLoading.value = false;
    }
  };
  
  const loadOrderNotes = async () => {
    if (!orderId.value) return;
    try {
      // Sipariş notlarını API'den al
      notes.value = await apiService.get(`/orders/${orderId.value}/notes`);
    } catch (error) {
      console.error('Notlar yüklenirken hata:', error);
      notes.value = []; // Reset on error
    }
  };
  
  const loadOrderTimeline = async () => {
    if (!orderId.value) return;
    try {
      // Sipariş zaman çizelgesini API'den al
      timeline.value = await apiService.get(`/orders/${orderId.value}/timeline`);
    } catch (error) {
      console.error('Zaman çizelgesi yüklenirken hata:', error);
      timeline.value = []; // Reset on error
    }
  };
  
  const loadProductionSteps = async () => {
    if (!orderId.value) return;
    try {
      // Üretim adımlarını API'den al
      const response = await apiService.get(`/orders/${orderId.value}/production`);
      productionSteps.value = response.steps || [];
      productionData.value = response.data || [];
    } catch (error) {
      console.error('Üretim adımları yüklenirken hata:', error);
      productionSteps.value = []; // Reset on error
      productionData.value = []; // Reset on error
    }
  };
  
  const loadRelatedMaterials = async () => {
    if (!orderId.value) return;
    try {
      // Siparişle ilgili malzemeleri API'den al
      relatedMaterials.value = await apiService.get(`/orders/${orderId.value}/materials`);
    } catch (error) {
      console.error('Malzemeler yüklenirken hata:', error);
      relatedMaterials.value = []; // Reset on error
    }
  };
  
  const performAIAnalysis = async () => {
    if (isAnalyzing.value || !order.value) return;
    
    isAnalyzing.value = true;
    
    try {
      // AI analizi için aiService kullan
      const analysis = await aiService.analyzeOrder(orderId.value);
      
      aiAnalysis.value = analysis;
      
      // Önerileri güncelle
      generateAISuggestions();
      
      // Analiz tamamlandığında bildirim göster
      notificationStore.addNotification({ title: 'AI Analizi', content: 'Sipariş analizi tamamlandı.', type: 'info' });
    } catch (error) {
      console.error('AI Analizi yapılırken hata:', error);
      notificationStore.addNotification({ title: 'AI Analizi Hatası', content: 'Sipariş analizi yapılamadı.', type: 'danger' });
    } finally {
      isAnalyzing.value = false;
    }
  };
  
  const generateAISuggestions = () => {
    // Sipariş durumuna göre öneriler oluştur
    const suggestions = [];
    
    if (order.value) {
      if (isDelayed.value) {
        suggestions.push({
          text: 'Gecikme analizi yap',
          action: 'analyze-delay'
        });
        suggestions.push({
          text: 'Müşteriye bildirim gönder',
          action: 'notify-customer'
        });
      }
      
      if (hasCriticalNotes.value) {
        suggestions.push({
          text: 'Kritik sorunları incele',
          action: 'review-issues'
        });
      }
      
      if (order.value.status === 'in_progress') {
        suggestions.push({
          text: 'Üretim sürecini hızlandırma önerileri',
          action: 'optimize-production'
        });
      }
      
      // Malzeme eksikliği kontrolü
      const missingMaterials = relatedMaterials.value.filter(m => m.status === 'missing' || m.status === 'critical');
      if (missingMaterials.length > 0) {
        suggestions.push({
          text: 'Eksik malzemeleri incele',
          action: 'review-materials'
        });
      }
    }
    
    aiSuggestions.value = suggestions;
  };
  
  /**
   * AI analiz metnini formatlar
   * @param {string} analysisText - Ham analiz metni
   * @returns {string} - HTML biçimlendirilmiş metin
   */
  const formatAnalysisText = (analysisText) => {
    if (!analysisText) return '';
    
    // Önemli ifadeleri vurgula
    let formattedText = analysisText
      .replace(/(\bkritik\b|\böncelikli\b|\bacil\b|\bgecikmeli\b|\bkırmızı\b)/gi, '<span class="danger">$1</span>')
      .replace(/(\btamamlandı\b|\bbaşarılı\b|\btamam\b|\bzamanında\b|\byeşil\b)/gi, '<span class="success">$1</span>')
      .replace(/(malzeme eksikliği|tedarik sorunu|stok sorunu|üretim gecikmesi)/gi, '<span class="highlight">$1</span>');
    
    // Paragrafları bölümle
    formattedText = formattedText.replace(/\n/g, '<br>');
    
    return formattedText;
  };
  
  /**
   * AI önerisi işleme
   * @param {string} action - Öneri işlem türü
   */
  const handleSuggestion = async (action) => {
    // Öneri işlem türüne göre işlem yap
    switch(action) {
      case 'analyze-delay':
        await analyzeOrderDelay();
        break;
      case 'notify-customer':
        showCustomerNotificationModal();
        break;
      case 'review-issues':
        scrollToSection('notes-section');
        break;
      case 'optimize-production':
        await showProductionOptimizationOptions();
        break;
      case 'review-materials':
        scrollToSection('materials-section');
        break;
      default:
        console.warn('Bilinmeyen öneri işlemi:', action);
    }
  };
  
  /**
   * Gecikme analizi yapma işlemi
   */
  const analyzeOrderDelay = async () => {
    try {
      isAnalyzing.value = true;
      
      // Gecikme analizi için aiService kullan
      const delayAnalysis = await aiService.analyzeOrderDelay(orderId.value);
      
      aiAnalysis.value = delayAnalysis;
      
      notificationStore.addNotification({ title: 'Gecikme Analizi', content: 'Sipariş gecikme analizi tamamlandı.', type: 'info' });
    } catch (error) {
      console.error('Gecikme analizi yapılırken hata:', error);
      notificationStore.addNotification({ title: 'Analiz Hatası', content: 'Gecikme analizi yapılamadı.', type: 'danger' });
    } finally {
      isAnalyzing.value = false;
    }
  };
  
  /**
   * Müşteri bildirim modalını gösterme
   */
  const showCustomerNotificationModal = () => {
    // Bu fonksiyon daha sonra implemente edilecek
    // Modal gösterme işlemi burada yapılacak
    notificationStore.addNotification({ title: 'Bildirim', content: 'Müşteri bildirim özelliği yakında eklenecek.', type: 'info' });
  };
  
  /**
   * Sayfada belirli bir bölüme kaydırma
   * @param {string} sectionId - Hedef bölüm ID'si
   */
  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  
  /**
   * Üretim optimizasyon seçeneklerini gösterme
   */
  const showProductionOptimizationOptions = async () => {
    try {
      isAnalyzing.value = true;
      
      // Optimizasyon analizi için aiService kullan
      const optimizationOptions = await aiService.getProductionOptimizationOptions(orderId.value);
      
      aiAnalysis.value = optimizationOptions;
      
      notificationStore.addNotification({ title: 'Üretim Optimizasyonu', content: 'Optimizasyon önerileri hazırlandı.', type: 'info' });
    } catch (error) {
      console.error('Optimizasyon önerileri alınırken hata:', error);
      notificationStore.addNotification({ title: 'Öneri Hatası', content: 'Optimizasyon önerileri alınamadı.', type: 'danger' });
    } finally {
      isAnalyzing.value = false;
    }
  };
  
  const addNote = async () => {
    if (!newNote.value.text.trim() || noteLoading.value || !orderId.value) return;
    
    noteLoading.value = true;
    
    try {
      const noteData = {
        // orderId is part of the URL, not needed in payload for this mock setup
        text: newNote.value.text,
        priority: newNote.value.priority,
        assignedTo: newNote.value.assignedTo,
        // createdAt will be set by the mock service
      };
      
      // Not ekle
      const newAddedNote = await apiService.post(`/orders/${orderId.value}/notes`, noteData);
      
      // Notları yenile (veya yeni notu doğrudan ekle)
      // notes.value.push(newAddedNote); // Optimistic update
      await loadOrderNotes(); // Re-fetch for consistency
      
      // Form temizle
      newNote.value = { text: '', priority: 'normal', assignedTo: null };
      
      // Bildirim göster
      notificationStore.addNotification({ title: 'Not Eklendi', content: 'Sipariş notu başarıyla eklendi.', type: 'success' });
    } catch (error) {
      console.error('Not eklenirken hata:', error);
      notificationStore.addNotification({ title: 'Hata', content: 'Not eklenemedi.', type: 'danger' });
    } finally {
      noteLoading.value = false;
    }
  };
  
  const resolveNote = async (noteId) => {
    if (!orderId.value || !noteId) return;
    try {
      // Not çözüldü olarak işaretle
      await apiService.patch(`/orders/${orderId.value}/notes/${noteId}`, { resolved: true });
      
      // Notları yenile (veya yerel olarak güncelle)
      // const note = notes.value.find(n => n.id === noteId);
      // if (note) note.resolved = true; // Optimistic update
      await loadOrderNotes(); // Re-fetch for consistency
      
      // Bildirim göster
      notificationStore.addNotification({ title: 'Not Çözüldü', content: 'Sipariş notu çözüldü olarak işaretlendi.', type: 'success' });
    } catch (error) {
      console.error('Not güncellenirken hata:', error);
      notificationStore.addNotification({ title: 'Hata', content: 'Not güncellenemedi.', type: 'danger' });
    }
  };
  
  const updateOrderStatus = async (newStatus) => {
    if (!orderId.value) return;
    try {
      // Sipariş durumunu güncelle
      const updatedOrder = await apiService.patch(`/orders/${orderId.value}`, { status: newStatus });
      
      // Siparişi yeniden yükle (veya yerel olarak güncelle)
      // order.value = { ...order.value, ...updatedOrder }; // Optimistic update
      await loadOrder(); // Re-fetch for consistency
      
      // Bildirim göster
      notificationStore.addNotification({ title: 'Durum Güncellendi', content: 'Sipariş durumu güncellendi.', type: 'success' });
      
      // AI önerilerini güncelle
      generateAISuggestions();
    } catch (error) {
      console.error('Sipariş durumu güncellenirken hata:', error);
      notificationStore.addNotification({ title: 'Hata', content: 'Sipariş durumu güncellenemedi.', type: 'danger' });
    }
  };
  
  const goBack = () => {
    router.push({ name: 'OrderList' });
  };
  
  // Sipariş yükleme izle
  watch(
    () => route.params.id,
    (newId) => {
      if (newId) {
        loadOrder();
      }
    },
    { immediate: true }
  );
  
  return {
    order,
    isLoading,
    isEditing: ref(false), // Düzenleme modu için state ekle
    isAnalyzing,
    aiAnalysis,
    aiSuggestions,
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
    orderProgress: computed(() => order.value?.progress || 0),
    orderCellCount: computed(() => order.value?.cells?.length || 0),
    loadOrder,
    performAIAnalysis,
    formatAnalysisText,
    handleSuggestion,
    addNote,
    resolveNote,
    updateOrderStatus,
    goBack,
    
    // Sipariş işlemleri
    startEditing: () => { /* Düzenleme işlemi */ },
    cancelEditing: () => { /* İptal işlemi */ },
    saveChanges: async () => { /* Kaydetme işlemi */ },
    deleteOrder: async () => { /* Silme işlemi */ },
    cloneOrder: async () => { /* Kopyalama işlemi */ },
    
    // Yardımcı fonksiyonlar
    getStatusText: (status) => {
      const statusMap = {
        'planned': 'Planlandı',
        'in_progress': 'Üretimde',
        'delayed': 'Gecikmiş', 
        'completed': 'Tamamlandı',
        'canceled': 'İptal Edildi'
      };
      return statusMap[status] || status;
    },
    getStatusBadgeClass: (status) => {
      const classMap = {
        'planned': 'bg-info',
        'in_progress': 'bg-primary',
        'delayed': 'bg-danger',
        'completed': 'bg-success',
        'canceled': 'bg-secondary'
      };
      return classMap[status] || 'bg-secondary';
    }
  };
};