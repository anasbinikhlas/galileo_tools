import React from 'react'
import { getActiveCompanyDetails } from '../pages/CompanyDetails'

const BANK_DETAILS_LIST = [
  { title: 'ZUYUFURRAHMAN HAJJ & UMRAH', bankName: 'Askari Bank', accountNo: '0-6201-0057-9277' },
  { title: 'ZUYUFURRAHMAN HAJJ & UMRAH', bankName: 'BankIslami', accountNo: '1024-1054740-0001' },
  { title: 'ZUYUFURRAHMAN HAJJ & UMRAH', bankName: 'Samba Bank', accountNo: '2000632182' },
  { title: 'ZUYUFURRAHMAN HAJJ & UMRAH', bankName: 'Dubai Islamic Bank', accountNo: '0090-407414001' },
  { title: 'ZUYUFURRAHMAN HAJJ & UMRAH', bankName: 'HBL', accountNo: '00027900418555' },
  { title: 'ZUYUFURRAHMAN HAJJ & UMRAH', bankName: 'Bank AL Habib Ltd.', accountNo: '5023-0081-001151-01-5' },
  { title: 'ZUYUFURRAHMAN HAJJ & UMRAH', bankName: 'Meezan Bank', accountNo: '0105-0103805894' },
  { title: 'ZUYUFURRAHMAN HAJJ & UMRAH', bankName: 'BML (Summit Bank)', accountNo: '1-2-50-20311-714-151926' },
  { title: 'ZUYUFURRAHMAN HAJJ & UMRAH', bankName: 'UBL', accountNo: '0051-257589255' },
  { title: 'ZUYUFURRAHMAN HAJJ & UMRAH', bankName: 'Faysal Bank', accountNo: '3292301000000137' },
]

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
  hideBreakup = false,
  showCompanyDetails = true,
  companyDetails = null
}) {
  const safeHeaderSr = String(header?.sr_no || '01')
  const safeHeaderName = String(header?.name || 'CLIENT')
  const safeHeaderDate = String(header?.date || new Date().toISOString().slice(0, 10))

  const company = companyDetails || getActiveCompanyDetails()

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
      <div id="printable-color-package" className="bg-white text-slate-900 font-sans p-3 sm:p-4 space-y-2.5 rounded-xl border border-slate-200 shadow-sm min-w-[620px] text-left uppercase">
        
        {/* COMPANY DETAILS TOP HEADER (ADDRESS, LOGO, PHONE, EMAIL, WEBSITE) */}
        {showCompanyDetails !== false && company && (company.name || company.address || company.logoUrl) && (
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-xl p-3 shadow-md border border-slate-700/80 mb-1 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-left">
              {company.logoUrl ? (
                <img src={company.logoUrl} alt={company.name} className="h-10 sm:h-12 w-auto max-w-[140px] object-contain rounded-lg bg-white p-1 shadow-sm shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center shadow-md border border-white/20 shrink-0">
                  <i className="ti ti-building-hospital text-xl" />
                </div>
              )}
              <div>
                <h1 className="text-base sm:text-lg font-black text-white tracking-tight leading-none uppercase">
                  {company.name || 'COMPANY NAME'}
                </h1>
                {company.tagline && (
                  <p className="text-[10px] text-emerald-400 font-bold tracking-wide mt-0.5 uppercase">
                    {company.tagline}
                  </p>
                )}
                {company.address && (
                  <p className="text-[10px] text-slate-300 font-medium mt-0.5 leading-tight flex items-center gap-1 uppercase">
                    <i className="ti ti-map-pin text-emerald-400 text-xs shrink-0" />
                    <span>{company.address}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="text-right text-[10px] space-y-0.5 text-slate-300 border-l border-white/10 pl-3 shrink-0 uppercase font-medium">
              {company.phone && (
                <div className="flex items-center justify-end gap-1">
                  <i className="ti ti-phone text-emerald-400 text-xs" />
                  <span>{company.phone}</span>
                </div>
              )}
              {company.email && (
                <div className="flex items-center justify-end gap-1">
                  <i className="ti ti-mail text-emerald-400 text-xs" />
                  <span className="lowercase">{company.email}</span>
                </div>
              )}
              {company.website && (
                <div className="flex items-center justify-end gap-1 font-bold text-white">
                  <i className="ti ti-world text-emerald-400 text-xs" />
                  <span className="lowercase">{company.website}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Header Banner */}
        <div className="bg-slate-900 text-white rounded-xl p-3 shadow-md flex items-center justify-between gap-3 border border-slate-800">
          <div>
            <h2 className="text-lg font-black tracking-wide text-white flex items-center gap-2 leading-none">
              PACKAGE SUMMARY
            </h2>
          </div>

          <div className="flex gap-2">
            <div className="bg-white/10 backdrop-blur-md rounded-lg px-3 py-1 border border-white/15 text-center min-w-[70px]">
              <span className="block text-[9px] font-bold text-slate-300 uppercase tracking-wider">SR #</span>
              <span className="block text-xs font-extrabold text-white">{safeHeaderSr}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-xl px-3 py-1 border border-white/15 text-center min-w-[95px]">
              <span className="block text-[9px] font-bold text-slate-300 uppercase tracking-wider">CLIENT NAME</span>
              <span className="block text-xs font-extrabold text-white uppercase">{safeHeaderName}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-xl px-3 py-1 border border-white/15 text-center min-w-[90px]">
              <span className="block text-[9px] font-bold text-slate-300 uppercase tracking-wider">DATE</span>
              <span className="block text-xs font-extrabold text-white">{safeHeaderDate}</span>
            </div>
          </div>
        </div>

        {/* Passenger Breakdown */}
        <div className="space-y-1">
          <div className="bg-blue-50/80 text-blue-900 border-l-4 border-blue-600 rounded-r-lg px-2.5 py-1 flex items-center justify-between font-bold text-[11px] uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <i className="ti ti-users text-blue-600 text-sm" />
              PASSENGER BREAKDOWN
            </div>
          </div>
          <div className={`grid ${hideBreakup ? 'grid-cols-4' : 'grid-cols-5'} divide-x divide-slate-200 border border-slate-200 rounded-lg text-center bg-white shadow-xs overflow-hidden text-xs`}>
            <div className="p-1.5">
              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">ADULT (ADT)</span>
              <span className="block text-xs font-extrabold text-slate-800 mt-0.5">{pax?.adt ?? '0'}</span>
              {pax?.adt_price && !hideBreakup && <span className="block text-[9px] text-blue-600 font-bold">Fare: {pax.adt_price}</span>}
            </div>
            <div className="p-1.5">
              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">CHILD</span>
              <span className="block text-xs font-extrabold text-slate-800 mt-0.5">{pax?.child ?? '0'}</span>
              {pax?.child_price && !hideBreakup && <span className="block text-[9px] text-blue-600 font-bold">Fare: {pax.child_price}</span>}
            </div>
            <div className="p-1.5">
              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">INFANT</span>
              <span className="block text-xs font-extrabold text-slate-800 mt-0.5">{pax?.infant ?? '0'}</span>
              {pax?.infant_price && !hideBreakup && <span className="block text-[9px] text-blue-600 font-bold">Fare: {pax.infant_price}</span>}
            </div>
            <div className="p-1.5 bg-blue-50/40">
              <span className="block text-[9px] font-extrabold text-blue-800 uppercase tracking-wider">TOTAL PASSENGERS</span>
              <span className="block text-xs font-black text-blue-800 mt-0.5">{totalPax || 0}</span>
            </div>
            {!hideBreakup && (
              <div className="p-1.5 bg-blue-100/70">
                <span className="block text-[9px] font-black text-blue-950 uppercase tracking-wider">TOTAL FARE</span>
                <span className="block text-xs font-black text-blue-900 mt-0.5">{pax?.ticket_total || '0'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Flight Details (Multi-Line Dynamic Table) */}
        <div className="space-y-1">
          <div className="bg-blue-50/80 text-blue-900 border-l-4 border-blue-600 rounded-r-lg px-2.5 py-1 flex items-center justify-between font-bold text-[11px] uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <i className="ti ti-plane-departure text-blue-600 text-sm" />
              FLIGHT ITINERARY DETAILS ({finalFlights.length} {finalFlights.length === 1 ? 'LEG' : 'LEGS'})
            </div>
          </div>
          <div className="border border-slate-200 rounded-lg overflow-hidden shadow-xs bg-white text-xs">
            <div className="grid grid-cols-7 bg-slate-50 text-slate-500 font-bold p-1.5 text-[9px] uppercase tracking-wider border-b border-slate-200 text-center">
              <div className="col-span-1 text-center px-1">#</div>
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
                <div key={`fl-item-${idx}`} className="grid grid-cols-7 p-1.5 border-b border-slate-100 last:border-0 text-center items-center font-mono text-[11px]">
                  <div className="col-span-1 text-center font-sans">
                    <span className="text-[10px] font-black text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">
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
        <div className="space-y-1">
          <div className="bg-blue-50/80 text-blue-900 border-l-4 border-blue-600 rounded-r-lg px-2.5 py-1 flex items-center gap-1.5 font-bold text-[11px] uppercase tracking-wider">
            <i className="ti ti-id-badge text-blue-600 text-sm" />
            VISA DETAILS
          </div>
          <div className="border border-slate-200 rounded-lg overflow-hidden shadow-xs bg-white text-xs">
            <div className="grid grid-cols-3 bg-slate-50 text-slate-500 font-bold p-1.5 text-[9px] uppercase tracking-wider border-b border-slate-200">
              <div className="px-2.5">VISA TYPE</div>
              <div className="text-center">QUANTITY</div>
              <div className="text-right px-2.5">{hideBreakup ? '' : 'PRICE (PER VISA)'}</div>
            </div>
            <div className="grid grid-cols-3 p-1.5 items-center font-mono text-[11px]">
              <div className="px-2.5 font-extrabold text-slate-900 font-sans">{visa?.type || 'VISA'}</div>
              <div className="text-center font-bold text-slate-800">{visa?.qty || '0'}</div>
              <div className="text-right px-2.5 font-bold text-slate-800">{hideBreakup ? '' : (visa?.price || '0')}</div>
            </div>
          </div>
        </div>

        {/* Hotel Details */}
        <div className="space-y-1">
          <div className="bg-blue-50/80 text-blue-900 border-l-4 border-blue-600 rounded-r-lg px-2.5 py-1 flex items-center gap-1.5 font-bold text-[11px] uppercase tracking-wider">
            <i className="ti ti-building-skyscraper text-blue-600 text-sm" />
            HOTEL DETAILS
          </div>
          <div className="border border-slate-200 rounded-lg overflow-hidden shadow-xs bg-white text-xs">
            <div className="grid grid-cols-7 bg-slate-50 text-slate-500 font-bold p-1.5 text-[9px] uppercase tracking-wider border-b border-slate-200 text-center">
              <div className="col-span-2 text-left px-2.5">HOTEL NAME</div>
              <div className="col-span-1">QTY</div>
              <div className="col-span-1">TYPE</div>
              <div className="col-span-1">CHECK IN</div>
              <div className="col-span-1">CHECK OUT</div>
              <div className="col-span-1 text-right px-2.5">{hideBreakup ? 'NIGHTS' : 'NIGHTS / RATE'}</div>
            </div>

            {safeMakkahHotels.map((h, i) => (
              <div key={`col-mak-${i}`} className="grid grid-cols-7 p-1.5 border-b border-slate-100 text-center items-center font-mono text-[11px]">
                <div className="col-span-2 text-left px-2.5 font-sans">
                  <span className="block font-black text-slate-900 text-[11px] uppercase">{h?.hotel_name || '-'}</span>
                  <span className="text-[9px] text-amber-600 font-bold">Makkah Hotel</span>
                </div>
                <div className="col-span-1 font-bold text-slate-800">{h?.room_qty || '—'}</div>
                <div className="col-span-1 font-bold text-slate-800">{h?.room_type || '—'}</div>
                <div className="col-span-1 text-slate-700">{h?.check_in || '—'}</div>
                <div className="col-span-1 text-slate-700">{h?.check_out || '—'}</div>
                <div className="col-span-1 text-right px-2.5 font-extrabold text-slate-900">
                  {h?.nights || '0'} {hideBreakup ? 'Nights' : `/ ${h?.night_price || '0'}`}
                </div>
              </div>
            ))}

            {safeMadinaHotels.map((h, i) => (
              <div key={`col-med-${i}`} className="grid grid-cols-7 p-1.5 border-b border-slate-100 last:border-0 text-center items-center font-mono text-[11px]">
                <div className="col-span-2 text-left px-2.5 font-sans">
                  <span className="block font-black text-slate-900 text-[11px] uppercase">{h?.hotel_name || '-'}</span>
                  <span className="text-[9px] text-emerald-600 font-bold">Madina Hotel</span>
                </div>
                <div className="col-span-1 font-bold text-slate-800">{h?.room_qty || '—'}</div>
                <div className="col-span-1 font-bold text-slate-800">{h?.room_type || '—'}</div>
                <div className="col-span-1 text-slate-700">{h?.check_in || '—'}</div>
                <div className="col-span-1 text-slate-700">{h?.check_out || '—'}</div>
                <div className="col-span-1 text-right px-2.5 font-extrabold text-slate-900">
                  {h?.nights || '0'} {hideBreakup ? 'Nights' : `/ ${h?.night_price || '0'}`}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Transportation Details (Supports Multi-row transport) */}
        <div className="space-y-1">
          <div className="bg-blue-50/80 text-blue-900 border-l-4 border-blue-600 rounded-r-lg px-2.5 py-1 flex items-center gap-1.5 font-bold text-[11px] uppercase tracking-wider">
            <i className="ti ti-car text-blue-600 text-sm" />
            TRANSPORTATION DETAILS
          </div>
          <div className="border border-slate-200 rounded-lg overflow-hidden shadow-xs bg-white text-xs divide-y divide-slate-100">
            <div className="grid grid-cols-4 bg-slate-50 text-slate-500 font-bold p-1.5 text-[9px] uppercase tracking-wider border-b border-slate-200">
              <div className="px-2.5">TYPE</div>
              <div className="text-center">QTY</div>
              <div className="px-2.5">SECTOR / ROUTE</div>
              <div className="text-right px-2.5">{hideBreakup ? '' : 'PRICE'}</div>
            </div>
            {safeTransportList.map((t, idx) => (
              <div key={`col-trans-${idx}`} className="grid grid-cols-4 p-1.5 items-center font-mono text-[11px]">
                <div className="px-2.5 font-extrabold text-slate-900 font-sans">{t?.type || 'BY CAR'}</div>
                <div className="text-center font-bold text-slate-800">{t?.qty || '1'}</div>
                <div className="px-2.5 text-slate-800 font-bold">{t?.sector || 'JED ARPT - MAK - MED'}</div>
                <div className="text-right px-2.5 font-bold text-slate-800">{hideBreakup ? '' : (t?.price || '—')}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Total Amount Boxes */}
        <div className="space-y-1">
          <div className="bg-blue-50/80 text-blue-900 border-l-4 border-blue-600 rounded-r-lg px-2.5 py-1 flex items-center gap-1.5 font-bold text-[11px] uppercase tracking-wider">
            <i className="ti ti-cash text-blue-600 text-sm" />
            PACKAGE PRICING & TOTALS
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="bg-white border border-slate-200 rounded-lg p-2 text-center shadow-xs">
              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">TOTAL PACKAGE ONLY</span>
              <span className="block text-sm font-black text-slate-900 mt-0.5">{totals?.package_only || '-'}</span>
            </div>
            <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-2 text-center shadow-xs">
              <span className="block text-[9px] font-extrabold text-blue-700 uppercase tracking-wider">TOTAL PACKAGE WITH TICKET</span>
              <span className="block text-sm font-black text-blue-700 mt-0.5">{totals?.package_with_ticket || '-'}</span>
            </div>
          </div>
        </div>

        {/* Comment Box / Remarks */}
        <div className="space-y-1">
          <div className="bg-blue-50/80 text-blue-900 border-l-4 border-blue-600 rounded-r-lg px-2.5 py-1 flex items-center gap-1.5 font-bold text-[11px] uppercase tracking-wider">
            <i className="ti ti-message-dots text-blue-600 text-sm" />
            COMMENT BOX / SPECIAL REMARKS
          </div>
          <div className="bg-amber-50/60 border border-amber-200/80 rounded-lg p-2 text-[11px] text-amber-900 font-sans leading-snug">
            {typeof comments === 'string' && comments ? comments : 'All bookings confirmed as per schedule.'}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-[9px] text-slate-400 font-medium pt-1 border-t border-slate-100">
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

export function InvoicePdfTemplate({
  invoiceNo = 'INV-001',
  invoiceDate = new Date().toISOString().slice(0, 10),
  dueDate = '',
  clientName = 'CLIENT NAME',
  phone = '',
  whatsapp = '',
  email = '',
  ticketPassengers = [],
  visaPassengers = [],
  hotelItems = [],
  transportItems = [],
  items = [],
  payments = [],
  subtotal = 0,
  discount = 0,
  totalAmount = 0,
  amountPaid = 0,
  balanceDue = 0,
  status = 'UNPAID',
  paymentMethod = 'Bank Transfer',
  bankDetails = 'Meezan Bank - A/C 0102030405',
  remarks = '',
  hideBreakup = false
}) {
  const safePassengers = Array.isArray(ticketPassengers) ? ticketPassengers : []
  const safeVisas = Array.isArray(visaPassengers) ? visaPassengers : []
  const safeHotels = Array.isArray(hotelItems) ? hotelItems : []
  const safeTransports = Array.isArray(transportItems) ? transportItems : []
  const safeItems = Array.isArray(items) ? items : []
  const safePayments = Array.isArray(payments) ? payments : []

  // Computed section totals
  const ticketTotalSum = safePassengers.reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const visaTotalSum = safeVisas.reduce((sum, v) => sum + Number(v.amount || 0), 0)
  const hotelTotalSum = safeHotels.reduce((sum, h) => sum + Number(h.amount || 0), 0)
  const transportTotalSum = safeTransports.reduce((sum, t) => sum + Number(t.amount || 0), 0)
  const generalTotalSum = safeItems.reduce((sum, i) => sum + Number(i.amount || 0), 0)

  const grandSalesTotal = Number(totalAmount) || (ticketTotalSum + visaTotalSum + hotelTotalSum + transportTotalSum + generalTotalSum - Number(discount || 0))

  // Check if at least one passenger has a non-empty ticket number
  const hasTicketNumbers = safePassengers.some(p => p.ticketNo && p.ticketNo.trim() !== '' && p.ticketNo.trim() !== '-')
  const ticketSpanCols = hasTicketNumbers ? 3 : 2

  return (
    <div className="w-full overflow-x-auto max-w-4xl mx-auto p-1 sm:p-2">
      <div id="printable-invoice" className="bg-white text-slate-900 font-sans p-4 sm:p-6 space-y-4 rounded-xl border border-gray-300 shadow-sm min-w-[700px] text-left uppercase text-xs">
        
        {/* Header Block: Agency Brand & Title */}
        <div className="border-b border-gray-300 pb-3 flex items-start justify-between">
          <div className="space-y-0.5">
            <h1 className="text-xl font-black tracking-tight text-gray-900">Zuyufurrahman Hajj & Umrah</h1>
            <p className="text-[10px] text-gray-600 font-medium">
              Plot#17-C, Shop#4, Sunset Commercial Strt # 4, Phase-4, DHA, Karachi.
            </p>
            <p className="text-[10px] text-gray-600 font-mono">
              Phone: {phone || '021-35392220-21'} {whatsapp ? `; ${whatsapp}` : ''} | LICENSE NO: GL-3945
            </p>
          </div>
          <div className="text-right space-y-1">
            <h2 className="text-base font-bold text-gray-800 tracking-wide">Customer Account Statement</h2>
            <div className="text-[11px] font-bold text-gray-700">
              {invoiceDate} {dueDate ? `To ${dueDate}` : ''}
            </div>
            <div className="text-[10px] text-gray-500 font-mono">Print Date: {invoiceDate}</div>
          </div>
        </div>

        {/* Client Name & Statement Subheader */}
        <div className="bg-gray-100 p-2.5 rounded-lg border border-gray-200 flex items-center justify-between font-mono">
          <div>
            <span className="text-[10px] font-bold text-gray-500 uppercase block">BILLED ACCOUNT CLIENT</span>
            <span className="text-sm font-black text-gray-900 font-sans">{clientName || 'GUEST CLIENT'}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">STATEMENT / INVOICE #</span>
            <span className="text-xs font-extrabold text-blue-900">{invoiceNo}</span>
          </div>
        </div>

        {/* 1. TICKET BOOKING SECTION */}
        {safePassengers.length > 0 && (
          <div className="space-y-1">
            <div className="bg-gray-200 text-gray-900 px-3 py-1 font-bold text-[11px] uppercase tracking-wide border-b border-gray-400 flex items-center justify-between">
              <span>Ticket Booking</span>
              <span>{safePassengers.length} Ticket Leg(s)</span>
            </div>

            <table className="w-full text-[11px] text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-300 font-bold text-gray-700 text-[10px]">
                <tr>
                  <th className="p-1.5 w-20">DATE</th>
                  {hasTicketNumbers && <th className="p-1.5 w-36">TICKET NO.</th>}
                  <th className="p-1.5">PASSENGER NAME</th>
                  <th className="p-1.5 w-36">SECTOR</th>
                  {!hideBreakup && <th className="p-1.5 w-24 text-right">NET</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 font-mono">
                {safePassengers.map((p, idx) => (
                  <tr key={`tkt-pass-${idx}`} className="hover:bg-gray-50">
                    <td className="p-1.5 text-gray-600">{p.date || invoiceDate}</td>
                    {hasTicketNumbers && <td className="p-1.5 font-bold text-slate-800">{p.ticketNo || '-'}</td>}
                    <td className="p-1.5 font-black text-gray-900 font-sans">{p.passengerName || p.name || '-'}</td>
                    <td className="p-1.5 font-bold text-indigo-900">{p.sector || '-'}</td>
                    {!hideBreakup && (
                      <td className="p-1.5 text-right font-black text-gray-900">
                        {Number(p.amount || 0).toLocaleString()}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              {!hideBreakup && ticketTotalSum > 0 && (
                <tfoot className="border-t-2 border-gray-300 font-bold bg-gray-50 text-[10px]">
                  <tr>
                    <td colSpan={ticketSpanCols} className="p-1.5 text-right font-black">TICKET BOOKINGS TOTAL:</td>
                    <td className="p-1.5 text-right font-black text-slate-900">{ticketTotalSum.toLocaleString()}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* 2. VISA SECTION (ALL PASSENGER NAMES WITH VISA TYPE) */}
        {safeVisas.length > 0 && (
          <div className="space-y-1">
            <div className="bg-gray-200 text-gray-900 px-3 py-1 font-bold text-[11px] uppercase tracking-wide border-b border-gray-400 flex items-center justify-between">
              <span>Visa Processing</span>
              <span>{safeVisas.length} Visa(s)</span>
            </div>

            <table className="w-full text-[11px] text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-300 font-bold text-gray-700 text-[10px]">
                <tr>
                  <th className="p-1.5 w-20">DATE</th>
                  <th className="p-1.5">PASSENGER NAME</th>
                  <th className="p-1.5 w-48">VISA TYPE / DETAILS</th>
                  {!hideBreakup && <th className="p-1.5 w-24 text-right">NET</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 font-mono">
                {safeVisas.map((v, idx) => (
                  <tr key={`visa-pass-${idx}`} className="hover:bg-gray-50">
                    <td className="p-1.5 text-gray-600">{v.date || invoiceDate}</td>
                    <td className="p-1.5 font-black text-gray-900 font-sans">{v.passengerName || v.pax || clientName}</td>
                    <td className="p-1.5 font-bold text-emerald-900">{v.visaType || v.type || 'UMRAH VISA'}</td>
                    {!hideBreakup && (
                      <td className="p-1.5 text-right font-black text-gray-900">
                        {Number(v.amount || 0).toLocaleString()}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              {!hideBreakup && visaTotalSum > 0 && (
                <tfoot className="border-t-2 border-gray-300 font-bold bg-gray-50 text-[10px]">
                  <tr>
                    <td colSpan={2} className="p-1.5 text-right font-black">VISA TOTAL:</td>
                    <td className="p-1.5 text-right font-black text-slate-900">{visaTotalSum.toLocaleString()}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* 3. HOTEL SECTION (HOTEL NAME & ROOM DETAILS - NO PASSENGER NAMES) */}
        {safeHotels.length > 0 && (
          <div className="space-y-1">
            <div className="bg-gray-200 text-gray-900 px-3 py-1 font-bold text-[11px] uppercase tracking-wide border-b border-gray-400 flex items-center justify-between">
              <span>Hotel Accommodation</span>
              <span>{safeHotels.length} Hotel Booking(s)</span>
            </div>

            <table className="w-full text-[11px] text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-300 font-bold text-gray-700 text-[10px]">
                <tr>
                  <th className="p-1.5 w-20">DATE</th>
                  <th className="p-1.5">HOTEL NAME & ROOM DETAILS</th>
                  <th className="p-1.5 w-44 text-center">CHECK IN - CHECK OUT</th>
                  <th className="p-1.5 w-16 text-center">NIGHTS</th>
                  {!hideBreakup && <th className="p-1.5 w-24 text-right">NET</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 font-mono">
                {safeHotels.map((h, idx) => (
                  <tr key={`hotel-item-${idx}`} className="hover:bg-gray-50">
                    <td className="p-1.5 text-gray-600">{h.date || invoiceDate}</td>
                    <td className="p-1.5 font-bold text-gray-900 font-sans">
                      {h.hotelName || h.description || 'HOTEL ACCOMMODATION'}
                      {h.roomType ? ` (${h.roomQty || 1} x ${h.roomType})` : ''}
                    </td>
                    <td className="p-1.5 text-center text-gray-700">{h.checkIn && h.checkOut ? `${h.checkIn} - ${h.checkOut}` : '-'}</td>
                    <td className="p-1.5 text-center font-bold">{h.nights || 1}</td>
                    {!hideBreakup && (
                      <td className="p-1.5 text-right font-black text-gray-900">
                        {Number(h.amount || 0).toLocaleString()}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              {!hideBreakup && hotelTotalSum > 0 && (
                <tfoot className="border-t-2 border-gray-300 font-bold bg-gray-50 text-[10px]">
                  <tr>
                    <td colSpan={4} className="p-1.5 text-right font-black">HOTEL ACCOMMODATION TOTAL:</td>
                    <td className="p-1.5 text-right font-black text-slate-900">{hotelTotalSum.toLocaleString()}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* 4. TRANSPORT SECTION (SECTOR & VEHICLE TYPE ONLY - NO PASSENGER NAMES) */}
        {safeTransports.length > 0 && (
          <div className="space-y-1">
            <div className="bg-gray-200 text-gray-900 px-3 py-1 font-bold text-[11px] uppercase tracking-wide border-b border-gray-400 flex items-center justify-between">
              <span>Transportation</span>
              <span>{safeTransports.length} Transport Booking(s)</span>
            </div>

            <table className="w-full text-[11px] text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-300 font-bold text-gray-700 text-[10px]">
                <tr>
                  <th className="p-1.5 w-20">DATE</th>
                  <th className="p-1.5">VEHICLE TYPE & SECTOR</th>
                  <th className="p-1.5 w-16 text-center">QTY</th>
                  {!hideBreakup && <th className="p-1.5 w-24 text-right">NET</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 font-mono">
                {safeTransports.map((t, idx) => (
                  <tr key={`trans-item-${idx}`} className="hover:bg-gray-50">
                    <td className="p-1.5 text-gray-600">{t.date || invoiceDate}</td>
                    <td className="p-1.5 font-bold text-gray-900 font-sans">
                      {t.vehicleType || t.description || 'TRANSPORTATION SERVICES'} {t.sector ? ` (${t.sector})` : ''}
                    </td>
                    <td className="p-1.5 text-center font-bold">{t.qty || 1}</td>
                    {!hideBreakup && (
                      <td className="p-1.5 text-right font-black text-gray-900">
                        {Number(t.amount || 0).toLocaleString()}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              {!hideBreakup && transportTotalSum > 0 && (
                <tfoot className="border-t-2 border-gray-300 font-bold bg-gray-50 text-[10px]">
                  <tr>
                    <td colSpan={3} className="p-1.5 text-right font-black">TRANSPORT TOTAL:</td>
                    <td className="p-1.5 text-right font-black text-slate-900">{transportTotalSum.toLocaleString()}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* 5. GENERAL / OTHER BOOKING SECTION (Fallback items) */}
        {safeItems.length > 0 && (
          <div className="space-y-1">
            <div className="bg-gray-200 text-gray-900 px-3 py-1 font-bold text-[11px] uppercase tracking-wide border-b border-gray-400 flex items-center justify-between">
              <span>General / Other Booking</span>
              <span>{safeItems.length} Service(s)</span>
            </div>

            <table className="w-full text-[11px] text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-300 font-bold text-gray-700 text-[10px]">
                <tr>
                  <th className="p-1.5 w-20">DATE</th>
                  <th className="p-1.5 w-36">PAX / PASSENGER</th>
                  <th className="p-1.5">REMARKS / PARTICULAR SERVICE</th>
                  <th className="p-1.5 w-24">TXN DATE</th>
                  {!hideBreakup && <th className="p-1.5 w-24 text-right">NET</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 font-mono">
                {safeItems.map((item, idx) => (
                  <tr key={`gen-item-${idx}`} className="hover:bg-gray-50">
                    <td className="p-1.5 text-gray-600">{item.date || invoiceDate}</td>
                    <td className="p-1.5 font-bold text-gray-800 font-sans">{item.pax || clientName}</td>
                    <td className="p-1.5 font-bold text-gray-900 font-sans">{item.description || item.remarks || '-'}</td>
                    <td className="p-1.5 text-gray-600">{item.txnDate || invoiceDate}</td>
                    {!hideBreakup && (
                      <td className="p-1.5 text-right font-black text-gray-900">
                        {Number(item.amount || 0).toLocaleString()}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              {!hideBreakup && (
                <tfoot className="border-t-2 border-gray-300 font-bold bg-gray-50 text-[10px]">
                  <tr>
                    <td colSpan={4} className="p-1.5 text-right font-black">GENERAL BOOKINGS TOTAL:</td>
                    <td className="p-1.5 text-right font-black text-slate-900">{generalTotalSum.toLocaleString()}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* 3. VOUCHERS / RECEIPTS SECTION (Payments Received) */}
        <div className="space-y-1">
          <div className="bg-gray-200 text-gray-900 px-3 py-1 font-bold text-[11px] uppercase tracking-wide border-b border-gray-400 flex items-center justify-between">
            <span>Vouchers / Payments Received</span>
            <span>{safePayments.length || (Number(amountPaid) > 0 ? 1 : 0)} Receipt(s)</span>
          </div>

          <table className="w-full text-[11px] text-left border-collapse">
            <thead className="bg-gray-50 border-b border-gray-300 font-bold text-gray-700 text-[10px]">
              <tr>
                <th className="p-1.5 w-20">DATE</th>
                <th className="p-1.5 w-24">VOUCHER NO.</th>
                <th className="p-1.5">REFERENCE / DESCRIPTION</th>
                <th className="p-1.5 w-28">METHOD</th>
                <th className="p-1.5 w-20 text-right">DEBIT</th>
                <th className="p-1.5 w-24 text-right">CREDIT (PAID)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 font-mono">
              {safePayments.length > 0 ? (
                safePayments.map((pm, idx) => (
                  <tr key={`rcpt-${idx}`}>
                    <td className="p-1.5 text-gray-600">{pm.date || invoiceDate}</td>
                    <td className="p-1.5 font-bold text-blue-900">{pm.voucherNo || `RV-${idx + 101}`}</td>
                    <td className="p-1.5 font-sans font-medium">{pm.description || 'PAYMENT RECEIVED'}</td>
                    <td className="p-1.5 font-bold">{pm.paymentMethod || paymentMethod || 'CASH'}</td>
                    <td className="p-1.5 text-right text-gray-500">0.0</td>
                    <td className="p-1.5 text-right font-black text-emerald-800">{Number(pm.amount || 0).toLocaleString()}</td>
                  </tr>
                ))
              ) : Number(amountPaid) > 0 ? (
                <tr>
                  <td className="p-1.5 text-gray-600">{invoiceDate}</td>
                  <td className="p-1.5 font-bold text-blue-900">RV-1001</td>
                  <td className="p-1.5 font-sans font-medium">PARTIAL / ADVANCE PAYMENT RECEIVED</td>
                  <td className="p-1.5 font-bold">{paymentMethod || 'CASH'}</td>
                  <td className="p-1.5 text-right text-gray-500">0.0</td>
                  <td className="p-1.5 text-right font-black text-emerald-800">{Number(amountPaid).toLocaleString()}</td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={6} className="p-2 text-center text-gray-400 italic">
                    No payment receipts / vouchers recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 4. NET BALANCE STATEMENT SUMMARY BOX (Exact match to Travelport layout) */}
        <div className="flex justify-end pt-2">
          <div className="w-full sm:w-80 border border-gray-400 rounded-lg overflow-hidden bg-white text-xs font-mono">
            <div className="flex justify-between p-1.5 px-3 border-b border-gray-200 text-gray-600 font-bold">
              <span>Opening Balance B/F</span>
              <span>0.0</span>
            </div>
            <div className="flex justify-between p-1.5 px-3 border-b border-gray-200 text-gray-900 font-bold">
              <span>Add Sale Invoices</span>
              <span>{grandSalesTotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between p-1.5 px-3 border-b border-gray-200 text-emerald-800 font-bold">
              <span>Less Receipts (Paid)</span>
              <span>{Number(amountPaid).toLocaleString()}</span>
            </div>
            <div className={`flex justify-between p-2 px-3 font-black text-sm ${Number(balanceDue) > 0 ? 'bg-red-50 text-red-700 border-t-2 border-red-400' : 'bg-emerald-50 text-emerald-800'}`}>
              <span>Net Balance</span>
              <span>{Number(balanceDue).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Special Remarks footer if provided */}
        {remarks && (
          <div className="border border-gray-200 bg-gray-50 rounded-lg p-2.5 text-[10px] font-mono">
            <span className="font-bold text-gray-700">TERMS & REMARKS:</span> {remarks}
          </div>
        )}

        {/* Statement Footer Page 1 */}
        <div className="flex items-center justify-end text-[10px] text-gray-400 font-medium pt-2 border-t border-gray-200">
          <span>Page 1 of 2</span>
        </div>

        {/* ── PAGE 2: OFFICIAL BANK ACCOUNT DETAILS ── */}
        <div 
          className="pt-6 border-t-2 border-dashed border-gray-300 space-y-4 print:pt-4"
          style={{ pageBreakBefore: 'always', breakBefore: 'page' }}
        >
          {/* Header Block */}
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-400/20 to-amber-500/10 border border-amber-300/80 rounded-xl p-4 text-center space-y-1.5 shadow-xs">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-b border-amber-200/80 pb-2">
              <h2 className="text-lg font-black text-slate-900 font-sans tracking-tight">
                ZUYUFUR RAHMAN HAJJ & UMRAH
              </h2>
              <span className="text-sm font-bold text-amber-900 font-serif">ضيوف الرحمن للحج والعمرة</span>
            </div>
            <h3 className="text-sm font-black tracking-widest text-amber-950 uppercase pt-1">
              OFFICIAL BANK ACCOUNT DETAILS
            </h3>
          </div>

          {/* Accounts Directory Table */}
          <div className="border border-slate-300 rounded-xl overflow-hidden shadow-xs bg-white">
            <table className="w-full text-xs text-left border-collapse font-sans">
              <thead className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-2 w-10 text-center">#</th>
                  <th className="p-2">ACCOUNT TITLE</th>
                  <th className="p-2 w-44">BANK NAME</th>
                  <th className="p-2 w-52 font-mono text-right">ACCOUNT NUMBER</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                {BANK_DETAILS_LIST.map((bank, idx) => (
                  <tr key={`bank-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-amber-50/20'}>
                    <td className="p-2 text-center font-bold text-slate-400">{idx + 1}</td>
                    <td className="p-2 font-black text-slate-900 font-sans">{bank.title}</td>
                    <td className="p-2 font-bold text-indigo-950 font-sans flex items-center gap-1.5">
                      <i className="ti ti-building-bank text-amber-600 text-sm" />
                      {bank.bankName}
                    </td>
                    <td className="p-2 text-right font-black text-slate-900 tracking-wider font-mono">
                      {bank.accountNo}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Deposit Slip Reminder Note */}
          <div className="bg-amber-100/60 border-2 border-amber-300 rounded-xl p-3 text-center shadow-xs">
            <p className="text-xs font-black text-amber-950 uppercase tracking-wide flex items-center justify-center gap-2">
              <i className="ti ti-alert-circle text-amber-700 text-base" />
              Note: Please, must share the deposit slip.
            </p>
          </div>

          {/* Statement Footer Page 2 */}
          <div className="flex items-center justify-end text-[10px] text-gray-400 font-medium pt-2 border-t border-gray-200">
            <span>Page 2 of 2</span>
          </div>
        </div>

      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 🎫 E-TICKET PASSENGER ITINERARY TEMPLATE (ID 420)
// ─────────────────────────────────────────────────────────────────────────────
export function ETicketPdfTemplate({
  companyDetails = null,
  header = {},
  pax = {},
  totalPax = 0,
  flightItinerary = [],
  passengerList = [],
  pnr = '',
  mode = 'grouped' // 'grouped' or 'separate'
}) {
  const company = companyDetails || getActiveCompanyDetails()
  const safeHeaderName = String(header?.name || 'PASSENGER / CLIENT')
  const safeHeaderDate = String(header?.date || new Date().toISOString().slice(0, 10))
  const pnrFromFlight = Array.isArray(flightItinerary) ? flightItinerary.find(f => f?.pnr)?.pnr : ''
  const safePnr = String(pnr || header?.pnr || pnrFromFlight || 'PNR-CONFIRMED').toUpperCase()

  // Format flight list
  const flights = Array.isArray(flightItinerary) && flightItinerary.length > 0
    ? flightItinerary
    : [
        { type: 'DEPARTURE', airline: 'SV', flight_no: '701', sector: 'KHI - JED', date: '05 MAR 2026', dep_time: '09:20', arr_time: '11:15', class_type: 'Y', baggage: '30KG' },
        { type: 'RETURN', airline: 'SV', flight_no: '702', sector: 'JED - KHI', date: '20 MAR 2026', dep_time: '14:30', arr_time: '20:10', class_type: 'Y', baggage: '30KG' }
      ]

  // Format passenger list
  const rawPaxList = Array.isArray(passengerList) && passengerList.length > 0
    ? passengerList
    : [safeHeaderName]

  const adtCount = Number(pax?.adt || 0)
  const childCount = Number(pax?.child || 0)
  const infantCount = Number(pax?.infant || 0)

  const formattedPassengers = rawPaxList.map((p, idx) => {
    const pName = typeof p === 'string' ? p : (p.name || p.passengerName || safeHeaderName)
    
    // Determine passenger type (ADT, CHD, INF)
    let pType = 'ADT'
    if (typeof p === 'object' && p !== null && (p.type || p.passengerType)) {
      pType = p.type || p.passengerType
    } else if (/INFANT|BABY|\(INF\)/i.test(pName)) {
      pType = 'INF'
    } else if (/\(CHD\)|CHILD/i.test(pName)) {
      pType = 'CHD'
    } else if (adtCount > 0 || childCount > 0 || infantCount > 0) {
      if (idx < adtCount) {
        pType = 'ADT'
      } else if (idx < adtCount + childCount) {
        pType = 'CHD'
      } else if (idx < adtCount + childCount + infantCount) {
        pType = 'INF'
      }
    }

    if (typeof p === 'string') {
      return { 
        name: pName, 
        passport_no: 'A' + (1029384 + idx), 
        ticket_no: '176-5580-274-' + (600 + idx), 
        gender: 'M/F', 
        type: pType 
      }
    }
    return {
      name: pName,
      passport_no: p.passport_no || p.passportNo || ('P' + (100000 + idx)),
      ticket_no: p.ticket_no || p.ticketNo || ('176-5580-274-' + (600 + idx)),
      gender: p.gender || 'M/F',
      type: p.type || pType
    }
  })

  const renderSingleTicket = (singlePax = null, ticketIndex = 0, isPageBreak = false) => {
    const activePaxName = singlePax ? (singlePax.name || singlePax) : safeHeaderName
    const activeTicketNo = singlePax?.ticket_no || ('176-5580-274-' + (600 + ticketIndex))

    return (
      <div 
        key={`eticket-page-${ticketIndex}`}
        className={`bg-white text-slate-900 font-sans p-4 sm:p-6 space-y-4 rounded-xl border border-slate-300 shadow-sm uppercase ${isPageBreak ? 'print:pt-6' : ''}`}
        style={isPageBreak ? { pageBreakBefore: 'always', breakBefore: 'page' } : {}}
      >
        {/* Company Header */}
        {company && (
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-xl p-3.5 shadow-md border border-slate-700 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {company.logoUrl ? (
                <img src={company.logoUrl} alt={company.name} className="h-12 w-auto max-w-[150px] object-contain rounded-lg bg-white p-1" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xl">
                  ✈️
                </div>
              )}
              <div>
                <h1 className="text-base sm:text-lg font-black text-white leading-none">
                  {company.name || 'ZUYUFURRAHMAN HAJJ & UMRAH'}
                </h1>
                {company.tagline && <p className="text-[10px] text-emerald-400 font-bold mt-0.5">{company.tagline}</p>}
                {company.address && <p className="text-[10px] text-slate-300 font-medium mt-0.5">{company.address}</p>}
              </div>
            </div>
            <div className="text-right text-[10px] text-slate-300 font-medium border-l border-white/10 pl-3">
              {company.phone && <div>📞 {company.phone}</div>}
              {company.email && <div>✉️ {company.email}</div>}
              {company.website && <div className="text-emerald-400 font-bold">{company.website}</div>}
            </div>
          </div>
        )}

        {/* Title Banner */}
        <div className="bg-indigo-900 text-white p-2.5 rounded-lg flex items-center justify-between px-4">
          <div>
            <h2 className="text-sm font-black tracking-wide flex items-center gap-2">
              <span>✈️ ELECTRONIC TICKET PASSENGER ITINERARY</span>
            </h2>
            <p className="text-[10px] text-indigo-200">Official Flight Booking Confirmation</p>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-md">STATUS: CONFIRMED</span>
          </div>
        </div>

        {/* Booking Reference & Lead Guest Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs font-mono">
          <div>
            <span className="text-[9px] font-bold text-slate-400 block">BOOKING REF / PNR</span>
            <span className="font-black text-indigo-900 text-sm">{safePnr}</span>
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 block">PASSENGER NAME</span>
            <span className="font-bold text-slate-900">{activePaxName}</span>
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 block">TICKET NUMBER</span>
            <span className="font-bold text-slate-800">{activeTicketNo}</span>
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 block">ISSUE DATE</span>
            <span className="font-bold text-slate-800">{safeHeaderDate}</span>
          </div>
        </div>

        {/* Flight Itinerary Table */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-800 border-b border-slate-200 pb-1">
            <span>FLIGHT SCHEDULE & ITINERARY</span>
            <span className="text-[10px] font-normal text-slate-500">All times are local</span>
          </div>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-800 text-white font-bold text-[10px]">
                <tr>
                  <th className="p-2">AIRLINE / FLIGHT</th>
                  <th className="p-2">SECTOR</th>
                  <th className="p-2">DATE</th>
                  <th className="p-2">DEP TIME</th>
                  <th className="p-2">ARR TIME</th>
                  <th className="p-2 text-center">CLASS</th>
                  <th className="p-2 text-center">BAGGAGE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                {flights.map((f, fIdx) => (
                  <tr key={`f-row-${fIdx}`} className={fIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="p-2 font-bold text-indigo-950">
                      {f.airline || 'AIRLINE'} {f.flight_no || f.flightNo || ''}
                    </td>
                    <td className="p-2 font-black text-slate-900">{f.sector || 'KHI - JED'}</td>
                    <td className="p-2 text-slate-800">{f.date || '05 MAR'}</td>
                    <td className="p-2 font-bold text-emerald-800">{f.dep_time || f.depTime || '--:--'}</td>
                    <td className="p-2 font-bold text-slate-700">{f.arr_time || f.arrTime || '--:--'}</td>
                    <td className="p-2 text-center font-bold">{f.class_type || f.classType || 'Y'}</td>
                    <td className="p-2 text-center font-bold text-slate-600">{f.baggage || '30KG'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Passenger List Table (If grouped mode) */}
        {mode === 'grouped' && (
          <div className="space-y-1.5 pt-2">
            <div className="text-xs font-bold text-slate-800 border-b border-slate-200 pb-1">
              PASSENGER DETAILS ({formattedPassengers.length})
            </div>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-indigo-50 text-indigo-950 font-bold text-[10px]">
                  <tr>
                    <th className="p-2 w-8 text-center">#</th>
                    <th className="p-2">PASSENGER NAME</th>
                    <th className="p-2">PASSPORT NO</th>
                    <th className="p-2">TICKET NO</th>
                    <th className="p-2 text-center">TYPE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                  {formattedPassengers.map((p, pIdx) => (
                    <tr key={`p-pax-${pIdx}`} className={pIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="p-2 text-center text-slate-400 font-bold">{pIdx + 1}</td>
                      <td className="p-2 font-black text-slate-900">{p.name}</td>
                      <td className="p-2 font-bold text-slate-700">{p.passport_no}</td>
                      <td className="p-2 font-bold text-indigo-900">{p.ticket_no}</td>
                      <td className="p-2 text-center font-bold text-emerald-800">{p.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Important Terms & Conditions */}
        <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 text-[10px] space-y-1 text-slate-700">
          <p className="font-bold text-amber-950 uppercase flex items-center gap-1">
            <span>⚠️ IMPORTANT TRAVEL NOTICE & AIRPORT RULES:</span>
          </p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Please report at the airport check-in counter at least 3-4 hours prior to scheduled flight departure.</li>
            <li>Passport must be valid for at least 6 months from the date of travel with valid visas attached.</li>
            <li>Baggage allowance strictly according to airline policy. Hand baggage must not exceed 7KG.</li>
          </ul>
        </div>
      </div>
    )
  }

  if (mode === 'separate' && formattedPassengers.length > 1) {
    return (
      <div className="w-full max-w-4xl mx-auto space-y-6">
        {formattedPassengers.map((p, i) => renderSingleTicket(p, i, i > 0))}
      </div>
    )
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      {renderSingleTicket(null, 0, false)}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 🏨 HOTEL ACCOMMODATION VOUCHER TEMPLATE (ID 420)
// ─────────────────────────────────────────────────────────────────────────────
export function HotelVoucherPdfTemplate({
  companyDetails = null,
  header = {},
  leadGuestName = '',
  paxSummary = {},
  makkahHotels = [],
  madinaHotels = [],
  hcnMakkah = '',
  hcnMadina = '',
  voucherNo = '',
  comments = ''
}) {
  const company = companyDetails || getActiveCompanyDetails()
  const safeClient = String(leadGuestName || header?.name || 'VALUED CLIENT').toUpperCase()
  const safeDate = String(header?.date || new Date().toISOString().slice(0, 10))
  const safeVoucherNo = String(voucherNo || (header?.sr_no ? `HV-${header.sr_no}` : 'HV-1001')).toUpperCase()

  const mList = Array.isArray(makkahHotels) && makkahHotels.length > 0
    ? makkahHotels
    : [{ hotel_name: 'Makkah Hotel', check_in: '10-MAR-2026', check_out: '15-MAR-2026', nights: 5, room_type: 'Double Room', room_qty: 1 }]

  const madList = Array.isArray(madinaHotels) && madinaHotels.length > 0
    ? madinaHotels
    : [{ hotel_name: 'Madina Hotel', check_in: '15-MAR-2026', check_out: '20-MAR-2026', nights: 5, room_type: 'Double Room', room_qty: 1 }]

  return (
    <div className="w-full max-w-4xl mx-auto p-1 sm:p-2">
      <div id="printable-hotel-voucher" className="bg-white text-slate-900 font-sans p-4 sm:p-6 space-y-4 rounded-xl border border-slate-300 shadow-sm text-left uppercase">
        
        {/* Company Header */}
        {company && (
          <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-900 text-white rounded-xl p-3.5 shadow-md border border-emerald-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {company.logoUrl ? (
                <img src={company.logoUrl} alt={company.name} className="h-12 w-auto max-w-[150px] object-contain rounded-lg bg-white p-1" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-bold text-xl">
                  🏨
                </div>
              )}
              <div>
                <h1 className="text-base sm:text-lg font-black text-white leading-none">
                  {company.name || 'ZUYUFURRAHMAN HAJJ & UMRAH'}
                </h1>
                {company.tagline && <p className="text-[10px] text-emerald-400 font-bold mt-0.5">{company.tagline}</p>}
                {company.address && <p className="text-[10px] text-slate-300 font-medium mt-0.5">{company.address}</p>}
              </div>
            </div>
            <div className="text-right text-[10px] text-slate-300 font-medium border-l border-white/10 pl-3">
              {company.phone && <div>📞 {company.phone}</div>}
              {company.email && <div>✉️ {company.email}</div>}
              {company.website && <div className="text-emerald-400 font-bold">{company.website}</div>}
            </div>
          </div>
        )}

        {/* Title Banner */}
        <div className="bg-emerald-900 text-white p-2.5 rounded-lg flex items-center justify-between px-4">
          <h2 className="text-sm font-black tracking-wide flex items-center gap-2">
            <span>🏨 OFFICIAL HOTEL ACCOMMODATION VOUCHER</span>
          </h2>
          <span className="text-[10px] font-bold bg-white text-emerald-900 px-2.5 py-0.5 rounded-md">STATUS: CONFIRMED</span>
        </div>

        {/* Lead Guest & Voucher Details Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-emerald-50/50 p-3 rounded-lg border border-emerald-200 text-xs font-mono">
          <div>
            <span className="text-[9px] font-bold text-slate-500 block">LEAD GUEST NAME</span>
            <span className="font-black text-emerald-950 text-sm">{safeClient}</span>
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-500 block">VOUCHER NO</span>
            <span className="font-bold text-slate-900">{safeVoucherNo}</span>
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-500 block">TOTAL PAX</span>
            <span className="font-bold text-slate-800">
              {paxSummary.adt || 1} ADT {paxSummary.child ? `/ ${paxSummary.child} CHD` : ''}
            </span>
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-500 block">ISSUE DATE</span>
            <span className="font-bold text-slate-800">{safeDate}</span>
          </div>
        </div>

        {/* Makkah Hotels Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-black text-emerald-900 border-b border-emerald-200 pb-1">
            <span>🕋 MAKKAH AL MUKARRAMAH ACCOMMODATION</span>
            {hcnMakkah && <span className="text-xs bg-emerald-100 text-emerald-950 px-2 py-0.5 rounded font-mono font-bold">HCN #: {hcnMakkah}</span>}
          </div>
          <div className="border border-emerald-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-emerald-800 text-white font-bold text-[10px]">
                <tr>
                  <th className="p-2">HOTEL NAME</th>
                  <th className="p-2">CHECK IN</th>
                  <th className="p-2">CHECK OUT</th>
                  <th className="p-2 text-center">NIGHTS</th>
                  <th className="p-2">ROOM TYPE & QTY</th>
                  <th className="p-2 font-mono">HCN / RESERVATION NO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100 font-mono text-[11px]">
                {mList.map((h, i) => (
                  <tr key={`m-h-${i}`} className="bg-white">
                    <td className="p-2.5 font-black text-emerald-950">{h.hotel_name || h.hotelName || 'MAKKAH HOTEL'}</td>
                    <td className="p-2.5 font-bold text-slate-800">{h.check_in || h.checkIn || '--'}</td>
                    <td className="p-2.5 font-bold text-slate-800">{h.check_out || h.checkOut || '--'}</td>
                    <td className="p-2.5 text-center font-bold text-emerald-800">{h.nights || 0} NIGHTS</td>
                    <td className="p-2.5 font-bold text-slate-700">{h.room_qty || 1} x {h.room_type || 'STANDARD'}</td>
                    <td className="p-2.5 font-bold text-indigo-900 font-mono">{h.hcn || hcnMakkah || 'CONFIRMED'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Madina Hotels Section */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-xs font-black text-emerald-900 border-b border-emerald-200 pb-1">
            <span>🕌 MADINA AL MUNAWWARAH ACCOMMODATION</span>
            {hcnMadina && <span className="text-xs bg-emerald-100 text-emerald-950 px-2 py-0.5 rounded font-mono font-bold">HCN #: {hcnMadina}</span>}
          </div>
          <div className="border border-emerald-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-emerald-800 text-white font-bold text-[10px]">
                <tr>
                  <th className="p-2">HOTEL NAME</th>
                  <th className="p-2">CHECK IN</th>
                  <th className="p-2">CHECK OUT</th>
                  <th className="p-2 text-center">NIGHTS</th>
                  <th className="p-2">ROOM TYPE & QTY</th>
                  <th className="p-2 font-mono">HCN / RESERVATION NO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100 font-mono text-[11px]">
                {madList.map((h, i) => (
                  <tr key={`mad-h-${i}`} className="bg-white">
                    <td className="p-2.5 font-black text-emerald-950">{h.hotel_name || h.hotelName || 'MADINA HOTEL'}</td>
                    <td className="p-2.5 font-bold text-slate-800">{h.check_in || h.checkIn || '--'}</td>
                    <td className="p-2.5 font-bold text-slate-800">{h.check_out || h.checkOut || '--'}</td>
                    <td className="p-2.5 text-center font-bold text-emerald-800">{h.nights || 0} NIGHTS</td>
                    <td className="p-2.5 font-bold text-slate-700">{h.room_qty || 1} x {h.room_type || 'STANDARD'}</td>
                    <td className="p-2.5 font-bold text-indigo-900 font-mono">{h.hcn || hcnMadina || 'CONFIRMED'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Comments / Meal Inclusions */}
        {comments && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs">
            <span className="font-bold text-slate-700">SPECIAL INSTRUCTIONS / MEAL PLAN:</span> {comments}
          </div>
        )}

        {/* Hotel Terms */}
        <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-3 text-[10px] space-y-1 text-slate-700">
          <p className="font-bold text-emerald-950">📌 HOTEL CHECK-IN POLICIES & TERMS:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Standard Hotel Check-In time is 16:00 (4:00 PM) and Check-Out time is 12:00 (12:00 PM).</li>
            <li>Original Passport / Saudi National ID must be presented at the hotel reception desk upon arrival.</li>
            <li>Hotel Reservation Numbers (HCN) are non-transferable and guaranteed by the issuing travel provider.</li>
          </ul>
        </div>

      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 🚌 TRANSPORTATION VOUCHER TEMPLATE (ID 420)
// ─────────────────────────────────────────────────────────────────────────────
export function TransportVoucherPdfTemplate({
  companyDetails = null,
  header = {},
  leadGuestName = '',
  paxSummary = {},
  transportRows = [],
  driverContact = '',
  voucherNo = '',
  comments = ''
}) {
  const company = companyDetails || getActiveCompanyDetails()
  const safeClient = String(leadGuestName || header?.name || 'VALUED CLIENT').toUpperCase()
  const safeDate = String(header?.date || new Date().toISOString().slice(0, 10))
  const safeVoucherNo = String(voucherNo || (header?.sr_no ? `TV-${header.sr_no}` : 'TV-1001')).toUpperCase()

  const tList = Array.isArray(transportRows) && transportRows.length > 0
    ? transportRows
    : [{ type: 'PRIVATE GMC YUKON', qty: 1, sector: 'JED AIRPORT -> MAKKAH HOTEL -> MADINA HOTEL -> JED AIRPORT', date: safeDate, driver: driverContact || 'COORDINATOR ON ARRIVAL' }]

  return (
    <div className="w-full max-w-4xl mx-auto p-1 sm:p-2">
      <div id="printable-transport-voucher" className="bg-white text-slate-900 font-sans p-4 sm:p-6 space-y-4 rounded-xl border border-slate-300 shadow-sm text-left uppercase">
        
        {/* Company Header */}
        {company && (
          <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white rounded-xl p-3.5 shadow-md border border-blue-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {company.logoUrl ? (
                <img src={company.logoUrl} alt={company.name} className="h-12 w-auto max-w-[150px] object-contain rounded-lg bg-white p-1" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xl">
                  🚌
                </div>
              )}
              <div>
                <h1 className="text-base sm:text-lg font-black text-white leading-none">
                  {company.name || 'ZUYUFURRAHMAN HAJJ & UMRAH'}
                </h1>
                {company.tagline && <p className="text-[10px] text-emerald-400 font-bold mt-0.5">{company.tagline}</p>}
                {company.address && <p className="text-[10px] text-slate-300 font-medium mt-0.5">{company.address}</p>}
              </div>
            </div>
            <div className="text-right text-[10px] text-slate-300 font-medium border-l border-white/10 pl-3">
              {company.phone && <div>📞 {company.phone}</div>}
              {company.email && <div>✉️ {company.email}</div>}
              {company.website && <div className="text-emerald-400 font-bold">{company.website}</div>}
            </div>
          </div>
        )}

        {/* Title Banner */}
        <div className="bg-blue-900 text-white p-2.5 rounded-lg flex items-center justify-between px-4">
          <h2 className="text-sm font-black tracking-wide flex items-center gap-2">
            <span>🚌 OFFICIAL TRANSPORTATION SERVICES VOUCHER</span>
          </h2>
          <span className="text-[10px] font-bold bg-white text-blue-900 px-2.5 py-0.5 rounded-md">STATUS: CONFIRMED</span>
        </div>

        {/* Lead Guest & Voucher Details Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-blue-50/50 p-3 rounded-lg border border-blue-200 text-xs font-mono">
          <div>
            <span className="text-[9px] font-bold text-slate-500 block">LEAD PASSENGER</span>
            <span className="font-black text-blue-950 text-sm">{safeClient}</span>
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-500 block">VOUCHER NO</span>
            <span className="font-bold text-slate-900">{safeVoucherNo}</span>
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-500 block">PASSENGER COUNT</span>
            <span className="font-bold text-slate-800">{paxSummary.adt || 1} ADT</span>
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-500 block">ISSUE DATE</span>
            <span className="font-bold text-slate-800">{safeDate}</span>
          </div>
        </div>

        {/* Transport Schedule Table */}
        <div className="space-y-2">
          <div className="text-xs font-black text-blue-900 border-b border-blue-200 pb-1">
            TRANSPORTATION SECTORS & VEHICLE DETAILS
          </div>
          <div className="border border-blue-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-blue-900 text-white font-bold text-[10px]">
                <tr>
                  <th className="p-2.5">VEHICLE TYPE</th>
                  <th className="p-2.5">SECTOR / ROUTE</th>
                  <th className="p-2.5 text-center">QTY</th>
                  <th className="p-2.5">DRIVER / COORDINATOR CONTACT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-100 font-mono text-[11px]">
                {tList.map((t, i) => (
                  <tr key={`t-row-${i}`} className="bg-white">
                    <td className="p-3 font-black text-blue-950">{t.type || 'PRIVATE VEHICLE'}</td>
                    <td className="p-3 font-bold text-slate-900">{t.sector || 'JED AIRPORT -> MAKKAH HOTEL'}</td>
                    <td className="p-3 text-center font-bold text-blue-800">{t.qty || 1}</td>
                    <td className="p-3 font-bold text-emerald-800">{t.driver || driverContact || 'ON ARRIVAL CALL'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Driver Contact & Special Instructions */}
        {comments && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs">
            <span className="font-bold text-slate-700">REMARKS & PICKUP NOTES:</span> {comments}
          </div>
        )}

        {/* Transport Guidelines */}
        <div className="bg-blue-50/60 border border-blue-200 rounded-lg p-3 text-[10px] space-y-1 text-slate-700">
          <p className="font-bold text-blue-950">📍 ARRIVAL & PICKUP INSTRUCTIONS:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>For Airport Pickups: Transport coordinator will hold a name board at the exit arrival terminal.</li>
            <li>Please inform driver / transport coordinator immediately if your flight is delayed.</li>
            <li>Luggage capacity is subject to the vehicle specification booked. Extra baggage may require an additional vehicle.</li>
          </ul>
        </div>

      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ✨ ALL-IN-ONE CONSOLIDATED VOUCHER SUITE TEMPLATE (ID 420)
// ─────────────────────────────────────────────────────────────────────────────
export function AllInOnePdfTemplate({
  companyDetails = null,
  header = {},
  pax = {},
  totalPax = 0,
  flightItinerary = [],
  passengerList = [],
  pnr = '',
  makkahHotels = [],
  madinaHotels = [],
  transportRows = [],
  hcnMakkah = '',
  hcnMadina = '',
  driverContact = '',
  comments = ''
}) {
  return (
    <div id="printable-all-in-one" className="w-full max-w-4xl mx-auto space-y-6">
      
      {/* PAGE 1: E-TICKET ITINERARY */}
      <div>
        <div className="text-center font-bold text-xs text-indigo-900 bg-indigo-50 py-1 rounded-t-lg border border-indigo-200 uppercase tracking-widest">
          SECTION 1 OF 3 — E-TICKET & FLIGHT ITINERARY
        </div>
        <ETicketPdfTemplate 
          companyDetails={companyDetails}
          header={header}
          pax={pax}
          totalPax={totalPax}
          flightItinerary={flightItinerary}
          passengerList={passengerList}
          pnr={pnr}
          mode="grouped"
        />
      </div>

      {/* PAGE 2: HOTEL VOUCHER */}
      <div style={{ pageBreakBefore: 'always', breakBefore: 'page' }} className="pt-4">
        <div className="text-center font-bold text-xs text-emerald-900 bg-emerald-50 py-1 rounded-t-lg border border-emerald-200 uppercase tracking-widest">
          SECTION 2 OF 3 — HOTEL ACCOMMODATION VOUCHER
        </div>
        <HotelVoucherPdfTemplate 
          companyDetails={companyDetails}
          header={header}
          leadGuestName={header?.name}
          paxSummary={pax}
          makkahHotels={makkahHotels}
          madinaHotels={madinaHotels}
          hcnMakkah={hcnMakkah}
          hcnMadina={hcnMadina}
          comments={comments}
        />
      </div>

      {/* PAGE 3: TRANSPORTATION VOUCHER */}
      <div style={{ pageBreakBefore: 'always', breakBefore: 'page' }} className="pt-4">
        <div className="text-center font-bold text-xs text-blue-900 bg-blue-50 py-1 rounded-t-lg border border-blue-200 uppercase tracking-widest">
          SECTION 3 OF 3 — TRANSPORTATION SERVICES VOUCHER
        </div>
        <TransportVoucherPdfTemplate 
          companyDetails={companyDetails}
          header={header}
          leadGuestName={header?.name}
          paxSummary={pax}
          transportRows={transportRows}
          driverContact={driverContact}
          comments={comments}
        />
      </div>

    </div>
  )
}
