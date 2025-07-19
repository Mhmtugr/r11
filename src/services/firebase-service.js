// Firebase servisi
import { initializeApp, getApps, getApp } from 'firebase/app'; // Import getApps and getApp
import { getAuth } from 'firebase/auth';
import { 
  getFirestore,
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as limitQuery,
  serverTimestamp 
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase yapılandırması
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "mets-project.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "mets-project",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "mets-project.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789012",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789012:web:abcdef1234567890abcdef",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-ABCDEFGHIJ"
};

// Initialize Firebase
let app;

if (!getApps().length) { // Check if Firebase app already initialized
  try {
    app = initializeApp(firebaseConfig);
    console.log('Firebase başlatıldı'); // Using console.log if logger is unavailable
  } catch (error) {
    console.error('Firebase başlatma hatası', error);
    // Consider re-throwing or specific handling if app is critical for startup
  }
} else {
  app = getApp(); // Get the default app if already initialized
  console.log('Mevcut Firebase uygulaması kullanılıyor');
}

// Firebase servisleri
// Ensure 'app' is valid before passing to getAuth, getFirestore, getStorage
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const storage = app ? getStorage(app) : null;

if (!auth || !db || !storage) {
    console.error('Firebase servislerinden biri (auth, db, storage) başlatılamadı. Uygulama düzgün çalışmayabilir.');
    // Potentially throw an error here or handle it in a way that stops further execution
    // if these services are critical.
}

// Koleksiyon referanslarını hazırla
const collections = {
  users: 'users',
  orders: 'orders',
  customers: 'customers',
  materials: 'materials',
  notes: 'notes',
  stockMovements: 'stockMovements',
};

/**
 * Firestore koleksiyonundan belge ekle
 * @param {string} collectionName - Koleksiyon adı
 * @param {Object} data - Eklenecek veri
 * @returns {Promise<Object>} Ekleme sonucu
 */
const addDocument = async (collectionName, data) => {
  try {
    // Zaman damgası ekle
    const docData = {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // Belgeyi ekle
    const collectionRef = collection(db, collectionName);
    const docRef = await addDoc(collectionRef, docData);
    
    return {
      id: docRef.id,
      ...docData
    };
  } catch (error) {
    console.error(`Belge ekleme hatası (${collectionName}):`, error);
    throw error;
  }
};

/**
 * Firestore belgesini güncelle
 * @param {string} collectionName - Koleksiyon adı
 * @param {string} docId - Belge ID
 * @param {Object} data - Güncellenecek veri
 * @returns {Promise<Object>} Güncelleme sonucu
 */
const updateDocument = async (collectionName, docId, data) => {
  try {
    // Güncelleme verisi
    const updateData = {
      ...data,
      updatedAt: serverTimestamp()
    };
    
    // Belgeyi güncelle
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, updateData);
    
    return {
      id: docId,
      ...updateData
    };
  } catch (error) {
    console.error(`Belge güncelleme hatası (${collectionName}/${docId}):`, error);
    throw error;
  }
};

/**
 * Firestore belgesini getir
 * @param {string} collectionName - Koleksiyon adı
 * @param {string} docId - Belge ID
 * @returns {Promise<Object|null>} Belge verisi
 */
const getDocument = async (collectionName, docId) => {
  try {
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data()
      };
    } else {
      console.warn(`Belge bulunamadı (${collectionName}/${docId})`);
      return null;
    }
  } catch (error) {
    console.error(`Belge getirme hatası (${collectionName}/${docId}):`, error);
    throw error;
  }
};

/**
 * Firestore belgesini sil
 * @param {string} collectionName - Koleksiyon adı
 * @param {string} docId - Belge ID
 * @returns {Promise<boolean>} Silme sonucu
 */
const deleteDocument = async (collectionName, docId) => {
  try {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.error(`Belge silme hatası (${collectionName}/${docId}):`, error);
    throw error;
  }
};

/**
 * Sorgu oluştur
 * @param {string} collectionName - Koleksiyon adı
 * @param {Object} filters - Filtreler
 * @param {Object} sortOptions - Sıralama seçenekleri
 * @param {number|null} limitValue - Maksimum sonuç sayısı
 * @returns {Query} Firestore query
 */
const buildQuery = (collectionName, filters = {}, sortOptions = {}, limitValue = null) => {
  let queryRef = collection(db, collectionName);
  let constraints = [];
  
  // Filtreler
  Object.keys(filters).forEach(key => {
    constraints.push(where(key, '==', filters[key]));
  });
  
  // Sıralama
  if (sortOptions && sortOptions.field) {
    constraints.push(orderBy(sortOptions.field, sortOptions.direction || 'asc'));
  }
  
  // Limit
  if (limitValue) {
    constraints.push(limitQuery(limitValue));
  }
  
  return query(queryRef, ...constraints);
};

/**
 * Query'den belgeleri al
 * @param {Query} query - Firestore query
 * @returns {Promise<Array>} Belge dizisi
 */
const getDocsFromQuery = async (queryRef) => {
  try {
    const querySnapshot = await getDocs(queryRef);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Query sonuçları getirme hatası:', error);
    throw error;
  }
};

/**
 * Koleksiyon sorgulama
 * @param {string} collectionName - Koleksiyon adı
 * @param {Object} filters - Filtreler
 * @param {Object} sortOptions - Sıralama seçenekleri
 * @param {number|null} limitValue - Maksimum sonuç sayısı
 * @returns {Promise<Array>} Belge dizisi
 */
const queryDocuments = async (collectionName, filters = {}, sortOptions = {}, limitValue = null) => {
  try {
    const queryRef = buildQuery(collectionName, filters, sortOptions, limitValue);
    return await getDocsFromQuery(queryRef);
  } catch (error) {
    console.error(`Koleksiyon sorgulama hatası (${collectionName}):`, error);
    throw error;
  }
};

// Firebase temel modüllerini dışa aktar
export const firebaseApp = app;
export const firebaseAuth = auth;
export const firebaseDb = db;
export const firebaseStorage = storage;

// Firebase koleksiyonlarını dışa aktar
export { collections };

// Firestore temel fonksiyonlarını dışa aktar
export { 
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp
};

// Yardımcı fonksiyonları dışa aktar
export {
  addDocument,
  updateDocument,
  getDocument,
  deleteDocument,
  queryDocuments,
  buildQuery,
  getDocsFromQuery
};

// Geriye dönük uyumluluk için tüm servisleri dışa aktar
export {
  app,
  auth,
  db,
  storage
};