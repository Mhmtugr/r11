/**
 * useMaterialLists.js
 * Material lists management composable
 */

import { ref, computed } from 'vue';
import { useToast } from '@/composables/useToast';

// Helper function for demo data
function getDemoMaterialLists() {
  return [
    { id: 'list-1', name: 'RM 36 CB Ana Liste', type: 'primer', cellType: 'RM 36 CB', createdAt: '2025-06-01', materialsCount: 15 },
    { id: 'list-2', name: 'RM 36 LB Yedek Liste', type: 'sekonder', cellType: 'RM 36 LB', createdAt: '2025-06-10', materialsCount: 8 },
    { id: 'list-3', name: 'Genel Kullanım', type: 'primer', cellType: 'Diğer', createdAt: '2025-05-20', materialsCount: 25 },
  ];
}

export function useMaterialLists() {
  // Dependencies
  const { showToast } = useToast();
  
  // State
  const lists = ref([]);
  const isLoading = ref(false);
  const error = ref(null);
  const currentListId = ref(null);
  const currentList = computed(() => {
    return currentListId.value ? lists.value.find(list => list.id === currentListId.value) : null;
  });
  
  /**
   * Fetch all material lists
   * @returns {Promise<Array>} - Material lists
   */
  async function fetchLists() {
    isLoading.value = true;
    error.value = null;
    try {
      await new Promise(res => setTimeout(res, 400)); // Simulate API latency
      lists.value = getDemoMaterialLists();
      console.log('Fetched demo material lists.');
    } catch (err) {
      const errorMessage = 'Malzeme listeleri yüklenirken bir hata oluştu.';
      console.error(errorMessage, err);
      error.value = errorMessage;
      showToast(errorMessage, 'error');
      lists.value = [];
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Add a new material list
   * @param {Object} listData - New material list data
   * @returns {Promise<void>}
   */
  async function addList(listData) {
    isLoading.value = true;
    try {
      if (!listData.name || !listData.type || !listData.cellType) {
        throw new Error('Yeni liste için İsim, Tip ve Hücre Tipi alanları zorunludur.');
      }
      await new Promise(res => setTimeout(res, 300)); // Simulate API latency
      const newList = {
        ...listData,
        id: `list-${Date.now()}`,
        createdAt: new Date().toISOString(),
        materialsCount: listData.materials?.length || 0,
      };
      lists.value.unshift(newList);
      showToast(`'${newList.name}' başarıyla eklendi.`, 'success');
    } catch (err) {
      console.error('Error adding list:', err);
      error.value = err.message;
      showToast(err.message, 'error');
    } finally {
      isLoading.value = false;
    }
  }

  // Initial load
  fetchLists();
  
  // Return public API
  return {
    // State
    lists,
    isLoading,
    error,
    currentList,
    currentListId,
    
    // Methods
    fetchLists,
    addList,
  };
}