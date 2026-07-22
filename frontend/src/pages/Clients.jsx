import React, { useState, useRef, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'
import html2pdf from 'html2pdf.js'
import { ColorPdfTemplate, StandardPdfTemplate } from '../components/VoucherTemplates'

// API Key configuration fallback
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || ''

// ── GEMINI AI VISION OCR FOR TRAVEL ITINERARY / TICKET ──
async function scanTicketWithGemini(base64Image, mimeType, userKey) {
  const finalKey = userKey || apiKey

  if (!finalKey) {
    throw new Error('Please configure a valid Gemini API Key to use the AI Ticket Scanner.')
  }

  const prompt = `You are a travel ticket & itinerary OCR expert. Analyze this travel reservation / ticket itinerary image (e-ticket, booking reference, PNR, flight schedule, or reservation summary) and extract all details into a JSON object matching this structure EXACTLY. Return ONLY raw valid JSON, no Markdown code blocks, no backticks, no explanations.

{
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
  }
}

Rules:
- "name": Extract the first or primary passenger full name available in the reservation/ticket (e.g. "ANAS", "MOHAMMAD ALAM", "JOHN DOE").
- "date": Extract the booking or travel issue date. If not found, use departure date.
- "adt", "child", "infant": Count or extract the number of Adult (ADT), Child (CH/CHD), and Infant (INF) passengers listed on the ticket. If unspecified, assume at least 1 ADT.
- Extract departure and arrival flight numbers, airline codes (e.g. SV, PK, QR, EK), sectors (e.g. KHI JED, MED KHI), flight dates, and dep/arr times cleanly.
- Set empty string "" or 0 for unreadable fields.`

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
            throw new Error('No JSON structure found in ticket AI response')
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

  throw lastError || new Error('All attempted Gemini models failed to scan the ticket itinerary.')
}

// ── GEMINI AI VISION OCR FOR PACKAGE SHEETS ──
async function scanPackageWithGemini(base64Image, mimeType, userKey) {
  const finalKey = userKey || apiKey

  if (!finalKey) {
    throw new Error('Please configure a valid Gemini API Key to use the AI Package Scanner.')
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
- Read numbers carefully (ADT, Child, Infant, Night Price, Room Qty).
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

export default function Clients() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const editIdParam = searchParams.get('edit')

  // Saved Clients List from LocalStorage
  const [savedClients, setSavedClients] = useState(() => {
    try {
      const stored = localStorage.getItem('galileo_clients')
      return stored ? JSON.parse(stored) : []
    } catch (e) {
      return []
    }
  })

  // ── CLIENT FORM STATE ──
  const [editingId, setEditingId] = useState(null)
  const [status, setStatus] = useState('Pending') // 'Pending' | 'Completed'

  const [header, setHeader] = useState({
    sr_no: '01',
    name: '',
    date: new Date().toISOString().slice(0, 10),
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
    type: 'UMRAH',
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

  // Load client from URL parameter ?edit=<id>
  useEffect(() => {
    if (editIdParam && savedClients.length > 0) {
      const target = savedClients.find(c => c.id === editIdParam)
      if (target) {
        setEditingId(target.id)
        setStatus(target.status || 'Pending')
        setHeader({ sr_no: target.sr_no || '01', name: target.name || '', date: target.date || '' })
        setPax(target.pax || { adt: '', child: '', infant: '' })
        setDepFlight(target.depFlight || { airline: '', flight_no: '', sector: '', date: '', dep_time: '', arr_time: '' })
        setArrFlight(target.arrFlight || { airline: '', flight_no: '', sector: '', date: '', dep_time: '', arr_time: '' })
        setVisa(target.visa || { type: 'UMRAH', qty: '', price: '' })
        setMakkahHotels(target.makkahHotels || [{ hotel_name: '', room_qty: '', room_type: '', check_in: '', check_out: '', nights: '', night_price: '' }])
        setMadinaHotels(target.madinaHotels || [{ hotel_name: '', room_qty: '', room_type: '', check_in: '', check_out: '', nights: '', night_price: '' }])
        setTransport(target.transport || { type: '', qty: '', sector: '' })
        setTotals(target.totals || { package_only: '', package_with_ticket: '' })
        setComments(target.comments || '')
        toast.success(`Loaded client record: ${target.name}`)
      }
    }
  }, [editIdParam, savedClients])

  useEffect(() => {
    try {
      localStorage.setItem('galileo_clients', JSON.stringify(savedClients))
    } catch (e) {
      console.error('Failed to save clients to localStorage', e)
    }
  }, [savedClients])

  // ── SCANNER CONTROLS ──
  const [scanningTicket, setScanningTicket] = useState(false)
  const [scanningPackage, setScanningPackage] = useState(false)
  const [ticketPreviewImg, setTicketPreviewImg] = useState(null)
  const [packagePreviewImg, setPackagePreviewImg] = useState(null)

  const [userApiKey, setUserApiKey] = useState(apiKey || '')
  const [showKeyInput, setShowKeyInput] = useState(!apiKey)
  const [showPrintModal, setShowPrintModal] = useState(false) // false | 'standard' | 'color'

  // Camera modal state
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraTarget, setCameraTarget] = useState(null) // 'ticket' | 'package'
  const [cameraStream, setCameraStream] = useState(null)
  const videoRef = useRef(null)
  const ticketFileRef = useRef(null)
  const packageFileRef = useRef(null)

  const totalPax = Number(pax.adt || 0) + Number(pax.child || 0) + Number(pax.infant || 0)

  // Select existing client from dropdown to merge details
  const handleSelectExistingClient = (clientId) => {
    if (!clientId) return
    const target = savedClients.find(c => c.id === clientId)
    if (target) {
      setEditingId(target.id)
      setStatus(target.status || 'Pending')
      setHeader({ sr_no: target.sr_no || '01', name: target.name || '', date: target.date || '' })
      setPax(target.pax || { adt: '', child: '', infant: '' })
      setDepFlight(target.depFlight || { airline: '', flight_no: '', sector: '', date: '', dep_time: '', arr_time: '' })
      setArrFlight(target.arrFlight || { airline: '', flight_no: '', sector: '', date: '', dep_time: '', arr_time: '' })
      setVisa(target.visa || { type: 'UMRAH', qty: '', price: '' })
      setMakkahHotels(target.makkahHotels || [{ hotel_name: '', room_qty: '', room_type: '', check_in: '', check_out: '', nights: '', night_price: '' }])
      setMadinaHotels(target.madinaHotels || [{ hotel_name: '', room_qty: '', room_type: '', check_in: '', check_out: '', nights: '', night_price: '' }])
      setTransport(target.transport || { type: '', qty: '', sector: '' })
      setTotals(target.totals || { package_only: '', package_with_ticket: '' })
      setComments(target.comments || '')
      toast.success(`Loaded saved client record: ${target.name}`)
    }
  }

  // ── TICKET OCR HANDLER ──
  const processTicketImage = async (file) => {
    if (!file) return
    setScanningTicket(true)
    setTicketPreviewImg(URL.createObjectURL(file))
    try {
      const base64 = await fileToBase64(file)
      const data = await scanTicketWithGemini(base64, file.type, userApiKey)
      
      // Populate extracted ticket data
      if (data.name) {
        setHeader(h => ({ ...h, name: data.name }))
      }
      if (data.date) {
        setHeader(h => ({ ...h, date: data.date }))
      }
      if (data.adt !== undefined || data.child !== undefined || data.infant !== undefined) {
        setPax({
          adt: data.adt ?? pax.adt,
          child: data.child ?? pax.child,
          infant: data.infant ?? pax.infant,
        })
      }
      if (data.departure_flight) {
        setDepFlight(df => ({ ...df, ...data.departure_flight }))
      }
      if (data.arrival_flight) {
        setArrFlight(af => ({ ...af, ...data.arrival_flight }))
      }

      toast.success(`Ticket scanned! Passenger "${data.name || 'Lead Pax'}" extracted. Click Save to record changes.`, { id: 'ticket-ocr-success' })
    } catch (e) {
      console.error('Ticket OCR error:', e)
      toast.error(`Ticket scan failed: ${e.message || 'Check image clarity.'}`, { id: 'ticket-ocr-err' })
    } finally {
      setScanningTicket(false)
    }
  }

  // ── PACKAGE OCR HANDLER ──
  const processPackageImage = async (file) => {
    if (!file) return
    setScanningPackage(true)
    setPackagePreviewImg(URL.createObjectURL(file))
    try {
      const base64 = await fileToBase64(file)
      const data = await scanPackageWithGemini(base64, file.type, userApiKey)

      if (!header.name && data.name) {
        setHeader(h => ({ ...h, name: data.name }))
      }
      if (!header.sr_no && data.sr_no) {
        setHeader(h => ({ ...h, sr_no: data.sr_no }))
      }

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

      toast.success('Package sheet details extracted! Review and hit Save Changes to update client record.', { id: 'pkg-ocr-success' })
    } catch (e) {
      console.error('Package OCR error:', e)
      toast.error(`Package scan failed: ${e.message || 'Check image clarity.'}`, { id: 'pkg-ocr-err' })
    } finally {
      setScanningPackage(false)
    }
  }

  // Camera handlers
  const openCamera = async (target) => {
    setCameraTarget(target)
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
      toast.error('Camera access denied or unavailable', { id: 'cam-denied' })
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
      const fileName = cameraTarget === 'ticket' ? 'travel-itinerary.jpg' : 'package-sheet.jpg'
      const file = new File([blob], fileName, { type: 'image/jpeg' })
      stopCamera()
      if (cameraTarget === 'ticket') {
        processTicketImage(file)
      } else {
        processPackageImage(file)
      }
    }, 'image/jpeg', 0.95)
  }

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop())
      setCameraStream(null)
    }
    setCameraOpen(false)
  }

  // Row operations
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

  // Section clear handlers
  const handleClearTicket = () => {
    setPax({ adt: '', child: '', infant: '' })
    setDepFlight({ airline: '', flight_no: '', sector: '', date: '', dep_time: '', arr_time: '' })
    setArrFlight({ airline: '', flight_no: '', sector: '', date: '', dep_time: '', arr_time: '' })
    setTicketPreviewImg(null)
    toast.success('Travel itinerary ticket details cleared', { id: 'clear-ticket' })
  }

  const handleClearPackage = () => {
    setVisa({ type: 'UMRAH', qty: '', price: '' })
    setMakkahHotels([{ hotel_name: '', room_qty: '', room_type: '', check_in: '', check_out: '', nights: '', night_price: '' }])
    setMadinaHotels([{ hotel_name: '', room_qty: '', room_type: '', check_in: '', check_out: '', nights: '', night_price: '' }])
    setTransport({ type: '', qty: '', sector: '' })
    setTotals({ package_only: '', package_with_ticket: '' })
    setComments('')
    setPackagePreviewImg(null)
    toast.success('Package sheet details cleared', { id: 'clear-package' })
  }

  const handleClearForm = () => {
    setEditingId(null)
    setStatus('Pending')
    setHeader({ sr_no: (savedClients.length + 1).toString().padStart(2, '0'), name: '', date: new Date().toISOString().slice(0, 10) })
    setPax({ adt: '', child: '', infant: '' })
    setDepFlight({ airline: '', flight_no: '', sector: '', date: '', dep_time: '', arr_time: '' })
    setArrFlight({ airline: '', flight_no: '', sector: '', date: '', dep_time: '', arr_time: '' })
    setVisa({ type: 'UMRAH', qty: '', price: '' })
    setMakkahHotels([{ hotel_name: '', room_qty: '', room_type: '', check_in: '', check_out: '', nights: '', night_price: '' }])
    setMadinaHotels([{ hotel_name: '', room_qty: '', room_type: '', check_in: '', check_out: '', nights: '', night_price: '' }])
    setTransport({ type: '', qty: '', sector: '' })
    setTotals({ package_only: '', package_with_ticket: '' })
    setComments('')
    setTicketPreviewImg(null)
    setPackagePreviewImg(null)
    toast.success('Full form reset cleanly', { id: 'clear-form' })
  }

  // ── SAVE / UPDATE CLIENT RECORD ──
  const handleSaveClient = () => {
    if (!header.name.trim()) {
      toast.error('Please enter or scan a Client Name before saving.', { id: 'save-val-name' })
      return
    }

    const clientRecord = {
      id: editingId || `cli-${Date.now()}`,
      sr_no: header.sr_no || '01',
      name: header.name,
      date: header.date || new Date().toISOString().slice(0, 10),
      status: status, // 'Pending' or 'Completed'
      pax,
      depFlight,
      arrFlight,
      visa,
      makkahHotels,
      madinaHotels,
      transport,
      totals,
      comments,
      updatedAt: new Date().toISOString(),
    }

    if (editingId) {
      setSavedClients(prev => prev.map(c => c.id === editingId ? clientRecord : c))
      toast.success(`Updated client record "${header.name}" with new changes!`, { id: 'update-success' })
    } else {
      setSavedClients(prev => [clientRecord, ...prev])
      setEditingId(clientRecord.id) // keep active id so subsequent updates edit this record
      toast.success(`Client "${header.name}" saved with status: ${status}`, { id: 'save-success' })
    }

    // Direct user to Client List page after save so they can view the directory
    setTimeout(() => {
      navigate('/client-list')
    }, 600)
  }

  // PDF Export
  const handleSavePdf = async () => {
    const elementId = showPrintModal === 'color' ? 'printable-color-package' : 'printable-package'
    const element = document.getElementById(elementId) || document.getElementById('printable-color-package')
    if (!element) return

    const clientName = header?.name || 'Client'
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

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-50 text-gray-900 antialiased font-sans">
      <Toaster position="top-right" />
      <main className="flex-1 overflow-y-auto max-w-6xl w-full mx-auto p-4 sm:p-5 pb-16 space-y-4">

        {/* Gemini API Key Warning */}
        {showKeyInput && (
          <div className="bg-gradient-to-r from-amber-50 to-amber-100/50 border border-amber-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-amber-900 flex items-center gap-1.5">
                  <i className="ti ti-key text-amber-700" />
                  Gemini API Key Required for AI Ticket & Package Scanning
                </h4>
                <p className="text-xs text-amber-700">
                  Enter your Google Gemini API Key to enable automatic itinerary extraction & handwritten package OCR parsing.
                </p>
              </div>
              <button onClick={() => setShowKeyInput(false)} className="text-amber-600 hover:text-amber-800 text-xs">
                <i className="ti ti-x text-base" />
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input
                type="password"
                placeholder="AIzaSy..."
                value={userApiKey}
                onChange={(e) => setUserApiKey(e.target.value)}
                className="flex-1 text-xs border border-amber-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                onClick={() => {
                  if (userApiKey) {
                    toast.success('Gemini API key applied')
                    setShowKeyInput(false)
                  }
                }}
                className="bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all"
              >
                Save Key
              </button>
            </div>
          </div>
        )}

        {/* Client Record Status Bar & Save Controls */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">SR NO</label>
              <input
                type="text"
                value={header.sr_no}
                onChange={(e) => setHeader({ ...header, sr_no: e.target.value })}
                className="w-20 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                CLIENT / RESERVATION NAME <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Auto-filled from itinerary or type name"
                value={header.name}
                onChange={(e) => setHeader({ ...header, name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">DATE</label>
              <input
                type="text"
                value={header.date}
                onChange={(e) => setHeader({ ...header, date: e.target.value })}
                className="w-32 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">PACKAGE STATUS</label>
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setStatus('In Process')}
                  className={`text-xs font-bold px-3 py-1 rounded-md transition-all ${status === 'In Process' || status === 'Pending' ? 'bg-amber-500 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  <i className="ti ti-clock mr-1" /> In Process
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('Complete')}
                  className={`text-xs font-bold px-3 py-1 rounded-md transition-all ${status === 'Complete' || status === 'Completed' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  <i className="ti ti-circle-check mr-1" /> Complete
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClearForm}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold px-3 py-2 rounded-lg transition-all"
              title="Reset entire form"
            >
              Reset Form
            </button>
            <button
              type="button"
              onClick={() => setShowPrintModal('standard')}
              className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-semibold text-xs px-3 py-2 rounded-lg flex items-center gap-1 shadow-sm"
            >
              <i className="ti ti-printer" /> Print Standard
            </button>
            <button
              type="button"
              onClick={() => setShowPrintModal('color')}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1 shadow-sm"
            >
              <i className="ti ti-palette" /> Color PDF
            </button>
            <button
              type="button"
              onClick={handleSaveClient}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm flex items-center gap-1.5 transition-all"
            >
              <i className="ti ti-device-floppy text-sm" />
              {editingId ? 'Update Client Record' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* DUAL SCANNER CARDS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* CARD 1: TRAVEL ITINERARY TICKET CARD */}
          <div className="bg-white border border-blue-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <i className="ti ti-ticket text-base" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide">1. Travel Itinerary Ticket Card</h3>
                    <p className="text-[11px] text-gray-500">Scan ticket / reservation to fetch name, date, pax, sectors & times</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {scanningTicket ? (
                    <span className="text-xs text-blue-600 font-semibold animate-pulse flex items-center gap-1">
                      <i className="ti ti-loader animate-spin" /> Scanning Ticket...
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleClearTicket}
                      className="text-xs font-semibold text-gray-500 hover:text-red-600 flex items-center gap-1 bg-gray-100 hover:bg-red-50 px-2.5 py-1 rounded-md transition-all"
                      title="Clear Travel Ticket details"
                    >
                      <i className="ti ti-rotate-clockwise" /> Reset Ticket
                    </button>
                  )}
                </div>
              </div>

              <input
                type="file"
                ref={ticketFileRef}
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) processTicketImage(e.target.files[0])
                }}
              />

              <div className="flex items-center gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => ticketFileRef.current?.click()}
                  disabled={scanningTicket}
                  className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <i className="ti ti-upload text-sm" />
                  Upload Travel Itinerary
                </button>
                <button
                  type="button"
                  onClick={() => openCamera('ticket')}
                  disabled={scanningTicket}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
                >
                  <i className="ti ti-camera text-sm" />
                  Capture Ticket Camera
                </button>
              </div>

              {ticketPreviewImg && (
                <div className="mb-3 relative rounded-lg overflow-hidden border border-blue-200 h-24 bg-gray-900">
                  <img src={ticketPreviewImg} alt="Ticket preview" className="w-full h-full object-cover opacity-85" />
                  <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded">
                    Ticket Scanned
                  </div>
                </div>
              )}
            </div>

            {/* Ticket Details Summary Form */}
            <div className="space-y-2.5 bg-blue-50/50 p-3 rounded-lg border border-blue-100">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white p-2 rounded border border-blue-100">
                  <span className="block text-[10px] text-gray-500 font-semibold">ADT</span>
                  <input
                    type="number"
                    min="0"
                    value={pax.adt}
                    onChange={(e) => setPax({ ...pax, adt: e.target.value })}
                    className="w-full text-center text-xs font-bold border-none p-0 focus:ring-0"
                    placeholder="0"
                  />
                </div>
                <div className="bg-white p-2 rounded border border-blue-100">
                  <span className="block text-[10px] text-gray-500 font-semibold">CHILD</span>
                  <input
                    type="number"
                    min="0"
                    value={pax.child}
                    onChange={(e) => setPax({ ...pax, child: e.target.value })}
                    className="w-full text-center text-xs font-bold border-none p-0 focus:ring-0"
                    placeholder="0"
                  />
                </div>
                <div className="bg-white p-2 rounded border border-blue-100">
                  <span className="block text-[10px] text-gray-500 font-semibold">INFANT</span>
                  <input
                    type="number"
                    min="0"
                    value={pax.infant}
                    onChange={(e) => setPax({ ...pax, infant: e.target.value })}
                    className="w-full text-center text-xs font-bold border-none p-0 focus:ring-0"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-gray-500 font-medium">Dep Airline & Flight</span>
                  <input
                    type="text"
                    placeholder="SV 701"
                    value={`${depFlight.airline || ''} ${depFlight.flight_no || ''}`.trim()}
                    onChange={(e) => {
                      const parts = e.target.value.split(' ')
                      setDepFlight({ ...depFlight, airline: parts[0] || '', flight_no: parts.slice(1).join(' ') })
                    }}
                    className="w-full text-xs font-semibold bg-white border border-gray-200 rounded px-2 py-1"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 font-medium">Departure Sector & Date</span>
                  <input
                    type="text"
                    placeholder="KHI JED | 10-Dec"
                    value={`${depFlight.sector || ''} ${depFlight.date || ''}`.trim()}
                    onChange={(e) => {
                      const parts = e.target.value.split(' ')
                      setDepFlight({ ...depFlight, sector: parts[0] || '', date: parts.slice(1).join(' ') })
                    }}
                    className="w-full text-xs font-semibold bg-white border border-gray-200 rounded px-2 py-1"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* CARD 2: PACKAGE CARD SCANNER */}
          <div className="bg-white border border-purple-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                    <i className="ti ti-package text-base" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide">2. Package Sheet Card</h3>
                    <p className="text-[11px] text-gray-500">Scan package sheet to extract hotels, visa, transport & totals</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {scanningPackage ? (
                    <span className="text-xs text-purple-600 font-semibold animate-pulse flex items-center gap-1">
                      <i className="ti ti-loader animate-spin" /> Scanning Sheet...
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleClearPackage}
                      className="text-xs font-semibold text-gray-500 hover:text-red-600 flex items-center gap-1 bg-gray-100 hover:bg-red-50 px-2.5 py-1 rounded-md transition-all"
                      title="Clear Package Sheet details"
                    >
                      <i className="ti ti-rotate-clockwise" /> Reset Package
                    </button>
                  )}
                </div>
              </div>

              <input
                type="file"
                ref={packageFileRef}
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) processPackageImage(e.target.files[0])
                }}
              />

              <div className="flex items-center gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => packageFileRef.current?.click()}
                  disabled={scanningPackage}
                  className="flex-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-semibold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <i className="ti ti-upload text-sm" />
                  Upload Package Image
                </button>
                <button
                  type="button"
                  onClick={() => openCamera('package')}
                  disabled={scanningPackage}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
                >
                  <i className="ti ti-camera text-sm" />
                  Capture Package Camera
                </button>
              </div>

              {packagePreviewImg && (
                <div className="mb-3 relative rounded-lg overflow-hidden border border-purple-200 h-24 bg-gray-900">
                  <img src={packagePreviewImg} alt="Package preview" className="w-full h-full object-cover opacity-85" />
                  <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded">
                    Package Sheet Scanned
                  </div>
                </div>
              )}
            </div>

            {/* Package Quick Totals Summary */}
            <div className="space-y-2 bg-purple-50/50 p-3 rounded-lg border border-purple-100">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-gray-500 font-medium">Package Only Total</span>
                  <input
                    type="text"
                    placeholder="AMOUNT"
                    value={totals.package_only}
                    onChange={(e) => setTotals({ ...totals, package_only: e.target.value })}
                    className="w-full text-xs font-bold text-purple-900 bg-white border border-gray-200 rounded px-2 py-1"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 font-medium">Total Package with Ticket</span>
                  <input
                    type="text"
                    placeholder="AMOUNT"
                    value={totals.package_with_ticket}
                    onChange={(e) => setTotals({ ...totals, package_with_ticket: e.target.value })}
                    className="w-full text-xs font-bold text-emerald-900 bg-white border border-gray-200 rounded px-2 py-1"
                  />
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* FULL DETAILED FORM SECTION (MATCHING PACKAGE PAGE FORMAT) */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2 flex items-center gap-1.5">
            <i className="ti ti-clipboard-text text-blue-600" />
            Complete Client Package Details Sheet
          </h3>

          {/* FLIGHT DETAILS TABLE */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Flight Details</p>
              <button type="button" onClick={handleClearTicket} className="text-[11px] font-semibold text-gray-500 hover:text-red-600 flex items-center gap-1">
                <i className="ti ti-rotate-clockwise" /> Reset Ticket Section
              </button>
            </div>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-100 text-gray-600 font-semibold border-b border-gray-200">
                  <tr>
                    <th className="p-2">TYPE</th>
                    <th className="p-2">AIRLINE</th>
                    <th className="p-2">FLIGHT NO</th>
                    <th className="p-2">SECTOR</th>
                    <th className="p-2">DATE</th>
                    <th className="p-2">DEP TIME</th>
                    <th className="p-2">ARR TIME</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  <tr>
                    <td className="p-2 font-bold text-gray-700">DEPARTURE</td>
                    <td className="p-2"><input type="text" value={depFlight.airline} onChange={(e) => setDepFlight({ ...depFlight, airline: e.target.value })} placeholder="SV" className="w-full border rounded px-1.5 py-1 text-xs" /></td>
                    <td className="p-2"><input type="text" value={depFlight.flight_no} onChange={(e) => setDepFlight({ ...depFlight, flight_no: e.target.value })} placeholder="701" className="w-full border rounded px-1.5 py-1 text-xs" /></td>
                    <td className="p-2"><input type="text" value={depFlight.sector} onChange={(e) => setDepFlight({ ...depFlight, sector: e.target.value })} placeholder="KHI JED" className="w-full border rounded px-1.5 py-1 text-xs" /></td>
                    <td className="p-2"><input type="text" value={depFlight.date} onChange={(e) => setDepFlight({ ...depFlight, date: e.target.value })} placeholder="10-Dec" className="w-full border rounded px-1.5 py-1 text-xs" /></td>
                    <td className="p-2"><input type="text" value={depFlight.dep_time} onChange={(e) => setDepFlight({ ...depFlight, dep_time: e.target.value })} placeholder="22.05" className="w-full border rounded px-1.5 py-1 text-xs" /></td>
                    <td className="p-2"><input type="text" value={depFlight.arr_time} onChange={(e) => setDepFlight({ ...depFlight, arr_time: e.target.value })} placeholder="23.59" className="w-full border rounded px-1.5 py-1 text-xs" /></td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold text-gray-700">ARRIVAL</td>
                    <td className="p-2"><input type="text" value={arrFlight.airline} onChange={(e) => setArrFlight({ ...arrFlight, airline: e.target.value })} placeholder="SV" className="w-full border rounded px-1.5 py-1 text-xs" /></td>
                    <td className="p-2"><input type="text" value={arrFlight.flight_no} onChange={(e) => setArrFlight({ ...arrFlight, flight_no: e.target.value })} placeholder="702" className="w-full border rounded px-1.5 py-1 text-xs" /></td>
                    <td className="p-2"><input type="text" value={arrFlight.sector} onChange={(e) => setArrFlight({ ...arrFlight, sector: e.target.value })} placeholder="MED KHI" className="w-full border rounded px-1.5 py-1 text-xs" /></td>
                    <td className="p-2"><input type="text" value={arrFlight.date} onChange={(e) => setArrFlight({ ...arrFlight, date: e.target.value })} placeholder="30-Dec" className="w-full border rounded px-1.5 py-1 text-xs" /></td>
                    <td className="p-2"><input type="text" value={arrFlight.dep_time} onChange={(e) => setArrFlight({ ...arrFlight, dep_time: e.target.value })} placeholder="22.05" className="w-full border rounded px-1.5 py-1 text-xs" /></td>
                    <td className="p-2"><input type="text" value={arrFlight.arr_time} onChange={(e) => setArrFlight({ ...arrFlight, arr_time: e.target.value })} placeholder="23.59" className="w-full border rounded px-1.5 py-1 text-xs" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* VISA & TRANSPORTATION GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* VISA */}
            <div className="border border-gray-200 rounded-lg p-3 space-y-2">
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Visa Details</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-[10px] text-gray-500 font-medium">VISA TYPE</span>
                  <input type="text" value={visa.type} onChange={(e) => setVisa({ ...visa, type: e.target.value })} placeholder="UMRAH" className="w-full border rounded px-2 py-1 text-xs font-semibold" />
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 font-medium">QTY</span>
                  <input type="number" value={visa.qty} onChange={(e) => setVisa({ ...visa, qty: e.target.value })} placeholder="3" className="w-full border rounded px-2 py-1 text-xs" />
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 font-medium">PRICE</span>
                  <input type="text" value={visa.price} onChange={(e) => setVisa({ ...visa, price: e.target.value })} placeholder="600" className="w-full border rounded px-2 py-1 text-xs font-semibold" />
                </div>
              </div>
            </div>

            {/* TRANSPORTATION */}
            <div className="border border-gray-200 rounded-lg p-3 space-y-2">
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Transportation Details</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-[10px] text-gray-500 font-medium">TYPE</span>
                  <input type="text" value={transport.type} onChange={(e) => setTransport({ ...transport, type: e.target.value })} placeholder="BY CAR" className="w-full border rounded px-2 py-1 text-xs font-semibold" />
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 font-medium">QTY</span>
                  <input type="number" value={transport.qty} onChange={(e) => setTransport({ ...transport, qty: e.target.value })} placeholder="1" className="w-full border rounded px-2 py-1 text-xs" />
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 font-medium">SECTOR</span>
                  <input type="text" value={transport.sector} onChange={(e) => setTransport({ ...transport, sector: e.target.value })} placeholder="MAK AIRPORT - MAK - MED" className="w-full border rounded px-2 py-1 text-xs" />
                </div>
              </div>
            </div>
          </div>

          {/* HOTEL DETAILS (MAKKAH & MADINA) */}
          <div className="space-y-3">
            {/* MAKKAH HOTELS */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">Makkah Hotel Details</p>
                <button type="button" onClick={addMakkahRow} className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                  <i className="ti ti-plus" /> Add Hotel Row
                </button>
              </div>
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-amber-50 text-amber-900 font-semibold border-b border-gray-200">
                    <tr>
                      <th className="p-2">HOTEL NAME</th>
                      <th className="p-2 w-16">ROOM QTY</th>
                      <th className="p-2 w-24">ROOM TYPE</th>
                      <th className="p-2">CHECK IN</th>
                      <th className="p-2">CHECK OUT</th>
                      <th className="p-2 w-16">NIGHTS</th>
                      <th className="p-2 w-24">NIGHT PRICE</th>
                      <th className="p-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {makkahHotels.map((h, i) => (
                      <tr key={i}>
                        <td className="p-2"><input type="text" value={h.hotel_name} onChange={(e) => { const copy = [...makkahHotels]; copy[i].hotel_name = e.target.value; setMakkahHotels(copy) }} placeholder="MAKKAH TOWER" className="w-full border rounded px-2 py-1 text-xs" /></td>
                        <td className="p-2"><input type="number" value={h.room_qty} onChange={(e) => { const copy = [...makkahHotels]; copy[i].room_qty = e.target.value; setMakkahHotels(copy) }} placeholder="1" className="w-full border rounded px-1.5 py-1 text-xs" /></td>
                        <td className="p-2"><input type="text" value={h.room_type} onChange={(e) => { const copy = [...makkahHotels]; copy[i].room_type = e.target.value; setMakkahHotels(copy) }} placeholder="TRPL" className="w-full border rounded px-1.5 py-1 text-xs" /></td>
                        <td className="p-2"><input type="text" value={h.check_in} onChange={(e) => { const copy = [...makkahHotels]; copy[i].check_in = e.target.value; setMakkahHotels(copy) }} placeholder="20-Jun" className="w-full border rounded px-1.5 py-1 text-xs" /></td>
                        <td className="p-2"><input type="text" value={h.check_out} onChange={(e) => { const copy = [...makkahHotels]; copy[i].check_out = e.target.value; setMakkahHotels(copy) }} placeholder="30-Jun" className="w-full border rounded px-1.5 py-1 text-xs" /></td>
                        <td className="p-2"><input type="number" value={h.nights} onChange={(e) => { const copy = [...makkahHotels]; copy[i].nights = e.target.value; setMakkahHotels(copy) }} placeholder="10" className="w-full border rounded px-1.5 py-1 text-xs" /></td>
                        <td className="p-2"><input type="text" value={h.night_price} onChange={(e) => { const copy = [...makkahHotels]; copy[i].night_price = e.target.value; setMakkahHotels(copy) }} placeholder="550" className="w-full border rounded px-1.5 py-1 text-xs font-semibold" /></td>
                        <td className="p-2 text-center">
                          {makkahHotels.length > 1 && (
                            <button type="button" onClick={() => removeMakkahRow(i)} className="text-red-500 hover:text-red-700">
                              <i className="ti ti-trash" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* MADINA HOTELS */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Madina Hotel Details</p>
                <button type="button" onClick={addMadinaRow} className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                  <i className="ti ti-plus" /> Add Hotel Row
                </button>
              </div>
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-emerald-50 text-emerald-900 font-semibold border-b border-gray-200">
                    <tr>
                      <th className="p-2">HOTEL NAME</th>
                      <th className="p-2 w-16">ROOM QTY</th>
                      <th className="p-2 w-24">ROOM TYPE</th>
                      <th className="p-2">CHECK IN</th>
                      <th className="p-2">CHECK OUT</th>
                      <th className="p-2 w-16">NIGHTS</th>
                      <th className="p-2 w-24">NIGHT PRICE</th>
                      <th className="p-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {madinaHotels.map((h, i) => (
                      <tr key={i}>
                        <td className="p-2"><input type="text" value={h.hotel_name} onChange={(e) => { const copy = [...madinaHotels]; copy[i].hotel_name = e.target.value; setMadinaHotels(copy) }} placeholder="MADINA HILTON" className="w-full border rounded px-2 py-1 text-xs" /></td>
                        <td className="p-2"><input type="number" value={h.room_qty} onChange={(e) => { const copy = [...madinaHotels]; copy[i].room_qty = e.target.value; setMadinaHotels(copy) }} placeholder="1" className="w-full border rounded px-1.5 py-1 text-xs" /></td>
                        <td className="p-2"><input type="text" value={h.room_type} onChange={(e) => { const copy = [...madinaHotels]; copy[i].room_type = e.target.value; setMadinaHotels(copy) }} placeholder="TRPL" className="w-full border rounded px-1.5 py-1 text-xs" /></td>
                        <td className="p-2"><input type="text" value={h.check_in} onChange={(e) => { const copy = [...madinaHotels]; copy[i].check_in = e.target.value; setMadinaHotels(copy) }} placeholder="30-Jun" className="w-full border rounded px-1.5 py-1 text-xs" /></td>
                        <td className="p-2"><input type="text" value={h.check_out} onChange={(e) => { const copy = [...madinaHotels]; copy[i].check_out = e.target.value; setMadinaHotels(copy) }} placeholder="10-Jul" className="w-full border rounded px-1.5 py-1 text-xs" /></td>
                        <td className="p-2"><input type="number" value={h.nights} onChange={(e) => { const copy = [...madinaHotels]; copy[i].nights = e.target.value; setMadinaHotels(copy) }} placeholder="10" className="w-full border rounded px-1.5 py-1 text-xs" /></td>
                        <td className="p-2"><input type="text" value={h.night_price} onChange={(e) => { const copy = [...madinaHotels]; copy[i].night_price = e.target.value; setMadinaHotels(copy) }} placeholder="700" className="w-full border rounded px-1.5 py-1 text-xs font-semibold" /></td>
                        <td className="p-2 text-center">
                          {madinaHotels.length > 1 && (
                            <button type="button" onClick={() => removeMadinaRow(i)} className="text-red-500 hover:text-red-700">
                              <i className="ti ti-trash" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* PACKAGE PRICING & TOTALS SECTION */}
          <div className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50/50">
            <p className="text-xs font-bold text-gray-800 uppercase tracking-wide">Package Pricing & Totals</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-white p-3 rounded-lg border border-purple-200 shadow-xs">
                <label className="block text-[11px] font-bold text-purple-900 uppercase tracking-wider mb-1">
                  TOTAL PACKAGE ONLY
                </label>
                <input
                  type="text"
                  placeholder="AMOUNT"
                  value={totals.package_only}
                  onChange={(e) => setTotals({ ...totals, package_only: e.target.value })}
                  className="w-full border border-purple-300 rounded-lg px-3 py-1.5 text-xs font-black text-purple-950 focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="bg-white p-3 rounded-lg border border-emerald-200 shadow-xs">
                <label className="block text-[11px] font-bold text-emerald-900 uppercase tracking-wider mb-1">
                  TOTAL PACKAGE WITH TICKET
                </label>
                <input
                  type="text"
                  placeholder="AMOUNT"
                  value={totals.package_with_ticket}
                  onChange={(e) => setTotals({ ...totals, package_with_ticket: e.target.value })}
                  className="w-full border border-emerald-300 rounded-lg px-3 py-1.5 text-xs font-black text-emerald-950 focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* COMMENTS BOX */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">Comment Box</label>
            <textarea
              rows="2"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Special client requirements, inclusions, or payment notes..."
              className="w-full border border-gray-300 rounded-lg p-2.5 text-xs text-gray-800 focus:ring-2 focus:ring-blue-500"
            ></textarea>
          </div>

          {/* BOTTOM SAVE BUTTON */}
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-3">
            <button
              type="button"
              onClick={handleSaveClient}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-lg shadow-sm flex items-center gap-2 transition-all"
            >
              <i className="ti ti-device-floppy text-base" />
              {editingId ? 'Update Client Record' : 'Save Changes'}
            </button>
          </div>
        </div>

      </main>

      {/* CAMERA CAPTURE MODAL */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <i className="ti ti-camera text-blue-600" />
                Capture {cameraTarget === 'ticket' ? 'Travel Itinerary Ticket' : 'Package Sheet'}
              </h4>
              <button onClick={stopCamera} className="text-gray-400 hover:text-gray-600">
                <i className="ti ti-x text-lg" />
              </button>
            </div>
            <div className="relative bg-black rounded-xl overflow-hidden aspect-video flex items-center justify-center">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={stopCamera}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold py-2.5 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={capturePhoto}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 rounded-lg shadow-md flex items-center justify-center gap-2"
              >
                <i className="ti ti-camera" /> Capture & Process AI
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT PRINTABLE MODAL / TEMPLATE FOR PDF */}
      {showPrintModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPrintModal(false)
          }}
        >
          <div className="bg-white rounded-xl max-w-4xl w-full p-5 space-y-4 shadow-2xl my-8 relative">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-gray-900">
                Client Package Printable Voucher ({showPrintModal === 'color' ? 'Color PDF' : 'Standard Grid'})
              </h3>
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
              <StandardPdfTemplate 
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
            )}

          </div>
        </div>
      )}

    </div>
  )
}
