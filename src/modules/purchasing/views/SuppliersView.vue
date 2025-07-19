<template>
  <div class="page-container">
    <!-- Sayfa Başlığı -->
    <h1 class="page-title">Tedarikçi Yönetimi</h1>

    <!-- Üst Bar: Arama ve Eylemler -->
    <div class="top-bar">
      <div class="search-container">
        <input type="text" v-model="searchQuery" placeholder="Tedarikçi ara (isim, kontak...)" class="search-input">
      </div>
      <button @click="openAddModal" class="btn btn-primary">
        <i class="fas fa-plus"></i> Yeni Tedarikçi Ekle
      </button>
    </div>

    <!-- Tedarikçi Listesi Tablosu -->
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Tedarikçi Adı</th>
            <th>İlgili Kişi</th>
            <th>Email</th>
            <th>Telefon</th>
            <th>Performans</th>
            <th>Durum</th>
            <th>Eylemler</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="7" class="text-center">Yükleniyor...</td>
          </tr>
          <tr v-else-if="filteredSuppliers.length === 0">
            <td colspan="7" class="text-center">Sonuç bulunamadı.</td>
          </tr>
          <tr v-for="supplier in filteredSuppliers" :key="supplier.id">
            <td>{{ supplier.name }}</td>
            <td>{{ supplier.contactPerson }}</td>
            <td>{{ supplier.email }}</td>
            <td>{{ supplier.phone }}</td>
            <td>
              <span :class="getPerformanceClass(supplier.performanceRating)">
                {{ supplier.performanceRating.toFixed(1) }} / 5.0
              </span>
            </td>
            <td>
              <span :class="getStatusClass(supplier.status)">
                {{ supplier.status === 'active' ? 'Aktif' : 'Pasif' }}
              </span>
            </td>
            <td class="actions">
              <button @click="openEditModal(supplier)" class="btn btn-sm btn-warning">
                <i class="fas fa-edit"></i>
              </button>
              <button @click="deleteSupplier(supplier.id)" class="btn btn-sm btn-danger">
                <i class="fas fa-trash"></i>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- AI Destekli Tedarikçi Önerileri -->
    <div class="ai-recommendations-panel">
        <h2 class="panel-title">
            <i class="fas fa-lightbulb"></i> AI Destekli Tedarikçi Önerileri
        </h2>
        <div v-if="aiLoading" class="text-center">Öneriler yükleniyor...</div>
        <ul v-else-if="aiRecommendations.length > 0" class="recommendation-list">
            <li v-for="rec in aiRecommendations" :key="rec.id">
                <strong>{{ rec.name }}</strong> - Performans: {{ rec.performanceRating.toFixed(1) }}, Teslimat: {{ rec.deliveryTime }}
            </li>
        </ul>
        <p v-else>Şu an için gösterilecek bir öneri bulunmamaktadır.</p>
        <button @click="getRecommendations" class="btn btn-secondary btn-sm" :disabled="aiLoading">
            Yeni Öneri Al
        </button>
    </div>


    <!-- Tedarikçi Ekleme/Düzenleme Modalı -->
    <div v-if="isModalOpen" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <h2 class="modal-title">{{ isEditMode ? 'Tedarikçi Düzenle' : 'Yeni Tedarikçi Ekle' }}</h2>
        <form @submit.prevent="handleSubmit">
          <div class="form-grid">
            <div class="form-group">
              <label for="name">Tedarikçi Adı</label>
              <input type="text" id="name" v-model="currentSupplier.name" required>
            </div>
            <div class="form-group">
              <label for="contactPerson">İlgili Kişi</label>
              <input type="text" id="contactPerson" v-model="currentSupplier.contactPerson" required>
            </div>
            <div class="form-group">
              <label for="email">Email</label>
              <input type="email" id="email" v-model="currentSupplier.email" required>
            </div>
            <div class="form-group">
              <label for="phone">Telefon</label>
              <input type="tel" id="phone" v-model="currentSupplier.phone">
            </div>
            <div class="form-group full-width">
              <label for="address">Adres</label>
              <textarea id="address" v-model="currentSupplier.address"></textarea>
            </div>
             <div class="form-group">
              <label for="performanceRating">Performans Puanı (1-5)</label>
              <input type="number" id="performanceRating" v-model.number="currentSupplier.performanceRating" min="1" max="5" step="0.1">
            </div>
            <div class="form-group">
              <label for="status">Durum</label>
              <select id="status" v-model="currentSupplier.status">
                <option value="active">Aktif</option>
                <option value="inactive">Pasif</option>
              </select>
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" @click="closeModal" class="btn btn-secondary">İptal</button>
            <button type="submit" class="btn btn-primary">{{ isEditMode ? 'Güncelle' : 'Kaydet' }}</button>
          </div>
        </form>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { supplierService } from '@/services/supplier-service.js';
import { useToast } from '@/composables/useToast.js';

const suppliers = ref([]);
const loading = ref(true);
const searchQuery = ref('');
const isModalOpen = ref(false);
const isEditMode = ref(false);
const currentSupplier = ref({});

const aiRecommendations = ref([]);
const aiLoading = ref(false);

const { showToast } = useToast();

onMounted(async () => {
  await fetchSuppliers();
  await getRecommendations();
});

async function fetchSuppliers() {
  try {
    loading.value = true;
    suppliers.value = await supplierService.getSuppliers();
  } catch (error) {
    showToast('Tedarikçiler yüklenirken bir hata oluştu.', 'error');
    console.error(error);
  } finally {
    loading.value = false;
  }
}

const filteredSuppliers = computed(() => {
  if (!searchQuery.value) {
    return suppliers.value;
  }
  const lowerCaseQuery = searchQuery.value.toLowerCase();
  return suppliers.value.filter(s =>
    s.name.toLowerCase().includes(lowerCaseQuery) ||
    s.contactPerson.toLowerCase().includes(lowerCaseQuery) ||
    s.email.toLowerCase().includes(lowerCaseQuery)
  );
});

function openAddModal() {
  isEditMode.value = false;
  currentSupplier.value = {
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    performanceRating: 4.0,
    deliveryTime: '3 gün',
    status: 'active'
  };
  isModalOpen.value = true;
}

function openEditModal(supplier) {
  isEditMode.value = true;
  currentSupplier.value = { ...supplier };
  isModalOpen.value = true;
}

function closeModal() {
  isModalOpen.value = false;
}

async function handleSubmit() {
  try {
    if (isEditMode.value) {
      await supplierService.updateSupplier(currentSupplier.value.id, currentSupplier.value);
      showToast('Tedarikçi başarıyla güncellendi.', 'success');
    } else {
      await supplierService.addSupplier(currentSupplier.value);
      showToast('Tedarikçi başarıyla eklendi.', 'success');
    }
    await fetchSuppliers();
    closeModal();
  } catch (error) {
    showToast('İşlem sırasında bir hata oluştu.', 'error');
    console.error(error);
  }
}

async function deleteSupplier(id) {
  if (confirm('Bu tedarikçiyi silmek istediğinizden emin misiniz?')) {
    try {
      await supplierService.deleteSupplier(id);
      showToast('Tedarikçi başarıyla silindi.', 'success');
      await fetchSuppliers();
    } catch (error) {
      showToast('Tedarikçi silinirken bir hata oluştu.', 'error');
      console.error(error);
    }
  }
}

async function getRecommendations() {
    try {
        aiLoading.value = true;
        // Örnek bir sipariş gereksinimi objesi
        const orderRequirements = {
            materialType: 'metal',
            quantity: 1000,
            urgency: 'high'
        };
        aiRecommendations.value = await supplierService.getAISupplierRecommendations(orderRequirements);
    } catch (error) {
        showToast('AI önerileri alınırken bir hata oluştu.', 'error');
        console.error(error);
    } finally {
        aiLoading.value = false;
    }
}


function getStatusClass(status) {
  return status === 'active' ? 'badge badge-success' : 'badge badge-danger';
}

function getPerformanceClass(rating) {
  if (rating >= 4.5) return 'badge badge-success';
  if (rating >= 4.0) return 'badge badge-warning';
  return 'badge badge-danger';
}

</script>

<style scoped>
.page-container {
  padding: 2rem;
  background-color: #f4f6f9;
}

.page-title {
  font-size: 2rem;
  font-weight: 600;
  color: #333;
  margin-bottom: 1.5rem;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.search-container {
  flex-grow: 1;
  margin-right: 1rem;
}

.search-input {
  width: 100%;
  max-width: 400px;
  padding: 0.75rem 1rem;
  border: 1px solid #ccc;
  border-radius: 8px;
  font-size: 1rem;
}

.table-container {
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0,0,0,0.05);
  overflow: hidden;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th, .data-table td {
  padding: 1rem 1.25rem;
  text-align: left;
  border-bottom: 1px solid #e0e0e0;
}

.data-table th {
  background-color: #f7f7f7;
  font-weight: 600;
  color: #555;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.btn-sm {
    padding: 0.3rem 0.6rem;
    font-size: 0.9rem;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background-color: #fff;
  padding: 2rem;
  border-radius: 8px;
  width: 90%;
  max-width: 700px;
  box-shadow: 0 5px 15px rgba(0,0,0,0.3);
}

.modal-title {
  margin-bottom: 1.5rem;
  font-size: 1.5rem;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group.full-width {
  grid-column: 1 / -1;
}

.form-group label {
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.form-group input,
.form-group select,
.form-group textarea {
  padding: 0.75rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
}

.form-group textarea {
    min-height: 80px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 2rem;
}

/* Badge Styles */
.badge {
  padding: 0.4em 0.7em;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #fff;
}

.badge-success { background-color: #28a745; }
.badge-warning { background-color: #ffc107; color: #333; }
.badge-danger { background-color: #dc3545; }

/* AI Panel */
.ai-recommendations-panel {
    background-color: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 1.5rem;
    margin-top: 2rem;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.panel-title {
    font-size: 1.3rem;
    color: #333;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
}

.panel-title .fa-lightbulb {
    margin-right: 0.75rem;
    color: #f0ad4e;
}

.recommendation-list {
    list-style-type: none;
    padding-left: 0;
    margin-bottom: 1rem;
}

.recommendation-list li {
    padding: 0.5rem 0;
    border-bottom: 1px solid #f0f0f0;
}
.recommendation-list li:last-child {
    border-bottom: none;
}

</style>
