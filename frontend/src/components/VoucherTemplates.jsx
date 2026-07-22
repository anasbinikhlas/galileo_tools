import React from 'react'

export function ColorPdfTemplate({
  header = {},
  pax = {},
  totalPax = 0,
  depFlight = {},
  arrFlight = {},
  visa = {},
  makkahHotels = [],
  madinaHotels = [],
  transport = {},
  totals = {},
  comments = ''
}) {
  const safeHeaderSr = String(header?.sr_no || '01')
  const safeHeaderName = String(header?.name || 'CLIENT')
  const safeHeaderDate = String(header?.date || new Date().toISOString().slice(0, 10))

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
  )
}

export function StandardPdfTemplate({
  header = {},
  pax = {},
  totalPax = 0,
  depFlight = {},
  arrFlight = {},
  visa = {},
  makkahHotels = [],
  madinaHotels = [],
  transport = {},
  totals = {},
  comments = ''
}) {
  return (
    <div id="printable-package" className="p-4 bg-white border border-gray-900 rounded-lg text-black font-mono text-xs shadow-inner space-y-0 text-left">
      
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
      {(Array.isArray(makkahHotels) ? makkahHotels : []).map((h, i) => (
        <div key={`p-mak-${i}`} className="grid grid-cols-7 divide-x divide-black border-b border-black text-center text-[11px]">
          <div className="p-1.5 col-span-2 font-bold text-left px-2">MAKKAH: {h.hotel_name || '-'}</div>
          <div className="p-1.5 col-span-1">{h.room_qty || '-'}</div>
          <div className="p-1.5 col-span-1">{h.room_type || '-'}</div>
          <div className="p-1.5 col-span-1">{h.check_in || '-'}</div>
          <div className="p-1.5 col-span-1">{h.check_out || '-'}</div>
          <div className="p-1.5 col-span-1 font-bold">{h.nights || 0} / {h.night_price || 0}</div>
        </div>
      ))}
      {(Array.isArray(madinaHotels) ? madinaHotels : []).map((h, i) => (
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
  )
}
