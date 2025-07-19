<template>
  <div>
    <table class="table table-striped table-bordered">
      <thead>
        <tr>
          <th>Liste Adı</th>
          <th>Tip</th>
          <th>Hücre Tipi</th>
          <th>Oluşturulma</th>
          <th>İşlemler</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="list in lists" :key="list.id">
          <td>{{ list.name }}</td>
          <td>{{ list.type }}</td>
          <td>{{ list.cellType }}</td>
          <td>{{ list.createdAt }}</td>
          <td>
            <button class="btn btn-sm btn-outline-primary me-1">Detay</button>
            <button class="btn btn-sm btn-outline-secondary">Düzenle</button>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-if="!lists || lists.length === 0" class="text-muted text-center py-3">Kayıt bulunamadı.</div>
  </div>
</template>
<script setup>
const props = defineProps({
  lists: { type: Array, default: () => [] }
});
</script>
