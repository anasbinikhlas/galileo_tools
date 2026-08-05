import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'
import html2pdf from 'html2pdf.js'
import { InvoicePdfTemplate } from '../components/VoucherTemplates'

export default function Invoice({ defaultView = 'list' }) {
  const navigate = useNavigate()
  const location = useLocation()

  // Load saved clients for quick client auto-complete
  const [savedClients] = useState(() => {
    try {
      const stored = localStorage.getItem('galileo_clients')
      return stored ? JSON.parse(stored) : []
    } catch (e) {
      return []
    }
  })

  // Load saved invoices history
  const [savedInvoices, setSavedInvoices] = useState(() => {
    try {
      const stored = localStorage.getItem('galileo_invoices')
      return stored ? JSON.parse(stored) : []
    } catch (e) {
      return []
    }
  })

  // Determine active view from URL location or prop
  const isCreatePage = location.pathname.includes('/create-invoice')
  const activeView = isCreatePage ? 'editor' : (defaultView || 'list')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const [invoiceData, setInvoiceData] = useState({
    invoiceNo: `INV-${Date.now().toString().slice(-6)}`,
    invoiceDate: new Date().toISOString().slice(0, 10),
    dueDate: '',
    clientName: 'SYED ASIF RIZVI',
    phone: '0333-0317285',
    whatsapp: '0333-0317285',
    email: '',
    ticketPassengers: [
      { date: new Date().toISOString().slice(0, 10), invoiceNo: '13977', ticketNo: '176-5580-274-603', passengerName: 'SANNAN HASAN', sector: 'KHI-FRA 05/03/2026', classType: 'Y', amount: 221000 },
      { date: new Date().toISOString().slice(0, 10), invoiceNo: '13977', ticketNo: '176-5580-274-604', passengerName: 'SYED SALMAN ASIF RIZVI', sector: 'KHI-FRA 05/03/2026', classType: 'Y', amount: 221000 }
    ],
    items: [
      { description: '2 E-VISA PROCESSING', amount: 15000 },
      { description: '4 STICKER VISAS', amount: 80000 },
      { description: 'TRAVEL INSURANCE COVERAGE', amount: 7900 },
      { description: 'TURKEY E-VISA (23000 x 2)', amount: 46000 }
    ],
    subtotal: 590900,
    discount: '0',
    totalAmount: 590900,
    amountPaid: '0',
    balanceDue: 590900,
    status: 'UNPAID',
    paymentMethod: 'Bank Transfer',
    bankDetails: 'Meezan Bank - A/C 0102030405',
    remarks: 'Thank you for your business.',
    hideBreakup: false
  })

  useEffect(() => {
    try {
      localStorage.setItem('galileo_invoices', JSON.stringify(savedInvoices))
    } catch (e) {
      console.error('Failed to save invoices to localStorage', e)
    }
  }, [savedInvoices])

  // Reset entire Invoice Form
  const handleResetForm = () => {
    setInvoiceData({
      invoiceNo: `INV-${Date.now().toString().slice(-6)}`,
      invoiceDate: new Date().toISOString().slice(0, 10),
      dueDate: '',
      clientName: '',
      phone: '',
      whatsapp: '',
      email: '',
      ticketPassengers: [],
      items: [{ description: '', amount: 0 }],
      subtotal: 0,
      discount: '0',
      totalAmount: 0,
      amountPaid: '0',
      balanceDue: 0,
      status: 'UNPAID',
      paymentMethod: 'Bank Transfer',
      bankDetails: 'Meezan Bank - A/C 0102030405',
      remarks: 'Thank you for your business.',
      hideBreakup: false
    })
  }

  const handleCreateNewInvoice = () => {
    handleResetForm()
    navigate('/create-invoice')
    toast.success('Ready to create new invoice!')
  }

  const handleLoadInvoice = (inv) => {
    setInvoiceData({ ...inv })
    navigate('/create-invoice')
    toast.success(`Loaded Invoice: ${inv.invoiceNo}`)
  }

  // Recalculate Subtotal, Total, Balance & Status
  const recalculateFinancials = (updatedItems = [], updatedPass = [], updatedDiscount = 0, updatedPaid = 0, updatedVisas = [], updatedHotels = [], updatedTransports = []) => {
    const genSum = (updatedItems || []).reduce((sum, i) => sum + Number(i.amount || 0), 0)
    const tktSum = (updatedPass || []).reduce((sum, p) => sum + Number(p.amount || 0), 0)
    const visaSum = (updatedVisas || []).reduce((sum, v) => sum + Number(v.amount || 0), 0)
    const hotelSum = (updatedHotels || []).reduce((sum, h) => sum + Number(h.amount || 0), 0)
    const transSum = (updatedTransports || []).reduce((sum, t) => sum + Number(t.amount || 0), 0)

    const sub = genSum + tktSum + visaSum + hotelSum + transSum
    const disc = Number(updatedDiscount || 0)
    const net = Math.max(0, sub - disc)
    const paid = Number(updatedPaid || 0)
    const bal = Math.max(0, net - paid)
    const stat = bal <= 0 ? 'PAID' : (paid > 0 ? 'PARTIAL' : 'UNPAID')
    return { subtotal: sub, totalAmount: net, balanceDue: bal, status: stat }
  }

  const handleAddPassengerItem = () => {
    const updatedPass = [...(invoiceData.ticketPassengers || []), { date: invoiceData.invoiceDate, invoiceNo: invoiceData.invoiceNo, ticketNo: '', passengerName: 'PASSENGER NAME', sector: 'KHI-FRA', classType: 'Y', amount: 0 }]
    const math = recalculateFinancials(invoiceData.items, updatedPass, invoiceData.discount, invoiceData.amountPaid, invoiceData.visaPassengers, invoiceData.hotelItems, invoiceData.transportItems)
    setInvoiceData({ ...invoiceData, ticketPassengers: updatedPass, ...math })
  }

  const handleRemovePassengerItem = (index) => {
    const updatedPass = (invoiceData.ticketPassengers || []).filter((_, i) => i !== index)
    const math = recalculateFinancials(invoiceData.items, updatedPass, invoiceData.discount, invoiceData.amountPaid, invoiceData.visaPassengers, invoiceData.hotelItems, invoiceData.transportItems)
    setInvoiceData({ ...invoiceData, ticketPassengers: updatedPass, ...math })
  }

  const handleUpdatePassengerItem = (index, field, value) => {
    const updatedPass = (invoiceData.ticketPassengers || []).map((p, i) => i === index ? { ...p, [field]: value } : p)
    const math = recalculateFinancials(invoiceData.items, updatedPass, invoiceData.discount, invoiceData.amountPaid, invoiceData.visaPassengers, invoiceData.hotelItems, invoiceData.transportItems)
    setInvoiceData({ ...invoiceData, ticketPassengers: updatedPass, ...math })
  }

  const handleAddPaymentItem = () => {
    const existingPayments = invoiceData.payments || []
    const newPayment = {
      date: invoiceData.invoiceDate,
      voucherNo: `RV-${101 + existingPayments.length}`,
      description: 'PAYMENT RECEIVED',
      paymentMethod: invoiceData.paymentMethod || 'Bank Transfer',
      amount: 0
    }
    const updatedPayments = [...existingPayments, newPayment]
    const totalPaidSum = updatedPayments.reduce((sum, pm) => sum + Number(pm.amount || 0), 0)
    const math = recalculateFinancials(invoiceData.items, invoiceData.ticketPassengers || [], invoiceData.discount, totalPaidSum, invoiceData.visaPassengers, invoiceData.hotelItems, invoiceData.transportItems)
    setInvoiceData({ ...invoiceData, payments: updatedPayments, amountPaid: totalPaidSum, ...math })
  }

  const handleRemovePaymentItem = (index) => {
    const updatedPayments = (invoiceData.payments || []).filter((_, i) => i !== index)
    const totalPaidSum = updatedPayments.reduce((sum, pm) => sum + Number(pm.amount || 0), 0)
    const math = recalculateFinancials(invoiceData.items, invoiceData.ticketPassengers || [], invoiceData.discount, totalPaidSum, invoiceData.visaPassengers, invoiceData.hotelItems, invoiceData.transportItems)
    setInvoiceData({ ...invoiceData, payments: updatedPayments, amountPaid: totalPaidSum, ...math })
  }

  const handleUpdatePaymentItem = (index, field, value) => {
    const updatedPayments = (invoiceData.payments || []).map((pm, i) => i === idx ? { ...pm, [field]: value } : pm)
    const totalPaidSum = updatedPayments.reduce((sum, pm) => sum + Number(pm.amount || 0), 0)
    const math = recalculateFinancials(invoiceData.items, invoiceData.ticketPassengers || [], invoiceData.discount, totalPaidSum, invoiceData.visaPassengers, invoiceData.hotelItems, invoiceData.transportItems)
    setInvoiceData({ ...invoiceData, payments: updatedPayments, amountPaid: totalPaidSum, ...math })
  }

  // Load client from dropdown with Rate Conversion Multiplier
  const handleSelectClient = (clientId) => {
    if (!clientId) return
    const client = savedClients.find(c => c.id === clientId)
    if (client) {
      // Conversion Multiplier (Defaults to 1 if empty or 0)
      const rateMultiplier = Number(client.conversionRate || client.rateMultiplier || client.rate || 0) > 0 
        ? Number(client.conversionRate || client.rateMultiplier || client.rate) 
        : 1

      // 1. Build Passenger Ticket List from imported client
      const paxList = Array.isArray(client.passengerList) && client.passengerList.length > 0 
        ? client.passengerList 
        : (Array.isArray(client.passengers) && client.passengers.length > 0 ? client.passengers : [client.name || 'CLIENT'])

      let flightSector = 'KHI-JED-KHI'
      if (Array.isArray(client.ticketPassengers) && client.ticketPassengers.length > 0 && client.ticketPassengers[0].sector) {
        flightSector = client.ticketPassengers[0].sector
      } else if (Array.isArray(client.flightItinerary) && client.flightItinerary.length > 0) {
        const sectors = client.flightItinerary.map(f => typeof f === 'string' ? f : (f.sector || f.route)).filter(Boolean)
        if (sectors.length > 1) {
          const first = (sectors[0] || '').split('-').map(s => s.trim())
          const second = (sectors[1] || '').split('-').map(s => s.trim())
          if (first.length === 2 && second.length === 2 && first[1] === second[0]) {
            flightSector = `${first[0]}-${first[1]}-${second[1]}`
          } else {
            flightSector = sectors.join(' - ')
          }
        } else if (sectors.length === 1) {
          flightSector = sectors[0]
        }
      } else if (client.depFlight?.sector || client.retFlight?.sector) {
        const dep = (client.depFlight?.sector || '').split('-').map(s => s.trim())
        const ret = (client.retFlight?.sector || '').split('-').map(s => s.trim())
        if (dep.length === 2 && ret.length === 2 && dep[1] === ret[0]) {
          flightSector = `${dep[0]}-${dep[1]}-${ret[1]}`
        } else {
          flightSector = [client.depFlight?.sector, client.retFlight?.sector].filter(Boolean).join(' - ') || 'KHI-JED-KHI'
        }
      } else if (client.sector) {
        flightSector = client.sector
      }

      const totalTicketAmt = Number(client.pax?.ticket_total || 0)
      const perPaxPrice = totalTicketAmt > 0 && paxList.length > 0 ? Math.round(totalTicketAmt / paxList.length) : 0

      const importedTicketPassengers = paxList.map((p) => {
        const pName = typeof p === 'string' ? p : (p.name || p.passengerName || client.name)
        const pTicket = typeof p === 'object' && p !== null ? (p.ticket_no || p.ticketNo || '') : ''
        const pPort = typeof p === 'object' && p !== null ? (p.passport_no || p.passportNo || '') : ''

        return {
          date: client.date || client.header?.date || new Date().toISOString().slice(0, 10),
          invoiceNo: invoiceData.invoiceNo || 'INV-1001',
          ticketNo: pTicket,
          passportNo: pPort,
          passengerName: pName,
          sector: flightSector,
          classType: 'Y',
          amount: perPaxPrice
        }
      })

      // 2. Build Service Items from imported client (With currency rateMultiplier applied)
      let importedItems = []
      if (Array.isArray(client.items) && client.items.length > 0) {
        importedItems = client.items.map(i => ({
          ...i,
          amount: Number(i.amount || 0) * (i.amount < 10000 && rateMultiplier > 1 ? rateMultiplier : 1)
        }))
      } else if (Array.isArray(client.itemizedCharges) && client.itemizedCharges.length > 0) {
        importedItems = client.itemizedCharges.map(i => ({
          ...i,
          amount: Number(i.amount || 0) * rateMultiplier
        }))
      } else {
        if (client.visa?.price && Number(client.visa.price) > 0) {
          const vPrice = Number(client.visa.price) * (Number(client.visa.qty) || 1) * rateMultiplier
          importedItems.push({
            description: `${client.visa.qty || 1} X ${client.visa.type || 'UMRAH'} VISA`,
            amount: vPrice
          })
        }
        if (Array.isArray(client.makkahHotels)) {
          client.makkahHotels.forEach(h => {
            if (h.hotel_name && (h.night_price || h.price)) {
              const hPrice = Number(h.night_price || h.price || 0) * (Number(h.nights) || 1) * (Number(h.room_qty) || 1) * rateMultiplier
              importedItems.push({
                description: `${h.hotel_name} (${h.nights || 1} Nites - ${h.room_type || 'Room'})`,
                amount: hPrice
              })
            }
          })
        }
        if (Array.isArray(client.madinaHotels)) {
          client.madinaHotels.forEach(h => {
            if (h.hotel_name && (h.night_price || h.price)) {
              const hPrice = Number(h.night_price || h.price || 0) * (Number(h.nights) || 1) * (Number(h.room_qty) || 1) * rateMultiplier
              importedItems.push({
                description: `${h.hotel_name} (${h.nights || 1} Nites - ${h.room_type || 'Room'})`,
                amount: hPrice
              })
            }
          })
        }
        if (Array.isArray(client.transportRows)) {
          client.transportRows.forEach(t => {
            if (t.type && (t.price || t.amount)) {
              const tPrice = Number(t.price || t.amount || 0) * rateMultiplier
              importedItems.push({
                description: `${t.type} (${t.sector || 'Transport'})`,
                amount: tPrice
              })
            }
          })
        }
      }

      if (importedItems.length === 0) {
        importedItems = invoiceData.items && invoiceData.items.length > 0 ? invoiceData.items : [{ description: 'PACKAGE / SERVICE CHARGE', amount: 0 }]
      }

      // 3. Recalculate financials and update invoice state
      const math = recalculateFinancials(importedItems, importedTicketPassengers, invoiceData.discount, invoiceData.amountPaid)

      setInvoiceData(prev => ({
        ...prev,
        clientName: client.name || '',
        phone: client.phone || client.header?.phone || '',
        whatsapp: client.whatsapp || client.header?.whatsapp || '',
        email: client.email || client.header?.email || '',
        ticketPassengers: importedTicketPassengers,
        items: importedItems,
        conversionRate: rateMultiplier,
        ...math
      }))

      toast.success(`Imported client: ${client.name} (${importedTicketPassengers.length} pax, rate multiplier x${rateMultiplier})`)
    }
  }

  const handleAddItem = () => {
    const updatedItems = [...invoiceData.items, { description: 'EXTRA SERVICE / CHARGE', amount: 0 }]
    const math = recalculateFinancials(updatedItems, invoiceData.discount, invoiceData.amountPaid)
    setInvoiceData({ ...invoiceData, items: updatedItems, ...math })
  }

  const handleRemoveItem = (index) => {
    if (invoiceData.items.length <= 1) {
      toast.error('At least 1 item is required')
      return
    }
    const updatedItems = invoiceData.items.filter((_, i) => i !== index)
    const math = recalculateFinancials(updatedItems, invoiceData.discount, invoiceData.amountPaid)
    setInvoiceData({ ...invoiceData, items: updatedItems, ...math })
  }

  const handleUpdateItem = (index, field, value) => {
    const updatedItems = invoiceData.items.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: field === 'amount' ? value : value }
      }
      return item
    })
    const math = recalculateFinancials(updatedItems, invoiceData.discount, invoiceData.amountPaid)
    setInvoiceData({ ...invoiceData, items: updatedItems, ...math })
  }

  const isExistingInvoice = savedInvoices.some(
    inv => (invoiceData.id && inv.id === invoiceData.id) || (invoiceData.invoiceNo && inv.invoiceNo === invoiceData.invoiceNo)
  )

  const handleSaveInvoiceRecord = () => {
    if (!invoiceData.clientName.trim()) {
      toast.error('Please enter a Client Name before saving.')
      return
    }

    const existingIndex = savedInvoices.findIndex(
      inv => (invoiceData.id && inv.id === invoiceData.id) || (invoiceData.invoiceNo && inv.invoiceNo === invoiceData.invoiceNo)
    )

    if (existingIndex !== -1) {
      const updatedList = [...savedInvoices]
      const targetId = invoiceData.id || updatedList[existingIndex].id
      const updatedRecord = {
        ...updatedList[existingIndex],
        ...invoiceData,
        id: targetId,
        updatedAt: new Date().toISOString()
      }
      updatedList[existingIndex] = updatedRecord
      setSavedInvoices(updatedList)
      setInvoiceData(prev => ({ ...prev, id: targetId }))
      toast.success(`Invoice ${invoiceData.invoiceNo} record updated successfully!`)
    } else {
      const newId = invoiceData.id || `inv-${Date.now()}`
      const newRecord = {
        ...invoiceData,
        id: newId,
        createdAt: new Date().toISOString()
      }
      setInvoiceData(prev => ({ ...prev, id: newId }))
      setSavedInvoices(prev => [newRecord, ...prev])
      toast.success(`Invoice ${invoiceData.invoiceNo} record saved successfully!`)
    }
  }



  const handleDeleteInvoice = (id) => {
    setSavedInvoices(prev => prev.filter(i => i.id !== id))
    toast.success('Invoice deleted from history')
  }

  const downloadPdf = async (elementId, fileName) => {
    const element = document.getElementById(elementId) || document.getElementById('printable-invoice')
    if (!element) {
      toast.error('Invoice element not found')
      return
    }

    toast.loading('Generating & downloading Invoice PDF...', { id: 'inv-pdf' })

    const options = {
      margin: [3, 3, 3, 3],
      filename: fileName || `Invoice_${invoiceData.invoiceNo}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false, scrollX: 0, scrollY: 0, windowWidth: 1200 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }

    try {
      await html2pdf().set(options).from(element).save()
      toast.success('Invoice PDF downloaded successfully!', { id: 'inv-pdf' })
    } catch (err) {
      console.error('PDF generation error:', err)
toast.error('PDF download error, opening print window...', { id: 'inv-pdf' })
      window.print()
    }
  }

  const totalInvoicesCount = savedInvoices.length
  const totalBilledSum = savedInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount || inv.subtotal || 0), 0)
  const totalCollectedSum = savedInvoices.reduce((sum, inv) => sum + Number(inv.amountPaid || 0), 0)
  const totalOutstandingSum = savedInvoices.reduce((sum, inv) => sum + Number(inv.balanceDue || 0), 0)

  const filteredInvoices = savedInvoices.filter((inv) => {
    const matchesSearch = 
      (inv.invoiceNo || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.clientName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.phone || '').toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = 
      statusFilter === 'ALL' || inv.status === statusFilter

    return matchesSearch && matchesStatus
  })

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-50 text-gray-900 antialiased font-sans">
      <Toaster position="top-right" />
      <main className="flex-1 overflow-y-auto max-w-7xl w-full mx-auto p-3 sm:p-5 pb-16 space-y-5">
        
        {activeView === 'list' ? (
          /* ─────────────────────────────────────────────────────────────
             📋 VIEW 1: INVOICE MANAGEMENT DIRECTORY (LIST VIEW)
             ───────────────────────────────────────────────────────────── */
          <div className="space-y-6">
            {/* Page Header */}
            <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-800">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center font-bold text-purple-300">
                    <i className="ti ti-file-invoice text-xl" />
                  </div>
                  <div>
                    <h1 className="text-xl font-black uppercase tracking-wider text-white">Client Invoice & Payment Directory</h1>
                    <p className="text-xs text-slate-300">Manage customer invoices, track balance payments & print statements</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCreateNewInvoice}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-5 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer uppercase tracking-wider"
                >
                  <i className="ti ti-plus text-sm" /> + Create New Invoice
                </button>
              </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Invoices</span>
                  <span className="text-xl font-black text-slate-900 mt-0.5 block">{totalInvoicesCount}</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                  <i className="ti ti-files text-xl" />
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Total Billed Sales</span>
                  <span className="text-xl font-black text-blue-950 mt-0.5 block">{totalBilledSum.toLocaleString()} PKR</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                  <i className="ti ti-cash text-xl" />
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Total Payments Received</span>
                  <span className="text-xl font-black text-emerald-950 mt-0.5 block">{totalCollectedSum.toLocaleString()} PKR</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <i className="ti ti-circle-check text-xl" />
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-red-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider block">Total Outstanding Balance</span>
                  <span className="text-xl font-black text-red-950 mt-0.5 block">{totalOutstandingSum.toLocaleString()} PKR</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-red-50 text-red-700 flex items-center justify-center">
                  <i className="ti ti-clock-pause text-xl" />
                </div>
              </div>
            </div>

            {/* Search & Filter Toolbar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Search Input */}
              <div className="relative flex-1 max-w-md">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Invoice #, Client Name, or Phone..."
                  className="w-full border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
                <i className="ti ti-search absolute left-3 top-2.5 text-slate-400 text-sm" />
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                {['ALL', 'UNPAID', 'PARTIAL', 'PAID'].map((status) => (
                  <button
                    key={`st-filt-${status}`}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      statusFilter === status
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {status} ({status === 'ALL' ? savedInvoices.length : savedInvoices.filter(i => i.status === status).length})
                  </button>
                ))}
              </div>
            </div>

            {/* Invoices Directory Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="p-3">INVOICE #</th>
                      <th className="p-3">CLIENT NAME</th>
                      <th className="p-3">DATE</th>
                      <th className="p-3 text-right">TOTAL AMOUNT</th>
                      <th className="p-3 text-right">PAID (RECEIVED)</th>
                      <th className="p-3 text-right">BALANCE DUE</th>
                      <th className="p-3 text-center">STATUS</th>
                      <th className="p-3 text-center">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                    {filteredInvoices.length > 0 ? (
                      filteredInvoices.map((inv) => (
                        <tr key={`list-inv-${inv.id}`} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-black text-slate-900 font-sans">{inv.invoiceNo}</td>
                          <td className="p-3 font-bold text-slate-900 font-sans">
                            <span className="block font-extrabold text-slate-900">{inv.clientName}</span>
                            {inv.phone && <span className="text-[10px] text-slate-400 font-mono">{inv.phone}</span>}
                          </td>
                          <td className="p-3 text-slate-600">{inv.invoiceDate}</td>
                          <td className="p-3 text-right font-black text-slate-900">{Number(inv.totalAmount || inv.subtotal || 0).toLocaleString()} PKR</td>
                          <td className="p-3 text-right font-bold text-emerald-700">{Number(inv.amountPaid || 0).toLocaleString()} PKR</td>
                          <td className="p-3 text-right font-bold text-red-700">{Number(inv.balanceDue || 0).toLocaleString()} PKR</td>
                          <td className="p-3 text-center font-sans">
                            <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-black uppercase ${
                              inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                              inv.status === 'PARTIAL' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                              'bg-red-100 text-red-800 border border-red-300'
                            }`}>
                              {inv.status}
                            </span>
                          </td>
                          <td className="p-3 text-center font-sans">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleLoadInvoice(inv)}
                                className="bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <i className="ti ti-edit" /> View / Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  handleLoadInvoice(inv)
                                  setTimeout(() => window.print(), 300)
                                }}
                                className="bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <i className="ti ti-printer" /> Print
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteInvoice(inv.id)}
                                className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 px-2 py-1 rounded-lg text-xs font-bold cursor-pointer"
                                title="Delete Invoice"
                              >
                                <i className="ti ti-trash" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400 italic font-sans normal-case">
                          <div className="space-y-2">
                            <i className="ti ti-file-invoice text-3xl text-slate-300 block" />
                            <p className="text-xs font-bold text-slate-500">No generated invoices found.</p>
                            <button
                              type="button"
                              onClick={handleCreateNewInvoice}
                              className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm mt-2"
                            >
                              + Create Invoice
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* ─────────────────────────────────────────────────────────────
             ✍️ VIEW 2: INVOICE EDITOR & LIVE PRINTABLE PREVIEW
             ───────────────────────────────────────────────────────────── */
          <div className="space-y-5">
            {/* Page Header */}
            <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-800">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/invoices')}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <i className="ti ti-arrow-left text-sm" /> ← Back to Invoices List
                </button>
                <div>
                  <h1 className="text-lg font-black uppercase tracking-wider text-white">Manual Client Invoice & Payment Voucher</h1>
                  <p className="text-xs text-slate-300">Editing Invoice {invoiceData.invoiceNo} — Live Payment Tracking & PDF Preview</p>
                </div>
              </div>

              {/* Quick Actions & Invoice Selectors */}
              <div className="flex items-center gap-2 flex-wrap">
                {savedInvoices.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-slate-800 p-1.5 rounded-xl border border-amber-500/50 shadow-xs">
                    <span className="text-[10px] font-extrabold text-amber-400 uppercase px-1 flex items-center gap-1">
                      <i className="ti ti-file-invoice text-xs" /> Select Generated Invoice:
                    </span>
                    <select
                      value={invoiceData.id || ''}
                      onChange={(e) => {
                        if (!e.target.value) return
                        const selectedInv = savedInvoices.find(inv => inv.id === e.target.value || inv.invoiceNo === e.target.value)
                        if (selectedInv) handleLoadInvoice(selectedInv)
                      }}
                      className="bg-slate-900 text-white text-xs font-bold px-2.5 py-1 rounded-lg border border-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500 max-w-[240px] truncate cursor-pointer"
                    >
                      <option value="">-- Select Generated Invoice ({savedInvoices.length}) --</option>
                      {savedInvoices.map((inv) => (
                        <option key={`sel-inv-${inv.id}`} value={inv.id}>
                          {inv.invoiceNo} - {inv.clientName || 'CLIENT'} ({Number(inv.totalAmount || inv.subtotal || 0).toLocaleString()} PKR)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {savedClients.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-slate-800 p-1.5 rounded-xl border border-slate-700">
                    <span className="text-[10px] font-bold text-slate-400 uppercase px-1">Import Client:</span>
                    <select
                      onChange={(e) => handleSelectClient(e.target.value)}
                      className="bg-slate-900 text-slate-300 text-xs font-bold px-2 py-1 rounded-lg border border-slate-700 focus:outline-none max-w-[170px] truncate cursor-pointer"
                    >
                      <option value="">-- Select Raw Client --</option>
                      {savedClients.map((c) => (
                        <option key={`sel-${c.id}`} value={c.id}>
                          {c.name} ({c.sr_no || '01'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-red-400 hover:text-red-300 text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <i className="ti ti-rotate-2 text-sm" /> Reset Form
                </button>
                <button
                  type="button"
                  onClick={handleSaveInvoiceRecord}
                  className={`${
                    isExistingInvoice 
                      ? 'bg-amber-600 hover:bg-amber-700 text-white' 
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  } text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer`}
                >
                  <i className={isExistingInvoice ? "ti ti-refresh text-sm" : "ti ti-device-floppy text-sm"} />
                  {isExistingInvoice ? 'Update Record' : 'Save Record'}
                </button>
              </div>
            </div>

            {/* Main Grid: Left Controls & Right PDF Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Invoice Settings & Editable Controls */}
              <div className="lg:col-span-5 space-y-4">
                
                {/* Breakup Mode Selector */}
                <div className="bg-white p-4 rounded-xl border border-purple-200 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                      <i className="ti ti-layout-grid text-purple-600" /> Invoice Breakup Option
                    </span>
                    <span className="text-[10px] font-extrabold text-purple-700 bg-purple-50 px-2 py-0.5 rounded uppercase">
                      {invoiceData.hideBreakup ? 'Without Breakup (Summary)' : 'With Breakup (Itemized)'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setInvoiceData({ ...invoiceData, hideBreakup: false })}
                      className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all flex items-center justify-center gap-1.5 ${
                        !invoiceData.hideBreakup
                          ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <i className="ti ti-list text-sm" /> With Breakup
                    </button>
                    <button
                      type="button"
                      onClick={() => setInvoiceData({ ...invoiceData, hideBreakup: true })}
                      className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all flex items-center justify-center gap-1.5 ${
                        invoiceData.hideBreakup
                          ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <i className="ti ti-eye-off text-sm" /> Without Breakup
                    </button>
                  </div>
                </div>

                {/* Client & Basic Info Card */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3 text-xs">
                  <div className="font-bold text-slate-900 border-b border-slate-100 pb-2 uppercase tracking-wide flex items-center gap-1.5">
                    <i className="ti ti-user text-blue-600" /> Client & Invoice Info
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">INVOICE NO</label>
                      <input
                        type="text"
                        value={invoiceData.invoiceNo}
                        onChange={(e) => setInvoiceData({ ...invoiceData, invoiceNo: e.target.value })}
                        className="w-full border rounded px-2.5 py-1.5 font-bold font-mono text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">DATE</label>
                      <input
                        type="date"
                        value={invoiceData.invoiceDate}
                        onChange={(e) => setInvoiceData({ ...invoiceData, invoiceDate: e.target.value })}
                        className="w-full border rounded px-2.5 py-1.5 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">CLIENT NAME *</label>
                    <input
                      type="text"
                      value={invoiceData.clientName}
                      onChange={(e) => setInvoiceData({ ...invoiceData, clientName: e.target.value })}
                      className="w-full border rounded px-2.5 py-1.5 font-bold uppercase text-slate-900"
                      placeholder="CLIENT / COMPANY NAME"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">PHONE</label>
                      <input
                        type="text"
                        value={invoiceData.phone}
                        onChange={(e) => setInvoiceData({ ...invoiceData, phone: e.target.value })}
                        className="w-full border rounded px-2 py-1 font-mono text-[11px]"
                        placeholder="PHONE"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">WHATSAPP</label>
                      <input
                        type="text"
                        value={invoiceData.whatsapp}
                        onChange={(e) => setInvoiceData({ ...invoiceData, whatsapp: e.target.value })}
                        className="w-full border rounded px-2 py-1 font-mono text-[11px]"
                        placeholder="WHATSAPP"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">EMAIL</label>
                      <input
                        type="text"
                        value={invoiceData.email}
                        onChange={(e) => setInvoiceData({ ...invoiceData, email: e.target.value })}
                        className="w-full border rounded px-2 py-1 text-[11px]"
                        placeholder="EMAIL"
                      />
                    </div>
                  </div>
                </div>

                {/* Ticket Booking Passengers Controls */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-bold text-slate-900 uppercase flex items-center gap-1.5">
                      <i className="ti ti-ticket text-indigo-600" /> Ticket Booking Passengers ({(invoiceData.ticketPassengers || []).length})
                    </span>
                    <button
                      type="button"
                      onClick={handleAddPassengerItem}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      <i className="ti ti-plus" /> Add Passenger Leg
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                    {(invoiceData.ticketPassengers || []).map((pass, idx) => (
                      <div key={`inv-pass-${idx}`} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <input
                            type="text"
                            value={pass.passengerName}
                            onChange={(e) => handleUpdatePassengerItem(idx, 'passengerName', e.target.value)}
                            className="flex-1 border rounded px-2 py-1 font-black uppercase text-xs bg-white"
                            placeholder="PASSENGER NAME"
                          />
                          <input
                            type="number"
                            value={pass.amount}
                            onChange={(e) => handleUpdatePassengerItem(idx, 'amount', Number(e.target.value))}
                            className="w-28 border rounded px-2 py-1 text-right font-mono font-bold text-xs bg-white"
                            placeholder="Amount"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemovePassengerItem(idx)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <i className="ti ti-trash text-sm" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={pass.ticketNo}
                            onChange={(e) => handleUpdatePassengerItem(idx, 'ticketNo', e.target.value)}
                            className="w-full border rounded px-2 py-0.5 font-mono text-[10px] bg-white"
                            placeholder="TICKET NO (OPTIONAL)"
                          />
                          <input
                            type="text"
                            value={pass.sector}
                            onChange={(e) => handleUpdatePassengerItem(idx, 'sector', e.target.value)}
                            className="w-full border rounded px-2 py-0.5 font-mono text-[10px] bg-white"
                            placeholder="SECTOR (KHI-FRA 05/03)"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Itemized Services Controls */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-bold text-slate-900 uppercase flex items-center gap-1.5">
                      <i className="ti ti-list-check text-blue-600" /> Itemized Charges ({invoiceData.items.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="text-[11px] font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1"
                    >
                      <i className="ti ti-plus" /> Add Row
                    </button>
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {invoiceData.items.map((item, idx) => (
                      <div key={`inv-page-item-${idx}`} className="grid grid-cols-12 gap-1.5 items-center bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <div className="col-span-7">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleUpdateItem(idx, 'description', e.target.value)}
                            className="w-full border rounded px-2 py-1 text-xs font-semibold"
                            placeholder="Description"
                          />
                        </div>
                        <div className="col-span-4">
                          <input
                            type="number"
                            value={item.amount}
                            onChange={(e) => handleUpdateItem(idx, 'amount', Number(e.target.value))}
                            className="w-full border rounded px-2 py-1 text-xs font-bold text-right font-mono"
                            placeholder="Amount"
                          />
                        </div>
                        <div className="col-span-1 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-red-500 hover:text-red-700"
                            title="Remove row"
                          >
                            <i className="ti ti-trash" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Financial Adjustments Card */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3 text-xs">
                  <div className="font-bold text-slate-900 border-b border-slate-100 pb-2 uppercase tracking-wide flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <i className="ti ti-calculator text-blue-600" /> Payment & Balance Math
                    </span>
                    <button
                      type="button"
                      onClick={handleSaveInvoiceRecord}
                      className={`px-3 py-1 rounded-lg text-xs font-bold text-white shadow-xs transition-all flex items-center gap-1 cursor-pointer ${
                        isExistingInvoice ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
                      }`}
                    >
                      <i className={isExistingInvoice ? "ti ti-refresh text-xs" : "ti ti-device-floppy text-xs"} />
                      {isExistingInvoice ? 'Update Record' : 'Save Record'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">DISCOUNT AMOUNT</label>
                      <input
                        type="number"
                        value={invoiceData.discount}
                        onChange={(e) => {
                          const math = recalculateFinancials(invoiceData.items, invoiceData.ticketPassengers || [], e.target.value, invoiceData.amountPaid, invoiceData.visaPassengers, invoiceData.hotelItems, invoiceData.transportItems)
                          setInvoiceData({ ...invoiceData, discount: e.target.value, ...math })
                        }}
                        className="w-full border rounded px-2.5 py-1.5 font-bold text-right font-mono"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-blue-800 uppercase mb-1">AMOUNT RECEIVED (PAID)</label>
                      <input
                        type="number"
                        value={invoiceData.amountPaid}
                        onChange={(e) => {
                          const math = recalculateFinancials(invoiceData.items, invoiceData.ticketPassengers || [], invoiceData.discount, e.target.value, invoiceData.visaPassengers, invoiceData.hotelItems, invoiceData.transportItems)
                          setInvoiceData({ ...invoiceData, amountPaid: e.target.value, ...math })
                        }}
                        className="w-full border border-blue-300 rounded px-2.5 py-1.5 font-black text-right font-mono text-blue-900 bg-blue-50/50"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">PAYMENT METHOD</label>
                      <select
                        value={invoiceData.paymentMethod}
                        onChange={(e) => setInvoiceData({ ...invoiceData, paymentMethod: e.target.value })}
                        className="w-full border rounded px-2 py-1.5 text-xs font-bold text-slate-800 bg-white"
                      >
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Cash">Cash</option>
                        <option value="Online / Raast">Online / Raast</option>
                        <option value="Cheque">Cheque</option>
                        <option value="Card">Card Payment</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">DUE DATE</label>
                      <input
                        type="date"
                        value={invoiceData.dueDate}
                        onChange={(e) => setInvoiceData({ ...invoiceData, dueDate: e.target.value })}
                        className="w-full border rounded px-2 py-1 text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">BANK DETAILS / INFO</label>
                    <input
                      type="text"
                      value={invoiceData.bankDetails}
                      onChange={(e) => setInvoiceData({ ...invoiceData, bankDetails: e.target.value })}
                      className="w-full border rounded px-2 py-1 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">REMARKS / PAYMENT TERMS</label>
                    <input
                      type="text"
                      value={invoiceData.remarks}
                      onChange={(e) => setInvoiceData({ ...invoiceData, remarks: e.target.value })}
                      className="w-full border rounded px-2 py-1 text-xs"
                    />
                  </div>

                </div>

              </div>

              {/* Right Column: Live Printable PDF Preview & Action Buttons */}
              <div className="lg:col-span-7 space-y-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <i className="ti ti-printer text-purple-600 text-lg" />
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                        Live Invoice PDF Voucher Preview
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => downloadPdf('printable-invoice', `Invoice_${invoiceData.invoiceNo}.pdf`)}
                        className="px-3.5 py-1.5 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg flex items-center gap-1 transition-all shadow-xs cursor-pointer"
                      >
                        <i className="ti ti-download" /> Download PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="px-4 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg flex items-center gap-1 shadow-md transition-all cursor-pointer"
                      >
                        <i className="ti ti-printer" /> Print Invoice
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <InvoicePdfTemplate
                      invoiceNo={invoiceData.invoiceNo}
                      invoiceDate={invoiceData.invoiceDate}
                      dueDate={invoiceData.dueDate}
                      clientName={invoiceData.clientName}
                      phone={invoiceData.phone}
                      whatsapp={invoiceData.whatsapp}
                      email={invoiceData.email}
                      ticketPassengers={invoiceData.ticketPassengers || []}
                      visaPassengers={invoiceData.visaPassengers || []}
                      hotelItems={invoiceData.hotelItems || []}
                      transportItems={invoiceData.transportItems || []}
                      items={invoiceData.items}
                      subtotal={invoiceData.subtotal}
                      discount={Number(invoiceData.discount || 0)}
                      totalAmount={invoiceData.totalAmount}
                      amountPaid={Number(invoiceData.amountPaid || 0)}
                      balanceDue={invoiceData.balanceDue}
                      status={invoiceData.status}
                      paymentMethod={invoiceData.paymentMethod}
                      bankDetails={invoiceData.bankDetails}
                      remarks={invoiceData.remarks}
                      hideBreakup={invoiceData.hideBreakup || false}
                    />
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

      </main>
    </div>
  )
}
