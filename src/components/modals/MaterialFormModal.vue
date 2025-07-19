<template>
  <div class="modal fade" :id="modalId" tabindex="-1" :aria-labelledby="modalLabel" aria-hidden="true">
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="modalLabel">{{ isEditMode ? 'Malzeme Dözenle' : 'Yeni Malzeme Ekle' }}</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="handleSubmit">
            <div class="row">
              <div class="col-md-6 mb-3">
                <label for="material-name" class="form-label">Malzeme Adı</label>
                <input type="text" class="form-control" id="material-name" v-model="form.name" required>
              </div>
              <div class="col-md-6 mb-3">
                <label for="material-code" class="form-label">Malzeme Kodu</label>
                <input type="text" class="form-control" id="material-code" v-model="form.code" required>
              </div>
            </div>
            <div class="mb-3">
              <label for="material-description" class="form-label">Açıklama</label>
              <textarea class="form-control" id="material-description" v-model="form.description" rows="3"></textarea>
            </div>
            <div class="row">
              <div class="col-md-6 mb-3">
                <label for="stock-quantity" class="form-label">Stok Miktarı</label>
                <input type="number" class="form-control" id="stock-quantity" v-model.number="form.stock" required>
              </div>
              <div class="col-md-6 mb-3">
                <label for="unit-price" class="form-label">Birim Fiyat</label>
                <input type="number" class="form-control" id="unit-price" v-model.number="form.unitPrice" required>
              </div>
            </div>
             <div class="row">
                <div class="col-md-6 mb-3">
                    <label for="supplier" class="form-label">Tedarikçi</label>
                    <input type="text" class="form-control" id="supplier" v-model="form.supplier">
                </div>
                <div class="col-md-6 mb-3">
                    <label for="category" class="form-label">Kategori</label>
                    <input type="text" class="form-control" id="category" v-model="form.category">
                </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Kapat</button>
              <button type="submit" class="btn btn-primary">{{ isEditMode ? 'Güncelle' : 'Kaydet' }}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { Modal } from 'bootstrap';

const props = defineProps({
  material: {
    type: Object,
    default: null,
  },
  modalId: {
    type: String,
    required: true,
    default: 'materialFormModal'
  }
});

const emit = defineEmits(['submit']);

const form = ref({});
const isEditMode = ref(false);
let modalInstance = null;

onMounted(() => {
    const modalElement = document.getElementById(props.modalId);
    if (modalElement) {
        modalInstance = new Modal(modalElement);
    }
});

watch(() => props.material, (newVal) => {
  if (newVal) {
    form.value = { ...newVal };
    isEditMode.value = true;
  } else {
    form.value = {
      name: '',
      code: '',
      description: '',
      stock: 0,
      unitPrice: 0,
      supplier: '',
      category: ''
    };
    isEditMode.value = false;
  }
}, { immediate: true, deep: true });

const handleSubmit = () => {
  emit('submit', { ...form.value });
  if(modalInstance) {
      modalInstance.hide();
  }
};

</script>

<style scoped>
.modal-content {
    background-color: #f8f9fa;
}
</style>
