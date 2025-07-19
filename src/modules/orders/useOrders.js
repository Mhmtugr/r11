/**
 * useOrders.js
 * Siparişlerin listelenmesi ve filtrelenmesi için kompozisyon fonksiyonu
 */

import { ref, reactive, computed, watch } from 'vue';
import { useToast } from '@/composables/useToast';
import { aiService } from '@/services/ai-service.js';
// import { apiService } from '@/services/api-service'; // MODIFICATION: Comment out apiService
import { getOrders } from '@/services/order-service.js'; // MODIFICATION: Import getOrders from order-service

export function useOrders() {
  // Dependencies
  const { showToast } = useToast();
  
  // State
  const orders = ref([]);
  const isLoading = ref(false);
  const totalOrderCount = ref(0);
  
  // Filtreleme ve sıralama state'i
  const filters = reactive({
    searchQuery: '',
    cellType: '',
    status: '',
    dateRange: {
      start: '',
      end: ''
    },
    priorityLevel: '',
    customerName: '',
    riskLevel: '' // Yeni eklenen risk seviyesi filtresi
  });
  
  const sorting = reactive({
    field: 'orderDate',
    direction: 'desc' // 'asc' veya 'desc'
  });
  
  const pagination = reactive({
    currentPage: 1,
    itemsPerPage: 10,
    totalPages: computed(() => Math.ceil(filteredOrders.value.length / pagination.itemsPerPage))
  });
  
  // AI filtreleme state'i
  const isAiFiltering = ref(false);
  
  // Computed properties
  const filteredOrders = computed(() => {
    let result = [...orders.value];
    
    // Arama sorgusu filtresi - Doğal dil araması desteği
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      
      // Doğal dil araması için basit anahtar kelime kontrolü
      if (query.includes('geciken') || query.includes('gecikmiş')) {
        result = result.filter(order => order.status === 'delayed');
      } else if (query.includes('tamamlan') || query.includes('biten')) {
        result = result.filter(order => order.status === 'completed');
      } else if (query.includes('üretimde') || query.includes('devam eden')) {
        result = result.filter(order => order.status === 'in_progress');
      } else if (query.includes('yüksek öncelik') || query.includes('acil')) {
        result = result.filter(order => order.priority === 'high');
      } else if (query.includes('risk')) {
        result = result.filter(order => order.riskLevel === 'high');
      } else {
        // Geleneksel arama (terim bazlı)
        result = result.filter(order => 
          order.orderNo?.toLowerCase().includes(query) || 
          order.customerInfo?.name?.toLowerCase().includes(query) ||
          (order.cells && order.cells.some(cell => 
            cell.productTypeCode?.toLowerCase().includes(query)
          ))
        );
      }
      
      // Müşteri ismi özel kontrolü
      // Örn: "AYEDAŞ'ın siparişleri" gibi aramalar için
      const customerMatch = query.match(/([a-zA-ZşŞıİçÇöÖüÜğĞ]+)'[ıiuünña]n/i);
      if (customerMatch) {
        const customerName = customerMatch[1].toUpperCase();
        result = result.filter(order => 
          order.customerInfo?.name?.toUpperCase().includes(customerName)
        );
      }
    }
    
    // Hücre tipi filtresi
    if (filters.cellType) {
      result = result.filter(order => {
        if (!order.cells || !order.cells.length) return false;
        return order.cells.some(cell => 
          cell.productTypeCode?.includes(filters.cellType)
        );
      });
    }
    
    // Durum filtresi
    if (filters.status) {
      result = result.filter(order => order.status === filters.status);
    }
    
    // Tarih aralığı filtresi
    if (filters.dateRange.start || filters.dateRange.end) {
      result = result.filter(order => {
        const orderDate = new Date(order.orderDate);
        
        if (filters.dateRange.start && filters.dateRange.end) {
          const start = new Date(filters.dateRange.start);
          const end = new Date(filters.dateRange.end);
          return orderDate >= start && orderDate <= end;
        } else if (filters.dateRange.start) {
          const start = new Date(filters.dateRange.start);
          return orderDate >= start;
        } else if (filters.dateRange.end) {
          const end = new Date(filters.dateRange.end);
          return orderDate <= end;
        }
        
        return true;
      });
    }
    
    // Öncelik seviyesi filtresi
    if (filters.priorityLevel) {
      result = result.filter(order => order.priority === filters.priorityLevel);
    }
    
    // Müşteri adı filtresi
    if (filters.customerName) {
      result = result.filter(order => 
        order.customerInfo?.name?.toLowerCase().includes(filters.customerName.toLowerCase())
      );
    }
    
    // Risk seviyesi filtresi
    if (filters.riskLevel) {
      result = result.filter(order => order.riskLevel === filters.riskLevel);
    }
    
    // Sıralama
    result.sort((a, b) => {
      let valA = getNestedValue(a, sorting.field);
      let valB = getNestedValue(b, sorting.field);
      
      // Tarih türünde değerler için
      if (sorting.field === 'orderDate' || 
          sorting.field === 'createdAt' || 
          sorting.field === 'updatedAt') {
        valA = valA ? new Date(valA).getTime() : 0;
        valB = valB ? new Date(valB).getTime() : 0;
      }
      
      if (sorting.direction === 'asc') {
        return valA > valB ? 1 : valA < valB ? -1 : 0;
      } else {
        return valA < valB ? 1 : valA > valB ? -1 : 0;
      }
    });
    
    return result;
  });
  
  const paginatedOrders = computed(() => {
    const startIdx = (pagination.currentPage - 1) * pagination.itemsPerPage;
    const endIdx = startIdx + pagination.itemsPerPage;
    return filteredOrders.value.slice(startIdx, endIdx);
  });
  
  const customerList = computed(() => {
    // Benzersiz müşteri isimleri için
    const uniqueCustomers = new Set();
    
    orders.value.forEach(order => {
      if (order.customerInfo?.name) {
        uniqueCustomers.add(order.customerInfo.name);
      }
    });
    
    return Array.from(uniqueCustomers).sort();
  });
  
  const cellTypeList = computed(() => {
    // Benzersiz hücre tipleri için
    const uniqueCellTypes = new Set();
    
    orders.value.forEach(order => {
      if (order.cells && order.cells.length) {
        order.cells.forEach(cell => {
          if (cell.productTypeCode) {
            uniqueCellTypes.add(cell.productTypeCode);
          }
        });
      }
    });
    
    return Array.from(uniqueCellTypes).sort();
  });
  
  // İç yardımcı fonksiyonlar
  function getNestedValue(obj, path) {
    // "customerInfo.name" gibi nested alanlar için
    return path.split('.').reduce((o, p) => (o && o[p] !== undefined) ? o[p] : null, obj);
  }

  function getPriorityClass(order) {
    if (!order || !order.priority) return '';
    switch (order.priority.toLowerCase()) {
      case 'high':
        return 'priority-high';
      case 'medium':
        return 'priority-medium';
      case 'low':
        return 'priority-low';
      default:
        return '';
    }
  }
  
  // Methods
  
  /**
   * Siparişleri yükler (API veya mock servisinden)
   */
  async function loadOrders() {
    isLoading.value = true;
    try {
      // MODIFICATION: Use getOrders from order-service.js instead of apiService
      const fetchedOrders = await getOrders(); // Default parameters will be used
      
      // Gelen verinin bir dizi olduğundan emin ol
      if (Array.isArray(fetchedOrders)) {
        orders.value = fetchedOrders;
        totalOrderCount.value = fetchedOrders.length;
      } else if (fetchedOrders && typeof fetchedOrders === 'object' && Array.isArray(fetchedOrders.data)) {
        orders.value = fetchedOrders.data;
        totalOrderCount.value = fetchedOrders.data.length;
      } else {
        console.error('loadOrders: Fetched data is not in expected array format.', fetchedOrders);
        orders.value = [];
        totalOrderCount.value = 0;
        showToast('Siparişler yüklenirken beklenmedik bir veri formatı alındı.', 'error');
      }
    } catch (error) {
      console.error('Siparişler yüklenirken hata:', error);
      showToast('Siparişler yüklenemedi: ' + (error.message || 'Bilinmeyen bir hata.'), 'error');
      orders.value = [];
      totalOrderCount.value = 0;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Filtreleri uygular ve siparişleri yeniden yükler
   */
  function applyFilters() {
    pagination.currentPage = 1;
    if (orders.value.length === 0 && !isLoading.value) {
      loadOrders();
    }
  }

  /**
   * Sayfa değiştirir
   * @param {number} page - Gidilecek sayfa numarası
   */
  function changePage(page) {
    if (page >= 1 && page <= pagination.totalPages) {
      pagination.currentPage = page;
    }
  }
  
  /**
   * Siparişleri AI kullanarak filtreler
   * @param {string} query - Doğal dil sorgusu
   */
  async function filterOrdersWithAI(query) {
    if (!query.trim()) {
      filters.searchQuery = '';
      return;
    }

    isAiFiltering.value = true;
    try {
      showToast('AI filtreleme başlatıldı...', 'info');
      const aiFilterCriteria = await aiService.interpretOrderFilterQuery(query);
      
      if (aiFilterCriteria.status) filters.status = aiFilterCriteria.status;
      if (aiFilterCriteria.customerName) filters.customerName = aiFilterCriteria.customerName;
      if (aiFilterCriteria.cellType) filters.cellType = aiFilterCriteria.cellType;
      
      filters.searchQuery = query;

      applyFilters();
      showToast('AI filtreleme tamamlandı.', 'success');
      
    } catch (error) {
      console.error('AI ile filtreleme hatası:', error);
      showToast('AI ile filtreleme sırasında bir hata oluştu: ' + error.message, 'error');
    } finally {
      isAiFiltering.value = false;
    }
  }
  
  // Liste filtreleri değiştiğinde sayfa numarasını sıfırla
  watch([
    () => filters.searchQuery, 
    () => filters.cellType, 
    () => filters.status, 
    () => filters.dateRange.start, 
    () => filters.dateRange.end,
    () => filters.priorityLevel,
    () => filters.customerName,
    () => filters.riskLevel
  ], () => {
    pagination.currentPage = 1;
  });
  
  // Return public API
  return {
    // State
    orders,
    isLoading,
    totalOrderCount,
    filters,
    sorting,
    pagination,
    isAiFiltering,
    
    // Computed
    filteredOrders,
    paginatedOrders,
    customerList,
    cellTypeList,
    
    // Methods
    loadOrders,
    applyFilters,
    changePage,
    filterOrdersWithAI,
    getPriorityClass
  };
}