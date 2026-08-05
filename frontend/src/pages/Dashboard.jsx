import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const gdsTools = [
  {
    path: '/ssr-docs',
    icon: 'ti-id-badge-2',
    color: 'bg-blue-500/10 text-blue-600 border border-blue-200/60',
    label: 'SSR Docs',
    desc: 'Format passport data into GDS SSR DOCS entries with AI live scan and clipboard paste',
    ready: true,
  },
  {
    path: '/package',
    icon: 'ti-package',
    color: 'bg-indigo-500/10 text-indigo-600 border border-indigo-200/60',
    label: 'Package Generator',
    desc: 'Scan paper sheets with AI or construct Umrah package proposals manually',
    ready: true,
  },
  {
    path: '/invoice',
    icon: 'ti-file-invoice',
    color: 'bg-purple-500/10 text-purple-600 border border-purple-200/60',
    label: 'Invoice Generator',
    desc: 'Create printable ticket & package invoices with custom PDF export options',
    ready: true,
  },
  {
    path: '/dummy-bookings',
    icon: 'ti-ticket',
    color: 'bg-emerald-500/10 text-emerald-600 border border-emerald-200/60',
    label: 'Dummy Bookings',
    desc: 'Generate ViewTrip & Travelport style flight & hotel dummy reservation documents',
    ready: true,
  },
  {
    path: '/fare-calc',
    icon: 'ti-calculator',
    color: 'bg-slate-100 text-slate-400 border border-slate-200',
    label: 'Fare Calculator',
    desc: 'Base fare + taxes + markup = final selling price calculator',
    ready: false,
  },
]

// ── SVG ROUND GRAPH CARD COMPONENT ──
function RoundGraphCard({ title, count, total, percentage, strokeColor, trackColor, badgeBg, badgeText, badgeBorder, icon, iconBg, iconColor, desc, onClick }) {
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (circumference * Math.min(Math.max(percentage, 0), 100)) / 100

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-lg transition-all duration-300 cursor-pointer group flex flex-col justify-between relative overflow-hidden"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center shrink-0 shadow-xs transition-transform group-hover:scale-110`}>
            <i className={`ti ${icon} text-lg ${iconColor}`} />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 group-hover:text-indigo-600 transition-colors">
              {title}
            </h3>
            <p className="text-[11px] text-slate-400 font-medium">{desc}</p>
          </div>
        </div>
        <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${badgeBorder} ${badgeBg} ${badgeText}`}>
          {Math.round(percentage)}%
        </span>
      </div>

      {/* Main Stat & Round Donut Graph */}
      <div className="flex items-center justify-between my-4 px-1">
        <div>
          <div className="text-3xl font-black text-slate-900 tracking-tight flex items-baseline gap-1.5 group-hover:scale-105 transition-transform origin-left">
            <span>{count}</span>
            <span className="text-xs font-semibold text-slate-400">/ {total} total</span>
          </div>
          <p className="text-xs font-bold text-slate-500 mt-1 flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${iconBg}`} />
            {title === 'Total Clients' ? 'Active Records' : title === 'Completed' ? 'Vouchers Finalized' : 'Processing Required'}
          </p>
        </div>

        {/* SVG Round Donut Graph */}
        <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 96 96">
            {/* Background Circle Track */}
            <circle
              cx="48"
              cy="48"
              r={radius}
              className={trackColor}
              strokeWidth="10"
              fill="transparent"
            />
            {/* Animated Progress Circle Arc */}
            <circle
              cx="48"
              cy="48"
              r={radius}
              className={`${strokeColor} transition-all duration-1000 ease-out`}
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>
          {/* Inner Content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xs font-black text-slate-900">{Math.round(percentage)}%</span>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Ratio</span>
          </div>
        </div>
      </div>

      {/* Bottom Action Footer */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600 group-hover:text-indigo-600 transition-colors">
        <span className="flex items-center gap-1.5">
          <span>View records</span>
          <i className="ti ti-arrow-right text-xs transition-transform group-hover:translate-x-1" />
        </span>
        <i className="ti ti-chevron-right text-xs opacity-40" />
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()

  // Read live client records from localStorage
  const [clients] = useState(() => {
    try {
      const stored = localStorage.getItem('galileo_clients')
      return stored ? JSON.parse(stored) : []
    } catch (e) {
      return []
    }
  })

  // Calculate live counts
  const totalCount = clients.length
  const completedCount = clients.filter(c => c.status === 'Complete' || c.status === 'Completed').length
  const pendingCount = totalCount > 0 ? (totalCount - completedCount) : 0

  // Display values (using fallback numbers if total is 0 to showcase design)
  const displayTotal = totalCount > 0 ? totalCount : 12
  const displayCompleted = totalCount > 0 ? completedCount : 8
  const displayPending = totalCount > 0 ? pendingCount : 4
  const isDemoData = totalCount === 0

  const completedPct = (displayCompleted / displayTotal) * 100
  const pendingPct = (displayPending / displayTotal) * 100
  const totalPct = 100

  return (
    <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                Travel Office Suite
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Welcome to Travel Agents Suite</h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl leading-relaxed">
              Professional management and GDS automation suite for travel agents and Umrah operators.
            </p>
          </div>
        </div>
      </div>

      {/* ── CLIENT SYSTEM STATS & ROUND GRAPHS ── */}
      <div className="bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200/60 pb-3.5 gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <i className="ti ti-chart-donut text-lg" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                Client Status Analytics
              </h2>
              <p className="text-xs text-slate-500">Live operational round graphs for total, completed, and pending records</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isDemoData && (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                Demo Preview Data
              </span>
            )}
            <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live System Overview
            </span>
          </div>
        </div>

        {/* ── 3 ROUND GRAPH CARDS ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Total Clients */}
          <RoundGraphCard
            title="Total Clients"
            desc="Registered Accounts"
            count={displayTotal}
            total={displayTotal}
            percentage={totalPct}
            strokeColor="stroke-indigo-600"
            trackColor="stroke-indigo-100"
            icon="ti-users-group"
            iconBg="bg-indigo-500/10"
            iconColor="text-indigo-600"
            badgeBg="bg-indigo-50"
            badgeText="text-indigo-700"
            badgeBorder="border-indigo-200"
            onClick={() => navigate('/client-list')}
          />

          {/* Card 2: Complete */}
          <RoundGraphCard
            title="Completed"
            desc="Finalized & Issued"
            count={displayCompleted}
            total={displayTotal}
            percentage={completedPct}
            strokeColor="stroke-emerald-500"
            trackColor="stroke-emerald-100"
            icon="ti-circle-check-filled"
            iconBg="bg-emerald-500/10"
            iconColor="text-emerald-600"
            badgeBg="bg-emerald-50"
            badgeText="text-emerald-700"
            badgeBorder="border-emerald-200"
            onClick={() => navigate('/client-list')}
          />

          {/* Card 3: Pending */}
          <RoundGraphCard
            title="Pending"
            desc="In Process / Active"
            count={displayPending}
            total={displayTotal}
            percentage={pendingPct}
            strokeColor="stroke-amber-500"
            trackColor="stroke-amber-100"
            icon="ti-clock-hour-4"
            iconBg="bg-amber-500/10"
            iconColor="text-amber-600"
            badgeBg="bg-amber-50"
            badgeText="text-amber-700"
            badgeBorder="border-amber-200"
            onClick={() => navigate('/client-list')}
          />
        </div>

        {/* Quick Operations Bar */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-500 font-medium">
            <i className="ti ti-bolt text-indigo-500" />
            <span>Quick Actions:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => navigate('/clients')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors"
            >
              <i className="ti ti-user-plus" />
              <span>+ Create New Client</span>
            </button>
            <button
              onClick={() => navigate('/client-list')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg font-bold text-xs shadow-xs transition-colors"
            >
              <i className="ti ti-list-details text-slate-500" />
              <span>Clients List Directory</span>
            </button>
            <button
              onClick={() => navigate('/contacts')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg font-bold text-xs shadow-xs transition-colors"
            >
              <i className="ti ti-address-book text-slate-500" />
              <span>Contacts Directory</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── GDS & TICKETING SUITE ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <i className="ti ti-plane-departure text-indigo-600 text-base" />
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Ticketing & GDS Tools</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
          {gdsTools.map((t, i) => (
            <div
              key={i}
              onClick={() => t.ready && navigate(t.path)}
              className={`bg-white rounded-xl p-4 border transition-all duration-200 flex flex-col justify-between ${
                t.ready
                  ? 'border-slate-200 hover:border-indigo-300 hover:shadow-md cursor-pointer group'
                  : 'border-slate-100 opacity-50 cursor-not-allowed select-none bg-slate-50/50'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${t.color}`}>
                    <i className={`ti ${t.icon} text-lg`} aria-hidden="true" />
                  </div>
                  {!t.ready && (
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-semibold">
                      Soon
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                    {t.label}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{t.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

