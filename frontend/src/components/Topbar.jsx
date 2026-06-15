export default function Topbar({ title, subtitle }) {
  return (
    <header className="h-12 shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-5">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-900">{title}</span>
        {subtitle && (
          <span className="text-xs text-gray-400 hidden sm:inline">{subtitle}</span>
        )}
      </div>
      <div className="flex items-center gap-3">
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
