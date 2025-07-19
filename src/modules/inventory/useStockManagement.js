/**
 * useStockManagement.js
 * Stok yönetimi ve kontrolü için kompozisyon fonksiyonu
 */

import { ref } from 'vue';
import { useToast } from '@/composables/useToast';

// Demo data for stock status
const getExampleStockData = () => [
  { label: 'Kritik Seviye', value: 5, color: '#dc3545' },
  { label: 'Azalan Stok', value: 12, color: '#fd7e14' },
  { label: 'Yeterli Seviye', value: 68, color: '#198754' },
  { label: 'Stok Fazlası', value: 8, color: '#0dcaf0' },
];

export function useStockManagement() {
  const { showToast } = useToast();

  const stockData = ref([]);
  const isLoading = ref(false);
  const error = ref(null);

  async function fetchStockData() {
    isLoading.value = true;
    error.value = null;
    try {
      // Simulate API call latency
      await new Promise(res => setTimeout(res, 600));
      
      // In a real app, this would fetch and process data from a service
      stockData.value = getExampleStockData();
      console.log('Fetched stock status data (demo).');

    } catch (err) {
      const errorMessage = 'Stok durumu verileri yüklenemedi.';
      console.error(errorMessage, err);
      error.value = errorMessage;
      showToast(errorMessage, 'error');
      stockData.value = []; // Clear data on error
    } finally {
      isLoading.value = false;
    }
  }

  // Placeholder for other stock-related functions like checking specific material stock,
  // creating purchase requests, etc.

  return {
    stockData,
    isLoading,
    error,
    fetchStockData,
  };
}