<template>
  <div class="ai-document-search-panel">
    <h3>Teknik Dokümanlarda AI Destekli Arama</h3>
    <form @submit.prevent="onSearch">
      <input v-model="query" type="text" class="form-control" placeholder="Teknik terim, parça kodu veya konu girin..." />
      <button class="btn btn-primary mt-2" :disabled="loading">Ara</button>
    </form>
    <div v-if="loading" class="mt-3">AI arıyor...</div>
    <div v-if="error" class="text-danger mt-2">{{ error }}</div>
    <div v-if="results.length" class="mt-3">
      <h5>Sonuçlar:</h5>
      <ul>
        <li v-for="doc in results" :key="doc.id">
          <strong>{{ doc.title }}</strong>
          <button class="btn btn-link btn-sm" @click="summarize(doc.id)">AI ile Özetle</button>
          <div v-if="summaries[doc.id]" class="ai-summary-box mt-1">{{ summaries[doc.id] }}</div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { searchDocumentsForAI, summarizeDocumentForAI } from '@/services/ai-service';

const query = ref('');
const loading = ref(false);
const error = ref('');
const results = ref([]);
const summaries = ref({});

async function onSearch() {
  loading.value = true;
  error.value = '';
  results.value = [];
  try {
    const res = await searchDocumentsForAI(query.value);
    results.value = res.documents || [];
  } catch (e) {
    error.value = e.message || 'Arama sırasında hata oluştu';
  } finally {
    loading.value = false;
  }
}

async function summarize(docId) {
  summaries.value[docId] = 'AI özetleniyor...';
  try {
    const res = await summarizeDocumentForAI(docId);
    summaries.value[docId] = res.summary || JSON.stringify(res);
  } catch (e) {
    summaries.value[docId] = 'AI özet alınamadı: ' + (e.message || 'Bilinmeyen hata');
  }
}
</script>

<style scoped>
.ai-document-search-panel {
  background: #f8fafd;
  border: 1px solid #e0e6ed;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  max-width: 600px;
}
.ai-summary-box {
  background: #eef6fa;
  border-left: 3px solid #007bff;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  margin-top: 0.5rem;
  font-size: 0.98rem;
}
</style>
