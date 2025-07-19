/**
 * useMaterials.js
 * Composable for managing the entire materials inventory page.
 * Handles data fetching, filtering, sorting, pagination, and CRUD operations.
 */
import { ref, computed } from 'vue';
import { useToast } from '@/composables/useToast';

// Mock data is defined here to be self-contained, normally it would come from an API service.
const MOCK_MATERIALS = [
  { id: 1, code: 'HM001', name: 'Demir Levha 1mm', category: 'Ham Madde', quantity: 150, unit: 'kg', price: 45.75, minQuantity: 50, description: 'Standart demir levha 1mm kalınlığında' },
  { id: 2, code: 'HM002', name: 'Alüminyum Profil 40x40', category: 'Ham Madde', quantity: 300, unit: 'm', price: 32.50, minQuantity: 100, description: 'Alüminyum sigma profil 40x40mm' },
  { id: 3, code: 'HM003', name: 'Paslanmaz Çelik Levha 2mm', category: 'Ham Madde', quantity: 25, unit: 'kg', price: 125.00, minQuantity: 30, description: 'Paslanmaz çelik levha 304 kalite' },
  { id: 4, code: 'KM001', name: 'Endüstriyel Yapıştırıcı', category: 'Kimyasal', quantity: 5, unit: 'lt', price: 350.00, minQuantity: 10, description: 'Metal yüzeyler için endüstriyel yapıştırıcı' },
  { id: 5, code: 'YM001', name: 'Montaj Flanşı', category: 'Yarı Mamül', quantity: 78, unit: 'adet', price: 65.30, minQuantity: 20, description: 'Standart montaj flanşı' },
  { id: 6, code: 'AM001', name: 'Karton Kutu 30x40x20', category: 'Ambalaj', quantity: 240, unit: 'adet', price: 12.50, minQuantity: 100, description: 'Standart ürün ambalajı' },
  { id: 7, code: 'SM001', name: 'Eldiven', category: 'Sarf Malzeme', quantity: 45, unit: 'adet', price: 8.75, minQuantity: 50, description: 'Koruyucu iş eldiveni' },
  { id: 8, code: 'MP001', name: 'Motor Rulmanı 6204', category: 'Makine Parçası', quantity: 12, unit: 'adet', price: 95.30, minQuantity: 5, description: 'Standart motor rulmanı' },
  { id: 9, code: 'HM004', name: 'Bakır Tel 1mm', category: 'Ham Madde', quantity: 0, unit: 'kg', price: 520.00, minQuantity: 10, description: 'Elektrik iletkeni için bakır tel' },
  { id: 10, code: 'YM002', name: 'Kontrol Kartı', category: 'Yarı Mamül', quantity: 15, unit: 'adet', price: 175.40, minQuantity: 8, description: 'Elektronik kontrol kartı' },
  { id: 11, code: 'MM001', name: 'Kontrol Paneli', category: 'Mamül', quantity: 5, unit: 'adet', price: 850.00, minQuantity: 3, description: 'Tamamlanmış kontrol paneli' },
  { id: 12, code: 'SM002', name: 'Temizlik Bezi', category: 'Sarf Malzeme', quantity: 2, unit: 'kg', price: 45.00, minQuantity: 5, description: 'Endüstriyel temizlik bezi' },
  { id: 13, code: 'MP002', name: 'Elektrik Motoru 1.5kW', category: 'Makine Parçası', quantity: 3, unit: 'adet', price: 2450.00, minQuantity: 2, description: '1.5kW elektrik motoru' },
  { id: 14, code: 'HM005', name: 'PVC Boru 4"', category: 'Ham Madde', quantity: 35, unit: 'm', price: 18.75, minQuantity: 20, description: '4 inç PVC boru' },
  { id: 15, code: 'KM002', name: 'Yağ CX-400', category: 'Kimyasal', quantity: 8, unit: 'lt', price: 85.50, minQuantity: 5, description: 'Endüstriyel makine yağı' },
];

const CATEGORIES = [
  'Ham Madde',
  'Yarı Mamül',
  'Mamül',
  'Sarf Malzeme',
  'Ambalaj',
  'Kimyasal',
  'Makine Parçası'
];

export function useMaterials() {
  // Dependencies
  const { showToast } = useToast();
  
  // Main State
  const materials = ref([]);
  const categories = ref(CATEGORIES);
  const loading = ref(false);

  // Filter, Sort, and Pagination State
  const searchTerm = ref('');
  const categoryFilter = ref('');
  const stockFilter = ref('all');
  const sortKey = ref('name');
  const sortDirection = ref('asc');
  const currentPage = ref(1);
  const perPage = ref(10);

  // Computed: Filtering
  const filteredMaterials = computed(() => {
    let result = [...materials.value];

    // Search filter
    if (searchTerm.value) {
      const search = searchTerm.value.toLowerCase();
      result = result.filter(material => 
        material.code.toLowerCase().includes(search) || 
        material.name.toLowerCase().includes(search)
      );
    }

    // Category filter
    if (categoryFilter.value) {
      result = result.filter(material => material.category === categoryFilter.value);
    }

    // Stock status filter
    if (stockFilter.value !== 'all') {
      switch (stockFilter.value) {
        case 'low':
          result = result.filter(m => m.quantity > 0 && m.quantity <= m.minQuantity);
          break;
        case 'out':
          result = result.filter(m => m.quantity === 0);
          break;
        case 'available':
          result = result.filter(m => m.quantity > m.minQuantity);
          break;
      }
    }
    
    // Reset to first page whenever filters change
    // Note: This is a side-effect in a computed property, which is not ideal.
    // It's better handled in the filter methods themselves.
    // currentPage.value = 1; 

    return result;
  });

  // Computed: Sorting
  const sortedMaterials = computed(() => {
    return [...filteredMaterials.value].sort((a, b) => {
      let valueA = a[sortKey.value];
      let valueB = b[sortKey.value];

      if (typeof valueA === 'string' && typeof valueB === 'string') {
        valueA = valueA.toLowerCase();
        valueB = valueB.toLowerCase();
      }

      if (sortDirection.value === 'asc') {
        return valueA > valueB ? 1 : -1;
      } else {
        return valueA < valueB ? 1 : -1;
      }
    });
  });

  // Computed: Pagination
  const totalPages = computed(() => Math.ceil(sortedMaterials.value.length / perPage.value));
  const startIndex = computed(() => (currentPage.value - 1) * perPage.value);
  const endIndex = computed(() => Math.min(startIndex.value + perPage.value, sortedMaterials.value.length));
  
  const paginatedMaterials = computed(() => {
    return sortedMaterials.value.slice(startIndex.value, endIndex.value);
  });

  // Computed: Summary Statistics
  const stockStats = computed(() => {
    const totalItems = materials.value.length;
    const lowStockItems = materials.value.filter(m => m.quantity > 0 && m.quantity <= m.minQuantity).length;
    const outOfStockItems = materials.value.filter(m => m.quantity === 0).length;
    const totalValue = materials.value.reduce((acc, m) => acc + (m.quantity * m.price), 0);
    // A simple turnover rate example - this would be more complex in a real app
    const totalCostOfGoodsSold = totalValue * 0.8; // Assuming 80% of stock value was sold
    const averageInventory = totalValue / 2;
    const turnoverRate = averageInventory > 0 ? (totalCostOfGoodsSold / averageInventory).toFixed(1) : 0;

    return {
      totalItems,
      lowStockItems,
      outOfStockItems,
      totalValue,
      turnoverRate,
    };
  });

  // Methods
  async function loadMaterials() {
    loading.value = true;
    try {
      // In a real app, this would be an API call:
      // const response = await materialService.getMaterials();
      // materials.value = response.data;
      
      // For now, use mock data with a simulated delay
      await new Promise(resolve => setTimeout(resolve, 500));
      materials.value = MOCK_MATERIALS;
      showToast('Malzemeler başarıyla yüklendi.', 'success');
    } catch (error) {
      console.error('Error loading materials:', error);
      showToast('Malzemeler yüklenirken bir hata oluştu.', 'error');
    } finally {
      loading.value = false;
    }
  }

  function applySearchTerm(term) {
    searchTerm.value = term;
    currentPage.value = 1;
  }

  function applyCategoryFilter(category) {
    categoryFilter.value = category;
    currentPage.value = 1;
  }

  function applyStockFilter(status) {
    stockFilter.value = status;
    currentPage.value = 1;
  }

  function sortBy(key) {
    if (sortKey.value === key) {
      sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey.value = key;
      sortDirection.value = 'asc';
    }
  }

  function goToPage(page) {
    if (page >= 1 && page <= totalPages.value) {
      currentPage.value = page;
    }
  }

  async function saveMaterial(materialData) {
    // In a real app, you would perform validation here or in the service
    try {
      if (materialData.id) {
        // Update existing material
        // await materialService.update(materialData);
        const index = materials.value.findIndex(item => item.id === materialData.id);
        if (index !== -1) {
          materials.value[index] = { ...materialData };
        }
        showToast('Malzeme başarıyla güncellendi.', 'success');
      } else {
        // Add new material
        // const newMaterial = await materialService.create(materialData);
        const newId = Math.max(0, ...materials.value.map(item => item.id)) + 1;
        materials.value.push({ ...materialData, id: newId });
        showToast('Yeni malzeme başarıyla eklendi.', 'success');
      }
      return true;
    } catch (error) {
      showToast('Malzeme kaydedilirken bir hata oluştu.', 'error');
      console.error("Error saving material:", error);
      return false;
    }
  }
  
  async function deleteMaterial(materialId) {
    try {
      // await materialService.delete(materialId);
      const index = materials.value.findIndex(item => item.id === materialId);
      if (index !== -1) {
        materials.value.splice(index, 1);
        showToast('Malzeme başarıyla silindi.', 'success');
      }
    } catch (error) {
      showToast('Malzeme silinirken bir hata oluştu.', 'error');
      console.error("Error deleting material:", error);
    }
  }

  async function adjustStock(materialId, adjustment) {
    try {
      const index = materials.value.findIndex(item => item.id === materialId);
      if (index !== -1) {
        const material = materials.value[index];
        let newQuantity = material.quantity;
        
        switch (adjustment.type) {
          case 'add':
            newQuantity += parseFloat(adjustment.quantity);
            break;
          case 'subtract':
            newQuantity = Math.max(0, newQuantity - parseFloat(adjustment.quantity));
            break;
          case 'set':
            newQuantity = parseFloat(adjustment.quantity);
            break;
        }
        
        material.quantity = newQuantity;
        // In a real app, you would log this transaction
        // await materialService.logStockTransaction(...)
        showToast('Stok başarıyla güncellendi.', 'success');
        return true;
      }
      return false;
    } catch (error) {
      showToast('Stok güncellenirken bir hata oluştu.', 'error');
      console.error("Error adjusting stock:", error);
      return false;
    }
  }

  function addNewCategory(newCategoryName) {
    if (newCategoryName && !categories.value.includes(newCategoryName)) {
      categories.value.push(newCategoryName);
      showToast('Yeni kategori eklendi.', 'success');
    }
  }

  // Initial data load
  loadMaterials();

  // Return the public API
  return {
    // State
    materials,
    categories,
    loading,
    
    // Filter, Sort, Pagination
    searchTerm,
    categoryFilter,
    stockFilter,
    sortKey,
    sortDirection,
    currentPage,
    perPage,
    totalPages,
    paginatedMaterials,
    
    // Computed Stats
    stockStats,

    // Methods
    applySearchTerm,
    applyCategoryFilter,
    applyStockFilter,
    sortBy,
    goToPage,
    saveMaterial,
    deleteMaterial,
    loadMaterials, // Expose loadMaterials to allow manual refresh
  };
}