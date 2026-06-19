import { NavLink, useLocation } from 'react-router-dom'

const tools = [
  {
    path: '/ssr-docs',
    icon: 'ti-passport',
    label: 'SSR Docs',
    ready: true,
  },
  {
    path: '/invoice',
    icon: 'ti-file-invoice',
    label: 'Invoice',
    ready: false,
  },
  {
    path: '/fare-calc',
    icon: 'ti-calculator',
    label: 'Fare Calc',
    ready: false,
  },
  {
    path: '/customers',
    icon: 'ti-users',
    label: 'Customers',
    ready: false,
  },
]

export default function Sidebar({ isOpen = false, onClose, collapsed = false, onToggleCollapse }) {
  return (
    <aside className={`fixed inset-y-0 left-0 z-40 w-64 ${collapsed ? 'md:w-16' : 'md:w-52'} transform bg-white border-r border-gray-200 flex flex-col h-full transition-all duration-200 ease-in-out shadow-xl md:static md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>

      {onClose && (
        <button
          type="button"
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 md:hidden"
          onClick={onClose}
          aria-label="Close sidebar"
        >
          <i className="ti ti-x" aria-hidden="true" />
        </button>
      )}

      {/* Logo */}
      <div className="px-3 py-3 border-b border-gray-100 flex items-center gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
            <i className="ti ti-plane-tilt text-white" style={{ fontSize: 14 }} />
          </div>
          <div className={`${collapsed ? 'inline md:hidden' : 'block'}`}>
            <p className="text-sm font-semibold text-gray-900 leading-none">GalileoTools</p>
            <p className="text-xs text-gray-400 mt-0.5">Travel Office Suite</p>
          </div>
        </div>
        <div className="ml-auto hidden md:flex items-center gap-2">
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              title={collapsed ? 'Expand' : 'Collapse'}
            >
              <i className={`ti ${collapsed ? 'ti-chevron-right' : 'ti-chevron-left'}`} />
            </button>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 pt-3 pb-3">
        <p className="px-4 text-xs text-gray-400 uppercase tracking-widest mb-2">Tools</p>

        {tools.map((t) =>
          t.ready ? (
            <NavLink
              key={t.path}
              to={t.path}
              onClick={() => { if (onClose && window.innerWidth < 768) onClose() }}
              className={({ isActive }) =>
                'sidebar-item ' + (isActive ? 'active' : '')
              }
            >
              <i className={`ti ${t.icon}`} style={{ fontSize: 16 }} aria-hidden="true" />
              <span className={`${collapsed ? 'inline md:hidden' : 'inline'}`}>{t.label}</span>
            </NavLink>
          ) : (
            <div key={t.path} className="sidebar-item opacity-40 cursor-not-allowed select-none">
              <i className={`ti ${t.icon}`} style={{ fontSize: 16 }} aria-hidden="true" />
              <span className={`${collapsed ? 'inline md:hidden' : 'inline'}`}>{t.label}</span>
              <span className={`ml-auto text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded ${collapsed ? 'inline md:hidden' : ''}`}>
                Soon
              </span>
            </div>
          )
        )}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-brand-50 flex items-center justify-center">
            <i className="ti ti-building text-brand-600" style={{ fontSize: 12 }} aria-hidden="true" />
          </div>
          <span className={`${collapsed ? 'inline md:hidden' : 'text-xs text-gray-500'}`}>Your Agency</span>
        </div>
      </div>

    </aside>
  )
}
