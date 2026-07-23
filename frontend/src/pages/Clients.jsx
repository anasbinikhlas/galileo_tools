import React, { useState, useRef, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
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
  "adt_price": 0,
  "child": 0,
  "child_price": 0,
  "infant": 0,
  "infant_price": 0,
  "ticket_total": 0,
  "flights": [
    {
      "type": "DEPARTURE",
      "airline": "",
      "flight_no": "",
      "sector": "",
      "date": "",
      "dep_time": "",
      "arr_time": ""
    },
    {
      "type": "ARRIVAL",
      "airline": "",
      "flight_no": "",
      "sector": "",
      "date": "",
      "dep_time": "",
      "arr_time": ""
    }
  ]
}

Rules:
- "name": Extract the first or primary passenger full name available in the reservation/ticket (e.g. "ANAS", "MOHAMMAD ALAM", "JOHN DOE").
- "date": Extract the booking or travel issue date. If not found, use departure date.
- "adt", "child", "infant": Count ADT (Adults), CHILD (Children), and INFANT (Infants). Extract individual passenger ticket prices/fares if present.
- "flights": Extract EVERY flight leg/segment present in the ticket (can be 1, 2, 3, 4, 5, 6, 7 or more lines).
- Set empty string "" or 0 for unreadable fields.`

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
      throw new Error('No JSON structure found in ticket AI response')
    }
    const cleanJson = text.substring(startIdx, endIdx + 1)
    return JSON.parse(cleanJson)
  }

  const errBody = await response.json().catch(() => ({}))
  const msg = errBody.error?.message || `Google API returned status ${response.status}`
  throw new Error(msg)
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
  "adt_price": 0,
  "child": 0,
  "child_price": 0,
  "infant": 0,
  "infant_price": 0,
  "ticket_total": 0,
  "flights": [
    {
      "type": "DEPARTURE",
      "airline": "",
      "flight_no": "",
      "sector": "",
      "date": "",
      "dep_time": "",
      "arr_time": ""
    },
    {
      "type": "ARRIVAL",
      "airline": "",
      "flight_no": "",
      "sector": "",
      "date": "",
      "dep_time": "",
      "arr_time": ""
    }
  ],
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
    "sector": "",
    "price": 0
  },
  "totals": {
    "package_only": "",
    "package_with_ticket": ""
  },
  "comments": ""
}

Rules:
- Read numbers carefully (ADT, Child, Infant, Night Price, Room Qty, Transport Price).
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
    reader.onload = () => resolve(reader.result.result ? reader.result.split(',')[1] : '')
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

  // ── ALL STATE DECLARATIONS FIRST ──
  const [editingId, setEditingId] = useState(null)
  const [status, setStatus] = useState('Pending') // 'Pending' | 'Completed'

  const [header, setHeader] = useState({
    sr_no: '01',
    name: '',
    date: new Date().toISOString().slice(0, 10),
  })

  // Passenger state with ADT, Child, Infant counts + Prices + Ticket Total
  const [pax, setPax] = useState({
    adt: '',
    adt_price: '',
    child: '',
    child_price: '',
    infant: '',
    infant_price: '',
    ticket_total: '',
  })

  // Multi-line Flight Itinerary List (Supports 1, 2, 3, 5, 6, 7 or more flight lines)
  const [flightItinerary, setFlightItinerary] = useState([])

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

  // Currency Conversion Rate / Multiplier State
  const [conversionRate, setConversionRate] = useState('')

  const [totals, setTotals] = useState({
    package_only: '',
    package_with_ticket: '',
  })

  const [comments, setComments] = useState('')

  // ── SCANNER & API CONTROLS ──
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

  // ── REAL-TIME REACTIVE LIVE CALCULATION MATH WITH CONVERSION RATE ──
  
  // 1. Live Ticket Total Calculation
  const computedTicketTotal = (Number(pax.adt || 0) * Number(pax.adt_price || 0)) + 
                              (Number(pax.child || 0) * Number(pax.child_price || 0)) + 
                              (Number(pax.infant || 0) * Number(pax.infant_price || 0))

  const activeTicketTotal = (pax.ticket_total !== '' && pax.ticket_total !== undefined && pax.ticket_total !== '0' && pax.ticket_total !== 0)
    ? pax.ticket_total 
    : (computedTicketTotal > 0 ? String(computedTicketTotal) : (pax.ticket_total || ''))

  const totalPax = Number(pax.adt || 0) + Number(pax.child || 0) + Number(pax.infant || 0)

  // 2. Live Visa Card Total (Visa Qty x Visa Price)
  const visaTotal = Number(visa.qty || 1) * Number(visa.price || 0)

  // 3. Live Makkah Hotels Total (Room Qty x Nights x Night Price)
  const makkahTotal = makkahHotels.reduce((sum, h) => {
    const qty = Number(h.room_qty || 1)
    const calcN = calculateNightsFromDates(h.check_in, h.check_out)
    const nights = Number(h.nights) > 0 ? Number(h.nights) : (calcN > 0 ? calcN : 1)
    const price = Number(h.night_price || 0)
    return sum + (qty * nights * price)
  }, 0)

  // 4. Live Madina Hotels Total (Room Qty x Nights x Night Price)
  const madinaTotal = madinaHotels.reduce((sum, h) => {
    const qty = Number(h.room_qty || 1)
    const calcN = calculateNightsFromDates(h.check_in, h.check_out)
    const nights = Number(h.nights) > 0 ? Number(h.nights) : (calcN > 0 ? calcN : 1)
    const price = Number(h.night_price || 0)
    return sum + (qty * nights * price)
  }, 0)

  // 5. Live Transportation Card Total (Sum of Qty x Price across all rows)
  const transportTotal = transportRows.reduce((sum, t) => sum + (Number(t.qty || 1) * Number(t.price || 0)), 0)

  // 6. Base Foreign Package Sum (Visa + Makkah + Madina + Transport)
  const basePackageOnlySum = visaTotal + makkahTotal + madinaTotal + transportTotal

  // Conversion Multiplier (Defaults to 1 if empty or 0)
  const rateMultiplier = Number(conversionRate) > 0 ? Number(conversionRate) : 1

  // Computed Package Only after Conversion Rate Multiplier
  const computedPackageOnly = basePackageOnlySum * rateMultiplier

  const activePackageOnly = totals.package_only !== '' && totals.package_only !== undefined
    ? totals.package_only
    : (computedPackageOnly > 0 ? String(computedPackageOnly) : '')

  // 7. Live Auto-Calculated Package With Ticket = (Package Only + Ticket Total)
  // ONLY calculate when BOTH Package Card (> 0) AND Ticket Card (> 0) have valid amounts!
  const currentTicketVal = Number(activeTicketTotal || 0)
  const currentPkgOnlyVal = Number(activePackageOnly || 0)
  const bothCardsHaveAmount = currentPkgOnlyVal > 0 && currentTicketVal > 0

  const computedPackageWithTicket = bothCardsHaveAmount
    ? (currentPkgOnlyVal + currentTicketVal)
    : 0

  const activePackageWithTicket = (totals.package_with_ticket !== '' && totals.package_with_ticket !== undefined && totals.package_with_ticket !== '0')
    ? (bothCardsHaveAmount ? totals.package_with_ticket : '')
    : (bothCardsHaveAmount ? String(computedPackageWithTicket) : '')

  // Helper function to force auto-recalculation reset
  const handleAutoRecalculateTotals = () => {
    const calcTicket = computedTicketTotal > 0 ? String(computedTicketTotal) : ''
    const calcPkgOnly = computedPackageOnly > 0 ? String(computedPackageOnly) : ''
    const calcPkgWithTicket = (computedTicketTotal > 0 && computedPackageOnly > 0)
      ? String(computedPackageOnly + computedTicketTotal)
      : ''

    setPax(p => ({ ...p, ticket_total: calcTicket }))
    setTotals({
      package_only: calcPkgOnly,
      package_with_ticket: calcPkgWithTicket
    })
    toast.success('Package totals auto-recalculated live!', { id: 'auto-recalc' })
  }

  // ── OCR & PROCESSOR HANDLERS ──
  const processTicketImage = async (file) => {
    if (!file) return
    setScanningTicket(true)
    setTicketPreviewImg(URL.createObjectURL(file))
    try {
      const base64 = await fileToBase64(file)
      const data = await scanTicketWithGemini(base64, file.type, userApiKey)
      
      if (data.name) {
        setHeader(h => ({ ...h, name: data.name }))
      }
      if (data.date) {
        setHeader(h => ({ ...h, date: data.date }))
      }
      
      setPax(p => ({
        ...p,
        adt: data.adt ?? p.adt,
        adt_price: data.adt_price ?? p.adt_price,
        child: data.child ?? p.child,
        child_price: data.child_price ?? p.child_price,
        infant: data.infant ?? p.infant,
        infant_price: data.infant_price ?? p.infant_price,
        ticket_total: data.ticket_total ?? p.ticket_total
      }))

      if (Array.isArray(data.flights) && data.flights.length > 0) {
        setFlightItinerary(data.flights)
      }

      toast.success(`Ticket scanned! Passenger "${data.name || 'Lead Pax'}" extracted (${data.flights?.length || 1} flight legs).`, { id: 'ticket-ocr-success' })
    } catch (e) {
      console.error('Ticket OCR error:', e)
      toast.error(`Ticket scan failed: ${e.message || 'Check image clarity.'}`, { id: 'ticket-ocr-err' })
    } finally {
      setScanningTicket(false)
    }
  }

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

      if (Array.isArray(data.flights) && data.flights.length > 0) {
        setFlightItinerary(data.flights)
      }

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

      toast.success('Package sheet details extracted! Review and hit Save Changes to update client record.', { id: 'pkg-ocr-success' })
    } catch (e) {
      console.error('Package OCR error:', e)
      toast.error(`Package scan failed: ${e.message || 'Check image clarity.'}`, { id: 'pkg-ocr-err' })
    } finally {
      setScanningPackage(false)
    }
  }

  // ── CLIPBOARD BUTTON HANDLER ──
  const handlePasteFromClipboard = async (target) => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.read) {
        toast('Direct clipboard reading restricted. Please press Ctrl+V to paste your screenshot!', { icon: '📋' })
        return
      }
      const clipboardItems = await navigator.clipboard.read()
      let imageFound = false
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type)
            const file = new File([blob], `pasted-screenshot-${Date.now()}.png`, { type })
            imageFound = true
            if (target === 'ticket') {
              processTicketImage(file)
            } else {
              processPackageImage(file)
            }
            break
          }
        }
        if (imageFound) break
      }
      if (!imageFound) {
        toast.error('No image screenshot found in clipboard. Copy an image first or press Ctrl+V.')
      }
    } catch (err) {
      toast('Please press Ctrl+V to paste your screenshot anywhere on the page!', { icon: '📋' })
    }
  }

  // ── USE EFFECTS (AFTER FUNCTIONS AND STATES ARE DECLARED) ──
  useEffect(() => {
    if (editIdParam && savedClients.length > 0) {
      const target = savedClients.find(c => c.id === editIdParam)
      if (target) {
        setEditingId(target.id)
        setStatus(target.status || 'Pending')
        setHeader({
          sr_no: target.sr_no || '01',
          name: target.name || '',
          phone: target.phone || target.header?.phone || '',
          whatsapp: target.whatsapp || target.header?.whatsapp || '',
          email: target.email || target.header?.email || '',
          date: target.date || ''
        })
        setPax(target.pax || { adt: '', adt_price: '', child: '', child_price: '', infant: '', infant_price: '', ticket_total: '' })
        
        if (Array.isArray(target.flightItinerary) && target.flightItinerary.length > 0) {
          setFlightItinerary(target.flightItinerary)
        } else if (target.depFlight || target.arrFlight) {
          setFlightItinerary([
            { type: 'DEPARTURE', ...(target.depFlight || {}) },
            { type: 'ARRIVAL', ...(target.arrFlight || {}) }
          ])
        }
        
        setVisa(target.visa || { type: 'UMRAH', qty: '', price: '' })
        setMakkahHotels(target.makkahHotels || [{ hotel_name: '', room_qty: '', room_type: '', check_in: '', check_out: '', nights: '', night_price: '' }])
        setMadinaHotels(target.madinaHotels || [{ hotel_name: '', room_qty: '', room_type: '', check_in: '', check_out: '', nights: '', night_price: '' }])
        
        if (Array.isArray(target.transportRows) && target.transportRows.length > 0) {
          setTransportRows(target.transportRows)
        } else if (target.transport) {
          setTransportRows([target.transport])
        } else {
          setTransportRows([{ type: '', qty: '', sector: '', price: '' }])
        }
        
        setConversionRate(target.conversionRate || '')
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

  // GLOBAL CLIPBOARD PASTE EVENT LISTENER (Ctrl+V Image Paste)
  useEffect(() => {
    const handleGlobalPaste = (e) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile()
          if (file) {
            e.preventDefault()
            toast((t) => (
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-900">Clipboard Image Detected! Select destination scanner:</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      toast.dismiss(t.id)
                      processTicketImage(file)
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm"
                  >
                    1. Scan Travel Ticket
                  </button>
                  <button
                    onClick={() => {
                      toast.dismiss(t.id)
                      processPackageImage(file)
                    }}
                    className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm"
                  >
                    2. Scan Package Sheet
                  </button>
                </div>
              </div>
            ), { duration: 8000, id: 'paste-detected' })
            break
          }
        }
      }
    }

    window.addEventListener('paste', handleGlobalPaste)
    return () => window.removeEventListener('paste', handleGlobalPaste)
  }, [userApiKey])

  // Dynamic Flight Itinerary Operations
  const addFlightRow = () => {
    setFlightItinerary(prev => [
      ...prev,
      { type: `FLIGHT ${prev.length + 1}`, airline: '', flight_no: '', sector: '', date: '', dep_time: '', arr_time: '' }
    ])
  }

  const removeFlightRow = (idx) => {
    if (flightItinerary.length <= 1) {
      toast.error('At least 1 flight line is required.')
      return
    }
    setFlightItinerary(prev => prev.filter((_, i) => i !== idx))
  }

  const updateFlightRow = (idx, field, value) => {
    setFlightItinerary(prev => prev.map((f, i) => i === idx ? { ...f, [field]: value } : f))
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
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (!blob) return
      const file = new File([blob], `camera-capture-${Date.now()}.png`, { type: 'image/png' })
      closeCamera()
      if (cameraTarget === 'ticket') {
        processTicketImage(file)
      } else {
        processPackageImage(file)
      }
    }, 'image/png')
  }

  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop())
      setCameraStream(null)
    }
    setCameraOpen(false)
  }

  // Row operations for Makkah / Madina Hotels
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

  // Section clear handlers
  const handleClearTicket = () => {
    setPax({ adt: '', adt_price: '', child: '', child_price: '', infant: '', infant_price: '', ticket_total: '' })
    setFlightItinerary([])
    setTicketPreviewImg(null)
    toast.success('Travel Ticket details reset', { id: 'clear-ticket' })
  }

  const handleClearPackage = () => {
    setVisa({ type: '', qty: '', price: '' })
    setMakkahHotels([{ hotel_name: '', room_qty: '', room_type: '', check_in: '', check_out: '', nights: '', night_price: '' }])
    setMadinaHotels([{ hotel_name: '', room_qty: '', room_type: '', check_in: '', check_out: '', nights: '', night_price: '' }])
    setTransportRows([{ type: '', qty: '', sector: '', price: '' }])
    setConversionRate('')
    setTotals({ package_only: '', package_with_ticket: '' })
    setComments('')
    setPackagePreviewImg(null)
    toast.success('Package sheet details reset', { id: 'clear-package' })
  }

  const handleClearForm = () => {
    setEditingId(null)
    setStatus('Pending')
    setHeader({ sr_no: (savedClients.length + 1).toString().padStart(2, '0'), name: '', phone: '', whatsapp: '', email: '', date: getTodayDateFormatted() })
    setPax({ adt: '', adt_price: '', child: '', child_price: '', infant: '', infant_price: '', ticket_total: '' })
    setFlightItinerary([])
    setVisa({ type: '', qty: '', price: '' })
    setMakkahHotels([{ hotel_name: '', room_qty: '', room_type: '', check_in: '', check_out: '', nights: '', night_price: '' }])
    setMadinaHotels([{ hotel_name: '', room_qty: '', room_type: '', check_in: '', check_out: '', nights: '', night_price: '' }])
    setTransportRows([{ type: '', qty: '', sector: '', price: '' }])
    setConversionRate('')
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

    const finalTicketTotal = activeTicketTotal || (computedTicketTotal > 0 ? String(computedTicketTotal) : '')
    const finalPkgOnly = activePackageOnly || (computedPackageOnly > 0 ? String(computedPackageOnly) : '')
    const finalPkgWithTicket = activePackageWithTicket || (computedPackageWithTicket > 0 ? String(computedPackageWithTicket) : '')

    const clientRecord = {
      id: editingId || `cli-${Date.now()}`,
      sr_no: header.sr_no || '01',
      name: header.name,
      phone: header.phone || '',
      whatsapp: header.whatsapp || '',
      email: header.email || '',
      date: header.date || new Date().toISOString().slice(0, 10),
      status: status,
      pax: {
        ...pax,
        ticket_total: finalTicketTotal
      },
      flightItinerary,
      depFlight: flightItinerary[0] || {},
      arrFlight: flightItinerary[flightItinerary.length - 1] || {},
      visa,
      makkahHotels,
      madinaHotels,
      transportRows,
      transport: transportRows[0] || {},
      conversionRate,
      totals: {
        package_only: finalPkgOnly,
        package_with_ticket: finalPkgWithTicket
      },
      comments,
      updatedAt: new Date().toISOString(),
    }

    if (editingId) {
      setSavedClients(prev => prev.map(c => c.id === editingId ? clientRecord : c))
      toast.success(`Updated client record "${header.name}" with new changes!`, { id: 'update-success' })
    } else {
      setSavedClients(prev => [clientRecord, ...prev])
      setEditingId(clientRecord.id)
      toast.success(`Client "${header.name}" saved with status: ${status}`, { id: 'save-success' })
    }

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
      <main className="flex-1 overflow-y-auto max-w-6xl w-full mx-auto p-3 sm:p-5 pb-16 space-y-4">

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
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
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

          <div className="flex flex-wrap items-center gap-2">
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

        {/* CLIENT CONTACT SECTION */}
        <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-xs space-y-3">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
            <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <i className="ti ti-phone text-sm" />
            </div>
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Client Contact Section</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                <i className="ti ti-phone text-blue-600" /> Phone / Contact No
              </label>
              <input
                type="text"
                placeholder="PHONE NUMBER"
                value={header.phone || ''}
                onChange={(e) => setHeader({ ...header, phone: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                <i className="ti ti-brand-whatsapp text-emerald-600" /> WhatsApp Number
              </label>
              <input
                type="text"
                placeholder="WHATSAPP NUMBER"
                value={header.whatsapp || ''}
                onChange={(e) => setHeader({ ...header, whatsapp: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                <i className="ti ti-mail text-indigo-600" /> Email Address
              </label>
              <input
                type="text"
                placeholder="EMAIL ADDRESS"
                value={header.email || ''}
                onChange={(e) => setHeader({ ...header, email: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>
          </div>
        </div>

        {/* DUAL SCANNER CARDS GRID (WITH PASTE DIRECTLY OPTION) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* CARD 1: TRAVEL ITINERARY TICKET CARD */}
          <div className="bg-white border border-blue-200 rounded-xl p-4 shadow-sm flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <i className="ti ti-ticket text-base" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide">1. Travel Itinerary Ticket Card</h3>
                    <p className="text-[11px] text-gray-500">Scan or paste ticket screenshot to extract passenger, fares & flights</p>
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

              <div className="grid grid-cols-3 gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => ticketFileRef.current?.click()}
                  disabled={scanningTicket}
                  className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-bold py-2 px-2 rounded-lg flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                  title="Upload ticket image file"
                >
                  <i className="ti ti-upload text-sm" />
                  Upload
                </button>
                <button
                  type="button"
                  onClick={() => handlePasteFromClipboard('ticket')}
                  disabled={scanningTicket}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-bold py-2 px-2 rounded-lg flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                  title="Paste copied screenshot directly (Ctrl+V)"
                >
                  <i className="ti ti-clipboard text-sm" />
                  Paste Image
                </button>
                <button
                  type="button"
                  onClick={() => openCamera('ticket')}
                  disabled={scanningTicket}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold py-2 px-2 rounded-lg flex items-center justify-center gap-1 transition-all shadow-sm disabled:opacity-50"
                >
                  <i className="ti ti-camera text-sm" />
                  Camera
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

            {/* Ticket Card Fares & Passenger Counts (LIVE AUTO CALCULATED) */}
            <div className="space-y-2.5 bg-blue-50/50 p-3 rounded-lg border border-blue-100 text-xs">
              <div className="font-bold text-[11px] text-blue-900 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Passenger Fares & Quantities</span>
                <span className="text-[10px] text-blue-600 font-semibold bg-blue-100/80 px-2 py-0.5 rounded">
                  ⚡ Live Auto Calculating
                </span>
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white p-2 rounded-lg border border-blue-100 shadow-xs space-y-1">
                  <span className="block text-[10px] font-bold text-gray-500 uppercase">ADT (Adult)</span>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      min="0"
                      value={pax.adt}
                      onChange={(e) => setPax({ ...pax, adt: e.target.value })}
                      className="w-1/2 text-center text-xs font-bold border border-gray-200 rounded py-0.5"
                      placeholder="Qty"
                    />
                    <input
                      type="text"
                      value={pax.adt_price}
                      onChange={(e) => setPax({ ...pax, adt_price: e.target.value })}
                      className="w-1/2 text-center text-xs font-semibold border border-gray-200 rounded py-0.5"
                      placeholder="Fare"
                    />
                  </div>
                </div>

                <div className="bg-white p-2 rounded-lg border border-blue-100 shadow-xs space-y-1">
                  <span className="block text-[10px] font-bold text-gray-500 uppercase">CHILD</span>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      min="0"
                      value={pax.child}
                      onChange={(e) => setPax({ ...pax, child: e.target.value })}
                      className="w-1/2 text-center text-xs font-bold border border-gray-200 rounded py-0.5"
                      placeholder="Qty"
                    />
                    <input
                      type="text"
                      value={pax.child_price}
                      onChange={(e) => setPax({ ...pax, child_price: e.target.value })}
                      className="w-1/2 text-center text-xs font-semibold border border-gray-200 rounded py-0.5"
                      placeholder="Fare"
                    />
                  </div>
                </div>

                <div className="bg-white p-2 rounded-lg border border-blue-100 shadow-xs space-y-1">
                  <span className="block text-[10px] font-bold text-gray-500 uppercase">INFANT</span>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      min="0"
                      value={pax.infant}
                      onChange={(e) => setPax({ ...pax, infant: e.target.value })}
                      className="w-1/2 text-center text-xs font-bold border border-gray-200 rounded py-0.5"
                      placeholder="Qty"
                    />
                    <input
                      type="text"
                      value={pax.infant_price}
                      onChange={(e) => setPax({ ...pax, infant_price: e.target.value })}
                      className="w-1/2 text-center text-xs font-semibold border border-gray-200 rounded py-0.5"
                      placeholder="Fare"
                    />
                  </div>
                </div>
              </div>

              {/* Total Ticket Fare Box */}
              <div className="bg-blue-100/80 border border-blue-300 rounded-lg p-2.5 flex items-center justify-between">
                <div>
                  <span className="block text-[11px] font-extrabold text-blue-950 uppercase tracking-wider">
                    TOTAL TICKET FARE
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="AMOUNT"
                  value={activeTicketTotal}
                  onChange={(e) => setPax({ ...pax, ticket_total: e.target.value })}
                  className="w-32 text-right font-black text-xs text-blue-900 bg-white border border-blue-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* CARD 2: PACKAGE CARD SCANNER */}
          <div className="bg-white border border-purple-200 rounded-xl p-4 shadow-sm flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                    <i className="ti ti-package text-base" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide">2. Package Sheet Card</h3>
                    <p className="text-[11px] text-gray-500">Scan or paste package sheet screenshot to extract hotels, transport & totals</p>
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

              <div className="grid grid-cols-3 gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => packageFileRef.current?.click()}
                  disabled={scanningPackage}
                  className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-[11px] font-bold py-2 px-2 rounded-lg flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                  title="Upload package sheet file"
                >
                  <i className="ti ti-upload text-sm" />
                  Upload
                </button>
                <button
                  type="button"
                  onClick={() => handlePasteFromClipboard('package')}
                  disabled={scanningPackage}
                  className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-[11px] font-bold py-2 px-2 rounded-lg flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                  title="Paste copied screenshot directly (Ctrl+V)"
                >
                  <i className="ti ti-clipboard text-sm" />
                  Paste Image
                </button>
                <button
                  type="button"
                  onClick={() => openCamera('package')}
                  disabled={scanningPackage}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold py-2 px-2 rounded-lg flex items-center justify-center gap-1 transition-all shadow-sm disabled:opacity-50"
                >
                  <i className="ti ti-camera text-sm" />
                  Camera
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

            {/* Package Quick Totals Summary (LIVE AUTO CALCULATED) */}
            <div className="space-y-2 bg-purple-50/50 p-3 rounded-lg border border-purple-100">
              <div className="font-bold text-[11px] text-purple-900 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Quick Package Totals</span>
                <span className="text-[10px] text-purple-600 font-semibold bg-purple-100 px-2 py-0.5 rounded">
                  Live Sync
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-gray-500 font-medium">Package Only Total</span>
                  <input
                    type="text"
                    placeholder="AMOUNT"
                    value={activePackageOnly}
                    onChange={(e) => setTotals({ ...totals, package_only: e.target.value })}
                    className="w-full text-xs font-bold text-purple-900 bg-white border border-gray-200 rounded px-2 py-1"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 font-medium">Total Package with Ticket</span>
                  <input
                    type="text"
                    placeholder="AMOUNT"
                    value={activePackageWithTicket}
                    onChange={(e) => setTotals({ ...totals, package_with_ticket: e.target.value })}
                    className="w-full text-xs font-bold text-emerald-900 bg-white border border-gray-200 rounded px-2 py-1"
                  />
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* FULL DETAILED FORM SECTION (COMPLETE CLIENT PACKAGE DETAILS SHEET) */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2 flex items-center gap-1.5">
            <i className="ti ti-clipboard-text text-blue-600" />
            Complete Client Package Details Sheet
          </h3>

          {/* DYNAMIC FLIGHT DETAILS TABLE (2, 3, 5, 6, 7+ LINES SUPPORT) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                  Flight Details ({flightItinerary.length} {flightItinerary.length === 1 ? 'line' : 'lines'})
                </p>
                <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                  Dynamic Multi-Line Itinerary
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={addFlightRow}
                  className="text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-md transition-all flex items-center gap-1"
                >
                  <i className="ti ti-plus" /> Add Flight Line
                </button>
                <button
                  type="button"
                  onClick={handleClearTicket}
                  className="text-[11px] font-semibold text-gray-500 hover:text-red-600 flex items-center gap-1"
                >
                  <i className="ti ti-rotate-clockwise" /> Reset Flights
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-xs text-left min-w-[600px]">
                <thead className="bg-gray-100 text-gray-600 font-semibold border-b border-gray-200">
                  <tr>
                    <th className="p-2 w-12 text-center">#</th>
                    <th className="p-2 w-20">AIRLINE</th>
                    <th className="p-2 w-24">FLIGHT NO</th>
                    <th className="p-2">SECTOR</th>
                    <th className="p-2 w-24">DATE</th>
                    <th className="p-2 w-20">DEP TIME</th>
                    <th className="p-2 w-20">ARR TIME</th>
                    <th className="p-2 w-8 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {flightItinerary.map((fl, i) => (
                    <tr key={`flight-row-${i}`}>
                      <td className="p-2 text-center font-bold text-gray-700 bg-gray-50">
                        {i + 1}
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={fl.airline}
                          onChange={(e) => updateFlightRow(i, 'airline', e.target.value)}
                          placeholder="EY"
                          className="w-full border rounded px-1.5 py-1 text-xs uppercase font-semibold"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={fl.flight_no}
                          onChange={(e) => updateFlightRow(i, 'flight_no', e.target.value)}
                          placeholder="299"
                          className="w-full border rounded px-1.5 py-1 text-xs font-mono"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={fl.sector}
                          onChange={(e) => updateFlightRow(i, 'sector', e.target.value)}
                          placeholder="KHI AUH"
                          className="w-full border rounded px-1.5 py-1 text-xs font-semibold uppercase"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={fl.date}
                          onChange={(e) => updateFlightRow(i, 'date', e.target.value)}
                          placeholder="10SEP"
                          className="w-full border rounded px-1.5 py-1 text-xs"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={fl.dep_time}
                          onChange={(e) => updateFlightRow(i, 'dep_time', e.target.value)}
                          placeholder="0635"
                          className="w-full border rounded px-1.5 py-1 text-xs font-mono"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={fl.arr_time}
                          onChange={(e) => updateFlightRow(i, 'arr_time', e.target.value)}
                          placeholder="0745"
                          className="w-full border rounded px-1.5 py-1 text-xs font-mono"
                        />
                      </td>
                      <td className="p-2 text-center">
                        {flightItinerary.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeFlightRow(i)}
                            className="text-gray-400 hover:text-red-600 transition-colors"
                            title="Remove flight row"
                          >
                            <i className="ti ti-trash text-sm" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* VISA & TRANSPORTATION GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* VISA DETAILS */}
            <div className="border border-gray-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Visa Details</p>
                {visaTotal > 0 && <span className="text-[10px] font-bold text-blue-600">Total: {visaTotal.toLocaleString()}</span>}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-[10px] text-gray-500 font-medium">VISA TYPE</span>
                  <input type="text" value={visa.type} onChange={(e) => setVisa({ ...visa, type: e.target.value })} placeholder="Visa" className="w-full border rounded px-2 py-1 text-xs font-semibold" />
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 font-medium">QTY</span>
                  <input type="number" value={visa.qty} onChange={(e) => setVisa({ ...visa, qty: e.target.value })} placeholder="Qty" className="w-full border rounded px-2 py-1 text-xs text-center" />
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 font-medium">VISA PRICE</span>
                  <input type="text" value={visa.price} onChange={(e) => setVisa({ ...visa, price: e.target.value })} placeholder="Price" className="w-full border rounded px-2 py-1 text-xs font-semibold" />
                </div>
              </div>
            </div>

            {/* TRANSPORTATION DETAILS (MULTI-ROW SUPPORT) */}
            <div className="border border-gray-200 rounded-lg p-3 space-y-2 bg-blue-50/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-blue-900 uppercase tracking-wide">Transportation Details</p>
                  {transportTotal > 0 && <span className="text-[10px] font-bold text-blue-700">Total: {transportTotal.toLocaleString()}</span>}
                </div>
                <button type="button" onClick={addTransportRow} className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                  <i className="ti ti-plus" /> Add Transport Row
                </button>
              </div>
              <div className="space-y-2">
                {transportRows.map((t, i) => (
                  <div key={`trans-row-${i}`} className="grid grid-cols-12 gap-1.5 items-center">
                    <div className="col-span-3">
                      <span className="text-[10px] text-gray-500 font-medium block">TYPE</span>
                      <input
                        type="text"
                        value={t.type}
                        onChange={(e) => {
                          const copy = [...transportRows]
                          copy[i].type = e.target.value
                          setTransportRows(copy)
                        }}
                        placeholder="Transport Type"
                        className="w-full border rounded px-2 py-1 text-xs font-semibold"
                      />
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10px] text-gray-500 font-medium block">QTY</span>
                      <input
                        type="number"
                        value={t.qty}
                        onChange={(e) => {
                          const copy = [...transportRows]
                          copy[i].qty = e.target.value
                          setTransportRows(copy)
                        }}
                        placeholder="Qty"
                        className="w-full border rounded px-2 py-1 text-xs text-center"
                      />
                    </div>
                    <div className="col-span-4">
                      <span className="text-[10px] text-gray-500 font-medium block">SECTOR</span>
                      <input
                        type="text"
                        value={t.sector}
                        onChange={(e) => {
                          const copy = [...transportRows]
                          copy[i].sector = e.target.value
                          setTransportRows(copy)
                        }}
                        placeholder="Sector / Route"
                        className="w-full border rounded px-2 py-1 text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10px] text-blue-800 font-bold block">PRICE</span>
                      <input
                        type="text"
                        value={t.price}
                        onChange={(e) => {
                          const copy = [...transportRows]
                          copy[i].price = e.target.value
                          setTransportRows(copy)
                        }}
                        placeholder="Price"
                        className="w-full border border-blue-300 rounded px-2 py-1 text-xs font-extrabold text-blue-950 bg-white"
                      />
                    </div>
                    <div className="col-span-1 text-center pt-3">
                      {transportRows.length > 1 && (
                        <button type="button" onClick={() => removeTransportRow(i)} className="text-red-500 hover:text-red-700">
                          <i className="ti ti-trash" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* HOTEL DETAILS (MAKKAH & MADINA WITH CALENDAR + MANUAL ENTRY) */}
          <div className="space-y-3">
            {/* MAKKAH HOTELS */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">Makkah Hotel Details</p>
                  {makkahTotal > 0 && <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">Total: {makkahTotal.toLocaleString()}</span>}
                </div>
                <button type="button" onClick={addMakkahRow} className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                  <i className="ti ti-plus" /> Add Hotel Row
                </button>
              </div>
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-xs text-left min-w-[600px]">
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
                        <td className="p-2"><input type="text" value={h.hotel_name} onChange={(e) => { const copy = [...makkahHotels]; copy[i].hotel_name = e.target.value; setMakkahHotels(copy) }} placeholder="Hotel Name" className="w-full border rounded px-2 py-1 text-xs" /></td>
                        <td className="p-2"><input type="number" value={h.room_qty} onChange={(e) => { const copy = [...makkahHotels]; copy[i].room_qty = e.target.value; setMakkahHotels(copy) }} placeholder="Qty" className="w-full border rounded px-1.5 py-1 text-xs text-center" /></td>
                        <td className="p-2"><input type="text" value={h.room_type} onChange={(e) => { const copy = [...makkahHotels]; copy[i].room_type = e.target.value; setMakkahHotels(copy) }} placeholder="Room Type" className="w-full border rounded px-1.5 py-1 text-xs" /></td>
                        <td className="p-2">
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              value={h.check_in}
                              onChange={(e) => {
                                const copy = [...makkahHotels]
                                copy[i].check_in = e.target.value
                                const calcN = calculateNightsFromDates(e.target.value, copy[i].check_out)
                                if (calcN > 0) copy[i].nights = String(calcN)
                                setMakkahHotels(copy)
                              }}
                              placeholder="Check In"
                              className="w-full border rounded px-1.5 py-1 text-xs pr-6"
                            />
                            <div className="absolute right-1.5 pointer-events-none text-gray-400">
                              <i className="ti ti-calendar text-xs" />
                            </div>
                            <input
                              type="date"
                              className="absolute right-0 top-0 bottom-0 w-6 opacity-0 cursor-pointer z-10"
                              onChange={(e) => {
                                if (e.target.value) {
                                  const copy = [...makkahHotels]
                                  copy[i].check_in = formatDateFromPicker(e.target.value)
                                  const calcN = calculateNightsFromDates(copy[i].check_in, copy[i].check_out)
                                  if (calcN > 0) copy[i].nights = String(calcN)
                                  setMakkahHotels(copy)
                                }
                              }}
                              title="Select Check In date from calendar"
                            />
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              value={h.check_out}
                              onChange={(e) => {
                                const copy = [...makkahHotels]
                                copy[i].check_out = e.target.value
                                const calcN = calculateNightsFromDates(copy[i].check_in, e.target.value)
                                if (calcN > 0) copy[i].nights = String(calcN)
                                setMakkahHotels(copy)
                              }}
                              placeholder="Check Out"
                              className="w-full border rounded px-1.5 py-1 text-xs pr-6"
                            />
                            <div className="absolute right-1.5 pointer-events-none text-gray-400">
                              <i className="ti ti-calendar text-xs" />
                            </div>
                            <input
                              type="date"
                              className="absolute right-0 top-0 bottom-0 w-6 opacity-0 cursor-pointer z-10"
                              onChange={(e) => {
                                if (e.target.value) {
                                  const copy = [...makkahHotels]
                                  copy[i].check_out = formatDateFromPicker(e.target.value)
                                  const calcN = calculateNightsFromDates(copy[i].check_in, copy[i].check_out)
                                  if (calcN > 0) copy[i].nights = String(calcN)
                                  setMakkahHotels(copy)
                                }
                              }}
                              title="Select Check Out date from calendar"
                            />
                          </div>
                        </td>
                        <td className="p-2"><input type="number" value={h.nights} onChange={(e) => { const copy = [...makkahHotels]; copy[i].nights = e.target.value; setMakkahHotels(copy) }} placeholder="Nights" className="w-full border rounded px-1.5 py-1 text-xs text-center" /></td>
                        <td className="p-2"><input type="text" value={h.night_price} onChange={(e) => { const copy = [...makkahHotels]; copy[i].night_price = e.target.value; setMakkahHotels(copy) }} placeholder="Price" className="w-full border rounded px-1.5 py-1 text-xs font-semibold" /></td>
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
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Madina Hotel Details</p>
                  {madinaTotal > 0 && <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Total: {madinaTotal.toLocaleString()}</span>}
                </div>
                <button type="button" onClick={addMadinaRow} className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                  <i className="ti ti-plus" /> Add Hotel Row
                </button>
              </div>
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-xs text-left min-w-[600px]">
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
                        <td className="p-2"><input type="text" value={h.hotel_name} onChange={(e) => { const copy = [...madinaHotels]; copy[i].hotel_name = e.target.value; setMadinaHotels(copy) }} placeholder="Hotel Name" className="w-full border rounded px-2 py-1 text-xs" /></td>
                        <td className="p-2"><input type="number" value={h.room_qty} onChange={(e) => { const copy = [...madinaHotels]; copy[i].room_qty = e.target.value; setMadinaHotels(copy) }} placeholder="Qty" className="w-full border rounded px-1.5 py-1 text-xs text-center" /></td>
                        <td className="p-2"><input type="text" value={h.room_type} onChange={(e) => { const copy = [...madinaHotels]; copy[i].room_type = e.target.value; setMadinaHotels(copy) }} placeholder="Room Type" className="w-full border rounded px-1.5 py-1 text-xs" /></td>
                        <td className="p-2">
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              value={h.check_in}
                              onChange={(e) => {
                                const copy = [...madinaHotels]
                                copy[i].check_in = e.target.value
                                const calcN = calculateNightsFromDates(e.target.value, copy[i].check_out)
                                if (calcN > 0) copy[i].nights = String(calcN)
                                setMadinaHotels(copy)
                              }}
                              placeholder="Check In"
                              className="w-full border rounded px-1.5 py-1 text-xs pr-6"
                            />
                            <div className="absolute right-1.5 pointer-events-none text-gray-400">
                              <i className="ti ti-calendar text-xs" />
                            </div>
                            <input
                              type="date"
                              className="absolute right-0 top-0 bottom-0 w-6 opacity-0 cursor-pointer z-10"
                              onChange={(e) => {
                                if (e.target.value) {
                                  const copy = [...madinaHotels]
                                  copy[i].check_in = formatDateFromPicker(e.target.value)
                                  const calcN = calculateNightsFromDates(copy[i].check_in, copy[i].check_out)
                                  if (calcN > 0) copy[i].nights = String(calcN)
                                  setMadinaHotels(copy)
                                }
                              }}
                              title="Select Check In date from calendar"
                            />
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              value={h.check_out}
                              onChange={(e) => {
                                const copy = [...madinaHotels]
                                copy[i].check_out = e.target.value
                                const calcN = calculateNightsFromDates(copy[i].check_in, e.target.value)
                                if (calcN > 0) copy[i].nights = String(calcN)
                                setMadinaHotels(copy)
                              }}
                              placeholder="Check Out"
                              className="w-full border rounded px-1.5 py-1 text-xs pr-6"
                            />
                            <div className="absolute right-1.5 pointer-events-none text-gray-400">
                              <i className="ti ti-calendar text-xs" />
                            </div>
                            <input
                              type="date"
                              className="absolute right-0 top-0 bottom-0 w-6 opacity-0 cursor-pointer z-10"
                              onChange={(e) => {
                                if (e.target.value) {
                                  const copy = [...madinaHotels]
                                  copy[i].check_out = formatDateFromPicker(e.target.value)
                                  const calcN = calculateNightsFromDates(copy[i].check_in, copy[i].check_out)
                                  if (calcN > 0) copy[i].nights = String(calcN)
                                  setMadinaHotels(copy)
                                }
                              }}
                              title="Select Check Out date from calendar"
                            />
                          </div>
                        </td>
                        <td className="p-2"><input type="number" value={h.nights} onChange={(e) => { const copy = [...madinaHotels]; copy[i].nights = e.target.value; setMadinaHotels(copy) }} placeholder="Nights" className="w-full border rounded px-1.5 py-1 text-xs text-center" /></td>
                        <td className="p-2"><input type="text" value={h.night_price} onChange={(e) => { const copy = [...madinaHotels]; copy[i].night_price = e.target.value; setMadinaHotels(copy) }} placeholder="Price" className="w-full border rounded px-1.5 py-1 text-xs font-semibold" /></td>
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

          {/* PACKAGE PRICING & TOTALS SECTION (WITH SMALL CONVERSION RATE MULTIPLIER BOX) */}
          <div className="border border-gray-200 rounded-lg p-3.5 space-y-3 bg-gradient-to-r from-slate-50 via-indigo-50/20 to-purple-50/30">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-gray-800 uppercase tracking-wide flex items-center gap-1.5">
                <i className="ti ti-calculator text-purple-600 text-sm" />
                Package Pricing & Totals Summary
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              
              {/* SMALL CONVERSION RATE MULTIPLIER BOX */}
              <div className="bg-white p-3 rounded-lg border border-indigo-200 shadow-xs space-y-1">
                <label className="block text-[11px] font-bold text-indigo-900 uppercase tracking-wider">
                  CONVERSION RATE (RATE / MULTIPLIER)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 76.5 or 1"
                    value={conversionRate}
                    onChange={(e) => setConversionRate(e.target.value)}
                    className="w-full border border-indigo-300 rounded-lg px-2.5 py-1.5 text-xs font-extrabold text-indigo-950 focus:ring-2 focus:ring-indigo-500 bg-indigo-50/30"
                  />
                </div>
                <p className="text-[10px] text-indigo-600 font-medium leading-tight">
                  {Number(conversionRate) > 0 
                    ? `Base Sum (${basePackageOnlySum.toLocaleString()}) × ${conversionRate} Rate` 
                    : 'Enter rate (e.g. 76.5) to convert SAR/USD total'}
                </p>
              </div>

              {/* TOTAL PACKAGE ONLY = (Visa + Hotels + Transport) x Conversion Rate */}
              <div className="bg-white p-3 rounded-lg border border-purple-200 shadow-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-purple-900 uppercase tracking-wider">
                    TOTAL PACKAGE ONLY
                  </label>
                  {computedPackageOnly > 0 && (
                    <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                      Live: {computedPackageOnly.toLocaleString()}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="AMOUNT"
                  value={activePackageOnly}
                  onChange={(e) => setTotals({ ...totals, package_only: e.target.value })}
                  className="w-full border border-purple-300 rounded-lg px-3 py-1.5 text-xs font-black text-purple-950 focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-[10px] text-gray-400">
                  Formula: [Visa ({visaTotal.toLocaleString()}) + Hotels ({(makkahTotal + madinaTotal).toLocaleString()}) + Transport ({transportTotal.toLocaleString()})]
                  {Number(conversionRate) > 0 ? ` × ${conversionRate}` : ''}
                </p>
              </div>

              {/* TOTAL PACKAGE WITH TICKET = Package Only + Ticket Total */}
              <div className="bg-white p-3 rounded-lg border border-emerald-200 shadow-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-emerald-900 uppercase tracking-wider">
                    TOTAL PACKAGE WITH TICKET
                  </label>
                  {computedPackageWithTicket > 0 && (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                      Live: {computedPackageWithTicket.toLocaleString()}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="AMOUNT"
                  value={activePackageWithTicket}
                  onChange={(e) => setTotals({ ...totals, package_with_ticket: e.target.value })}
                  className="w-full border border-emerald-300 rounded-lg px-3 py-1.5 text-xs font-black text-emerald-950 focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-gray-400">
                  {bothCardsHaveAmount 
                    ? `Formula: Pkg Only (${currentPkgOnlyVal.toLocaleString()}) + Ticket (${currentTicketVal.toLocaleString()})`
                    : 'Requires amounts in BOTH Package Card and Ticket Card to calculate total with ticket'}
                </p>
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

      {/* PRINT PRINTABLE MODAL / TEMPLATE FOR PDF (MOBILE & 100% ZOOM BROWSER FIT) */}
      {showPrintModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/75 overflow-y-auto p-2 sm:p-6 flex justify-center items-start"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPrintModal(false)
          }}
        >
          <div className="bg-white rounded-2xl max-w-5xl w-full p-4 sm:p-6 space-y-4 shadow-2xl my-3 sm:my-6 relative border border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-3.5 gap-2">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-gray-900 flex items-center gap-2">
                  <i className="ti ti-file-text text-blue-600 text-lg" />
                  Client Package Printable Voucher ({showPrintModal === 'color' ? 'Color PDF' : 'Standard Grid'})
                </h3>
                <p className="text-xs text-gray-500">Preview 100% print ready document before downloading PDF</p>
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
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md transition-all"
                >
                  <i className="ti ti-download text-sm" /> Save PDF
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

            {/* Template Display (Scrollable on Mobile) */}
            <div className="overflow-x-auto max-w-full pb-2">
              {showPrintModal === 'color' ? (
                <ColorPdfTemplate 
                  header={header}
                  pax={{ ...pax, ticket_total: activeTicketTotal }}
                  totalPax={totalPax}
                  flightItinerary={flightItinerary}
                  depFlight={flightItinerary[0] || {}}
                  arrFlight={flightItinerary[flightItinerary.length - 1] || {}}
                  visa={visa}
                  makkahHotels={makkahHotels}
                  madinaHotels={madinaHotels}
                  transport={transportRows[0] || {}}
                  transportList={transportRows}
                  totals={{ package_only: activePackageOnly, package_with_ticket: activePackageWithTicket }}
                  comments={comments}
                  hideBreakup={hidePdfBreakup}
                />
              ) : (
                <StandardPdfTemplate 
                  header={header}
                  pax={{ ...pax, ticket_total: activeTicketTotal }}
                  totalPax={totalPax}
                  flightItinerary={flightItinerary}
                  depFlight={flightItinerary[0] || {}}
                  arrFlight={flightItinerary[flightItinerary.length - 1] || {}}
                  visa={visa}
                  makkahHotels={makkahHotels}
                  madinaHotels={madinaHotels}
                  transport={transportRows[0] || {}}
                  transportList={transportRows}
                  totals={{ package_only: activePackageOnly, package_with_ticket: activePackageWithTicket }}
                  comments={comments}
                  hideBreakup={hidePdfBreakup}
                />
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
