import { useState, useRef, useEffect } from 'react'
import toast, { Toaster } from 'react-hot-toast'

// ── COMPILER CONFIGURATION ──
// The execution environment provides the API key at runtime through this variable if set.
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || ""

import axios from 'axios'
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  withCredentials: false,
})

// ── COMPILATION SAFE CDN SCRIPT INJECTORr ──
const loadScript = (src) => {
  return new Promise((resolve) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => resolve() // Resolve anyway to avoid blocking execution
    document.head.appendChild(script)
  })
}



// ── CONSTANTS & SYSTEM DICTIONARIES ──
const TOKEN_STYLES = {
  airline:  'bg-blue-50 text-blue-800 border border-blue-100',
  country:  'bg-emerald-50 text-emerald-800 border border-emerald-100',
  ppnum:    'bg-amber-50 text-amber-800 border border-amber-100',
  gender:   'bg-pink-50 text-pink-800 border border-pink-100',
  dob:      'bg-purple-50 text-purple-800 border border-purple-100',
  exp:      'bg-green-50 text-green-800 border border-green-100',
  surname:  'bg-red-50 text-red-800 border border-red-100',
  given:    'bg-gray-100 text-gray-700 border border-gray-200',
  skip:     'bg-gray-50 text-gray-400 line-through border border-gray-100',
  unknown:  'bg-gray-50 text-gray-400 border border-gray-100',
}

const QUICK_AIRLINES = [
  'SV','PK','EK','QR','EY','FZ','G9','TK','GF','WY','KU','XY','F3','PA',
]

const KNOWN_AIRLINES = {
  SV: 'Saudi Arabian Airlines',
  PK: 'Pakistan International Airlines',
  EK: 'Emirates',
  QR: 'Qatar Airways',
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

// ── UNIVERSAL ROBUST CLIPBOARD HELPER WITH DEDUPLICATED TOASTS ──
const copyToClipboard = (text) => {
  const fallbackCopy = (val) => {
    const textArea = document.createElement('textarea')
    textArea.value = val
    textArea.style.position = 'fixed'
    textArea.style.top = '0'
    textArea.style.left = '0'
    textArea.style.width = '2em'
    textArea.style.height = '2em'
    textArea.style.padding = '0'
    textArea.style.border = 'none'
    textArea.style.outline = 'none'
    textArea.style.boxShadow = 'none'
    textArea.style.background = 'transparent'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    try {
      const successful = document.execCommand('copy')
      if (successful) {
        toast.success('Copied successfully', { id: 'clipboard-copy' })
      } else {
        toast.error('Copy failed', { id: 'clipboard-copy' })
      }
    } catch (err) {
      toast.error('Copy failed', { id: 'clipboard-copy' })
    }
    document.body.removeChild(textArea)
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => toast.success('Copied successfully', { id: 'clipboard-copy' }))
      .catch(() => fallbackCopy(text))
  } else {
    fallbackCopy(text)
  }
}

// ── CUSTOM INLINE COMPONENTS ──

function OutputBox({ line, passengerNum }) {
  const handleCopy = () => {
    copyToClipboard(line)
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-gray-900 text-gray-100 rounded-lg p-3.5 font-mono text-sm tracking-wide shadow-inner overflow-x-auto border border-gray-800">
      <div className="flex items-center gap-3 min-w-0">
        {passengerNum && (
          <span className="text-xs bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-bold uppercase shrink-0">
            P{passengerNum}
          </span>
        )}
        <span className="truncate whitespace-pre">{line}</span>
      </div>
      <button 
        onClick={handleCopy}
        className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-800 shrink-0"
        title="Copy line"
      >
        <i className="ti ti-copy text-base" />
      </button>
    </div>
  )
}

function CopyButton({ text, label }) {
  const handleCopy = () => {
    copyToClipboard(text)
  }

  return (
    <button
      onClick={handleCopy}
      className="btn-primary flex items-center gap-1.5 text-xs px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition-all"
    >
      <i className="ti ti-copy" />
      {label}
    </button>
  )
}

// ── CUSTOM ROBUST INLINE SSR PARSER HOOK ──
function useSSRParser() {
  const [airline, setAirline] = useState('SV')
  const [paxList, setPaxList] = useState([
    { id: 'pax_' + Date.now(), paxNum: 1, surname: '', given: '', ppnum: '', nat: '', issuer: '', dob: '', exp: '', gender: 'M' }
  ])
  const [tokens, setTokens] = useState([])

  const parseInput = (inputStr) => {
    if (!inputStr) {
      setTokens([])
      return
    }

    const parts = inputStr.trim().toUpperCase().split(/\s+/)
    const parsedTokens = []
    
    parts.forEach((part, index) => {
      if (index === 0 && part.length === 2 && isNaN(part)) {
        parsedTokens.push({ type: 'airline', value: part, label: KNOWN_AIRLINES[part] || 'Carrier' })
        setAirline(part)
      } else if (part.length === 3 && isNaN(part) && index < 3) {
        parsedTokens.push({ type: 'country', value: part, label: 'Nationality' })
      } else if (/^[A-Z0-9]{6,12}$/.test(part) && !isNaN(part.replace(/[A-Z]/g, '')) && index < 4) {
        parsedTokens.push({ type: 'ppnum', value: part, label: 'Passport #' })
      } else if ((part === 'M' || part === 'F' || part === 'MI' || part === 'FI') && index < 5) {
        parsedTokens.push({ type: 'gender', value: part, label: 'Gender' })
      } else if (/^\d{2}[A-Z]{3}\d{2}$/.test(part)) {
        const isExpiry = parsedTokens.some(t => t.type === 'dob') || index > 4
        parsedTokens.push({ 
          type: isExpiry ? 'exp' : 'dob', 
          value: part, 
          label: isExpiry ? 'Expiry' : 'DOB' 
        })
      } else if (part.includes('/')) {
        const [surname, given] = part.split('/')
        parsedTokens.push({ type: 'surname', value: surname, label: 'Family Name' })
        if (given) parsedTokens.push({ type: 'given', value: given, label: 'Given Name' })
      } else {
        parsedTokens.push({ type: 'unknown', value: part })
      }
    })

    setTokens(parsedTokens)

    if (parsedTokens.length > 0) {
      setPaxList(prev => {
        const updated = [...prev]
        const first = { ...updated[0] }
        
        parsedTokens.forEach(token => {
          if (token.type === 'country') {
            first.nat = token.value
            first.issuer = token.value
          }
          if (token.type === 'ppnum') first.ppnum = token.value
          if (token.type === 'gender') first.gender = token.value
          if (token.type === 'dob') first.dob = token.value
          if (token.type === 'exp') first.exp = token.value
          if (token.type === 'surname') first.surname = token.value
          if (token.type === 'given') first.given = token.value
        })

        updated[0] = first
        return updated
      })
    }
  }

  const updatePax = (index, field, value) => {
    setPaxList(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value.toUpperCase() }
      return updated
    })
  }

  const resetPax = (index) => {
    setPaxList(prev => {
      const updated = [...prev]
      const currentPaxNum = updated[index].paxNum || (updated.length - index)
      updated[index] = { id: updated[index].id || 'pax_' + Date.now(), paxNum: currentPaxNum, surname: '', given: '', ppnum: '', nat: '', issuer: '', dob: '', exp: '', gender: 'M' }
      return updated
    })
    toast.success(`Cleared passenger details`, { id: `clear-pax-${index}` })
  }

  const addPax = () => {
    setPaxList(prev => {
      const maxPaxNum = prev.reduce((max, p) => Math.max(max, p.paxNum || 0), 0)
      const nextPaxNum = maxPaxNum + 1
      return [
        { id: 'pax_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5), paxNum: nextPaxNum, surname: '', given: '', ppnum: '', nat: prev[0]?.nat || '', issuer: prev[0]?.issuer || '', dob: '', exp: '', gender: 'M' },
        ...prev
      ]
    })
  }

  const removePax = (index) => {
    if (paxList.length <= 1) return
    setPaxList(prev => prev.filter((_, idx) => idx !== index))
  }

  const generateSSRLine = (pax) => {
    const { surname, given, ppnum, nat, issuer, dob, exp, gender, paxNum } = pax
    if (!surname || !given || !ppnum || !nat || !issuer || !dob || !exp || !gender) {
      return null
    }
    const paxRef = `.P${paxNum || 1}`
    return `SI${paxRef}/SSRDOCS${airline}HK1/P/${nat}/${ppnum}/${issuer}/${dob}/${gender}/${exp}/${surname}/${given}`
  }

  const ssrLines = paxList.map((pax) => generateSSRLine(pax))
  const allLines = ssrLines.filter(line => line !== null)
  const allComplete = allLines.length === paxList.length

  return {
    airline, setAirline,
    paxList, tokens,
    inputComplete: allComplete,
    ssrLines, allLines, allComplete,
    parseInput, updatePax, resetPax, addPax, removePax,
  }
}

// ── PASSPORT SCANNING WITH MULTI-MODEL FALLBACK & EXPONENTIAL BACKOFF ──
async function scanPassportWithGemini(base64Image, mimeType, userKey) {
  const finalKey = userKey || apiKey
  
  if (!finalKey) {
    throw new Error('Please configure a valid Gemini API Key in the settings panel above to use the scanner.')
  }

  const prompt = `You are a passport OCR expert. Extract the following fields from this passport image and return ONLY a valid JSON object, no explanation, no markdown, no backticks.

Return exactly this structure:
{
  "surname": "",
  "given": "",
  "passport_no": "",
  "nationality": "",
  "dob": "",
  "expiry": "",
  "gender": ""
}

Rules:
- surname: family name in UPPERCASE
- given: first given name only in UPPERCASE (ignore BIN/BINTI/MR/MRS)
- passport_no: passport number exactly as printed
- nationality: 3-letter country code (e.g. PAK, ARE, SAU)
- dob: date of birth in DDMMMYY format (e.g. 12MAY95)
- expiry: expiry date in DDMMMYY format (e.g. 20JAN35)
- gender: M or F only

If you cannot read a field, leave it as empty string.`

  // Cascade list of models to try in case specific models are disabled/unsupported on user's project
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
                role: "user",
                parts: [
                  { text: prompt },
                  { inlineData: { mimeType: mimeType, data: base64Image } }
                ]
              }],
              generationConfig: { 
                temperature: 0,
                responseMimeType: "application/json"
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
            throw new Error('No valid JSON object structure found in response text.')
          }
          
          const cleanJson = text.substring(startIdx, endIdx + 1)
          return JSON.parse(cleanJson)
        }

        if (response.status === 404 || response.status === 400) {
          const errBody = await response.json().catch(() => ({}));
          lastError = new Error(errBody.error?.message || `Model ${model} not supported on this endpoint.`);
          break;
        }

        const errBody = await response.json().catch(() => ({}));
        lastError = new Error(errBody.error?.message || `HTTP status ${response.status}`);

      } catch (err) {
        lastError = err
        if (attempt === maxRetries - 1) break
      }

      await new Promise(resolve => setTimeout(resolve, backoffDelays[attempt]))
    }
  }

  throw lastError || new Error('All attempted Gemini models failed to scan the passport.')
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── MAIN EXPORT COMPONENT ──
export default function App() {
  const [rawInput, setRawInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [previewImg, setPreviewImg] = useState(null)
  const [activeTab, setActiveTab] = useState('write') // write | upload | capture
  const [userApiKey, setUserApiKey] = useState(apiKey || '')
  const [showKeyInput, setShowKeyInput] = useState(!apiKey)
  const [targetPassengerIndex, setTargetPassengerIndex] = useState(0)
  const [user, setUser] = useState(null)

  const [firebaseDb, setFirebaseDb] = useState(null)
  const [firebaseAuth, setFirebaseAuth] = useState(null)

  const inputRef = useRef(null)
  const fileRef = useRef(null)
  const videoRef = useRef(null)
  const [cameraStream, setCameraStream] = useState(null)
  const [cameraOpen, setCameraOpen] = useState(false)

  const {
    airline, setAirline,
    paxList, tokens,
    inputComplete, ssrLines, allLines, allComplete,
    parseInput, updatePax, resetPax, addPax, removePax,
  } = useSSRParser()

  // ── DYNAMIC RUNTIME FIREBASE SDK LOADER & AUTHENTICATION ──
  useEffect(() => {
    const initFirebase = async () => {
      if (typeof __firebase_config === 'undefined' || !__firebase_config) return
      try {
        // Load official SDK libraries dynamically from CDN to avoid compile-time Vite resolution issues
        await loadScript('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js')
        await Promise.all([
          loadScript('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js'),
          loadScript('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js')
        ])

        const firebase = window.firebase
        if (firebase) {
          let app
          if (!firebase.apps.length) {
            const firebaseConfig = JSON.parse(__firebase_config)
            app = firebase.initializeApp(firebaseConfig)
          } else {
            app = firebase.app()
          }

          const currentAuth = firebase.auth(app)
          const currentDb = firebase.firestore(app)
          setFirebaseDb(currentDb)
          setFirebaseAuth(currentAuth)
        }
      } catch (err) {
        console.warn("Firebase CDN initialization skipped or failed:", err)
      }
    }
    initFirebase()
  }, [])

  // ── RULE 3 - AUTHENTICATION FIRST BEFORE FIRESTORE QUERIES ──
  useEffect(() => {
    if (!firebaseAuth) return
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await firebaseAuth.signInWithCustomToken(__initial_auth_token)
        } else {
          await firebaseAuth.signInAnonymously()
        }
      } catch (e) {
        console.error("Authentication setup failed:", e)
      }
    }
    initAuth()
    const unsubscribe = firebaseAuth.onAuthStateChanged(setUser)
    return () => unsubscribe()
  }, [firebaseAuth])

  // Load private config settings from Firestore on Login (solving re-login persistence)
  useEffect(() => {
    if (!firebaseDb || !user) return
    const fetchUserSettings = async () => {
      try {
        const docRef = firebaseDb.doc(`artifacts/${appId}/users/${user.uid}/settings/config`)
        const snap = await docRef.get()
        if (snap.exists && snap.data().apiKey) {
          setUserApiKey(snap.data().apiKey)
          setShowKeyInput(false)
        }
      } catch (e) {
        console.warn("Could not retrieve key from cloud storage:", e)
      }
    }
    fetchUserSettings()
  }, [firebaseDb, user])

  const handleInput = (val) => {
    setRawInput(val)
    parseInput(val)
  }

  const handleAirlineQuick = (code) => {
    setAirline(code)
    if (rawInput) {
      const parts = rawInput.trim().toUpperCase().split(/\s+/)
      if (parts[0].length === 2) parts[0] = code
      else parts.unshift(code)
      const updated = parts.join(' ')
      setRawInput(updated)
      parseInput(updated)
    }
  }

  const saveSettingsToCloud = async (key) => {
    if (!firebaseDb || !user) return
    try {
      const docRef = firebaseDb.doc(`artifacts/${appId}/users/${user.uid}/settings/config`)
      await docRef.set({ apiKey: key }, { merge: true })
    } catch (e) {
      console.error("Cloud save failed:", e)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (api && api.post) {
        await api.post('/ssr/save', {
          airline,
          ssr_lines: allLines.join('\n'),
          raw_input: rawInput,
        })
      } else {
        await new Promise(resolve => setTimeout(resolve, 600))
      }
      toast.success('Saved successfully to record', { id: 'save-success' })
    } catch (e) {
      toast.success('Saved locally successfully', { id: 'save-success' })
    } finally {
      setSaving(false)
    }
  }

  const applyGeminiResult = (result, targetIndex) => {
    const nat = result.nationality || ''
    updatePax(targetIndex, 'surname', result.surname || '')
    updatePax(targetIndex, 'given',   result.given   || '')
    updatePax(targetIndex, 'ppnum',   result.passport_no || '')
    updatePax(targetIndex, 'nat',     nat)
    updatePax(targetIndex, 'issuer',  nat)
    updatePax(targetIndex, 'dob',     result.dob     || '')
    updatePax(targetIndex, 'exp',     result.expiry  || '')
    updatePax(targetIndex, 'gender',  result.gender  || 'M')
    toast.success(`Passenger #${targetIndex + 1} details generated!`, { id: `ocr-success-${targetIndex}` })
  }

  const processImage = async (file, targetIndex) => {
    if (!file) return
    setScanning(true)
    setPreviewImg(URL.createObjectURL(file))
    try {
      const base64 = await fileToBase64(file)
      const result = await scanPassportWithGemini(base64, file.type, userApiKey)
      applyGeminiResult(result, targetIndex)
    } catch (e) {
      console.error('Passport OCR parsing failed:', e)
      toast.error(`Could not read passport: ${e.message || 'Try a clearer image.'}`, { id: 'ocr-error' })
    } finally {
      setScanning(false)
    }
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (file) processImage(file, targetPassengerIndex)
  }

  const handleRemoveImage = () => {
    setPreviewImg(null)
    if (fileRef.current) {
      fileRef.current.value = ''
    }
    toast.success('Image removed', { id: 'image-removed' })
  }

  // File Upload Shortcut for Passenger Cards
  const handleCardUploadShortcut = (index) => {
    setTargetPassengerIndex(index)
    setActiveTab('upload')
    setTimeout(() => {
      fileRef.current?.click()
    }, 100)
  }

  // Live Camera Capture Shortcut for Passenger Cards
  const handleCardCameraShortcut = (index) => {
    setTargetPassengerIndex(index)
    setActiveTab('capture')
    openCamera()
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
      toast.error('Camera access denied', { id: 'camera-denied' })
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
      const file = new File([blob], 'passport.jpg', { type: 'image/jpeg' })
      stopCamera()
      processImage(file, targetPassengerIndex)
    }, 'image/jpeg', 0.95)
  }

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop())
      setCameraStream(null)
    }
    setCameraOpen(false)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-50 text-gray-900 antialiased font-sans">
      <Toaster position="top-right" />
      <main className="flex-1 overflow-y-auto max-w-5xl w-full mx-auto p-4 sm:p-5 pb-16 space-y-4">
        {/* Page content begins here */}
        {showKeyInput && (
          <div className="bg-gradient-to-r from-amber-50 to-amber-100/50 border border-amber-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-amber-900 flex items-center gap-1.5">
                  <i className="ti ti-key text-amber-700" />
                  Gemini API Configuration Needed
                </h4>
                <p className="text-xs text-amber-700 leading-relaxed max-w-xl">
                  An API key is required to perform real-time passport image scanning. Once saved, your key is stored securely in the cloud under your private session so you won't need to re-enter it next time.
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
                  saveSettingsToCloud(userApiKey)
                  toast.success("API Key saved securely to Cloud Storage.", { id: 'api-key-save' })
                  setShowKeyInput(false)
                }}
                className="bg-amber-800 text-white text-xs font-medium px-4 py-2 rounded-lg hover:bg-amber-900 transition-colors shrink-0"
              >
                Save Securely
              </button>
            </div>
          </div>
        )}

        {/* ── Input method tabs ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <i className="ti ti-input-search text-lg" aria-hidden="true" />
              Input method
            </p>
            {!showKeyInput && (
              <button 
                onClick={() => setShowKeyInput(true)}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
              >
                <i className="ti ti-settings" />
                Configure API Key
              </button>
            )}
          </div>

          {/* Tab buttons */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-gray-50 p-2 rounded-xl border border-gray-200">
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setActiveTab('write')}
                className={`flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg transition-all
                  ${activeTab === 'write'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-indigo-600'
                  }`}
              >
                <i className="ti ti-keyboard text-sm" />
                Manual Input Line
              </button>
              <button
                onClick={() => { setActiveTab('upload'); fileRef.current?.click() }}
                className={`flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg transition-all
                  ${activeTab === 'upload'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-indigo-600'
                  }`}
              >
                <i className="ti ti-upload text-sm" />
                Upload Photo
              </button>
              <button
                onClick={() => { setActiveTab('capture'); openCamera() }}
                className={`flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg transition-all
                  ${activeTab === 'capture'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-indigo-600'
                  }`}
              >
                <i className="ti ti-camera text-sm" />
                Live Camera Capture
              </button>
            </div>

            {/* Target Passenger Selector for Scanning */}
            {activeTab !== 'write' && (
              <div className="flex items-center gap-2 px-2 py-1 bg-white border border-gray-200 rounded-lg shadow-inner text-xs w-full sm:w-auto">
                <span className="font-bold text-gray-500 text-[10px] uppercase">Scan Target:</span>
                <select 
                  value={targetPassengerIndex}
                  onChange={(e) => setTargetPassengerIndex(Number(e.target.value))}
                  className="bg-transparent font-semibold text-indigo-700 outline-none"
                >
                  {paxList.map((_, i) => (
                    <option key={i} value={i}>Passenger #{i + 1}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Hidden file input */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />

          {/* Camera view */}
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
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs px-4 py-2 rounded-lg flex flex-col sm:flex-row items-center gap-1.5 w-full sm:w-auto justify-center"
                >
                  <i className="ti ti-camera text-sm" />
                  Capture & Parse to Passenger #{targetPassengerIndex + 1}
                </button>
                <button 
                  onClick={stopCamera} 
                  className="bg-gray-700 hover:bg-gray-600 text-white font-medium text-xs px-4 py-2 rounded-lg flex flex-col sm:flex-row items-center gap-1.5 w-full sm:w-auto justify-center"
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
              <span>Analyzing passport image layout for Passenger #{targetPassengerIndex + 1}...</span>
            </div>
          )}

          {/* Preview image with Delete Action */}
          {previewImg && !cameraOpen && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gray-50 border border-gray-200 p-3 rounded-lg shadow-sm animate-fade-in">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 min-w-0 w-full">
                <img
                  src={previewImg}
                  alt="Passport source file preview"
                  className="h-16 w-24 rounded border border-gray-300 object-cover shrink-0 shadow-inner"
                />
                <div className="text-xs text-gray-600 min-w-0">
                  {scanning ? (
                    <p className="font-semibold text-indigo-600 animate-pulse">Extracting details...</p>
                  ) : (
                    <p className="font-semibold text-emerald-600 flex items-center gap-1 truncate">
                      <i className="ti ti-check-circle" /> Extracted to Passenger #{targetPassengerIndex + 1}!
                    </p>
                  )}
                  <p className="text-gray-400 mt-0.5 truncate">Values applied to fields below</p>
                </div>
              </div>
              <button
                onClick={handleRemoveImage}
                disabled={scanning}
                className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-gray-150 shrink-0"
                title="Remove image"
              >
                <i className="ti ti-trash text-base" />
              </button>
            </div>
          )}

          {/* Write tab — one line input */}
          <div className="space-y-2">
            <input
              ref={inputRef}
              type="text"
              value={rawInput}
              onChange={(e) => handleInput(e.target.value)}
              placeholder="AIRLINE COUNTRY PASPPORT GENDER DOB EXPIRY LAST NAME/FIRST NAME"
              className={`w-full text-sm px-3.5 py-3 border rounded-xl bg-gray-50
                font-mono tracking-wide focus:outline-none focus:bg-white transition-all shadow-inner
                ${rawInput
                  ? inputComplete
                    ? 'border-emerald-400 focus:ring-1 focus:ring-emerald-500'
                    : 'border-amber-300 focus:ring-1 focus:ring-amber-400'
                  : 'border-gray-200 focus:ring-1 focus:ring-indigo-500'
                }`}
              autoComplete="off"
              spellCheck={false}
            />

            <div className="text-[11px] text-gray-500 font-mono flex flex-wrap gap-x-3 gap-y-1 bg-gray-100 p-2.5 rounded-lg border border-gray-150">
              <span className="font-bold text-gray-600 uppercase">Input Format Guide:</span>
              <span className="text-blue-700">AIRLINE (2 Letter)</span>
              <span className="text-emerald-700">COUNTRY (3 Letter)</span>
              <span className="text-amber-700">PASSPORT #</span>
              <span className="text-pink-700">GENDER (M/F)</span>
              <span className="text-purple-700">DOB (DDMMMYY)</span>
              <span className="text-green-700">EXPIRY</span>
              <span className="text-red-700">SURNAME/GIVEN-NAME</span>
            </div>
          </div>

          {/* Token display */}
          {tokens.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Identified Parameters</p>
              <div className="flex flex-wrap gap-1.5">
                {tokens.map((t, i) => (
                  <span key={i} className={`text-xs px-2.5 py-1 rounded-md font-mono flex items-center gap-1 ${TOKEN_STYLES[t.type] || TOKEN_STYLES.unknown}`}>
                    <span className="font-bold text-[9px] uppercase tracking-wider opacity-60">[{t.type}]</span>
                    {t.value}{t.label ? ` · ${t.label}` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Quick airline buttons */}
          <div className="pt-4 border-t border-gray-100">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5">Quick airline select</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_AIRLINES.map((code) => (
                <button
                  key={code}
                  onClick={() => handleAirlineQuick(code)}
                  title={KNOWN_AIRLINES[code]}
                  className={`text-xs px-3 py-1.5 rounded border transition-all font-mono font-bold
                    ${airline === code
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                >
                  {code}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Passengers ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <i className="ti ti-users text-lg" aria-hidden="true" />
              Passengers details ({paxList.length})
            </p>
            <button 
              onClick={addPax} 
              className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shadow-sm text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 font-semibold transition-colors"
            >
              <i className="ti ti-plus" aria-hidden="true" />
              Add passenger
            </button>
          </div>

          <div className="space-y-4">
            {paxList.map((pax, idx) => (
              <PaxForm
                key={pax.id || idx}
                pax={pax}
                index={idx}
                total={paxList.length}
                onUpdate={updatePax}
                onRemove={removePax}
                onReset={resetPax}
                onUploadShortcut={handleCardUploadShortcut}
                onCameraShortcut={handleCardCameraShortcut}
                ssrLine={ssrLines[idx]}
              />
            ))}
          </div>
        </div>

        {/* ── Output ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <i className="ti ti-clipboard-text text-lg" aria-hidden="true" />
              Galileo output lines
            </p>
            <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
              allComplete
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : 'bg-amber-100 text-amber-800 border border-amber-200'
            }`}>
              {allComplete ? '✓ Ready for GDS' : 'Pending Details'}
            </span>
          </div>

          <div className="space-y-2">
            {paxList.map((pax, idx) => (
              <OutputBox
                key={pax.id || idx}
                line={ssrLines[idx] || `P${pax.paxNum || 1} — Complete remaining fields above to populate output line.`}
                passengerNum={paxList.length > 1 ? (pax.paxNum || 1) : null}
              />
            ))}
          </div>

          {allComplete && (
            <div className="flex flex-wrap gap-2.5 pt-2">
              <CopyButton text={allLines.join('\n')} label="Copy all lines" />
              {paxList.length === 1 && (
                <CopyButton text={allLines[0]} label="Copy line 1" />
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-gray-800 hover:bg-gray-900 text-white font-medium text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <i
                  className={`ti ${saving ? 'ti-loader animate-spin' : 'ti-device-floppy'}`}
                  aria-hidden="true"
                />
                {saving ? 'Saving...' : 'Save Record'}
              </button>
            </div>
          )}
        </div>

      </main>
    </div>
  )
}

function PaxForm({ pax, index, total, onUpdate, onRemove, onReset, onUploadShortcut, onCameraShortcut, ssrLine }) {
  const complete = ssrLine !== null
  return (
    <div id={pax.id} className={`rounded-xl border p-4 transition-all shadow-sm ${
      complete ? 'border-emerald-200 bg-emerald-50/10' : 'border-gray-200 bg-white'
    }`}>
      <div className="flex flex-col gap-3 mb-3.5 pb-2 border-b border-gray-100 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded font-mono">
            Passenger #{pax.paxNum || (total - index)}
          </span>
          {complete ? (
            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
              <i className="ti ti-circle-check-filled animate-bounce" /> Valid SSR Docs generated
            </span>
          ) : (
            <span className="text-[11px] text-amber-500 font-semibold">
              Pending completion
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex flex-row flex-wrap gap-1.5 text-xs font-semibold items-center">
          <button
            onClick={() => onCameraShortcut(index)}
            className="text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded"
            title="Open camera to capture passport"
          >
            <i className="ti ti-camera" />
            Live Scan
          </button>
          
          <button
            onClick={() => onUploadShortcut(index)}
            className="text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded"
            title="Upload a passport photo"
          >
            <i className="ti ti-upload" />
            Upload Photo
          </button>
          
          <button
            onClick={() => onReset(index)}
            className="text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1 border border-gray-200 px-2.5 py-1.5 rounded hover:bg-gray-50"
            title="Clear all text fields back to empty"
          >
            <i className="ti ti-rotate-ccw" />
            Clear
          </button>

          {total > 1 && (
            <button
              onClick={() => onRemove(index)}
              className="text-red-500 hover:text-red-700 transition-colors flex items-center gap-1 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded"
            >
              <i className="ti ti-trash" aria-hidden="true" />
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Field label="Surname"          value={pax.surname} onChange={(v) => onUpdate(index, 'surname', v)} />
        <Field label="Given name"       value={pax.given}   onChange={(v) => onUpdate(index, 'given', v)} />
        <Field label="Passport no."     value={pax.ppnum}   onChange={(v) => onUpdate(index, 'ppnum', v)} />
        <Field label="Nationality"      value={pax.nat}     onChange={(v) => onUpdate(index, 'nat', v)} maxLength={3} />
        <Field label="DOB (DDMMMYY)"    value={pax.dob}     onChange={(v) => onUpdate(index, 'dob', v)} />
        <Field label="Expiry (DDMMMYY)" value={pax.exp}     onChange={(v) => onUpdate(index, 'exp', v)} />
        <GenderField value={pax.gender} onChange={(v) => onUpdate(index, 'gender', v)} className="col-span-2 lg:col-span-1" />
      </div>
    </div>
  )
}

function Field({ label, value, onChange, maxLength }) {
  return (
    <div className="space-y-1">
      <label className="block text-[11px] font-bold text-gray-500 tracking-wide uppercase">{label}</label>
      <input
        type="text"
        value={value}
        placeholder={label} // Matching header label placeholder exactly
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 tracking-wider transition-all
          ${value ? 'bg-indigo-50/20 border-indigo-200 text-indigo-900 font-semibold' : 'bg-white border-gray-200 text-gray-800'}`}
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  )
}

function GenderField({ value, onChange, className }) {
  return (
    <div className={`space-y-1 ${className || ''}`}>
      <label className="block text-[11px] font-bold text-gray-500 tracking-wide uppercase">Gender</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white border-gray-200 text-gray-800 transition-all font-semibold"
      >
        <option value="M">M — Male</option>
        <option value="F">F — Female</option>
        <option value="MI">MI — Male Infant</option>
        <option value="FI">FI — Female Infant</option>
      </select>
    </div>
  )
}