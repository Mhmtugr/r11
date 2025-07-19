
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from './firebase-service';
import { orderService } from './order-service'; // Sipariş verilerini almak için

// Mock Production Data (üretim verileri için)
const mockProductionData = [
  { id: 'prod-01', orderId: 'order-101', machine: 'CNC-01', operator: 'Ali Veli', output: 98, defects: 2, startTime: new Date('2025-06-25T09:00:00'), endTime: new Date('2025-06-25T17:00:00'), status: 'completed' },
  { id: 'prod-02', orderId: 'order-102', machine: 'CNC-02', operator: 'Buse Çelik', output: 150, defects: 5, startTime: new Date('2025-06-25T10:00:00'), endTime: new Date('2025-06-25T18:00:00'), status: 'completed' },
  { id: 'prod-03', orderId: 'order-103', machine: 'CNC-01', operator: 'Ali Veli', output: 120, defects: 1, startTime: new Date('2025-06-26T09:00:00'), endTime: new Date('2025-06-26T15:00:00'), status: 'in-progress' },
  { id: 'prod-04', orderId: 'order-104', machine: 'Press-01', operator: 'Canan Yılmaz', output: 500, defects: 12, startTime: new Date('2025-06-26T08:00:00'), endTime: new Date('2025-06-26T16:00:00'), status: 'completed' },
];

export const reportService = {

  /**
   * Belirtilen tarih aralığına göre sipariş verilerini getirir ve özetler.
   * @param {Date} startDate Başlangıç tarihi
   * @param {Date} endDate Bitiş tarihi
   * @returns {Promise<object>} Rapor verilerini içeren bir nesne
   */
  async getOrderReports(startDate, endDate) {
    try {
      const allOrders = await orderService.getOrders(); // Tüm siparişleri al
      
      // Tarihe göre filtrele
      const filteredOrders = allOrders.filter(order => {
        const orderDate = new Date(order.orderDate);
        return orderDate >= startDate && orderDate <= endDate;
      });

      // Raporları hesapla
      const totalOrders = filteredOrders.length;
      const totalRevenue = filteredOrders.reduce((sum, order) => sum + order.totalAmount, 0);
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const statusCounts = filteredOrders.reduce((counts, order) => {
        counts[order.status] = (counts[order.status] || 0) + 1;
        return counts;
      }, {});

      return {
        totalOrders,
        totalRevenue,
        averageOrderValue,
        statusCounts,
        orders: filteredOrders, // Detaylı liste için
        summary: `Rapor ${startDate.toLocaleDateString()} ve ${endDate.toLocaleDateString()} arasını kapsamaktadır. Toplam ${totalOrders} sipariş bulundu.`
      };
    } catch (error) {
      console.error("Sipariş raporları alınırken hata:", error);
      throw error;
    }
  },

  /**
   * Belirtilen tarih aralığına göre üretim verilerini getirir ve özetler.
   * @param {Date} startDate Başlangıç tarihi
   * @param {Date} endDate Bitiş tarihi
   * @returns {Promise<object>} Rapor verilerini içeren bir nesne
   */
  async getProductionReports(startDate, endDate) {
    // Gerçek bir uygulamada bu veriler Firestore veya başka bir DB'den gelir.
    // Şimdilik mock data kullanıyoruz.
    const filteredData = mockProductionData.filter(prod => {
        const prodDate = new Date(prod.startTime);
        return prodDate >= startDate && prodDate <= endDate;
    });

    const totalOutput = filteredData.reduce((sum, p) => sum + p.output, 0);
    const totalDefects = filteredData.reduce((sum, p) => sum + p.defects, 0);
    const defectRate = totalOutput > 0 ? (totalDefects / (totalOutput + totalDefects)) * 100 : 0;

    // OEE (Overall Equipment Effectiveness) basitleştirilmiş hesaplama
    // OEE = Kullanılabilirlik * Performans * Kalite
    const totalTime = filteredData.reduce((sum, p) => (p.endTime - p.startTime) / (1000 * 60 * 60), 0); // saat
    const plannedProductionTime = filteredData.length * 8; // 8 saatlik vardiya varsayımı
    const availability = plannedProductionTime > 0 ? (totalTime / plannedProductionTime) : 0;
    const performance = 1; // Şimdilik basitleştirildi
    const quality = totalOutput > 0 ? (totalOutput - totalDefects) / totalOutput : 0;
    const oee = availability * performance * quality * 100;

    return {
        totalOutput,
        totalDefects,
        defectRate,
        oee,
        machinePerformance: this.calculateMachinePerformance(filteredData),
        operatorPerformance: this.calculateOperatorPerformance(filteredData),
        productionData: filteredData,
        summary: `Rapor ${startDate.toLocaleDateString()} ve ${endDate.toLocaleDateString()} arasını kapsamaktadır. Toplam ${totalOutput} adet üretim yapıldı.`
    };
  },

  calculateMachinePerformance(data) {
      const performance = {};
      data.forEach(p => {
          if (!performance[p.machine]) {
              performance[p.machine] = { output: 0, defects: 0, count: 0 };
          }
          performance[p.machine].output += p.output;
          performance[p.machine].defects += p.defects;
          performance[p.machine].count += 1;
      });
      return Object.entries(performance).map(([name, data]) => ({ 
          name, 
          ...data, 
          defectRate: (data.output > 0 ? (data.defects / data.output) * 100 : 0).toFixed(2) + '%'
      }));
  },

  calculateOperatorPerformance(data) {
      const performance = {};
      data.forEach(p => {
          if (!performance[p.operator]) {
              performance[p.operator] = { output: 0, defects: 0, count: 0 };
          }
          performance[p.operator].output += p.output;
          performance[p.operator].defects += p.defects;
          performance[p.operator].count += 1;
      });
      return Object.entries(performance).map(([name, data]) => ({ 
          name, 
          ...data, 
          defectRate: (data.output > 0 ? (data.defects / data.output) * 100 : 0).toFixed(2) + '%'
      }));
  }
};
