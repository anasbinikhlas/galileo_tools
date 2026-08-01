import React, { useState, useEffect } from 'react'
import toast, { Toaster } from 'react-hot-toast'

export function getActiveCompanyDetails() {
  try {
    const activeId = localStorage.getItem('galileo_active_company_id')
    const storedList = localStorage.getItem('galileo_company_profiles')
    let list = storedList ? JSON.parse(storedList) : []

    if (list.length === 0) {
      const defaultComp = {
        id: 'default-company-1',
        name: 'ZUYUFURRAHMAN HAJJ & UMRAH SERVICES',
        tagline: 'Premium Hajj & Umrah Tour Packages',
        address: 'Suite #402, 4th Floor, Commercial Center, Main Boulevard',
        phone: '+92 300 1234567 / +92 21 34567890',
        email: 'info@zuyufurrahman.com',
        website: 'www.zuyufurrahman.com',
        logoUrl: '',
        isDefault: true
      }
      list = [defaultComp]
      localStorage.setItem('galileo_company_profiles', JSON.stringify(list))
      localStorage.setItem('galileo_active_company_id', defaultComp.id)
      return defaultComp
    }

    if (activeId) {
      const found = list.find(c => c.id === activeId)
      if (found) return found
    }

    return list[0]
  } catch (e) {
    return {
      name: 'ZUYUFURRAHMAN HAJJ & UMRAH SERVICES',
      tagline: 'Premium Hajj & Umrah Tour Packages',
      address: 'Suite #402, 4th Floor, Commercial Center, Main Boulevard',
      phone: '+92 300 1234567',
      email: 'info@zuyufurrahman.com',
      website: 'www.zuyufurrahman.com',
      logoUrl: ''
    }
  }
}

export default function CompanyDetails() {
  const [companies, setCompanies] = useState(() => {
    try {
      const stored = localStorage.getItem('galileo_company_profiles')
      if (stored) return JSON.parse(stored)
    } catch (e) {}
    
    return [
      {
        id: 'default-company-1',
        name: 'ZUYUFURRAHMAN HAJJ & UMRAH SERVICES',
        tagline: 'Premium Hajj & Umrah Tour Packages',
        address: 'Suite #402, 4th Floor, Commercial Center, Main Boulevard',
        phone: '+92 300 1234567 / +92 21 34567890',
        email: 'info@zuyufurrahman.com',
        website: 'www.zuyufurrahman.com',
        logoUrl: '',
        isDefault: true
      }
    ]
  })

  const [activeCompanyId, setActiveCompanyId] = useState(() => {
    return localStorage.getItem('galileo_active_company_id') || 'default-company-1'
  })

  const [showModal, setShowModal] = useState(false)
  const [editingCompany, setEditingCompany] = useState(null)
  
  const [formData, setFormData] = useState({
    name: '',
    tagline: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    logoUrl: ''
  })

  useEffect(() => {
    try {
      localStorage.setItem('galileo_company_profiles', JSON.stringify(companies))
    } catch (e) {
      console.error('Failed to save company profiles', e)
    }
  }, [companies])

  useEffect(() => {
    if (activeCompanyId) {
      localStorage.setItem('galileo_active_company_id', activeCompanyId)
    }
  }, [activeCompanyId])

  const handleOpenAddModal = () => {
    setEditingCompany(null)
    setFormData({
      name: '',
      tagline: '',
      address: '',
      phone: '',
      email: '',
      website: '',
      logoUrl: ''
    })
    setShowModal(true)
  }

  const handleOpenEditModal = (company) => {
    setEditingCompany(company)
    setFormData({
      name: company.name || '',
      tagline: company.tagline || '',
      address: company.address || '',
      phone: company.phone || '',
      email: company.email || '',
      website: company.website || '',
      logoUrl: company.logoUrl || ''
    })
    setShowModal(true)
  }

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, SVG)')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo file size should be less than 2MB')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      setFormData(prev => ({ ...prev, logoUrl: event.target?.result || '' }))
      toast.success('Logo uploaded successfully')
    }
    reader.readAsDataURL(file)
  }

  const handleSaveCompany = (e) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast.error('Company name is required')
      return
    }

    if (editingCompany) {
      // Update existing
      setCompanies(prev => prev.map(c => c.id === editingCompany.id ? { ...c, ...formData } : c))
      toast.success('Company details updated successfully!')
    } else {
      // Create new
      const newComp = {
        id: `company-${Date.now()}`,
        ...formData
      }
      setCompanies(prev => [...prev, newComp])
      if (companies.length === 0) {
        setActiveCompanyId(newComp.id)
      }
      toast.success('New company profile added!')
    }

    setShowModal(false)
  }

  const handleDeleteCompany = (id) => {
    if (companies.length <= 1) {
      toast.error('Cannot delete the last company profile. Create another first.')
      return
    }

    if (window.confirm('Are you sure you want to delete this company profile?')) {
      setCompanies(prev => prev.filter(c => c.id !== id))
      if (activeCompanyId === id) {
        const remaining = companies.filter(c => c.id !== id)
        setActiveCompanyId(remaining[0]?.id || '')
      }
      toast.success('Company profile deleted.')
    }
  }

  const handleSetActive = (id) => {
    setActiveCompanyId(id)
    const found = companies.find(c => c.id === id)
    toast.success(`Active company profile set to: ${found?.name || 'Selected'}`)
  }

  const activeCompany = companies.find(c => c.id === activeCompanyId) || companies[0]

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto font-sans">
      <Toaster position="top-right" />

      {/* PAGE HEADER */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-md">
              <i className="ti ti-building text-xl" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Company Details & Branding</h1>
              <p className="text-xs text-gray-500">Manage company profiles, addresses, logos, and contact information for PDFs & Vouchers</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md flex items-center gap-2 transition-all shrink-0"
        >
          <i className="ti ti-plus text-base" /> Add New Company Profile
        </button>
      </div>

      {/* ACTIVE COMPANY PREVIEW BANNER */}
      {activeCompany && (
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 shadow-xl border border-slate-700/80 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <span className="bg-emerald-500/20 text-emerald-300 text-[11px] font-extrabold px-3 py-1 rounded-full border border-emerald-400/30 flex items-center gap-1.5">
              <i className="ti ti-circle-check-filled text-emerald-400 text-xs" />
              ACTIVE DEFAULT FOR PDF & INVOICES
            </span>
            <button
              onClick={() => handleOpenEditModal(activeCompany)}
              className="text-xs font-bold text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg border border-white/20 transition-all flex items-center gap-1"
            >
              <i className="ti ti-edit text-sm" /> Edit Active Details
            </button>
          </div>

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              {activeCompany.logoUrl ? (
                <img src={activeCompany.logoUrl} alt={activeCompany.name} className="h-16 w-auto max-w-[180px] object-contain rounded-xl bg-white p-2 shadow-sm" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center shadow-lg border border-white/20 shrink-0">
                  <i className="ti ti-building-hospital text-3xl" />
                </div>
              )}
              <div className="space-y-1">
                <h2 className="text-xl font-black text-white tracking-wide uppercase">{activeCompany.name}</h2>
                {activeCompany.tagline && <p className="text-xs text-emerald-400 font-bold uppercase tracking-wider">{activeCompany.tagline}</p>}
                {activeCompany.address && (
                  <p className="text-xs text-slate-300 font-medium leading-relaxed flex items-center gap-1.5 uppercase">
                    <i className="ti ti-map-pin text-emerald-400 shrink-0" />
                    {activeCompany.address}
                  </p>
                )}
              </div>
            </div>

            <div className="text-left md:text-right space-y-1 text-xs text-slate-300 border-t md:border-t-0 md:border-l border-white/10 pt-3 md:pt-0 md:pl-6 shrink-0 uppercase font-medium">
              {activeCompany.phone && (
                <div className="flex items-center md:justify-end gap-2">
                  <i className="ti ti-phone text-emerald-400 text-sm" />
                  <span>{activeCompany.phone}</span>
                </div>
              )}
              {activeCompany.email && (
                <div className="flex items-center md:justify-end gap-2">
                  <i className="ti ti-mail text-emerald-400 text-sm" />
                  <span className="lowercase">{activeCompany.email}</span>
                </div>
              )}
              {activeCompany.website && (
                <div className="flex items-center md:justify-end gap-2 font-bold text-white">
                  <i className="ti ti-world text-emerald-400 text-sm" />
                  <span className="lowercase">{activeCompany.website}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SAVED COMPANIES LIST */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-gray-800 uppercase tracking-wide flex items-center gap-2">
            <i className="ti ti-list text-emerald-600" /> Saved Company Profiles ({companies.length})
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {companies.map((comp) => {
            const isActive = comp.id === activeCompanyId
            return (
              <div
                key={comp.id}
                className={`bg-white rounded-2xl p-5 border transition-all space-y-4 shadow-sm relative ${
                  isActive ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {comp.logoUrl ? (
                      <img src={comp.logoUrl} alt={comp.name} className="h-12 w-12 object-contain rounded-lg border border-gray-100 p-1 bg-gray-50" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center font-bold text-lg">
                        <i className="ti ti-building" />
                      </div>
                    )}
                    <div>
                      <h4 className="text-sm font-black text-gray-900 uppercase leading-snug">{comp.name}</h4>
                      {comp.tagline && <p className="text-[11px] font-semibold text-emerald-700 uppercase">{comp.tagline}</p>}
                    </div>
                  </div>

                  {isActive ? (
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase shrink-0">
                      ACTIVE
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSetActive(comp.id)}
                      className="text-xs font-bold text-gray-600 hover:text-emerald-700 bg-gray-100 hover:bg-emerald-50 px-3 py-1.5 rounded-lg border border-gray-200 transition-all shrink-0"
                    >
                      Set Active
                    </button>
                  )}
                </div>

                <div className="text-xs text-gray-600 space-y-1.5 border-t border-gray-100 pt-3">
                  {comp.address && (
                    <p className="flex items-start gap-1.5 uppercase text-[11px]">
                      <i className="ti ti-map-pin text-emerald-600 text-sm shrink-0 mt-0.5" />
                      <span>{comp.address}</span>
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                    {comp.phone && (
                      <span className="flex items-center gap-1 font-medium text-gray-800">
                        <i className="ti ti-phone text-emerald-600" /> {comp.phone}
                      </span>
                    )}
                    {comp.email && (
                      <span className="flex items-center gap-1 text-gray-600">
                        <i className="ti ti-mail text-emerald-600" /> {comp.email}
                      </span>
                    )}
                    {comp.website && (
                      <span className="flex items-center gap-1 text-gray-600 font-semibold">
                        <i className="ti ti-world text-emerald-600" /> {comp.website}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
                  <button
                    onClick={() => handleOpenEditModal(comp)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                  >
                    <i className="ti ti-edit" /> Edit
                  </button>
                  {companies.length > 1 && (
                    <button
                      onClick={() => handleDeleteCompany(comp.id)}
                      className="text-xs font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                    >
                      <i className="ti ti-trash" /> Delete
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ADD / EDIT COMPANY MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl relative border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                <i className="ti ti-building text-emerald-600 text-xl" />
                {editingCompany ? 'Edit Company Profile' : 'Add New Company Profile'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <i className="ti ti-x text-xl" />
              </button>
            </div>

            <form onSubmit={handleSaveCompany} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ZUYUFURRAHMAN HAJJ & UMRAH SERVICES"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:ring-2 focus:ring-emerald-500 uppercase"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Tagline / Slogan
                </label>
                <input
                  type="text"
                  placeholder="e.g. Premium Hajj & Umrah Tour Packages"
                  value={formData.tagline}
                  onChange={(e) => setFormData(prev => ({ ...prev, tagline: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:ring-2 focus:ring-emerald-500 uppercase"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Full Address
                </label>
                <textarea
                  rows="2"
                  placeholder="e.g. Suite #402, 4th Floor, Commercial Center, Main Boulevard, Karachi"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-xs text-gray-900 focus:ring-2 focus:ring-emerald-500 uppercase"
                ></textarea>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">Phone / Mobile</label>
                  <input
                    type="text"
                    placeholder="+92 300 1234567"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="info@company.com"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">Website</label>
                  <input
                    type="text"
                    placeholder="www.company.com"
                    value={formData.website}
                    onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* LOGO UPLOAD / URL SECTION */}
              <div className="space-y-2 border-t border-gray-100 pt-3">
                <label className="block font-bold text-gray-700 uppercase tracking-wider">
                  Company Logo
                </label>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="w-full sm:w-auto">
                    <label className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-center gap-2">
                      <i className="ti ti-upload text-base" /> Upload Logo File
                      <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                    </label>
                  </div>
                  <span className="text-gray-400 font-bold text-xs">OR</span>
                  <input
                    type="text"
                    placeholder="Paste Logo Image URL (https://...)"
                    value={formData.logoUrl}
                    onChange={(e) => setFormData(prev => ({ ...prev, logoUrl: e.target.value }))}
                    className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {formData.logoUrl && (
                  <div className="flex items-center gap-3 bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                    <img src={formData.logoUrl} alt="Logo Preview" className="h-12 w-auto object-contain rounded bg-white p-1 border border-gray-200" />
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, logoUrl: '' }))}
                      className="text-xs text-red-600 hover:text-red-800 font-bold flex items-center gap-1"
                    >
                      <i className="ti ti-trash" /> Remove Logo
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold px-4 py-2.5 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-md flex items-center gap-2"
                >
                  <i className="ti ti-check text-base" />
                  {editingCompany ? 'Save Changes' : 'Create Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
