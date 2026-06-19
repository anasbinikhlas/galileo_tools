export default function Topbar({ title, subtitle, collapsed, onToggleCollapse, sidebarOpen, onToggleOpen }) {
  return (
    <header className="h-12 shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-5">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-900">{title}</span>
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
