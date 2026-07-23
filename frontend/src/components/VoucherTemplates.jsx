import React from 'react'

export function ColorPdfTemplate({
  header = {},
  pax = {},
  totalPax = 0,
  depFlight = {},
  arrFlight = {},
  flightItinerary = null,
  visa = {},
  makkahHotels = [],
  madinaHotels = [],
  transport = {},
  transportList = null,
  totals = {},
  comments = '',
  hideBreakup = false
}) {
  const safeHeaderSr = String(header?.sr_no || '01')
  const safeHeaderName = String(header?.name || 'CLIENT')
  const safeHeaderDate = String(header?.date || new Date().toISOString().slice(0, 10))

  // Build flight rows list
  const flightsList = Array.isArray(flightItinerary) && flightItinerary.length > 0
    ? flightItinerary
    : [
        { type: 'DEPARTURE', ...(depFlight || {}) },
        { type: 'ARRIVAL', ...(arrFlight || {}) }
      ].filter(f => f.airline || f.flight_no || f.sector || f.date)

  const finalFlights = flightsList.length > 0 ? flightsList : [
    { type: 'DEPARTURE', airline: '', flight_no: '', sector: '', date: '', dep_time: '', arr_time: '' },
    { type: 'ARRIVAL', airline: '', flight_no: '', sector: '', date: '', dep_time: '', arr_time: '' }
  ]

  // Multi-row transport list support
  const safeTransportList = Array.isArray(transportList) && transportList.length > 0
    ? transportList
    : Array.isArray(transport) && transport.length > 0
      ? transport
      : [transport || {}]

  const safeMakkahHotels = Array.isArray(makkahHotels) ? makkahHotels : []
  const safeMadinaHotels = Array.isArray(madinaHotels) ? madinaHotels : []

  return (
    <div className="w-full overflow-x-auto max-w-4xl mx-auto p-1 sm:p-2">
      <div id="printable-color-package" className="bg-white text-slate-900 font-sans p-4 sm:p-6 space-y-4 rounded-2xl border border-slate-200 shadow-sm min-w-[650px] text-left uppercase">
        
        {/* Header Banner */}
        <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800">
          <div>
            <h2 className="text-2xl font-black tracking-wide text-white flex items-center gap-2">
              PACKAGE SUMMARY
            </h2>
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
          <div className="bg-blue-50/80 text-blue-900 border-l-4 border-blue-600 rounded-r-xl px-3 py-1.5 flex items-center justify-between font-bold text-xs uppercase tracking-wider">
            <div className="flex items-center gap-2">
              <i className="ti ti-users text-blue-600 text-base" />
              PASSENGER BREAKDOWN
            </div>
          </div>
          <div className={`grid ${hideBreakup ? 'grid-cols-4' : 'grid-cols-5'} divide-x divide-slate-200 border border-slate-200 rounded-xl text-center bg-white shadow-xs overflow-hidden text-xs`}>
            <div className="p-2.5">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">ADULT (ADT)</span>
              <span className="block text-sm font-extrabold text-slate-800 mt-0.5">{pax?.adt ?? '0'}</span>
              {pax?.adt_price && !hideBreakup && <span className="block text-[10px] text-blue-600 font-bold mt-0.5">Fare: {pax.adt_price}</span>}
            </div>
            <div className="p-2.5">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">CHILD</span>
              <span className="block text-sm font-extrabold text-slate-800 mt-0.5">{pax?.child ?? '0'}</span>
              {pax?.child_price && !hideBreakup && <span className="block text-[10px] text-blue-600 font-bold mt-0.5">Fare: {pax.child_price}</span>}
            </div>
            <div className="p-2.5">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">INFANT</span>
              <span className="block text-sm font-extrabold text-slate-800 mt-0.5">{pax?.infant ?? '0'}</span>
              {pax?.infant_price && !hideBreakup && <span className="block text-[10px] text-blue-600 font-bold mt-0.5">Fare: {pax.infant_price}</span>}
            </div>
            <div className="p-2.5 bg-blue-50/40">
              <span className="block text-[10px] font-extrabold text-blue-800 uppercase tracking-wider">TOTAL PASSENGERS</span>
              <span className="block text-sm font-black text-blue-800 mt-0.5">{totalPax || 0}</span>
            </div>
            {!hideBreakup && (
              <div className="p-2.5 bg-blue-100/70">
                <span className="block text-[10px] font-black text-blue-950 uppercase tracking-wider">TOTAL FARE</span>
                <span className="block text-sm font-black text-blue-900 mt-0.5">{pax?.ticket_total || '0'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Flight Details (Multi-Line Dynamic Table) */}
        <div className="space-y-1.5">
          <div className="bg-blue-50/80 text-blue-900 border-l-4 border-blue-600 rounded-r-xl px-3 py-1.5 flex items-center justify-between font-bold text-xs uppercase tracking-wider">
            <div className="flex items-center gap-2">
              <i className="ti ti-plane-departure text-blue-600 text-base" />
              FLIGHT ITINERARY DETAILS ({finalFlights.length} {finalFlights.length === 1 ? 'LEG' : 'LEGS'})
            </div>
          </div>
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white text-xs">
            <div className="grid grid-cols-7 bg-slate-50 text-slate-500 font-bold p-2 text-[10px] uppercase tracking-wider border-b border-slate-200 text-center">
              <div className="col-span-1 text-center px-2">#</div>
              <div className="col-span-1">AIRLINE</div>
              <div className="col-span-1">FLIGHT NO</div>
              <div className="col-span-2">SECTOR</div>
              <div className="col-span-1">DATE</div>
              <div className="col-span-1">DEP / ARR</div>
            </div>
            
            {finalFlights.map((fl, idx) => {
              const sectorRaw = typeof fl?.sector === 'string' ? fl.sector.trim() : ''
              const parts = sectorRaw ? sectorRaw.split(/\s+/) : []
              const from = parts[0] || '—'
              const to = parts[1] || ''

              return (
                <div key={`fl-item-${idx}`} className="grid grid-cols-7 p-2.5 border-b border-slate-100 last:border-0 text-center items-center font-mono">
                  <div className="col-span-1 text-center font-sans">
                    <span className="text-xs font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                      {idx + 1}
                    </span>
                  </div>
                  <div className="col-span-1 font-bold text-slate-800">{fl?.airline || '-'}</div>
                  <div className="col-span-1 text-slate-700">{fl?.flight_no || '-'}</div>
                  <div className="col-span-2 font-bold text-slate-900 flex items-center justify-center gap-1">
                    <span>{from}</span>
                    {to && <span className="text-blue-600">✈</span>}
                    {to && <span>{to}</span>}
                  </div>
                  <div className="col-span-1 text-slate-700">{fl?.date || '-'}</div>
                  <div className="col-span-1 text-slate-700">{fl?.dep_time || '-'} / {fl?.arr_time || '-'}</div>
                </div>
              )
            })}
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
              <div className="text-right px-3">{hideBreakup ? '' : 'PRICE (PER VISA)'}</div>
            </div>
            <div className="grid grid-cols-3 p-2.5 items-center font-mono">
              <div className="px-3 font-extrabold text-slate-900 font-sans">{visa?.type || 'VISA'}</div>
              <div className="text-center font-bold text-slate-800">{visa?.qty || '0'}</div>
              <div className="text-right px-3 font-bold text-slate-800">{hideBreakup ? '' : (visa?.price || '0')}</div>
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
              <div className="col-span-1 text-right px-3">{hideBreakup ? 'NIGHTS' : 'NIGHTS / RATE'}</div>
            </div>

            {safeMakkahHotels.map((h, i) => (
              <div key={`col-mak-${i}`} className="grid grid-cols-7 p-2.5 border-b border-slate-100 text-center items-center font-mono">
                <div className="col-span-2 text-left px-3 font-sans">
                  <span className="block font-black text-slate-900 text-xs uppercase">{h?.hotel_name || '-'}</span>
                  <span className="text-[10px] text-amber-600 font-medium">Makkah Hotel</span>
                </div>
                <div className="col-span-1 font-bold text-slate-800">{h?.room_qty || '—'}</div>
                <div className="col-span-1 font-bold text-slate-800">{h?.room_type || '—'}</div>
                <div className="col-span-1 text-slate-700">{h?.check_in || '—'}</div>
                <div className="col-span-1 text-slate-700">{h?.check_out || '—'}</div>
                <div className="col-span-1 text-right px-3 font-extrabold text-slate-900">
                  {h?.nights || '0'} {hideBreakup ? 'Nights' : `/ ${h?.night_price || '0'}`}
                </div>
              </div>
            ))}

            {safeMadinaHotels.map((h, i) => (
              <div key={`col-med-${i}`} className="grid grid-cols-7 p-2.5 border-b border-slate-100 last:border-0 text-center items-center font-mono">
                <div className="col-span-2 text-left px-3 font-sans">
                  <span className="block font-black text-slate-900 text-xs uppercase">{h?.hotel_name || '-'}</span>
                  <span className="text-[10px] text-emerald-600 font-medium">Madina Hotel</span>
                </div>
                <div className="col-span-1 font-bold text-slate-800">{h?.room_qty || '—'}</div>
                <div className="col-span-1 font-bold text-slate-800">{h?.room_type || '—'}</div>
                <div className="col-span-1 text-slate-700">{h?.check_in || '—'}</div>
                <div className="col-span-1 text-slate-700">{h?.check_out || '—'}</div>
                <div className="col-span-1 text-right px-3 font-extrabold text-slate-900">
                  {h?.nights || '0'} {hideBreakup ? 'Nights' : `/ ${h?.night_price || '0'}`}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Transportation Details (Supports Multi-row transport) */}
        <div className="space-y-1.5">
          <div className="bg-blue-50/80 text-blue-900 border-l-4 border-blue-600 rounded-r-xl px-3 py-1.5 flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
            <i className="ti ti-car text-blue-600 text-base" />
            TRANSPORTATION DETAILS
          </div>
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white text-xs divide-y divide-slate-100">
            <div className="grid grid-cols-4 bg-slate-50 text-slate-500 font-bold p-2 text-[10px] uppercase tracking-wider border-b border-slate-200">
              <div className="px-3">TYPE</div>
              <div className="text-center">QTY</div>
              <div className="px-3">SECTOR / ROUTE</div>
              <div className="text-right px-3">{hideBreakup ? '' : 'PRICE'}</div>
            </div>
            {safeTransportList.map((t, idx) => (
              <div key={`col-trans-${idx}`} className="grid grid-cols-4 p-2.5 items-center font-mono">
                <div className="px-3 font-extrabold text-slate-900 font-sans">{t?.type || 'BY CAR'}</div>
                <div className="text-center font-bold text-slate-800">{t?.qty || '1'}</div>
                <div className="px-3 text-slate-800 font-bold">{t?.sector || 'JED ARPT - MAK - MED'}</div>
                <div className="text-right px-3 font-bold text-slate-800">{hideBreakup ? '' : (t?.price || '—')}</div>
              </div>
            ))}
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
              <span className="block text-base font-black text-slate-900">{totals?.package_only || '-'}</span>
            </div>
            <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 text-center shadow-xs">
              <span className="block text-[10px] font-extrabold text-blue-700 uppercase tracking-wider mb-1">TOTAL PACKAGE WITH TICKET</span>
              <span className="block text-base font-black text-blue-700">{totals?.package_with_ticket || '-'}</span>
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
            {typeof comments === 'string' && comments ? comments : 'All bookings confirmed as per schedule.'}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium pt-1 border-t border-slate-100">
          <span>Travel Itinerary & Booking Voucher</span>
          <span>Page 1 of 1</span>
        </div>

      </div>
    </div>
  )
}

export function StandardPdfTemplate({
  header = {},
  pax = {},
  totalPax = 0,
  depFlight = {},
  arrFlight = {},
  flightItinerary = null,
  visa = {},
  makkahHotels = [],
  madinaHotels = [],
  transport = {},
  transportList = null,
  totals = {},
  comments = '',
  hideBreakup = false
}) {
  const flightsList = Array.isArray(flightItinerary) && flightItinerary.length > 0
    ? flightItinerary
    : [
        { type: 'DEPARTURE', ...(depFlight || {}) },
        { type: 'ARRIVAL', ...(arrFlight || {}) }
      ].filter(f => f.airline || f.flight_no || f.sector || f.date)

  const finalFlights = flightsList.length > 0 ? flightsList : [
    { type: 'DEPARTURE', airline: '', flight_no: '', sector: '', date: '', dep_time: '', arr_time: '' },
    { type: 'ARRIVAL', airline: '', flight_no: '', sector: '', date: '', dep_time: '', arr_time: '' }
  ]

  const safeTransportList = Array.isArray(transportList) && transportList.length > 0
    ? transportList
    : Array.isArray(transport) && transport.length > 0
      ? transport
      : [transport || {}]

  return (
    <div className="w-full overflow-x-auto max-w-4xl mx-auto p-1 sm:p-2">
      <div id="printable-package" className="p-4 bg-white border border-gray-900 rounded-lg text-black font-mono text-xs shadow-inner space-y-0 text-left min-w-[650px] uppercase">
        
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

        {/* Pax count & Fare Breakdown */}
        <div className={`grid ${hideBreakup ? 'grid-cols-4' : 'grid-cols-5'} divide-x divide-black border-b border-black text-center font-bold bg-gray-100 text-[11px]`}>
          <div className="p-1">ADT {!hideBreakup && pax.adt_price ? `(${pax.adt_price})` : ''}</div>
          <div className="p-1">CHILD {!hideBreakup && pax.child_price ? `(${pax.child_price})` : ''}</div>
          <div className="p-1">INFANT {!hideBreakup && pax.infant_price ? `(${pax.infant_price})` : ''}</div>
          <div className="p-1 bg-gray-200">TOTAL PAX</div>
          {!hideBreakup && <div className="p-1 bg-gray-300">TOTAL FARE</div>}
        </div>
        <div className={`grid ${hideBreakup ? 'grid-cols-4' : 'grid-cols-5'} divide-x divide-black border-b border-black text-center text-[11px]`}>
          <div className="p-1.5">{pax.adt || 0}</div>
          <div className="p-1.5">{pax.child || 0}</div>
          <div className="p-1.5">{pax.infant || 0}</div>
          <div className="p-1.5 font-bold">{totalPax}</div>
          {!hideBreakup && <div className="p-1.5 font-extrabold">{pax.ticket_total || 0}</div>}
        </div>

        {/* Flight Details */}
        <div className="bg-gray-200 text-center p-1.5 font-bold border-b border-black text-[11px] uppercase">
          FLIGHT DETAILS
        </div>
        <div className="grid grid-cols-7 divide-x divide-black border-b border-black text-center font-bold bg-gray-100 text-[10px]">
          <div className="p-1 col-span-1">#</div>
          <div className="p-1 col-span-1">AIRLINE</div>
          <div className="p-1 col-span-1">FLIGHT #</div>
          <div className="p-1 col-span-2">SECTOR</div>
          <div className="p-1 col-span-1">DATE</div>
          <div className="p-1 col-span-1">DEP / ARR</div>
        </div>
        
        {finalFlights.map((fl, idx) => (
          <div key={`std-fl-${idx}`} className="grid grid-cols-7 divide-x divide-black border-b border-black text-center text-[11px]">
            <div className="p-1.5 font-bold bg-gray-50 col-span-1">
              {idx + 1}
            </div>
            <div className="p-1.5 col-span-1">{fl.airline || '-'}</div>
            <div className="p-1.5 col-span-1">{fl.flight_no || '-'}</div>
            <div className="p-1.5 col-span-2 font-bold">{fl.sector || '-'}</div>
            <div className="p-1.5 col-span-1">{fl.date || '-'}</div>
            <div className="p-1.5 col-span-1">{fl.dep_time || '-'} / {fl.arr_time || '-'}</div>
          </div>
        ))}

        {/* Visa Details */}
        <div className="bg-gray-200 text-center p-1.5 font-bold border-b border-black text-[11px] uppercase">
          VISA DETAILS
        </div>
        <div className="grid grid-cols-3 divide-x divide-black border-b border-black text-center font-bold bg-gray-100 text-[10px]">
          <div className="p-1">VISA TYPE</div>
          <div className="p-1">VISA QTY</div>
          <div className="p-1">{hideBreakup ? '' : 'VISA PRICE'}</div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-black border-b border-black text-center text-[11px]">
          <div className="p-1.5 font-bold">{visa.type || '-'}</div>
          <div className="p-1.5">{visa.qty || '-'}</div>
          <div className="p-1.5">{hideBreakup ? '' : (visa.price || '-')}</div>
        </div>

        {/* Hotel Details */}
        <div className="bg-gray-200 text-center p-1.5 font-bold border-b border-black text-[11px] uppercase">
          HOTEL DETAILS
        </div>
        <div className="grid grid-cols-7 divide-x divide-black border-b border-black text-center font-bold bg-gray-100 text-[10px]">
          <div className="p-1 col-span-2">HOTEL NAME</div>
          <div className="p-1 col-span-1">ROOM QTY</div>
          <div className="p-1 col-span-1">ROOM TYPE</div>
          <div className="p-1 col-span-1">CHECK IN</div>
          <div className="p-1 col-span-1">CHECK OUT</div>
          <div className="p-1 col-span-1">{hideBreakup ? 'NIGHTS' : 'NIGHTS / RATE'}</div>
        </div>
        {(Array.isArray(makkahHotels) ? makkahHotels : []).map((h, i) => (
          <div key={`p-mak-${i}`} className="grid grid-cols-7 divide-x divide-black border-b border-black text-center text-[11px]">
            <div className="p-1.5 col-span-2 font-bold text-left px-2">MAKKAH: {h.hotel_name || '-'}</div>
            <div className="p-1.5 col-span-1">{h.room_qty || '-'}</div>
            <div className="p-1.5 col-span-1">{h.room_type || '-'}</div>
            <div className="p-1.5 col-span-1">{h.check_in || '-'}</div>
            <div className="p-1.5 col-span-1">{h.check_out || '-'}</div>
            <div className="p-1.5 col-span-1 font-bold">{h.nights || 0} {hideBreakup ? 'Nights' : `/ ${h.night_price || 0}`}</div>
          </div>
        ))}
        {(Array.isArray(madinaHotels) ? madinaHotels : []).map((h, i) => (
          <div key={`p-med-${i}`} className="grid grid-cols-7 divide-x divide-black border-b border-black text-center text-[11px]">
            <div className="p-1.5 col-span-2 font-bold text-left px-2">MADINA: {h.hotel_name || '-'}</div>
            <div className="p-1.5 col-span-1">{h.room_qty || '-'}</div>
            <div className="p-1.5 col-span-1">{h.room_type || '-'}</div>
            <div className="p-1.5 col-span-1">{h.check_in || '-'}</div>
            <div className="p-1.5 col-span-1">{h.check_out || '-'}</div>
            <div className="p-1.5 col-span-1 font-bold">{h.nights || 0} {hideBreakup ? 'Nights' : `/ ${h.night_price || 0}`}</div>
          </div>
        ))}

        {/* Transport Details */}
        <div className="bg-gray-200 text-center p-1.5 font-bold border-b border-black text-[11px] uppercase">
          TRANSPORTATION DETAILS
        </div>
        <div className="grid grid-cols-7 divide-x divide-black border-b border-black text-center font-bold bg-gray-100 text-[10px]">
          <div className="p-1 col-span-2">TRANSPORT TYPE</div>
          <div className="p-1 col-span-1">QTY</div>
          <div className="p-1 col-span-3">SECTOR</div>
          <div className="p-1 col-span-1">{hideBreakup ? '' : 'PRICE'}</div>
        </div>
        {safeTransportList.map((t, idx) => (
          <div key={`p-trans-${idx}`} className="grid grid-cols-7 divide-x divide-black border-b border-black text-center text-[11px]">
            <div className="p-1.5 col-span-2 font-bold">{t.type || '-'}</div>
            <div className="p-1.5 col-span-1">{t.qty || '-'}</div>
            <div className="p-1.5 col-span-3">{t.sector || '-'}</div>
            <div className="p-1.5 col-span-1 font-bold">{hideBreakup ? '' : (t.price || '-')}</div>
          </div>
        ))}

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
    </div>
  )
}
