import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/store/auth';

// --- Layouts ---
import DefaultLayout from '@/layouts/DefaultLayout.vue';
import BlankLayout from '@/layouts/BlankLayout.vue';

// --- Parent Route Component (for nesting) ---
const RouteParent = { template: '<router-view />' };

// --- View Imports (Lazy Loading) ---
const LoginView = () => import('@/modules/auth/views/LoginView.vue');
const DashboardView = () => import('@/modules/dashboard/views/DashboardView.vue');
const NotFound = () => import('@/components/NotFound.vue');

// --- Module View Imports ---
const OrderListView = () => import('@/modules/orders/views/OrderListView.vue');
const OrderDetailView = () => import('@/modules/orders/views/OrderDetailView.vue');
const OrderCreationView = () => import('@/modules/orders/views/OrderCreationView.vue');

const ProductionPlanningView = () => import('@/modules/production/views/ProductionPlanningView.vue');
const ProductionMonitoringView = () => import('@/modules/production/views/ProductionMonitoringView.vue');
const ProductionOverview = () => import('@/modules/production/views/ProductionOverview.vue');

const StockView = () => import('@/modules/inventory/views/StockView.vue');
const MaterialsView = () => import('@/modules/inventory/views/MaterialsView.vue');
const InventoryDashboard = () => import('@/modules/inventory/views/InventoryDashboard.vue');

const SuppliersView = () => import('@/modules/purchasing/views/SuppliersView.vue');
const PurchasingView = () => import('@/modules/purchasing/views/PurchasingView.vue');

const ReportsView = () => import('@/modules/reports/views/ReportsView.vue');
const OrderReports = () => import('@/modules/reports/views/OrderReports.vue');
const ProductionReports = () => import('@/modules/reports/views/ProductionReports.vue');

const TechnicalView = () => import('@/modules/technical/views/TechnicalView.vue');
const SettingsView = () => import('@/modules/settings/views/SettingsView.vue');
const PlanningDashboard = () => import('@/modules/planning/views/PlanningDashboard.vue');


const routes = [
  {
    path: '/login',
    component: BlankLayout,
    children: [
      { path: '', name: 'Login', component: LoginView, meta: { requiresAuth: false } }
    ]
  },
  {
    path: '/',
    component: DefaultLayout,
    meta: { requiresAuth: true },
    children: [
      { path: '', name: 'Dashboard', component: DashboardView },
      
      // Orders
      { path: 'orders', name: 'OrderList', component: OrderListView },
      { path: 'orders/create', name: 'OrderCreate', component: OrderCreationView },
      { path: 'orders/:id', name: 'OrderDetail', component: OrderDetailView },

      // Production
      {
        path: 'production',
        component: RouteParent,
        children: [
          { path: '', name: 'ProductionOverview', component: ProductionOverview },
          { path: 'planning', name: 'ProductionPlanning', component: ProductionPlanningView },
          { path: 'monitoring', name: 'ProductionMonitoring', component: ProductionMonitoringView },
        ]
      },

      // Inventory
      {
        path: 'inventory',
        component: RouteParent,
        children: [
          { path: '', name: 'InventoryDashboard', component: InventoryDashboard },
          { path: 'stock', name: 'StockManagement', component: StockView },
          { path: 'materials', name: 'MaterialManagement', component: MaterialsView },
        ]
      },

      // Purchasing
      {
        path: 'purchasing',
        component: RouteParent,
        children: [
            { path: '', name: 'Purchasing', component: PurchasingView },
            { path: 'suppliers', name: 'Suppliers', component: SuppliersView },
        ]
      },

      // Reports
      {
        path: 'reports',
        component: RouteParent,
        children: [
          { path: '', name: 'Reports', component: ReportsView },
          { path: 'orders', name: 'OrderReports', component: OrderReports },
          { path: 'production', name: 'ProductionReports', component: ProductionReports },
        ]
      },

      // Other
      { path: 'planning', name: 'Planning', component: PlanningDashboard },
      { path: 'technical', name: 'Technical', component: TechnicalView },
      { path: 'settings', name: 'Settings', component: SettingsView },
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: NotFound,
    meta: { layout: 'blank', requiresAuth: false },
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition;
    }
    return { top: 0 };
  },
});

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();

  if (!authStore.sessionInitialized) { 
      await authStore.initialize(); 
  }
  
  const isAuthenticated = authStore.isAuthenticated;
  const requiresAuth = to.meta.requiresAuth !== false;

  if (requiresAuth && !isAuthenticated) {
    if (to.name !== 'Login') {
      next({ name: 'Login', query: { redirect: to.fullPath } });
    } else {
      next();
    }
  } else if (isAuthenticated && to.name === 'Login') {
    next({ name: 'Dashboard' });
  } else {
    next();
  }
});

router.onError((error) => {
  console.error('Vue Router Error:', error);
});

export default router;
