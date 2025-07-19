import { ref, computed } from 'vue'; // computed eklendi
import { 
  queryDocuments, 
  getDocument, 
  // Gerekirse diğer firebase-service fonksiyonları eklenebilir
} from '@/services/firebase-service'; // firebase-service.js doğrudan kullanılıyor
import defaultLogger from '@/utils/logger'

/**
 * Dashboard veri servisi
 * Dashboard için gerekli verileri sağlar ve ERP entegrasyonu yapar
 * @returns {Object} Dashboard veri ve metodları
 */
export function useDashboardData() {
  const isLoading = ref(false);
  const error = ref(null);
  const dashboardData = ref({
    activeOrders: 0,
    ongoingProduction: 0,
    delayedOrders: 0,
    completedOrdersToday: 0, // Günlük tamamlanan siparişler
    criticalMaterialsCount: 0,
    productionEfficiency: 0, // Yüzde olarak
    upcomingDeadlines: [], // Yaklaşan teslimatlar
    delayedOrdersList: [],
    recentActivities: [],
    criticalMaterials: [], // criticalMaterials zaten vardı, sayısını ayrıca tutabiliriz
    alerts: [], // alerts zaten vardı
    // --- YENİ: Trend verileri eklendi ---
    ordersTrend: 0,
    productionTrend: 0,
    delayedTrend: 0,
    completedTrend: 0,
  });
  const isLoadingDelayed = ref(false);

  // Mock data for functions not yet fully migrated to Firebase
  const getOrderSummary = async () => {
    try {
      const ordersCollection = collection(db, 'orders');
      const q = query(ordersCollection); // Genel bir sorgu, tüm siparişleri almak için
      const querySnapshot = await getDocs(q);
      
      let totalOrders = 0;
      let pendingOrders = 0;
      let completedOrders = 0;
      let shippedOrders = 0;
      // Diğer olası durumlar için sayaçlar eklenebilir
      // Örneğin: let cancelledOrders = 0;

      querySnapshot.forEach((doc) => {
        totalOrders++;
        const orderData = doc.data();
        switch (orderData.status) {
          case 'pending':
          case 'Pending':
            pendingOrders++;
            break;
          case 'completed':
          case 'Completed':
            completedOrders++;
            break;
          case 'shipped':
          case 'Shipped':
            shippedOrders++;
            break;
          // case 'cancelled':
          // case 'Cancelled':
          //   cancelledOrders++;
          //   break;
          // Diğer durumlar buraya eklenebilir
        }
      });

      return {
        totalOrders,
        pendingOrders,
        completedOrders,
        shippedOrders,
        // cancelledOrders, 
        // Eklenen diğer durum sayıları
      };
    } catch (error) {
      console.error("Error fetching order summary from Firebase:", error);
      // Hata durumunda boş veya varsayılan bir özet döndür
      return {
        totalOrders: 0,
        pendingOrders: 0,
        completedOrders: 0,
        shippedOrders: 0,
        error: "Veri alınamadı",
      };
    }
  };

  // const getProductionSummary = async () => {
  //   // This is a mock implementation. Replace with actual Firebase logic if needed.
  //   defaultLogger.info('[useDashboardData] getProductionSummary called (mock implementation)');
  //   return { efficiency: 85, downtime: 5, unitsProduced: 500 };
  // };
  const getProductionSummary = async () => {
    isLoading.value = true;
    error.value = null;
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const completedOrdersToday = await queryDocuments('orders', {
        status: 'completed',
        completedAt: ['>=', todayStart.toISOString(), '<=', todayEnd.toISOString()]
      });

      const unitsProducedToday = completedOrdersToday.reduce((sum, order) => sum + (order.quantity || order.totalQuantity || 0), 0);

      let productionEfficiency = 85; // Default/placeholder
      let downtimeHoursToday = 2;    // Default/placeholder
      try {
        const metricsDoc = await getDocument('production_stats/current_day_metrics');
        if (metricsDoc) {
          productionEfficiency = metricsDoc.efficiency !== undefined ? metricsDoc.efficiency : productionEfficiency;
          downtimeHoursToday = metricsDoc.downtimeHours !== undefined ? metricsDoc.downtimeHours : downtimeHoursToday;
        }
      } catch (docError) {
        defaultLogger.warn('Could not fetch current_day_metrics from Firebase, using defaults.', docError);
      }
      
      return {
        unitsProduced: unitsProducedToday,
        efficiency: productionEfficiency,
        downtime: downtimeHoursToday, 
      };
    } catch (err) {
      defaultLogger.error('Error fetching production summary from Firebase:', err);
      error.value = 'Üretim özeti Firebase\'den yüklenirken bir hata oluştu.';
      return { unitsProduced: 0, efficiency: 0, downtime: 0 };
    } finally {
      isLoading.value = false;
    }
  };

  // const getRecentActivities = async () => {
  //   // This is a mock implementation. Replace with actual Firebase logic if needed.
  //   defaultLogger.info('[useDashboardData] getRecentActivities called (mock implementation)');
  //   return [{ id: 1, activity: 'Order #123 updated', timestamp: new Date() }];
  // };
  const getRecentActivities = async () => {
    isLoading.value = true;
    error.value = null;
    try {
      const activities = await queryDocuments(
        'activityLog',
        {}, 
        { field: 'timestamp', direction: 'desc' },
        5 
      );
      return activities.map(activity => ({
        ...activity,
        // id: activity.id, // Firebase doc ID is already activity.id
        // timestamp: activity.timestamp?.toDate ? activity.timestamp.toDate() : new Date(activity.timestamp) // Example conversion
      }));
    } catch (err) {
      defaultLogger.error('Error fetching recent activities from Firebase:', err);
      error.value = 'Son aktiviteler Firebase\'den yüklenirken bir hata oluştu.';
      return [];
    } finally {
      isLoading.value = false;
    }
  };

  // const getNotifications = async () => {
  //   // This is a mock implementation. Replace with actual Firebase logic if needed.
  //   defaultLogger.info('[useDashboardData] getNotifications called (mock implementation)');
  //   return [{ id: 1, message: 'Material X running low', type: 'warning' }];
  // };
  const getNotifications = async () => {
    isLoading.value = true;
    error.value = null;
    try {
      const notifications = await queryDocuments(
        'notifications',
        { isRead: false },
        { field: 'createdAt', direction: 'desc' },
        5
      );
      return notifications.map(notification => ({
        ...notification,
        // id: notification.id, // Firebase doc ID
        // timestamp: notification.createdAt?.toDate ? notification.createdAt.toDate() : new Date(notification.createdAt) // Example conversion
      }));
    } catch (err) {
      defaultLogger.error('Error fetching notifications from Firebase:', err);
      error.value = 'Bildirimler Firebase\'den yüklenirken bir hata oluştu.';
      return [];
    } finally {
      isLoading.value = false;
    }
  };

  // const getWeeklyOrdersData = async () => {
  //   // This is a mock implementation. Replace with actual Firebase logic if needed.
  //   defaultLogger.info('[useDashboardData] getWeeklyOrdersData called (mock implementation)');
  //   return { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], series: [[12, 19, 3, 5, 2]] };
  // };
  const getWeeklyOrdersData = async () => {
    isLoading.value = true;
    error.value = null;
    try {
      const today = new Date();
      const labels = [];
      const seriesData = [];
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const dayStartISO = date.toISOString();
        
        labels.push(dayNames[date.getDay()]);

        const nextDate = new Date(date);
        nextDate.setDate(date.getDate() + 1);
        const dayEndISO = nextDate.toISOString();

        const ordersOnDay = await queryDocuments('orders', {
          createdAt: ['>=', dayStartISO, '<', dayEndISO]
        });
        seriesData.push(ordersOnDay.length);
      }

      return {
        labels: labels,
        series: [seriesData]
      };

    } catch (err) {
      defaultLogger.error('Error fetching weekly orders data from Firebase:', err);
      error.value = 'Haftalık sipariş verileri Firebase\'den yüklenirken bir hata oluştu.';
      const defaultLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      // Ensure 7 labels for default data
      const last7DayNames = Array(7).fill(null).map((_, idx) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - idx));
          return dayNames[d.getDay()];
      });
      return { labels: last7DayNames, series: [[0, 0, 0, 0, 0, 0, 0]] };
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Dashboard ana verilerini getirir
   */
  const fetchDashboardData = async () => {
    isLoading.value = true;
    error.value = null;
    
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayStartISO = todayStart.toISOString();

      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      const todayEndISO = todayEnd.toISOString();
      
      const yesterdayStart = new Date();
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      yesterdayStart.setHours(0, 0, 0, 0);
      const yesterdayStartISO = yesterdayStart.toISOString();

      const yesterdayEnd = new Date();
      yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
      yesterdayEnd.setHours(23, 59, 59, 999);
      const yesterdayEndISO = yesterdayEnd.toISOString();

      const upcomingDeadlineDate = new Date();
      upcomingDeadlineDate.setDate(upcomingDeadlineDate.getDate() + 7);
      const upcomingDeadlineDateISO = upcomingDeadlineDate.toISOString();

      // --- Paralel Veri Çekme ---
      const [
        activeOrdersResult,
        delayedOrdersResult,
        completedOrdersTodayResult,
        completedOrdersYesterdayResult,
        allMaterialsResult,
        upcomingDeadlinesResult,
        productionStats
      ] = await Promise.all([
        queryDocuments('orders', { status: ['in_progress', 'pending', 'planned'] }),
        queryDocuments('orders', { status: ['!=', 'completed'], dueDate: ['<', new Date().toISOString()] }),
        queryDocuments('orders', { status: 'completed', completedAt: ['>=', todayStartISO, '<=', todayEndISO] }),
        queryDocuments('orders', { status: 'completed', completedAt: ['>=', yesterdayStartISO, '<=', yesterdayEndISO] }),
        queryDocuments('materials'),
        queryDocuments('orders', { status: ['!=', 'completed'], dueDate: ['<=', upcomingDeadlineDateISO, '>', new Date().toISOString()] }, { field: 'dueDate', direction: 'asc' }, 5),
        getDocument('production_stats/latest') // Üretim verimliliği için
      ]);

      // --- Dashboard Verilerini Güncelle ---
      dashboardData.value.activeOrders = activeOrdersResult.length;
      dashboardData.value.ongoingProduction = activeOrdersResult.filter(o => o.status === 'in_progress').length;
      dashboardData.value.delayedOrders = delayedOrdersResult.length;
      
      const completedTodayCount = completedOrdersTodayResult.length;
      const completedYesterdayCount = completedOrdersYesterdayResult.length;
      dashboardData.value.completedOrdersToday = completedTodayCount;

      // Tamamlanan siparişler için trend hesaplaması
      if (completedYesterdayCount > 0) {
        dashboardData.value.completedTrend = ((completedTodayCount - completedYesterdayCount) / completedYesterdayCount) * 100;
      } else if (completedTodayCount > 0) {
        dashboardData.value.completedTrend = 100; // Dün 0 ise ve bugün > 0 ise %100 artış
      } else {
        dashboardData.value.completedTrend = 0;
      }

      // Diğer anlık metrikler (aktif sipariş, üretim, geciken sipariş) için trend hesaplaması,
      // geçmiş verilerin anlık görüntülerini (snapshot) veya günlük ortalamaları gerektirir.
      // Bu, mevcut Firestore yapısıyla karmaşık olduğundan, bu özellik ileride daha gelişmiş
      // bir veri yapısıyla (örneğin günlük özetler koleksiyonu) eklenecektir.
      // Şimdilik bu metrikler için temsili statik trend verileri kullanılıyor.
      dashboardData.value.ordersTrend = 5.2; // Temsili veri
      dashboardData.value.productionTrend = -1.5; // Temsili veri
      dashboardData.value.delayedTrend = 8.0; // Temsili veri

      const criticalMaterials = allMaterialsResult.filter(m => m.quantity <= (m.minLevel || 0));
      dashboardData.value.criticalMaterialsCount = criticalMaterials.length;
      dashboardData.value.criticalMaterials = criticalMaterials.slice(0, 5);

      // Üretim verimliliği
      if (productionStats && productionStats.efficiency) {
        dashboardData.value.productionEfficiency = productionStats.efficiency;
      } else {
        dashboardData.value.productionEfficiency = 85; // Varsayılan değer
      }
      
      dashboardData.value.upcomingDeadlines = upcomingDeadlinesResult;

    } catch (err) {
      defaultLogger.error('Error fetching dashboard data from Firebase:', err);
      error.value = 'Dashboard verileri Firebase\'den yüklenirken bir hata oluştu.';
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Gecikmiş siparişler listesini getirir
   */
  const fetchDelayedOrders = async () => {
    isLoadingDelayed.value = true;
    error.value = null;
    try {
      const delayedOrdersResult = await queryDocuments('orders', { 
        status: ['!=', 'completed'], 
        dueDate: ['<', new Date().toISOString()] 
      }, { field: 'dueDate', direction: 'asc' });
      
      // Gecikme günlerini ve AI önerilerini eklemek için ek mantık gerekebilir.
      // Şimdilik sadece listeyi alıyoruz.
      dashboardData.value.delayedOrdersList = delayedOrdersResult.map(order => ({
        ...order,
        delayDays: Math.floor((new Date() - new Date(order.dueDate)) / (1000 * 60 * 60 * 24)),
        // aiSuggestion: 'Firebase\'den AI önerisi çekilmeli veya burada üretilmeli' // Bu kısım ayrıca ele alınmalı
      }));
      dashboardData.value.delayedOrders = delayedOrdersResult.length;

    } catch (err) {
      defaultLogger.error('Error fetching delayed orders from Firebase:', err);
      error.value = 'Gecikmiş sipariş listesi Firebase\'den yüklenirken bir hata oluştu.';
    } finally {
      isLoadingDelayed.value = false;
    }
  }
  
  // AI için genel üretim özeti (Firebase'den)
  const getProductionSummaryForAI = async () => {
    isLoading.value = true;
    error.value = null;
    try {
      const activeOrders = await queryDocuments('orders', { status: 'in_progress' });
      const totalActiveOrders = activeOrders.length;

      // Tamamlanmış görevler (örneğin son 7 gün)
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      const completedThisWeek = await queryDocuments('orders', { status: 'completed', completedAt: ['>=', lastWeek.toISOString()] });
      const totalCompletedThisWeek = completedThisWeek.length;
      
      // Genel verimlilik (Bu daha karmaşık bir hesaplama gerektirir, şimdilik örnek)
      // Örneğin, tamamlanan siparişlerin planlanan süreye oranı vs.
      // Veya üretim aşamalarındaki ortalama tamamlanma yüzdesi.
      // Şimdilik basit bir değer döndürelim.
      let overallProgress = 0;
      if (totalActiveOrders > 0) {
        const progressSum = activeOrders.reduce((sum, order) => sum + (order.progress || 0), 0);
        overallProgress = progressSum / totalActiveOrders;
      }


      // Gecikme nedenleri (Bu bilgi siparişlerde veya ayrı bir 'issues' koleksiyonunda olabilir)
      // const productionIssues = await queryDocuments('issues', { type: 'production_delay', status: 'open' });

      return {
        activeTasks: totalActiveOrders,
        completedTasksLastWeek: totalCompletedThisWeek,
        overallProgress: parseFloat(overallProgress.toFixed(2)), // Ortalama ilerleme
        // productionEfficiency: dashboardData.value.productionEfficiency, // Dashboard'dan alınabilir veya burada hesaplanabilir
        // delays: { // Bu veriler için ayrı sorgular ve mantık gerekir
        //   mechanical: 0, // Örnek
        //   electrical: 0, // Örnek
        // }
        // productionStatus: { // Bu veriler için üretim aşamalarından (productionStages) veri çekilmeli
        //   labels: ['Mekanik Montaj', 'Elektrik Montaj', 'Test'],
        //   completed: [0,0,0],
        //   inProgress: [0,0,0],
        // }
        // ... Diğer önemli üretim metrikleri ...
      };
    } catch (err) {
      defaultLogger.error('Error fetching production summary for AI from Firebase:', err);
      error.value = 'AI için üretim özeti Firebase\'den yüklenirken bir hata oluştu.';
      return null; // Hata durumunda null döndür
    } finally {
      isLoading.value = false;
    }
  };

  // ... getOrderSummary, getInventorySummary, getRecentActivities, getNotifications, getWeeklyOrdersData ...
  // Bu fonksiyonlar da benzer şekilde Firebase'den veri çekecek şekilde güncellenmelidir.
  // Şimdilik mock olarak bırakıyorum, talep üzerine Firebase'e bağlanabilirler.

  // Örnek: getInventorySummary'nin Firebase'e bağlanması (basitleştirilmiş)
  const getInventorySummary = async () => {
    isLoading.value = true;
    error.value = null;
    try {
      const allMaterials = await queryDocuments('materials');
      const lowStockItems = allMaterials.filter(m => m.quantity < (m.minStockLevel || 10) && m.quantity > (m.criticalStockLevel || 0) ).length; // minStockLevel ve criticalStockLevel alanları eklenmeli
      const criticalItems = allMaterials.filter(m => m.quantity <= (m.criticalStockLevel || 0)).length; // criticalStockLevel alanı eklenmeli
      // ... diğer hesaplamalar ...
      
      return {
        totalItems: allMaterials.length,
        lowStockItems,
        criticalItems,
        // ...
      };
    } catch (err) {
      defaultLogger.error('Error fetching inventory summary from Firebase:', err);
      error.value = 'Envanter özeti Firebase\'den yüklenirken bir hata oluştu.';
      return { totalItems: 0, lowStockItems: 0, criticalItems: 0 }; // Hata durumunda varsayılan değerler
    } finally {
      isLoading.value = false;
    }
  }


  return {
    isLoading,
    isLoadingDelayed,
    error,
    dashboardData,
    fetchDashboardData,
    fetchDelayedOrders,
    getOrderSummary, // Mock kalabilir veya Firebase'e bağlanabilir
    getInventorySummary, // Firebase'e bağlandı (basitleştirilmiş)
    getProductionSummary, // Mock kalabilir veya Firebase'e bağlanabilir
    getRecentActivities, // Mock kalabilir veya Firebase'e bağlanabilir
    getNotifications, // Mock kalabilir veya Firebase'e bağlanabilir
    getWeeklyOrdersData, // Mock kalabilir veya Firebase'e bağlanabilir
    getProductionSummaryForAI // Yeni eklendi ve Firebase'e bağlandı
  }
}