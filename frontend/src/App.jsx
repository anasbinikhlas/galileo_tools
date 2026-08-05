import { Routes, Route, Navigate } from 'react-router-dom'
import DashboardLayout from './layouts/DashboardLayout'
import Dashboard from './pages/Dashboard'
import SSRDocs from './pages/SSRDocs'
import Package from './pages/Package'
import Clients from './pages/Clients'
import ClientList from './pages/ClientList'
import ClientContacts from './pages/ClientContacts'
import Invoice from './pages/Invoice'
import DummyBookings from './pages/DummyBookings'
import CompanyDetails from './pages/CompanyDetails'
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
        <Route path="contacts" element={<ClientContacts />} />
        <Route path="invoices" element={<Invoice defaultView="list" />} />
        <Route path="create-invoice" element={<Invoice defaultView="editor" />} />
        <Route path="invoice" element={<Navigate to="/invoices" replace />} />
        <Route path="dummy-bookings" element={<DummyBookings />} />
        <Route path="company-details" element={<CompanyDetails />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
