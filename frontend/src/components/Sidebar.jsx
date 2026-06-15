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

export default function Sidebar() {
  return (
    <aside className="w-52 shrink-0 bg-white border-r border-gray-200 flex flex-col h-full">

      {/* Logo */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
            <i className="ti ti-plane-tilt text-white" style={{ fontSize: 14 }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 leading-none">GalileoTools</p>
            <p className="text-xs text-gray-400 mt-0.5">Travel Office Suite</p>
          </div>
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
              className={({ isActive }) =>
                'sidebar-item ' + (isActive ? 'active' : '')
              }
            >
              <i className={`ti ${t.icon}`} style={{ fontSize: 16 }} aria-hidden="true" />
              <span>{t.label}</span>
            </NavLink>
          ) : (
            <div key={t.path} className="sidebar-item opacity-40 cursor-not-allowed select-none">
              <i className={`ti ${t.icon}`} style={{ fontSize: 16 }} aria-hidden="true" />
              <span>{t.label}</span>
              <span className="ml-auto text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
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
          <span className="text-xs text-gray-500">Your Agency</span>
        </div>
      </div>

    </aside>
  )
}
