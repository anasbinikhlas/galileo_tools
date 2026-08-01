import React, { useState, useEffect } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import html2pdf from 'html2pdf.js'
import { InvoicePdfTemplate } from '../components/VoucherTemplates'

export default function Invoice() {
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

  // Recalculate Subtotal, Total, Balance & Status
  const recalculateFinancials = (updatedItems, updatedPass, updatedDiscount, updatedPaid) => {
    const genSum = updatedItems.reduce((sum, i) => sum + Number(i.amount || 0), 0)
    const tktSum = updatedPass.reduce((sum, p) => sum + Number(p.amount || 0), 0)
    const sub = genSum + tktSum
    const disc = Number(updatedDiscount || 0)
    const net = Math.max(0, sub - disc)
    const paid = Number(updatedPaid || 0)
    const bal = Math.max(0, net - paid)
    const stat = bal <= 0 ? 'PAID' : (paid > 0 ? 'PARTIAL' : 'UNPAID')
    return { subtotal: sub, totalAmount: net, balanceDue: bal, status: stat }
  }

  const handleAddPassengerItem = () => {
    const updatedPass = [...(invoiceData.ticketPassengers || []), { date: invoiceData.invoiceDate, invoiceNo: invoiceData.invoiceNo, ticketNo: '', passengerName: 'PASSENGER NAME', sector: 'KHI-FRA', classType: 'Y', amount: 0 }]
    const math = recalculateFinancials(invoiceData.items, updatedPass, invoiceData.discount, invoiceData.amountPaid)
    setInvoiceData({ ...invoiceData, ticketPassengers: updatedPass, ...math })
  }

  const handleRemovePassengerItem = (index) => {
    const updatedPass = (invoiceData.ticketPassengers || []).filter((_, i) => i !== index)
    const math = recalculateFinancials(invoiceData.items, updatedPass, invoiceData.discount, invoiceData.amountPaid)
    setInvoiceData({ ...invoiceData, ticketPassengers: updatedPass, ...math })
  }

  const handleUpdatePassengerItem = (index, field, value) => {
    const updatedPass = (invoiceData.ticketPassengers || []).map((p, i) => i === index ? { ...p, [field]: value } : p)
    const math = recalculateFinancials(invoiceData.items, updatedPass, invoiceData.discount, invoiceData.amountPaid)
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
    const math = recalculateFinancials(invoiceData.items, invoiceData.ticketPassengers || [], invoiceData.discount, totalPaidSum)
    setInvoiceData({ ...invoiceData, payments: updatedPayments, amountPaid: totalPaidSum, ...math })
  }

  const handleRemovePaymentItem = (index) => {
    const updatedPayments = (invoiceData.payments || []).filter((_, i) => i !== index)
    const totalPaidSum = updatedPayments.reduce((sum, pm) => sum + Number(pm.amount || 0), 0)
    const math = recalculateFinancials(invoiceData.items, invoiceData.ticketPassengers || [], invoiceData.discount, totalPaidSum)
    setInvoiceData({ ...invoiceData, payments: updatedPayments, amountPaid: totalPaidSum, ...math })
  }

  const handleUpdatePaymentItem = (index, field, value) => {
    const updatedPayments = (invoiceData.payments || []).map((pm, i) => i === index ? { ...pm, [field]: value } : pm)
    const totalPaidSum = updatedPayments.reduce((sum, pm) => sum + Number(pm.amount || 0), 0)
    const math = recalculateFinancials(invoiceData.items, invoiceData.ticketPassengers || [], invoiceData.discount, totalPaidSum)
    setInvoiceData({ ...invoiceData, payments: updatedPayments, amountPaid: totalPaidSum, ...math })
  }

  // Load client from dropdown
  const handleSelectClient = (clientId) => {
    if (!clientId) return
    const client = savedClients.find(c => c.id === clientId)
    if (client) {
      setInvoiceData(prev => ({
        ...prev,
        clientName: client.name || '',
        phone: client.phone || client.header?.phone || '',
        whatsapp: client.whatsapp || client.header?.whatsapp || '',
        email: client.email || client.header?.email || ''
      }))
      toast.success(`Client details pre-filled for: ${client.name}`)
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

  const handleSaveInvoiceRecord = () => {
    if (!invoiceData.clientName.trim()) {
      toast.error('Please enter a Client Name before saving.')
      return
    }

    const record = {
      id: `inv-${Date.now()}`,
      ...invoiceData,
      createdAt: new Date().toISOString()
    }

    setSavedInvoices(prev => [record, ...prev])
    toast.success(`Invoice ${invoiceData.invoiceNo} saved successfully!`)
  }

  const handleLoadInvoice = (inv) => {
    setInvoiceData({ ...inv })
    toast.success(`Loaded Invoice: ${inv.invoiceNo}`)
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

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-50 text-gray-900 antialiased font-sans">
      <Toaster position="top-right" />
      <main className="flex-1 overflow-y-auto max-w-7xl w-full mx-auto p-3 sm:p-5 pb-16 space-y-5">
        
        {/* Page Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-400/30 flex items-center justify-center font-bold text-purple-300">
                <i className="ti ti-file-invoice text-lg" />
              </div>
              <div>
                <h1 className="text-lg font-black uppercase tracking-wider text-white">Manual Client Invoice & Payment Voucher</h1>
                <p className="text-xs text-slate-300">Create itemized or summary invoices with live payment tracking & printable PDF</p>
              </div>
            </div>
          </div>

          {/* Quick Client Pre-fill Dropdown */}
          <div className="flex items-center gap-2">
            {savedClients.length > 0 && (
              <div className="flex items-center gap-1.5 bg-slate-800 p-1.5 rounded-xl border border-slate-700">
                <span className="text-[10px] font-bold text-slate-400 uppercase px-1">Import Client:</span>
                <select
                  onChange={(e) => handleSelectClient(e.target.value)}
                  className="bg-slate-900 text-white text-xs font-bold px-2 py-1 rounded-lg border border-slate-700 focus:outline-none"
                >
                  <option value="">-- Select Saved Client --</option>
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
              onClick={handleSaveInvoiceRecord}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-md flex items-center gap-1.5"
            >
              <i className="ti ti-device-floppy text-sm" /> Save Record
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
                <span className="text-xs font-bold text-slate-900 uppercase flex items-center gap-1.5">
                  <i className="ti ti-file-analytics text-purple-600" /> Invoice Breakup Option
                </span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${invoiceData.hideBreakup ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                  {invoiceData.hideBreakup ? 'Without Breakup (Summary)' : 'With Breakup (Itemized)'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setInvoiceData({ ...invoiceData, hideBreakup: false })}
                  className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${!invoiceData.hideBreakup ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'}`}
                >
                  <i className="ti ti-list text-sm" /> With Breakup
                </button>
                <button
                  type="button"
                  onClick={() => setInvoiceData({ ...invoiceData, hideBreakup: true })}
                  className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${invoiceData.hideBreakup ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'}`}
                >
                  <i className="ti ti-eye-off text-sm" /> Without Breakup
                </button>
              </div>
            </div>

            {/* Header & Client Info Card */}
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
                    className="w-full border rounded px-2.5 py-1.5 font-bold font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">DATE</label>
                  <input
                    type="date"
                    value={invoiceData.invoiceDate}
                    onChange={(e) => setInvoiceData({ ...invoiceData, invoiceDate: e.target.value })}
                    className="w-full border rounded px-2 py-1 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">CLIENT NAME <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="CLIENT FULL NAME"
                  value={invoiceData.clientName}
                  onChange={(e) => setInvoiceData({ ...invoiceData, clientName: e.target.value })}
                  className="w-full border rounded px-3 py-1.5 font-bold text-slate-900 text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">PHONE</label>
                  <input
                    type="text"
                    placeholder="PHONE #"
                    value={invoiceData.phone}
                    onChange={(e) => setInvoiceData({ ...invoiceData, phone: e.target.value })}
                    className="w-full border rounded px-2 py-1 text-[11px]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">WHATSAPP</label>
                  <input
                    type="text"
                    placeholder="WHATSAPP #"
                    value={invoiceData.whatsapp}
                    onChange={(e) => setInvoiceData({ ...invoiceData, whatsapp: e.target.value })}
                    className="w-full border rounded px-2 py-1 text-[11px]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">EMAIL</label>
                  <input
                    type="text"
                    placeholder="EMAIL"
                    value={invoiceData.email}
                    onChange={(e) => setInvoiceData({ ...invoiceData, email: e.target.value })}
                    className="w-full border rounded px-2 py-1 text-[11px]"
                  />
                </div>
              </div>
            </div>

            {/* Ticket Passengers Section */}
            <div className="bg-white p-4 rounded-xl border border-indigo-200 shadow-xs space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                <span className="font-bold text-slate-900 uppercase flex items-center gap-1.5">
                  <i className="ti ti-ticket text-indigo-600" /> Ticket Booking Passengers ({invoiceData.ticketPassengers?.length || 0})
                </span>
                <button
                  type="button"
                  onClick={handleAddPassengerItem}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  <i className="ti ti-plus" /> Add Passenger Leg
                </button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {(invoiceData.ticketPassengers || []).map((pass, idx) => (
                  <div key={`inv-page-pass-${idx}`} className="bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100 space-y-1.5">
                    <div className="grid grid-cols-12 gap-1.5 items-center">
                      <div className="col-span-7">
                        <input
                          type="text"
                          value={pass.passengerName}
                          onChange={(e) => handleUpdatePassengerItem(idx, 'passengerName', e.target.value)}
                          className="w-full border rounded px-2 py-1 text-xs font-bold text-slate-900 bg-white"
                          placeholder="PASSENGER NAME"
                        />
                      </div>
                      <div className="col-span-4">
                        <input
                          type="number"
                          value={pass.amount}
                          onChange={(e) => handleUpdatePassengerItem(idx, 'amount', Number(e.target.value))}
                          className="w-full border rounded px-2 py-1 text-xs font-mono font-bold text-right bg-white"
                          placeholder="NET AMOUNT"
                        />
                      </div>
                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemovePassengerItem(idx)}
                          className="text-red-500 hover:text-red-700"
                          title="Remove passenger"
                        >
                          <i className="ti ti-trash" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
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
              <div className="font-bold text-slate-900 border-b border-slate-100 pb-2 uppercase tracking-wide flex items-center gap-1.5">
                <i className="ti ti-calculator text-blue-600" /> Payment & Balance Math
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">DISCOUNT AMOUNT</label>
                  <input
                    type="number"
                    value={invoiceData.discount}
                    onChange={(e) => {
                      const math = recalculateFinancials(invoiceData.items, e.target.value, invoiceData.amountPaid)
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
                      const math = recalculateFinancials(invoiceData.items, invoiceData.discount, e.target.value)
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
                    className="px-3.5 py-1.5 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg flex items-center gap-1 transition-all shadow-xs"
                  >
                    <i className="ti ti-download" /> Download PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg flex items-center gap-1 shadow-md transition-all"
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

        {/* Saved Invoices History Table */}
        {savedInvoices.length > 0 && (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <i className="ti ti-history text-blue-600" />
                Saved Invoices History ({savedInvoices.length})
              </h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px]">
                  <tr>
                    <th className="p-2.5">INV #</th>
                    <th className="p-2.5">CLIENT NAME</th>
                    <th className="p-2.5">DATE</th>
                    <th className="p-2.5 text-right">TOTAL</th>
                    <th className="p-2.5 text-right">PAID</th>
                    <th className="p-2.5 text-right">BALANCE</th>
                    <th className="p-2.5 text-center">STATUS</th>
                    <th className="p-2.5 text-center">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                  {savedInvoices.map((inv) => (
                    <tr key={`history-${inv.id}`} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-900">{inv.invoiceNo}</td>
                      <td className="p-2.5 font-bold text-slate-800 font-sans">{inv.clientName}</td>
                      <td className="p-2.5 text-slate-600">{inv.invoiceDate}</td>
                      <td className="p-2.5 text-right font-bold text-slate-900">{Number(inv.totalAmount || 0).toLocaleString()}</td>
                      <td className="p-2.5 text-right font-bold text-blue-700">{Number(inv.amountPaid || 0).toLocaleString()}</td>
                      <td className="p-2.5 text-right font-bold text-red-700">{Number(inv.balanceDue || 0).toLocaleString()}</td>
                      <td className="p-2.5 text-center">
                        <span className={`px-2 py-0.5 text-[10px] font-black rounded ${inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : inv.status === 'PARTIAL' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="p-2.5 text-center">
                        <div className="flex items-center justify-center gap-1.5 font-sans">
                          <button
                            type="button"
                            onClick={() => handleLoadInvoice(inv)}
                            className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-2 py-1 rounded text-xs font-bold"
                          >
                            Load
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteInvoice(inv.id)}
                            className="bg-red-50 text-red-600 hover:bg-red-100 px-2 py-1 rounded text-xs font-bold"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
