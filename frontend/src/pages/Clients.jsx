import React, { useState, useRef, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'
import html2pdf from 'html2pdf.js'
import { ColorPdfTemplate, StandardPdfTemplate, InvoicePdfTemplate, ETicketPdfTemplate, HotelVoucherPdfTemplate, TransportVoucherPdfTemplate, AllInOnePdfTemplate } from '../components/VoucherTemplates'
import PackageSalesReportModal from '../components/PackageSalesReportModal'

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

// ── SMART IMAGE COMPRESSOR FOR GEMINI (Reduces Token Usage by 90%+) ──
async function compressImageForGemini(file, maxDimension = 1200, quality = 0.85) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => resolve({ base64: reader.result.split(',')[1], mimeType: file?.type || 'image/jpeg' })
      reader.onerror = reject
      reader.readAsDataURL(file)
      return
    }

    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = (event) => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        let width = img.width
        let height = img.height

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width)
            width = maxDimension
          } else {
            width = Math.round((width * maxDimension) / height)
            height = maxDimension
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)

        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        const base64 = dataUrl.split(',')[1]
        resolve({ base64, mimeType: 'image/jpeg' })
      }
      img.src = event.target.result
    }
    reader.readAsDataURL(file)
  })
}

// ── ROBUST MULTI-MODEL FALLBACK AI SCANNER ──
async function fetchGeminiWithFallback(prompt, base64Image, mimeType, finalKey) {
  const modelsToTry = [
    'gemini-3.1-flash-lite',
    'gemini-3-flash',
    'gemini-3.5-flash',
    'gemini-3.6-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite'
  ]

  const cleanMime = (mimeType && mimeType.includes('/')) ? mimeType : 'image/jpeg'
  let lastError = null
  let rateLimitExceeded = false

  for (const model of modelsToTry) {
    const maxRetries = 2

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${finalKey}`,
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
              generationConfig: { temperature: 0 }
            })
          }
        )

        if (response.ok) {
          const data = await response.json()
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
          const startIdx = text.indexOf('{')
          const endIdx = text.lastIndexOf('}')
          if (startIdx === -1 || endIdx === -1) {
            throw new Error('No valid JSON object structure found in AI response')
          }
          const cleanJson = text.substring(startIdx, endIdx + 1)
          return JSON.parse(cleanJson)
        }

        const errBody = await response.json().catch(() => ({}))
        const errMsg = errBody.error?.message || `HTTP status ${response.status}`

        if (response.status === 429 || errMsg.includes('Quota exceeded') || errMsg.includes('limit: 0') || errMsg.includes('rate-limits')) {
          rateLimitExceeded = true
          lastError = new Error(`Quota limit reached for model ${model}`)
          await new Promise(resolve => setTimeout(resolve, 1200))
          break // Skip retries for this model, try next model in loop
        }

        if (response.status === 404 || response.status === 400) {
          lastError = new Error(errMsg)
          break // Skip retries for unsupported model
        }

        lastError = new Error(errMsg)
      } catch (err) {
        lastError = err
      }

      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  if (rateLimitExceeded) {
    throw new Error('Gemini Free Tier rate limit reached. Please wait 15-20 seconds for Google limits to reset, then click Scan again.')
  }

  throw lastError || new Error('All attempted Gemini models failed to process image.')
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
  "passengers": ["FULL PASSENGER NAME 1", "FULL PASSENGER NAME 2"],
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
- "passengers": Extract ALL passenger full names present in the ticket reservation (e.g. ["MEHNAZ SHAMEEM", "SALAAR HUSSAIN", "SULEMAN HUSSAIN", "BISMA ADNAN HUSSAIN"]).
- "name": Set to the FIRST passenger full name available in the ticket reservation.
- "date": Extract the booking or travel issue date. If not found, use departure date.
- "adt", "child", "infant": Count ADT (Adults), CHILD (Children), and INFANT (Infants). Extract individual passenger ticket prices/fares if present.
- "flights": Extract EVERY flight leg/segment present in the ticket (can be 1, 2, 3, 4, 5, 6, 7 or more lines).
- Set empty string "" or 0 for unreadable fields.`

  return await fetchGeminiWithFallback(prompt, base64Image, mimeType, finalKey)
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

  return await fetchGeminiWithFallback(prompt, base64Image, mimeType, finalKey)
}

// ── OFFLINE LOCAL GALILEO GDS TERMINAL TEXT PARSER (0 API CALLS, 0 COST) ──
function parseGalileoTerminalText(rawText) {
  if (!rawText || typeof rawText !== 'string') return null
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean)
  
  let name = ''
  const passengers = []
  const flights = []

  let adtCount = 0
  let childCount = 0
  let infantCount = 0

  // Passenger regex matching any occurrence of number tag SURNAME/GIVEN TITLE & GDS MODIFIERS
  // Matches: 1.1SURNAME/GIVEN, 5.1SURNAME/GIVEN*P-C05, 6.I/1SURNAME/GIVEN*20JUN25
  const paxRegex = /(?:^|\s+)\d+(?:\.\d*)?\s*(?:(I|FI|INF)(?:[/\-]\d*|\d+[/\-]))?\s*([A-Z]+)\/([A-Z0-9\s()\*\./-]+?)(?=\s+\d+(?:\.\d*)?|\s*$)/gi

  for (const line of lines) {
    // 1. Scan line for passenger tokens (multi-passenger line support)
    let paxMatch
    const linePaxRegex = new RegExp(paxRegex)
    while ((paxMatch = linePaxRegex.exec(line)) !== null) {
      const infantPrefix = paxMatch[1] // 'I', 'FI', or 'INF' if present
      const surname = paxMatch[2].toUpperCase()
      const rawGivenAndMods = paxMatch[3].trim().toUpperCase()

      let isChild = false
      let isInfant = !!infantPrefix
      let infantName = ''

      // Check for Child tags: *P-C05, *C05, (CHD), *CHD, etc.
      if (/(\*P-C|\*C\d|\(CHD\)|\(C\d|CHD)/i.test(rawGivenAndMods)) {
        isChild = true
      }

      // Check for Infant tags: *P-I01, *I01, (INF), *INF, INF
      if (/(\*P-I|\*I\d|\(INF\)|INF)/i.test(rawGivenAndMods)) {
        isInfant = true
        const infNameMatch = rawGivenAndMods.match(/(?:\*P-I|\*I|\(INF\)|INF)[0-9]*[/\s]+(?:[A-Z]+\/)?([A-Z\s]+)/i)
        if (infNameMatch && infNameMatch[1]) {
          const rawInf = infNameMatch[1].trim()
          infantName = `${rawInf} ${surname}`.trim()
        }
      }

      // Clean given name by stripping GDS modifiers & birthdates (*20JUN25, *P-C05, *P-I01..., MR, MRS, etc.)
      let cleanGiven = rawGivenAndMods
        .replace(/\*[0-9]{1,2}[A-Z]{3}[0-9]{2,4}/gi, '')
        .replace(/\*P-[A-Z0-9]+(\/[A-Z0-9/]+)?/gi, '')
        .replace(/\*[A-Z0-9]+/gi, '')
        .replace(/\s*(MR|MRS|MS|MISS|MSTR|INF|CHD|ADT|DR|PROF|MASTER|\(INF\)|\(CHD\)|\(ADT\))[\*\s]*$/i, '')
        .trim()

      const formattedName = `${cleanGiven} ${surname}`.trim()

      if (isChild) {
        childCount++
        if (formattedName && !passengers.includes(formattedName)) {
          passengers.push(formattedName)
        }
      } else if (isInfant && infantPrefix) {
        // Dedicated Infant line with I/1 or FI/1 prefix (e.g. 6.I/1USAMA/SARAH*20JUN25)
        infantCount++
        if (formattedName && !passengers.includes(formattedName)) {
          passengers.push(formattedName)
        }
      } else if (isInfant) {
        // Adult with attached Infant modifier (*P-I01)
        adtCount++
        if (formattedName && !passengers.includes(formattedName)) {
          passengers.push(formattedName)
        }
        infantCount++
        const infPaxName = infantName || `${cleanGiven} (INFANT) ${surname}`.trim()
        if (infPaxName && !passengers.includes(infPaxName)) {
          passengers.push(infPaxName)
        }
      } else {
        // Normal Adult passenger
        adtCount++
        if (formattedName && !passengers.includes(formattedName)) {
          passengers.push(formattedName)
        }
      }
    }

    // Fallback single line passenger match
    if (passengers.length === 0) {
      const singlePaxMatch = line.match(/^\d+(?:\.\d*)?\s*([A-Z]+)\/([A-Z0-9\s()\*\./-]+?)(?:\s+(MR|MRS|MS|MISS|MSTR|INF|CHD|ADT|DR|PROF|MASTER))?$/i)
      if (singlePaxMatch) {
        const surname = singlePaxMatch[1].toUpperCase()
        let cleanGiven = singlePaxMatch[2].trim().toUpperCase()
        cleanGiven = cleanGiven
          .replace(/\*P-[A-Z0-9]+(\/[A-Z0-9/]+)?/gi, '')
          .replace(/\*[A-Z0-9]+/gi, '')
          .replace(/\s*(MR|MRS|MS|MISS|MSTR|INF|CHD|ADT|DR|PROF|MASTER|\(INF\)|\(CHD\)|\(ADT\))[\*\s]*$/i, '')
          .trim()
        const formattedName = `${cleanGiven} ${surname}`.trim()
        if (formattedName && !passengers.includes(formattedName)) {
          passengers.push(formattedName)
          adtCount++
        }
      }
    }

    // 2. Scan line for Flight Leg tokens
    const flightMatch = line.match(/^(?:\d+\.\s*)?([A-Z0-9]{2})\s*(\d{1,4})\s*([A-Z])?\s*(\d{1,2}[A-Z]{3})\s*([A-Z]{6})\s*(?:[A-Z0-9]{3})?\s*(\d{4})\s*(#?\d{4})/i)
    if (flightMatch) {
      const airline = flightMatch[1].toUpperCase()
      const flight_no = flightMatch[2]
      const date = flightMatch[4].toUpperCase()
      const rawSector = flightMatch[5].toUpperCase()
      const sector = `${rawSector.slice(0, 3)}-${rawSector.slice(3, 6)}`
      
      const rawDep = flightMatch[6]
      const rawArr = flightMatch[7].replace('#', '')
      const dep_time = `${rawDep.slice(0, 2)}:${rawDep.slice(2, 4)}`
      const arr_time = `${rawArr.slice(0, 2)}:${rawArr.slice(2, 4)}`

      flights.push({
        type: flights.length === 0 ? 'DEPARTURE' : (flights.length === 1 ? 'ARRIVAL' : `FLIGHT ${flights.length + 1}`),
        airline,
        flight_no,
        sector,
        date,
        dep_time,
        arr_time
      })
    }
  }

  // Set primary client name to first passenger
  if (passengers.length > 0) {
    name = passengers[0]
  }

  if (name || passengers.length > 0 || flights.length > 0) {
    return { name, passengers, flights, adtCount, childCount, infantCount }
  }
  return null
}

// ── DATE & NIGHTS ARITHMETIC HELPERS ──
function parseCustomDate(str, fallbackYear = new Date().getFullYear()) {
  if (!str) return null
  const s = String(str).trim()

  const monthMap = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
  }

  // Pattern 1: DD-MM-YY or DD-MM-YYYY (e.g. "20-06-26", "30-06-2026")
  const matchNumeric = s.match(/^(\d{1,2})[-/\s.]+(\d{1,2})[-/\s.]+(\d{2,4})$/)
  if (matchNumeric) {
    const day = parseInt(matchNumeric[1], 10)
    const month = parseInt(matchNumeric[2], 10) - 1
    let year = parseInt(matchNumeric[3], 10)
    if (year < 100) year = 2000 + year
    if (year < 2020) year = fallbackYear
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      return new Date(year, month, day)
    }
  }

  // Pattern 2: DD-MMM-YY or DD-MMM (e.g. "20-Jun-26", "20-Jun")
  const matchMonthStr = s.match(/^(\d{1,2})[-/\s.]+([A-Za-z]{3})([-/\s.]+(\d{2,4}))?$/i)
  if (matchMonthStr) {
    const day = parseInt(matchMonthStr[1], 10)
    const monthStr = matchMonthStr[2].toLowerCase()
    const monthIdx = monthMap[monthStr]
    let year = fallbackYear
    if (matchMonthStr[4]) {
      const yrVal = parseInt(matchMonthStr[4], 10)
      year = yrVal < 100 ? 2000 + yrVal : yrVal
      if (year < 2020) year = fallbackYear
    }
    if (monthIdx !== undefined && !isNaN(day)) {
      return new Date(year, monthIdx, day)
    }
  }

  // Pattern 3: Standard Date.parse
  const parsed = Date.parse(s)
  if (!isNaN(parsed)) {
    const d = new Date(parsed)
    if (d.getFullYear() < 2020) d.setFullYear(fallbackYear)
    return d
  }

  return null
}

function formatDateToString(dateObj, templateStr) {
  if (!dateObj || isNaN(dateObj.getTime())) return ''
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const day = String(dateObj.getDate()).padStart(2, '0')
  const monthIdx = dateObj.getMonth()
  const yearFull = dateObj.getFullYear()
  const yearShort = String(yearFull).slice(-2)

  if (templateStr) {
    const s = String(templateStr).trim()
    if (/^\d{1,2}[-/\s.]+\d{1,2}[-/\s.]+\d{2,4}$/.test(s)) {
      const monthNum = String(monthIdx + 1).padStart(2, '0')
      const matchNum = s.match(/^(\d{1,2})[-/\s.]+(\d{1,2})[-/\s.]+(\d{2,4})$/)
      if (matchNum && matchNum[3].length === 4) {
        return `${day}-${monthNum}-${yearFull}`
      }
      return `${day}-${monthNum}-${yearShort}`
    }
    const matchMonthStr = s.match(/^(\d{1,2})[-/\s.]+([A-Za-z]{3})([-/\s.]+(\d{2,4}))?$/i)
    if (matchMonthStr) {
      const mStr = months[monthIdx]
      if (matchMonthStr[4] && matchMonthStr[4].length === 4) {
        return `${day}-${mStr}-${yearFull}`.toUpperCase()
      }
      if (matchMonthStr[4] && matchMonthStr[4].length === 2) {
        return `${day}-${mStr}-${yearShort}`.toUpperCase()
      }
      return `${day}-${mStr}`.toUpperCase()
    }
  }

  const mStr = months[monthIdx]
  return `${day}-${mStr}-${yearShort}`.toUpperCase()
}

function calculateNightsFromDates(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0
  try {
    let fallbackYear = new Date().getFullYear()
    const d2Parsed = parseCustomDate(checkOut, fallbackYear)
    if (d2Parsed) fallbackYear = d2Parsed.getFullYear()

    const d1 = parseCustomDate(checkIn, fallbackYear)
    const d2 = d2Parsed || parseCustomDate(checkOut, fallbackYear)

    if (d1 && d2) {
      if (Math.abs(d1.getFullYear() - d2.getFullYear()) > 1) {
        d1.setFullYear(d2.getFullYear())
      }
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

function calculateCheckoutFromCheckinAndNights(checkInStr, nights) {
  const n = parseInt(nights, 10)
  if (isNaN(n) || n <= 0) return ''
  const d = parseCustomDate(checkInStr)
  if (!d) return ''
  d.setDate(d.getDate() + n)
  return formatDateToString(d, checkInStr)
}

function calculateCheckinFromCheckoutAndNights(checkOutStr, nights) {
  const n = parseInt(nights, 10)
  if (isNaN(n) || n <= 0) return ''
  const d = parseCustomDate(checkOutStr)
  if (!d) return ''
  d.setDate(d.getDate() - n)
  return formatDateToString(d, checkOutStr)
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

  // GDS Terminal Text Parser Modal States
  const [showTerminalModal, setShowTerminalModal] = useState(false)
  const [terminalInputText, setTerminalInputText] = useState('')
  const [passengerList, setPassengerList] = useState([])

  // ID 420: Standalone & Combined Document Voucher Generator Modal States
  const [showDocModal, setShowDocModal] = useState(null) // null | 'eticket' | 'hotel' | 'transport' | 'allinone'
  const [hcnMakkah, setHcnMakkah] = useState('')
  const [hcnMadina, setHcnMadina] = useState('')
  const [driverContact, setDriverContact] = useState('')
  const [ticketMode, setTicketMode] = useState('grouped') // 'grouped' or 'separate'
  const [customPnr, setCustomPnr] = useState('')
  const [customIssueDate, setCustomIssueDate] = useState('')

  const handleParseTerminalText = () => {
    if (!terminalInputText || !terminalInputText.trim()) {
      toast.error('Please paste GDS terminal text first')
      return
    }
    const result = parseGalileoTerminalText(terminalInputText)
    if (!result || (!result.passengers?.length && !result.flights?.length)) {
      toast.error('Could not find GDS name or flight lines in pasted text')
      return
    }

    if (result.name) {
      setHeader(h => ({ ...h, name: result.name }))
    }

    if (Array.isArray(result.passengers) && result.passengers.length > 0) {
      setPassengerList(result.passengers)
      setPax(p => ({
        ...p,
        adt: result.adtCount > 0 ? String(result.adtCount) : String(result.passengers.length),
        child: result.childCount > 0 ? String(result.childCount) : '',
        infant: result.infantCount > 0 ? String(result.infantCount) : ''
      }))
    }

    if (Array.isArray(result.flights) && result.flights.length > 0) {
      setFlightItinerary(result.flights)
    }

    const paxCount = result.passengers?.length || 1
    toast.success(`Extracted ${paxCount} passenger(s) & ${result.flights?.length || 0} flight leg(s)! Lead Pax: "${result.name}"`, { id: 'gds-local-success' })
    setShowTerminalModal(false)
    setTerminalInputText('')
  }

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
  const [showCompanyDetails, setShowCompanyDetails] = useState(true)

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
  const [showSalesReportModal, setShowSalesReportModal] = useState(false)

  // Invoice Modal & Data States
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [invoiceData, setInvoiceData] = useState({
    invoiceNo: '',
    invoiceDate: '',
    dueDate: '',
    clientName: '',
    phone: '',
    whatsapp: '',
    email: '',
    items: [],
    subtotal: 0,
    discount: '0',
    totalAmount: 0,
    amountPaid: '0',
    balanceDue: 0,
    status: 'UNPAID',
    paymentMethod: 'Bank Transfer',
    bankDetails: 'Meezan Bank - A/C 0102030405',
    remarks: 'Thank you for your business. Balance due prior to flight departure.'
  })

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

  // 3. Live Makkah Hotels Total (Support per-room dates & prices if unchecked)
  const makkahTotal = makkahHotels.reduce((sum, h) => {
    if (!h.hotel_name) return sum
    const qty = Math.max(1, parseInt(h.room_qty || '1', 10))
    const sameDetails = h.same_details_for_all_rooms !== false

    if (sameDetails || qty === 1) {
      const calcN = calculateNightsFromDates(h.check_in, h.check_out)
      const nights = Number(h.nights) > 0 ? Number(h.nights) : (calcN > 0 ? calcN : 1)
      const price = Number(h.night_price || 0)
      return sum + (qty * nights * price)
    } else {
      let hotelSum = 0
      for (let r = 1; r <= qty; r++) {
        const rIn = r === 1 ? h.check_in : (h[`check_in_${r}`] || h.check_in)
        const rOut = r === 1 ? h.check_out : (h[`check_out_${r}`] || h.check_out)
        const rN = r === 1 ? h.nights : (h[`nights_${r}`] || h.nights)
        const calcN = calculateNightsFromDates(rIn, rOut)
        const nights = Number(rN) > 0 ? Number(rN) : (calcN > 0 ? calcN : 1)
        const price = Number(r === 1 ? h.night_price : (h[`night_price_${r}`] || h.night_price || 0))
        hotelSum += nights * price
      }
      return sum + hotelSum
    }
  }, 0)

  // 4. Live Madina Hotels Total (Support per-room dates & prices if unchecked)
  const madinaTotal = madinaHotels.reduce((sum, h) => {
    if (!h.hotel_name) return sum
    const qty = Math.max(1, parseInt(h.room_qty || '1', 10))
    const sameDetails = h.same_details_for_all_rooms !== false

    if (sameDetails || qty === 1) {
      const calcN = calculateNightsFromDates(h.check_in, h.check_out)
      const nights = Number(h.nights) > 0 ? Number(h.nights) : (calcN > 0 ? calcN : 1)
      const price = Number(h.night_price || 0)
      return sum + (qty * nights * price)
    } else {
      let hotelSum = 0
      for (let r = 1; r <= qty; r++) {
        const rIn = r === 1 ? h.check_in : (h[`check_in_${r}`] || h.check_in)
        const rOut = r === 1 ? h.check_out : (h[`check_out_${r}`] || h.check_out)
        const rN = r === 1 ? h.nights : (h[`nights_${r}`] || h.nights)
        const calcN = calculateNightsFromDates(rIn, rOut)
        const nights = Number(rN) > 0 ? Number(rN) : (calcN > 0 ? calcN : 1)
        const price = Number(r === 1 ? h.night_price : (h[`night_price_${r}`] || h.night_price || 0))
        hotelSum += nights * price
      }
      return sum + hotelSum
    }
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
      const { base64, mimeType } = await compressImageForGemini(file)
      const data = await scanTicketWithGemini(base64, mimeType, userApiKey)
      
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

      if (Array.isArray(data.passengers) && data.passengers.length > 0) {
        setPassengerList(data.passengers)
      } else if (data.name) {
        setPassengerList([data.name])
      }

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
      const { base64, mimeType } = await compressImageForGemini(file)
      const data = await scanPackageWithGemini(base64, mimeType, userApiKey)

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
        
        if (Array.isArray(target.passengerList) && target.passengerList.length > 0) {
          setPassengerList(target.passengerList)
        } else if (Array.isArray(target.passengers) && target.passengers.length > 0) {
          setPassengerList(target.passengers)
        } else if (target.name) {
          setPassengerList([target.name])
        } else {
          setPassengerList([])
        }

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

  // ── INVOICE GENERATOR & HANDLERS ──
  const handleOpenInvoiceModal = () => {
    if (!header.name.trim()) {
      toast.error('Please enter a Client Name first.', { id: 'inv-err-name' })
      return
    }

    // 1. Ticket Section (ALL passenger names + sector + price)
    let autoPassengers = []
    let flightSector = 'KHI-JED-KHI'
    const validSectors = (flightItinerary || []).map(f => f.sector).filter(Boolean)
    if (validSectors.length > 1) {
      const first = (validSectors[0] || '').split('-').map(s => s.trim())
      const second = (validSectors[1] || '').split('-').map(s => s.trim())
      if (first.length === 2 && second.length === 2 && first[1] === second[0]) {
        flightSector = `${first[0]}-${first[1]}-${second[1]}`
      } else {
        flightSector = validSectors.join(' - ')
      }
    } else if (validSectors.length === 1) {
      flightSector = validSectors[0]
    }
    const ticketVal = Number(activeTicketTotal || computedTicketTotal || 0)

    const adtQty = Number(pax.adt || 0)
    const adtFare = Number(pax.adt_price || 0)
    const childQty = Number(pax.child || 0)
    const childFare = Number(pax.child_price || 0)
    const infantQty = Number(pax.infant || 0)
    const infantFare = Number(pax.infant_price || 0)

    const totalPaxFromQuantities = adtQty + childQty + infantQty

    // List of known/parsed passenger names
    const knownNames = (passengerList && passengerList.length > 0)
      ? passengerList.map(n => n.trim()).filter(Boolean)
      : (header.name && header.name.trim() ? [header.name.trim()] : [])

    if (totalPaxFromQuantities > 0) {
      let currentPaxIdx = 1

      // 1. Generate Adults
      for (let a = 0; a < adtQty; a++) {
        const paxName = knownNames[currentPaxIdx - 1] 
          ? knownNames[currentPaxIdx - 1]
          : (currentPaxIdx === 1 && header.name ? header.name.trim() : `Passenger ${currentPaxIdx} Adult`)
        
        const paxAmount = adtFare > 0 ? adtFare : (ticketVal > 0 ? Math.round(ticketVal / totalPaxFromQuantities) : 0)

        autoPassengers.push({
          date: header.date || new Date().toISOString().slice(0, 10),
          ticketNo: '',
          passengerName: paxName,
          sector: flightSector,
          amount: paxAmount
        })
        currentPaxIdx++
      }

      // 2. Generate Children
      for (let c = 0; c < childQty; c++) {
        const paxName = knownNames[currentPaxIdx - 1] 
          ? knownNames[currentPaxIdx - 1]
          : `Passenger ${currentPaxIdx} Child`

        const paxAmount = childFare > 0 ? childFare : (ticketVal > 0 ? Math.round(ticketVal / totalPaxFromQuantities) : 0)

        autoPassengers.push({
          date: header.date || new Date().toISOString().slice(0, 10),
          ticketNo: '',
          passengerName: paxName,
          sector: flightSector,
          amount: paxAmount
        })
        currentPaxIdx++
      }

      // 3. Generate Infants
      for (let inf = 0; inf < infantQty; inf++) {
        const paxName = knownNames[currentPaxIdx - 1] 
          ? knownNames[currentPaxIdx - 1]
          : `Passenger ${currentPaxIdx} Infant`

        const paxAmount = infantFare > 0 ? infantFare : (ticketVal > 0 ? Math.round(ticketVal / totalPaxFromQuantities) : 0)

        autoPassengers.push({
          date: header.date || new Date().toISOString().slice(0, 10),
          ticketNo: '',
          passengerName: paxName,
          sector: flightSector,
          amount: paxAmount
        })
        currentPaxIdx++
      }

      // If there are additional known names beyond totalPaxFromQuantities, include them as well
      for (let extra = currentPaxIdx - 1; extra < knownNames.length; extra++) {
        autoPassengers.push({
          date: header.date || new Date().toISOString().slice(0, 10),
          ticketNo: '',
          passengerName: knownNames[extra],
          sector: flightSector,
          amount: ticketVal > 0 ? Math.round(ticketVal / knownNames.length) : 0
        })
      }
    } else if (knownNames.length > 0) {
      const perTicketVal = ticketVal > 0 ? Math.round(ticketVal / knownNames.length) : 0
      autoPassengers = knownNames.map((pName) => ({
        date: header.date || new Date().toISOString().slice(0, 10),
        ticketNo: '',
        passengerName: pName,
        sector: flightSector,
        amount: perTicketVal
      }))
    } else if (header.name) {
      autoPassengers = [
        {
          date: header.date || new Date().toISOString().slice(0, 10),
          ticketNo: '',
          passengerName: header.name.trim(),
          sector: flightSector,
          amount: ticketVal
        }
      ]
    }

    // Conversion Multiplier (Defaults to 1 if empty or 0)
    const rateMultiplier = Number(conversionRate) > 0 ? Number(conversionRate) : 1

    // 2. Visa Section (ALL passenger names + visa type + price in PKR)
    let autoVisas = []
    if (visaTotal > 0 || visa.type) {
      const perVisaPrice = Number(visa.price || 0) * rateMultiplier
      const totalVisaVal = (visaTotal > 0 ? visaTotal : (Number(visa.price || 0) * Number(visa.qty || 1))) * rateMultiplier

      const allPaxNames = autoPassengers.length > 0
        ? autoPassengers.map(p => p.passengerName)
        : (knownNames.length > 0 ? knownNames : [header.name || 'CLIENT'])

      const perPaxVisa = totalVisaVal > 0 ? Math.round(totalVisaVal / allPaxNames.length) : perVisaPrice
      autoVisas = allPaxNames.map((pName) => ({
        date: header.date || new Date().toISOString().slice(0, 10),
        passengerName: pName,
        visaType: `${visa.type || 'UMRAH VISA'} PROCESSING`,
        amount: perPaxVisa
      }))
    }

    // 3. Hotel Section (Hotel Name + Room details + Nights + Converted Price - NO passenger names!)
    let autoHotels = []
    makkahHotels.forEach((h) => {
      if (h.hotel_name) {
        const calcN = calculateNightsFromDates(h.check_in, h.check_out)
        const nights = Number(h.nights) > 0 ? Number(h.nights) : (calcN > 0 ? calcN : 1)
        const qty = Number(h.room_qty || 1)
        const pricePKR = Number(h.night_price || 0) * rateMultiplier
        autoHotels.push({
          date: header.date || new Date().toISOString().slice(0, 10),
          hotelName: `MAKKAH HOTEL: ${h.hotel_name.toUpperCase()}`,
          roomType: h.room_type ? h.room_type.toUpperCase() : '',
          roomQty: qty,
          checkIn: h.check_in || '',
          checkOut: h.check_out || '',
          nights: nights,
          amount: qty * nights * pricePKR
        })
      }
    })

    madinaHotels.forEach((h) => {
      if (h.hotel_name) {
        const calcN = calculateNightsFromDates(h.check_in, h.check_out)
        const nights = Number(h.nights) > 0 ? Number(h.nights) : (calcN > 0 ? calcN : 1)
        const qty = Number(h.room_qty || 1)
        const pricePKR = Number(h.night_price || 0) * rateMultiplier
        autoHotels.push({
          date: header.date || new Date().toISOString().slice(0, 10),
          hotelName: `MADINA HOTEL: ${h.hotel_name.toUpperCase()}`,
          roomType: h.room_type ? h.room_type.toUpperCase() : '',
          roomQty: qty,
          checkIn: h.check_in || '',
          checkOut: h.check_out || '',
          nights: nights,
          amount: qty * nights * pricePKR
        })
      }
    })

    // 4. Transport Section (Sector & Vehicle Type ONLY - Converted Price)
    let autoTransports = []
    transportRows.forEach((t) => {
      if (t.type || t.sector) {
        const qty = Number(t.qty || 1)
        const pricePKR = Number(t.price || 0) * rateMultiplier
        autoTransports.push({
          date: header.date || new Date().toISOString().slice(0, 10),
          vehicleType: (t.type || 'PRIVATE CAR').toUpperCase(),
          sector: (t.sector || 'FULL SECTOR').toUpperCase(),
          qty: qty,
          amount: qty * pricePKR
        })
      }
    })

    // Fallback item if no sections have items
    const autoItems = []
    if (autoPassengers.length === 0 && autoVisas.length === 0 && autoHotels.length === 0 && autoTransports.length === 0) {
      const fallbackVal = Number(activePackageWithTicket || activePackageOnly || 0)
      autoItems.push({
        description: 'PACKAGE / SERVICE CHARGES',
        amount: fallbackVal
      })
    }

    const tktTotal = autoPassengers.reduce((sum, p) => sum + Number(p.amount || 0), 0)
    const visaTotalSum = autoVisas.reduce((sum, v) => sum + Number(v.amount || 0), 0)
    const hotelTotalSum = autoHotels.reduce((sum, h) => sum + Number(h.amount || 0), 0)
    const transportTotalSum = autoTransports.reduce((sum, t) => sum + Number(t.amount || 0), 0)
    const generalTotalSum = autoItems.reduce((sum, i) => sum + Number(i.amount || 0), 0)

    const calculatedSubtotal = tktTotal + visaTotalSum + hotelTotalSum + transportTotalSum + generalTotalSum

    const newInvoiceRecord = {
      id: `inv-${Date.now()}`,
      invoiceNo: `INV-${Date.now().toString().slice(-6)}`,
      invoiceDate: new Date().toISOString().slice(0, 10),
      dueDate: '',
      clientName: header.name,
      phone: header.phone || '',
      whatsapp: header.whatsapp || '',
      email: header.email || '',
      ticketPassengers: autoPassengers,
      visaPassengers: autoVisas,
      hotelItems: autoHotels,
      transportItems: autoTransports,
      items: autoItems,
      subtotal: calculatedSubtotal,
      discount: '0',
      totalAmount: calculatedSubtotal,
      amountPaid: '0',
      balanceDue: calculatedSubtotal,
      status: 'UNPAID',
      paymentMethod: 'Bank Transfer',
      bankDetails: 'Meezan Bank - A/C 0102030405',
      remarks: 'Thank you for your business. Balance due prior to flight departure.',
      createdAt: new Date().toISOString()
    }

    setInvoiceData(newInvoiceRecord)

    try {
      const stored = localStorage.getItem('galileo_invoices')
      const existingInvoices = stored ? JSON.parse(stored) : []
      const filtered = existingInvoices.filter(inv => inv.clientName !== header.name || inv.invoiceNo !== newInvoiceRecord.invoiceNo)
      localStorage.setItem('galileo_invoices', JSON.stringify([newInvoiceRecord, ...filtered]))
    } catch (e) {
      console.error('Failed to sync invoice to galileo_invoices', e)
    }

    setShowInvoiceModal(true)
  }

  const handleAddPaymentItem = () => {
    setInvoiceData(prev => {
      const existingPayments = prev.payments || []
      const newPayment = {
        date: prev.invoiceDate || new Date().toISOString().slice(0, 10),
        voucherNo: `RV-${101 + existingPayments.length}`,
        description: 'PAYMENT RECEIVED',
        paymentMethod: prev.paymentMethod || 'Bank Transfer',
        amount: 0
      }
      const updatedPayments = [...existingPayments, newPayment]
      const totalPaidSum = updatedPayments.reduce((sum, pm) => sum + Number(pm.amount || 0), 0)
      const netTotal = Number(prev.totalAmount || 0)
      const newBalance = Math.max(0, netTotal - totalPaidSum)
      const newStatus = newBalance <= 0 ? 'PAID' : (totalPaidSum > 0 ? 'PARTIAL' : 'UNPAID')

      return {
        ...prev,
        payments: updatedPayments,
        amountPaid: totalPaidSum,
        balanceDue: newBalance,
        status: newStatus
      }
    })
  }

  const handleRemovePaymentItem = (idx) => {
    setInvoiceData(prev => {
      const updatedPayments = (prev.payments || []).filter((_, i) => i !== idx)
      const totalPaidSum = updatedPayments.reduce((sum, pm) => sum + Number(pm.amount || 0), 0)
      const netTotal = Number(prev.totalAmount || 0)
      const newBalance = Math.max(0, netTotal - totalPaidSum)
      const newStatus = newBalance <= 0 ? 'PAID' : (totalPaidSum > 0 ? 'PARTIAL' : 'UNPAID')

      return {
        ...prev,
        payments: updatedPayments,
        amountPaid: totalPaidSum,
        balanceDue: newBalance,
        status: newStatus
      }
    })
  }

  const handleUpdatePaymentItem = (idx, field, value) => {
    setInvoiceData(prev => {
      const updatedPayments = (prev.payments || []).map((pm, i) => i === idx ? { ...pm, [field]: value } : pm)
      const totalPaidSum = updatedPayments.reduce((sum, pm) => sum + Number(pm.amount || 0), 0)
      const netTotal = Number(prev.totalAmount || 0)
      const newBalance = Math.max(0, netTotal - totalPaidSum)
      const newStatus = newBalance <= 0 ? 'PAID' : (totalPaidSum > 0 ? 'PARTIAL' : 'UNPAID')

      return {
        ...prev,
        payments: updatedPayments,
        amountPaid: totalPaidSum,
        balanceDue: newBalance,
        status: newStatus
      }
    })
  }

  const handleAddInvoiceItem = () => {
    setInvoiceData(prev => {
      const updatedItems = [...prev.items, { description: 'EXTRA SERVICE / CHARGE', amount: 0 }]
      const tktSum = (prev.ticketPassengers || []).reduce((sum, p) => sum + Number(p.amount || 0), 0)
      const genSum = updatedItems.reduce((sum, i) => sum + Number(i.amount || 0), 0)
      const newSubtotal = tktSum + genSum
      const discountVal = Number(prev.discount || 0)
      const netTotal = Math.max(0, newSubtotal - discountVal)
      const paidVal = Number(prev.amountPaid || 0)
      const newBalance = Math.max(0, netTotal - paidVal)
      const newStatus = newBalance <= 0 ? 'PAID' : (paidVal > 0 ? 'PARTIAL' : 'UNPAID')

      return {
        ...prev,
        items: updatedItems,
        subtotal: newSubtotal,
        totalAmount: netTotal,
        balanceDue: newBalance,
        status: newStatus
      }
    })
  }

  const handleAddPassengerItem = () => {
    setInvoiceData(prev => {
      const updatedPass = [...(prev.ticketPassengers || []), { date: prev.invoiceDate, invoiceNo: prev.invoiceNo, ticketNo: '', passengerName: 'PASSENGER NAME', sector: 'KHI-JED-KHI', classType: 'Y', amount: 0 }]
      const tktSum = updatedPass.reduce((sum, p) => sum + Number(p.amount || 0), 0)
      const genSum = prev.items.reduce((sum, i) => sum + Number(i.amount || 0), 0)
      const newSubtotal = tktSum + genSum
      const disc = Number(prev.discount || 0)
      const netTotal = Math.max(0, newSubtotal - disc)
      const paid = Number(prev.amountPaid || 0)
      const newBalance = Math.max(0, netTotal - paid)
      const newStatus = newBalance <= 0 ? 'PAID' : (paid > 0 ? 'PARTIAL' : 'UNPAID')

      return {
        ...prev,
        ticketPassengers: updatedPass,
        subtotal: newSubtotal,
        totalAmount: netTotal,
        balanceDue: newBalance,
        status: newStatus
      }
    })
  }

  const handleRemovePassengerItem = (idx) => {
    setInvoiceData(prev => {
      const updatedPass = (prev.ticketPassengers || []).filter((_, i) => i !== idx)
      const tktSum = updatedPass.reduce((sum, p) => sum + Number(p.amount || 0), 0)
      const genSum = prev.items.reduce((sum, i) => sum + Number(i.amount || 0), 0)
      const newSubtotal = tktSum + genSum
      const disc = Number(prev.discount || 0)
      const netTotal = Math.max(0, newSubtotal - disc)
      const paid = Number(prev.amountPaid || 0)
      const newBalance = Math.max(0, netTotal - paid)
      const newStatus = newBalance <= 0 ? 'PAID' : (paid > 0 ? 'PARTIAL' : 'UNPAID')

      return {
        ...prev,
        ticketPassengers: updatedPass,
        subtotal: newSubtotal,
        totalAmount: netTotal,
        balanceDue: newBalance,
        status: newStatus
      }
    })
  }

  const handleUpdatePassengerItem = (idx, field, value) => {
    setInvoiceData(prev => {
      const updatedPass = (prev.ticketPassengers || []).map((p, i) => i === idx ? { ...p, [field]: value } : p)
      const tktSum = updatedPass.reduce((sum, p) => sum + Number(p.amount || 0), 0)
      const genSum = prev.items.reduce((sum, i) => sum + Number(i.amount || 0), 0)
      const newSubtotal = tktSum + genSum
      const disc = Number(prev.discount || 0)
      const netTotal = Math.max(0, newSubtotal - disc)
      const paid = Number(prev.amountPaid || 0)
      const newBalance = Math.max(0, netTotal - paid)
      const newStatus = newBalance <= 0 ? 'PAID' : (paid > 0 ? 'PARTIAL' : 'UNPAID')

      return {
        ...prev,
        ticketPassengers: updatedPass,
        subtotal: newSubtotal,
        totalAmount: netTotal,
        balanceDue: newBalance,
        status: newStatus
      }
    })
  }

  const handleRemoveInvoiceItem = (index) => {
    setInvoiceData(prev => {
      const updatedItems = prev.items.filter((_, i) => i !== index)
      const newSubtotal = updatedItems.reduce((sum, i) => sum + Number(i.amount || 0), 0)
      const discountVal = Number(prev.discount || 0)
      const netTotal = Math.max(0, newSubtotal - discountVal)
      const paidVal = Number(prev.amountPaid || 0)
      const newBalance = Math.max(0, netTotal - paidVal)
      const newStatus = newBalance <= 0 ? 'PAID' : (paidVal > 0 ? 'PARTIAL' : 'UNPAID')

      return {
        ...prev,
        items: updatedItems,
        subtotal: newSubtotal,
        totalAmount: netTotal,
        balanceDue: newBalance,
        status: newStatus
      }
    })
  }

  const handleUpdateInvoiceItem = (index, field, value) => {
    setInvoiceData(prev => {
      const updatedItems = prev.items.map((item, i) => {
        if (i === index) {
          return { ...item, [field]: field === 'amount' ? value : value }
        }
        return item
      })
      const newSubtotal = updatedItems.reduce((sum, i) => sum + Number(i.amount || 0), 0)
      const discountVal = Number(prev.discount || 0)
      const netTotal = Math.max(0, newSubtotal - discountVal)
      const paidVal = Number(prev.amountPaid || 0)
      const newBalance = Math.max(0, netTotal - paidVal)
      const newStatus = newBalance <= 0 ? 'PAID' : (paidVal > 0 ? 'PARTIAL' : 'UNPAID')

      return {
        ...prev,
        items: updatedItems,
        subtotal: newSubtotal,
        totalAmount: netTotal,
        balanceDue: newBalance,
        status: newStatus
      }
    })
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
    const todayStr = new Date().toISOString().slice(0, 10)
    setEditingId(null)
    setStatus('Pending')
    setHeader({
      sr_no: (savedClients.length + 1).toString().padStart(2, '0'),
      name: '',
      phone: '',
      whatsapp: '',
      email: '',
      date: todayStr
    })
    setPassengerList([])
    setPax({ adt: '', adt_price: '', child: '', child_price: '', infant: '', infant_price: '', ticket_total: '' })
    setFlightItinerary([])
    setVisa({ type: 'UMRAH', qty: '', price: '' })
    setMakkahHotels([{ hotel_name: '', room_qty: '', room_type: '', check_in: '', check_out: '', nights: '', night_price: '' }])
    setMadinaHotels([{ hotel_name: '', room_qty: '', room_type: '', check_in: '', check_out: '', nights: '', night_price: '' }])
    setTransportRows([{ type: '', qty: '', sector: '', price: '' }])
    setHidePdfBreakup(false)
    setConversionRate('')
    setTotals({ package_only: '', package_with_ticket: '' })
    setComments('')
    setTicketPreviewImg(null)
    setPackagePreviewImg(null)
    setTerminalInputText('')

    if (editIdParam) {
      navigate('/clients', { replace: true })
    }

    toast.success('Full form reset cleanly', { id: 'clear-form' })
  }

  // Auto-sync contact directory
  const syncContactDirectory = (clientRec) => {
    if (!clientRec || !clientRec.name) return
    try {
      const existing = localStorage.getItem('galileo_contacts')
      let contacts = existing ? JSON.parse(existing) : []
      const cleanName = (clientRec.name || '').trim()
      const cleanPhone = (clientRec.phone || '').trim()
      const cleanWhatsapp = (clientRec.whatsapp || '').trim()
      const cleanEmail = (clientRec.email || '').trim()

      if (!cleanPhone && !cleanWhatsapp && !cleanEmail) return

      const idx = contacts.findIndex(c =>
        (cleanPhone && c.phone === cleanPhone) ||
        (cleanWhatsapp && c.whatsapp === cleanWhatsapp) ||
        (cleanEmail && c.email.toLowerCase() === cleanEmail.toLowerCase()) ||
        (c.name.toLowerCase() === cleanName.toLowerCase())
      )

      if (idx !== -1) {
        contacts[idx] = {
          ...contacts[idx],
          name: cleanName || contacts[idx].name,
          phone: cleanPhone || contacts[idx].phone,
          whatsapp: cleanWhatsapp || contacts[idx].whatsapp,
          email: cleanEmail || contacts[idx].email,
          updatedAt: new Date().toISOString()
        }
      } else {
        contacts.unshift({
          id: 'cnt_' + Date.now(),
          name: cleanName,
          phone: cleanPhone,
          whatsapp: cleanWhatsapp,
          email: cleanEmail,
          notes: clientRec.comments || '',
          source: 'Client Booking',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
      }
      localStorage.setItem('galileo_contacts', JSON.stringify(contacts))
    } catch (e) {
      console.error('Failed to sync contact directory:', e)
    }
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
      passengerList: passengerList.length > 0 ? passengerList : (header.name ? [header.name] : []),
      passengers: passengerList.length > 0 ? passengerList : (header.name ? [header.name] : []),
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

    syncContactDirectory(clientRecord)

    if (editingId) {
      setSavedClients(prev => prev.map(c => c.id === editingId ? clientRecord : c))
      toast.success(`Updated client record "${header.name}" with new changes!`, { id: 'update-success' })
    } else {
      setSavedClients(prev => [clientRecord, ...prev])
      setEditingId(clientRecord.id)
      toast.success(`Client "${header.name}" saved with status: ${status}`, { id: 'save-success' })
    }
  }

  // PDF Export
  const handleSavePdf = () => {
    const targetElementId = showPrintModal === 'color' ? 'printable-color-package' : 'printable-package'
    downloadPdf(targetElementId)
  }

  const downloadPdf = async (elementId, customFileName) => {
    const targetId = elementId || (showPrintModal === 'color' ? 'printable-color-package' : 'printable-package')
    const element = document.getElementById(targetId)
                 || document.getElementById('printable-eticket')
                 || document.getElementById('eticket-page-0')
                 || document.getElementById('printable-hotel-voucher')
                 || document.getElementById('printable-transport-voucher')
                 || document.getElementById('printable-all-in-one')
                 || document.getElementById('printable-color-package')
                 || document.getElementById('printable-package')
                 || document.getElementById('printable-invoice')
    if (!element) {
      toast.error('Printable element not found')
      return
    }

    const clientName = header?.name || 'Client'
    const fileName = customFileName || `client-${clientName.toLowerCase().replace(/\s+/g, '-')}-voucher.pdf`
    toast.loading('Generating & downloading PDF...', { id: 'pdf-gen' })

    const options = {
      margin: [5, 5, 5, 5],
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false, scrollX: 0, scrollY: 0, windowWidth: 1200 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }

    try {
      await html2pdf().set(options).from(element).save()
      toast.success('PDF downloaded successfully!', { id: 'pdf-gen' })
    } catch (err) {
      console.error('PDF generation error:', err)
      toast.error('PDF generation failed, opening print window...', { id: 'pdf-gen' })
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
                className="flex-1 text-xs border border-amber-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 normal-case"
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
              onClick={handleOpenInvoiceModal}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1 shadow-sm"
            >
              <i className="ti ti-receipt text-sm" /> Create Invoice
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
                  <button
                    type="button"
                    onClick={() => setShowSalesReportModal(true)}
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs px-3 py-1.5 rounded-md shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
                    title="Generate 13-column Ticket Sales Report for Excel & WhatsApp"
                  >
                    <i className="ti ti-table text-sm" />
                    Send Sales Report
                  </button>
                  {scanningTicket ? (
                    <span className="text-xs text-blue-600 font-semibold animate-pulse flex items-center gap-1">
                      <i className="ti ti-loader animate-spin" /> Scanning Ticket...
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleClearTicket}
                      className="text-xs font-semibold text-gray-500 hover:text-red-600 flex items-center gap-1 bg-gray-100 hover:bg-red-50 px-2.5 py-1.5 rounded-md transition-all"
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

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
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
                <button
                  type="button"
                  onClick={() => setShowTerminalModal(true)}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 text-[11px] font-bold py-2 px-2 rounded-lg flex items-center justify-center gap-1 transition-all"
                  title="Paste GDS terminal text (Instant Offline, 0 API Calls)"
                >
                  <i className="ti ti-terminal-2 text-sm text-emerald-600" />
                  Paste GDS Text
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
                      <th className="p-2 w-36">ROOM TYPE</th>
                      <th className="p-2">CHECK IN</th>
                      <th className="p-2">CHECK OUT</th>
                      <th className="p-2 w-16">NIGHTS</th>
                      <th className="p-2 w-24">NIGHT PRICE</th>
                      <th className="p-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {makkahHotels.map((h, i) => (
                      <React.Fragment key={`mak-hotel-row-${i}`}>
                        {Number(h.room_qty) > 1 && (
                          <tr className="bg-amber-50/80 border-b border-amber-200/60">
                            <td colSpan={8} className="px-3 py-1 text-left">
                              <div className="flex items-center justify-between text-[10px]">
                                <label className="flex items-center gap-1.5 cursor-pointer font-bold text-amber-950">
                                  <input
                                    type="checkbox"
                                    checked={h.same_details_for_all_rooms !== false}
                                    onChange={(e) => {
                                      const copy = [...makkahHotels]
                                      copy[i].same_details_for_all_rooms = e.target.checked
                                      setMakkahHotels(copy)
                                    }}
                                    className="w-3.5 h-3.5 text-amber-600 rounded cursor-pointer"
                                  />
                                  <span>Same Check-In/Out Dates & Night Price for all rooms</span>
                                </label>
                                {h.same_details_for_all_rooms === false && (
                                  <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                                    Independent Check-In, Check-Out & Price enabled per room below
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                        <tr>
                          <td className="p-2 align-top">
                            <input
                              type="text"
                              value={h.hotel_name || ''}
                              onChange={(e) => {
                                const copy = [...makkahHotels]
                                copy[i].hotel_name = e.target.value
                                setMakkahHotels(copy)
                              }}
                              placeholder="Hotel Name"
                              className="w-full border rounded px-2 py-1 text-xs"
                            />
                          </td>
                          <td className="p-2 align-top">
                            <input
                              type="number"
                              value={h.room_qty || ''}
                              onChange={(e) => {
                                const copy = [...makkahHotels]
                                copy[i].room_qty = e.target.value
                                setMakkahHotels(copy)
                              }}
                              placeholder="Qty"
                              className="w-full border rounded px-1.5 py-1 text-xs text-center"
                            />
                          </td>
                          <td className="p-2 align-top">
                            <div className="space-y-1.5">
                              <div>
                                {Number(h.room_qty) > 1 && (
                                  <span className="text-[9px] font-bold text-amber-800 block mb-0.5 uppercase tracking-tight">Room 1 Type:</span>
                                )}
                                <input
                                  type="text"
                                  value={h.room_type || ''}
                                  onChange={(e) => {
                                    const copy = [...makkahHotels]
                                    copy[i].room_type = e.target.value
                                    setMakkahHotels(copy)
                                  }}
                                  placeholder={Number(h.room_qty) > 1 ? "Room 1 Type" : "Room Type"}
                                  className="w-full border rounded px-1.5 py-1 text-xs font-semibold uppercase bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                              </div>

                              {Array.from({ length: Math.max(0, (parseInt(h.room_qty, 10) || 1) - 1) }).map((_, extraIdx) => {
                                const roomNum = extraIdx + 2
                                const extraList = Array.isArray(h.extra_room_types) ? h.extra_room_types : []
                                const currentVal = extraList[extraIdx] || ''

                                return (
                                  <div key={`makkah-extra-room-${i}-${extraIdx}`} className="animate-in fade-in duration-150">
                                    <span className="text-[9px] font-bold text-amber-800 block mb-0.5 uppercase tracking-tight">Room {roomNum} Type:</span>
                                    <input
                                      type="text"
                                      value={currentVal}
                                      onChange={(e) => {
                                        const copy = [...makkahHotels]
                                        const nextExtras = [...(Array.isArray(copy[i].extra_room_types) ? copy[i].extra_room_types : [])]
                                        nextExtras[extraIdx] = e.target.value
                                        copy[i].extra_room_types = nextExtras
                                        setMakkahHotels(copy)
                                      }}
                                      placeholder={`Room ${roomNum} Type`}
                                      className="w-full border border-amber-300 rounded px-1.5 py-1 text-xs font-semibold uppercase bg-amber-50/50 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                    />
                                  </div>
                                )
                              })}
                            </div>
                          </td>
                          <td className="p-2 align-top">
                            <div className="space-y-1.5">
                              <div>
                                {Number(h.room_qty) > 1 && h.same_details_for_all_rooms === false && (
                                  <span className="text-[9px] font-bold text-amber-800 block mb-0.5 uppercase tracking-tight">Room 1 In:</span>
                                )}
                                <div className="relative flex items-center">
                                  <input
                                    type="text"
                                    value={h.check_in || ''}
                                    onChange={(e) => {
                                      const copy = [...makkahHotels]
                                      const val = e.target.value
                                      copy[i].check_in = val
                                      if (val && copy[i].check_out) {
                                        const calcN = calculateNightsFromDates(val, copy[i].check_out)
                                        if (calcN > 0) copy[i].nights = String(calcN)
                                      }
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
                                        const val = formatDateFromPicker(e.target.value)
                                        copy[i].check_in = val
                                        if (val && copy[i].check_out) {
                                          const calcN = calculateNightsFromDates(val, copy[i].check_out)
                                          if (calcN > 0) copy[i].nights = String(calcN)
                                        }
                                        setMakkahHotels(copy)
                                      }
                                    }}
                                  />
                                </div>
                              </div>

                              {h.same_details_for_all_rooms === false && Array.from({ length: Math.max(0, (parseInt(h.room_qty, 10) || 1) - 1) }).map((_, extraIdx) => {
                                const roomNum = extraIdx + 2
                                const keyName = `check_in_${roomNum}`
                                const outKeyName = `check_out_${roomNum}`
                                const nightsKeyName = `nights_${roomNum}`
                                const currentVal = h[keyName] || h.check_in || ''

                                return (
                                  <div key={`makkah-extra-in-${i}-${extraIdx}`}>
                                    <span className="text-[9px] font-bold text-amber-800 block mb-0.5 uppercase tracking-tight">Room {roomNum} In:</span>
                                    <div className="relative flex items-center">
                                      <input
                                        type="text"
                                        value={currentVal}
                                        onChange={(e) => {
                                          const copy = [...makkahHotels]
                                          const val = e.target.value
                                          copy[i][keyName] = val
                                          const outVal = copy[i][outKeyName] || copy[i].check_out
                                          if (val && outVal) {
                                            const calcN = calculateNightsFromDates(val, outVal)
                                            if (calcN > 0) copy[i][nightsKeyName] = String(calcN)
                                          }
                                          setMakkahHotels(copy)
                                        }}
                                        placeholder={`Room ${roomNum} In`}
                                        className="w-full border border-amber-300 rounded px-1.5 py-1 text-xs pr-6 bg-amber-50/40"
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
                                            const val = formatDateFromPicker(e.target.value)
                                            copy[i][keyName] = val
                                            const outVal = copy[i][outKeyName] || copy[i].check_out
                                            if (val && outVal) {
                                              const calcN = calculateNightsFromDates(val, outVal)
                                              if (calcN > 0) copy[i][nightsKeyName] = String(calcN)
                                            }
                                            setMakkahHotels(copy)
                                          }
                                        }}
                                      />
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </td>
                          <td className="p-2 align-top">
                            <div className="space-y-1.5">
                              <div>
                                {Number(h.room_qty) > 1 && h.same_details_for_all_rooms === false && (
                                  <span className="text-[9px] font-bold text-amber-800 block mb-0.5 uppercase tracking-tight">Room 1 Out:</span>
                                )}
                                <div className="relative flex items-center">
                                  <input
                                    type="text"
                                    value={h.check_out || ''}
                                    onChange={(e) => {
                                      const copy = [...makkahHotels]
                                      const val = e.target.value
                                      copy[i].check_out = val
                                      if (copy[i].check_in && val) {
                                        const calcN = calculateNightsFromDates(copy[i].check_in, val)
                                        if (calcN > 0) copy[i].nights = String(calcN)
                                      }
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
                                        const val = formatDateFromPicker(e.target.value)
                                        copy[i].check_out = val
                                        if (copy[i].check_in && val) {
                                          const calcN = calculateNightsFromDates(copy[i].check_in, val)
                                          if (calcN > 0) copy[i].nights = String(calcN)
                                        }
                                        setMakkahHotels(copy)
                                      }
                                    }}
                                  />
                                </div>
                              </div>

                              {h.same_details_for_all_rooms === false && Array.from({ length: Math.max(0, (parseInt(h.room_qty, 10) || 1) - 1) }).map((_, extraIdx) => {
                                const roomNum = extraIdx + 2
                                const keyName = `check_out_${roomNum}`
                                const inKeyName = `check_in_${roomNum}`
                                const nightsKeyName = `nights_${roomNum}`
                                const currentVal = h[keyName] || h.check_out || ''

                                return (
                                  <div key={`makkah-extra-out-${i}-${extraIdx}`}>
                                    <span className="text-[9px] font-bold text-amber-800 block mb-0.5 uppercase tracking-tight">Room {roomNum} Out:</span>
                                    <div className="relative flex items-center">
                                      <input
                                        type="text"
                                        value={currentVal}
                                        onChange={(e) => {
                                          const copy = [...makkahHotels]
                                          const val = e.target.value
                                          copy[i][keyName] = val
                                          const inVal = copy[i][inKeyName] || copy[i].check_in
                                          if (inVal && val) {
                                            const calcN = calculateNightsFromDates(inVal, val)
                                            if (calcN > 0) copy[i][nightsKeyName] = String(calcN)
                                          }
                                          setMakkahHotels(copy)
                                        }}
                                        placeholder={`Room ${roomNum} Out`}
                                        className="w-full border border-amber-300 rounded px-1.5 py-1 text-xs pr-6 bg-amber-50/40"
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
                                            const val = formatDateFromPicker(e.target.value)
                                            copy[i][keyName] = val
                                            const inVal = copy[i][inKeyName] || copy[i].check_in
                                            if (inVal && val) {
                                              const calcN = calculateNightsFromDates(inVal, val)
                                              if (calcN > 0) copy[i][nightsKeyName] = String(calcN)
                                            }
                                            setMakkahHotels(copy)
                                          }
                                        }}
                                      />
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </td>
                          <td className="p-2 align-top">
                            <div className="space-y-1.5">
                              <div>
                                {Number(h.room_qty) > 1 && h.same_details_for_all_rooms === false && (
                                  <span className="text-[9px] font-bold text-amber-800 block mb-0.5 uppercase tracking-tight">R1 Nights:</span>
                                )}
                                <input
                                  type="number"
                                  value={h.nights || ''}
                                  onChange={(e) => {
                                    const copy = [...makkahHotels]
                                    const nVal = e.target.value
                                    copy[i].nights = nVal
                                    if (nVal && Number(nVal) > 0) {
                                      if (copy[i].check_in) {
                                        const calcOut = calculateCheckoutFromCheckinAndNights(copy[i].check_in, nVal)
                                        if (calcOut) copy[i].check_out = calcOut
                                      }
                                    }
                                    setMakkahHotels(copy)
                                  }}
                                  placeholder="Nights"
                                  className="w-full border rounded px-1.5 py-1 text-xs text-center"
                                />
                              </div>

                              {h.same_details_for_all_rooms === false && Array.from({ length: Math.max(0, (parseInt(h.room_qty, 10) || 1) - 1) }).map((_, extraIdx) => {
                                const roomNum = extraIdx + 2
                                const nightsKeyName = `nights_${roomNum}`
                                const inKeyName = `check_in_${roomNum}`
                                const outKeyName = `check_out_${roomNum}`
                                const currentVal = h[nightsKeyName] || h.nights || ''

                                return (
                                  <div key={`makkah-extra-nights-${i}-${extraIdx}`}>
                                    <span className="text-[9px] font-bold text-amber-800 block mb-0.5 uppercase tracking-tight">R{roomNum} Nights:</span>
                                    <input
                                      type="number"
                                      value={currentVal}
                                      onChange={(e) => {
                                        const copy = [...makkahHotels]
                                        const nVal = e.target.value
                                        copy[i][nightsKeyName] = nVal
                                        const inVal = copy[i][inKeyName] || copy[i].check_in
                                        if (nVal && Number(nVal) > 0 && inVal) {
                                          const calcOut = calculateCheckoutFromCheckinAndNights(inVal, nVal)
                                          if (calcOut) copy[i][outKeyName] = calcOut
                                        }
                                        setMakkahHotels(copy)
                                      }}
                                      placeholder="Nights"
                                      className="w-full border border-amber-300 rounded px-1.5 py-1 text-xs text-center bg-amber-50/40"
                                    />
                                  </div>
                                )
                              })}
                            </div>
                          </td>
                          <td className="p-2 align-top">
                            <div className="space-y-1.5">
                              <div>
                                {Number(h.room_qty) > 1 && h.same_details_for_all_rooms === false && (
                                  <span className="text-[9px] font-bold text-amber-800 block mb-0.5 uppercase tracking-tight">R1 Price:</span>
                                )}
                                <input
                                  type="text"
                                  value={h.night_price || ''}
                                  onChange={(e) => {
                                    const copy = [...makkahHotels]
                                    copy[i].night_price = e.target.value
                                    setMakkahHotels(copy)
                                  }}
                                  placeholder="Price"
                                  className="w-full border rounded px-1.5 py-1 text-xs font-semibold"
                                />
                              </div>

                              {h.same_details_for_all_rooms === false && Array.from({ length: Math.max(0, (parseInt(h.room_qty, 10) || 1) - 1) }).map((_, extraIdx) => {
                                const roomNum = extraIdx + 2
                                const priceKeyName = `night_price_${roomNum}`
                                const currentVal = h[priceKeyName] || h.night_price || ''

                                return (
                                  <div key={`makkah-extra-price-${i}-${extraIdx}`}>
                                    <span className="text-[9px] font-bold text-amber-800 block mb-0.5 uppercase tracking-tight">R{roomNum} Price:</span>
                                    <input
                                      type="text"
                                      value={currentVal}
                                      onChange={(e) => {
                                        const copy = [...makkahHotels]
                                        copy[i][priceKeyName] = e.target.value
                                        setMakkahHotels(copy)
                                      }}
                                      placeholder="Price"
                                      className="w-full border border-amber-300 rounded px-1.5 py-1 text-xs font-semibold bg-amber-50/40"
                                    />
                                  </div>
                                )
                              })}
                            </div>
                          </td>
                          <td className="p-2 align-top text-center pt-3">
                            {makkahHotels.length > 1 && (
                              <button type="button" onClick={() => removeMakkahRow(i)} className="text-red-500 hover:text-red-700">
                                <i className="ti ti-trash" />
                              </button>
                            )}
                          </td>
                        </tr>
                      </React.Fragment>
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
                      <th className="p-2 w-36">ROOM TYPE</th>
                      <th className="p-2">CHECK IN</th>
                      <th className="p-2">CHECK OUT</th>
                      <th className="p-2 w-16">NIGHTS</th>
                      <th className="p-2 w-24">NIGHT PRICE</th>
                      <th className="p-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {madinaHotels.map((h, i) => (
                      <React.Fragment key={`mad-hotel-row-${i}`}>
                        {Number(h.room_qty) > 1 && (
                          <tr className="bg-emerald-50/80 border-b border-emerald-200/60">
                            <td colSpan={8} className="px-3 py-1 text-left">
                              <div className="flex items-center justify-between text-[10px]">
                                <label className="flex items-center gap-1.5 cursor-pointer font-bold text-emerald-950">
                                  <input
                                    type="checkbox"
                                    checked={h.same_details_for_all_rooms !== false}
                                    onChange={(e) => {
                                      const copy = [...madinaHotels]
                                      copy[i].same_details_for_all_rooms = e.target.checked
                                      setMadinaHotels(copy)
                                    }}
                                    className="w-3.5 h-3.5 text-emerald-600 rounded cursor-pointer"
                                  />
                                  <span>Same Check-In/Out Dates & Night Price for all rooms</span>
                                </label>
                                {h.same_details_for_all_rooms === false && (
                                  <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                                    Independent Check-In, Check-Out & Price enabled per room below
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                        <tr>
                          <td className="p-2 align-top">
                            <input
                              type="text"
                              value={h.hotel_name || ''}
                              onChange={(e) => {
                                const copy = [...madinaHotels]
                                copy[i].hotel_name = e.target.value
                                setMadinaHotels(copy)
                              }}
                              placeholder="Hotel Name"
                              className="w-full border rounded px-2 py-1 text-xs"
                            />
                          </td>
                          <td className="p-2 align-top">
                            <input
                              type="number"
                              value={h.room_qty || ''}
                              onChange={(e) => {
                                const copy = [...madinaHotels]
                                copy[i].room_qty = e.target.value
                                setMadinaHotels(copy)
                              }}
                              placeholder="Qty"
                              className="w-full border rounded px-1.5 py-1 text-xs text-center"
                            />
                          </td>
                          <td className="p-2 align-top">
                            <div className="space-y-1.5">
                              <div>
                                {Number(h.room_qty) > 1 && (
                                  <span className="text-[9px] font-bold text-emerald-800 block mb-0.5 uppercase tracking-tight">Room 1 Type:</span>
                                )}
                                <input
                                  type="text"
                                  value={h.room_type || ''}
                                  onChange={(e) => {
                                    const copy = [...madinaHotels]
                                    copy[i].room_type = e.target.value
                                    setMadinaHotels(copy)
                                  }}
                                  placeholder={Number(h.room_qty) > 1 ? "Room 1 Type" : "Room Type"}
                                  className="w-full border rounded px-1.5 py-1 text-xs font-semibold uppercase bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                              </div>

                              {Array.from({ length: Math.max(0, (parseInt(h.room_qty, 10) || 1) - 1) }).map((_, extraIdx) => {
                                const roomNum = extraIdx + 2
                                const extraList = Array.isArray(h.extra_room_types) ? h.extra_room_types : []
                                const currentVal = extraList[extraIdx] || ''

                                return (
                                  <div key={`madina-extra-room-${i}-${extraIdx}`} className="animate-in fade-in duration-150">
                                    <span className="text-[9px] font-bold text-emerald-800 block mb-0.5 uppercase tracking-tight">Room {roomNum} Type:</span>
                                    <input
                                      type="text"
                                      value={currentVal}
                                      onChange={(e) => {
                                        const copy = [...madinaHotels]
                                        const nextExtras = [...(Array.isArray(copy[i].extra_room_types) ? copy[i].extra_room_types : [])]
                                        nextExtras[extraIdx] = e.target.value
                                        copy[i].extra_room_types = nextExtras
                                        setMadinaHotels(copy)
                                      }}
                                      placeholder={`Room ${roomNum} Type`}
                                      className="w-full border border-emerald-300 rounded px-1.5 py-1 text-xs font-semibold uppercase bg-emerald-50/50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                    />
                                  </div>
                                )
                              })}
                            </div>
                          </td>
                          <td className="p-2 align-top">
                            <div className="space-y-1.5">
                              <div>
                                {Number(h.room_qty) > 1 && h.same_details_for_all_rooms === false && (
                                  <span className="text-[9px] font-bold text-emerald-800 block mb-0.5 uppercase tracking-tight">Room 1 In:</span>
                                )}
                                <div className="relative flex items-center">
                                  <input
                                    type="text"
                                    value={h.check_in || ''}
                                    onChange={(e) => {
                                      const copy = [...madinaHotels]
                                      const val = e.target.value
                                      copy[i].check_in = val
                                      if (val && copy[i].check_out) {
                                        const calcN = calculateNightsFromDates(val, copy[i].check_out)
                                        if (calcN > 0) copy[i].nights = String(calcN)
                                      }
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
                                        const val = formatDateFromPicker(e.target.value)
                                        copy[i].check_in = val
                                        if (val && copy[i].check_out) {
                                          const calcN = calculateNightsFromDates(val, copy[i].check_out)
                                          if (calcN > 0) copy[i].nights = String(calcN)
                                        }
                                        setMadinaHotels(copy)
                                      }
                                    }}
                                  />
                                </div>
                              </div>

                              {h.same_details_for_all_rooms === false && Array.from({ length: Math.max(0, (parseInt(h.room_qty, 10) || 1) - 1) }).map((_, extraIdx) => {
                                const roomNum = extraIdx + 2
                                const keyName = `check_in_${roomNum}`
                                const outKeyName = `check_out_${roomNum}`
                                const nightsKeyName = `nights_${roomNum}`
                                const currentVal = h[keyName] || h.check_in || ''

                                return (
                                  <div key={`madina-extra-in-${i}-${extraIdx}`}>
                                    <span className="text-[9px] font-bold text-emerald-800 block mb-0.5 uppercase tracking-tight">Room {roomNum} In:</span>
                                    <div className="relative flex items-center">
                                      <input
                                        type="text"
                                        value={currentVal}
                                        onChange={(e) => {
                                          const copy = [...madinaHotels]
                                          const val = e.target.value
                                          copy[i][keyName] = val
                                          const outVal = copy[i][outKeyName] || copy[i].check_out
                                          if (val && outVal) {
                                            const calcN = calculateNightsFromDates(val, outVal)
                                            if (calcN > 0) copy[i][nightsKeyName] = String(calcN)
                                          }
                                          setMadinaHotels(copy)
                                        }}
                                        placeholder={`Room ${roomNum} In`}
                                        className="w-full border border-emerald-300 rounded px-1.5 py-1 text-xs pr-6 bg-emerald-50/40"
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
                                            const val = formatDateFromPicker(e.target.value)
                                            copy[i][keyName] = val
                                            const outVal = copy[i][outKeyName] || copy[i].check_out
                                            if (val && outVal) {
                                              const calcN = calculateNightsFromDates(val, outVal)
                                              if (calcN > 0) copy[i][nightsKeyName] = String(calcN)
                                            }
                                            setMadinaHotels(copy)
                                          }
                                        }}
                                      />
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </td>
                          <td className="p-2 align-top">
                            <div className="space-y-1.5">
                              <div>
                                {Number(h.room_qty) > 1 && h.same_details_for_all_rooms === false && (
                                  <span className="text-[9px] font-bold text-emerald-800 block mb-0.5 uppercase tracking-tight">Room 1 Out:</span>
                                )}
                                <div className="relative flex items-center">
                                  <input
                                    type="text"
                                    value={h.check_out || ''}
                                    onChange={(e) => {
                                      const copy = [...madinaHotels]
                                      const val = e.target.value
                                      copy[i].check_out = val
                                      if (copy[i].check_in && val) {
                                        const calcN = calculateNightsFromDates(copy[i].check_in, val)
                                        if (calcN > 0) copy[i].nights = String(calcN)
                                      }
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
                                        const val = formatDateFromPicker(e.target.value)
                                        copy[i].check_out = val
                                        if (copy[i].check_in && val) {
                                          const calcN = calculateNightsFromDates(copy[i].check_in, val)
                                          if (calcN > 0) copy[i].nights = String(calcN)
                                        }
                                        setMadinaHotels(copy)
                                      }
                                    }}
                                  />
                                </div>
                              </div>

                              {h.same_details_for_all_rooms === false && Array.from({ length: Math.max(0, (parseInt(h.room_qty, 10) || 1) - 1) }).map((_, extraIdx) => {
                                const roomNum = extraIdx + 2
                                const keyName = `check_out_${roomNum}`
                                const inKeyName = `check_in_${roomNum}`
                                const nightsKeyName = `nights_${roomNum}`
                                const currentVal = h[keyName] || h.check_out || ''

                                return (
                                  <div key={`madina-extra-out-${i}-${extraIdx}`}>
                                    <span className="text-[9px] font-bold text-emerald-800 block mb-0.5 uppercase tracking-tight">Room {roomNum} Out:</span>
                                    <div className="relative flex items-center">
                                      <input
                                        type="text"
                                        value={currentVal}
                                        onChange={(e) => {
                                          const copy = [...madinaHotels]
                                          const val = e.target.value
                                          copy[i][keyName] = val
                                          const inVal = copy[i][inKeyName] || copy[i].check_in
                                          if (inVal && val) {
                                            const calcN = calculateNightsFromDates(inVal, val)
                                            if (calcN > 0) copy[i][nightsKeyName] = String(calcN)
                                          }
                                          setMadinaHotels(copy)
                                        }}
                                        placeholder={`Room ${roomNum} Out`}
                                        className="w-full border border-emerald-300 rounded px-1.5 py-1 text-xs pr-6 bg-emerald-50/40"
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
                                            const val = formatDateFromPicker(e.target.value)
                                            copy[i][keyName] = val
                                            const inVal = copy[i][inKeyName] || copy[i].check_in
                                            if (inVal && val) {
                                              const calcN = calculateNightsFromDates(inVal, val)
                                              if (calcN > 0) copy[i][nightsKeyName] = String(calcN)
                                            }
                                            setMadinaHotels(copy)
                                          }
                                        }}
                                      />
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </td>
                          <td className="p-2 align-top">
                            <div className="space-y-1.5">
                              <div>
                                {Number(h.room_qty) > 1 && h.same_details_for_all_rooms === false && (
                                  <span className="text-[9px] font-bold text-emerald-800 block mb-0.5 uppercase tracking-tight">R1 Nights:</span>
                                )}
                                <input
                                  type="number"
                                  value={h.nights || ''}
                                  onChange={(e) => {
                                    const copy = [...madinaHotels]
                                    const nVal = e.target.value
                                    copy[i].nights = nVal
                                    if (nVal && Number(nVal) > 0) {
                                      if (copy[i].check_in) {
                                        const calcOut = calculateCheckoutFromCheckinAndNights(copy[i].check_in, nVal)
                                        if (calcOut) copy[i].check_out = calcOut
                                      }
                                    }
                                    setMadinaHotels(copy)
                                  }}
                                  placeholder="Nights"
                                  className="w-full border rounded px-1.5 py-1 text-xs text-center"
                                />
                              </div>

                              {h.same_details_for_all_rooms === false && Array.from({ length: Math.max(0, (parseInt(h.room_qty, 10) || 1) - 1) }).map((_, extraIdx) => {
                                const roomNum = extraIdx + 2
                                const nightsKeyName = `nights_${roomNum}`
                                const inKeyName = `check_in_${roomNum}`
                                const outKeyName = `check_out_${roomNum}`
                                const currentVal = h[nightsKeyName] || h.nights || ''

                                return (
                                  <div key={`madina-extra-nights-${i}-${extraIdx}`}>
                                    <span className="text-[9px] font-bold text-emerald-800 block mb-0.5 uppercase tracking-tight">R{roomNum} Nights:</span>
                                    <input
                                      type="number"
                                      value={currentVal}
                                      onChange={(e) => {
                                        const copy = [...madinaHotels]
                                        const nVal = e.target.value
                                        copy[i][nightsKeyName] = nVal
                                        const inVal = copy[i][inKeyName] || copy[i].check_in
                                        if (nVal && Number(nVal) > 0 && inVal) {
                                          const calcOut = calculateCheckoutFromCheckinAndNights(inVal, nVal)
                                          if (calcOut) copy[i][outKeyName] = calcOut
                                        }
                                        setMadinaHotels(copy)
                                      }}
                                      placeholder="Nights"
                                      className="w-full border border-emerald-300 rounded px-1.5 py-1 text-xs text-center bg-emerald-50/40"
                                    />
                                  </div>
                                )
                              })}
                            </div>
                          </td>
                          <td className="p-2 align-top">
                            <div className="space-y-1.5">
                              <div>
                                {Number(h.room_qty) > 1 && h.same_details_for_all_rooms === false && (
                                  <span className="text-[9px] font-bold text-emerald-800 block mb-0.5 uppercase tracking-tight">R1 Price:</span>
                                )}
                                <input
                                  type="text"
                                  value={h.night_price || ''}
                                  onChange={(e) => {
                                    const copy = [...madinaHotels]
                                    copy[i].night_price = e.target.value
                                    setMadinaHotels(copy)
                                  }}
                                  placeholder="Price"
                                  className="w-full border rounded px-1.5 py-1 text-xs font-semibold"
                                />
                              </div>

                              {h.same_details_for_all_rooms === false && Array.from({ length: Math.max(0, (parseInt(h.room_qty, 10) || 1) - 1) }).map((_, extraIdx) => {
                                const roomNum = extraIdx + 2
                                const priceKeyName = `night_price_${roomNum}`
                                const currentVal = h[priceKeyName] || h.night_price || ''

                                return (
                                  <div key={`madina-extra-price-${i}-${extraIdx}`}>
                                    <span className="text-[9px] font-bold text-emerald-800 block mb-0.5 uppercase tracking-tight">R{roomNum} Price:</span>
                                    <input
                                      type="text"
                                      value={currentVal}
                                      onChange={(e) => {
                                        const copy = [...madinaHotels]
                                        copy[i][priceKeyName] = e.target.value
                                        setMadinaHotels(copy)
                                      }}
                                      placeholder="Price"
                                      className="w-full border border-emerald-300 rounded px-1.5 py-1 text-xs font-semibold bg-emerald-50/40"
                                    />
                                  </div>
                                )
                              })}
                            </div>
                          </td>
                          <td className="p-2 align-top text-center pt-3">
                            {madinaHotels.length > 1 && (
                              <button type="button" onClick={() => removeMadinaRow(i)} className="text-red-500 hover:text-red-700">
                                <i className="ti ti-trash" />
                              </button>
                            )}
                          </td>
                        </tr>
                      </React.Fragment>
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

          {/* ID 420: GENERATE VOUCHERS ACTION BAR BELOW CLIENT PACKAGE */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 rounded-xl border border-indigo-900/50 shadow-md space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-white gap-1">
              <span className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-indigo-300">
                <i className="ti ti-file-text text-base text-emerald-400" />
                Voucher Generator Suite (ID 420)
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                Generate 1-Click E-Tickets, Hotel Vouchers, Transport Vouchers & Combined Packages
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => setShowDocModal('eticket')}
                className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all border border-indigo-400/30 active:scale-95 cursor-pointer"
              >
                <span>✈️ Generate E-Ticket</span>
              </button>

              <button
                type="button"
                onClick={() => setShowDocModal('hotel')}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all border border-emerald-400/30 active:scale-95 cursor-pointer"
              >
                <span>🏨 Generate Hotel Voucher</span>
              </button>

              <button
                type="button"
                onClick={() => setShowDocModal('transport')}
                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all border border-blue-400/30 active:scale-95 cursor-pointer"
              >
                <span>🚌 Generate Transport Voucher</span>
              </button>

              <button
                type="button"
                onClick={() => setShowDocModal('allinone')}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-md transition-all border border-purple-400/40 active:scale-95 cursor-pointer"
              >
                <span>✨ Generate All-in-One</span>
              </button>
            </div>
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
                    checked={showCompanyDetails}
                    onChange={(e) => setShowCompanyDetails(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  />
                  <i className="ti ti-building text-emerald-600" />
                  <span>Company Details (Logo & Address)</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 bg-gray-100 border border-gray-200 px-3 py-2 rounded-xl cursor-pointer hover:bg-gray-200 transition-all select-none">
                  <input
                    type="checkbox"
                    checked={hidePdfBreakup}
                    onChange={(e) => setHidePdfBreakup(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <span>Hide Item Breakup</span>
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
                  showCompanyDetails={showCompanyDetails}
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
                  showCompanyDetails={showCompanyDetails}
                />
              )}
            </div>

          </div>
        </div>
      )}

      {/* PASTE GDS TERMINAL TEXT MODAL (0 API CALLS, INSTANT OFFLINE) */}
      {showTerminalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-200 animate-in fade-in zoom-in duration-150">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-emerald-50/70">
              <h3 className="text-xs font-bold text-emerald-900 uppercase tracking-wide flex items-center gap-2">
                <i className="ti ti-terminal-2 text-emerald-600 text-base" />
                Paste GDS Terminal PNR (Offline ⚡)
              </h3>
              <button
                onClick={() => setShowTerminalModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="bg-gray-900 text-emerald-400 font-mono text-[11px] p-2.5 rounded-lg border border-gray-800 space-y-1">
                <p className="text-gray-400 text-[10px] uppercase font-sans font-semibold border-b border-gray-800 pb-1">Example GDS Text:</p>
                <p>1.1SURNAME/GIVEN NAME</p>
                <p>1. SV 701 Y 20AUG KHIJED HS1 0920 1115 0</p>
                <p>2. SV 1054 M 30AUG JEDRUH HS1 2355 #0140 0</p>
              </div>

              <textarea
                rows="5"
                placeholder="Paste GDS PNR terminal lines here..."
                value={terminalInputText}
                onChange={e => setTerminalInputText(e.target.value)}
                className="w-full font-mono text-xs p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-gray-50"
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTerminalModal(false)}
                  className="px-3.5 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleParseTerminalText}
                  className="px-4 py-2 text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg font-bold shadow-sm flex items-center gap-1.5"
                >
                  <i className="ti ti-bolt text-sm" />
                  Parse Offline Instant
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CLIENT PAYMENT INVOICE GENERATOR MODAL ── */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden border border-gray-200 flex flex-col max-h-[92vh] animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-400/30 flex items-center justify-center font-bold text-purple-300">
                  <i className="ti ti-receipt text-lg" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">Client Payment Invoice Generator</h3>
                  <p className="text-[11px] text-slate-300">Billed to: <span className="text-purple-300 font-bold">{invoiceData.clientName}</span> | Invoice #{invoiceData.invoiceNo}</p>
                </div>
              </div>
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="text-slate-400 hover:text-white text-2xl font-bold leading-none transition-colors"
              >
                &times;
              </button>
            </div>

            {/* Modal Body: Left Controls & Right Live Preview */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-50">
              
              {/* Left Panel: Invoice Form Controls */}
              <div className="lg:col-span-5 space-y-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs text-xs">
                <div className="font-bold text-slate-900 border-b border-slate-100 pb-2 uppercase tracking-wide flex items-center gap-1.5">
                  <i className="ti ti-adjustments text-blue-600" /> Invoice Settings & Financials
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

                <div className="grid grid-cols-2 gap-3">
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
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">DUE DATE (OPTIONAL)</label>
                    <input
                      type="date"
                      value={invoiceData.dueDate}
                      onChange={(e) => setInvoiceData({ ...invoiceData, dueDate: e.target.value })}
                      className="w-full border rounded px-2 py-1 text-xs"
                    />
                  </div>
                </div>

                {/* Ticket Passengers Section */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] text-slate-800 uppercase flex items-center gap-1">
                      <i className="ti ti-ticket text-indigo-600" /> Ticket Passengers ({invoiceData.ticketPassengers?.length || 0})
                    </span>
                    <button
                      type="button"
                      onClick={handleAddPassengerItem}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      <i className="ti ti-plus" /> Add Passenger Leg
                    </button>
                  </div>

                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {(invoiceData.ticketPassengers || []).map((pass, idx) => (
                      <div key={`inv-pass-edit-${idx}`} className="bg-indigo-50/50 p-2 rounded-lg border border-indigo-100 space-y-1 text-xs">
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
                              placeholder="FARE / NET"
                            />
                          </div>
                          <div className="col-span-1 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemovePassengerItem(idx)}
                              className="text-red-500 hover:text-red-700"
                              title="Remove passenger leg"
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
                            placeholder="TICKET NO (e.g. 176-5580-274)"
                          />
                          <input
                            type="text"
                            value={pass.sector}
                            onChange={(e) => handleUpdatePassengerItem(idx, 'sector', e.target.value)}
                            className="w-full border rounded px-2 py-0.5 font-mono text-[10px] bg-white"
                            placeholder="SECTOR (e.g. KHI-FRA 05/03)"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Line Items Editable Table */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] text-slate-800 uppercase">Itemized Services ({invoiceData.items.length})</span>
                    <button
                      type="button"
                      onClick={handleAddInvoiceItem}
                      className="text-[11px] font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1"
                    >
                      <i className="ti ti-plus" /> Add Service Row
                    </button>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {invoiceData.items.map((item, idx) => (
                      <div key={`inv-row-edit-${idx}`} className="grid grid-cols-12 gap-1.5 items-center bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <div className="col-span-7">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleUpdateInvoiceItem(idx, 'description', e.target.value)}
                            className="w-full border rounded px-2 py-1 text-xs font-semibold"
                            placeholder="Description"
                          />
                        </div>
                        <div className="col-span-4">
                          <input
                            type="number"
                            value={item.amount}
                            onChange={(e) => handleUpdateInvoiceItem(idx, 'amount', Number(e.target.value))}
                            className="w-full border rounded px-2 py-1 text-xs font-bold text-right font-mono"
                            placeholder="Amount"
                          />
                        </div>
                        <div className="col-span-1 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveInvoiceItem(idx)}
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

                {/* Financial Adjustments */}
                <div className="space-y-2 pt-2 border-t border-slate-100 bg-purple-50/40 p-3 rounded-xl border border-purple-100">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">DISCOUNT / DEDUCTION</label>
                    <input
                      type="number"
                      value={invoiceData.discount}
                      onChange={(e) => {
                        const discVal = Number(e.target.value || 0)
                        const netTotal = Math.max(0, invoiceData.subtotal - discVal)
                        const paidVal = Number(invoiceData.amountPaid || 0)
                        const newBalance = Math.max(0, netTotal - paidVal)
                        const newStatus = newBalance <= 0 ? 'PAID' : (paidVal > 0 ? 'PARTIAL' : 'UNPAID')
                        setInvoiceData({
                          ...invoiceData,
                          discount: e.target.value,
                          totalAmount: netTotal,
                          balanceDue: newBalance,
                          status: newStatus
                        })
                      }}
                      className="w-full border rounded px-2 py-1 text-xs font-bold text-right font-mono bg-white"
                      placeholder="0"
                    />
                  </div>
                </div>
                {/* Payments Received Section */}
                <div className="space-y-2 pt-2 border-t border-emerald-200 bg-emerald-50/40 p-2 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] text-emerald-900 uppercase flex items-center gap-1">
                      <i className="ti ti-cash-banknote text-emerald-600" /> Payments Received ({invoiceData.payments?.length || 0})
                    </span>
                    <button
                      type="button"
                      onClick={handleAddPaymentItem}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
                    >
                      <i className="ti ti-plus" /> + Add Payment Receipt
                    </button>
                  </div>

                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {(invoiceData.payments || []).map((pm, idx) => (
                      <div key={`inv-pay-edit-${idx}`} className="bg-white p-2 rounded-lg border border-emerald-200 space-y-1 text-xs">
                        <div className="grid grid-cols-12 gap-1.5 items-center">
                          <div className="col-span-4">
                            <input
                              type="date"
                              value={pm.date}
                              onChange={(e) => handleUpdatePaymentItem(idx, 'date', e.target.value)}
                              className="w-full border rounded px-1.5 py-0.5 text-[11px] font-mono"
                            />
                          </div>
                          <div className="col-span-4">
                            <select
                              value={pm.paymentMethod || 'Bank Transfer'}
                              onChange={(e) => handleUpdatePaymentItem(idx, 'paymentMethod', e.target.value)}
                              className="w-full border rounded px-1 py-0.5 text-[11px] font-bold text-slate-800"
                            >
                              <option value="Bank Transfer">Bank Transfer</option>
                              <option value="Cash">Cash</option>
                              <option value="Online / Raast">Online / Raast</option>
                              <option value="Cheque">Cheque</option>
                              <option value="Card">Card</option>
                            </select>
                          </div>
                          <div className="col-span-3">
                            <input
                              type="number"
                              value={pm.amount}
                              onChange={(e) => handleUpdatePaymentItem(idx, 'amount', Number(e.target.value))}
                              className="w-full border border-emerald-300 rounded px-1.5 py-0.5 text-xs font-mono font-black text-right text-emerald-900"
                              placeholder="AMOUNT"
                            />
                          </div>
                          <div className="col-span-1 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemovePaymentItem(idx)}
                              className="text-red-500 hover:text-red-700"
                              title="Remove receipt"
                            >
                              <i className="ti ti-trash" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                          <input
                            type="text"
                            value={pm.voucherNo}
                            onChange={(e) => handleUpdatePaymentItem(idx, 'voucherNo', e.target.value)}
                            className="w-full border rounded px-2 py-0.5 font-mono text-[10px] text-gray-700"
                            placeholder="VOUCHER # (e.g. RV-101)"
                          />
                          <input
                            type="text"
                            value={pm.description}
                            onChange={(e) => handleUpdatePaymentItem(idx, 'description', e.target.value)}
                            className="w-full border rounded px-2 py-0.5 text-[10px] text-gray-700"
                            placeholder="REMARKS / DESCRIPTION"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center pt-2 font-mono text-xs border-t border-emerald-200">
                    <span className="font-bold text-slate-600">NET TOTAL: {Number(invoiceData.totalAmount || 0).toLocaleString()}</span>
                    <span className={`font-black text-sm px-2 py-0.5 rounded ${invoiceData.balanceDue > 0 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      BALANCE DUE: {Number(invoiceData.balanceDue || 0).toLocaleString()} ({invoiceData.status})
                    </span>
                  </div>
                </div>

                {/* Bank Details & Remarks */}
                <div className="space-y-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">BANK TRANSFER DETAILS</label>
                    <input
                      type="text"
                      value={invoiceData.bankDetails}
                      onChange={(e) => setInvoiceData({ ...invoiceData, bankDetails: e.target.value })}
                      className="w-full border rounded px-2 py-1 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">REMARKS / TERMS</label>
                    <input
                      type="text"
                      value={invoiceData.remarks}
                      onChange={(e) => setInvoiceData({ ...invoiceData, remarks: e.target.value })}
                      className="w-full border rounded px-2 py-1 text-xs"
                    />
                  </div>
                </div>

              </div>

                {/* Right Panel: Live PDF Preview */}
              <div className="lg:col-span-7 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 text-center flex items-center justify-between px-2">
                  <span>📄 Live Printable Invoice PDF Preview</span>
                  <label className="flex items-center gap-1.5 cursor-pointer bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg border border-purple-200 text-purple-900 font-bold transition-all">
                    <input
                      type="checkbox"
                      checked={invoiceData.hideBreakup || false}
                      onChange={(e) => setInvoiceData({ ...invoiceData, hideBreakup: e.target.checked })}
                      className="w-3.5 h-3.5 text-purple-600 rounded"
                    />
                    <span className="text-[10px]">
                      {invoiceData.hideBreakup ? 'Without Breakup' : 'With Breakup'}
                    </span>
                  </label>
                </div>
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
                  payments={invoiceData.payments || []}
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

            {/* Modal Footer Actions */}
            <div className="px-6 py-3 border-t border-gray-200 bg-white flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowInvoiceModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
              >
                Close
              </button>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadPdf('printable-invoice', `Invoice_${invoiceData.invoiceNo}.pdf`)}
                  className="px-4 py-2 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
                >
                  <i className="ti ti-download text-sm" /> Download Invoice PDF
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-xl flex items-center gap-1.5 shadow-md transition-all"
                >
                  <i className="ti ti-printer text-sm" /> Print Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ID 420: DOCUMENT GENERATOR PREVIEW MODAL */}
      {showDocModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 overflow-y-auto p-2 sm:p-6 flex justify-center items-start backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDocModal(null)
          }}
        >
          <div className="bg-white rounded-2xl max-w-5xl w-full p-4 sm:p-6 space-y-4 shadow-2xl my-3 sm:my-6 relative border border-slate-200 text-slate-900 animate-in fade-in zoom-in duration-150">
            
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-3.5 gap-2">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2 uppercase tracking-wide">
                  <span className="text-xl">
                    {showDocModal === 'eticket' && '✈️'}
                    {showDocModal === 'hotel' && '🏨'}
                    {showDocModal === 'transport' && '🚌'}
                    {showDocModal === 'allinone' && '✨'}
                  </span>
                  {showDocModal === 'eticket' && 'E-Ticket Passenger Itinerary Generator'}
                  {showDocModal === 'hotel' && 'Hotel Accommodation Voucher Generator'}
                  {showDocModal === 'transport' && 'Transportation Services Voucher Generator'}
                  {showDocModal === 'allinone' && 'All-in-One Consolidated Voucher Generator'}
                </h3>
                <p className="text-xs text-slate-500 font-medium">Billed to: <span className="font-bold text-indigo-900">{header.name || 'Client'}</span></p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const elemId = showDocModal === 'eticket' ? 'printable-eticket' 
                                 : showDocModal === 'hotel' ? 'printable-hotel-voucher'
                                 : showDocModal === 'transport' ? 'printable-transport-voucher'
                                 : 'printable-all-in-one'
                    const fname = `${showDocModal.toUpperCase()}_${(header.name || 'Client').replace(/\s+/g, '_')}.pdf`
                    downloadPdf(elemId, fname)
                  }}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                >
                  <i className="ti ti-download text-sm" /> Download PDF
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                >
                  <i className="ti ti-printer text-sm" /> Print
                </button>
                <button
                  type="button"
                  onClick={() => setShowDocModal(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3.5 py-2 rounded-xl transition-all cursor-pointer"
                >
                  &times; Close
                </button>
              </div>
            </div>

            {/* Controls Bar for missing info / toggles */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {(showDocModal === 'eticket' || showDocModal === 'allinone') && (
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">TICKET LAYOUT MODE</label>
                    <select
                      value={ticketMode}
                      onChange={(e) => setTicketMode(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold bg-white text-slate-800"
                    >
                      <option value="grouped">Grouped Itinerary (All Pax in 1 Ticket)</option>
                      <option value="separate">Separate Ticket Per Passenger</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">PNR / BOOKING REF</label>
                    <input
                      type="text"
                      placeholder="e.g. PNR-8941A"
                      value={customPnr}
                      onChange={(e) => setCustomPnr(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold font-mono bg-white uppercase text-slate-900"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">ISSUE DATE</label>
                <input
                  type="text"
                  placeholder="e.g. 05 MAR 2026"
                  value={customIssueDate}
                  onChange={(e) => setCustomIssueDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold font-mono bg-white uppercase text-slate-900"
                />
              </div>

              {(showDocModal === 'hotel' || showDocModal === 'allinone') && (
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">MAKKAH HOTEL HCN #</label>
                    <input
                      type="text"
                      placeholder="e.g. HCN-90214"
                      value={hcnMakkah}
                      onChange={(e) => setHcnMakkah(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold font-mono bg-white uppercase text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">MADINA HOTEL HCN #</label>
                    <input
                      type="text"
                      placeholder="e.g. HCN-44120"
                      value={hcnMadina}
                      onChange={(e) => setHcnMadina(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold font-mono bg-white uppercase text-slate-900"
                    />
                  </div>
                </>
              )}

              {(showDocModal === 'transport' || showDocModal === 'allinone') && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">DRIVER / TRANSPORT CONTACT</label>
                  <input
                    type="text"
                    placeholder="e.g. Driver: +966 50 123 4567"
                    value={driverContact}
                    onChange={(e) => setDriverContact(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold bg-white text-slate-900"
                  />
                </div>
              )}
            </div>

            {/* Document Preview Box */}
            <div className="overflow-x-auto max-w-full pb-2">
              {showDocModal === 'eticket' && (
                <ETicketPdfTemplate 
                  header={header}
                  pax={pax}
                  totalPax={totalPax}
                  flightItinerary={flightItinerary}
                  passengerList={passengerList}
                  pnr={customPnr}
                  issueDate={customIssueDate}
                  mode={ticketMode}
                />
              )}
              {showDocModal === 'hotel' && (
                <HotelVoucherPdfTemplate 
                  header={header}
                  leadGuestName={header.name}
                  paxSummary={pax}
                  makkahHotels={makkahHotels}
                  madinaHotels={madinaHotels}
                  hcnMakkah={hcnMakkah}
                  hcnMadina={hcnMadina}
                  issueDate={customIssueDate}
                  comments={comments}
                />
              )}
              {showDocModal === 'transport' && (
                <TransportVoucherPdfTemplate 
                  header={header}
                  leadGuestName={header.name}
                  paxSummary={pax}
                  transportRows={transportRows}
                  driverContact={driverContact}
                  issueDate={customIssueDate}
                  comments={comments}
                />
              )}
              {showDocModal === 'allinone' && (
                <AllInOnePdfTemplate 
                  header={header}
                  pax={pax}
                  totalPax={totalPax}
                  flightItinerary={flightItinerary}
                  passengerList={passengerList}
                  pnr={customPnr}
                  makkahHotels={makkahHotels}
                  madinaHotels={madinaHotels}
                  transportRows={transportRows}
                  hcnMakkah={hcnMakkah}
                  hcnMadina={hcnMadina}
                  driverContact={driverContact}
                  issueDate={customIssueDate}
                  comments={comments}
                />
              )}
            </div>

          </div>
        </div>
      )}

      {/* Ticket Sales Report Modal */}
      <PackageSalesReportModal
        isOpen={showSalesReportModal}
        onClose={() => setShowSalesReportModal(false)}
        packageData={{
          header,
          pax,
          depFlight: flightItinerary[0] || {},
          arrFlight: flightItinerary[1] || {},
          passengerList: passengerList || [],
          pnr: customPnr || '',
          comments
        }}
      />
    </div>
  )
}
