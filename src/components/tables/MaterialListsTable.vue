<template>
  <div class="table-responsive">
    <table class="table table-hover table-striped table-sm">
      <thead class="table-light">
        <tr>
          <th scope="col">Liste Adı</th>
          <th scope="col">Tipi</th>
          <th scope="col">Hücre Tipi</th>
          <th scope="col">Oluşturma Tarihi</th>
          <th scope="col">Malzeme Sayısı</th>
          <th scope="col" class="text-end">İşlemler</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!lists || lists.length === 0">
          <td colspan="6" class="text-center text-muted">
            <i class="bi bi-inbox me-2"></i>Henüz malzeme listesi bulunmuyor.
          </td>
        </tr>
        <tr v-for="list in lists" :key="list.id">
          <td>{{ list.name }}</td>
          <td>
            <span :class="['badge', list.type === 'primer' ? 'bg-primary' : 'bg-secondary']">
              {{ list.type }}
            </span>
          </td>
          <td>{{ list.cellType }}</td>
          <td>{{ formatDate(list.createdAt) }}</td>
          <td>{{ list.materialsCount || 0 }}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary me-2" title="Listeyi Görüntüle">
              <i class="bi bi-eye"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" title="Listeyi Sil">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { defineProps } from 'vue';
import { format } from 'date-fns';

defineProps({
  lists: {
    type: Array,
    default: () => []
  }
});

const formatDate = (date) => {
  if (!date) return 'N/A';
  try {
    return format(new Date(date), 'dd.MM.yyyy');
  } catch (error) {
    return date;
  }
};
</script>

<style scoped>
.table-responsive {
  min-height: 200px;
}
.table-hover tbody tr:hover {
  background-color: #f8f9fa;
}
</style>
