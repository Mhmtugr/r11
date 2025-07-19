// Order servis modülü
import { 
  // Firebase helpers
  addDocument, 
  updateDocument, 
  getDocument, 
  queryDocuments,
  deleteDocument, // deleteDocument'ı import et
  
  // Firebase collections
  collections,
  
  // Query builders
  buildQuery,
  getDocsFromQuery,
  
  // Firestore temel
  doc,
  updateDoc,
  db
} from './firebase-service.js'; // Added .js extension

// stringUtils'dan sipariş ID oluşturucuyu import et
import { generateOrderId } from '@/utils/stringUtils';
// dateUtils'dan tarih formatlayıcıyı import et
import { formatDate } from '@/utils/dateUtils';

/**
 * Tüm siparişleri getir
 * @param {string|string[]|null} status - Filtrelenecek durum (opsiyonel)
 * @param {number} limit - Maksimum sonuç sayısı (opsiyonel, varsayılan 50)
 * @returns {Promise<Array>} Siparişler dizisi
 */
const getOrders = async (status = null, limit = 50) => {
  try {
    let filters = {};
    let sortOptions = { field: 'createdAt', direction: 'desc' };
    
    // Duruma göre filtrele
    if (status) {
      filters.status = status;
    }
    
    return await queryDocuments('orders', filters, sortOptions, limit);
  } catch (error) {
    console.error("Siparişleri getirme hatası:", error);
    throw error;
  }
};

/**
 * Siparişleri filtrele ve getir
 * @param {Object} filters - Filtre parametreleri
 * @returns {Promise<Array>} Filtrelenmiş siparişler dizisi
 */
const filterOrders = async (filters = {}) => {
  try {
    let queryFilters = {};
    
    // Durum filtresi
    if (filters.status) {
      queryFilters.status = filters.status;
    }
    
    // Müşteri filtresi
    if (filters.customer) {
      queryFilters.customer = filters.customer;
    }
    
    // Hücre tipi
    if (filters.cellType) {
      queryFilters.cellType = filters.cellType;
    }
    
    // Tarih filtreleri daha karmaşık olduğu için ayrı değerlendirme gerekiyor
    // Tarih aralığı - sipariş tarihi
    if (filters.orderDateStart && filters.orderDateEnd) {
      // Burada tarih aralığı sorgusu için composite query yapmak gerekecek
      // Basitleştirmek için tüm siparişleri çekip JS tarafında filtreleyeceğiz
      // İleride Firebase v9 composite query kullanımına geçilebilir
    }
    
    // Sıralama için kullanılacak alan ve yön
    let sortOptions = { 
      field: filters.orderBy || 'createdAt', 
      direction: filters.orderDir || 'desc' 
    };
    
    // Limit
    const limitCount = filters.limit || null;
    
    return await queryDocuments('orders', queryFilters, sortOptions, limitCount);
  } catch (error) {
    console.error("Siparişleri filtreleme hatası:", error);
    throw error;
  }
};

/**
 * Sipariş ekle
 * @param {Object} orderData - Eklenecek sipariş verileri (orderNo olmadan)
 * @returns {Promise<Object>} Eklenen sipariş bilgisi (id ve orderNo içerir)
 */
const addOrder = async (orderData) => {
  try {
    // Sipariş numarasını oluştur (myrule2.mdc formatı: #YYMM-RR)
    const orderNo = generateOrderId();
    
    // Sipariş verisine oluşturulan numarayı ve oluşturulma zamanını ekle
    const dataToSave = {
      ...orderData,
      orderNo: orderNo,
      createdAt: new Date(), // Firebase servisi zaten timestamp ekleyebilir, ama burada da ekleyelim
      updatedAt: new Date()
    };
    
    // Siparişi Firebase'e ekle
    const docRef = await addDocument('orders', dataToSave);
    
    // Eklenen dokümanın ID'sini ve oluşturulan sipariş numarasını döndür
    return {
      id: docRef.id,
      orderNo: orderNo
    };
  } catch (error) {
    console.error("Sipariş ekleme hatası:", error);
    throw error;
  }
};

/**
 * Sipariş güncelle
 * @param {string} orderId - Sipariş ID'si
 * @param {Object} orderData - Güncellenecek sipariş verileri
 * @returns {Promise<Object>} Güncellenen sipariş bilgisi
 */
const updateOrder = async (orderId, orderData) => {
  try {
    return await updateDocument('orders', orderId, orderData);
  } catch (error) {
    console.error("Sipariş güncelleme hatası:", error);
    throw error;
  }
};

/**
 * Sipariş detayını getir
 * @param {string} orderId - Sipariş ID'si
 * @returns {Promise<Object>} Sipariş detay bilgileri
 */
const getOrderDetail = async (orderId) => {
  try {
    // Önce sipariş bilgilerini al
    const orderData = await getDocument('orders', orderId);
    
    // Sipariş malzemelerini getir
    const materials = await queryDocuments('materials', { orderId });
    orderData.materials = materials;
    
    // Sipariş notlarını getir
    const notes = await queryDocuments('notes', 
      { entityType: 'order', entityId: orderId },
      { field: 'createdAt', direction: 'desc' }
    );
    orderData.notes = notes;
    
    return orderData;
  } catch (error) {
    console.error("Sipariş detayı getirme hatası:", error);
    throw error;
  }
};

/**
 * Sipariş durumunu güncelle
 * @param {string} orderId - Sipariş ID'si
 * @param {string} status - Yeni durum
 * @param {string|null} comment - Durum değişikliği hakkında isteğe bağlı yorum
 * @returns {Promise<boolean>} İşlem başarı durumu
 */
const updateOrderStatus = async (orderId, status, comment = null) => {
  try {
    // Durum güncellemesi
    const updateData = {
      status: status,
    };
    
    // Duruma özel tarih alanı ekle
    const statusDateField = `${status}Date`;
    updateData[statusDateField] = new Date();
    
    // Siparişi güncelle
    await updateDocument('orders', orderId, updateData);
    
    // Eğer bir yorum eklenecekse, not olarak kaydet
    if (comment) {
      await addDocument('notes', {
        entityType: 'order',
        entityId: orderId,
        content: comment,
        type: 'status_change',
        metadata: {
          oldStatus: '', // Önceki durum bilinmiyor, eklemek için önceki durum sorgulanabilir
          newStatus: status
        }
      });
    }
    
    return true;
  } catch (error) {
    console.error("Sipariş durumu güncelleme hatası:", error);
    throw error;
  }
};

/**
 * Sipariş numarasına göre sipariş detayını getirir
 * @param {string} orderNumber - Sipariş numarası
 * @returns {Promise<Object|null>} Sipariş detay bilgileri
 */
const getOrderByNumber = async (orderNumber) => {
  try {
    const orders = await queryDocuments(
      'orders', 
      { orderNo: orderNumber },
      { field: 'createdAt', direction: 'desc' },
      1
    );
    
    if (orders && orders.length > 0) {
      return await getOrderDetail(orders[0].id);
    }
    
    return null;
  } catch (error) {
    console.error(`Sipariş detayı getirme hatası (${orderNumber}):`, error);
    throw error;
  }
};

/**
 * Sipariş için üretim planını getirir
 * @param {string} orderId - Sipariş ID'si
 * @returns {Promise<Object|null>} Üretim planı bilgileri
 */
const getProductionPlanForOrder = async (orderId) => {
  try {
    // Plan verisini getir
    const planData = await queryDocuments(
      'productionPlans',
      { orderId },
      { field: 'createdAt', direction: 'desc' },
      1
    );
    
    if (planData && planData.length > 0) {
      return planData[0];
    }
    
    // Eğer plan yoksa, üretim aşamalarını getir
    const productionStages = await queryDocuments(
      'productionStages',
      { orderId },
      { field: 'sequenceNumber', direction: 'asc' }
    );
    
    if (productionStages && productionStages.length > 0) {
      return {
        orderId,
        stages: productionStages,
        estimatedCompletion: calculateEstimatedCompletion(productionStages),
        delayReason: getDelayReason(productionStages),
        extraHoursNeeded: calculateExtraHours(productionStages)
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Üretim planı getirme hatası (${orderId}):`, error);
    throw error;
  }
};

/**
 * Üretim aşamalarına bakarak tahmini tamamlanma tarihini hesaplar
 * @private
 * @param {Array} stages - Üretim aşamaları
 * @returns {string|null} Tahmini tamamlanma tarihi
 */
const calculateEstimatedCompletion = (stages) => {
  if (!stages || stages.length === 0) return null;
  
  const lastStage = stages[stages.length - 1];
  const inProgressStages = stages.filter(s => s.status === 'in_progress');
  
  if (lastStage.actualEnd) {
    return formatDate(new Date(lastStage.actualEnd));
  } else if (lastStage.plannedEnd) {
    // Gecikme varsa hesapla
    const delay = calculateTotalDelay(stages);
    if (delay > 0) {
      const plannedEnd = new Date(lastStage.plannedEnd);
      plannedEnd.setDate(plannedEnd.getDate() + delay);
      return formatDate(plannedEnd);
    }
    return formatDate(new Date(lastStage.plannedEnd));
  } else if (inProgressStages.length > 0) {
    const currentStage = inProgressStages[0];
    const currentStageIndex = stages.findIndex(s => s.id === currentStage.id);
    
    // Kalan aşamalar
    const remainingStages = stages.slice(currentStageIndex);
    
    // Tahmini kalan süre hesapla (gün)
    const estimatedRemainingDays = remainingStages.reduce((total, stage) => {
      const plannedStart = stage.plannedStart ? new Date(stage.plannedStart) : new Date();
      const plannedEnd = stage.plannedEnd ? new Date(stage.plannedEnd) : new Date();
      const daysDiff = Math.ceil((plannedEnd - plannedStart) / (1000 * 60 * 60 * 24));
      return total + daysDiff;
    }, 0);
    
    const today = new Date();
    today.setDate(today.getDate() + estimatedRemainingDays);
    return formatDate(today);
  }
  
  return null;
};

/**
 * Üretim aşamalarındaki toplam gecikmeyi hesaplar
 * @private
 * @param {Array} stages - Üretim aşamaları
 * @returns {number} Toplam gecikme (gün)
 */
const calculateTotalDelay = (stages) => {
  if (!stages || stages.length === 0) return 0;
  
  return stages.reduce((totalDelay, stage) => {
    return totalDelay + (stage.delay || 0);
  }, 0);
};

/**
 * Üretim aşamalarına bakarak gecikme nedenini getirir
 * @private
 * @param {Array} stages - Üretim aşamaları
 * @returns {string} Gecikme nedeni
 */
const getDelayReason = (stages) => {
  if (!stages || stages.length === 0) return '';
  
  const delayedStages = stages.filter(s => s.delay && s.delay > 0);
  if (delayedStages.length === 0) return '';
  
  const mostDelayedStage = delayedStages.reduce((prev, current) => {
    return (prev.delay > current.delay) ? prev : current;
  });
  
  return mostDelayedStage.delayReason || '';
};

/**
 * Üretim aşamalarına bakarak gereken ek mesai saatlerini hesaplar
 * @private
 * @param {Array} stages - Üretim aşamaları
 * @returns {number} Gereken ek mesai saatleri
 */
const calculateExtraHours = (stages) => {
  if (!stages || stages.length === 0) return 0;
  
  const delayedStages = stages.filter(s => s.delay && s.delay > 0);
  if (delayedStages.length === 0) return 0;
  
  // Her gecikme günü için ortalama 8 saat mesai hesapla
  return delayedStages.reduce((total, stage) => {
    return total + (stage.delay * 8);
  }, 0);
};

/**
 * Sipariş sil
 * @param {string} orderId - Silinecek sipariş ID'si
 * @returns {Promise<void>}
 */
const deleteOrder = async (orderId) => {
  try {
    // Firebase servisindeki deleteDocument fonksiyonunu çağır
    await deleteDocument('orders', orderId);
    // İlgili diğer verileri silmek gerekebilir (örn: malzemeler, notlar, üretim aşamaları)
    // Bu kısım daha sonra eklenebilir veya ilişkili verilerin silinmesi
    // Firebase Functions (Cloud Functions) ile otomatikleştirilebilir.
  } catch (error) {
    console.error("Sipariş silme hatası:", error);
    throw error; // Hatanın yukarıya iletilmesi
  }
};

/**
 * Tüm sipariş numaralarını getirir.
 * @returns {Promise<string[]>} Benzersiz sipariş numaralarının bir dizisi.
 */
const getAllOrderNumbers = async () => {
  console.log('[OrderService] getAllOrderNumbers called');
  try {
    // 'orders' koleksiyonundaki tüm dokümanları al, sadece 'orderNo' alanını seç
    // queryDocuments fonksiyonunun tüm dokümanları getirmesi için filters ve sortOptions null/boş olmalı
    // ve limit belirtilmemeli veya çok yüksek bir değere ayarlanmalı.
    // firebase-service.js içindeki queryDocuments, eğer limit verilmezse tümünü getirmiyor olabilir,
    // bu yüzden tüm dokümanları almak için özel bir yol gerekebilir veya queryDocuments'ı buna göre ayarlamak.
    // Şimdilik, queryDocuments'ın tümünü getirdiğini varsayalım (limit yoksa).
    const orders = await queryDocuments('orders', {}, null, null); // Limit null veya çok büyük bir sayı olmalı
    
    if (orders && orders.length > 0) {
      const orderNumbers = orders.map(order => order.orderNo).filter(Boolean);
      // Benzersizliği sağla
      const uniqueOrderNumbers = [...new Set(orderNumbers)];
      console.log(`[OrderService] Found ${uniqueOrderNumbers.length} unique order numbers.`);
      return uniqueOrderNumbers;
    }
    console.log('[OrderService] No orders found or orders array is empty.');
    return [];
  } catch (error) {
    console.error("[OrderService] Tüm sipariş numaralarını getirme hatası:", error);
    // defaultLogger.error(\\"[OrderService] Tüm sipariş numaralarını getirme hatası:\\", error); // Eğer defaultLogger burada kullanılabilirse
    throw error; // Hatanın yukarıya iletilmesi
  }
};

/**
 * AI için sipariş özeti getirir.
 * @param {string} orderId - Sipariş ID\'si
 * @returns {Promise<Object|null>} Sipariş özeti veya hata durumunda null
 */
const getOrderSummaryForAI = async (orderId) => {
  try {
    const order = await getDocument('orders', orderId);
    if (!order) {
      console.warn(`[OrderService] getOrderSummaryForAI: Order not found for ID: ${orderId}`);
      return null;
    }

    // Temel sipariş bilgilerini seç
    const summary = {
      orderNo: order.orderNo,
      status: order.status,
      customer: order.customer?.name || order.customerName || 'Bilinmiyor', // Müşteri adı farklı alanlarda olabilir
      product: order.productName || order.item?.name || 'Bilinmiyor',
      quantity: order.quantity || order.item?.quantity || 0,
      dueDate: order.dueDate ? formatDate(new Date(order.dueDate)) : 'Belirtilmemiş',
      createdAt: order.createdAt ? formatDate(new Date(order.createdAt.toDate ? order.createdAt.toDate() : order.createdAt)) : 'Belirtilmemiş', // Handle Firebase Timestamp
      issues: [], // Potansiyel sorunlar için bir alan
      priority: order.priority || 'Normal',
      assignee: order.assignee?.name || order.assigneeName || 'Atanmamış',
    };

    // Gecikme durumu kontrolü
    // Ensure dueDate is valid and not in the past if status is not completed or cancelled
    if (order.dueDate && new Date(order.dueDate) < new Date() && 
        order.status !== 'completed' && order.status !== 'shipped' && order.status !== 'cancelled') {
      summary.issues.push('Siparişin teslim tarihi geçmiş.');
    }
    if (order.status === 'delayed') {
      summary.issues.push('Sipariş gecikmiş olarak işaretlenmiş.');
    }
    if (order.isCritical) {
      summary.issues.push('Sipariş kritik olarak işaretlenmiş.');
    }
    if (order.warnings && order.warnings.length > 0) {
        summary.issues.push(...order.warnings);
    }


    // Siparişle ilişkili önemli notları veya uyarıları ekle (örnek)
    // const notes = await queryDocuments('notes', { entityId: orderId, type: 'warning' }, { field: 'createdAt', direction: 'desc' }, 3);
    // if (notes && notes.length > 0) {
    //   summary.notes = notes.map(n => n.content);
    // }

    return summary;
  } catch (error) {
    console.error(`AI için sipariş özeti getirme hatası (${orderId}):`, error);
    // defaultLogger.error(\`AI için sipariş özeti getirme hatası (${orderId}):\`, error); // Eğer defaultLogger burada kullanılabilirse
    return null;
  }
};

/**
 * Order Service composable fonksiyonu - ai-service.js için gerekli
 * @returns {Object} Order service fonksiyonları
 */
const useOrderService = () => {
  return {
    getOrders,
    filterOrders,
    addOrder,
    updateOrder,
    getOrderDetail,
    updateOrderStatus,
    getOrderByNumber,
    getProductionPlanForOrder,
    deleteOrder, 
    getOrderSummaryForAI, 
    getAllOrderNumbers 
  };
};

const orderService = useOrderService(); // Create an instance of the service

export {
  getOrders,
  filterOrders,
  addOrder,
  updateOrder,
  getOrderDetail,
  updateOrderStatus,
  getOrderByNumber,
  getProductionPlanForOrder,
  deleteOrder, 
  useOrderService, 
  getOrderSummaryForAI,
  getAllOrderNumbers,
  orderService // Export the orderService instance
};