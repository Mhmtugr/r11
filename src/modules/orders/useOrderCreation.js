/**
 * useOrderCreation.js
 * Yeni sipariş oluşturma için kompozisyon fonksiyonu
 */

import { ref, reactive, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from '@/composables/useToast';
import { addOrder as saveOrderToFirebase } from '@/services/order-service'; // Firebase servisi için açık isim
import { apiService } from '@/services/api-service'; // apiService import edildi
import eventBus from '@/utils/event-bus';
import appConfig from '@/config.js'; // appConfig import edildi

export function useOrderCreation() {
  // Dependencies
  const { showToast } = useToast();
  const router = useRouter();
  
  // State
  const isLoading = ref(false);
  const currentStep = ref(1);
  const totalSteps = 4; // Toplam adım sayısı
  
  // Form data
  const orderData = reactive({
    // Genel bilgiler
    orderDate: new Date().toISOString().split('T')[0], // Bugünün tarihi
    customerInfo: {
      name: '',
      documentNo: '',
      projectName: '',
      contractNo: '',
      contactPerson: '',
      contactEmail: '',
      contactPhone: ''
    },
    // Teknik bilgiler
    technicalInfo: {
      voltage: '36kV',
      current: '630A',
      shortCircuit: '16kA',
      controlVoltage: '24 VDC',
      specialRequirements: '',
      labelInfo: '',
      specialDesign: false,
      lockingRequired: false,
      comments: ''
    },
    // Hücre bilgileri
    cells: [],
    // Proje bilgileri
    projects: [],
    // Durum bilgileri
    status: 'planned',
    progress: 0
  });

  // Computed properties
  const isFirstStep = computed(() => currentStep.value === 1);
  const isLastStep = computed(() => currentStep.value === totalSteps);
  const currentProgress = computed(() => (currentStep.value / totalSteps) * 100);
  
  const hasCustomerInfo = computed(() => {
    return orderData.customerInfo.name && 
           orderData.customerInfo.documentNo;
  });

  const hasCells = computed(() => orderData.cells.length > 0);
  
  const formIsValid = computed(() => {
    // Her adımın validasyonunu kontrol et
    if (currentStep.value === 1) {
      // Müşteri bilgileri adımı
      return hasCustomerInfo.value;
    } else if (currentStep.value === 2) {
      // Hücre bilgileri adımı
      return hasCells.value;
    } else if (currentStep.value === 3) {
      // Proje bilgileri adımı - opsiyonel olabilir
      return true;
    } else if (currentStep.value === 4) {
      // Onay adımı
      return hasCustomerInfo.value && hasCells.value;
    }
    
    return false;
  });
  
  // Methods
  
  /**
   * Yeni hücre ekler
   */
  function addCell() {
    const cellCount = orderData.cells.length;
    
    orderData.cells.push({
      id: Date.now() + cellCount, // Benzersiz ID
      facilityName: '',
      acceptanceDate: '',
      deliveryDate: '',
      quantity: 1,
      productTypeCode: 'RM 36 CB', // Varsayılan değer
      technicalValues: '36kV 630A 16kA',
      relayInfo: '',
      currentTransformerInfo: '',
      voltageTransformerInfo: '',
      serialNumber: `SN-${new Date().getFullYear().toString().substring(2)}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${(cellCount + 1).toString().padStart(3, '0')}`
    });
  }
  
  /**
   * Hücre siler
   * @param {number} index - Silinecek hücrenin dizindeki pozisyonu
   */
  function removeCell(index) {
    orderData.cells.splice(index, 1);
  }
  
  /**
   * Yeni proje ekler
   */
  function addProject() {
    const projectCount = orderData.projects.length;
    
    orderData.projects.push({
      id: Date.now() + projectCount, // Benzersiz ID
      name: `PROJE-${projectCount + 1}`,
      cellArrangement: '',
      closingDetails: ''
    });
  }
  
  /**
   * Proje siler
   * @param {number} index - Silinecek projenin dizindeki pozisyonu
   */
  function removeProject(index) {
    orderData.projects.splice(index, 1);
  }
  
  /**
   * Sonraki adıma ilerler
   */
  function nextStep() {
    if (currentStep.value < totalSteps) {
      currentStep.value++;
    }
  }
  
  /**
   * Önceki adıma döner
   */
  function prevStep() {
    if (currentStep.value > 1) {
      currentStep.value--;
    }
  }
  
  /**
   * Formdaki verileri toplar (orderNo, createdAt, updatedAt hariç)
   */
  function collectFormData() {
    const dataToSend = {
      orderDate: orderData.orderDate,
      customer: orderData.customerInfo.name, // Mock API customer bekliyor
      customerInfo: orderData.customerInfo, // Firebase customerInfo bekleyebilir
      technicalInfo: orderData.technicalInfo,
      cells: orderData.cells.map(cell => ({
        cellType: cell.productTypeCode,
        quantity: cell.quantity,
        ...cell
      })),
      projects: orderData.projects,
      status: orderData.status,
      priority: 'medium', // Varsayılan öncelik, formda yoksa
      progress: orderData.progress
    };
    return dataToSend;
  }
  
  /**
   * Yeni sipariş kaydeder (order-service veya api-service kullanarak)
   * @returns {Promise<string|null>} - Başarılı kaydedilirse sipariş ID, başarısız ise null
   */
  async function saveOrder() {
    try {
      isLoading.value = true;
      
      const formData = collectFormData();
      let resultFromService;

      if (appConfig.api.useMockData) {
        console.log('[useOrderCreation] Mock mode active. Using apiService.post for mock data. Payload:', JSON.parse(JSON.stringify(formData)));
        const mockResponse = await apiService.post('/orders', formData);
        
        if (mockResponse && mockResponse.success && mockResponse.data) {
          resultFromService = mockResponse.data; 
          console.log('[useOrderCreation] Mock API success. Response data:', JSON.parse(JSON.stringify(resultFromService)));
        } else {
          console.error('[useOrderCreation] Mock API did not return expected format or failed:', mockResponse);
          throw new Error(mockResponse?.message || 'Mock API yanıtı beklenmedik formatta veya başarısız.');
        }
      } else {
        console.log('[useOrderCreation] Mock mode inactive. Using saveOrderToFirebase for Firebase. Payload:', JSON.parse(JSON.stringify(formData)));
        resultFromService = await saveOrderToFirebase(formData);
        console.log('[useOrderCreation] Firebase service success. Response data:', JSON.parse(JSON.stringify(resultFromService)));
      }

      if (resultFromService && resultFromService.id && resultFromService.orderNo) {
        showToast(`Sipariş başarıyla oluşturuldu: ${resultFromService.orderNo}`, 'success');
        console.log('[useOrderCreation] Emitting order-created event with payload:', { orderId: resultFromService.id, orderNo: resultFromService.orderNo });
        eventBus.emit('order-created', { orderId: resultFromService.id, orderNo: resultFromService.orderNo }); 
        router.push({ name: 'Orders' }); 
        resetOrderData(); 
        currentStep.value = 1; 
        return resultFromService.id; 
      } else {
        console.error('[useOrderCreation] Order creation failed. Result from service was missing id or orderNo:', resultFromService);
        throw new Error('Sipariş kaydedilemedi veya yanıtta id/orderNo eksik.');
      }

    } catch (error) {
      console.error('Sipariş kaydedilirken hata oluştu:', error);
      showToast('Sipariş kaydedilemedi: ' + (error.message || 'Bilinmeyen bir hata oluştu.'), 'error');
      return null; 
    } finally {
      isLoading.value = false;
    }
  }
  
  /**
   * Siparişi iptal eder ve listeme sayfasına döner
   */
  function cancelOrder() {
    router.push({ name: 'Orders' });
    resetOrderData();
    currentStep.value = 1;
  }
  
  /**
   * Sipariş verilerini sıfırlar
   */
  function resetOrderData() {
    Object.assign(orderData, {
      orderDate: new Date().toISOString().split('T')[0],
      customerInfo: {
        name: '',
        documentNo: '',
        projectName: '',
        contractNo: '',
        contactPerson: '',
        contactEmail: '',
        contactPhone: ''
      },
      technicalInfo: {
        voltage: '36kV',
        current: '630A',
        shortCircuit: '16kA',
        controlVoltage: '24 VDC',
        specialRequirements: '',
        labelInfo: '',
        specialDesign: false,
        lockingRequired: false,
        comments: ''
      },
      cells: [],
      projects: [],
      status: 'planned',
      progress: 0
    });
    if (orderData.cells.length === 0) { 
        addCell();
    }
  }
  
  if (orderData.cells.length === 0) { 
      addCell();
  }
  
  return {
    isLoading,
    currentStep,
    totalSteps,
    orderData,
    isFirstStep,
    isLastStep,
    currentProgress,
    formIsValid,
    addCell,
    removeCell,
    addProject,
    removeProject,
    nextStep,
    prevStep,
    saveOrder,
    cancelOrder,
    resetOrderData
  };
}