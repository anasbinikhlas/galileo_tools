import { useNavigate } from 'react-router-dom'
import Topbar from '../components/Topbar'

const tools = [
  {
    path: '/ssr-docs',
    icon: 'ti-passport',
    color: 'bg-blue-50 text-blue-700',
    label: 'SSR Docs',
    desc: 'Format passport data into Galileo SSR DOCS entry',
    ready: true,
  },
  {
    icon: 'ti-file-invoice',
    color: 'bg-gray-50 text-gray-400',
    label: 'Invoice Generator',
    desc: 'Create printable ticket invoices with PDF export',
    ready: false,
  },
  {
    icon: 'ti-calculator',
    color: 'bg-gray-50 text-gray-400',
    label: 'Fare Calculator',
    desc: 'Base fare + taxes + markup = selling price',
    ready: false,
  },
  {
    icon: 'ti-users',
    color: 'bg-gray-50 text-gray-400',
    label: 'Customers',
    desc: 'Save and search passenger passport records',
    ready: false,
  },
]

export default function Dashboard() {
  const navigate = useNavigate()

  return (
    <>
      <Topbar title="Dashboard" subtitle="— GalileoTools" />
      <main className="flex-1 overflow-y-auto p-5">
        <div className="mb-6">
          <h1 className="text-base font-semibold text-gray-900">Welcome to GalileoTools</h1>
          <p className="text-sm text-gray-500 mt-1">
            Travel office tools for Travelport Galileo agents
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {tools.map((t, i) => (
            <div
              key={i}
              onClick={() => t.ready && navigate(t.path)}
              className={`card flex items-start gap-3 transition-all
                ${t.ready
                  ? 'hover:border-brand-300 hover:shadow-sm cursor-pointer'
                  : 'opacity-50 cursor-not-allowed select-none'
                }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${t.color}`}>
                <i className={`ti ${t.icon}`} style={{ fontSize: 18 }} aria-hidden="true" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900">{t.label}</p>
                  {!t.ready && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                      Coming soon
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{t.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  )
}
