<template>
  <div class="planning-module">
    <AIInsightsDashboard class="mb-4" ref="insightsDashboard" category="planlama" @insights-loaded="onInsightsLoaded" />
    <div v-if="proactiveCard" class="alert alert-warning d-flex align-items-center mb-3 proactive-card" tabindex="0" :title="proactiveCard.title">
      <i class="bi bi-exclamation-triangle-fill text-warning me-2 fs-3" title="Proaktif Uyarı"></i>
      <div>
        <strong>{{ proactiveCard.title }}</strong>
        <div>{{ proactiveCard.description }}</div>
        <button v-if="proactiveCard.action" class="btn btn-sm btn-primary mt-2" @click="proactiveCard.action.handler" :title="proactiveCard.action.label">
          <i class="bi bi-lightning-charge me-1"></i>{{ proactiveCard.action.label }}
        </button>
      </div>
    </div>

    <!-- AI Tahmin Sonuçları Bileşeni -->
    <div class="row mb-4">
      <div class="col-12">
        <PredictionResults 
          :predictions="productionPredictions" 
          @view-details="showPredictionDetails"
          @generate-new="generateNewPrediction"
        />
      </div>
    </div>

    <div class="row mb-4">
      <div class="col-12">
        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="mb-0">Üretim Takvimi</h5>
            <div class="btn-group" role="group">
              <button type="button" 
                      class="btn btn-sm btn-outline-primary"
                      :class="{ active: calendarView === 'dayGridDay' }"
                      @click="changeCalendarView('dayGridDay')">Günlük</button>
              <button type="button" 
                      class="btn btn-sm btn-outline-primary"
                      :class="{ active: calendarView === 'dayGridWeek' }"
                      @click="changeCalendarView('dayGridWeek')">Haftalık</button>
              <button type="button" 
                      class="btn btn-sm btn-outline-primary"
                      :class="{ active: calendarView === 'dayGridMonth' }"
                      @click="changeCalendarView('dayGridMonth')">Aylık</button>
            </div>
          </div>
          <div class="card-body">
            <div class="calendar-container" :class="{ 'loading': loading }">
              <div v-if="loading" class="text-center py-4">
                <div class="spinner-border text-primary" role="status">
                  <span class="visually-hidden">Yükleniyor...</span>
                </div>
                <p class="mt-2">Planlama verileri yükleniyor...</p>
              </div>
              <div v-else id="productionCalendar" ref="calendarEl">
                <!-- FullCalendar Bileşeni Buraya Gelecek -->
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="row">
      <!-- Kapasite Yönetimi -->
      <div class="col-md-6 mb-4">
        <div class="card h-100">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="mb-0">Kapasite Kullanımı</h5>
            <div class="dropdown">
              <button class="btn btn-sm btn-outline-secondary dropdown-toggle" 
                      type="button" 
                      id="capacityDropdown" 
                      data-bs-toggle="dropdown" 
                      aria-expanded="false">
                {{ selectedUnit ? selectedUnit.name : 'Tüm Birimler' }}
              </button>
              <ul class="dropdown-menu" aria-labelledby="capacityDropdown">
                <li>
                  <a class="dropdown-item" href="#" @click.prevent="selectUnit(null)">
                    Tüm Birimler
                  </a>
                </li>
                <li v-for="unit in productionUnits" :key="unit.id">
                  <a class="dropdown-item" href="#" @click.prevent="selectUnit(unit)">
                    {{ unit.name }}
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div class="card-body">
            <div class="chart-container">
              <canvas ref="capacityChart"></canvas>
            </div>
          </div>
        </div>
      </div>

      <!-- Teslimat Tahminleri -->
      <div class="col-md-6 mb-4">
        <div class="card h-100">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="mb-0">Teslimat Tahminleri</h5>
            <div class="dropdown">
              <button class="btn btn-sm btn-outline-secondary dropdown-toggle" 
                      type="button" 
                      id="deliveryDropdown" 
                      data-bs-toggle="dropdown" 
                      aria-expanded="false">
                {{ timePeriodLabel }}
              </button>
              <ul class="dropdown-menu" aria-labelledby="deliveryDropdown">
                <li v-for="(label, period) in timePeriods" :key="period">
                  <a class="dropdown-item" href="#" @click.prevent="selectTimePeriod(period)">
                    {{ label }}
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div class="card-body">
            <div class="chart-container">
              <canvas ref="deliveryChart"></canvas>
            </div>
          </div>
        </div>
      </div>

      <!-- Üretim Görevleri -->
      <div class="col-12 mb-4">
        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="mb-0">Planlanan Görevler</h5>
            <div class="input-group" style="max-width: 300px;">
              <input type="text" class="form-control form-control-sm" placeholder="Görev ara..." v-model="searchQuery" @input="filterTasks">
              <button class="btn btn-sm btn-outline-secondary"><i class="bi bi-search"></i></button>
            </div>
          </div>
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-hover mb-0">
                <thead>
                  <tr>
                    <th @click="sortBy('taskName')">Görev Adı</th>
                    <th @click="sortBy('unit')">Üretim Birimi</th>
                    <th @click="sortBy('start')">Başlangıç</th>
                    <th @click="sortBy('end')">Bitiş</th>
                    <th @click="sortBy('progress')">İlerleme</th>
                    <th @click="sortBy('status')">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="loading">
                    <td colspan="6" class="text-center py-3">Yükleniyor...</td>
                  </tr>
                  <tr v-else-if="filteredTasks.length === 0">
                    <td colspan="6" class="text-center py-3">Görev bulunamadı</td>
                  </tr>
                  <tr v-for="task in filteredTasks" :key="task.id" @click="viewTaskDetail(task)">
                    <td>{{ task.taskName }}</td>
                    <td>{{ task.unit }}</td>
                    <td>{{ formatDate(task.start) }}</td>
                    <td>{{ formatDate(task.end) }}</td>
                    <td>
                      <div class="progress" style="height: 8px;">
                        <div class="progress-bar" role="progressbar" 
                             :style="{width: `${task.progress}%`}" 
                             :class="getProgressClass(task.progress)"></div>
                      </div>
                      <small class="mt-1 d-block">{{ task.progress }}%</small>
                    </td>
                    <td>
                      <span class="badge" :class="getStatusClass(task.status)">{{ task.status }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Task Detail Modal -->
    <div class="modal fade" id="taskDetailModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Görev Detayı</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body" v-if="selectedTask">
            <div class="task-details">
              <div class="mb-3">
                <label class="fw-bold">Görev Adı</label>
                <p>{{ selectedTask.taskName }}</p>
              </div>
              <div class="mb-3">
                <label class="fw-bold">Üretim Birimi</label>
                <p>{{ selectedTask.unit }}</p>
              </div>
              <div class="row mb-3">
                <div class="col-6">
                  <label class="fw-bold">Başlangıç</label>
                  <p>{{ formatDate(selectedTask.start) }}</p>
                </div>
                <div class="col-6">
                  <label class="fw-bold">Bitiş</label>
                  <p>{{ formatDate(selectedTask.end) }}</p>
                </div>
              </div>
              <div class="mb-3">
                <label class="fw-bold">İlerleme</label>
                <div class="progress" style="height: 10px;">
                  <div class="progress-bar" role="progressbar" 
                       :style="{width: `${selectedTask.progress}%`}" 
                       :class="getProgressClass(selectedTask.progress)"></div>
                </div>
                <small class="mt-1 d-block">{{ selectedTask.progress }}%</small>
              </div>
              <div class="mb-3">
                <label class="fw-bold">Durum</label>
                <p><span class="badge" :class="getStatusClass(selectedTask.status)">{{ selectedTask.status }}</span></p>
              </div>
              <div class="mb-3">
                <label class="fw-bold">Açıklama</label>
                <p>{{ selectedTask.description || 'Açıklama eklenmemiş' }}</p>
              </div>
              <div class="mb-3">
                <label class="fw-bold">İlgili Sipariş</label>
                <p>{{ selectedTask.orderNumber || '-' }}</p>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Kapat</button>
            <button type="button" class="btn btn-primary" @click="editTask" v-if="selectedTask">Düzenle</button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Prediction Details Modal -->
    <PredictionDetailsModal
      v-if="selectedPrediction"
      :prediction="selectedPrediction"
      @close="closePredictionDetails"
      @apply-prediction="applyPredictionToSchedule"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, onBeforeUnmount, watch } from 'vue';
import { usePlanningService } from '@/modules/planning/usePlanningService';
import { useToast } from '@/composables/useToast';

import Chart from 'chart.js/auto';
import { Calendar } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Modal } from 'bootstrap';

import PredictionDetailsModal from '@/components/ai/PredictionDetailsModal.vue';
import PredictionResults from '@/components/ai/PredictionResults.vue';
import AIInsightsDashboard from '@/components/ai/AIInsightsDashboard.vue';

// Servis ve durum yönetimi
const { 
  getPlanningData, 
  productionStatus, 
  startProductionMonitoring, 
  stopProductionMonitoring 
} = usePlanningService();
const { toast } = useToast();

const loading = ref(true);
const calendarView = ref('dayGridWeek');
const calendarEl = ref(null);
const calendar = ref(null);
const capacityChart = ref(null);
const deliveryChart = ref(null);
let capacityChartInstance = null;
let deliveryChartInstance = null;
let taskDetailModal = null;

// Veri reaktif referansları
const tasks = ref([]);
const productionUnits = ref([]);
const capacityLoad = ref({});
const deliveryEstimates = ref([]);

// Kapasite Yönetimi
const selectedUnit = ref(null);

// Teslimat Tahminleri
const selectedPeriod = ref('30d');
const timePeriods = {
  '7d': 'Son 7 Gün',
  '30d': 'Son 30 Gün',
  '90d': 'Son 90 Gün'
};

const timePeriodLabel = computed(() => timePeriods[selectedPeriod.value]);

// Görev Yönetimi
const searchQuery = ref('');
const sortKey = ref('start');
const sortOrder = ref('asc');
const selectedTask = ref(null);

const proactiveCard = ref(null);

// AI & Tahminler
const insightsDashboard = ref(null);
const productionPredictions = ref([]);
const selectedPrediction = ref(null);


const filteredTasks = computed(() => {
  let sortedTasks = [...tasks.value];

  if (sortKey.value) {
    sortedTasks.sort((a, b) => {
      let valA = a[sortKey.value];
      let valB = b[sortKey.value];
      if (sortKey.value === 'start' || sortKey.value === 'end') {
        valA = new Date(valA);
        valB = new Date(valB);
      }
      if (valA < valB) return sortOrder.value === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder.value === 'asc' ? 1 : -1;
      return 0;
    });
  }

  if (searchQuery.value) {
    return sortedTasks.filter(task => 
      task.taskName.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      task.unit.toLowerCase().includes(searchQuery.value.toLowerCase())
    );
  }
  return sortedTasks;
});

const calendarEvents = computed(() => {
  return tasks.value.map(task => ({
    id: task.id,
    title: task.taskName,
    start: task.start,
    end: task.end,
    backgroundColor: getStatusColor(task.status),
    borderColor: getStatusColor(task.status),
    extendedProps: task
  }));
});

// Lifecycle hooks
onMounted(async () => {
  await loadDashboardData();
  
  nextTick(() => {
    if (document.getElementById('taskDetailModal')) {
      taskDetailModal = new Modal(document.getElementById('taskDetailModal'));
    }
  });
  
  startProductionMonitoring();
});

onBeforeUnmount(() => {
  if (taskDetailModal) {
    taskDetailModal.dispose();
  }
  if (calendar.value) {
    calendar.value.destroy();
  }
  destroyCharts();
  stopProductionMonitoring();
});

watch(productionStatus, (newStatus) => {
  if (newStatus.alerts.length > 0) {
    const latestAlert = newStatus.alerts[newStatus.alerts.length - 1];
    if(latestAlert.type === 'error' || latestAlert.type === 'warning') {
       proactiveCard.value = {
        title: `Proaktif Uyarı: ${latestAlert.message}`,
        description: `Etkilenen Makine/Birim: ${latestAlert.machineId || 'N/A'}. Zaman: ${new Date(latestAlert.timestamp).toLocaleTimeString()}`,
        action: {
          label: 'Detayları İncele',
          handler: () => console.log('Proaktif kart aksiyonu tetiklendi', latestAlert)
        }
      };
    }
  }
}, { deep: true });


// Methods
async function loadDashboardData() {
  loading.value = true;
  try {
    const data = await getPlanningData();
    tasks.value = data.tasks || [];
    productionUnits.value = data.productionUnits || [];
    capacityLoad.value = data.capacityLoad || {};
    deliveryEstimates.value = data.deliveryEstimates || [];
    
    await nextTick();
    
    initializeCalendar();
    createCapacityChart();
    createDeliveryChart();

  } catch (error) {
    console.error("Planlama verileri yüklenirken hata:", error);
    toast.error("Kontrol paneli verileri yüklenemedi.");
  } finally {
    loading.value = false;
  }
}

function destroyCharts() {
  if (capacityChartInstance) {
    capacityChartInstance.destroy();
    capacityChartInstance = null;
  }
  if (deliveryChartInstance) {
    deliveryChartInstance.destroy();
    deliveryChartInstance = null;
  }
}

function initializeCalendar() {
  if (calendar.value) {
    calendar.value.destroy();
  }
  if (!calendarEl.value) return;

  calendar.value = new Calendar(calendarEl.value, {
    plugins: [dayGridPlugin, interactionPlugin],
    initialView: calendarView.value,
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridDay,dayGridWeek,dayGridMonth'
    },
    events: calendarEvents.value,
    editable: true,
    droppable: true,
    eventClick: (info) => {
      selectedTask.value = info.event.extendedProps;
      if (taskDetailModal) {
        taskDetailModal.show();
      }
    },
    dateClick: (info) => {
      console.log('Tarihe tıklandı:', info.dateStr);
    }
  });
  calendar.value.render();
}

function changeCalendarView(view) {
  calendarView.value = view;
  if (calendar.value) {
    calendar.value.changeView(view);
  }
}

function createCapacityChart() {
  if (!capacityChart.value) return;
  if (capacityChartInstance) {
    capacityChartInstance.destroy();
  }

  const ctx = capacityChart.value.getContext('2d');
  const unitsToDisplay = selectedUnit.value ? [selectedUnit.value] : productionUnits.value;
  
  const labels = unitsToDisplay.map(unit => unit.name);
  const capacityData = unitsToDisplay.map(unit => unit.capacity);
  const loadData = unitsToDisplay.map(unit => capacityLoad.value[unit.id] || 0);

  capacityChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Kapasite (saat)',
          data: capacityData,
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        },
        {
          label: 'Mevcut Yük (saat)',
          data: loadData,
          backgroundColor: 'rgba(255, 99, 132, 0.5)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

function createDeliveryChart() {
  if (!deliveryChart.value) return;
  if (deliveryChartInstance) {
    deliveryChartInstance.destroy();
  }

  const ctx = deliveryChart.value.getContext('2d');
  
  const period = parseInt(selectedPeriod.value.replace('d', ''));
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - period);

  const filteredEstimates = deliveryEstimates.value.filter(d => {
    const deliveryDate = new Date(d.estimatedDeliveryDate);
    return deliveryDate >= startDate && deliveryDate <= endDate;
  });

  const estimatesByDate = filteredEstimates.reduce((acc, curr) => {
    const date = new Date(curr.estimatedDeliveryDate).toLocaleDateString();
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {});

  const labels = Object.keys(estimatesByDate).sort((a, b) => new Date(a) - new Date(b));
  const data = labels.map(label => estimatesByDate[label]);

  deliveryChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Günlük Teslimat Sayısı',
        data: data,
        fill: false,
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    }
  });
}

function selectUnit(unit) {
  selectedUnit.value = unit;
  createCapacityChart();
}

function selectTimePeriod(period) {
  selectedPeriod.value = period;
  createDeliveryChart();
}

function sortBy(key) {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey.value = key;
    sortOrder.value = 'asc';
  }
}

function viewTaskDetail(task) {
  selectedTask.value = task;
  if (taskDetailModal) {
    taskDetailModal.show();
  }
}

function editTask() {
  if (selectedTask.value) {
    console.log('Düzenleme moduna geç:', selectedTask.value.id);
    toast.info(`${selectedTask.value.taskName} görevi için düzenleme modu açıldı.`);
    // Burada router ile düzenleme sayfasına yönlendirme yapılabilir.
    // router.push({ name: 'edit-task', params: { id: selectedTask.value.id } });
  }
}

function getStatusClass(status) {
  switch (status) {
    case 'Tamamlandı': return 'bg-success';
    case 'Devam Ediyor': return 'bg-primary';
    case 'Beklemede': return 'bg-secondary';
    case 'Gecikmiş': return 'bg-danger';
    default: return 'bg-light text-dark';
  }
}

function getProgressClass(progress) {
  if (progress < 30) return 'bg-danger';
  if (progress < 70) return 'bg-warning';
  return 'bg-success';
}

function getStatusColor(status) {
  switch (status) {
    case 'Tamamlandı': return '#198754'; // Yeşil
    case 'Devam Ediyor': return '#0d6efd'; // Mavi
    case 'Beklemede': return '#6c757d'; // Gri
    case 'Gecikmiş': return '#dc3545'; // Kırmızı
    default: return '#adb5bd';
  }
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return new Date(dateString).toLocaleDateString('tr-TR', options);
}

// AI ve Tahmin Fonksiyonları
function onInsightsLoaded(insights) {
  console.log('AI Insights Yüklendi:', insights);
  if (insights.predictions && insights.predictions.timeSeries) {
    productionPredictions.value = insights.predictions.timeSeries.map(p => ({
      id: p.date,
      title: `Tarih: ${p.date}`,
      value: `Tahmini Üretim: ${p.value.toFixed(2)} birim`,
      details: p.details,
      confidence: p.confidence,
    }));
  }
}

function showPredictionDetails(prediction) {
  selectedPrediction.value = prediction;
}

function closePredictionDetails() {
  selectedPrediction.value = null;
}

function applyPredictionToSchedule(prediction) {
  console.log('Tahmin plana uygulanıyor:', prediction);
  toast.success(`'${prediction.title}' tahmini plana başarıyla entegre edildi.`);
  closePredictionDetails();
}

function generateNewPrediction() {
  if (insightsDashboard.value) {
    insightsDashboard.value.generateNewInsights();
    toast.info('Yeni üretim tahminleri oluşturuluyor...');
  }
}

</script>

<style scoped>
.planning-module {
  padding: 1rem;
}

.card {
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
}

.calendar-container {
  min-height: 500px;
}

.calendar-container.loading {
  opacity: 0.6;
}

.chart-container {
  position: relative;
  width: 100%;
  height: 300px;
}

table th {
  cursor: pointer;
}

table th:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.task-details label {
  font-size: 0.85rem;
  color: #6c757d;
  margin-bottom: 0;
}

.task-details p {
  margin-bottom: 0.5rem;
}

.proactive-card {
  border-left: 6px solid #ffc107;
  background: #fffbe6;
  box-shadow: 0 2px 8px rgba(255,193,7,0.08);
  border-radius: 8px;
  padding: 14px 18px;
  margin-bottom: 12px;
  transition: box-shadow 0.2s, border-color 0.2s;
}
.proactive-card:focus, .proactive-card:hover {
  box-shadow: 0 4px 16px rgba(255,193,7,0.18);
  border-color: #fd7e14;
}

/* Responsive düzenlemeler */
@media (max-width: 768px) {
  .planning-module {
    padding: 0.5rem;
  }
  
  .card-header {
    flex-direction: column;
    align-items: flex-start !important;
  }
  
  .card-header .btn-group,
  .card-header .dropdown,
  .card-header .input-group {
    margin-top: 0.5rem;
    width: 100%;
  }
}
</style>