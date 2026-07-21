import React, { useState, useRef } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import html2pdf from 'html2pdf.js'

// API Key configuration fallback
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || ''

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
    "package_only": "1,050,000",
    "package_with_ticket": "1,800,000"
  },
  "comments": ""
}

Rules:
- Read numbers carefully (e.g. ADT, Child, Infant, Night Price, Room Qty).
- Format dates cleanly (e.g. 09-Jun-26, 10-Dec).
- If a section or cell is blank or unreadable, set empty strings "" or 0 for numbers.`

  const modelsToTry = [
    'gemini-2.5-flash',
    'gemini-1.5-flash',
    'gemini-2.5-flash-preview-09-2025'
  ]

  let lastError = null

  for (const model of modelsToTry) {
    let response
    const maxRetries = 3
    const backoffDelays = [1000, 2000, 4000]

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${finalKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                role: 'user',
                parts: [
                  { text: prompt },
                  { inlineData: { mimeType: mimeType, data: base64Image } }
                ]
              }],
              generationConfig: {
                temperature: 0,
                responseMimeType: 'application/json'
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

        if (response.status === 404 || response.status === 400) {
          const errBody = await response.json().catch(() => ({}))
          lastError = new Error(errBody.error?.message || `Model ${model} not supported on this endpoint.`)
          break
        }

        const errBody = await response.json().catch(() => ({}))
        lastError = new Error(errBody.error?.message || `HTTP status ${response.status}`)
      } catch (err) {
        lastError = err
        if (attempt === maxRetries - 1) break
      }

      await new Promise(resolve => setTimeout(resolve, backoffDelays[attempt]))
    }
  }

  throw lastError || new Error('All attempted Gemini models failed to scan the package sheet.')
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
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

  const [transport, setTransport] = useState({
    type: '',
    qty: '',
    sector: '',
  })

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
      setMakkahHotels(data.makkah_hotels)
    }
    if (Array.isArray(data.madina_hotels) && data.madina_hotels.length > 0) {
      setMadinaHotels(data.madina_hotels)
    }
    if (data.transportation) setTransport(t => ({ ...t, ...data.transportation }))
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

  const handleClearForm = () => {
    setHeader({ sr_no: '', name: '', date: '' })
    setPax({ adt: '', child: '', infant: '' })
    setDepFlight({ airline: '', flight_no: '', sector: '', date: '', dep_time: '', arr_time: '' })
    setArrFlight({ airline: '', flight_no: '', sector: '', date: '', dep_time: '', arr_time: '' })
    setVisa({ type: '', qty: '', price: '' })
    setMakkahHotels([{ hotel_name: '', room_qty: '', room_type: '', check_in: '', check_out: '', nights: '', night_price: '' }])
    setMadinaHotels([{ hotel_name: '', room_qty: '', room_type: '', check_in: '', check_out: '', nights: '', night_price: '' }])
    setTransport({ type: '', qty: '', sector: '' })
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
              <div className="p-1.5 col-span-1">TYPE</div>
              <div className="p-1.5 col-span-1">AIRLINE</div>
              <div className="p-1.5 col-span-1">FLIGHT #</div>
              <div className="p-1.5 col-span-2">SECTOR</div>
              <div className="p-1.5 col-span-1">DATE</div>
              <div className="p-1.5 col-span-1">TIME (DEP / ARR)</div>
            </div>
            
            {/* Departure Row */}
            <div className="grid grid-cols-7 divide-x divide-gray-900 text-center border-b border-gray-900 bg-white">
              <div className="p-2 font-bold text-gray-700 bg-gray-50 col-span-1 flex items-center justify-center">DEPARTURE</div>
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
              <div className="p-2 font-bold text-gray-700 bg-gray-50 col-span-1 flex items-center justify-center">ARRIVAL</div>
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
                <input type="text" value={visa.type} onChange={(e) => setVisa({...visa, type: e.target.value.toUpperCase()})} placeholder="VISA TYPE" className="w-full text-center font-semibold uppercase focus:outline-none" />
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
                  <input
                    type="text"
                    value={h.check_in}
                    onChange={(e) => {
                      const updated = [...makkahHotels]
                      updated[i].check_in = e.target.value.toUpperCase()
                      setMakkahHotels(updated)
                    }}
                    placeholder="CHECK IN"
                    className="w-full text-center focus:outline-none"
                  />
                </div>
                <div className="p-2 col-span-1">
                  <input
                    type="text"
                    value={h.check_out}
                    onChange={(e) => {
                      const updated = [...makkahHotels]
                      updated[i].check_out = e.target.value.toUpperCase()
                      setMakkahHotels(updated)
                    }}
                    placeholder="CHECK OUT"
                    className="w-full text-center focus:outline-none"
                  />
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
                  <input
                    type="text"
                    value={h.check_in}
                    onChange={(e) => {
                      const updated = [...madinaHotels]
                      updated[i].check_in = e.target.value.toUpperCase()
                      setMadinaHotels(updated)
                    }}
                    placeholder="CHECK IN"
                    className="w-full text-center focus:outline-none"
                  />
                </div>
                <div className="p-2 col-span-1">
                  <input
                    type="text"
                    value={h.check_out}
                    onChange={(e) => {
                      const updated = [...madinaHotels]
                      updated[i].check_out = e.target.value.toUpperCase()
                      setMadinaHotels(updated)
                    }}
                    placeholder="CHECK OUT"
                    className="w-full text-center focus:outline-none"
                  />
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

            {/* ── TRANSPORTATION DETAILS SECTION ── */}
            <div className="bg-gray-100 text-gray-900 text-center p-2 font-bold tracking-wider border-b border-gray-900 uppercase">
              TRANSPORTATION DETAILS
            </div>
            <div className="grid grid-cols-6 divide-x divide-gray-900 text-center font-bold bg-gray-50 border-b border-gray-900 text-[11px]">
              <div className="p-1.5 col-span-2">TRANSPORTATION TYPE</div>
              <div className="p-1.5 col-span-1">QTY</div>
              <div className="p-1.5 col-span-3">TRANSPORTATION SECTOR</div>
            </div>
            <div className="grid grid-cols-6 divide-x divide-gray-900 text-center bg-white border-b border-gray-900">
              <div className="p-2 col-span-2">
                <input
                  type="text"
                  value={transport.type}
                  onChange={(e) => setTransport({ ...transport, type: e.target.value.toUpperCase() })}
                  placeholder="TRANSPORTATION TYPE"
                  className="w-full text-center font-semibold uppercase focus:outline-none"
                />
              </div>
              <div className="p-2 col-span-1">
                <input
                  type="number"
                  min="0"
                  value={transport.qty}
                  onChange={(e) => setTransport({ ...transport, qty: e.target.value })}
                  placeholder="QTY"
                  className="w-full text-center focus:outline-none"
                />
              </div>
              <div className="p-2 col-span-3">
                <input
                  type="text"
                  value={transport.sector}
                  onChange={(e) => setTransport({ ...transport, sector: e.target.value.toUpperCase() })}
                  placeholder="TRANSPORTATION SECTOR"
                  className="w-full text-center uppercase focus:outline-none font-medium text-gray-700"
                />
              </div>
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
                  placeholder="TOTAL PACKAGE ONLY"
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
                  placeholder="TOTAL PACKAGE WITH TICKET"
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
                transport={transport}
                totals={totals}
                comments={comments}
              />
            ) : (
              <div id="printable-package" className="p-4 bg-white border border-gray-900 rounded-lg text-black font-mono text-xs shadow-inner space-y-0">
                
                {/* Header */}
                <div className="text-center font-bold text-sm py-2 border-b-2 border-black bg-gray-100 uppercase tracking-widest">
                  PACKAGE QUOTATION SHEET
                </div>

                <div className="grid grid-cols-6 divide-x divide-y divide-black border-b border-black text-center font-bold text-[11px]">
                  <div className="p-1.5 bg-gray-100 col-span-1">SR #</div>
                  <div className="p-1.5 bg-gray-100 col-span-1">NAME</div>
                  <div className="p-1.5 col-span-2 text-indigo-900 uppercase font-extrabold">{header.name || '-'}</div>
                  <div className="p-1.5 bg-gray-100 col-span-1">DATE</div>
                  <div className="p-1.5 col-span-1">{header.date || '-'}</div>
                </div>

                <div className="grid grid-cols-6 divide-x divide-black border-b border-black text-center text-[11px]">
                  <div className="p-1.5 col-span-1">{header.sr_no || '-'}</div>
                  <div className="col-span-5 bg-gray-50"></div>
                </div>

                {/* Pax count */}
                <div className="grid grid-cols-4 divide-x divide-black border-b border-black text-center font-bold bg-gray-100 text-[11px]">
                  <div className="p-1">ADT</div>
                  <div className="p-1">CHILD</div>
                  <div className="p-1">INFANT</div>
                  <div className="p-1 bg-gray-200">TOTAL</div>
                </div>
                <div className="grid grid-cols-4 divide-x divide-black border-b border-black text-center text-[11px]">
                  <div className="p-1.5">{pax.adt || 0}</div>
                  <div className="p-1.5">{pax.child || 0}</div>
                  <div className="p-1.5">{pax.infant || 0}</div>
                  <div className="p-1.5 font-bold">{totalPax}</div>
                </div>

                {/* Flight */}
                <div className="bg-gray-200 text-center p-1.5 font-bold border-b border-black text-[11px] uppercase">
                  FLIGHT DETAILS
                </div>
                <div className="grid grid-cols-7 divide-x divide-black border-b border-black text-center font-bold bg-gray-100 text-[10px]">
                  <div className="p-1 col-span-1">TYPE</div>
                  <div className="p-1 col-span-1">AIRLINE</div>
                  <div className="p-1 col-span-1">FLIGHT #</div>
                  <div className="p-1 col-span-2">SECTOR</div>
                  <div className="p-1 col-span-1">DATE</div>
                  <div className="p-1 col-span-1">DEP / ARR</div>
                </div>
                <div className="grid grid-cols-7 divide-x divide-black border-b border-black text-center text-[11px]">
                  <div className="p-1.5 font-bold bg-gray-50 col-span-1">DEPARTURE</div>
                  <div className="p-1.5 col-span-1">{depFlight.airline || '-'}</div>
                  <div className="p-1.5 col-span-1">{depFlight.flight_no || '-'}</div>
                  <div className="p-1.5 col-span-2 font-bold">{depFlight.sector || '-'}</div>
                  <div className="p-1.5 col-span-1">{depFlight.date || '-'}</div>
                  <div className="p-1.5 col-span-1">{depFlight.dep_time || '-'} / {depFlight.arr_time || '-'}</div>
                </div>
                <div className="grid grid-cols-7 divide-x divide-black border-b border-black text-center text-[11px]">
                  <div className="p-1.5 font-bold bg-gray-50 col-span-1">ARRIVAL</div>
                  <div className="p-1.5 col-span-1">{arrFlight.airline || '-'}</div>
                  <div className="p-1.5 col-span-1">{arrFlight.flight_no || '-'}</div>
                  <div className="p-1.5 col-span-2 font-bold">{arrFlight.sector || '-'}</div>
                  <div className="p-1.5 col-span-1">{arrFlight.date || '-'}</div>
                  <div className="p-1.5 col-span-1">{arrFlight.dep_time || '-'} / {arrFlight.arr_time || '-'}</div>
                </div>

                {/* Visa */}
                <div className="bg-gray-200 text-center p-1.5 font-bold border-b border-black text-[11px] uppercase">
                  VISA DETAILS
                </div>
                <div className="grid grid-cols-3 divide-x divide-black border-b border-black text-center font-bold bg-gray-100 text-[10px]">
                  <div className="p-1">VISA TYPE</div>
                  <div className="p-1">VISA QTY</div>
                  <div className="p-1">VISA PRICE</div>
                </div>
                <div className="grid grid-cols-3 divide-x divide-black border-b border-black text-center text-[11px]">
                  <div className="p-1.5 font-bold">{visa.type || '-'}</div>
                  <div className="p-1.5">{visa.qty || '-'}</div>
                  <div className="p-1.5">{visa.price || '-'}</div>
                </div>

                {/* Hotel */}
                <div className="bg-gray-200 text-center p-1.5 font-bold border-b border-black text-[11px] uppercase">
                  HOTEL DETAILS
                </div>
                <div className="grid grid-cols-7 divide-x divide-black border-b border-black text-center font-bold bg-gray-100 text-[10px]">
                  <div className="p-1 col-span-2">HOTEL NAME</div>
                  <div className="p-1 col-span-1">ROOM QTY</div>
                  <div className="p-1 col-span-1">ROOM TYPE</div>
                  <div className="p-1 col-span-1">CHECK IN</div>
                  <div className="p-1 col-span-1">CHECK OUT</div>
                  <div className="p-1 col-span-1">NIGHTS / RATE</div>
                </div>
                {makkahHotels.map((h, i) => (
                  <div key={`p-mak-${i}`} className="grid grid-cols-7 divide-x divide-black border-b border-black text-center text-[11px]">
                    <div className="p-1.5 col-span-2 font-bold text-left px-2">MAKKAH: {h.hotel_name || '-'}</div>
                    <div className="p-1.5 col-span-1">{h.room_qty || '-'}</div>
                    <div className="p-1.5 col-span-1">{h.room_type || '-'}</div>
                    <div className="p-1.5 col-span-1">{h.check_in || '-'}</div>
                    <div className="p-1.5 col-span-1">{h.check_out || '-'}</div>
                    <div className="p-1.5 col-span-1 font-bold">{h.nights || 0} / {h.night_price || 0}</div>
                  </div>
                ))}
                {madinaHotels.map((h, i) => (
                  <div key={`p-med-${i}`} className="grid grid-cols-7 divide-x divide-black border-b border-black text-center text-[11px]">
                    <div className="p-1.5 col-span-2 font-bold text-left px-2">MADINA: {h.hotel_name || '-'}</div>
                    <div className="p-1.5 col-span-1">{h.room_qty || '-'}</div>
                    <div className="p-1.5 col-span-1">{h.room_type || '-'}</div>
                    <div className="p-1.5 col-span-1">{h.check_in || '-'}</div>
                    <div className="p-1.5 col-span-1">{h.check_out || '-'}</div>
                    <div className="p-1.5 col-span-1 font-bold">{h.nights || 0} / {h.night_price || 0}</div>
                  </div>
                ))}

                {/* Transport */}
                <div className="bg-gray-200 text-center p-1.5 font-bold border-b border-black text-[11px] uppercase">
                  TRANSPORTATION DETAILS
                </div>
                <div className="grid grid-cols-6 divide-x divide-black border-b border-black text-center font-bold bg-gray-100 text-[10px]">
                  <div className="p-1 col-span-2">TRANSPORTATION TYPE</div>
                  <div className="p-1 col-span-1">QTY</div>
                  <div className="p-1 col-span-3">TRANSPORTATION SECTOR</div>
                </div>
                <div className="grid grid-cols-6 divide-x divide-black border-b border-black text-center text-[11px]">
                  <div className="p-1.5 col-span-2 font-bold">{transport.type || '-'}</div>
                  <div className="p-1.5 col-span-1">{transport.qty || '-'}</div>
                  <div className="p-1.5 col-span-3">{transport.sector || '-'}</div>
                </div>

                {/* Package Totals */}
                <div className="bg-gray-200 text-center p-1.5 font-bold border-b border-black text-[11px] uppercase">
                  PACKAGE PRICING & TOTALS
                </div>
                <div className="grid grid-cols-4 divide-x divide-black border-b border-black text-center text-[11px]">
                  <div className="p-1.5 bg-gray-100 uppercase col-span-1 font-bold">TOTAL PACKAGE ONLY</div>
                  <div className="p-1.5 font-black col-span-1">{totals.package_only || '-'}</div>
                  <div className="p-1.5 bg-gray-100 uppercase col-span-1 font-bold">TOTAL PACKAGE WITH TICKET</div>
                  <div className="p-1.5 font-black col-span-1">{totals.package_with_ticket || '-'}</div>
                </div>

                {/* Comment Box */}
                <div className="bg-gray-200 text-center p-1.5 font-bold border-b border-black text-[11px] uppercase">
                  COMMENT BOX
                </div>
                <div className="p-3 text-[11px] min-h-[50px] bg-white whitespace-pre-wrap font-sans">
                  {comments || 'No extra comments provided.'}
                </div>

              </div>
            )}

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

function ColorPdfTemplate({ header = {}, pax = {}, totalPax = 0, depFlight = {}, arrFlight = {}, visa = {}, makkahHotels = [], madinaHotels = [], transport = {}, totals = {}, comments = '' }) {
  const safeHeaderSr = String(header?.sr_no || '01')
  const safeHeaderName = String(header?.name || 'ANAS')
  const safeHeaderDate = String(header?.date || '09-Jun-26')

  const depSectorRaw = typeof depFlight?.sector === 'string' ? depFlight.sector.trim() : ''
  const depParts = depSectorRaw ? depSectorRaw.split(/\s+/) : []
  const depFrom = depParts[0] || 'KHI'
  const depTo = depParts[1] || 'JED'

  const arrSectorRaw = typeof arrFlight?.sector === 'string' ? arrFlight.sector.trim() : ''
  const arrParts = arrSectorRaw ? arrSectorRaw.split(/\s+/) : []
  const arrFrom = arrParts[0] || 'MED'
  const arrTo = arrParts[1] || 'KHI'

  const transportSectorRaw = typeof transport?.sector === 'string' ? transport.sector.trim() : ''
  const transportSectors = transportSectorRaw 
    ? transportSectorRaw.split(',').map(s => s.trim()).filter(Boolean)
    : []

  const safeMakkahHotels = Array.isArray(makkahHotels) ? makkahHotels : []
  const safeMadinaHotels = Array.isArray(madinaHotels) ? madinaHotels : []

  return (
    <div id="printable-color-package" className="bg-white text-slate-900 font-sans p-5 sm:p-6 space-y-4 rounded-2xl border border-slate-200 shadow-sm max-w-4xl mx-auto text-left">
      
      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800">
        <div>
          <h2 className="text-2xl font-black tracking-wide text-white flex items-center gap-2">
            TRAVEL ITINERARY
          </h2>
          <p className="text-[11px] font-semibold text-slate-300 tracking-wider uppercase mt-1">
            BOOKING & PACKAGE SUMMARY VOUCHER
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 w-full md:w-auto">
          <div className="bg-white/10 backdrop-blur-md rounded-xl px-4 py-2 border border-white/15 text-center min-w-[85px] flex-1 md:flex-initial">
            <span className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider">SR #</span>
            <span className="block text-sm font-extrabold text-white mt-0.5">{safeHeaderSr}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl px-4 py-2 border border-white/15 text-center min-w-[110px] flex-1 md:flex-initial">
            <span className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider">CLIENT NAME</span>
            <span className="block text-sm font-extrabold text-white mt-0.5 uppercase">{safeHeaderName}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl px-4 py-2 border border-white/15 text-center min-w-[105px] flex-1 md:flex-initial">
            <span className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider">DATE</span>
            <span className="block text-sm font-extrabold text-white mt-0.5">{safeHeaderDate}</span>
          </div>
        </div>
      </div>

      {/* Passenger Breakdown */}
      <div className="space-y-1.5">
        <div className="bg-blue-50/80 text-blue-900 border-l-4 border-blue-600 rounded-r-xl px-3 py-1.5 flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
          <i className="ti ti-users text-blue-600 text-base" />
          PASSENGER BREAKDOWN
        </div>
        <div className="grid grid-cols-4 divide-x divide-slate-200 border border-slate-200 rounded-xl text-center bg-white shadow-xs overflow-hidden text-xs">
          <div className="p-2.5">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">ADULT (ADT)</span>
            <span className="block text-sm font-extrabold text-slate-800 mt-0.5">{pax?.adt ?? '0'}</span>
          </div>
          <div className="p-2.5">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">CHILD</span>
            <span className="block text-sm font-extrabold text-slate-800 mt-0.5">{pax?.child ?? '0'}</span>
          </div>
          <div className="p-2.5">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">INFANT</span>
            <span className="block text-sm font-extrabold text-slate-800 mt-0.5">{pax?.infant ?? '0'}</span>
          </div>
          <div className="p-2.5 bg-blue-50/60">
            <span className="block text-[10px] font-extrabold text-blue-700 uppercase tracking-wider">TOTAL PASSENGERS</span>
            <span className="block text-sm font-black text-blue-700 mt-0.5">{totalPax || 0}</span>
          </div>
        </div>
      </div>

      {/* Flight Details */}
      <div className="space-y-1.5">
        <div className="bg-blue-50/80 text-blue-900 border-l-4 border-blue-600 rounded-r-xl px-3 py-1.5 flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
          <i className="ti ti-plane-departure text-blue-600 text-base" />
          FLIGHT DETAILS
        </div>
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white text-xs">
          <div className="grid grid-cols-7 bg-slate-50 text-slate-500 font-bold p-2 text-[10px] uppercase tracking-wider border-b border-slate-200 text-center">
            <div className="col-span-1 text-left px-2">TYPE</div>
            <div className="col-span-1">AIRLINE</div>
            <div className="col-span-1">FLIGHT NO</div>
            <div className="col-span-2">SECTOR</div>
            <div className="col-span-1">DATE</div>
            <div className="col-span-1">DEP / ARR</div>
          </div>
          
          <div className="grid grid-cols-7 p-2.5 border-b border-slate-100 text-center items-center font-mono">
            <div className="col-span-1 text-left font-sans">
              <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded tracking-wide uppercase">DEPARTURE</span>
            </div>
            <div className="col-span-1 font-bold text-slate-800">{depFlight?.airline || '-'}</div>
            <div className="col-span-1 text-slate-700">{depFlight?.flight_no || '-'}</div>
            <div className="col-span-2 font-bold text-slate-900 flex items-center justify-center gap-1">
              <span>{depFrom}</span>
              <span className="text-blue-600">✈</span>
              <span>{depTo}</span>
            </div>
            <div className="col-span-1 text-slate-700">{depFlight?.date || '-'}</div>
            <div className="col-span-1 text-slate-700">{depFlight?.dep_time || '-'} / {depFlight?.arr_time || '-'}</div>
          </div>

          <div className="grid grid-cols-7 p-2.5 text-center items-center font-mono">
            <div className="col-span-1 text-left font-sans">
              <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded tracking-wide uppercase">ARRIVAL</span>
            </div>
            <div className="col-span-1 font-bold text-slate-800">{arrFlight?.airline || '-'}</div>
            <div className="col-span-1 text-slate-700">{arrFlight?.flight_no || '-'}</div>
            <div className="col-span-2 font-bold text-slate-900 flex items-center justify-center gap-1">
              <span>{arrFrom}</span>
              <span className="text-blue-600">✈</span>
              <span>{arrTo}</span>
            </div>
            <div className="col-span-1 text-slate-700">{arrFlight?.date || '-'}</div>
            <div className="col-span-1 text-slate-700">{arrFlight?.dep_time || '-'} / {arrFlight?.arr_time || '-'}</div>
          </div>
        </div>
      </div>

      {/* Visa Details */}
      <div className="space-y-1.5">
        <div className="bg-blue-50/80 text-blue-900 border-l-4 border-blue-600 rounded-r-xl px-3 py-1.5 flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
          <i className="ti ti-id-badge text-blue-600 text-base" />
          VISA DETAILS
        </div>
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white text-xs">
          <div className="grid grid-cols-3 bg-slate-50 text-slate-500 font-bold p-2 text-[10px] uppercase tracking-wider border-b border-slate-200">
            <div className="px-3">VISA TYPE</div>
            <div className="text-center">QUANTITY</div>
            <div className="text-right px-3">PRICE (PER VISA)</div>
          </div>
          <div className="grid grid-cols-3 p-2.5 items-center font-mono">
            <div className="px-3 font-extrabold text-slate-900 font-sans">{visa?.type || 'UMRAH'}</div>
            <div className="text-center font-bold text-slate-800">{visa?.qty || '0'}</div>
            <div className="text-right px-3 font-bold text-slate-800">{visa?.price || '0'}</div>
          </div>
        </div>
      </div>

      {/* Hotel Details */}
      <div className="space-y-1.5">
        <div className="bg-blue-50/80 text-blue-900 border-l-4 border-blue-600 rounded-r-xl px-3 py-1.5 flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
          <i className="ti ti-building-skyscraper text-blue-600 text-base" />
          HOTEL DETAILS
        </div>
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white text-xs">
          <div className="grid grid-cols-7 bg-slate-50 text-slate-500 font-bold p-2 text-[10px] uppercase tracking-wider border-b border-slate-200 text-center">
            <div className="col-span-2 text-left px-3">HOTEL NAME</div>
            <div className="col-span-1">QTY</div>
            <div className="col-span-1">TYPE</div>
            <div className="col-span-1">CHECK IN</div>
            <div className="col-span-1">CHECK OUT</div>
            <div className="col-span-1 text-right px-3">NIGHTS / RATE</div>
          </div>

          {safeMakkahHotels.map((h, i) => (
            <div key={`col-mak-${i}`} className="grid grid-cols-7 p-2.5 border-b border-slate-100 text-center items-center font-mono">
              <div className="col-span-2 text-left px-3 font-sans">
                <span className="block font-black text-slate-900 text-xs uppercase">{h?.hotel_name || '-'}</span>
                <span className="text-[10px] text-slate-400 font-medium">Makkah Hotel</span>
              </div>
              <div className="col-span-1 font-bold text-slate-800">{h?.room_qty || '—'}</div>
              <div className="col-span-1 font-bold text-slate-800">{h?.room_type || '—'}</div>
              <div className="col-span-1 text-slate-700">{h?.check_in || '—'}</div>
              <div className="col-span-1 text-slate-700">{h?.check_out || '—'}</div>
              <div className="col-span-1 text-right px-3 font-extrabold text-slate-900">{h?.nights || '0'} / {h?.night_price || '0'}</div>
            </div>
          ))}

          {safeMadinaHotels.map((h, i) => (
            <div key={`col-med-${i}`} className="grid grid-cols-7 p-2.5 border-b border-slate-100 last:border-0 text-center items-center font-mono">
              <div className="col-span-2 text-left px-3 font-sans">
                <span className="block font-black text-slate-900 text-xs uppercase">{h?.hotel_name || '-'}</span>
                <span className="text-[10px] text-slate-400 font-medium">Madina Hotel</span>
              </div>
              <div className="col-span-1 font-bold text-slate-800">{h?.room_qty || '—'}</div>
              <div className="col-span-1 font-bold text-slate-800">{h?.room_type || '—'}</div>
              <div className="col-span-1 text-slate-700">{h?.check_in || '—'}</div>
              <div className="col-span-1 text-slate-700">{h?.check_out || '—'}</div>
              <div className="col-span-1 text-right px-3 font-extrabold text-slate-900">{h?.nights || '0'} / {h?.night_price || '0'}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Transportation Details */}
      <div className="space-y-1.5">
        <div className="bg-blue-50/80 text-blue-900 border-l-4 border-blue-600 rounded-r-xl px-3 py-1.5 flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
          <i className="ti ti-car text-blue-600 text-base" />
          TRANSPORTATION DETAILS
        </div>
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white p-3 text-xs grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">TRANSPORTATION TYPE & QTY</span>
            <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
              <span>{transport?.type || 'BY CAR'}</span>
              <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                QTY: {transport?.qty || 1}
              </span>
            </div>
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">SECTOR TIMELINE</span>
            <div className="flex flex-wrap items-center gap-1 font-bold text-slate-800 text-[11px]">
              {transportSectors.length > 0 ? (
                transportSectors.map((s, idx) => (
                  <React.Fragment key={idx}>
                    {idx > 0 && <span className="text-blue-600 font-extrabold">➔</span>}
                    <span className="bg-slate-100 px-1.5 py-0.5 rounded">{s}</span>
                  </React.Fragment>
                ))
              ) : (
                <>
                  <span className="bg-slate-100 px-1.5 py-0.5 rounded">MAK AIRPORT</span>
                  <span className="text-blue-600 font-extrabold">➔</span>
                  <span className="bg-slate-100 px-1.5 py-0.5 rounded">MAK</span>
                  <span className="text-blue-600 font-extrabold">➔</span>
                  <span className="bg-slate-100 px-1.5 py-0.5 rounded">MED</span>
                  <span className="text-blue-600 font-extrabold">➔</span>
                  <span className="bg-slate-100 px-1.5 py-0.5 rounded">MAD</span>
                  <span className="text-blue-600 font-extrabold">➔</span>
                  <span className="bg-slate-100 px-1.5 py-0.5 rounded">MED ARPT</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Total Amount Boxes */}
      <div className="space-y-1.5">
        <div className="bg-blue-50/80 text-blue-900 border-l-4 border-blue-600 rounded-r-xl px-3 py-1.5 flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
          <i className="ti ti-cash text-blue-600 text-base" />
          PACKAGE PRICING & TOTALS
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-xs">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">TOTAL PACKAGE ONLY</span>
            <span className="block text-base font-black text-slate-900">{totals?.package_only || '1,050,000'}</span>
          </div>
          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 text-center shadow-xs">
            <span className="block text-[10px] font-extrabold text-blue-700 uppercase tracking-wider mb-1">TOTAL PACKAGE WITH TICKET</span>
            <span className="block text-base font-black text-blue-700">{totals?.package_with_ticket || '1,800,000'}</span>
          </div>
        </div>
      </div>

      {/* Comment Box / Remarks */}
      <div className="space-y-1.5">
        <div className="bg-blue-50/80 text-blue-900 border-l-4 border-blue-600 rounded-r-xl px-3 py-1.5 flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
          <i className="ti ti-message-dots text-blue-600 text-base" />
          COMMENT BOX / SPECIAL REMARKS
        </div>
        <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-900 font-sans leading-relaxed">
          {typeof comments === 'string' && comments ? comments : 'All bookings confirmed as per schedule. Please ensure passports are valid for at least 6 months from the date of travel.'}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium pt-1 border-t border-slate-100">
        <span>Travel Itinerary & Booking Voucher</span>
        <span>Page 1 of 1</span>
      </div>

    </div>
  )
}
