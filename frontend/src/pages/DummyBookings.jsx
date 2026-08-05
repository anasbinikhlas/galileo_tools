import { useState, useRef, useEffect } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import axios from 'axios'
import html2pdf from 'html2pdf.js'
import { getActiveCompanyDetails } from '../pages/CompanyDetails'

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || ''

// ── KNOWN AIRLINES DICTIONARY ──
const KNOWN_AIRLINES = {
  TG: 'Thai Airways Intl Public Co Ltd',
  QR: 'Qatar Airways',
  SV: 'Saudi Arabian Airlines',
  PK: 'Pakistan International Airlines',
  EK: 'Emirates',
  EY: 'Etihad Airways',
  FZ: 'Flydubai',
  G9: 'Air Arabia',
  TK: 'Turkish Airlines',
  GF: 'Gulf Air',
  WY: 'Oman Air',
  KU: 'Kuwait Airways',
  XY: 'Flynas',
  F3: 'Flyadeal',
  PA: 'Airblue',
}

// ── AIRPORT CODES DICTIONARY ──
const AIRPORTS = {
  KHI: { name: 'Jinnah Intl (KHI)', city: 'Karachi (KHI)', country: 'Karachi, PK', terminal: 'Terminal M' },
  BKK: { name: 'Suvarnabhumi Intl Arpt (BKK)', city: 'Bangkok (BKK)', country: 'Bangkok, TH', terminal: '' },
  CAN: { name: 'Baiyun Intl (CAN)', city: 'Guangzhou (CAN)', country: 'Guangzhou, CN', terminal: 'Terminal 2' },
  JED: { name: 'King Abdulaziz Intl (JED)', city: 'Jeddah (JED)', country: 'Jeddah, SA', terminal: 'Terminal North' },
  MED: { name: 'Prince Mohammad Bin Abdulaziz (MED)', city: 'Madinah (MED)', country: 'Madinah, SA', terminal: '' },
  RUH: { name: 'King Khalid Intl (RUH)', city: 'Riyadh (RUH)', country: 'Riyadh, SA', terminal: 'Terminal 2' },
  DOH: { name: 'Hamad Intl Airport (DOH)', city: 'Doha (DOH)', country: 'Doha, QA', terminal: '' },
  DXB: { name: 'Dubai Intl Airport (DXB)', city: 'Dubai (DXB)', country: 'Dubai, AE', terminal: 'Terminal 3' },
  SHJ: { name: 'Sharjah Intl Airport (SHJ)', city: 'Sharjah (SHJ)', country: 'Sharjah, AE', terminal: '' },
  IST: { name: 'Istanbul Airport (IST)', city: 'Istanbul (IST)', country: 'Istanbul, TR', terminal: '' },
  LHR: { name: 'London Heathrow (LHR)', city: 'London (LHR)', country: 'London, UK', terminal: 'Terminal 4' },
}

// Helper to calculate nights count
const calcNights = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return ''
  const d1 = new Date(checkIn)
  const d2 = new Date(checkOut)
  const diffDays = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24))
  return !isNaN(diffDays) && diffDays > 0 ? `${diffDays} Night${diffDays > 1 ? 's' : ''}` : ''
}

// Format 4-digit time string like 1550 -> 3:50 PM
const formatGdsTime = (timeStr) => {
  if (!timeStr) return ''
  const cleanTime = timeStr.replace('#', '')
  if (cleanTime.length !== 4) return timeStr
  let hours = parseInt(cleanTime.substring(0, 2), 10)
  const mins = cleanTime.substring(2, 4)
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  return `${hours}:${mins} ${ampm}`
}

// ── ROBUST GLOBAL GDS PASSENGER EXTRACTOR (HANDLES 1 TO 100+ PASSENGERS ON SAME OR MULTIPLE LINES) ──
const parseGdsPassengers = (text) => {
  const paxList = []
  if (!text) return paxList

  const regex = /(?:\d+\.(?:\d+|I\/\d*)|\b)([A-Z]{2,})\/([A-Z\s,]+?(?:MR|MRS|MS|MSTR|MISS|CHD|INF)?)(?=\s+\d+\.|\s+[A-Z0-9]{2}\s+\d+|\s*$|\*|\()/gi

  let match
  while ((match = regex.exec(text)) !== null) {
    const surname = match[1].trim().toUpperCase()
    let givenAndTitle = match[2].trim().toUpperCase()
    givenAndTitle = givenAndTitle.replace(/\s*\d+.*$/, '').trim()

    if (
      surname &&
      givenAndTitle &&
      surname.length >= 2 &&
      !['QR', 'TG', 'SV', 'PK', 'EK', 'EY', 'FZ', 'G9', 'TK', 'GF', 'WY', 'KU', 'XY', 'F3', 'PA', 'STATUS', 'CONFIR'].includes(surname)
    ) {
      const fullName = `${surname}, ${givenAndTitle}`
      if (!paxList.includes(fullName)) {
        paxList.push(fullName)
      }
    }
  }

  return paxList
}

export default function DummyBookings() {
  // ── STATE MANAGEMENT ──
  const [reservationCode, setReservationCode] = useState('')
  const [rawText, setRawText] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)

  // Passengers list (starts clean)
  const [passengers, setPassengers] = useState([''])

  // Flight sectors list (starts clean)
  const [flights, setFlights] = useState([
    {
      id: 1,
      airline: '',
      airlineCode: '',
      flightNo: '',
      pnr: '',
      departDate: '',
      departTime: '',
      departCity: '',
      departAirport: '',
      departCountry: '',
      departTerminal: '',
      arriveDate: '',
      arriveTime: '',
      arriveCity: '',
      arriveAirport: '',
      arriveCountry: '',
      arriveTerminal: '',
      arrivePlusOne: '',
      stopType: 'NON STOP',
      duration: '',
      cabinClass: 'Economy',
      aircraft: '',
      meal: 'Meal',
      status: 'Confirmed',
    },
  ])

  // Multi-Leg Hotel Accommodations (starts clean)
  const [includeHotel, setIncludeHotel] = useState(true)
  const [hotels, setHotels] = useState([
    {
      id: 1,
      country: '',
      city: '',
      hotelName: '',
      roomType: '',
      quantity: '',
      checkIn: '',
      checkOut: '',
      nights: '',
      confirmationNo: '',
      status: 'Confirmed',
    },
  ])

  // Agency Details & Include Toggle
  const [includeAgencyFooter, setIncludeAgencyFooter] = useState(true)
  const [agencyInfo, setAgencyInfo] = useState({
    name: 'ZUYUFUR RAHMAN HAJJ AND UMRAH',
    address: 'Plot 17C, Shop No Sunset Comm St 4 Dha Phase 4',
    cityCountry: 'Karachi, Pakistan',
  })

  // Camera elements
  const videoRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const fileInputRef = useRef(null)

  // Auto load active company details from CompanyDetails setting if available
  useEffect(() => {
    try {
      const activeCompany = getActiveCompanyDetails()
      if (activeCompany && activeCompany.name) {
        setAgencyInfo((prev) => ({
          ...prev,
          name: activeCompany.name || prev.name,
          address: activeCompany.address || prev.address,
        }))
      }
    } catch (e) {}
  }, [])

  // ── RESET ENTIRE FORM TO CLEAN STATE ──
  const handleResetForm = () => {
    setReservationCode('')
    setRawText('')
    setPassengers([''])
    setFlights([
      {
        id: Date.now(),
        airline: '',
        airlineCode: '',
        flightNo: '',
        pnr: '',
        departDate: '',
        departTime: '',
        departCity: '',
        departAirport: '',
        departCountry: '',
        departTerminal: '',
        arriveDate: '',
        arriveTime: '',
        arriveCity: '',
        arriveAirport: '',
        arriveCountry: '',
        arriveTerminal: '',
        arrivePlusOne: '',
        stopType: 'NON STOP',
        duration: '',
        cabinClass: 'Economy',
        aircraft: '',
        meal: 'Meal',
        status: 'Confirmed',
      },
    ])
    setHotels([
      {
        id: Date.now() + 1,
        country: '',
        city: '',
        hotelName: '',
        roomType: '',
        quantity: '',
        checkIn: '',
        checkOut: '',
        nights: '',
        confirmationNo: '',
        status: 'Confirmed',
      },
    ])
    toast.success('Itinerary form reset cleanly!')
  }

  // ── AUTO POPULATE GLOBAL RESERVATION CODE / PNR TO ALL FLIGHT SECTORS ──
  const handleGlobalReservationCodeChange = (newCode) => {
    const uppercaseCode = newCode.toUpperCase()
    setReservationCode(uppercaseCode)
    setFlights((prevFlights) =>
      prevFlights.map((f) => ({
        ...f,
        pnr: uppercaseCode,
      }))
    )
  }

  // ── DIRECT PDF DOWNLOAD GENERATOR ──
  const handleDownloadPdf = () => {
    const element = document.getElementById('printable-dummy-booking')
    if (!element) return

    const toastId = toast.loading('Generating & downloading PDF...')

    const fileName = `ViewTrip_Itinerary_${reservationCode || 'Booking'}.pdf`

    const opt = {
      margin: [6, 6, 6, 6],
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    }

    html2pdf()
      .set(opt)
      .from(element)
      .save()
      .then(() => {
        toast.dismiss(toastId)
        toast.success(`Downloaded ${fileName}!`)
      })
      .catch((err) => {
        console.error('PDF error:', err)
        toast.dismiss(toastId)
        toast.error('Direct download issue. Opening print mode...')
        window.print()
      })
  }

  // ── HOTEL LEGS ACTIONS ──
  const handleAddHotelLeg = () => {
    const newLegId = Date.now()
    setHotels([
      ...hotels,
      {
        id: newLegId,
        country: '',
        city: '',
        hotelName: '',
        roomType: '',
        quantity: '',
        checkIn: '',
        checkOut: '',
        nights: '',
        confirmationNo: '',
        status: 'Confirmed',
      },
    ])
  }

  const handleUpdateHotelLeg = (id, field, value) => {
    setHotels((prevHotels) =>
      prevHotels.map((h) => {
        if (h.id !== id) return h
        const updated = { ...h, [field]: value }
        if (field === 'checkIn' || field === 'checkOut') {
          updated.nights = calcNights(updated.checkIn, updated.checkOut)
        }
        return updated
      })
    )
  }

  const handleRemoveHotelLeg = (id) => {
    setHotels(hotels.filter((h) => h.id !== id))
  }

  // ── ROBUST GDS PASSENGER & FLIGHT TEXT PARSER ──
  const handleParseText = () => {
    if (!rawText.trim()) {
      toast.error('Please paste raw GDS itinerary or booking text first')
      return
    }

    try {
      const parsedSectors = []
      let parsedPnr = reservationCode

      const parsedPax = parseGdsPassengers(rawText)

      const knownSectorWords = ['DOHJED', 'JEDDOH', 'DOHKHI', 'KHIDOH', 'KHIBKK', 'BKKCAN', 'CANBKK', 'BKKKHI']
      const pnrMatches = rawText.match(/\b([A-Z0-9]{6})\b/g)
      if (pnrMatches) {
        const validPnr = pnrMatches.find(
          (m) =>
            !knownSectorWords.includes(m.toUpperCase()) &&
            !['CONFIR', 'TICKET', 'STATUS', 'HS1', 'HK1'].includes(m.toUpperCase()) &&
            /\d/.test(m)
        )
        if (validPnr) {
          parsedPnr = validPnr.toUpperCase()
          handleGlobalReservationCodeChange(parsedPnr)
        }
      }

      const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean)
      lines.forEach((line) => {
        const flightMatch = line.match(
          /(?:\d+\.|\b)\s*([A-Z0-9]{2})\s*(\d{1,4})\s+([A-Z])\s+(\d{1,2}[A-Z]{3})\s+([A-Z]{3})([A-Z]{3})\s+(?:HS\d+|HK\d+|DK\d+|SS\d+)?\s*(\d{4})\s+(#?\d{4})/i
        )

        if (flightMatch) {
          const airlineCode = flightMatch[1].toUpperCase()
          const flightNo = flightMatch[2]
          const classChar = flightMatch[3].toUpperCase()
          const rawDate = flightMatch[4].toUpperCase()
          const origCode = flightMatch[5].toUpperCase()
          const destCode = flightMatch[6].toUpperCase()
          const depTimeRaw = flightMatch[7]
          const arrTimeRaw = flightMatch[8]

          const airlineName = KNOWN_AIRLINES[airlineCode] || `${airlineCode} Airways`

          const origAirport = AIRPORTS[origCode] || {
            name: `${origCode} Airport`,
            city: `${origCode}`,
            country: `${origCode}`,
            terminal: '',
          }
          const destAirport = AIRPORTS[destCode] || {
            name: `${destCode} Airport`,
            city: `${destCode}`,
            country: `${destCode}`,
            terminal: '',
          }

          parsedSectors.push({
            id: Date.now() + Math.random(),
            airline: airlineName,
            airlineCode: airlineCode,
            flightNo: flightNo,
            pnr: parsedPnr,
            departDate: rawDate,
            departTime: formatGdsTime(depTimeRaw),
            departCity: origAirport.city,
            departAirport: origAirport.name,
            departCountry: origAirport.country,
            departTerminal: origAirport.terminal,
            arriveDate: rawDate,
            arriveTime: formatGdsTime(arrTimeRaw),
            arriveCity: destAirport.city,
            arriveAirport: destAirport.name,
            arriveCountry: destAirport.country,
            arriveTerminal: destAirport.terminal,
            arrivePlusOne: arrTimeRaw.startsWith('#') ? '+1' : '',
            stopType: 'NON STOP',
            duration: '3H 0M',
            cabinClass: classChar === 'C' || classChar === 'J' ? 'Business' : 'Economy',
            aircraft: 'Aircraft',
            meal: 'Meal',
            status: 'Confirmed',
          })
        }
      })

      if (parsedPax.length > 0) {
        setPassengers(parsedPax)
      }

      if (parsedSectors.length > 0) {
        setFlights(parsedSectors)
      }

      if (parsedPax.length > 0 || parsedSectors.length > 0) {
        toast.success(`Successfully extracted ${parsedPax.length} passenger(s) and ${parsedSectors.length} flight sector(s)!`)
      } else {
        toast.success('Itinerary text processed.')
      }
    } catch (err) {
      console.error('Parse error:', err)
      toast.error('Failed to parse text. You can edit fields manually.')
    }
  }

  // ── IMAGE & CAMERA SCANNER WITH GEMINI AI ──
  const processImageScan = async (base64Image) => {
    setIsScanning(true)
    const toastId = toast.loading('Scanning travel reservation image with AI...')

    try {
      if (!apiKey) {
        setTimeout(() => {
          setIsScanning(false)
          toast.dismiss(toastId)
          toast.success('Demo Itinerary scan completed!')
        }, 1500)
        return
      }

      const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '')

      const prompt = `Analyze this travel reservation itinerary image. Return a JSON object strictly formatted as:
{
  "reservationCode": "string",
  "passengers": ["SURNAME, GIVENNAME TITLE"],
  "flights": [
    {
      "airline": "string",
      "airlineCode": "string",
      "flightNo": "string",
      "pnr": "string",
      "departDate": "string",
      "departTime": "string",
      "departCity": "string",
      "departAirport": "string",
      "departCountry": "string",
      "departTerminal": "string",
      "arriveDate": "string",
      "arriveTime": "string",
      "arriveCity": "string",
      "arriveAirport": "string",
      "arriveCountry": "string",
      "arriveTerminal": "string",
      "arrivePlusOne": "string",
      "stopType": "string",
      "duration": "string",
      "cabinClass": "string",
      "aircraft": "string",
      "meal": "string",
      "status": "string"
    }
  ]
}
No markdown wrappers outside json.`

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: cleanBase64,
                  },
                },
              ],
            },
          ],
        }
      )

      const textResponse = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const jsonMatch = textResponse.match(/\{[\s\S]*\}/)

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed.reservationCode) handleGlobalReservationCodeChange(parsed.reservationCode)
        if (parsed.passengers && parsed.passengers.length > 0) setPassengers(parsed.passengers)
        if (parsed.flights && parsed.flights.length > 0) {
          setFlights(
            parsed.flights.map((f, index) => ({
              id: Date.now() + index,
              airline: f.airline || '',
              airlineCode: f.airlineCode || '',
              flightNo: f.flightNo || '',
              pnr: f.pnr || parsed.reservationCode || reservationCode,
              departDate: f.departDate || '',
              departTime: f.departTime || '',
              departCity: f.departCity || '',
              departAirport: f.departAirport || '',
              departCountry: f.departCountry || '',
              departTerminal: f.departTerminal || '',
              arriveDate: f.arriveDate || '',
              arriveTime: f.arriveTime || '',
              arriveCity: f.arriveCity || '',
              arriveAirport: f.arriveAirport || '',
              arriveCountry: f.arriveCountry || '',
              arriveTerminal: f.arriveTerminal || '',
              arrivePlusOne: f.arrivePlusOne || '',
              stopType: f.stopType || 'NON STOP',
              duration: f.duration || '',
              cabinClass: f.cabinClass || 'Economy',
              aircraft: f.aircraft || '',
              meal: f.meal || 'Meal',
              status: f.status || 'Confirmed',
            }))
          )
        }
        toast.dismiss(toastId)
        toast.success('Itinerary details extracted via AI Scan!')
      } else {
        toast.dismiss(toastId)
        toast.success('Scan processed!')
      }
    } catch (error) {
      console.error('Scan Error:', error)
      toast.dismiss(toastId)
      toast.error('AI Scan encountered an error. Edit details manually.')
    } finally {
      setIsScanning(false)
    }
  }

  // File Upload Handler
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      processImageScan(event.target.result)
    }
    reader.readAsDataURL(file)
  }

  // Camera Handler
  const startCamera = async () => {
    setShowCamera(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      mediaStreamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (err) {
      toast.error('Unable to access camera. Please allow camera permissions.')
      setShowCamera(false)
    }
  }

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop())
      mediaStreamRef.current = null
    }
    setShowCamera(false)
  }

  const capturePhoto = () => {
    if (!videoRef.current) return
    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth || 1280
    canvas.height = videoRef.current.videoHeight || 720
    const ctx = canvas.getContext('2d')
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg')
    stopCamera()
    processImageScan(dataUrl)
  }

  // ── PASSENGER & FLIGHT ACTIONS ──
  const handleAddPassenger = () => {
    setPassengers([...passengers, ''])
  }

  const handleUpdatePassenger = (index, value) => {
    const updated = [...passengers]
    updated[index] = value
    setPassengers(updated)
  }

  const handleRemovePassenger = (index) => {
    setPassengers(passengers.filter((_, i) => i !== index))
  }

  const handleAddFlight = () => {
    const newId = Date.now()
    setFlights([
      ...flights,
      {
        id: newId,
        airline: '',
        airlineCode: '',
        flightNo: '',
        pnr: reservationCode,
        departDate: '',
        departTime: '',
        departCity: '',
        departAirport: '',
        departCountry: '',
        departTerminal: '',
        arriveDate: '',
        arriveTime: '',
        arriveCity: '',
        arriveAirport: '',
        arriveCountry: '',
        arriveTerminal: '',
        arrivePlusOne: '',
        stopType: 'NON STOP',
        duration: '',
        cabinClass: 'Economy',
        aircraft: '',
        meal: 'Meal',
        status: 'Confirmed',
      },
    ])
  }

  const handleUpdateFlight = (id, field, value) => {
    setFlights(flights.map((f) => (f.id === id ? { ...f, [field]: value } : f)))
  }

  const handleRemoveFlight = (id) => {
    setFlights(flights.filter((f) => f.id !== id))
  }

  // Printable Summary Title Line
  const getOverallSummaryTitle = () => {
    const activeF = flights.filter((f) => f.airline || f.flightNo || f.departCity || f.arriveCity)
    if (activeF.length === 0) return 'Travel Reservation - Confirmed'
    const firstFlight = activeF[0]
    const lastFlight = activeF[activeF.length - 1]
    return `${firstFlight.departDate || 'DEPARTURE'} - ${lastFlight.arriveDate || firstFlight.departDate || 'RETURN'} - ${firstFlight.departCity || 'ORIGIN'} to ${lastFlight.arriveCity || firstFlight.arriveCity || 'DESTINATION'} - Confirmed`
  }

  const handlePrint = () => {
    window.print()
  }

  // Active items for document preview
  const activeHotels = hotels.filter((h) => h.hotelName || h.city || h.country)
  const activeFlights = flights.filter((f) => f.airline || f.flightNo || f.departCity || f.arriveCity)
  const activePassengers = passengers.filter(Boolean)

  // Document Content Component for reuse in page and modal
  const renderDocumentContent = () => (
    <div id="printable-dummy-booking" className="bg-white p-6 md:p-8 font-sans text-left uppercase">
      {/* Document Header Logo & Title */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-lg">
            T
          </div>
          <span className="text-xl font-light text-amber-600 tracking-tight">ViewTrip</span>
        </div>
        <h1 className="text-2xl font-normal text-gray-900 normal-case">My Trip</h1>
      </div>

      {/* Overall Route & Confirmation Title Line */}
      <div className="border-b-2 border-gray-800 pb-2 mb-6 flex items-center justify-between">
        <h2 className="text-sm md:text-base font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-1.5">
          {getOverallSummaryTitle()}
        </h2>
        <div className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center text-xs shrink-0">
          ✓
        </div>
      </div>

      {/* Flight Sectors Render */}
      <div className="space-y-8">
        {(activeFlights.length > 0 ? activeFlights : flights).map((f) => (
          <div key={f.id} className="border-b border-gray-300 pb-6 space-y-4 flight-sector-card">
            {/* Airline & Flight Header (Clean HTML/SVG alignment) */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded bg-[#4A154B] text-[#FFD700] flex items-center justify-center text-base font-bold shrink-0 shadow-xs font-mono leading-none">
                  {f.airlineCode || 'TG'}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 leading-snug">
                    {f.airline || 'Airline'}
                  </h3>
                  <p className="text-xs text-gray-700 font-semibold mt-0.5">
                    ({f.airlineCode || 'TG'}) {f.flightNo || '000'}
                  </p>
                  <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                    CONFIRMATION NUMBER: <span className="font-bold text-gray-900 font-mono">{f.pnr || reservationCode || '-'}</span>
                  </p>
                </div>
              </div>

              {/* Depart - Flight Route Vector Arrow - Arrive Grid */}
              <div className="flex items-start gap-6 text-center">
                <div className="text-left min-w-[70px]">
                  <p className="text-[10px] font-bold tracking-wider text-gray-500 uppercase">DEPART</p>
                  <p className="text-2xl font-bold text-gray-900 leading-none mt-1">
                    {f.departTime?.split(' ')[0] || '--:--'}
                  </p>
                  <p className="text-xs font-bold text-gray-700 mt-0.5">
                    {f.departTime?.split(' ')[1] || ''}
                  </p>
                  <p className="text-[10px] font-bold text-gray-500 mt-0.5">{f.departCity?.match(/\(([^)]+)\)/)?.[1] || f.departCity || 'KHI'}</p>
                </div>

                {/* Pure SVG Vector Arrow Line (Eliminates canvas overlap bugs) */}
                <div className="flex flex-col items-center justify-center px-2">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    {f.stopType || 'NON STOP'}
                  </span>
                  <div className="flex items-center gap-1 text-gray-900 my-0.5">
                    <div className="w-10 h-[2px] bg-gray-900"></div>
                    <svg className="w-3.5 h-3.5 fill-current text-gray-900 shrink-0" viewBox="0 0 24 24">
                      <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
                    </svg>
                    <div className="w-10 h-[2px] bg-gray-900"></div>
                  </div>
                  <span className="text-[10px] font-bold text-gray-600 mt-1">
                    {f.duration || '3H 0M'}
                  </span>
                </div>

                <div className="text-right min-w-[70px]">
                  <p className="text-[10px] font-bold tracking-wider text-gray-500 uppercase flex items-center justify-end gap-1">
                    ARRIVE {f.arrivePlusOne && <span className="text-[10px] text-gray-900 font-bold">{f.arrivePlusOne}</span>}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 leading-none mt-1">
                    {f.arriveTime?.split(' ')[0] || '--:--'}
                  </p>
                  <p className="text-xs font-bold text-gray-700 mt-0.5">
                    {f.arriveTime?.split(' ')[1] || ''}
                  </p>
                  <p className="text-[10px] font-bold text-gray-500 mt-0.5">{f.arriveCity?.match(/\(([^)]+)\)/)?.[1] || f.arriveCity || 'BKK'}</p>
                </div>
              </div>
            </div>

            {/* Passengers List */}
            <div className="text-xs space-y-0.5 pt-1">
              <p className="font-bold text-gray-500 tracking-wider uppercase text-[10px]">PASSENGERS</p>
              {activePassengers.length > 0 ? (
                activePassengers.map((p, pi) => (
                  <p key={pi} className="font-semibold text-gray-900 text-xs uppercase">
                    {p}
                  </p>
                ))
              ) : (
                <p className="text-gray-400 italic text-xs normal-case">No passenger specified</p>
              )}
            </div>

            {/* Class of Service */}
            <div className="text-xs">
              <p className="text-xs text-gray-800">
                <span className="text-gray-500">CLASS OF SERVICE:</span> <span className="font-semibold text-gray-900">{f.cabinClass || 'ECONOMY'}</span>
              </p>
            </div>

            {/* Airport Info with Dotted Line */}
            <div className="text-xs space-y-2">
              <p className="font-bold text-gray-500 tracking-wider uppercase text-[10px]">AIRPORT INFO</p>
              <div>
                <p className="font-bold text-gray-900">{f.departAirport || f.departCity || '-'}</p>
                <p className="text-gray-600">{f.departCountry || ''}</p>
                {f.departTerminal && <p className="text-gray-600">{f.departTerminal}</p>}
              </div>

              <div className="border-b border-dashed border-gray-400 w-48 relative my-2">
                <span className="absolute left-1/2 -top-2.5 -translate-x-1/2 bg-white px-2 text-[10px] font-bold text-gray-500 uppercase">to</span>
              </div>

              <div>
                <p className="font-bold text-gray-900">{f.arriveAirport || f.arriveCity || '-'}</p>
                <p className="text-gray-600">{f.arriveCountry || ''}</p>
                {f.arriveTerminal && <p className="text-gray-600">{f.arriveTerminal}</p>}
              </div>
            </div>

            {/* Flight Info */}
            <div className="text-xs space-y-0.5">
              <p className="font-bold text-gray-500 tracking-wider uppercase text-[10px]">FLIGHT INFO</p>
              <p className="text-gray-900 font-semibold">{f.aircraft || 'Aircraft'}</p>
              <p className="text-gray-700">{f.meal || 'Meal'}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Multi-Leg Hotel Accommodations Render */}
      {includeHotel && activeHotels.length > 0 && (
        <div className="mt-8 border-t-2 border-gray-800 pt-6 space-y-6">
          {activeHotels.map((h, index) => (
            <div key={h.id} className="space-y-3 border-b border-gray-200 pb-5 last:border-b-0 hotel-leg-card">
              <div className="flex items-center justify-between border-b border-gray-300 pb-2">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                  <i className="ti ti-building-hospital text-gray-700" /> HOTEL ACCOMMODATION #{index + 1} - {h.city || 'HOTEL'}, {h.country}
                </h3>
                <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                  {h.status || 'Confirmed'} ✓
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase">HOTEL NAME</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{h.hotelName || '-'}</p>
                  <p className="text-gray-600">{h.city} {h.country && `, ${h.country}`}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase">CONFIRMATION NO.</p>
                  <p className="text-xs font-bold text-gray-900 font-mono mt-0.5">{h.confirmationNo || '-'}</p>
                  <p className="text-gray-600">{h.status}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase">CHECK-IN / CHECK-OUT</p>
                  <p className="text-xs font-semibold text-gray-900 mt-0.5">
                    {h.checkIn || '-'} — {h.checkOut || '-'}
                  </p>
                  <p className="text-emerald-700 font-medium">{h.nights}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase">ROOM DETAILS</p>
                  <p className="text-xs font-semibold text-gray-900 mt-0.5">{h.roomType || '-'}</p>
                  <p className="text-gray-600">{h.quantity}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Help & Travel Agency Footer Section */}
      <div className="mt-12 border-t border-gray-800 pt-6 space-y-3 text-xs">
        <h3 className="text-base font-semibold text-gray-900 normal-case">Help</h3>
        <p className="text-sm font-bold text-gray-900 normal-case">
          Your Reservation Code: <span className="font-mono text-base uppercase">{reservationCode || '-'}</span>
        </p>
        
        {/* Render Agency Footer if Checkbox Enabled */}
        {includeAgencyFooter && (agencyInfo.name || agencyInfo.address) && (
          <div className="text-gray-700 space-y-0.5 font-sans uppercase">
            <p className="font-bold text-gray-900">{agencyInfo.name}</p>
            <p>{agencyInfo.address}</p>
            <p>{agencyInfo.cityCountry}</p>
          </div>
        )}

        <div className="pt-6 text-center text-gray-500 text-[11px] normal-case">
          ©{new Date().getFullYear()} Travelport / ViewTrip Reservation.
        </div>
      </div>
    </div>
  )

  return (
    <div className="w-full min-h-full bg-gray-50 p-4 md:p-6 print:p-0 print:bg-white font-sans">
      <Toaster position="top-right" />

      {/* Screen Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <i className="ti ti-ticket text-emerald-600" /> Dummy Bookings Generator
          </h1>
          <p className="text-sm text-gray-600 mt-0.5">
            Parse GDS text, upload/scan travel itineraries, customize multi-leg hotel bookings, and export ViewTrip-style reservation documents.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleResetForm}
            className="px-4 py-2.5 bg-white border border-gray-300 hover:bg-red-50 hover:border-red-300 text-red-600 rounded-lg font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer text-xs"
          >
            <i className="ti ti-rotate-2 text-sm" /> Reset Form
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-sm flex items-center gap-2 transition-colors cursor-pointer text-xs"
          >
            <i className="ti ti-download text-base" /> Download PDF
          </button>
          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-sm flex items-center gap-2 transition-colors cursor-pointer text-xs"
          >
            <i className="ti ti-eye text-base" /> Full Preview
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print:block">
        {/* ── LEFT PANEL: CONTROLS & FORM INPUTS ── */}
        <div className="lg:col-span-5 space-y-6 print:hidden">
          {/* Section 1: Scan & Parse */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2">
              <i className="ti ti-scan text-emerald-600" /> 1. Parse & Scan Travel Itinerary
            </h2>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanning}
                className="py-2.5 px-3 bg-white border border-gray-300 hover:bg-emerald-50 hover:border-emerald-300 text-gray-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
              >
                <i className="ti ti-upload text-emerald-600 text-sm" /> Upload Image
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />

              <button
                type="button"
                onClick={startCamera}
                disabled={isScanning}
                className="py-2.5 px-3 bg-white border border-gray-300 hover:bg-emerald-50 hover:border-emerald-300 text-gray-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
              >
                <i className="ti ti-camera text-emerald-600 text-sm" /> Capture Image
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Paste GDS / PNR / Itinerary Text
              </label>
              <textarea
                rows={5}
                className="w-full text-xs p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                placeholder="Paste Galileo PNR, itinerary text, flight lines or passenger details..."
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
              />
              <button
                type="button"
                onClick={handleParseText}
                className="mt-2 w-full py-2.5 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <i className="ti ti-bolt text-amber-400 text-sm" /> Parse Itinerary Text
              </button>
            </div>
          </div>

          {/* Section 2: Multi-Leg Hotel Booking Details */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <i className="ti ti-building-hospital text-emerald-600" /> 2. Hotel Booking Details
              </h2>
              <div className="flex items-center gap-3">
                {includeHotel && (
                  <button
                    type="button"
                    onClick={handleAddHotelLeg}
                    className="text-xs text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <i className="ti ti-plus" /> Add Hotel Leg
                  </button>
                )}
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeHotel}
                    onChange={(e) => setIncludeHotel(e.target.checked)}
                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Include
                </label>
              </div>
            </div>

            {includeHotel && (
              <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                {hotels.map((hotel, idx) => (
                  <div key={hotel.id} className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-3 text-xs">
                    <div className="flex items-center justify-between font-bold text-gray-800 border-b border-gray-200 pb-1">
                      <span>Hotel Leg #{idx + 1}</span>
                      {hotels.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveHotelLeg(hotel.id)}
                          className="text-red-500 hover:text-red-700 text-xs cursor-pointer flex items-center gap-1"
                        >
                          <i className="ti ti-trash" /> Remove Leg
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-gray-500 font-medium">Country Name</label>
                        <input
                          type="text"
                          className="w-full p-1.5 border border-gray-300 rounded bg-white uppercase font-semibold text-gray-800"
                          placeholder="e.g. THAILAND"
                          value={hotel.country}
                          onChange={(e) => handleUpdateHotelLeg(hotel.id, 'country', e.target.value.toUpperCase())}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 font-medium">City / Region</label>
                        <input
                          type="text"
                          className="w-full p-1.5 border border-gray-300 rounded bg-white uppercase font-semibold text-gray-800"
                          placeholder="e.g. BANGKOK"
                          value={hotel.city}
                          onChange={(e) => handleUpdateHotelLeg(hotel.id, 'city', e.target.value.toUpperCase())}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] text-gray-500 font-medium">Hotel Name (Worldwide)</label>
                        <input
                          type="text"
                          className="w-full p-1.5 border border-gray-300 rounded bg-white uppercase font-semibold text-gray-800"
                          placeholder="e.g. SUVARNABHUMI AIRPORT HOTEL"
                          value={hotel.hotelName}
                          onChange={(e) => handleUpdateHotelLeg(hotel.id, 'hotelName', e.target.value.toUpperCase())}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 font-medium">Room Type</label>
                        <input
                          type="text"
                          className="w-full p-1.5 border border-gray-300 rounded bg-white uppercase font-semibold text-gray-800"
                          placeholder="e.g. DELUXE DOUBLE ROOM"
                          value={hotel.roomType}
                          onChange={(e) => handleUpdateHotelLeg(hotel.id, 'roomType', e.target.value.toUpperCase())}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 font-medium">Room Quantity</label>
                        <input
                          type="text"
                          className="w-full p-1.5 border border-gray-300 rounded bg-white uppercase font-semibold text-gray-800"
                          placeholder="e.g. 1 ROOM"
                          value={hotel.quantity}
                          onChange={(e) => handleUpdateHotelLeg(hotel.id, 'quantity', e.target.value.toUpperCase())}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 font-medium">Check-In Date</label>
                        <input
                          type="date"
                          className="w-full p-1.5 border border-gray-300 rounded bg-white text-xs"
                          value={hotel.checkIn}
                          onChange={(e) => handleUpdateHotelLeg(hotel.id, 'checkIn', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 font-medium">Check-Out Date</label>
                        <input
                          type="date"
                          className="w-full p-1.5 border border-gray-300 rounded bg-white text-xs"
                          value={hotel.checkOut}
                          onChange={(e) => handleUpdateHotelLeg(hotel.id, 'checkOut', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 font-medium">Confirmation No.</label>
                        <input
                          type="text"
                          className="w-full p-1.5 border border-gray-300 rounded bg-white uppercase font-semibold text-gray-800"
                          placeholder="e.g. HTL-884920"
                          value={hotel.confirmationNo}
                          onChange={(e) => handleUpdateHotelLeg(hotel.id, 'confirmationNo', e.target.value.toUpperCase())}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 font-medium">Status</label>
                        <input
                          type="text"
                          className="w-full p-1.5 border border-gray-300 rounded bg-white font-semibold text-gray-800"
                          value={hotel.status}
                          onChange={(e) => handleUpdateHotelLeg(hotel.id, 'status', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Passenger Names & Reservation Code */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <i className="ti ti-users text-emerald-600" /> 3. Passengers & Reservation Code
              </h2>
              <button
                type="button"
                onClick={handleAddPassenger}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <i className="ti ti-plus" /> Add Passenger
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Global Reservation Code / PNR</label>
              <input
                type="text"
                className="w-full p-2 text-xs border border-gray-300 rounded-md uppercase font-bold tracking-wider text-indigo-700 bg-indigo-50/40"
                placeholder="e.g. DA7QUH"
                value={reservationCode}
                onChange={(e) => handleGlobalReservationCodeChange(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-700">Passengers List</label>
              {passengers.map((pax, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    className="flex-1 p-2 text-xs border border-gray-300 rounded-md uppercase font-semibold text-gray-800"
                    placeholder="e.g. IKHLAS, ANAS MR"
                    value={pax}
                    onChange={(e) => handleUpdatePassenger(index, e.target.value.toUpperCase())}
                  />
                  {passengers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemovePassenger(index)}
                      className="p-2 text-red-500 hover:text-red-700 text-xs cursor-pointer"
                    >
                      <i className="ti ti-trash" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Flight Sectors Editor */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <i className="ti ti-plane text-emerald-600" /> 4. Flight Sectors ({flights.length})
              </h2>
              <button
                type="button"
                onClick={handleAddFlight}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <i className="ti ti-plus" /> Add Sector
              </button>
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
              {flights.map((flight, idx) => (
                <div key={flight.id} className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2 text-xs">
                  <div className="flex items-center justify-between font-bold text-gray-800 border-b border-gray-200 pb-1">
                    <span>Flight #{idx + 1}: {flight.airlineCode} {flight.flightNo}</span>
                    {flights.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveFlight(flight.id)}
                        className="text-red-500 hover:text-red-700 text-xs cursor-pointer"
                      >
                        <i className="ti ti-trash" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <label className="block text-[10px] text-gray-500 font-medium">Sector PNR / Confirmation No.</label>
                      <input
                        type="text"
                        className="w-full p-1.5 border border-gray-300 rounded bg-white uppercase font-bold text-indigo-700"
                        placeholder={reservationCode || 'e.g. DA7QUH'}
                        value={flight.pnr || reservationCode}
                        onChange={(e) => handleUpdateFlight(flight.id, 'pnr', e.target.value.toUpperCase())}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 font-medium">Airline Name</label>
                      <input
                        type="text"
                        className="w-full p-1.5 border border-gray-300 rounded bg-white"
                        placeholder="e.g. Qatar Airways"
                        value={flight.airline}
                        onChange={(e) => handleUpdateFlight(flight.id, 'airline', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 font-medium">Flight No & Code</label>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          className="w-1/3 p-1.5 border border-gray-300 rounded bg-white uppercase"
                          placeholder="QR"
                          value={flight.airlineCode}
                          onChange={(e) => handleUpdateFlight(flight.id, 'airlineCode', e.target.value.toUpperCase())}
                        />
                        <input
                          type="text"
                          className="w-2/3 p-1.5 border border-gray-300 rounded bg-white"
                          placeholder="611"
                          value={flight.flightNo}
                          onChange={(e) => handleUpdateFlight(flight.id, 'flightNo', e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 font-medium">Depart Date</label>
                      <input
                        type="text"
                        className="w-full p-1.5 border border-gray-300 rounded bg-white"
                        placeholder="30SEP"
                        value={flight.departDate}
                        onChange={(e) => handleUpdateFlight(flight.id, 'departDate', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 font-medium">Arrive Date</label>
                      <input
                        type="text"
                        className="w-full p-1.5 border border-gray-300 rounded bg-white"
                        placeholder="30SEP"
                        value={flight.arriveDate}
                        onChange={(e) => handleUpdateFlight(flight.id, 'arriveDate', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 font-medium">Depart Airport & City</label>
                      <input
                        type="text"
                        className="w-full p-1.5 border border-gray-300 rounded bg-white"
                        placeholder="Karachi (KHI)"
                        value={flight.departAirport}
                        onChange={(e) => handleUpdateFlight(flight.id, 'departAirport', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 font-medium">Arrive Airport & City</label>
                      <input
                        type="text"
                        className="w-full p-1.5 border border-gray-300 rounded bg-white"
                        placeholder="Doha (DOH)"
                        value={flight.arriveAirport}
                        onChange={(e) => handleUpdateFlight(flight.id, 'arriveAirport', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 font-medium">Depart Time</label>
                      <input
                        type="text"
                        className="w-full p-1.5 border border-gray-300 rounded bg-white"
                        placeholder="10:15 AM"
                        value={flight.departTime}
                        onChange={(e) => handleUpdateFlight(flight.id, 'departTime', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 font-medium">Arrive Time</label>
                      <input
                        type="text"
                        className="w-full p-1.5 border border-gray-300 rounded bg-white"
                        placeholder="10:45 AM"
                        value={flight.arriveTime}
                        onChange={(e) => handleUpdateFlight(flight.id, 'arriveTime', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 5: Agency Details Editor */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <i className="ti ti-building text-emerald-600" /> 5. Travel Agency Branding Footer
              </h2>
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeAgencyFooter}
                  onChange={(e) => setIncludeAgencyFooter(e.target.checked)}
                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                Include
              </label>
            </div>

            {includeAgencyFooter && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Agency Name</label>
                  <input
                    type="text"
                    className="w-full p-2 border border-gray-300 rounded-md font-bold uppercase"
                    value={agencyInfo.name}
                    onChange={(e) => setAgencyInfo({ ...agencyInfo, name: e.target.value.toUpperCase() })}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Address</label>
                  <input
                    type="text"
                    className="w-full p-2 border border-gray-300 rounded-md font-medium uppercase"
                    value={agencyInfo.address}
                    onChange={(e) => setAgencyInfo({ ...agencyInfo, address: e.target.value.toUpperCase() })}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">City / Country</label>
                  <input
                    type="text"
                    className="w-full p-2 border border-gray-300 rounded-md font-medium uppercase"
                    value={agencyInfo.cityCountry}
                    onChange={(e) => setAgencyInfo({ ...agencyInfo, cityCountry: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL: VIEWT RIP / TRAVELPORT ITINERARY INLINE PREVIEW ── */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-gray-200 shadow-md print:shadow-none print:border-none print:p-0 print:m-0 print:w-full">
          {renderDocumentContent()}
        </div>
      </div>

      {/* ── FULL SCREEN SCROLLABLE GENERATE DUMMY BOOKING PREVIEW MODAL ── */}
      {showPreviewModal && (
        <div className="modal-overlay-print fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static">
          <div className="modal-dialog-print bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-200 print:max-h-none print:shadow-none print:border-none print:w-full">
            {/* Modal Header Bar */}
            <div className="px-6 py-4 bg-gray-900 text-white flex items-center justify-between shrink-0 print:hidden">
              <div className="flex items-center gap-2">
                <i className="ti ti-ticket text-emerald-400 text-xl" />
                <h3 className="text-base font-bold">Dummy Booking Preview - ViewTrip Itinerary</h3>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <i className="ti ti-download text-base" /> Download PDF
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <i className="ti ti-printer text-base" /> Print
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="p-2 text-gray-300 hover:text-white rounded-lg hover:bg-gray-800 transition-colors cursor-pointer ml-1"
                >
                  <i className="ti ti-x text-xl" />
                </button>
              </div>
            </div>

            {/* Modal Body - Fully Scrollable! */}
            <div className="modal-body-print flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-white">
              {renderDocumentContent()}
            </div>
          </div>
        </div>
      )}

      {/* ── CAMERA CAPTURE MODAL ── */}
      {showCamera && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-4 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-gray-900 text-sm">Capture Travel Reservation</h3>
              <button onClick={stopCamera} className="text-gray-500 hover:text-black">
                <i className="ti ti-x text-xl" />
              </button>
            </div>
            <div className="relative bg-black rounded-lg overflow-hidden aspect-video flex items-center justify-center">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={capturePhoto}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                Snap & Scan Itinerary
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="px-4 py-2.5 bg-gray-200 text-gray-800 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
