
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from './firebase-service'; // Firebase bağlantısını içe aktar

const suppliersCollection = collection(db, 'suppliers');

// Mock Data - Gerçek veri yapısına uygun örnekler
const mockSuppliers = [
  {
    id: 'supp-001',
    name: 'Endüstriyel Malzeme A.Ş.',
    contactPerson: 'Ahmet Yılmaz',
    email: 'ahmet.yilmaz@endustriyel.com',
    phone: '0212 123 45 67',
    address: 'İstanbul, Türkiye',
    performanceRating: 4.5,
    deliveryTime: '3 gün',
    status: 'active'
  },
  {
    id: 'supp-002',
    name: 'Hızlı Metal Tedarik',
    contactPerson: 'Ayşe Kaya',
    email: 'ayse.kaya@hizlimetal.com',
    phone: '0216 987 65 43',
    address: 'Kocaeli, Türkiye',
    performanceRating: 4.8,
    deliveryTime: '2 gün',
    status: 'active'
  },
  {
    id: 'supp-003',
    name: 'Plastik ve Kompozit Ltd.',
    contactPerson: 'Mehmet Öztürk',
    email: 'mehmet.ozturk@plastikkompozit.com',
    phone: '0312 555 88 99',
    address: 'Ankara, Türkiye',
    performanceRating: 4.2,
    deliveryTime: '5 gün',
    status: 'inactive'
  }
];


export const supplierService = {
  async getSuppliers() {
    // Firestore'dan veri çekme (eğer boşsa mock data ekle)
    try {
      const snapshot = await getDocs(suppliersCollection);
      if (snapshot.empty) {
        console.log('Firestore "suppliers" koleksiyonu boş. Mock veriler ekleniyor...');
        for (const supplier of mockSuppliers) {
          await addDoc(suppliersCollection, supplier);
        }
        return mockSuppliers;
      }
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error("Tedarikçileri getirirken hata oluştu:", error);
      return []; // Hata durumunda boş dizi döndür
    }
  },

  async addSupplier(supplierData) {
    try {
      const docRef = await addDoc(suppliersCollection, supplierData);
      return { id: docRef.id, ...supplierData };
    } catch (error) {
      console.error("Tedarikçi eklerken hata oluştu:", error);
      throw error;
    }
  },

  async updateSupplier(supplierId, supplierData) {
    try {
      const supplierDoc = doc(db, 'suppliers', supplierId);
      await updateDoc(supplierDoc, supplierData);
    } catch (error) {
      console.error("Tedarikçi güncellerken hata oluştu:", error);
      throw error;
    }
  },

  async deleteSupplier(supplierId) {
    try {
      const supplierDoc = doc(db, 'suppliers', supplierId);
      await deleteDoc(supplierDoc);
    } catch (error) {
      console.error("Tedarikçi silerken hata oluştu:", error);
      throw error;
    }
  },

  // AI Destekli Tedarikçi Önerileri (Örnek Fonksiyon)
  async getAISupplierRecommendations(orderRequirements) {
    // Bu fonksiyon, sipariş gereksinimlerine göre en uygun tedarikçileri
    // (örn. fiyat, hız, performans puanı) önermek için bir AI servisine
    // istek gönderebilir. Şimdilik mock bir yanıt döndürüyoruz.
    console.log("AI Tedarikçi önerileri için girdi:", orderRequirements);
    const suppliers = await this.getSuppliers();
    // Basit bir filtreleme mantığı: aktif ve yüksek puanlı tedarikçiler
    return suppliers
      .filter(s => s.status === 'active' && s.performanceRating > 4.0)
      .sort((a, b) => b.performanceRating - a.performanceRating)
      .slice(0, 3); // En iyi 3 tedarikçiyi öner
  }
};
