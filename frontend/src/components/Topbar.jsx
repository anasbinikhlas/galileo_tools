export default function Topbar({ title, subtitle, collapsed, onToggleCollapse, sidebarOpen, onToggleOpen, onLogout, onToggleMobileSidebar }) {
  return (
    <header className="h-12 shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-5">
      <div className="flex items-center gap-2.5">
        {onToggleMobileSidebar && (
          <button
            type="button"
            onClick={onToggleMobileSidebar}
            className="md:hidden inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white p-1.5 text-gray-700 hover:bg-gray-50"
            title="Open sidebar"
          >
            <i className="ti ti-menu-2 text-base" aria-hidden="true" />
            <span className="sr-only">Open sidebar</span>
          </button>
        )}
        <span className="text-sm font-semibold text-gray-900">{title || 'GalileoTools'}</span>
        {subtitle && (
          <span className="text-xs text-gray-400 hidden sm:inline">{subtitle}</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {/* Manual show/hide sidebar (desktop) */}
        {typeof onToggleOpen === 'function' && (
          <button
            type="button"
            onClick={onToggleOpen}
            className="hidden md:inline-flex items-center gap-2 px-2 py-1 rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          >
            <i className={`ti ${sidebarOpen ? 'ti-eye-off' : 'ti-eye'}`} />
          </button>
        )}
        {/* Collapse toggle for desktop */}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden md:inline-flex items-center gap-2 px-2 py-1 rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <i className={`ti ${collapsed ? 'ti-chevron-right' : 'ti-chevron-left'}`} />
          </button>
        )}
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="hidden md:inline-flex items-center gap-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-sm text-red-700 hover:bg-red-100"
          >
            <i className="ti ti-logout" aria-hidden="true" />
            Logout
          </button>
        )}
        <span className="text-xs text-gray-400 hidden md:flex items-center gap-1">
          <i className="ti ti-world" style={{ fontSize: 13 }} aria-hidden="true" />
          tools.yourdomain.com
        </span>
        <div className="w-7 h-7 rounded-full bg-brand-50 flex items-center justify-center text-xs font-medium text-brand-800 select-none">
          AG
        </div>
      </div>
    </header>
  )
}
