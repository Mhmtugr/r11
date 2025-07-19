/**
 * API Servisi
 * Modern REST API entegrasyonu ve mock verileri yönetir
 */

import { useAuthStore } from '@/store/auth';
import appConfig from '@/config'; // Import config instead of using window

// Import Firebase services for mock mode redirection
import { 
  queryDocuments, 
  getDocument, 
  addDocument, 
  updateDocument, 
  deleteDocument 
} from '@/services/firebase-service';
import defaultLogger from '@/utils/logger'; // Assuming logger is available

class ApiService {
  constructor() {
    // Config dosyasından veya ortam değişkenlerinden al
    this.baseUrl = appConfig.api?.baseUrl || import.meta.env.VITE_API_URL || '/api'; // Use import.meta.env for Vite
    this.mockMode = appConfig.api?.useMockData ?? (import.meta.env.MODE === 'development'); // Default to true in dev if not specified
    this.erpMockMode = appConfig.api?.erpUseMockData ?? (import.meta.env.MODE === 'development'); // ERP için özel mock modu
    this.timeout = appConfig.api?.timeout || 30000;
    this.retryAttempts = appConfig.api?.retryAttempts || 3;
    
    console.log('API Servisi başlatılıyor', { baseUrl: this.baseUrl, mockMode: this.mockMode, erpMockMode: this.erpMockMode });
  }
  
  async get(endpoint, params = {}) {
    if (this.mockMode) {
      return this.getMockData(endpoint, params);
    }
    
    try {
      const url = new URL(endpoint, this.baseUrl); // Use URL constructor correctly
      Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: this._getHeaders()
      });
      
      return this._handleResponse(response);
    } catch (error) {
      console.error(`GET ${endpoint} başarısız:`, error);
      throw this._handleError(error);
    }
  }
  
  async post(endpoint, data = {}) {
    if (this.mockMode) {
      return this.postMockData(endpoint, data);
    }
    
    try {
      const url = new URL(endpoint, this.baseUrl);
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: this._getHeaders(),
        body: JSON.stringify(data)
      });
      
      return this._handleResponse(response);
    } catch (error) {
      console.error(`POST ${endpoint} başarısız:`, error);
      throw this._handleError(error);
    }
  }

  async put(endpoint, data = {}) {
    if (this.mockMode) {
       // PUT için mock veriyi POST gibi ele alabiliriz veya özelleştirebiliriz
      return this.postMockData(endpoint, data, 'PUT'); 
    }
    
    try {
      const url = new URL(endpoint, this.baseUrl);
      const response = await fetch(url.toString(), {
        method: 'PUT',
        headers: this._getHeaders(),
        body: JSON.stringify(data)
      });
      
      return this._handleResponse(response);
    } catch (error) {
      console.error(`PUT ${endpoint} başarısız:`, error);
       throw this._handleError(error);
    }
  }

  async delete(endpoint) {
    if (this.mockMode) {
      return this.deleteMockData(endpoint);
    }
    
    try {
      const url = new URL(endpoint, this.baseUrl);
      const response = await fetch(url.toString(), {
        method: 'DELETE',
        headers: this._getHeaders()
      });
      
      // DELETE genellikle içerik döndürmez, başarı durumunu kontrol et
      return this._handleResponse(response, true); // Expect no content
    } catch (error) {
      console.error(`DELETE ${endpoint} başarısız:`, error);
       throw this._handleError(error);
    }
  }
  
  async getMockData(endpoint, params = {}) {
    defaultLogger.info(`[ApiService-Mock] GET: ${endpoint} with params:`, params);
    const idMatch = endpoint.match(/^\/(orders|materials)\/([^/]+)$/); // Corrected regex
    const plainEndpoint = endpoint.split('?')[0]; // Remove query params for switch matching

    if (idMatch) {
      const collectionName = idMatch[1];
      const docId = idMatch[2];
      return getDocument(collectionName, docId)
        .then(doc => {
          if (!doc) {
            return Promise.reject({ status: 404, message: `${collectionName} with ID ${docId} not found in Firebase (mock mode)` });
          }
          return doc;
        })
        .catch(error => {
          defaultLogger.error(`[ApiService-Mock] Error fetching document ${collectionName}/${docId} from Firebase:`, error);
          return Promise.reject({ status: 500, message: `Error fetching from Firebase: ${error.message}` });
        });
    }

    switch (plainEndpoint) {
      case '/orders':
        return queryDocuments('orders', params)
          .catch(error => {
            defaultLogger.error('[ApiService-Mock] Error fetching /orders from Firebase:', error);
            return Promise.reject({ status: 500, message: `Error fetching orders from Firebase: ${error.message}` });
          });
      case '/materials':
        return queryDocuments('materials', params)
          .catch(error => {
            defaultLogger.error('[ApiService-Mock] Error fetching /materials from Firebase:', error);
            return Promise.reject({ status: 500, message: `Error fetching materials from Firebase: ${error.message}` });
          });
      case '/dashboard/summary': {
        const activeOrdersPromise = queryDocuments('orders', { status: ['in_progress', 'pending', 'planned'] });
        const delayedOrdersPromise = queryDocuments('orders', { status: ['!=', 'completed'], dueDate: ['<', new Date().toISOString()] });
        const allMaterialsPromise = queryDocuments('materials');

        return Promise.all([activeOrdersPromise, delayedOrdersPromise, allMaterialsPromise])
          .then(([activeOrdersResult, delayedOrdersResult, allMaterialsResult]) => {
            const criticalMaterials = allMaterialsResult.filter(m => m.quantity <= (m.minLevel || m.criticalStockLevel || 0));
            return {
              activeOrders: activeOrdersResult.length,
              ongoingProduction: activeOrdersResult.filter(o => o.status === 'in_progress').length,
              delayedOrders: delayedOrdersResult.length,
              criticalMaterials: criticalMaterials.length,
            };
          })
          .catch(err => {
            defaultLogger.error("[ApiService-Mock] Error fetching dashboard summary from Firebase:", err);
            return Promise.reject({ status: 500, message: `Error fetching dashboard summary from Firebase: ${err.message}` });
          });
        }
      case '/production/schedule':
        return queryDocuments('productionSchedules', params) 
          .catch(error => {
            defaultLogger.error('[ApiService-Mock] Error fetching /production/schedule from Firebase:', error);
            return Promise.reject({ status: 500, message: `Error fetching production schedule from Firebase: ${error.message}` });
          });
      case '/production/resources':
        return queryDocuments('productionResources', params) 
          .catch(error => {
            defaultLogger.error('[ApiService-Mock] Error fetching /production/resources from Firebase:', error);
            return Promise.reject({ status: 500, message: `Error fetching production resources from Firebase: ${error.message}` });
          });
      case '/production/active':
        return queryDocuments('productionTasks', { ...params, status: 'active' }) 
          .catch(error => {
            defaultLogger.error('[ApiService-Mock] Error fetching /production/active from Firebase:', error);
            return Promise.reject({ status: 500, message: `Error fetching active production from Firebase: ${error.message}` });
          });
      default:
        defaultLogger.warn(`[ApiService-Mock] Endpoint ${endpoint} not specifically handled by Firebase mock. Falling back to original mock or error.`);
        return Promise.reject({ status: 404, message: `Mock GET için endpoint bulunamadı: ${endpoint}` });
    }
  }

  async postMockData(endpoint, data, method = 'POST') {
    defaultLogger.info(`[ApiService-Mock] ${method}: ${endpoint} with data:`, data);
    const idMatch = endpoint.match(/^\/(orders|materials)\/([^/]+)$/); // Corrected regex
    const plainEndpoint = endpoint.split('?')[0];

    if (method === 'PUT' && idMatch) {
      const collectionName = idMatch[1];
      const docId = idMatch[2];
      return updateDocument(collectionName, docId, data)
        .then(() => getDocument(collectionName, docId)) 
        .catch(error => {
          defaultLogger.error(`[ApiService-Mock] Error updating ${collectionName}/${docId} in Firebase:`, error);
          return Promise.reject({ status: 500, message: `Error updating in Firebase: ${error.message}` });
        });
    }

    if (method === 'POST') {
      switch (plainEndpoint) {
        case '/orders':
          return addDocument('orders', data)
            .catch(error => {
              defaultLogger.error('[ApiService-Mock] Error adding /orders to Firebase:', error);
              return Promise.reject({ status: 500, message: `Error adding order to Firebase: ${error.message}` });
            });
        case '/materials':
          return addDocument('materials', data)
            .catch(error => {
              defaultLogger.error('[ApiService-Mock] Error adding /materials to Firebase:', error);
              return Promise.reject({ status: 500, message: `Error adding material to Firebase: ${error.message}` });
            });
        default:
          defaultLogger.warn(`[ApiService-Mock] POST Endpoint ${endpoint} not specifically handled by Firebase mock.`);
          return Promise.reject({ status: 404, message: `Mock POST için endpoint bulunamadı: ${endpoint}` });
      }
    }
    defaultLogger.warn(`[ApiService-Mock] ${method} for ${endpoint} not handled by Firebase mock.`);
    return Promise.reject({ status: 405, message: `Method ${method} not allowed or mock not implemented for ${endpoint}` });
  }

  async deleteMockData(endpoint) {
    defaultLogger.info(`[ApiService-Mock] DELETE: ${endpoint}`);
    const idMatch = endpoint.match(/^\/(orders|materials)\/([^/]+)$/); // Corrected regex

    if (idMatch) {
      const collectionName = idMatch[1];
      const docId = idMatch[2];
      return deleteDocument(collectionName, docId)
        .then(() => ({ success: true, message: `${collectionName} ${docId} deleted from Firebase (mock mode)` }))
        .catch(error => {
          defaultLogger.error(`[ApiService-Mock] Error deleting ${collectionName}/${docId} from Firebase:`, error);
          return Promise.reject({ status: 500, message: `Error deleting from Firebase: ${error.message}` });
        });
    }
    defaultLogger.warn(`[ApiService-Mock] DELETE Endpoint ${endpoint} not specifically handled by Firebase mock.`);
    return Promise.reject({ status: 404, message: `Mock DELETE için endpoint bulunamadı: ${endpoint}` });
  }

  _getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json' // Added Accept header
    };

    // Pinia store'u doğrudan burada kullanmak yerine, 
    // dışarıdan inject etmek veya interceptor kullanmak daha iyi olabilir.
    // Şimdilik mevcut yapıyı koruyalım.
    try {
       const authStore = useAuthStore();
       const token = authStore.token;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
       }
    } catch (e) {
        console.warn('Auth store could not be accessed outside setup. Ensure Pinia is initialized.');
    }
    
    return headers;
  }
  
  async _handleResponse(response, expectNoContent = false) {
    if (!response.ok) {
       const error = new Error(`HTTP error! Status: ${response.status}`);
       try {
           const errorData = await response.json();
           error.data = errorData;
           error.message = errorData.message || error.message; 
       } catch (e) {
            // JSON parse edilemezse status text'i kullan
           error.message = `${error.message} - ${response.statusText}`;
       }
       
      if (response.status === 401) {
         // Yetkilendirme hatasında logout yap
         try {
        const authStore = useAuthStore();
        authStore.logout();
         } catch (e) { 
            console.warn('Auth store could not be accessed outside setup for logout.');
         }
       }
       throw error; // Hata nesnesini fırlat
    }
    
    if (expectNoContent || response.status === 204) { 
      return; // No content expected or received
    }

    // Başarılı yanıtı JSON olarak parse et
    try {
        return await response.json();
    } catch(e) {
        // JSON parse hatası durumunda boş yanıt veya hata fırlatılabilir
        console.error('API response JSON parse error:', e);
        throw new Error('Invalid JSON response from server');
    }
  }
  
   _handleError(error) {
        // Ağ hatası veya diğer fetch hatalarını işle
        if (!error.response) { // Eğer `_handleResponse` içinden gelmiyorsa (örn: ağ hatası)
             error.message = `Network Error: ${error.message}`;
        }
        // Hata loglanabilir veya global bir hata state'ine gönderilebilir
        // Şimdilik sadece hatayı tekrar fırlatıyoruz
        return error;
   }

  //-----------------------------------------------------
  // Spesifik Endpoint Metodları (R3/apiService.js'den)
  //-----------------------------------------------------

  async getOrders(params = {}) {
    return this.get('/orders', params);
  }

  async getOrderDetails(orderId) {
    return this.get(`/orders/${orderId}`);
  }

  async createOrder(orderData) {
    return this.post('/orders', orderData);
  }

  async updateOrder(orderId, orderData) {
    return this.put(`/orders/${orderId}`, orderData);
  }

  async deleteOrder(orderId) {
    return this.delete(`/orders/${orderId}`);
  }

  async getProductionData() {
    // Bu endpoint daha spesifik olabilir, örn: /production/summary
    return this.get('/production'); 
  }

  async updateProductionStatus(statusData) {
    // Endpoint /production/:id/status veya /production/status olabilir
    return this.put('/production/status', statusData); 
  }

  async getInventory(params = {}) {
     // R3'teki endpoint /stock idi, /inventory daha mantıklı olabilir
    return this.get('/inventory', params); 
  }

  async updateInventoryItem(itemId, itemData) {
    return this.put(`/inventory/${itemId}`, itemData);
  }
  
   // Diğer spesifik metodlar eklenebilir (kullanıcılar, malzemeler vb.)

  //-----------------------------------------------------
  // Mock Veri Yönetimi (Geliştirilmiş)
  //-----------------------------------------------------

  _legacyGetMockData(endpoint, params) {
    console.log(`[ApiService MOCK] GET request. Path: "${endpoint}", Params:`, JSON.parse(JSON.stringify(params)));
    const url = new URL(endpoint, 'http://mock.url'); 
    let path = url.pathname; 

    if (this.baseUrl && this.baseUrl !== '/' && path.startsWith(this.baseUrl)) {
        path = path.substring(this.baseUrl.length);
        if (!path.startsWith('/')) {
            path = '/' + path;
        }
    }

    // Siparişler - Tüm siparişler
    if (path === '/orders') {
        let filteredOrders = [...this._mockData.orders];
        console.log(`[ApiService MOCK] GET /orders: Returning ${filteredOrders.length} orders. Current _mockData.orders count: ${this._mockData.orders.length}.`);
        console.log(`[ApiService MOCK] GET /orders: Orders being returned (full):`, JSON.parse(JSON.stringify(filteredOrders)));
        return Promise.resolve(JSON.parse(JSON.stringify(filteredOrders))); 
    }

    // Siparişler - Belirli bir siparişin detayı
    const orderDetailMatch = path.match(/^\/orders\/([^/]+)$/);
    if (orderDetailMatch) {
        const orderId = orderDetailMatch[1];
        const order = this._mockData.orders.find(o => o.id === orderId);
        return order ? Promise.resolve(JSON.parse(JSON.stringify(order))) : Promise.reject(new Error(`Mock Order Not Found: ${orderId}`));
    }

    // Siparişler - Alt kaynaklar (notlar, zaman çizelgesi, üretim, malzemeler)
    const orderSubResourceMatch = path.match(/^\/orders\/([^/]+)\/(notes|timeline|production|materials)$/);
    if (orderSubResourceMatch) {
        const orderId = orderSubResourceMatch[1];
        const subResource = orderSubResourceMatch[2];
        
        const orderExists = this._mockData.orders.some(o => o.id === orderId);
        if (!orderExists) {
            return Promise.reject(new Error(`Mock Order Not Found for sub-resource query: ${orderId}`));
        }

        const details = this._mockData.orderDetails[orderId];
        if (!details) {
            // Detay yoksa, varsayılan boş yapılar döndür
            console.warn(`Mock orderDetails not found for ${orderId}, returning default empty structure for ${subResource}`);
            switch (subResource) {
                case 'notes': return Promise.resolve([]);
                case 'timeline': return Promise.resolve([]);
                case 'production': return Promise.resolve({ steps: [], data: [] });
                case 'materials': return Promise.resolve([]);
            }
        }

        switch (subResource) {
            case 'notes':
                return Promise.resolve(JSON.parse(JSON.stringify(details.notes || [])));
            case 'timeline':
                return Promise.resolve(JSON.parse(JSON.stringify(details.timeline || [])));
            case 'production':
                return Promise.resolve(JSON.parse(JSON.stringify(details.production || { steps: [], data: [] })));
            case 'materials':
                return Promise.resolve(JSON.parse(JSON.stringify(details.materials || [])));
        }
    }

    // Üretim (Genel)
    if (path === '/production') {
        return Promise.resolve(JSON.parse(JSON.stringify(this._mockData.production))); 
    }
    if (path === '/production/status') { 
         return Promise.resolve({ success: true }); // PUT için mock yanıt
    }

    // Envanter
    if (path === '/inventory') {
        return Promise.resolve(JSON.parse(JSON.stringify(this._mockData.inventory)));
    }
     if (path.startsWith('/inventory/')) {
         return Promise.resolve({ success: true }); // PUT için mock yanıt
     }

    // Dashboard (Örnekler src/api-service.js'den alınabilir)
     if (path === '/dashboard/stats') { 
         return Promise.resolve(this._mockData.dashboardStats); 
     }
     if (path === '/dashboard/order-trend') {
         return Promise.resolve(this._mockData.dashboardOrderTrend);
     }

    // Schedule
    if (path === '/schedule') {
      return Promise.resolve([
        { id: 'task1', title: 'Sipariş #123 Üretimi', start: '2025-05-16', end: '2025-05-20', resourceId: 'machine1', progress: 60 },
        { id: 'task2', title: 'Malzeme Kesimi - Sipariş #124', start: '2025-05-18', end: '2025-05-22', resourceId: 'machine2', progress: 30 },
        { id: 'task3', title: 'Kalite Kontrol - Sipariş #123', start: '2025-05-20', end: '2025-05-21', resourceId: 'qc1', progress: 0 },
      ]);
    }

    // Resources
    if (path === '/resources') {
      return Promise.resolve([
        { id: 'machine1', name: 'CNC Makinesi Alpha', type: 'machine', status: 'active' },
        { id: 'machine2', name: 'Kaynak İstasyonu Beta', type: 'machine', status: 'maintenance' },
        { id: 'qc1', name: 'Kalite Kontrol Alanı', type: 'area', status: 'active' },
        { id: 'user1', name: 'Ahmet Yılmaz', type: 'operator', status: 'active' },
      ]);
    }

    // Active
    if (path === '/active') {
      return Promise.resolve(JSON.parse(JSON.stringify(this._mockData.active))); // Corrected to use _mockData.active
    }

    // Production Schedule, Resources, Active (from myrule2.mdc)
    if (path === '/production/schedule') {
      return Promise.resolve(JSON.parse(JSON.stringify(this._mockData.productionSchedule)));
    }
    if (path === '/production/resources') {
      return Promise.resolve(JSON.parse(JSON.stringify(this._mockData.productionResources)));
    }
    if (path === '/production/active') { // This might be duplicative with /active, consider merging or clarifying
      return Promise.resolve(JSON.parse(JSON.stringify(this._mockData.productionActive)));
    }

    console.warn(`Mock GET için endpoint bulunamadı: ${endpoint}`);
    return Promise.reject(new Error(`Mock data not found for GET ${endpoint}`));
  }

  _legacyPostMockData(endpoint, data, method = 'POST') {
    console.log(`[ApiService MOCK] POST/PUT request. Path: ${endpoint}, Method: ${method}, Incoming Data:`, JSON.parse(JSON.stringify(data)));
    const url = new URL(endpoint, 'http://mock.url');
    let path = url.pathname; 

    if (this.baseUrl && this.baseUrl !== '/' && path.startsWith(this.baseUrl)) {
        path = path.substring(this.baseUrl.length);
        if (!path.startsWith('/')) {
            path = '/' + path;
        }
    }

    if (path === '/orders' && method === 'POST') {
      const newOrderDataFromForm = { ...data }; // data is from collectFormData

      const newOrderForList = {}; 

      newOrderForList.id = `order-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      newOrderForList.orderNo = `SIP-${Date.now().toString().slice(-5)}`; 
      newOrderForList.customer = newOrderDataFromForm.customer;

      if (newOrderDataFromForm.cells && newOrderDataFromForm.cells.length > 0) {
        newOrderForList.cellType = newOrderDataFromForm.cells[0].cellType; 
        newOrderForList.quantity = newOrderDataFromForm.cells.reduce((sum, cell) => sum + (parseInt(cell.quantity, 10) || 0), 0);
      } else {
        newOrderForList.cellType = 'N/A';
        newOrderForList.quantity = 0;
      }

      newOrderForList.orderDate = newOrderDataFromForm.orderDate || new Date().toISOString();
      newOrderForList.status = newOrderDataFromForm.status || 'pending';
      newOrderForList.priority = newOrderDataFromForm.priority || 'medium';
      newOrderForList.progress = newOrderDataFromForm.progress || 0;
      newOrderForList.notesCount = 0; 
      newOrderForList.issuesCount = 0; 

      this._mockData.orders.push(newOrderForList);

      this._mockData.orderDetails[newOrderForList.id] = {
        ...newOrderDataFromForm,
        id: newOrderForList.id, 
        orderNo: newOrderForList.orderNo, 
        notes: [],
        timeline: [{ event: 'Sipariş oluşturuldu', date: new Date().toISOString(), type: 'created', user: 'Sistem (Mock)' }],
        production: { steps: [], currentStep: 0, overallProgress: 0, status: 'pending' },
        materials: [],
        documents: [],
      };
      
      console.log(`[ApiService MOCK] POST /orders: Added new order to list. ID: ${newOrderForList.id}. Total orders in _mockData.orders now: ${this._mockData.orders.length}`);
      console.log('[ApiService MOCK] POST /orders: New order object for list:', JSON.parse(JSON.stringify(newOrderForList)));
      console.log('[ApiService MOCK] POST /orders: _mockData.orders current state (full):', JSON.parse(JSON.stringify(this._mockData.orders)));
      
      return Promise.resolve({ success: true, data: JSON.parse(JSON.stringify(newOrderForList)), message: 'Sipariş başarıyla oluşturuldu (mock).' });
    }

    if (path.startsWith('/orders/') && path.endsWith('/notes') && method === 'POST') {
        const orderId = path.split('/')[2];
        if (this._mockData.orderDetails[orderId]) {
            const newNote = { ...data, id: `note-${Date.now()}`, createdAt: new Date().toISOString(), resolved: false };
            this._mockData.orderDetails[orderId].notes.push(newNote);
            return Promise.resolve(JSON.parse(JSON.stringify(newNote)));
        } else {
            return Promise.reject(new Error(`Order details not found for ${orderId} to add note.`));
        }
    }
    // PATCH for /orders/:orderId/notes/:noteId for resolving a note
    const noteResolveMatch = path.match(/^\/orders\/([^/]+)\/notes\/([^/]+)$/);
    if (noteResolveMatch && method === 'PATCH') { // Assuming PATCH is used for updates
        const orderId = noteResolveMatch[1];
        const noteId = noteResolveMatch[2];
        if (this._mockData.orderDetails[orderId] && this._mockData.orderDetails[orderId].notes) {
            const note = this._mockData.orderDetails[orderId].notes.find(n => n.id === noteId);
            if (note) {
                Object.assign(note, data); // Update note with provided data (e.g., { resolved: true })
                return Promise.resolve(JSON.parse(JSON.stringify(note)));
            }
        }
        return Promise.reject(new Error(`Note not found for PATCH: ${orderId}/${noteId}`));
    }
    // PATCH for /orders/:orderId for updating status
    const orderStatusUpdateMatch = path.match(/^\/orders\/([^/]+)$/);
    if (orderStatusUpdateMatch && method === 'PATCH') { // Assuming PATCH is used for updates
        const orderId = orderStatusUpdateMatch[1];
        const order = this._mockData.orders.find(o => o.id === orderId);
        if (order) {
            Object.assign(order, data); // Update order with provided data (e.g., { status: 'newStatus' })
            // Potentially update timeline as well
            if (data.status && this._mockData.orderDetails[orderId]) {
                 this._mockData.orderDetails[orderId].timeline.push({
                    id: `tl_status_${Date.now()}`,
                    type: 'status-change',
                    description: `Durum güncellendi: ${data.status}`,
                    timestamp: new Date().toISOString(),
                    user: 'Sistem (Mock)'
                 });
            }
            return Promise.resolve(JSON.parse(JSON.stringify(order)));
        }
        return Promise.reject(new Error(`Order not found for PATCH: ${orderId}`));
    }

    if (path === '/production/status' && method === 'PUT') {
        console.log('Mock production status updated:', data);
        return Promise.resolve({ success: true });
    }
     if (path.startsWith('/inventory/') && method === 'PUT') {
         const itemId = path.split('/')[2];
         console.log(`Mock inventory item ${itemId} updated:`, data);
         return Promise.resolve({ success: true });
     }

    console.warn(`Mock ${method} için endpoint bulunamadı: ${endpoint}`);
    return Promise.resolve({ success: true, message: `Mock ${method} successful`, data });
  }

  _legacyDeleteMockData(endpoint) {
    console.log(`%cMock DELETE: ${endpoint}`, 'color: red; font-weight: bold;');
     const url = new URL(endpoint, 'http://mock.url');
     let path = url.pathname; 

    if (this.baseUrl && this.baseUrl !== '/' && path.startsWith(this.baseUrl)) {
        path = path.substring(this.baseUrl.length);
        if (!path.startsWith('/')) {
            path = '/' + path;
        }
    }

     if (path.startsWith('/orders/')) {
         const orderId = path.split('/')[2];
         const index = this._mockData.orders.findIndex(o => o.id === orderId);
         if (index > -1) {
             this._mockData.orders.splice(index, 1);
             return Promise.resolve(); 
         } else {
             return Promise.reject(new Error('Mock Order Not Found for DELETE'));
         }
     }
     
     console.warn(`Mock DELETE için endpoint bulunamadı: ${endpoint}`);
     return Promise.resolve(); 
  }

  _mockData = {
      orders: [
          { id: 'order-001', orderNo: 'SIP-2024001', customer: 'AYEDAŞ', cellType: 'RM 36 CB', quantity: 1, orderDate: '2024-01-15T10:00:00Z', status: 'completed', priority: 'high', progress: 100, notesCount: 2, issuesCount: 0 },
          { id: 'order-002', orderNo: 'SIP-2024002', customer: 'ENERJİSA', cellType: 'RM 24 CB', quantity: 3, orderDate: '2024-01-20T11:30:00Z', status: 'in_progress', priority: 'medium', progress: 60, notesCount: 1, issuesCount: 1 },
          { id: 'order-003', orderNo: 'SIP-2024003', customer: 'BEDAŞ', cellType: 'RM 36 OG', quantity: 2, orderDate: '2024-02-01T14:15:00Z', status: 'pending', priority: 'medium', progress: 10, notesCount: 0, issuesCount: 0 },
          { id: 'order-004', orderNo: 'SIP-2024004', customer: 'TEİAŞ', cellType: 'RM 24 OG', quantity: 5, orderDate: '2024-02-05T09:00:00Z', status: 'planned', priority: 'low', progress: 0, notesCount: 0, issuesCount: 0 },
      ],
      orderDetails: {
        'order-001': { notes: [], timeline: [], production: {}, materials: [] },
        'order-002': { notes: [], timeline: [], production: {}, materials: [] },
        'order-003': { notes: [], timeline: [], production: {}, materials: [] },
        'order-004': { notes: [], timeline: [], production: {}, materials: [] },
      },
      production: {
          progress: 75,
          activeOrders: 12,
          completedOrders: 45,
          delayedOrders: 3,
      },
      inventory: [
          { id: 'mat-001', code: '137998%', name: 'Siemens 7SR1003-1JA20-2DA0+ZY20 24VDC', quantity: 2, minStock: 5, status: 'Kritik' },
          { id: 'mat-002', code: '144866%', name: 'KAP-80/190-95 Akım Trafosu', quantity: 3, minStock: 5, status: 'Düşük' },
           { id: 'mat-003', code: '120170%', name: 'M480TB/G-027-95.300UN5 Kablo Başlığı', quantity: 12, minStock: 10, status: 'Yeterli' }
      ],
       dashboardStats: { /* ... */ },
       dashboardOrderTrend: { /* ... */ },
       // Added mock data for new production endpoints
       active: { // Renamed from the previous /active to avoid conflict if it was a typo and meant for production
        activeOrders: 5,
        productionLinesRunning: 3,
        alerts: 2,
        efficiency: "88%",
        urgentTasks: [
          { id: 'taskUrgentAlpha', description: 'Sipariş #125 için acil montaj.', priority: 'high' },
          { id: 'taskUrgentBeta', description: 'Malzeme XYZ için kritik stok.', priority: 'high' }
        ]
      },
      productionSchedule: [
        { id: 'sched_task1', title: 'Sipariş #201 Üretim Planı', start: '2025-05-22', end: '2025-05-28', resourceId: 'line1', progress: 20, status: 'in_progress' },
        { id: 'sched_task2', title: 'Sipariş #202 Kesim & Büküm', start: '2025-05-23', end: '2025-05-25', resourceId: 'machine_cnc_1', progress: 50, status: 'in_progress' },
        { id: 'sched_task3', title: 'Sipariş #203 Montaj Hattı', start: '2025-05-26', end: '2025-06-02', resourceId: 'assembly_line_A', progress: 0, status: 'planned' },
      ],
      productionResources: [
        { id: 'line1', name: 'Üretim Hattı 1', type: 'line', status: 'active', capacity: 100, utilization: 75 },
        { id: 'machine_cnc_1', name: 'CNC Makinesi A-01', type: 'machine', status: 'active', operator: 'Ali Veli', maintenanceDue: '2025-06-15' },
        { id: 'assembly_line_A', name: 'Montaj İstasyonu Alpha', type: 'station', status: 'idle', teamSize: 4 },
      ],
      productionActive: { // Data for /production/active
        currentShift: '08:00-16:00',
        activeLines: ['line1', 'line2'],
        personnelOnDuty: 25,
        activeMachineCount: 18,
        issuesReportedToday: 3,
        criticalAlerts: [
            { alertId: 'prod_alert_001', message: 'Makine M-05 aşırı ısındı.', severity: 'critical', timestamp: '2025-05-21T10:30:00Z' }
        ]
      }
  };
}

// Singleton instance oluştur ve export et
export const apiService = new ApiService();