<template>
  <div class="inventory-dashboard">
    <header class="dashboard-header">
      <h1>Envanter Genel Bakış</h1>
      <p class="text-muted">Envanter modülüne ait özet bilgiler ve hızlı erişim bağlantıları.</p>
    </header>

    <div class="row">
      <div class="col-md-6 col-lg-4 mb-4">
        <div class="card summary-card">
          <div class="card-body">
            <h5 class="card-title">Stok Durumu</h5>
            <p class="card-text">Toplam stok adedi, kritik seviyedeki ürünler ve stok değeri gibi temel metrikler.</p>
            <router-link to="/inventory/stock" class="btn btn-primary">Stok Yönetimine Git</router-link>
          </div>
        </div>
      </div>
      <div class="col-md-6 col-lg-4 mb-4">
        <div class="card summary-card">
          <div class="card-body">
            <h5 class="card-title">Malzeme Yönetimi</h5>
            <p class="card-text">Tanımlı malzeme sayısı, en çok kullanılan malzemeler ve yeni malzeme ekleme.</p>
            <router-link to="/inventory/materials" class="btn btn-primary">Malzemeleri Yönet</router-link>
          </div>
        </div>
      </div>
      <div class="col-md-6 col-lg-4 mb-4">
        <div class="card summary-card">
          <div class="card-body">
            <h5 class="card-title">Envanter Listeleri</h5>
            <p class="card-text">Özelleştirilmiş malzeme listeleri, sayım listeleri ve envanter raporları.</p>
            <router-link to="/inventory/list" class="btn btn-primary">Listeleri Görüntüle</router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// Bu sayfa, gelecekte envanterle ilgili daha fazla istatistik ve bileşen içerebilir.
// Örneğin, useInventorySummary() gibi bir composable ile veri çekilebilir.
</script>

<style scoped>
.inventory-dashboard {
  padding: 2rem;
}

.dashboard-header {
  margin-bottom: 2rem;
}

.summary-card .card-body {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
}

.summary-card .card-text {
  flex-grow: 1;
  margin-bottom: 1.5rem;
}
</style>
