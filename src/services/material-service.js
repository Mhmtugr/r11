// Material servis modülü
import * as firebaseServiceLogging from './firebase-service.js';

console.log('[material-service.js] Imported from firebase-service.js:', firebaseServiceLogging);

const { 
  // Firebase helpers
  addDocument, 
  updateDocument, 
  getDocument, 
  queryDocuments,
  deleteDocument,
  firebaseDb // firebaseDb eklendi
} = firebaseServiceLogging;

/**
 * Malzemeleri belirli filtrelere göre getir
 * @param {Object} filters - Filtre parametreleri
 * @returns {Promise<Array>} Malzemeler dizisi
 */
const getMaterials = async (filters = {}) => {
  try {
    // Filtreleri oluştur
    let queryFilters = {};
    
    // Tedarikçi filtresi
    if (filters.supplier) {
      queryFilters.supplier = filters.supplier;
    }
    
    // Durum filtresi
    if (filters.status) {
      queryFilters.status = filters.status;
    }
    
    // Sipariş ID filtresi
    if (filters.orderId) {
      queryFilters.orderId = filters.orderId;
    }
    
    // Stok durumu filtresi
    if (filters.hasOwnProperty('inStock') && typeof filters.inStock === 'boolean') {
      queryFilters.inStock = filters.inStock;
    }
    
    // Sıralama için kullanılacak alan ve yön
    let sortOptions = { 
      field: filters.orderBy || 'name', 
      direction: filters.orderDir || 'asc' 
    };
    
    // Limit
    const limitCount = filters.limit || null;
    
    if (typeof queryDocuments !== 'function') {
      console.error('[material-service.js] HATA: queryDocuments bir fonksiyon değil!', queryDocuments);
      throw new TypeError('queryDocuments is not a function');
    }
    return await queryDocuments('materials', queryFilters, sortOptions, limitCount); // Doğrudan queryDocuments kullan
  } catch (error) {
    console.error("Malzemeleri getirme hatası:", error);
    throw error;
  }
};

/**
 * Belirli bir malzemeyi getir
 * @param {string} materialId - Malzeme ID'si
 * @returns {Promise<Object>} Malzeme bilgileri
 */
const getMaterial = async (materialId) => {
  try {
    return await getDocument('materials', materialId);
  } catch (error) {
    console.error("Malzeme getirme hatası:", error);
    throw error;
  }
};

/**
 * Yeni malzeme ekle
 * @param {Object} materialData - Eklenecek malzeme verileri
 * @returns {Promise<Object>} Eklenen malzeme bilgisi
 */
const addMaterial = async (materialData) => {
  try {
    return await addDocument('materials', materialData);
  } catch (error) {
    console.error("Malzeme ekleme hatası:", error);
    throw error;
  }
};

/**
 * Malzeme güncelle
 * @param {string} materialId - Malzeme ID'si
 * @param {Object} materialData - Güncellenecek malzeme verileri
 * @returns {Promise<Object>} Güncellenen malzeme bilgisi
 */
const updateMaterial = async (materialId, materialData) => {
  try {
    return await updateDocument('materials', materialId, materialData);
  } catch (error) {
    console.error("Malzeme güncelleme hatası:", error);
    throw error;
  }
};

/**
 * Malzeme sil
 * @param {string} materialId - Malzeme ID'si
 * @returns {Promise<Object>} Silme sonucu
 */
const deleteMaterial = async (materialId) => {
  try {
    return await deleteDocument('materials', materialId);
  } catch (error) {
    console.error("Malzeme silme hatası:", error);
    throw error;
  }
};

/**
 * Sipariş için toplu malzeme ekle
 * @param {string} orderId - Sipariş ID'si
 * @param {Array} materials - Eklenecek malzemeler dizisi
 * @returns {Promise<Array>} Eklenen malzemelerin ID'leri
 */
const addOrderMaterials = async (orderId, materials) => {
  try {
    const results = [];
    
    for (const material of materials) {
      const materialData = {
        ...material,
        orderId
      };
      
      const result = await addDocument('materials', materialData);
      results.push(result);
    }
    
    return results;
  } catch (error) {
    console.error("Sipariş malzemeleri ekleme hatası:", error);
    throw error;
  }
};

/**
 * Stokta bulunan malzemeleri getir
 * @param {number} limit - Maksimum sonuç sayısı (opsiyonel)
 * @returns {Promise<Array>} Stokta bulunan malzemeler dizisi
 */
const getInStockMaterials = async (limit = null) => {
  try {
    return await queryDocuments( // Doğrudan queryDocuments kullan
      'materials', 
      { inStock: true }, 
      { field: 'name', direction: 'asc' },
      limit
    );
  } catch (error) {
    console.error("Stokta bulunan malzemeleri getirme hatası:", error);
    throw error;
  }
};

/**
 * Stok hareketi ekle
 * @param {Object} movementData - Stok hareketi verileri
 * @returns {Promise<Object>} Eklenen stok hareketi bilgisi
 */
const addStockMovement = async (movementData) => {
  try {
    // Stok hareketi ekle
    const result = await addDocument('stockMovements', movementData);
    
    // İlgili malzemenin stok durumunu güncelle
    if (movementData.materialId) {
      const material = await getMaterial(movementData.materialId);
      
      // Stok miktarını hesapla
      let newQuantity = material.quantity || 0;
      
      if (movementData.type === 'in') {
        newQuantity += movementData.quantity;
      } else if (movementData.type === 'out') {
        newQuantity -= movementData.quantity;
      }
      
      // Stok durumunu güncelle
      await updateMaterial(movementData.materialId, {
        quantity: newQuantity,
        inStock: newQuantity > 0
      });
    }
    
    return result;
  } catch (error) {
    console.error("Stok hareketi ekleme hatası:", error);
    throw error;
  }
};

/**
 * Sipariş için malzemeleri getir
 * @param {string} orderId - Sipariş ID'si
 * @returns {Promise<Array>} Malzemeler dizisi
 */
const getMaterialsForOrder = async (orderId) => {
  try {
    return await queryDocuments( // Doğrudan queryDocuments kullan
      'materials',
      { orderId },
      { field: 'name', direction: 'asc' }
    );
  } catch (error) {
    console.error(`Sipariş malzemeleri getirme hatası (${orderId}):`, error);
    throw error;
  }
};

/**
 * Kritik stok seviyesindeki malzemeleri getir
 * @returns {Promise<Array>} Kritik malzemeler dizisi
 */
const getCriticalMaterials = async () => {
  try {
    // Stok durumunu kontrol et ve kritik olanları filtrele
    const allMaterials = await queryDocuments('materials'); // Doğrudan queryDocuments kullan
    
    return allMaterials.filter(material => {
      return material.minLevel && material.quantity && material.quantity <= material.minLevel;
    });
  } catch (error) {
    console.error("Kritik malzemeleri getirme hatası:", error);
    throw error;
  }
};

/**
 * Stok özeti getir
 * @returns {Promise<Object>} Stok özeti
 */
const getStockSummary = async () => {
  try {
    const allMaterials = await queryDocuments('materials'); // Doğrudan queryDocuments kullan
    const stockMovements = await queryDocuments( // Doğrudan queryDocuments kullan
      'stockMovements',
      {},
      { field: 'timestamp', direction: 'desc' },
      10
    );
    
    // Kritik seviyedeki malzemeleri say
    const criticalCount = allMaterials.filter(material => 
      material.minLevel && material.quantity && material.quantity <= material.minLevel
    ).length;
    
    // Siparişlere ayrılan malzemeleri say
    const reservedCount = allMaterials.filter(material => material.reserved).length;
    
    // Toplam stok değeri
    const stockValue = allMaterials.reduce((total, material) => {
      return total + (material.quantity || 0) * (material.unitPrice || 0);
    }, 0);
    
    // Son değişenler
    const recentlyChanged = stockMovements.map(movement => {
      const material = allMaterials.find(m => m.id === movement.materialId);
      return {
        id: movement.materialId,
        code: material ? material.code : movement.materialId,
        name: material ? material.name : 'Bilinmeyen Malzeme',
        change: movement.type === 'in' ? movement.quantity : -movement.quantity,
        date: movement.timestamp ? new Date(movement.timestamp) : new Date()
      };
    });
    
    return {
      totalMaterials: allMaterials.length,
      criticalCount,
      reservedCount,
      stockValue,
      recentlyChanged
    };
  } catch (error) {
    console.error("Stok özeti getirme hatası:", error);
    throw error;
  }
};

/**
 * Malzeme bilgisini kodu ile getir
 * @param {string} code - Malzeme kodu
 * @returns {Promise<Object|null>} Malzeme bilgisi
 */
const getMaterialByCode = async (code) => {
  try {
    const materials = await queryDocuments( // Doğrudan queryDocuments kullan
      'materials',
      { code },
      {},
      1
    );
    
    if (materials && materials.length > 0) {
      return materials[0];
    }
    
    return null;
  } catch (error) {
    console.error(`Malzeme bilgisi getirme hatası (${code}):`, error);
    throw error;
  }
};

/**
 * Stok özeti getir - Yapay zeka için özel
 * @returns {Promise<Object>} Stok özeti
 */
const getStockSummaryForAI = async () => {
  try {
    const allMaterials = await queryDocuments('materials');
    const criticalMaterials = allMaterials.filter(material => 
      material.quantity <= (material.criticalStockLevel || 0) // criticalStockLevel alanı varsayılıyor
    );
    const lowStockMaterials = allMaterials.filter(material => 
      material.quantity > (material.criticalStockLevel || 0) && material.quantity <= (material.minStockLevel || 10) // minStockLevel alanı varsayılıyor
    );

    // Toplam stok değeri (basit bir örnek, maliyet bilgisi eklenmeli)
    const totalStockValue = allMaterials.reduce((sum, mat) => sum + ((mat.quantity || 0) * (mat.unitPrice || 0)), 0);

    return {
      totalMaterialCount: allMaterials.length,
      criticalMaterialCount: criticalMaterials.length,
      lowStockMaterialCount: lowStockMaterials.length,
      criticalMaterials: criticalMaterials.slice(0, 5).map(m => ({ name: m.name, code: m.code, quantity: m.quantity, unit: m.unit })),
      // lowStockMaterials: lowStockMaterials.slice(0, 5).map(m => ({ name: m.name, code: m.code, quantity: m.quantity, unit: m.unit })),
      totalStockValue: parseFloat(totalStockValue.toFixed(2)),
      // Ek olarak, en çok hareket gören malzemeler, siparişte bekleyenler vb. eklenebilir.
    };
  } catch (error) {
    defaultLogger.error('Error fetching stock summary for AI from Firebase:', error);
    return null;
  }
};

/**
 * AI için belirli bir malzemenin detaylarını getirir.
 * @param {string} materialId - Malzeme ID'si
 * @returns {Promise<Object|null>} Malzeme detayları veya bulunamazsa null
 */
const getMaterialDetailsForAI = async (materialId) => {
  if (!materialId) {
    console.warn('[material-service] getMaterialDetailsForAI: materialId is required.');
    return null;
  }
  try {
    const material = await getMaterial(materialId); // Uses existing getMaterial
    if (!material) {
      console.warn(`[material-service] getMaterialDetailsForAI: Material with ID ${materialId} not found.`);
      return null;
    }
    // İstenirse burada AI için özel bir formatlama/dönüşüm yapılabilir.
    // Şimdilik doğrudan malzeme objesini döndürüyoruz.
    return material;
  } catch (error) {
    console.error(`[material-service] getMaterialDetailsForAI: Error fetching details for material ${materialId}:`, error);
    throw error; // or return null based on desired error handling for AI
  }
};

/**
 * Material Service composable fonksiyonu - ai-service.js için gerekli
 * @returns {Object} Material service fonksiyonları
 */
const useMaterialService = () => {
  return {
    getMaterials,
    getMaterial,
    addMaterial,
    updateMaterial,
    deleteMaterial,
    addOrderMaterials,
    getInStockMaterials,
    addStockMovement,
    getMaterialsForOrder,
    getCriticalMaterials,
    getStockSummary,
    getMaterialByCode,
    getStockSummaryForAI, // Yeni fonksiyon export edildi
  };
};

export {
  getMaterials,
  getMaterial,
  addMaterial,
  updateMaterial,
  deleteMaterial,
  addOrderMaterials,
  getInStockMaterials,
  addStockMovement,
  getMaterialsForOrder,
  getCriticalMaterials,
  getStockSummary,
  getMaterialByCode,
  getStockSummaryForAI, // Yeni fonksiyon export edildi
  useMaterialService,
  getMaterialDetailsForAI, // Export the new function
  firebaseDb
};