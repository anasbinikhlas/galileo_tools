import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'
import html2pdf from 'html2pdf.js'
import { ColorPdfTemplate, StandardPdfTemplate } from '../components/VoucherTemplates'

export default function ClientList() {
  const navigate = useNavigate()

  const [savedClients, setSavedClients] = useState(() => {
    try {
      const stored = localStorage.getItem('galileo_clients')
      return stored ? JSON.parse(stored) : []
    } catch (e) {
      return []
    }
  })

  const [filterStatus, setFilterStatus] = useState('All') // 'All' | 'In Process' | 'Complete'
  const [searchTerm, setSearchTerm] = useState('')
  const [showPrintModal, setShowPrintModal] = useState(false) // false | 'standard' | 'color'
  const [selectedClient, setSelectedClient] = useState(null)

  useEffect(() => {
    try {
      localStorage.setItem('galileo_clients', JSON.stringify(savedClients))
    } catch (e) {
      console.error('Failed to sync client list to localStorage', e)
    }
  }, [savedClients])

  const handleToggleStatus = (id) => {
    setSavedClients(prev => prev.map(c => {
      if (c.id === id) {
        const nextStatus = (c.status === 'Complete' || c.status === 'Completed') ? 'In Process' : 'Complete'
        toast.success(`Client status updated to ${nextStatus}`, { id: `status-${id}` })
        return { ...c, status: nextStatus, updatedAt: new Date().toISOString() }
      }
      return c
    }))
  }

  const handleDeleteClient = (id, name) => {
    if (window.confirm(`Are you sure you want to delete client record "${name}"?`)) {
      setSavedClients(prev => prev.filter(c => c.id !== id))
      toast.success(`Deleted client: ${name}`)
    }
  }

  const handleEditClient = (id) => {
    navigate(`/clients?edit=${id}`)
  }

  const handleOpenPrint = (client, type) => {
    setSelectedClient(client)
    setShowPrintModal(type) // 'standard' or 'color'
  }

  const handleSavePdf = async () => {
    const elementId = showPrintModal === 'color' ? 'printable-color-package' : 'printable-package'
    const element = document.getElementById(elementId) || document.getElementById('printable-color-package')
    if (!element) return

    const clientName = selectedClient?.name || 'Client'
    const fileName = `client-${clientName.toLowerCase().replace(/\s+/g, '-')}-package.pdf`

    const options = {
      margin: 5,
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }

    try {
      const worker = html2pdf().from(element).set(options)
      const pdfBlob = await worker.output('blob')
      const blob = new Blob([pdfBlob], { type: 'application/pdf' })
      const blobUrl = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = blobUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 3000)
    } catch (err) {
      console.error('PDF generation error:', err)
      window.print()
    }
  }

  const filteredClients = savedClients.filter(c => {
    const isClientComplete = c.status === 'Complete' || c.status === 'Completed'
    const isClientInProcess = c.status === 'In Process' || c.status === 'Pending' || !c.status
    
    let matchesFilter = true
    if (filterStatus === 'In Process') matchesFilter = isClientInProcess
    if (filterStatus === 'Complete') matchesFilter = isClientComplete

    const matchesSearch = !searchTerm || 
      (c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.sr_no && c.sr_no.includes(searchTerm)) ||
      (c.depFlight?.sector && c.depFlight.sector.toLowerCase().includes(searchTerm.toLowerCase()))
    return matchesFilter && matchesSearch
  })

  // Calculate stats
  const totalCount = savedClients.length
  const inProcessCount = savedClients.filter(c => c.status === 'In Process' || c.status === 'Pending' || !c.status).length
  const completeCount = savedClients.filter(c => c.status === 'Complete' || c.status === 'Completed').length

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-50 text-gray-900 antialiased font-sans">
      <Toaster position="top-right" />
      <main className="flex-1 overflow-y-auto max-w-6xl w-full mx-auto p-4 sm:p-5 pb-16 space-y-4">

        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div>
            <h1 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <i className="ti ti-list-details text-blue-600 text-lg" />
              Saved Client Packages List
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              View all saved travel itineraries & packages, update statuses, or export vouchers to Standard / Color PDF.
            </p>
          </div>
          <button
            onClick={() => navigate('/clients')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition-all self-start sm:self-auto"
          >
            <i className="ti ti-plus" /> New Client Package
          </button>
        </div>

        {/* Stats & Search Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">TOTAL CLIENTS</span>
              <span className="text-lg font-black text-gray-900">{totalCount}</span>
            </div>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <i className="ti ti-users text-base" />
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-amber-500 uppercase tracking-wider block">IN PROCESS</span>
              <span className="text-lg font-black text-amber-600">{inProcessCount}</span>
            </div>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <i className="ti ti-clock text-base" />
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-emerald-500 uppercase tracking-wider block">COMPLETE</span>
              <span className="text-lg font-black text-emerald-600">{completeCount}</span>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <i className="ti ti-circle-check text-base" />
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex items-center">
            <div className="relative w-full">
              <i className="ti ti-search absolute left-2.5 top-2.5 text-gray-400 text-xs" />
              <input
                type="text"
                placeholder="Search name, SR#, sector..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Main Table Container */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-4">
          
          {/* Status Tabs */}
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Client Records Directory ({filteredClients.length})
            </h3>
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
              {['All', 'In Process', 'Complete'].map(status => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`text-xs font-semibold px-3 py-1 rounded-md transition-all ${filterStatus === status ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          {filteredClients.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl space-y-2">
              <i className="ti ti-users text-4xl text-gray-300 block" />
              <p className="text-sm font-semibold text-gray-600">No client package records found</p>
              <p className="text-xs text-gray-400">Click below to add a new client itinerary or package</p>
              <button
                onClick={() => navigate('/clients')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2 rounded-lg transition-all shadow-sm mt-2"
              >
                <i className="ti ti-plus mr-1" /> Add Client Package
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                  <tr>
                    <th className="p-3">SR #</th>
                    <th className="p-3">CLIENT NAME</th>
                    <th className="p-3">DATE</th>
                    <th className="p-3">PAX (ADT/CH/INF)</th>
                    <th className="p-3">DEP SECTOR</th>
                    <th className="p-3">PACKAGE TOTAL</th>
                    <th className="p-3 text-center">STATUS</th>
                    <th className="p-3 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredClients.map((client) => {
                    const isComplete = client.status === 'Complete' || client.status === 'Completed'
                    const displayStatus = isComplete ? 'Complete' : 'In Process'

                    return (
                      <tr key={client.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="p-3 font-mono text-gray-500 font-bold">{client.sr_no || '01'}</td>
                        <td className="p-3 font-bold text-gray-900 uppercase">{client.name}</td>
                        <td className="p-3 text-gray-600">{client.date}</td>
                        <td className="p-3 font-medium text-gray-700">
                          {client.pax?.adt || 0} ADT / {client.pax?.child || 0} CH / {client.pax?.infant || 0} INF
                        </td>
                        <td className="p-3 text-gray-800 font-semibold">
                          {client.depFlight?.sector || '—'}
                        </td>
                        <td className="p-3 font-bold text-emerald-700">
                          {client.totals?.package_with_ticket || client.totals?.package_only || '—'}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleToggleStatus(client.id)}
                            title="Click to toggle status"
                            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border transition-all ${
                              isComplete
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                            }`}
                          >
                            <i className={`ti ${isComplete ? 'ti-circle-check' : 'ti-clock'}`} />
                            {displayStatus}
                          </button>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenPrint(client, 'standard')}
                              title="Standard Print / PDF"
                              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs transition-all"
                            >
                              <i className="ti ti-printer" />
                            </button>
                            <button
                              onClick={() => handleOpenPrint(client, 'color')}
                              title="Color PDF Voucher"
                              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-semibold transition-all"
                            >
                              <i className="ti ti-palette" />
                            </button>
                            <button
                              onClick={() => handleEditClient(client.id)}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded text-xs font-bold transition-all shadow-xs"
                            >
                              Edit / Add Package
                            </button>
                            <button
                              onClick={() => handleDeleteClient(client.id, client.name)}
                              className="bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1 rounded text-xs transition-all"
                            >
                              <i className="ti ti-trash" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

        </div>

      </main>

      {/* PRINT / PDF PREVIEW MODAL */}
      {showPrintModal && selectedClient && (
        <div 
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-start justify-center p-3 sm:p-6 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPrintModal(false)
          }}
        >
          <div className="bg-white rounded-2xl max-w-4xl w-full p-4 sm:p-6 space-y-4 shadow-2xl my-4 sm:my-8 relative">
            
            {/* Action Header */}
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <i className={showPrintModal === 'color' ? "ti ti-palette text-blue-600 text-lg" : "ti ti-printer text-indigo-600 text-lg"} />
                  Client Voucher ({showPrintModal === 'color' ? 'Color PDF' : 'Standard Quotation Sheet'})
                </h3>
                <p className="text-xs text-gray-500">Client: {selectedClient.name} | Status: {selectedClient.status}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSavePdf}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md transition-all"
                >
                  <i className="ti ti-download text-sm" /> Save PDF Directly
                </button>
                <button
                  onClick={() => window.print()}
                  className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <i className="ti ti-printer text-sm" /> Print
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-3.5 py-2 rounded-xl transition-all"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Template Display */}
            {showPrintModal === 'color' ? (
              <ColorPdfTemplate 
                header={{ sr_no: selectedClient.sr_no, name: selectedClient.name, date: selectedClient.date }}
                pax={selectedClient.pax || {}}
                totalPax={(Number(selectedClient.pax?.adt || 0) + Number(selectedClient.pax?.child || 0) + Number(selectedClient.pax?.infant || 0))}
                depFlight={selectedClient.depFlight || {}}
                arrFlight={selectedClient.arrFlight || {}}
                visa={selectedClient.visa || {}}
                makkahHotels={selectedClient.makkahHotels || []}
                madinaHotels={selectedClient.madinaHotels || []}
                transport={selectedClient.transport || {}}
                totals={selectedClient.totals || {}}
                comments={selectedClient.comments || ''}
              />
            ) : (
              <StandardPdfTemplate 
                header={{ sr_no: selectedClient.sr_no, name: selectedClient.name, date: selectedClient.date }}
                pax={selectedClient.pax || {}}
                totalPax={(Number(selectedClient.pax?.adt || 0) + Number(selectedClient.pax?.child || 0) + Number(selectedClient.pax?.infant || 0))}
                depFlight={selectedClient.depFlight || {}}
                arrFlight={selectedClient.arrFlight || {}}
                visa={selectedClient.visa || {}}
                makkahHotels={selectedClient.makkahHotels || []}
                madinaHotels={selectedClient.madinaHotels || []}
                transport={selectedClient.transport || {}}
                totals={selectedClient.totals || {}}
                comments={selectedClient.comments || ''}
              />
            )}

          </div>
        </div>
      )}

    </div>
  )
}
