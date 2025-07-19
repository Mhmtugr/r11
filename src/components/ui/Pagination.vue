<template>
  <nav aria-label="Page navigation" v-if="totalPages > 1">
    <ul class="pagination justify-content-center">
      <li class="page-item" :class="{ disabled: currentPage === 1 }">
        <a class="page-link" href="#" @click.prevent="changePage(currentPage - 1)" aria-label="Previous">
          <span aria-hidden="true">&laquo;</span>
        </a>
      </li>
      <li
        v-for="page in pages"
        :key="page"
        class="page-item"
        :class="{ active: page === currentPage }"
      >
        <a class="page-link" href="#" @click.prevent="changePage(page)">{{ page }}</a>
      </li>
      <li class="page-item" :class="{ disabled: currentPage === totalPages }">
        <a class="page-link" href="#" @click.prevent="changePage(currentPage + 1)" aria-label="Next">
          <span aria-hidden="true">&raquo;</span>
        </a>
      </li>
    </ul>
  </nav>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  currentPage: {
    type: Number,
    required: true,
  },
  totalPages: {
    type: Number,
    required: true,
  },
  maxVisibleButtons: {
    type: Number,
    default: 5,
  },
});

const emit = defineEmits(['page-changed']);

const pages = computed(() => {
  const range = [];
  const { currentPage, totalPages, maxVisibleButtons } = props;

  if (totalPages <= maxVisibleButtons) {
    for (let i = 1; i <= totalPages; i++) {
      range.push(i);
    }
    return range;
  }

  const half = Math.floor(maxVisibleButtons / 2);
  let start = currentPage - half;
  let end = currentPage + half;

  if (start <= 0) {
    start = 1;
    end = maxVisibleButtons;
  }

  if (end > totalPages) {
    end = totalPages;
    start = totalPages - maxVisibleButtons + 1;
  }

  for (let i = start; i <= end; i++) {
    range.push(i);
  }

  return range;
});

function changePage(page) {
  if (page > 0 && page <= props.totalPages && page !== props.currentPage) {
    emit('page-changed', page);
  }
}
</script>

<style scoped>
.pagination {
  margin-top: 1rem;
}
</style>
