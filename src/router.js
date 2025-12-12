import { createRouter, createWebHistory } from 'vue-router'
import StockDashboard from './components/StockDashboard.vue'

const routes = [
    { path: '/', redirect: '/NVDA' },
    { path: '/:symbol', name: 'Dashboard', component: StockDashboard }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

export default router
