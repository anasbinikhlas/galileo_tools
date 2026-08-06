import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

// Formats raw ticket numbers to include 3-digit airline code hyphen: e.g. 0652408367802 -> 065-2408367802
function formatTicketNumber(str) {
  if (!str) return ''
  const clean = String(str).trim()

  // 1. Already formatted with hyphen e.g. "065-2408367802" or "065-2408367802-803"
  if (/^\d{3}-\d+/.test(clean)) return clean

  // 2. 13 continuous digits e.g. "0652408367802" -> "065-2408367802"
  if (/^\d{13}$/.test(clean)) {
    return `${clean.slice(0, 3)}-${clean.slice(3)}`
  }

  // 3. 15-16 continuous digits e.g. "0652408367802803" -> "065-2408367802-803"
  if (/^\d{15,16}$/.test(clean)) {
    return `${clean.slice(0, 3)}-${clean.slice(3, 13)}-${clean.slice(13)}`
  }

  return clean
}

// Helper function to auto-generate sequential ticket numbers for single & conjunction range tickets
function generateTicketSequence(startTicketStr, count) {
  if (!startTicketStr || count <= 0) return []
  let cleanStr = String(startTicketStr).trim()
  if (!cleanStr) return []

  cleanStr = formatTicketNumber(cleanStr)

  // Pattern 1: Conjunction Range Ticket e.g. "065-2408367802-803" or "217-4858158427-428"
  // Requires 3-digit airline prefix (e.g. 065-), 10-digit main ticket number, and 2-4 digit suffix range
  const rangeMatch = cleanStr.match(/^(\d{3}-)(\d{10})-(\d{2,4})$/)
  if (rangeMatch) {
    const prefix = rangeMatch[1] // "065-"
    const startNumStr = rangeMatch[2] // "2408367802"
    const endSuffixStr = rangeMatch[3] // "803"

    try {
      const startNum = BigInt(startNumStr)
      const suffixLen = endSuffixStr.length
      const basePart = startNumStr.slice(0, -suffixLen)
      const endNum = BigInt(basePart + endSuffixStr)
      const step = endNum >= startNum ? (endNum - startNum + 1n) : 2n
      const numLen = startNumStr.length

      const results = []
      let currentStart = startNum
      for (let i = 0; i < count; i++) {
        const currentEnd = currentStart + step - 1n
        const startFormatted = currentStart.toString().padStart(numLen, '0')
        const endFormatted = currentEnd.toString().slice(-suffixLen).padStart(suffixLen, '0')
        results.push(`${prefix}${startFormatted}-${endFormatted}`)
        currentStart += step
      }
      return results
    } catch (e) {
      console.error('BigInt parsing error:', e)
    }
  }

  // Pattern 2: Single Ticket with Airline Code e.g. "065-2408367802" or "217-4858158427"
  const singleMatch = cleanStr.match(/^(\d{3}-)(\d{10})$/)
  if (singleMatch) {
    const prefix = singleMatch[1] // "065-"
    const numStr = singleMatch[2] // "2408367802"
    try {
      let currentNum = BigInt(numStr)
      const numLen = numStr.length

      const results = []
      for (let i = 0; i < count; i++) {
        const formatted = currentNum.toString().padStart(numLen, '0')
        results.push(`${prefix}${formatted}`)
        currentNum += 1n
      }
      return results
    } catch (e) {
      console.error('BigInt parsing error:', e)
    }
  }

  // Pattern 3: Generic Single Number increment (no prefix, e.g. "2408367802")
  const genericMatch = cleanStr.match(/^(\d+)$/)
  if (genericMatch) {
    const numStr = genericMatch[1]
    try {
      let currentNum = BigInt(numStr)
      const numLen = numStr.length

      const results = []
      for (let i = 0; i < count; i++) {
        const formatted = currentNum.toString().padStart(numLen, '0')
        results.push(formatted)
        currentNum += 1n
      }
      return results
    } catch (e) {
      console.error('BigInt parsing error:', e)
    }
  }

  // Fallback: Return array filled with initial string
  return Array(count).fill(cleanStr)
}

export default function PackageSalesReportModal({ isOpen, onClose, packageData }) {
  if (!isOpen) return null

  const { header, pax, depFlight, arrFlight, passengerList, pnr, comments } = packageData || {}

  // Standardize passenger list array
  const rawPaxList = Array.isArray(passengerList) && passengerList.length > 0
    ? passengerList
    : [header?.name || 'Passenger 1']

  const defaultAirline = depFlight?.airline || ''
  const defaultDepDate = depFlight?.date || header?.date || ''
  const defaultArrDate = arrFlight?.date || ''
  const defaultPnr = pnr || depFlight?.pnr || comments || ''
  const rawTicketNo = depFlight?.flight_no || defaultPnr || ''
  const defaultTicketNo = formatTicketNumber(rawTicketNo)
  const defaultSp = pax?.adt_price || ''

  // Single Group Particular & Vendor defaults (Appears ONLY on 1st Row)
  const defaultGroupParticular = `ref # ${rawPaxList[0] || header?.name || ''} ${depFlight?.sector || ''} ${arrFlight?.sector || ''}`.replace(/\s+/g, ' ').trim()
  const defaultGroupVender = 'AFRG'

  const [singleVendorAndParticular, setSingleVendorAndParticular] = useState(true)
  const [includeHeadersInCopy, setIncludeHeadersInCopy] = useState(false) // DEFAULT FALSE: DATA ONLY, NO HEADERS
  const [groupParticular, setGroupParticular] = useState(defaultGroupParticular)
  const [groupVender, setGroupVender] = useState(defaultGroupVender)

  // Build initial multi-passenger rows with auto-generated ticket numbers if available
  const buildInitialRows = () => {
    const initialTickets = generateTicketSequence(defaultTicketNo, rawPaxList.length)

    return rawPaxList.map((paxName, idx) => {
      const sNoStr = String(idx + 1)
      const ticketVal = formatTicketNumber(initialTickets[idx] || defaultTicketNo)

      return {
        id: idx + 1,
        sNo: sNoStr,
        name: paxName || `Passenger ${idx + 1}`,
        ticketNumber: ticketVal,
        paxType: 'adt',
        airline: defaultAirline,
        basicFare: '',
        taxes: '',
        discountPercent: '',
        costPrice: '',
        sellingPrice: defaultSp,
        remarks: defaultPnr,
        particular: `ref # ${paxName} ${depFlight?.sector || ''} ${arrFlight?.sector || ''}`.replace(/\s+/g, ' ').trim(),
        vender: defaultGroupVender,
        departure: defaultDepDate,
        arrival: defaultArrDate
      }
    })
  }

  const [rows, setRows] = useState(buildInitialRows)

  // Batch Apply State for Fares & Ticket Numbers
  const [batchStartTicket, setBatchStartTicket] = useState(defaultTicketNo)
  const [batchBasicFare, setBatchBasicFare] = useState('')
  const [batchTaxes, setBatchTaxes] = useState('')
  const [batchDiscountPercent, setBatchDiscountPercent] = useState('')
  const [batchCostPrice, setBatchCostPrice] = useState('')
  const [batchSellingPrice, setBatchSellingPrice] = useState(defaultSp)
  const [batchRemarks, setBatchRemarks] = useState(defaultPnr)
  const [batchAirline, setBatchAirline] = useState(defaultAirline)
  const [batchDeparture, setBatchDeparture] = useState(defaultDepDate)
  const [batchArrival, setBatchArrival] = useState(defaultArrDate)

  // Multiline ticket paste modal state
  const [showPasteTicketModal, setShowPasteTicketModal] = useState(false)
  const [rawTicketText, setRawTicketText] = useState('')

  // Calculation Helper: Calculates C.P & Taxes according to Basic Fare & Discount %
  const computeRowPricing = (currentBasic, currentDisc, currentCp, currentTaxes, updatedField, updatedValue) => {
    let bFare = parseFloat(updatedField === 'basicFare' ? updatedValue : currentBasic) || 0
    let disc = parseFloat(updatedField === 'discountPercent' ? updatedValue : currentDisc) || 0
    let cp = parseFloat(updatedField === 'costPrice' ? updatedValue : currentCp) || 0
    let tax = parseFloat(updatedField === 'taxes' ? updatedValue : currentTaxes) || 0

    if (updatedField === 'basicFare' || updatedField === 'discountPercent') {
      const netBasic = bFare * (1 - disc / 100)
      if (tax === 0 && cp > bFare) {
        tax = cp - bFare
      }
      const newCp = Math.round(netBasic + tax)
      return {
        basicFare: updatedField === 'basicFare' ? updatedValue : currentBasic,
        discountPercent: updatedField === 'discountPercent' ? updatedValue : currentDisc,
        taxes: tax > 0 ? String(tax) : currentTaxes,
        costPrice: bFare > 0 ? String(newCp) : ''
      }
    } else if (updatedField === 'costPrice') {
      const newTax = bFare > 0 && cp >= bFare ? (cp - bFare) : tax
      return {
        costPrice: updatedValue,
        taxes: bFare > 0 && cp >= bFare ? String(newTax) : currentTaxes
      }
    } else if (updatedField === 'taxes') {
      const netBasic = bFare * (1 - disc / 100)
      const newCp = Math.round(netBasic + tax)
      return {
        taxes: updatedValue,
        costPrice: bFare > 0 ? String(newCp) : ''
      }
    }
    return {}
  }

  // Handle batch field change with auto calculations
  const handleBatchFieldChange = (field, value) => {
    if (field === 'basicFare') {
      setBatchBasicFare(value)
      const res = computeRowPricing(value, batchDiscountPercent, batchCostPrice, batchTaxes, 'basicFare', value)
      if (res.costPrice !== undefined) setBatchCostPrice(res.costPrice)
      if (res.taxes !== undefined) setBatchTaxes(res.taxes)
    } else if (field === 'discountPercent') {
      setBatchDiscountPercent(value)
      const res = computeRowPricing(batchBasicFare, value, batchCostPrice, batchTaxes, 'discountPercent', value)
      if (res.costPrice !== undefined) setBatchCostPrice(res.costPrice)
    } else if (field === 'costPrice') {
      setBatchCostPrice(value)
      const res = computeRowPricing(batchBasicFare, batchDiscountPercent, value, batchTaxes, 'costPrice', value)
      if (res.taxes !== undefined) setBatchTaxes(res.taxes)
    } else if (field === 'taxes') {
      setBatchTaxes(value)
      const res = computeRowPricing(batchBasicFare, batchDiscountPercent, batchCostPrice, value, 'taxes', value)
      if (res.costPrice !== undefined) setBatchCostPrice(res.costPrice)
    }
  }

  // Auto-sequence ticket numbers across all passenger rows
  const handleAutoSequenceTickets = () => {
    if (!batchStartTicket) {
      toast.error('Please enter a starting ticket number (e.g. 065-2408367802 or 065-2408367802-803)')
      return
    }

    const formattedStart = formatTicketNumber(batchStartTicket)
    setBatchStartTicket(formattedStart)

    const seqTickets = generateTicketSequence(formattedStart, rows.length)

    setRows(prevRows => {
      return prevRows.map((row, idx) => ({
        ...row,
        ticketNumber: formatTicketNumber(seqTickets[idx] || row.ticketNumber)
      }))
    })

    toast.success(`Auto-generated ticket sequence for all ${rows.length} passengers!`, { id: 'seq-success' })
  }

  // Apply multiline ticket numbers from paste box with auto 3-digit hyphen formatting
  const handleApplyPastedTickets = () => {
    if (!rawTicketText.trim()) return
    const ticketLines = rawTicketText
      .split('\n')
      .map(line => formatTicketNumber(line.trim()))
      .filter(Boolean)

    if (ticketLines.length === 0) return

    setRows(prevRows => {
      return prevRows.map((row, idx) => ({
        ...row,
        ticketNumber: ticketLines[idx] || row.ticketNumber
      }))
    })

    setShowPasteTicketModal(false)
    setRawTicketText('')
    toast.success(`Assigned ${ticketLines.length} ticket numbers!`, { id: 'paste-tkt-success' })
  }

  // Update a single row field and auto-calculate C.P & Taxes
  const updateRow = (index, field, value) => {
    setRows(prevRows => {
      const newRows = [...prevRows]
      let valToSet = value

      if (field === 'ticketNumber') {
        valToSet = formatTicketNumber(value)
      }

      const targetRow = { ...newRows[index], [field]: valToSet }

      if (['basicFare', 'discountPercent', 'costPrice', 'taxes'].includes(field)) {
        const computed = computeRowPricing(
          targetRow.basicFare,
          targetRow.discountPercent,
          targetRow.costPrice,
          targetRow.taxes,
          field,
          value
        )
        Object.assign(targetRow, computed)
      }

      newRows[index] = targetRow
      return newRows
    })
  }

  // Apply batch inputs to ALL passenger rows
  const handleApplyBatchToAll = () => {
    const formattedBatchStart = formatTicketNumber(batchStartTicket)
    if (formattedBatchStart) setBatchStartTicket(formattedBatchStart)

    const seqTickets = formattedBatchStart ? generateTicketSequence(formattedBatchStart, rows.length) : []

    setRows(prevRows => {
      return prevRows.map((row, idx) => {
        const bFare = batchBasicFare !== '' ? batchBasicFare : row.basicFare
        const disc = batchDiscountPercent !== '' ? batchDiscountPercent : row.discountPercent
        const cp = batchCostPrice !== '' ? batchCostPrice : row.costPrice
        const tx = batchTaxes !== '' ? batchTaxes : row.taxes
        const autoTkt = formatTicketNumber(seqTickets[idx] || (formattedBatchStart !== '' ? formattedBatchStart : row.ticketNumber))

        return {
          ...row,
          ticketNumber: autoTkt,
          basicFare: bFare,
          discountPercent: disc,
          costPrice: cp,
          taxes: tx,
          sellingPrice: batchSellingPrice !== '' ? batchSellingPrice : row.sellingPrice,
          remarks: batchRemarks !== '' ? batchRemarks : row.remarks,
          airline: batchAirline !== '' ? batchAirline : row.airline,
          departure: batchDeparture !== '' ? batchDeparture : row.departure,
          arrival: batchArrival !== '' ? batchArrival : row.arrival
        }
      })
    })
    toast.success(`Applied fare rules & ticket numbers to all ${rows.length} passenger rows!`, { id: 'batch-applied' })
  }

  // Add new blank row
  const handleAddRow = () => {
    const nextIdx = rows.length
    const formattedBatchStart = formatTicketNumber(batchStartTicket)
    const nextSeq = formattedBatchStart ? generateTicketSequence(formattedBatchStart, nextIdx + 1) : []
    const newTkt = formatTicketNumber(nextSeq[nextIdx] || defaultTicketNo)

    setRows(prev => [
      ...prev,
      {
        id: prev.length + 1,
        sNo: String(prev.length + 1),
        name: `Passenger ${prev.length + 1}`,
        ticketNumber: newTkt,
        paxType: 'adt',
        airline: batchAirline || defaultAirline,
        basicFare: batchBasicFare,
        taxes: batchTaxes,
        discountPercent: batchDiscountPercent,
        costPrice: batchCostPrice,
        sellingPrice: batchSellingPrice,
        remarks: batchRemarks || defaultPnr,
        particular: `ref # Passenger ${prev.length + 1} ${depFlight?.sector || ''}`,
        vender: groupVender || 'AFRG',
        departure: batchDeparture || defaultDepDate,
        arrival: batchArrival || defaultArrDate
      }
    ])
  }

  // Remove a row
  const handleRemoveRow = (index) => {
    setRows(prev => prev.filter((_, i) => i !== index))
  }

  // Totals calculations
  const totalBasic = rows.reduce((sum, r) => sum + (parseFloat(r.basicFare) || 0), 0)
  const totalTaxes = rows.reduce((sum, r) => sum + (parseFloat(r.taxes) || 0), 0)
  const totalCp = rows.reduce((sum, r) => sum + (parseFloat(r.costPrice) || 0), 0)
  const totalSp = rows.reduce((sum, r) => sum + (parseFloat(r.sellingPrice) || 0), 0)
  const totalProfit = totalSp - totalCp

  // Headers matching user's exact order
  const headers = ['S.NO', 'NAME', 'TICKET NUMBER', 'A-C-I', 'A/L', 'BASIC FARE', 'C.P', 'S.P', 'REMARKS', 'PARTICULAR', 'VENDER', 'DEPARTURE', 'ARRIVAL']

  // Helper to format rows for Excel / CSV with single Particular & Vendor rule & hyphenated ticket numbers
  const getProcessedExportRows = () => {
    return rows.map((r, idx) => {
      let finalParticular = r.particular
      let finalVender = r.vender

      if (singleVendorAndParticular) {
        if (idx === 0) {
          finalParticular = groupParticular
          finalVender = groupVender
        } else {
          finalParticular = ''
          finalVender = ''
        }
      }

      const formattedTkt = formatTicketNumber(r.ticketNumber)

      return [
        r.sNo, r.name, formattedTkt, r.paxType, r.airline,
        r.basicFare, r.costPrice, r.sellingPrice, r.remarks,
        finalParticular, finalVender, r.departure, r.arrival
      ]
    })
  }

  // 1. Copy All Passenger Rows for direct Ctrl+V in Excel (NO HEADERS BY DEFAULT)
  const handleCopyForExcel = () => {
    const exportRows = getProcessedExportRows()
    const rowsOnlyTsv = exportRows.map(rowVals => rowVals.join('\t')).join('\n')
    const tsvLines = includeHeadersInCopy
      ? [headers.join('\t'), rowsOnlyTsv].join('\n')
      : rowsOnlyTsv

    navigator.clipboard.writeText(tsvLines).then(() => {
      const msg = includeHeadersInCopy
        ? `Copied ${rows.length} passenger rows with column headers!`
        : `Copied ${rows.length} passenger rows (Data only, no headers)! Press Ctrl+V in Excel.`
      toast.success(msg, { id: 'excel-copy-success', duration: 4000 })
    }).catch(err => {
      console.error('Clipboard copy failed:', err)
      toast.error('Failed to copy to clipboard')
    })
  }

  // 2. Download CSV File formatted for Excel
  const handleDownloadCsv = () => {
    const escapeCsv = (str) => {
      const s = String(str || '')
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`
      }
      return s
    }

    const exportRows = getProcessedExportRows()
    const csvLines = [
      headers.map(escapeCsv).join(','),
      ...exportRows.map(rowVals => rowVals.map(escapeCsv).join(','))
    ].join('\n')

    const blob = new Blob(['\uFEFF' + csvLines], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const cleanName = (header?.name || 'Sales_Report').replace(/[^a-zA-Z0-9]/g, '_')
    link.href = url
    link.setAttribute('download', `Ticket_Sales_${rows.length}Pax_${cleanName}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast.success(`Downloaded Excel CSV for ${rows.length} passengers!`, { id: 'csv-download-success' })
  }

  // 3. Copy WhatsApp text summary
  const handleCopyWhatsApp = () => {
    const paxDetails = rows.map((r, i) => {
      const pText = singleVendorAndParticular ? (i === 0 ? groupParticular : '') : r.particular
      const vText = singleVendorAndParticular ? (i === 0 ? groupVender : '') : r.vender
      const formattedTkt = formatTicketNumber(r.ticketNumber)

      return `${i + 1}. *${r.name}* (${r.paxType.toUpperCase()})
   • Ticket/PNR: ${formattedTkt || 'N/A'} | Airline: ${r.airline || 'N/A'}
   • Basic Fare: ${r.basicFare ? 'PKR ' + Number(r.basicFare).toLocaleString() : 'N/A'}
   • Taxes: ${r.taxes ? 'PKR ' + Number(r.taxes).toLocaleString() : 'N/A'}
   • Cost Price (C.P): ${r.costPrice ? 'PKR ' + Number(r.costPrice).toLocaleString() : 'N/A'}
   • Sale Price (S.P): ${r.sellingPrice ? 'PKR ' + Number(r.sellingPrice).toLocaleString() : 'N/A'}${pText ? '\n   • Particular: ' + pText : ''}${vText ? '\n   • Vendor: ' + vText : ''}`
    }).join('\n\n')

    const text = `📊 *TICKET SALES REPORT (${rows.length} PASSENGERS)*
----------------------------------------
*Group Particular:* ${groupParticular || 'N/A'}
*Group Vendor:* ${groupVender || 'N/A'}
----------------------------------------
${paxDetails}
----------------------------------------
💰 *TOTAL BASIC FARE:* PKR ${totalBasic.toLocaleString()}
💰 *TOTAL TAXES:* PKR ${totalTaxes.toLocaleString()}
💰 *TOTAL COST PRICE (C.P):* PKR ${totalCp.toLocaleString()}
💰 *TOTAL SALE PRICE (S.P):* PKR ${totalSp.toLocaleString()}
📈 *PROFIT MARGIN:* PKR ${totalProfit.toLocaleString()}
----------------------------------------
Generated via Travel Agent Suite by Omaanu`

    navigator.clipboard.writeText(text).then(() => {
      toast.success(`Copied WhatsApp summary for ${rows.length} passengers!`, { id: 'wa-copy-success' })
    }).catch(err => {
      console.error('Clipboard copy failed:', err)
      toast.error('Failed to copy to clipboard')
    })
  }

  // Save record state persistence
  const handleSaveSalesReport = () => {
    try {
      const dataToSave = {
        rows,
        groupParticular,
        groupVender,
        singleVendorAndParticular,
        updatedAt: new Date().toISOString()
      }
      localStorage.setItem('galileo_saved_sales_report', JSON.stringify(dataToSave))
      toast.success('Sales report record saved! It will load automatically next time.', { id: 'save-sales-report' })
    } catch (e) {
      toast.error('Failed to save sales record to storage')
    }
  }

  const handleResetToPackageDefaults = () => {
    try {
      localStorage.removeItem('galileo_saved_sales_report')
      setRows(buildInitialRows())
      setGroupParticular(defaultGroupParticular)
      setGroupVender(defaultGroupVender)
      toast.success('Reset sales report to current package defaults')
    } catch (e) {}
  }

  useEffect(() => {
    if (isOpen) {
      try {
        const stored = localStorage.getItem('galileo_saved_sales_report')
        if (stored) {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed.rows) && parsed.rows.length > 0) {
            setRows(parsed.rows)
            if (parsed.groupParticular !== undefined) setGroupParticular(parsed.groupParticular)
            if (parsed.groupVender !== undefined) setGroupVender(parsed.groupVender)
            if (parsed.singleVendorAndParticular !== undefined) setSingleVendorAndParticular(parsed.singleVendorAndParticular)
          }
        }
      } catch (e) {}
    }
  }, [isOpen])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col my-auto max-h-[95vh]">

        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shadow-inner">
              <i className="ti ti-table text-2xl text-white" />
            </div>
            <div>
              <h3 className="text-base font-extrabold leading-tight flex items-center gap-2">
                Ticket Sales Report Generator ({rows.length} Passengers)
              </h3>
              <p className="text-xs text-emerald-100 mt-0.5">
                Exact sequential ticket increment logic for single and range ticket numbers.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveSalesReport}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-emerald-400 shadow-sm flex items-center gap-1 cursor-pointer transition-all"
              title="Save entered details so they reload automatically"
            >
              <i className="ti ti-device-floppy text-sm" /> Save Record
            </button>
            <button
              onClick={handleResetToPackageDefaults}
              className="bg-white/10 hover:bg-white/20 text-emerald-100 hover:text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-white/20 transition-all cursor-pointer"
              title="Reset to current package defaults"
            >
              <i className="ti ti-rotate-2 text-sm" /> Reset
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Close modal"
            >
              <i className="ti ti-x text-lg" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">

          {/* SINGLE GROUP PARTICULAR & VENDOR CARD (1ST ROW ONLY) */}
          <div className="bg-gradient-to-r from-indigo-50 via-blue-50 to-indigo-100/50 p-4 rounded-xl border border-indigo-200 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-extrabold uppercase tracking-wide text-indigo-950 flex items-center gap-1.5">
                <i className="ti ti-pin text-indigo-600 text-base" />
                Group Particular & Vendor (Appears ONCE on Row 1 in Excel)
              </h4>
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-900 bg-white border border-indigo-200 px-3 py-1 rounded-lg shadow-2xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={singleVendorAndParticular}
                  onChange={e => setSingleVendorAndParticular(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                />
                <span>Particular & Vendor on 1st Row Only</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-extrabold uppercase text-indigo-900 mb-1">
                  GROUP PARTICULAR (ROW 1 ONLY)
                </label>
                <input
                  type="text"
                  value={groupParticular}
                  onChange={e => setGroupParticular(e.target.value)}
                  placeholder="ref # ZUNAIR USMAN KHI-JED JED-KHI"
                  className="w-full text-xs font-bold text-indigo-950 px-3 py-2 border border-indigo-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 shadow-2xs font-sans"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-indigo-900 mb-1">
                  GROUP VENDOR (ROW 1 ONLY)
                </label>
                <input
                  type="text"
                  value={groupVender}
                  onChange={e => setGroupVender(e.target.value)}
                  placeholder="AFRG"
                  className="w-full text-xs font-extrabold text-indigo-950 px-3 py-2 border border-indigo-300 rounded-lg bg-white uppercase focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* Quick Batch Fill & Auto Ticket Sequence Card */}
          <div className="bg-gradient-to-r from-amber-50 via-orange-50/50 to-amber-100/40 p-4 rounded-xl border border-amber-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold uppercase tracking-wide text-amber-950 flex items-center gap-1.5">
                <i className="ti ti-calculator text-amber-700 text-sm" />
                Batch Fill & Auto Ticket Sequencing ({rows.length} Passengers)
              </h4>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPasteTicketModal(true)}
                  className="text-[11px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-lg border border-amber-300 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Paste list of ticket numbers directly from clipboard"
                >
                  <i className="ti ti-clipboard text-xs" /> Paste Ticket List
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3 text-xs">
              <div className="col-span-2 sm:col-span-2 md:col-span-2">
                <label className="block text-[10px] font-extrabold uppercase text-amber-900 mb-1 flex items-center justify-between">
                  <span>STARTING TICKET NO</span>
                  <span className="text-[9px] text-amber-700 font-normal">(Auto-hyphenated)</span>
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={batchStartTicket}
                    onChange={e => setBatchStartTicket(e.target.value)}
                    onBlur={e => setBatchStartTicket(formatTicketNumber(e.target.value))}
                    placeholder="065-2408367802 or 0652408367802"
                    className="w-full text-xs font-bold text-emerald-900 px-2.5 py-1.5 border border-amber-300 rounded-lg bg-white font-mono focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={handleAutoSequenceTickets}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-2 py-1.5 rounded-lg shadow-2xs shrink-0 cursor-pointer"
                    title="Auto-sequence ticket numbers for all rows"
                  >
                    <i className="ti ti-numbers text-sm" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-amber-900 mb-1">BASIC FARE</label>
                <input
                  type="number"
                  value={batchBasicFare}
                  onChange={e => handleBatchFieldChange('basicFare', e.target.value)}
                  placeholder="e.g. 90500"
                  className="w-full text-xs font-bold text-gray-900 px-2 py-1.5 border border-amber-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-amber-900 mb-1">C.P (COST)</label>
                <input
                  type="number"
                  value={batchCostPrice}
                  onChange={e => handleBatchFieldChange('costPrice', e.target.value)}
                  placeholder="e.g. 120500"
                  className="w-full text-xs font-bold text-red-700 border border-amber-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-amber-900 mb-1 flex items-center justify-between">
                  <span>TAXES</span>
                  <span className="text-[9px] text-amber-700 font-semibold">(AUTO)</span>
                </label>
                <input
                  type="number"
                  value={batchTaxes}
                  onChange={e => handleBatchFieldChange('taxes', e.target.value)}
                  placeholder="e.g. 30000"
                  className="w-full text-xs font-bold text-amber-950 border border-amber-300 rounded-lg bg-amber-50/90 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-amber-900 mb-1">-% DISC</label>
                <input
                  type="number"
                  step="0.1"
                  value={batchDiscountPercent}
                  onChange={e => handleBatchFieldChange('discountPercent', e.target.value)}
                  placeholder="-%"
                  className="w-full text-xs font-bold text-amber-900 border border-amber-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-amber-900 mb-1">S.P (SALE)</label>
                <input
                  type="number"
                  value={batchSellingPrice}
                  onChange={e => setBatchSellingPrice(e.target.value)}
                  placeholder="e.g. 176213"
                  className="w-full text-xs font-bold text-emerald-700 border border-amber-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleApplyBatchToAll}
                  className="w-full bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs py-1.5 px-2 rounded-lg shadow-sm transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                >
                  <i className="ti ti-check text-sm" /> Apply All
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Multi-Passenger Table */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
                <i className="ti ti-users text-emerald-600 text-sm" />
                Passenger Sales Ledger Rows ({rows.length} Passengers)
              </h4>
              <button
                onClick={handleAddRow}
                className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              >
                <i className="ti ti-plus text-xs" /> Add Passenger Row
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-300 shadow-inner bg-white max-h-[45vh]">
              <table className="min-w-full text-left text-xs divide-y divide-gray-200">
                <thead className="bg-emerald-900 text-white text-[10px] font-black uppercase sticky top-0 z-10">
                  <tr>
                    <th className="px-2.5 py-2.5 whitespace-nowrap">S.NO</th>
                    <th className="px-2.5 py-2.5 whitespace-nowrap min-w-[140px]">PASSENGER NAME</th>
                    <th className="px-2.5 py-2.5 whitespace-nowrap min-w-[150px]">TICKET / PNR NUMBER</th>
                    <th className="px-2.5 py-2.5 whitespace-nowrap w-14">A-C-I</th>
                    <th className="px-2.5 py-2.5 whitespace-nowrap w-14">A/L</th>
                    <th className="px-2.5 py-2.5 whitespace-nowrap min-w-[90px]">BASIC FARE</th>
                    <th className="px-2.5 py-2.5 whitespace-nowrap min-w-[80px]">TAXES</th>
                    <th className="px-2.5 py-2.5 whitespace-nowrap w-16">-% DISC</th>
                    <th className="px-2.5 py-2.5 whitespace-nowrap min-w-[90px]">C.P (COST)</th>
                    <th className="px-2.5 py-2.5 whitespace-nowrap min-w-[90px]">S.P (SALE)</th>
                    <th className="px-2.5 py-2.5 whitespace-nowrap min-w-[100px]">REMARKS</th>
                    <th className="px-2.5 py-2.5 whitespace-nowrap min-w-[170px]">PARTICULAR</th>
                    <th className="px-2.5 py-2.5 whitespace-nowrap min-w-[80px]">VENDER</th>
                    <th className="px-2.5 py-2.5 whitespace-nowrap min-w-[90px]">DEPARTURE</th>
                    <th className="px-2.5 py-2.5 whitespace-nowrap min-w-[90px]">ARRIVAL</th>
                    <th className="px-2.5 py-2.5 whitespace-nowrap w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 font-mono text-gray-900 bg-white">
                  {rows.map((row, idx) => {
                    const isFirst = idx === 0
                    return (
                      <tr key={idx} className="hover:bg-emerald-50/60 transition-colors">
                        {/* 1. S.NO */}
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            value={row.sNo}
                            onChange={e => updateRow(idx, 'sNo', e.target.value)}
                            className="w-10 text-[11px] font-bold text-center border border-gray-200 rounded px-1 py-1 bg-gray-50"
                          />
                        </td>

                        {/* 2. NAME */}
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            value={row.name}
                            onChange={e => updateRow(idx, 'name', e.target.value)}
                            className="w-full text-xs font-semibold border border-gray-300 rounded px-2 py-1 bg-white focus:ring-1 focus:ring-emerald-500 font-sans"
                          />
                        </td>

                        {/* 3. TICKET NUMBER */}
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            value={row.ticketNumber}
                            onChange={e => updateRow(idx, 'ticketNumber', e.target.value)}
                            onBlur={e => updateRow(idx, 'ticketNumber', formatTicketNumber(e.target.value))}
                            placeholder="065-2408367802"
                            className="w-full text-xs font-bold border border-gray-300 rounded px-2 py-1 bg-white text-emerald-800 font-mono focus:ring-1 focus:ring-emerald-500"
                          />
                        </td>

                        {/* 4. A-C-I */}
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            value={row.paxType}
                            onChange={e => updateRow(idx, 'paxType', e.target.value)}
                            className="w-12 text-xs font-semibold text-center uppercase border border-gray-300 rounded px-1 py-1 bg-white"
                          />
                        </td>

                        {/* 5. A/L */}
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            value={row.airline}
                            onChange={e => updateRow(idx, 'airline', e.target.value)}
                            className="w-12 text-xs font-bold text-center uppercase text-blue-700 border border-gray-300 rounded px-1 py-1 bg-white"
                          />
                        </td>

                        {/* 6. BASIC FARE */}
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            value={row.basicFare}
                            onChange={e => updateRow(idx, 'basicFare', e.target.value)}
                            className="w-full text-xs font-bold text-amber-900 border border-amber-300 rounded px-2 py-1 bg-amber-50/50"
                            placeholder="Basic"
                          />
                        </td>

                        {/* TAXES */}
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            value={row.taxes}
                            onChange={e => updateRow(idx, 'taxes', e.target.value)}
                            className="w-full text-xs font-bold text-gray-800 border border-gray-300 rounded px-2 py-1 bg-gray-50"
                            placeholder="Taxes"
                          />
                        </td>

                        {/* DISC % */}
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            step="0.1"
                            value={row.discountPercent}
                            onChange={e => updateRow(idx, 'discountPercent', e.target.value)}
                            className="w-14 text-xs font-bold text-amber-900 border border-amber-300 rounded px-1 py-1 bg-amber-50/50 text-center"
                            placeholder="-%"
                          />
                        </td>

                        {/* 7. C.P */}
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            value={row.costPrice}
                            onChange={e => updateRow(idx, 'costPrice', e.target.value)}
                            className="w-full text-xs font-bold text-red-700 border border-red-200 rounded px-2 py-1 bg-red-50/30"
                            placeholder="C.P"
                          />
                        </td>

                        {/* 8. S.P */}
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            value={row.sellingPrice}
                            onChange={e => updateRow(idx, 'sellingPrice', e.target.value)}
                            className="w-full text-xs font-bold text-emerald-700 border border-emerald-300 rounded px-2 py-1 bg-emerald-50/30"
                            placeholder="S.P"
                          />
                        </td>

                        {/* 9. REMARKS */}
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            value={row.remarks}
                            onChange={e => updateRow(idx, 'remarks', e.target.value)}
                            className="w-full text-xs border border-gray-300 rounded px-2 py-1 bg-white uppercase font-mono"
                          />
                        </td>

                        {/* 10. PARTICULAR (1ST ROW ONLY OR INDIVIDUAL) */}
                        <td className="px-2 py-2">
                          {singleVendorAndParticular ? (
                            isFirst ? (
                              <input
                                type="text"
                                value={groupParticular}
                                onChange={e => setGroupParticular(e.target.value)}
                                className="w-full text-xs font-bold text-indigo-900 border border-indigo-300 rounded px-2 py-1 bg-indigo-50/50 font-sans"
                                title="Group Particular (Appears on Row 1 only in Excel)"
                              />
                            ) : (
                              <div className="text-[11px] text-gray-400 italic px-2 py-1 bg-gray-50/50 rounded border border-dashed border-gray-200">
                                (Blank in Excel)
                              </div>
                            )
                          ) : (
                            <input
                              type="text"
                              value={row.particular}
                              onChange={e => updateRow(idx, 'particular', e.target.value)}
                              className="w-full text-xs border border-gray-300 rounded px-2 py-1 bg-white font-sans text-gray-700"
                            />
                          )}
                        </td>

                        {/* 11. VENDER (1ST ROW ONLY OR INDIVIDUAL) */}
                        <td className="px-2 py-2">
                          {singleVendorAndParticular ? (
                            isFirst ? (
                              <input
                                type="text"
                                value={groupVender}
                                onChange={e => setGroupVender(e.target.value)}
                                className="w-full text-xs font-bold text-indigo-900 uppercase border border-indigo-300 rounded px-2 py-1 bg-indigo-50/50"
                                title="Group Vendor (Appears on Row 1 only in Excel)"
                              />
                            ) : (
                              <div className="text-[11px] text-gray-400 italic px-2 py-1 bg-gray-50/50 rounded border border-dashed border-gray-200 text-center">
                                (Blank)
                              </div>
                            )
                          ) : (
                            <input
                              type="text"
                              value={row.vender}
                              onChange={e => updateRow(idx, 'vender', e.target.value)}
                              className="w-full text-xs border border-gray-300 rounded px-2 py-1 bg-white font-sans"
                            />
                          )}
                        </td>

                        {/* 12. DEPARTURE */}
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            value={row.departure}
                            onChange={e => updateRow(idx, 'departure', e.target.value)}
                            className="w-full text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                          />
                        </td>

                        {/* 13. ARRIVAL */}
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            value={row.arrival}
                            onChange={e => updateRow(idx, 'arrival', e.target.value)}
                            className="w-full text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                          />
                        </td>

                        {/* Action */}
                        <td className="px-2 py-2 text-center">
                          <button
                            onClick={() => handleRemoveRow(idx)}
                            className="text-gray-400 hover:text-red-600 transition-colors p-1 cursor-pointer"
                            title="Remove row"
                          >
                            <i className="ti ti-trash text-sm" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Total Summary Footer Bar */}
            <div className="bg-gray-900 text-white p-3 rounded-xl flex flex-wrap items-center justify-between gap-4 text-xs font-bold shadow-md">
              <div className="flex items-center gap-2">
                <i className="ti ti-calculator text-emerald-400 text-base" />
                <span>TOTALS ({rows.length} PASSENGERS):</span>
              </div>
              <div className="flex flex-wrap items-center gap-4 sm:gap-6 font-mono">
                <div>
                  <span className="text-gray-400 text-[11px]">BASIC: </span>
                  <span className="text-amber-400">PKR {totalBasic.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-400 text-[11px]">TAXES: </span>
                  <span className="text-gray-300">PKR {totalTaxes.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-400 text-[11px]">C.P (COST): </span>
                  <span className="text-red-400">PKR {totalCp.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-400 text-[11px]">S.P (SALE): </span>
                  <span className="text-emerald-400">PKR {totalSp.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-400 text-[11px]">PROFIT: </span>
                  <span className={totalProfit >= 0 ? "text-teal-300 font-extrabold" : "text-red-300 font-extrabold"}>
                    PKR {totalProfit.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer with Actions */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeHeadersInCopy}
                onChange={e => setIncludeHeadersInCopy(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
              />
              <span>Include Column Headers in Copy</span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCopyWhatsApp}
              className="px-4 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
              title={`Copy WhatsApp summary for all ${rows.length} passengers`}
            >
              <i className="ti ti-brand-whatsapp text-sm text-emerald-600" />
              Copy WhatsApp ({rows.length} Pax)
            </button>

            <button
              onClick={handleDownloadCsv}
              className="px-4 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
              title={`Download CSV file containing all ${rows.length} passenger rows`}
            >
              <i className="ti ti-file-spreadsheet text-sm text-blue-600" />
              Download CSV ({rows.length} Rows)
            </button>

            <button
              onClick={handleCopyForExcel}
              className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 rounded-lg transition-all flex items-center gap-2 shadow-md hover:shadow-lg transform active:scale-95 cursor-pointer"
              title={`Copy ${rows.length} data rows (without column headers) for direct Ctrl+V in Excel`}
            >
              <i className="ti ti-copy text-sm" />
              Copy Data Rows for Excel (Ctrl+V)
            </button>
          </div>
        </div>

      </div>

      {/* Multiline Ticket Paste Sub-Modal */}
      {showPasteTicketModal && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <i className="ti ti-clipboard text-emerald-600 text-lg" />
                Paste List of Ticket Numbers
              </h4>
              <button
                onClick={() => setShowPasteTicketModal(false)}
                className="text-gray-400 hover:text-gray-700 text-sm cursor-pointer"
              >
                &times;
              </button>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-2">
                Paste 1 ticket number per line (raw digits like 0652408367802 will auto-format to 065-2408367802).
              </p>
              <textarea
                rows={6}
                value={rawTicketText}
                onChange={e => setRawTicketText(e.target.value)}
                placeholder={`0652408367802\n0652408367803\n0652408367804\n0652408367805`}
                className="w-full text-xs font-mono p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-gray-50"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowPasteTicketModal(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyPastedTickets}
                className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-sm cursor-pointer"
              >
                Assign Ticket Numbers
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
