import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import Dashboard from './pages/Dashboard'
import Ledger from './pages/Ledger'
import Analytics from './pages/Analytics'
import Report from './pages/Report'
import Attendance from './pages/Attendance'
import AttendancePortal from './pages/AttendancePortal'
import KinerjaLive from './pages/KinerjaLive'
import Inventory from './pages/Inventory'
import { useFinanceStore } from './store/useFinanceStore'

function App() {
  const fetchWebhookOrders = useFinanceStore(state => state.fetchWebhookOrders)

  useEffect(() => {
    fetchWebhookOrders()
    
    // Poll every 10 seconds for real-time updates
    const interval = setInterval(() => {
      fetchWebhookOrders()
    }, 10000)

    return () => clearInterval(interval)
  }, [fetchWebhookOrders])

  return (
    <HashRouter>
      <Routes>
        <Route path="/attendance-portal" element={<AttendancePortal />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="ledger" element={<Ledger />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="report" element={<Report />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="performance" element={<KinerjaLive />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
