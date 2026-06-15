import { useState, useCallback } from 'react'

const KNOWN_AIRLINES = {
  SV: 'Saudia', PK: 'PIA', EK: 'Emirates', QR: 'Qatar Airways',
  EY: 'Etihad', FZ: 'Flydubai', G9: 'Air Arabia', TK: 'Turkish Airlines',
  GF: 'Gulf Air', WY: 'Oman Air', KU: 'Kuwait Airways', XY: 'flynas',
  F3: 'Flyjinnah', PA: 'AirBlue', MS: 'EgyptAir', ET: 'Ethiopian',
  AI: 'Air India', BA: 'British Airways', LH: 'Lufthansa', CZ: 'China Southern',
  CA: 'Air China', UL: 'SriLankan', NH: 'ANA', JL: 'Japan Airlines',
  SQ: 'Singapore Airlines', CX: 'Cathay Pacific', MH: 'Malaysia Airlines',
}

const SKIP_WORDS = ['MR', 'MRS', 'MS', 'BIN', 'BINTI', 'DR', 'CAPT', 'SIR']

const DATE_RE    = /^\d{2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{2}$/
const COUNTRY_RE = /^[A-Z]{3}$/
const GENDER_RE  = /^(M|F|MI|FI)$/
const PPNUM_RE   = /^[A-Z0-9]{5,12}$/
const AIRLINE_RE = /^[A-Z0-9]{2}$/

function emptyPax() {
  return { surname: '', given: '', ppnum: '', nat: '', issuer: '', dob: '', exp: '', gender: 'M' }
}

function buildSSRLine(pax, airline, index = 1) {
  const { surname, given, ppnum, nat, issuer, dob, exp, gender } = pax
  const iss = nat
  const al  = airline || ''
  const isComplete = al.length >= 2 && surname && given && ppnum && nat && dob && exp
  if (!isComplete) return null
  return `SI.P${index}/SSRDOCS${al}HK1/P/${iss}/${ppnum}/${nat}/${dob}/${gender}/${exp}/${surname}/${given} MR`
}

function parseOneLine(raw) {
  const val   = raw.trim().toUpperCase()
  const parts = val.split(/\s+/)
  const result = { airline: '', issuer: '', ppnum: '', gender: 'M', dob: '', exp: '', surname: '', given: '' }
  const tokens = []
  const dates = []
  const countries = []
  let genderSet = false

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]

    if (SKIP_WORDS.includes(p)) {
      tokens.push({ value: p, type: 'skip' })
      continue
    }

    if (i === 0 && AIRLINE_RE.test(p)) {
      result.airline = p
      tokens.push({ value: p, type: 'airline', label: KNOWN_AIRLINES[p] || 'Airline' })
      continue
    }

    if (DATE_RE.test(p)) {
      dates.push(p)
      const isFirst = dates.length === 1
      if (isFirst) result.dob = p
      else result.exp = p
      tokens.push({ value: p, type: isFirst ? 'dob' : 'exp' })
      continue
    }

    if (GENDER_RE.test(p) && !genderSet) {
      result.gender = p
      genderSet = true
      tokens.push({ value: p, type: 'gender' })
      continue
    }

    if (p.includes('/')) {
      const slash = p.indexOf('/')
      result.surname = p.substring(0, slash)
      const rest = p.substring(slash + 1).replace(/\s*(BIN|BINTI|MR|MRS|MS|DR)\s*/gi, ' ').trim()
      result.given = rest.split(/\s+/)[0] || ''
      tokens.push({ value: result.surname, type: 'surname' })
      tokens.push({ value: result.given, type: 'given' })
      continue
    }

      if (COUNTRY_RE.test(p) && p.length === 3) {
        countries.push(p)
        const isFirst = countries.length === 1
        if (isFirst) result.issuer = p
        else result.nat = p
        tokens.push({ value: p, type: 'country' })
        continue
      }

    if (PPNUM_RE.test(p) && !result.ppnum) {
      result.ppnum = p
      tokens.push({ value: p, type: 'ppnum' })
      continue
    }

    tokens.push({ value: p, type: 'unknown' })
  }

  if (!result.nat && result.issuer) result.nat = result.issuer
  if (!result.issuer && result.nat) result.issuer = result.nat

  const complete = result.airline && result.ppnum && result.nat && result.dob && result.exp && result.surname && result.given
  return { parsed: result, tokens, complete }
}

export function useSSRParser() {
  const [airline, setAirline] = useState('')
  const [paxList, setPaxList] = useState([emptyPax()])
  const [tokens, setTokens]   = useState([])
  const [inputComplete, setInputComplete] = useState(false)

  const parseInput = useCallback((raw) => {
    if (!raw.trim()) { setTokens([]); setInputComplete(false); return }
    const { parsed, tokens: toks, complete } = parseOneLine(raw)
    setTokens(toks)
    setInputComplete(complete)
    setAirline(parsed.airline || airline)
    setPaxList((prev) => {
      const updated = [...prev]
      updated[0] = {
        surname: parsed.surname || '',
        given:   parsed.given   || '',
        ppnum:   parsed.ppnum   || '',
        nat:     parsed.nat     || '',
        issuer:  parsed.nat     || '',
        dob:     parsed.dob     || '',
        exp:     parsed.exp     || '',
        gender:  parsed.gender  || 'M',
      }
      return updated
    })
  }, [airline])

  const updatePax = useCallback((index, field, value) => {
    setPaxList((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value.toUpperCase() }
      if (field === 'nat' && !updated[index].issuer) updated[index].issuer = value.toUpperCase()
      return updated
    })
  }, [])

  const addPax = useCallback(() => {
    setPaxList((prev) => [...prev, { ...emptyPax(), nat: prev[0]?.nat || '', issuer: prev[0]?.issuer || '' }])
  }, [])

  const removePax = useCallback((index) => {
    setPaxList((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const ssrLines = paxList.map((p, i) => buildSSRLine(p, airline, i + 1))
  const allLines = ssrLines.filter(Boolean)
  const allComplete = allLines.length === paxList.length && airline.length >= 2

  return { airline, setAirline, paxList, tokens, inputComplete, ssrLines, allLines, allComplete, parseInput, updatePax, addPax, removePax }
}

export { KNOWN_AIRLINES, emptyPax }