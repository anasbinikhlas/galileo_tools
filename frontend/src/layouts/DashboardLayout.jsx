import { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import { logout } from '../auth'
import { useInactivityLogout } from '../hooks/useInactivityLogout'

export default function DashboardLayout() {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar-collapsed') === '1' } catch (e) { return false }
  })

  // 1-Hour Inactivity Auto Logout
  useInactivityLogout()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  // Automatic behavior: show sidebar on large screens, hide on small
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setSidebarOpen(true)
      } else {
        setSidebarOpen(false)
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    try { localStorage.setItem('sidebar-collapsed', collapsed ? '1' : '0') } catch (e) {}
  }, [collapsed])

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar
        isOpen={sidebarOpen}
        collapsed={collapsed}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={() => setCollapsed(c => !c)}
        onLogout={handleLogout}
      />
      {sidebarOpen && window.innerWidth < 768 && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      )}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar
          title="GalileoTools"
          subtitle="Travel Office Suite"
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(c => !c)}
          sidebarOpen={sidebarOpen}
          onToggleOpen={() => setSidebarOpen(s => !s)}
          onToggleMobileSidebar={() => setSidebarOpen(true)}
          onLogout={handleLogout}
        />

        <Outlet />
      </div>
    </div>
  )
}
