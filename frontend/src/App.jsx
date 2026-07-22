import { Routes, Route, Navigate } from 'react-router-dom'
import DashboardLayout from './layouts/DashboardLayout'
import Dashboard from './pages/Dashboard'
import SSRDocs from './pages/SSRDocs'
import Package from './pages/Package'
import Clients from './pages/Clients'
import ClientList from './pages/ClientList'
import Login from './pages/Login'
import RequireAuth from './components/RequireAuth'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <DashboardLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="ssr-docs" element={<SSRDocs />} />
        <Route path="package" element={<Package />} />
        <Route path="clients" element={<Clients />} />
        <Route path="client-list" element={<ClientList />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
