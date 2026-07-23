import React, { useState, useRef } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import html2pdf from 'html2pdf.js'
import { ColorPdfTemplate, StandardPdfTemplate } from '../components/VoucherTemplates'

// API Key configuration fallback
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || ''

const formatDateFromPicker = (isoStr) => {
  if (!isoStr) return ''
  const parts = isoStr.split('-')
  if (parts.length === 3) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const day = parts[2]
    const mIdx = parseInt(parts[1], 10) - 1
    return `${day}-${months[mIdx] || parts[1]}`
  }
  return isoStr
}

// ── GEMINI AI VISION OCR FOR PACKAGE SHEETS ──
async function scanPackageWithGemini(base64Image, mimeType, userKey) {
  const finalKey = userKey || apiKey

  if (!finalKey) {
    throw new Error('Please configure a valid Gemini API Key in the panel above to use the AI package scanner.')
  }

  const prompt = `You are a travel voucher OCR expert. Analyze this package document/sheet (handwritten or printed) and extract all values into a JSON object matching this structure EXACTLY. Return ONLY raw valid JSON, no Markdown code blocks, no backticks, no explanations.

{
  "sr_no": "",
  "name": "",
  "date": "",
  "adt": 1,
  "child": 0,
  "infant": 0,
  "departure_flight": {
    "airline": "",
    "flight_no": "",
    "sector": "",
    "date": "",
    "dep_time": "",
    "arr_time": ""
  },
  "arrival_flight": {
    "airline": "",
    "flight_no": "",
    "sector": "",
    "date": "",
    "dep_time": "",
    "arr_time": ""
  },
  "visa": {
    "type": "UMRAH",
    "qty": 1,
    "price": 0
  },
  "makkah_hotels": [
    {
      "hotel_name": "",
      "room_qty": 1,
      "room_type": "",
      "check_in": "",
      "check_out": "",
      "nights": 0,
      "night_price": 0
    }
  ],
  "madina_hotels": [
    {
      "hotel_name": "",
      "room_qty": 1,
      "room_type": "",
      "check_in": "",
      "check_out": "",
      "nights": 0,
      "night_price": 0
    }
  ],
  "transportation": {
    "type": "",
    "qty": 1,
    "sector": ""
  },
  "totals": {
    "package_only": "",
    "package_with_ticket": ""
  },
  "comments": ""
}

Rules:
- Read numbers carefully (e.g. ADT, Child, Infant, Night Price, Room Qty).
- Format dates cleanly (e.g. 09-Jun-26, 10-Dec).
- If a section or cell is blank or unreadable, set empty strings "" or 0 for numbers.`

  const cleanMime = (mimeType && mimeType.includes('/')) ? mimeType : 'image/jpeg'

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${finalKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType: cleanMime, data: base64Image } }
          ]
        }],
        generationConfig: {
          temperature: 0
        }
      })
    }
  )

  if (response.ok) {
    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const startIdx = text.indexOf('{')
    const endIdx = text.lastIndexOf('}')
    if (startIdx === -1 || endIdx === -1) {
      throw new Error('No JSON structure found in AI response')
    }
    const cleanJson = text.substring(startIdx, endIdx + 1)
    return JSON.parse(cleanJson)
  }

  const errBody = await response.json().catch(() => ({}))
  const msg = errBody.error?.message || `Google API returned status ${response.status}`
  throw new Error(msg)
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result ? reader.result.split(',')[1] : '')
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── NIGHTS CALCULATION HELPER FROM CHECK IN & CHECK OUT DATES ──
function calculateNightsFromDates(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0

  try {
    const monthMap = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    }

    const parseCustomDate = (str) => {
      if (!str) return null
      const s = String(str).trim()

      // Pattern 1: DD-MM-YY or DD-MM-YYYY (e.g. "20-06-26", "30-06-26", "10-07-26", "14-07-26")
      const matchNumeric = s.match(/^(\d{1,2})[-/\s.]+(\d{1,2})[-/\s.]+(\d{2,4})$/)
      if (matchNumeric) {
        const day = parseInt(matchNumeric[1], 10)
        const month = parseInt(matchNumeric[2], 10) - 1
        let year = parseInt(matchNumeric[3], 10)
        if (year < 100) year = 2000 + year
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          return new Date(year, month, day)
        }
      }

      // Pattern 2: DD-MMM-YY or DD-MMM (e.g. "20-Jun-26", "20-Jun", "30-Jun")
      const matchMonthStr = s.match(/^(\d{1,2})[-/\s.]+([A-Za-z]{3})([-/\s.]+(\d{2,4}))?$/i)
      if (matchMonthStr) {
        const day = parseInt(matchMonthStr[1], 10)
        const monthStr = matchMonthStr[2].toLowerCase()
        const monthIdx = monthMap[monthStr]
        let year = new Date().getFullYear()
        if (matchMonthStr[4]) {
          const yrVal = parseInt(matchMonthStr[4], 10)
          year = yrVal < 100 ? 2000 + yrVal : yrVal
        }
        if (monthIdx !== undefined && !isNaN(day)) {
          return new Date(year, monthIdx, day)
        }
      }

      // Pattern 3: Standard Date.parse
      const parsed = Date.parse(s)
      if (!isNaN(parsed)) return new Date(parsed)

      return null
    }

    const d1 = parseCustomDate(checkIn)
    const d2 = parseCustomDate(checkOut)

    if (d1 && d2) {
      if (d2 < d1 && d2.getMonth() < d1.getMonth()) {
        d2.setFullYear(d1.getFullYear() + 1)
      }
      const diffMs = d2.getTime() - d1.getTime()
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
      return diffDays > 0 ? diffDays : 0
    }
  } catch (e) {
    console.error('Date parsing error:', e)
  }

  return 0
}

export default function Package() {
  // ── FORM STATE (Initialized empty by default so placeholders show) ──
  const [header, setHeader] = useState({
    sr_no: '',
    name: '',
    date: '',
  })

  const [pax, setPax] = useState({
    adt: '',
    child: '',
    infant: '',
  })

  const [depFlight, setDepFlight] = useState({
    airline: '',
    flight_no: '',
    sector: '',
    date: '',
    dep_time: '',
    arr_time: '',
  })

  const [arrFlight, setArrFlight] = useState({
    airline: '',
    flight_no: '',
    sector: '',
    date: '',
    dep_time: '',
    arr_time: '',
  })

  const [visa, setVisa] = useState({
    type: '',
    qty: '',
    price: '',
  })

  const [makkahHotels, setMakkahHotels] = useState([
    { hotel_name: '', room_qty: '', room_type: '', check_in: '', check_out: '', nights: '', night_price: '' }
  ])

  const [madinaHotels, setMadinaHotels] = useState([
    { hotel_name: '', room_qty: '', room_type: '', check_in: '', check_out: '', nights: '', night_price: '' }
  ])

  const [transportRows, setTransportRows] = useState([
    { type: '', qty: '', sector: '', price: '' }
  ])

  const [hidePdfBreakup, setHidePdfBreakup] = useState(false)

  const [totals, setTotals] = useState({
    package_only: '',
    package_with_ticket: '',
  })

  const [comments, setComments] = useState('')

  // ── SCANNING & UI CONTROLS ──
  const [activeTab, setActiveTab] = useState('form') // form | upload | capture
  const [scanning, setScanning] = useState(false)
  const [previewImg, setPreviewImg] = useState(null)
  const [userApiKey, setUserApiKey] = useState(apiKey || '')
  const [showKeyInput, setShowKeyInput] = useState(!apiKey)
  const [showPrintModal, setShowPrintModal] = useState(false) // false | 'standard' | 'color'

  const fileRef = useRef(null)
  const videoRef = useRef(null)
  const [cameraStream, setCameraStream] = useState(null)
  const [cameraOpen, setCameraOpen] = useState(false)

  // Auto-calculated totals
  const totalPax = Number(pax.adt || 0) + Number(pax.child || 0) + Number(pax.infant || 0)

  const applyScannedData = (data) => {
    if (!data) return
    if (data.sr_no !== undefined) setHeader(h => ({ ...h, sr_no: data.sr_no }))
    if (data.name) setHeader(h => ({ ...h, name: data.name }))
    if (data.date) setHeader(h => ({ ...h, date: data.date }))

    if (data.adt !== undefined || data.child !== undefined || data.infant !== undefined) {
      setPax({
        adt: data.adt ?? pax.adt,
        child: data.child ?? pax.child,
        infant: data.infant ?? pax.infant,
      })
    }

    if (data.departure_flight) setDepFlight(df => ({ ...df, ...data.departure_flight }))
    if (data.arrival_flight) setArrFlight(af => ({ ...af, ...data.arrival_flight }))
    if (data.visa) setVisa(v => ({ ...v, ...data.visa }))

    if (Array.isArray(data.makkah_hotels) && data.makkah_hotels.length > 0) {
      const processedMakkah = data.makkah_hotels.map(h => {
        const calcN = calculateNightsFromDates(h.check_in, h.check_out)
        const nightsVal = Number(h.nights) > 0 ? String(h.nights) : (calcN > 0 ? String(calcN) : (h.nights || ''))
        return { ...h, nights: nightsVal }
      })
      setMakkahHotels(processedMakkah)
    }
    if (Array.isArray(data.madina_hotels) && data.madina_hotels.length > 0) {
      const processedMadina = data.madina_hotels.map(h => {
        const calcN = calculateNightsFromDates(h.check_in, h.check_out)
        const nightsVal = Number(h.nights) > 0 ? String(h.nights) : (calcN > 0 ? String(calcN) : (h.nights || ''))
        return { ...h, nights: nightsVal }
      })
      setMadinaHotels(processedMadina)
    }
    if (data.transportation) {
      setTransportRows([{
        type: data.transportation.type || '',
        qty: data.transportation.qty || '',
        sector: data.transportation.sector || '',
        price: data.transportation.price || ''
      }])
    }
    if (data.totals) {
      setTotals(t => ({
        package_only: data.totals.package_only ?? t.package_only,
        package_with_ticket: data.totals.package_with_ticket ?? t.package_with_ticket
      }))
    }
    if (data.total_package_only !== undefined) setTotals(t => ({ ...t, package_only: data.total_package_only }))
    if (data.total_package_with_ticket !== undefined) setTotals(t => ({ ...t, package_with_ticket: data.total_package_with_ticket }))
    if (data.comments !== undefined) setComments(data.comments)

    toast.success('Package sheet extracted successfully with AI!', { id: 'ai-scan-success' })
  }

  const processImage = async (file) => {
    if (!file) return
    setScanning(true)
    setPreviewImg(URL.createObjectURL(file))
    try {
      const base64 = await fileToBase64(file)
      const data = await scanPackageWithGemini(base64, file.type, userApiKey)
      applyScannedData(data)
    } catch (e) {
      console.error('Package OCR error:', e)
      toast.error(`OCR failed: ${e.message || 'Check image clarity.'}`, { id: 'ocr-err' })
    } finally {
      setScanning(false)
    }
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (file) processImage(file)
  }

  const openCamera = async () => {
    setCameraOpen(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })
      setCameraStream(stream)
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream
      }, 100)
    } catch (e) {
      toast.error('Camera access denied', { id: 'cam-denied' })
      setCameraOpen(false)
    }
  }

  const capturePhoto = () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      const file = new File([blob], 'package-sheet.jpg', { type: 'image/jpeg' })
      stopCamera()
      processImage(file)
    }, 'image/jpeg', 0.95)
  }

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop())
      setCameraStream(null)
    }
    setCameraOpen(false)
  }

  // Row helper triggers
  const addMakkahRow = () => {
    setMakkahHotels(prev => [...prev, { hotel_name: '', room_qty: '', room_type: '', check_in: '', check_out: '', nights: '', night_price: '' }])
  }
  const removeMakkahRow = (idx) => {
    setMakkahHotels(prev => prev.filter((_, i) => i !== idx))
  }

  const addMadinaRow = () => {
    setMadinaHotels(prev => [...prev, { hotel_name: '', room_qty: '', room_type: '', check_in: '', check_out: '', nights: '', night_price: '' }])
  }
  const removeMadinaRow = (idx) => {
    setMadinaHotels(prev => prev.filter((_, i) => i !== idx))
  }

  const addTransportRow = () => {
    setTransportRows(prev => [...prev, { type: '', qty: '', sector: '', price: '' }])
  }
  const removeTransportRow = (idx) => {
    setTransportRows(prev => prev.filter((_, i) => i !== idx))
  }

  const handleClearForm = () => {
    setHeader({ sr_no: '', name: '', date: '' })
    setPax({ adt: '', child: '', infant: '' })
    setDepFlight({ airline: '', flight_no: '', sector: '', date: '', dep_time: '', arr_time: '' })
    setArrFlight({ airline: '', flight_no: '', sector: '', date: '', dep_time: '', arr_time: '' })
    setVisa({ type: '', qty: '', price: '' })
    setMakkahHotels([{ hotel_name: '', room_qty: '', room_type: '', check_in: '', check_out: '', nights: '', night_price: '' }])
    setMadinaHotels([{ hotel_name: '', room_qty: '', room_type: '', check_in: '', check_out: '', nights: '', night_price: '' }])
    setTransportRows([{ type: '', qty: '', sector: '', price: '' }])
    setTotals({ package_only: '', package_with_ticket: '' })
    setComments('')
    setPreviewImg(null)
    toast.success('Form cleared successfully', { id: 'clear-form' })
  }

  const handlePrint = () => {
    window.print()
  }

  const handleSavePdf = async () => {
    const elementId = showPrintModal === 'color' ? 'printable-color-package' : 'printable-package'
    const element = document.getElementById(elementId) || document.getElementById('printable-color-package')
    if (!element) return

    const srNo = header?.sr_no || '01'
    const fileName = `travel-package-${srNo}.pdf`

    const options = {
      margin:        5,
      filename:      fileName,
      image:         { type: 'jpeg', quality: 0.98 },
      html2canvas:   { scale: 2, useCORS: true, logging: false },
      jsPDF:         { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }

    try {
      // Generate PDF blob explicitly
      const worker = html2pdf().from(element).set(options)
      const pdfBlob = await worker.output('blob')

      // Create explicit application/pdf Blob and anchor element with filename
      const blob = new Blob([pdfBlob], { type: 'application/pdf' })
      const blobUrl = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = blobUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()

      // Clean up DOM and memory
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 3000)
    } catch (err) {
      console.error('PDF generation error:', err)
      window.print()
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-50 text-gray-900 antialiased font-sans">
      <Toaster position="top-right" />
      <main className="flex-1 overflow-y-auto max-w-5xl w-full mx-auto p-4 sm:p-5 pb-16 space-y-4">
        
        {/* Top Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div>
            <h1 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <i className="ti ti-package text-indigo-600 text-lg" />
              Package Creation & AI Scanner
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Fill manually or upload a handwritten/printed package document image to extract with AI and export to PDF.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowPrintModal('standard')}
              className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-semibold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
              title="Print standard black & white grid quotation sheet"
            >
              <i className="ti ti-printer text-sm text-gray-500" />
              Standard Print / PDF
            </button>
            <button
              onClick={() => setShowPrintModal('color')}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
              title="Print modern high-DPI colored travel itinerary voucher"
            >
              <i className="ti ti-palette text-sm" />
              Color PDF Print
            </button>
          </div>
        </div>

        {/* Gemini API Key Panel */}
        {showKeyInput && (
          <div className="bg-gradient-to-r from-amber-50 to-amber-100/50 border border-amber-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-amber-900 flex items-center gap-1.5">
                  <i className="ti ti-key text-amber-700" />
                  Gemini AI Vision Configuration
                </h4>
                <p className="text-xs text-amber-700 leading-relaxed max-w-xl">
                  An API key is required to perform AI OCR extraction from handwritten/printed package sheets.
                </p>
              </div>
              <button 
                onClick={() => setShowKeyInput(false)}
                className="text-amber-500 hover:text-amber-800 text-xs font-semibold"
              >
                Dismiss
              </button>
            </div>
            <div className="mt-3 flex gap-2 max-w-md">
              <input 
                type="password"
                value={userApiKey}
                onChange={(e) => setUserApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full text-xs px-3 py-2 border border-amber-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
              />
              <button 
                onClick={() => {
                  toast.success("API Key configured for AI scanning", { id: 'key-save' })
                  setShowKeyInput(false)
                }}
                className="bg-amber-800 text-white text-xs font-medium px-4 py-2 rounded-lg hover:bg-amber-900 transition-colors shrink-0"
              >
                Save Key
              </button>
            </div>
          </div>
        )}

        {/* Input Method Selector (Form / Upload / Camera) */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-50 p-2 rounded-xl border border-gray-200">
            <div className="flex flex-wrap gap-1 items-center">
              <button
                onClick={() => setActiveTab('form')}
                className={`flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg transition-all ${
                  activeTab === 'form' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:text-indigo-600'
                }`}
              >
                <i className="ti ti-edit text-sm" />
                Manual Form
              </button>
              <button
                onClick={handleClearForm}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg text-gray-600 hover:text-red-600 hover:bg-white border border-gray-200 transition-all shadow-sm"
                title="Clear all form fields back to empty"
              >
                <i className="ti ti-rotate-ccw text-sm" />
                Clear Form
              </button>
              <button
                onClick={() => { setActiveTab('upload'); fileRef.current?.click() }}
                className={`flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg transition-all ${
                  activeTab === 'upload' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:text-indigo-600'
                }`}
              >
                <i className="ti ti-upload text-sm" />
                Upload Sheet Image
              </button>
              <button
                onClick={() => { setActiveTab('capture'); openCamera() }}
                className={`flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg transition-all ${
                  activeTab === 'capture' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:text-indigo-600'
                }`}
              >
                <i className="ti ti-camera text-sm" />
                Live Camera Capture
              </button>
            </div>

            {!showKeyInput && (
              <button 
                onClick={() => setShowKeyInput(true)}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 px-2 py-1"
              >
                <i className="ti ti-settings" />
                Configure Key
              </button>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />

          {/* Live Camera View */}
          {cameraOpen && (
            <div className="rounded-xl overflow-hidden border border-gray-200 relative bg-black shadow-inner">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full max-h-80 mx-auto object-contain"
              />
              <div className="flex gap-2 justify-center p-3 bg-gray-900 border-t border-gray-800">
                <button 
                  onClick={capturePhoto} 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"
                >
                  <i className="ti ti-camera text-sm" />
                  Capture & AI Scan Package
                </button>
                <button 
                  onClick={stopCamera} 
                  className="bg-gray-700 hover:bg-gray-600 text-white font-medium text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"
                >
                  <i className="ti ti-x text-sm" />
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Scanning indicator */}
          {scanning && (
            <div className="flex items-center gap-3 text-sm text-indigo-800 bg-indigo-50 border border-indigo-100 px-4 py-3 rounded-lg animate-pulse">
              <i className="ti ti-loader animate-spin text-lg" />
              <span>Analyzing handwritten/printed package voucher sheet layout with Gemini AI...</span>
            </div>
          )}

          {/* Image Preview */}
          {previewImg && !cameraOpen && (
            <div className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-200 p-2.5 rounded-lg">
              <div className="flex items-center gap-3">
                <img src={previewImg} alt="Package source sheet" className="h-14 w-20 object-cover rounded border border-gray-300 shadow-inner" />
                <div className="text-xs text-gray-600">
                  <p className="font-semibold text-emerald-600 flex items-center gap-1">
                    <i className="ti ti-circle-check" /> Extracted Image to Form Below
                  </p>
                  <p className="text-gray-400 mt-0.5">Review and modify fields as needed.</p>
                </div>
              </div>
              <button 
                onClick={() => setPreviewImg(null)}
                className="text-gray-400 hover:text-red-500 text-xs px-2 py-1"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>

        {/* ── FORM CONTAINER MATCHING USER IMAGE GRID EXACTLY ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm space-y-6">
          
          {/* Header Row: SR # | NAME | DATE */}
          <div className="border border-gray-900 rounded-lg overflow-hidden font-mono text-xs">
            <div className="grid grid-cols-6 divide-x divide-y md:divide-y-0 divide-gray-900 text-center font-bold bg-gray-50 border-b border-gray-900">
              <div className="p-2 bg-gray-100 text-gray-900 col-span-1">SR #</div>
              <div className="p-2 bg-gray-100 text-gray-900 col-span-1">NAME</div>
              <div className="p-2 bg-white col-span-2">
                <input
                  type="text"
                  value={header.name}
                  onChange={(e) => setHeader({ ...header, name: e.target.value.toUpperCase() })}
                  placeholder="NAME"
                  className="w-full text-center font-bold text-indigo-900 uppercase focus:outline-none"
                />
              </div>
              <div className="p-2 bg-gray-100 text-gray-900 col-span-1">DATE</div>
              <div className="p-2 bg-white col-span-1">
                <input
                  type="text"
                  value={header.date}
                  onChange={(e) => setHeader({ ...header, date: e.target.value.toUpperCase() })}
                  placeholder="DATE"
                  className="w-full text-center font-bold text-gray-900 focus:outline-none"
                />
              </div>
            </div>

            {/* Sub-row for SR # Input */}
            <div className="grid grid-cols-6 divide-x divide-gray-900 text-center border-b border-gray-900">
              <div className="p-2 bg-white col-span-1">
                <input
                  type="text"
                  value={header.sr_no}
                  onChange={(e) => setHeader({ ...header, sr_no: e.target.value })}
                  placeholder="SR #"
                  className="w-full text-center text-gray-800 focus:outline-none font-semibold"
                />
              </div>
              <div className="col-span-5 bg-gray-50/50"></div>
            </div>

            {/* Passenger Counts Row: ADT | CHILD | INFANT | TOTAL */}
            <div className="grid grid-cols-4 divide-x divide-gray-900 text-center font-bold bg-gray-100 border-b border-gray-900">
              <div className="p-2">ADT</div>
              <div className="p-2">CHILD</div>
              <div className="p-2">INFANT</div>
              <div className="p-2 bg-indigo-50 text-indigo-900">TOTAL</div>
            </div>
            <div className="grid grid-cols-4 divide-x divide-gray-900 text-center bg-white border-b border-gray-900">
              <div className="p-2">
                <input
                  type="number"
                  min="0"
                  value={pax.adt}
                  onChange={(e) => setPax({ ...pax, adt: e.target.value })}
                  placeholder="ADT"
                  className="w-full text-center font-semibold focus:outline-none"
                />
              </div>
              <div className="p-2">
                <input
                  type="number"
                  min="0"
                  value={pax.child}
                  onChange={(e) => setPax({ ...pax, child: e.target.value })}
                  placeholder="CHILD"
                  className="w-full text-center font-semibold focus:outline-none"
                />
              </div>
              <div className="p-2">
                <input
                  type="number"
                  min="0"
                  value={pax.infant}
                  onChange={(e) => setPax({ ...pax, infant: e.target.value })}
                  placeholder="INFANT"
                  className="w-full text-center font-semibold focus:outline-none"
                />
              </div>
              <div className="p-2 font-bold text-indigo-900 bg-indigo-50/50 flex items-center justify-center">
                {totalPax}
              </div>
            </div>

            {/* ── FLIGHT DETAILS SECTION ── */}
            <div className="bg-gray-100 text-gray-900 text-center p-2 font-bold tracking-wider border-b border-gray-900 uppercase">
              FLIGHT DETAILS
            </div>
            <div className="grid grid-cols-7 divide-x divide-gray-900 text-center font-bold bg-gray-50 border-b border-gray-900 text-[11px]">
              <div className="p-1.5 col-span-1">#</div>
              <div className="p-1.5 col-span-1">AIRLINE</div>
              <div className="p-1.5 col-span-1">FLIGHT #</div>
              <div className="p-1.5 col-span-2">SECTOR</div>
              <div className="p-1.5 col-span-1">DATE</div>
              <div className="p-1.5 col-span-1">TIME (DEP / ARR)</div>
            </div>
            
            {/* Departure Row */}
            <div className="grid grid-cols-7 divide-x divide-gray-900 text-center border-b border-gray-900 bg-white">
              <div className="p-2 font-bold text-gray-700 bg-gray-50 col-span-1 flex items-center justify-center">1</div>
              <div className="p-2 col-span-1">
                <input type="text" value={depFlight.airline} onChange={(e) => setDepFlight({...depFlight, airline: e.target.value.toUpperCase()})} placeholder="AIRLINE" className="w-full text-center uppercase focus:outline-none" />
              </div>
              <div className="p-2 col-span-1">
                <input type="text" value={depFlight.flight_no} onChange={(e) => setDepFlight({...depFlight, flight_no: e.target.value})} placeholder="FLIGHT #" className="w-full text-center focus:outline-none" />
              </div>
              <div className="p-2 col-span-2">
                <input type="text" value={depFlight.sector} onChange={(e) => setDepFlight({...depFlight, sector: e.target.value.toUpperCase()})} placeholder="SECTOR" className="w-full text-center uppercase focus:outline-none font-semibold text-indigo-900" />
              </div>
              <div className="p-2 col-span-1">
                <input type="text" value={depFlight.date} onChange={(e) => setDepFlight({...depFlight, date: e.target.value.toUpperCase()})} placeholder="DATE" className="w-full text-center focus:outline-none" />
              </div>
              <div className="p-2 col-span-1 flex items-center justify-center gap-1 text-[11px]">
                <input type="text" value={depFlight.dep_time} onChange={(e) => setDepFlight({...depFlight, dep_time: e.target.value})} placeholder="DEP TIME" className="w-12 text-center focus:outline-none" />
                <span>/</span>
                <input type="text" value={depFlight.arr_time} onChange={(e) => setDepFlight({...depFlight, arr_time: e.target.value})} placeholder="ARR TIME" className="w-12 text-center focus:outline-none" />
              </div>
            </div>

            {/* Arrival Row */}
            <div className="grid grid-cols-7 divide-x divide-gray-900 text-center border-b border-gray-900 bg-white">
              <div className="p-2 font-bold text-gray-700 bg-gray-50 col-span-1 flex items-center justify-center">2</div>
              <div className="p-2 col-span-1">
                <input type="text" value={arrFlight.airline} onChange={(e) => setArrFlight({...arrFlight, airline: e.target.value.toUpperCase()})} placeholder="AIRLINE" className="w-full text-center uppercase focus:outline-none" />
              </div>
              <div className="p-2 col-span-1">
                <input type="text" value={arrFlight.flight_no} onChange={(e) => setArrFlight({...arrFlight, flight_no: e.target.value})} placeholder="FLIGHT #" className="w-full text-center focus:outline-none" />
              </div>
              <div className="p-2 col-span-2">
                <input type="text" value={arrFlight.sector} onChange={(e) => setArrFlight({...arrFlight, sector: e.target.value.toUpperCase()})} placeholder="SECTOR" className="w-full text-center uppercase focus:outline-none font-semibold text-indigo-900" />
              </div>
              <div className="p-2 col-span-1">
                <input type="text" value={arrFlight.date} onChange={(e) => setArrFlight({...arrFlight, date: e.target.value.toUpperCase()})} placeholder="DATE" className="w-full text-center focus:outline-none" />
              </div>
              <div className="p-2 col-span-1 flex items-center justify-center gap-1 text-[11px]">
                <input type="text" value={arrFlight.dep_time} onChange={(e) => setArrFlight({...arrFlight, dep_time: e.target.value})} placeholder="DEP TIME" className="w-12 text-center focus:outline-none" />
                <span>/</span>
                <input type="text" value={arrFlight.arr_time} onChange={(e) => setArrFlight({...arrFlight, arr_time: e.target.value})} placeholder="ARR TIME" className="w-12 text-center focus:outline-none" />
              </div>
            </div>

            {/* ── VISA DETAILS SECTION ── */}
            <div className="bg-gray-100 text-gray-900 text-center p-2 font-bold tracking-wider border-b border-gray-900 uppercase">
              VISA DETAILS
            </div>
            <div className="grid grid-cols-3 divide-x divide-gray-900 text-center font-bold bg-gray-50 border-b border-gray-900">
              <div className="p-2">VISA TYPE</div>
              <div className="p-2">VISA QTY</div>
              <div className="p-2">VISA PRICE</div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-gray-900 text-center bg-white border-b border-gray-900">
              <div className="p-2">
                <input type="text" value={visa.type} onChange={(e) => setVisa({...visa, type: e.target.value.toUpperCase()})} placeholder="VISA" className="w-full text-center font-semibold uppercase focus:outline-none" />
              </div>
              <div className="p-2">
                <input type="number" min="0" value={visa.qty} onChange={(e) => setVisa({...visa, qty: e.target.value})} placeholder="VISA QTY" className="w-full text-center focus:outline-none" />
              </div>
              <div className="p-2">
                <input type="number" min="0" value={visa.price} onChange={(e) => setVisa({...visa, price: e.target.value})} placeholder="VISA PRICE" className="w-full text-center focus:outline-none" />
              </div>
            </div>

            {/* ── HOTEL DETAILS SECTION ── */}
            <div className="bg-gray-100 text-gray-900 text-center p-2 font-bold tracking-wider border-b border-gray-900 uppercase">
              HOTEL DETAILS
            </div>
            <div className="grid grid-cols-7 divide-x divide-gray-900 text-center font-bold bg-gray-50 border-b border-gray-900 text-[11px]">
              <div className="p-1.5 col-span-2">MAKKAH HOTEL</div>
              <div className="p-1.5 col-span-1">ROOM QTY</div>
              <div className="p-1.5 col-span-1">ROOM TYPE</div>
              <div className="p-1.5 col-span-1">CHECK IN</div>
              <div className="p-1.5 col-span-1">CHECK OUT</div>
              <div className="p-1.5 col-span-1">NIGHTS / PRICE</div>
            </div>

            {/* Makkah Hotels Rows */}
            {makkahHotels.map((h, i) => (
              <div key={`makkah-${i}`} className="grid grid-cols-7 divide-x divide-gray-900 text-center border-b border-gray-900 bg-white">
                <div className="p-2 col-span-2 flex items-center gap-1">
                  <input
                    type="text"
                    value={h.hotel_name}
                    onChange={(e) => {
                      const updated = [...makkahHotels]
                      updated[i].hotel_name = e.target.value.toUpperCase()
                      setMakkahHotels(updated)
                    }}
                    placeholder="MAKKAH HOTEL"
                    className="w-full font-semibold uppercase focus:outline-none"
                  />
                </div>
                <div className="p-2 col-span-1">
                  <input
                    type="number"
                    min="0"
                    value={h.room_qty}
                    onChange={(e) => {
                      const updated = [...makkahHotels]
                      updated[i].room_qty = e.target.value
                      setMakkahHotels(updated)
                    }}
                    placeholder="ROOM QTY"
                    className="w-full text-center focus:outline-none"
                  />
                </div>
                <div className="p-2 col-span-1">
                  <input
                    type="text"
                    value={h.room_type}
                    onChange={(e) => {
                      const updated = [...makkahHotels]
                      updated[i].room_type = e.target.value.toUpperCase()
                      setMakkahHotels(updated)
                    }}
                    placeholder="ROOM TYPE"
                    className="w-full text-center uppercase focus:outline-none"
                  />
                </div>
                <div className="p-2 col-span-1">
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={h.check_in}
                      onChange={(e) => {
                        const updated = [...makkahHotels]
                        updated[i].check_in = e.target.value.toUpperCase()
                        const calcN = calculateNightsFromDates(e.target.value, updated[i].check_out)
                        if (calcN > 0) updated[i].nights = String(calcN)
                        setMakkahHotels(updated)
                      }}
                      placeholder="CHECK IN"
                      className="w-full text-center focus:outline-none pr-5 text-xs"
                    />
                    <div className="absolute right-1 pointer-events-none text-gray-400">
                      <i className="ti ti-calendar text-xs" />
                    </div>
                    <input
                      type="date"
                      className="absolute right-0 top-0 bottom-0 w-6 opacity-0 cursor-pointer z-10"
                      onChange={(e) => {
                        if (e.target.value) {
                          const updated = [...makkahHotels]
                          updated[i].check_in = formatDateFromPicker(e.target.value).toUpperCase()
                          const calcN = calculateNightsFromDates(updated[i].check_in, updated[i].check_out)
                          if (calcN > 0) updated[i].nights = String(calcN)
                          setMakkahHotels(updated)
                        }
                      }}
                      title="Select Check In date"
                    />
                  </div>
                </div>
                <div className="p-2 col-span-1">
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={h.check_out}
                      onChange={(e) => {
                        const updated = [...makkahHotels]
                        updated[i].check_out = e.target.value.toUpperCase()
                        const calcN = calculateNightsFromDates(updated[i].check_in, e.target.value)
                        if (calcN > 0) updated[i].nights = String(calcN)
                        setMakkahHotels(updated)
                      }}
                      placeholder="CHECK OUT"
                      className="w-full text-center focus:outline-none pr-5 text-xs"
                    />
                    <div className="absolute right-1 pointer-events-none text-gray-400">
                      <i className="ti ti-calendar text-xs" />
                    </div>
                    <input
                      type="date"
                      className="absolute right-0 top-0 bottom-0 w-6 opacity-0 cursor-pointer z-10"
                      onChange={(e) => {
                        if (e.target.value) {
                          const updated = [...makkahHotels]
                          updated[i].check_out = formatDateFromPicker(e.target.value).toUpperCase()
                          const calcN = calculateNightsFromDates(updated[i].check_in, updated[i].check_out)
                          if (calcN > 0) updated[i].nights = String(calcN)
                          setMakkahHotels(updated)
                        }
                      }}
                      title="Select Check Out date"
                    />
                  </div>
                </div>
                <div className="p-2 col-span-1 flex items-center justify-center gap-1 text-[11px]">
                  <input
                    type="number"
                    min="0"
                    value={h.nights}
                    onChange={(e) => {
                      const updated = [...makkahHotels]
                      updated[i].nights = e.target.value
                      setMakkahHotels(updated)
                    }}
                    placeholder="NIGHTS"
                    className="w-8 text-center focus:outline-none font-bold"
                  />
                  <span>/</span>
                  <input
                    type="number"
                    min="0"
                    value={h.night_price}
                    onChange={(e) => {
                      const updated = [...makkahHotels]
                      updated[i].night_price = e.target.value
                      setMakkahHotels(updated)
                    }}
                    placeholder="NIGHT PRICE"
                    className="w-12 text-center focus:outline-none"
                  />
                </div>
              </div>
            ))}

            {/* Makkah hotel row controls */}
            <div className="p-1.5 bg-gray-50 border-b border-gray-900 flex items-center justify-between text-[11px]">
              <span className="font-semibold text-gray-500">Makkah Hotel Rows ({makkahHotels.length})</span>
              <div className="flex gap-2">
                <button onClick={addMakkahRow} className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1">
                  <i className="ti ti-plus" /> Add Makkah Row
                </button>
                {makkahHotels.length > 1 && (
                  <button onClick={() => removeMakkahRow(makkahHotels.length - 1)} className="text-red-500 hover:text-red-700 font-semibold">
                    Remove Row
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-7 divide-x divide-gray-900 text-center font-bold bg-gray-50 border-b border-gray-900 text-[11px]">
              <div className="p-1.5 col-span-2">MADINA HOTEL</div>
              <div className="p-1.5 col-span-1">ROOM QTY</div>
              <div className="p-1.5 col-span-1">ROOM TYPE</div>
              <div className="p-1.5 col-span-1">CHECK IN</div>
              <div className="p-1.5 col-span-1">CHECK OUT</div>
              <div className="p-1.5 col-span-1">NIGHTS / PRICE</div>
            </div>

            {/* Madina Hotels Rows */}
            {madinaHotels.map((h, i) => (
              <div key={`madina-${i}`} className="grid grid-cols-7 divide-x divide-gray-900 text-center border-b border-gray-900 bg-white">
                <div className="p-2 col-span-2 flex items-center gap-1">
                  <input
                    type="text"
                    value={h.hotel_name}
                    onChange={(e) => {
                      const updated = [...madinaHotels]
                      updated[i].hotel_name = e.target.value.toUpperCase()
                      setMadinaHotels(updated)
                    }}
                    placeholder="MADINA HOTEL"
                    className="w-full font-semibold uppercase focus:outline-none"
                  />
                </div>
                <div className="p-2 col-span-1">
                  <input
                    type="number"
                    min="0"
                    value={h.room_qty}
                    onChange={(e) => {
                      const updated = [...madinaHotels]
                      updated[i].room_qty = e.target.value
                      setMadinaHotels(updated)
                    }}
                    placeholder="ROOM QTY"
                    className="w-full text-center focus:outline-none"
                  />
                </div>
                <div className="p-2 col-span-1">
                  <input
                    type="text"
                    value={h.room_type}
                    onChange={(e) => {
                      const updated = [...madinaHotels]
                      updated[i].room_type = e.target.value.toUpperCase()
                      setMadinaHotels(updated)
                    }}
                    placeholder="ROOM TYPE"
                    className="w-full text-center uppercase focus:outline-none"
                  />
                </div>
                <div className="p-2 col-span-1">
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={h.check_in}
                      onChange={(e) => {
                        const updated = [...madinaHotels]
                        updated[i].check_in = e.target.value.toUpperCase()
                        const calcN = calculateNightsFromDates(e.target.value, updated[i].check_out)
                        if (calcN > 0) updated[i].nights = String(calcN)
                        setMadinaHotels(updated)
                      }}
                      placeholder="CHECK IN"
                      className="w-full text-center focus:outline-none pr-5 text-xs"
                    />
                    <div className="absolute right-1 pointer-events-none text-gray-400">
                      <i className="ti ti-calendar text-xs" />
                    </div>
                    <input
                      type="date"
                      className="absolute right-0 top-0 bottom-0 w-6 opacity-0 cursor-pointer z-10"
                      onChange={(e) => {
                        if (e.target.value) {
                          const updated = [...madinaHotels]
                          updated[i].check_in = formatDateFromPicker(e.target.value).toUpperCase()
                          const calcN = calculateNightsFromDates(updated[i].check_in, updated[i].check_out)
                          if (calcN > 0) updated[i].nights = String(calcN)
                          setMadinaHotels(updated)
                        }
                      }}
                      title="Select Check In date"
                    />
                  </div>
                </div>
                <div className="p-2 col-span-1">
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={h.check_out}
                      onChange={(e) => {
                        const updated = [...madinaHotels]
                        updated[i].check_out = e.target.value.toUpperCase()
                        const calcN = calculateNightsFromDates(updated[i].check_in, e.target.value)
                        if (calcN > 0) updated[i].nights = String(calcN)
                        setMadinaHotels(updated)
                      }}
                      placeholder="CHECK OUT"
                      className="w-full text-center focus:outline-none pr-5 text-xs"
                    />
                    <div className="absolute right-1 pointer-events-none text-gray-400">
                      <i className="ti ti-calendar text-xs" />
                    </div>
                    <input
                      type="date"
                      className="absolute right-0 top-0 bottom-0 w-6 opacity-0 cursor-pointer z-10"
                      onChange={(e) => {
                        if (e.target.value) {
                          const updated = [...madinaHotels]
                          updated[i].check_out = formatDateFromPicker(e.target.value).toUpperCase()
                          const calcN = calculateNightsFromDates(updated[i].check_in, updated[i].check_out)
                          if (calcN > 0) updated[i].nights = String(calcN)
                          setMadinaHotels(updated)
                        }
                      }}
                      title="Select Check Out date"
                    />
                  </div>
                </div>
                <div className="p-2 col-span-1 flex items-center justify-center gap-1 text-[11px]">
                  <input
                    type="number"
                    min="0"
                    value={h.nights}
                    onChange={(e) => {
                      const updated = [...madinaHotels]
                      updated[i].nights = e.target.value
                      setMadinaHotels(updated)
                    }}
                    placeholder="NIGHTS"
                    className="w-8 text-center focus:outline-none font-bold"
                  />
                  <span>/</span>
                  <input
                    type="number"
                    min="0"
                    value={h.night_price}
                    onChange={(e) => {
                      const updated = [...madinaHotels]
                      updated[i].night_price = e.target.value
                      setMadinaHotels(updated)
                    }}
                    placeholder="NIGHT PRICE"
                    className="w-12 text-center focus:outline-none"
                  />
                </div>
              </div>
            ))}

            {/* Madina hotel row controls */}
            <div className="p-1.5 bg-gray-50 border-b border-gray-900 flex items-center justify-between text-[11px]">
              <span className="font-semibold text-gray-500">Madina Hotel Rows ({madinaHotels.length})</span>
              <div className="flex gap-2">
                <button onClick={addMadinaRow} className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1">
                  <i className="ti ti-plus" /> Add Madina Row
                </button>
                {madinaHotels.length > 1 && (
                  <button onClick={() => removeMadinaRow(madinaHotels.length - 1)} className="text-red-500 hover:text-red-700 font-semibold">
                    Remove Row
                  </button>
                )}
              </div>
            </div>

            {/* ── TRANSPORTATION DETAILS SECTION (MULTI-ROW) ── */}
            <div className="bg-gray-100 text-gray-900 text-center p-2 font-bold tracking-wider border-b border-gray-900 uppercase">
              TRANSPORTATION DETAILS
            </div>
            <div className="grid grid-cols-7 divide-x divide-gray-900 text-center font-bold bg-gray-50 border-b border-gray-900 text-[11px]">
              <div className="p-1.5 col-span-2">TRANSPORTATION TYPE</div>
              <div className="p-1.5 col-span-1">QTY</div>
              <div className="p-1.5 col-span-3">TRANSPORTATION SECTOR</div>
              <div className="p-1.5 col-span-1">PRICE</div>
            </div>
            {transportRows.map((t, i) => (
              <div key={`trans-${i}`} className="grid grid-cols-7 divide-x divide-gray-900 text-center bg-white border-b border-gray-900">
                <div className="p-2 col-span-2">
                  <input
                    type="text"
                    value={t.type}
                    onChange={(e) => {
                      const updated = [...transportRows]
                      updated[i].type = e.target.value.toUpperCase()
                      setTransportRows(updated)
                    }}
                    placeholder="TRANSPORTATION TYPE"
                    className="w-full text-center font-semibold uppercase focus:outline-none"
                  />
                </div>
                <div className="p-2 col-span-1">
                  <input
                    type="number"
                    min="0"
                    value={t.qty}
                    onChange={(e) => {
                      const updated = [...transportRows]
                      updated[i].qty = e.target.value
                      setTransportRows(updated)
                    }}
                    placeholder="QTY"
                    className="w-full text-center focus:outline-none"
                  />
                </div>
                <div className="p-2 col-span-3">
                  <input
                    type="text"
                    value={t.sector}
                    onChange={(e) => {
                      const updated = [...transportRows]
                      updated[i].sector = e.target.value.toUpperCase()
                      setTransportRows(updated)
                    }}
                    placeholder="TRANSPORTATION SECTOR"
                    className="w-full text-center uppercase focus:outline-none font-medium text-gray-700"
                  />
                </div>
                <div className="p-2 col-span-1 flex items-center justify-between">
                  <input
                    type="text"
                    value={t.price}
                    onChange={(e) => {
                      const updated = [...transportRows]
                      updated[i].price = e.target.value
                      setTransportRows(updated)
                    }}
                    placeholder="PRICE"
                    className="w-full text-center focus:outline-none font-bold text-blue-900"
                  />
                  {transportRows.length > 1 && (
                    <button onClick={() => removeTransportRow(i)} className="text-red-500 hover:text-red-700 text-xs px-1">
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Transport row controls */}
            <div className="p-1.5 bg-gray-50 border-b border-gray-900 flex items-center justify-between text-[11px]">
              <span className="font-semibold text-gray-500">Transport Rows ({transportRows.length})</span>
              <button onClick={addTransportRow} className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1">
                <i className="ti ti-plus" /> Add Transport Row
              </button>
            </div>

            {/* ── PACKAGE PRICING & TOTALS SECTION ── */}
            <div className="bg-gray-100 text-gray-900 text-center p-2 font-bold tracking-wider border-b border-gray-900 uppercase">
              PACKAGE PRICING & TOTALS
            </div>
            <div className="grid grid-cols-4 divide-x divide-gray-900 text-center font-bold bg-gray-50 border-b border-gray-900 text-[11px]">
              <div className="p-1.5 col-span-1">TOTAL PACKAGE ONLY</div>
              <div className="p-1.5 col-span-1">AMOUNT</div>
              <div className="p-1.5 col-span-1">TOTAL PACKAGE WITH TICKET</div>
              <div className="p-1.5 col-span-1">AMOUNT</div>
            </div>
            <div className="grid grid-cols-4 divide-x divide-gray-900 text-center bg-white border-b border-gray-900">
              <div className="p-2 col-span-1 font-bold text-gray-700 bg-gray-50 flex items-center justify-center text-[11px]">
                TOTAL PACKAGE ONLY
              </div>
              <div className="p-2 col-span-1">
                <input
                  type="text"
                  value={totals.package_only}
                  onChange={(e) => setTotals({ ...totals, package_only: e.target.value })}
                  placeholder="AMOUNT"
                  className="w-full text-center font-bold text-gray-900 focus:outline-none"
                />
              </div>
              <div className="p-2 col-span-1 font-bold text-indigo-900 bg-indigo-50/50 flex items-center justify-center text-[11px]">
                TOTAL PACKAGE WITH TICKET
              </div>
              <div className="p-2 col-span-1">
                <input
                  type="text"
                  value={totals.package_with_ticket}
                  onChange={(e) => setTotals({ ...totals, package_with_ticket: e.target.value })}
                  placeholder="AMOUNT"
                  className="w-full text-center font-extrabold text-indigo-700 focus:outline-none"
                />
              </div>
            </div>

            {/* ── COMMENT BOX SECTION ── */}
            <div className="bg-gray-100 text-gray-900 text-center p-2 font-bold tracking-wider border-b border-gray-900 uppercase">
              COMMENT BOX
            </div>
            <div className="p-3 bg-white">
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="COMMENT BOX"
                rows="3"
                className="w-full p-2 border border-gray-200 rounded focus:outline-none text-xs font-mono"
              />
            </div>
          </div>

        </div>

      </main>

      {/* ── PRINT / PDF PREVIEW MODAL ── */}
      {showPrintModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-start justify-center p-3 sm:p-6 overflow-y-auto print:p-0 print:bg-white print:static"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPrintModal(false)
          }}
        >
          <div className="bg-white rounded-2xl max-w-4xl w-full p-4 sm:p-6 space-y-4 shadow-2xl my-4 sm:my-8 print:shadow-none print:p-0 print:my-0 print:w-full relative">
            
            {/* Sticky Header Action Bar */}
            <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm flex items-center justify-between border-b border-gray-200 pb-3 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-1 print:hidden">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <i className={showPrintModal === 'color' ? "ti ti-palette text-blue-600 text-lg" : "ti ti-printer text-indigo-600 text-lg"} />
                  {showPrintModal === 'color' ? 'Color Travel Itinerary PDF Preview' : 'Standard Quotation Sheet Preview'}
                </h3>
                <p className="text-xs text-gray-500">Ready to export to PDF or print directly from browser.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 bg-gray-100 border border-gray-200 px-3 py-2 rounded-xl cursor-pointer hover:bg-gray-200 transition-all select-none">
                  <input
                    type="checkbox"
                    checked={hidePdfBreakup}
                    onChange={(e) => setHidePdfBreakup(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <span>Hide Item Breakup Amounts in PDF</span>
                </label>
                <button
                  onClick={handleSavePdf}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md hover:shadow-lg transition-all"
                  title="Save PDF directly to Downloads folder"
                >
                  <i className="ti ti-download text-sm" /> Save PDF Directly
                </button>
                <button
                  onClick={handlePrint}
                  className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
                  title="Open browser print dialog"
                >
                  <i className="ti ti-printer text-sm text-gray-500" /> Print
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all"
                >
                  <i className="ti ti-x text-sm" /> Close
                </button>
              </div>
            </div>

            {/* Print Document Content */}
            <div className="overflow-x-auto max-w-full pb-2">
              {showPrintModal === 'color' ? (
                <ColorPdfTemplate 
                  header={header}
                  pax={pax}
                  totalPax={totalPax}
                  depFlight={depFlight}
                  arrFlight={arrFlight}
                  visa={visa}
                  makkahHotels={makkahHotels}
                  madinaHotels={madinaHotels}
                  transport={transportRows[0] || {}}
                  transportList={transportRows}
                  totals={totals}
                  comments={comments}
                  hideBreakup={hidePdfBreakup}
                />
              ) : (
                <StandardPdfTemplate 
                  header={header}
                  pax={pax}
                  totalPax={totalPax}
                  depFlight={depFlight}
                  arrFlight={arrFlight}
                  visa={visa}
                  makkahHotels={makkahHotels}
                  madinaHotels={madinaHotels}
                  transport={transportRows[0] || {}}
                  transportList={transportRows}
                  totals={totals}
                  comments={comments}
                  hideBreakup={hidePdfBreakup}
                />
              )}
            </div>

            {/* Bottom Footer Action Bar */}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 pt-4 print:hidden">
              <button
                onClick={handleSavePdf}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-md transition-all"
              >
                <i className="ti ti-download text-sm" /> Save PDF Directly
              </button>
              <button
                onClick={handlePrint}
                className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
              >
                <i className="ti ti-printer text-sm text-gray-500" /> Print
              </button>
              <button
                onClick={() => setShowPrintModal(false)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-4 py-2.5 rounded-xl transition-all"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

