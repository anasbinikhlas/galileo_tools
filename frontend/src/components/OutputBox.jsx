export default function OutputBox({ line, passengerNum }) {
  if (!line) return null

  // Colorize parts of the SSR line
  const renderHighlighted = (text) => {
    // Pattern: SI.P{n}/SSRDOCS{AL}HK1/P/{ISS}/{PP}/{NAT}/{DOB}/{G}/{EXP}/{SUR}/{GIV} MR
    const parts = text.split('/')
    if (parts.length < 8) {
      return <span>{text}</span>
    }

    // parts[0] = SI.P1  parts[1] = SSRDOCSxxHK1  parts[2] = P  parts[3] = ISS
    // parts[4] = PPNUM  parts[5] = NAT  parts[6] = DOB  parts[7] = GENDER
    // parts[8] = EXP    parts[9] = SURNAME  parts[10] = GIVEN MR

    const airlineMatch = parts[1] && parts[1].match(/SSRDOCS([A-Z0-9]{2})HK1/)
    const airline = airlineMatch ? airlineMatch[1] : ''

    return (
      <>
        <span className="text-gray-500">{parts[0]}/</span>
        <span className="text-gray-500">SSRDOCS</span>
        <span className="text-blue-600 font-semibold">{airline}</span>
        <span className="text-gray-500">HK1/P/</span>
        <span className="text-emerald-700 font-medium">{parts[3]}</span>
        <span className="text-gray-400">/</span>
        <span className="text-amber-700 font-semibold">{parts[4]}</span>
        <span className="text-gray-400">/</span>
        <span className="text-emerald-700 font-medium">{parts[5]}</span>
        <span className="text-gray-400">/</span>
        <span className="text-purple-700 font-medium">{parts[6]}</span>
        <span className="text-gray-400">/</span>
        <span className="text-pink-700 font-medium">{parts[7]}</span>
        <span className="text-gray-400">/</span>
        <span className="text-purple-700 font-medium">{parts[8]}</span>
        <span className="text-gray-400">/</span>
        <span className="text-red-700 font-semibold">{parts[9]}</span>
        <span className="text-gray-400">/</span>
        <span className="text-red-600 font-medium">{parts.slice(10).join('/')}</span>
      </>
    )
  }

  return (
    <div className="output-box">
      {passengerNum && (
        <p className="text-xs text-gray-400 mb-1">Passenger {passengerNum}</p>
      )}
      <div className="leading-loose">{renderHighlighted(line)}</div>
    </div>
  )
}
