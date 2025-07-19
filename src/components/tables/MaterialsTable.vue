<template>
  <div class="materials-table-container">
    <div v-if="isLoading" class="loading-overlay">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Yükleniyor...</span>
      </div>
    </div>
    <div v-if="!isLoading && materials.length === 0" class="empty-state">
      <i class="bi bi-box-seam"></i>
      <p>Gösterilecek malzeme bulunamadı.</p>
      <button class="btn btn-primary" @click="$emit('add-material')">
        <i class="bi bi-plus-circle me-1"></i>
        İlk Malzemeyi Ekle
      </button>
    </div>
    <div class="table-responsive" v-else>
      <table class="table table-hover table-striped align-middle">
        <thead class="table-light">
          <tr>
            <th scope="col">Malzeme Adı</th>
            <th scope="col">Kategori</th>
            <th scope="col" class="text-center">Stok Miktarı</th>
            <th scope="col">Birim</th>
            <th scope="col">Son Güncelleme</th>
            <th scope="col" class="text-center">İşlemler</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="material in materials" :key="material.id">
            <td>
              <strong>{{ material.name }}</strong>
              <div v-if="material.description" class="text-muted small">{{ material.description }}</div>
            </td>
            <td>
              <span class="badge" :style="{ backgroundColor: getCategoryColor(material.category) }">
                {{ material.category }}
              </span>
            </td>
            <td class="text-center">
              <span class="fw-bold fs-5">{{ material.stock }}</span>
            </td>
            <td>{{ material.unit }}</td>
            <td>{{ formatDate(material.lastUpdated) }}</td>
            <td class="text-center">
              <button class="btn btn-sm btn-outline-primary me-2" @click="$emit('edit-material', material)" title="Malzemeyi Düzenle">
                <i class="bi bi-pencil-square"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger" @click="$emit('delete-material', material.id)" title="Malzemeyi Sil">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  materials: {
    type: Array,
    required: true,
    default: () => []
  },
  isLoading: {
    type: Boolean,
    default: false
  }
});

defineEmits(['edit-material', 'delete-material', 'add-material']);

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('tr-TR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const getCategoryColor = (category) => {
  const colors = [
    '#1abc9c', '#2ecc71', '#3498db', '#9b59b6', '#34495e',
    '#f1c40f', '#e67e22', '#e74c3c', '#95a5a6', '#16a085'
  ];
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash % colors.length);
  return colors[index];
};
</script>

<style scoped>
.materials-table-container {
  position: relative;
  min-height: 200px;
}
.loading-overlay {
  position: absolute;
  inset: 0;
  background-color: rgba(255, 255, 255, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
}
.empty-state {
  text-align: center;
  padding: 40px;
  color: #6c757d;
}
.empty-state .bi {
  font-size: 3rem;
  margin-bottom: 1rem;
}
.table {
  font-size: 0.95rem;
}
.badge {
  color: white;
  padding: 0.4em 0.7em;
  border-radius: 0.25rem;
}
</style>
