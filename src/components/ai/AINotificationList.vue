<template>
  <div class="ai-notification-list">
    <div v-for="(notif, idx) in notifications" :key="idx" :class="['ai-notification', notif.type]">
      <strong v-if="notif.type === 'alert'">AI Uyarı:</strong>
      <strong v-else>AI Öneri:</strong>
      <span>{{ notif.message }}</span>
      <button class="close-btn" @click="remove(idx)">&times;</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import eventBus from '@/utils/event-bus';

const notifications = ref([]);

function addNotification(type, message) {
  notifications.value.push({ type, message });
  // Otomatik kaybolma (5 sn)
  setTimeout(() => notifications.value.shift(), 5000);
}

function remove(idx) {
  notifications.value.splice(idx, 1);
}

function onAISuggestion(payload) {
  addNotification('suggestion', payload.message || 'AI önerisi');
}
function onAIAlert(payload) {
  addNotification('alert', payload.message || 'AI uyarısı');
}

onMounted(() => {
  eventBus.on(eventBus.Events.AI_SUGGESTION, onAISuggestion);
  eventBus.on(eventBus.Events.AI_ALERT, onAIAlert);
});
onUnmounted(() => {
  eventBus.off(eventBus.Events.AI_SUGGESTION, onAISuggestion);
  eventBus.off(eventBus.Events.AI_ALERT, onAIAlert);
});
</script>

<style scoped>
.ai-notification-list {
  position: fixed;
  top: 1.5rem;
  right: 1.5rem;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.ai-notification {
  background: #fff;
  border-left: 4px solid #007bff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  padding: 0.75rem 1.25rem;
  border-radius: 6px;
  min-width: 220px;
  font-size: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.ai-notification.alert {
  border-left-color: #e74c3c;
}
.close-btn {
  background: none;
  border: none;
  font-size: 1.2rem;
  color: #888;
  cursor: pointer;
  margin-left: auto;
}
</style>
