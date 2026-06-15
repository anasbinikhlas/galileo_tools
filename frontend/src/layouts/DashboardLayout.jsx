import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'

export default function DashboardLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </div>
    </div>
  )
}
