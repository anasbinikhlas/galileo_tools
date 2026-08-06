import React, { useState, useEffect } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { fetchServerContacts, saveServerContacts, deleteServerContact } from '../api/sync'

export default function ClientContacts() {
  const [contacts, setContacts] = useState(() => {
    try {
      const stored = localStorage.getItem('galileo_contacts')
      return stored ? JSON.parse(stored) : []
    } catch (e) {
      return []
    }
  })

  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingContact, setEditingContact] = useState(null)

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    whatsapp: '',
    email: '',
    notes: '',
  })

  useEffect(() => {
    fetchServerContacts().then(data => {
      if (Array.isArray(data)) setContacts(data)
    })
  }, [])

  const handleOpenAdd = () => {
    setEditingContact(null)
    setFormData({ name: '', phone: '', whatsapp: '', email: '', notes: '' })
    setShowAddModal(true)
  }

  const handleOpenEdit = (contact) => {
    setEditingContact(contact)
    setFormData({
      name: contact.name || '',
      phone: contact.phone || '',
      whatsapp: contact.whatsapp || '',
      email: contact.email || '',
      notes: contact.notes || '',
    })
    setShowAddModal(true)
  }

  const handleSaveContact = (e) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      toast.error('Client name is required')
      return
    }

    if (editingContact) {
      setContacts(prev => {
        const updated = prev.map(c => c.id === editingContact.id ? {
          ...c,
          ...formData,
          updatedAt: new Date().toISOString()
        } : c)
        saveServerContacts(updated)
        return updated
      })
      toast.success('Contact updated successfully')
    } else {
      const newContact = {
        id: 'cnt_' + Date.now(),
        ...formData,
        source: 'Manual',
        totalBookings: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      setContacts(prev => {
        const updated = [newContact, ...prev]
        saveServerContacts(updated)
        return updated
      })
      toast.success('New contact added to directory')
    }

    setShowAddModal(false)
  }

  const handleDeleteContact = (id, name) => {
    if (window.confirm(`Are you sure you want to delete contact for "${name}"?`)) {
      setContacts(prev => {
        const updated = prev.filter(c => c.id !== id)
        deleteServerContact(id)
        return updated
      })
      toast.success('Contact deleted')
    }
  }

  const copyToClipboard = (text, label) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    toast.success(`Copied ${label}: ${text}`)
  }

  const exportToCSV = () => {
    if (contacts.length === 0) {
      toast.error('No contacts to export')
      return
    }
    const headers = ['Name', 'Phone', 'WhatsApp', 'Email', 'Source', 'Notes', 'Created At']
    const rows = contacts.map(c => [
      `"${c.name || ''}"`,
      `"${c.phone || ''}"`,
      `"${c.whatsapp || ''}"`,
      `"${c.email || ''}"`,
      `"${c.source || 'Manual'}"`,
      `"${(c.notes || '').replace(/"/g, '""')}"`,
      `"${c.createdAt || ''}"`
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Client_Contacts_${new Date().toISOString().slice(0,10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Contacts exported to CSV')
  }

  const handleImportCSV = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target.result || ''
        const lines = text.split(/\r\n|\n/).filter(line => line.trim())
        if (lines.length <= 1) {
          toast.error('CSV file is empty or missing data rows')
          return
        }

        const newImported = []
        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(',').map(val => val.replace(/^"|"$/g, '').trim())
          if (row[0]) {
            newImported.push({
              id: 'cnt_' + Date.now() + '_' + i,
              name: row[0] || '',
              phone: row[1] || '',
              whatsapp: row[2] || '',
              email: row[3] || '',
              source: row[4] || 'CSV Import',
              notes: row[5] || '',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            })
          }
        }

        if (newImported.length > 0) {
          setContacts(prev => {
            const updated = [...newImported, ...prev]
            saveServerContacts(updated)
            return updated
          })
          toast.success(`Successfully imported ${newImported.length} contact(s) from CSV!`)
        } else {
          toast.error('Could not find valid contact names in CSV file')
        }
      } catch (err) {
        toast.error('Failed to parse CSV file')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const filteredContacts = contacts.filter(c => {
    const term = searchTerm.toLowerCase()
    return (
      (c.name && c.name.toLowerCase().includes(term)) ||
      (c.phone && c.phone.toLowerCase().includes(term)) ||
      (c.whatsapp && c.whatsapp.toLowerCase().includes(term)) ||
      (c.email && c.email.toLowerCase().includes(term))
    )
  })

  return (
    <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <i className="ti ti-address-book text-brand-600" />
            Client Contact Directory
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Manage saved client contact numbers, WhatsApp links, and email addresses automatically synced from bookings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm cursor-pointer">
            <i className="ti ti-file-import text-base text-blue-600" />
            Import CSV
            <input
              type="file"
              accept=".csv"
              onChange={handleImportCSV}
              className="hidden"
            />
          </label>
          <button
            onClick={exportToCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm"
          >
            <i className="ti ti-file-export text-base text-emerald-600" />
            Export CSV
          </button>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 shadow-sm"
          >
            <i className="ti ti-plus text-base" />
            Add Contact
          </button>
        </div>
      </div>

      {/* Search Bar & Stats */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <i className="ti ti-search absolute left-3 top-2.5 text-gray-400 text-sm" />
          <input
            type="text"
            placeholder="Search by name, phone, WhatsApp, or email..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-brand-500"
          />
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="bg-brand-50 text-brand-700 font-medium px-2.5 py-1 rounded-full border border-brand-100">
            Total Contacts: {contacts.length}
          </span>
          {searchTerm && (
            <span>Showing {filteredContacts.length} matching</span>
          )}
        </div>
      </div>

      {/* Contact Cards Grid / Table */}
      {filteredContacts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-3">
            <i className="ti ti-users-minus text-2xl" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">No contacts found</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            {searchTerm ? 'No contact matches your search filter.' : 'Contacts saved during Package creation or Client forms will automatically appear here.'}
          </p>
          {!searchTerm && (
            <button
              onClick={handleOpenAdd}
              className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700"
            >
              <i className="ti ti-plus text-base" />
              Add First Contact
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">SR #</th>
                  <th className="py-3 px-4">CLIENT NAME</th>
                  <th className="py-3 px-4">PHONE NUMBER</th>
                  <th className="py-3 px-4">WHATSAPP NUMBER</th>
                  <th className="py-3 px-4">EMAIL ADDRESS</th>
                  <th className="py-3 px-4">SOURCE</th>
                  <th className="py-3 px-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-gray-700">
                {filteredContacts.map((c, index) => {
                  const cleanWhatsapp = (c.whatsapp || c.phone || '').replace(/[^0-9]/g, '')
                  return (
                    <tr key={c.id || index} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3 px-4 text-gray-400 font-mono">{index + 1}</td>
                      <td className="py-3 px-4 font-semibold text-gray-900">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs">
                            {(c.name || 'C').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p>{c.name}</p>
                            {c.notes && <p className="text-[10px] text-gray-400 font-normal">{c.notes}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {c.phone ? (
                          <div className="flex items-center gap-1.5">
                            <a
                              href={`tel:${c.phone}`}
                              className="text-gray-800 hover:text-brand-600 hover:underline font-mono"
                            >
                              {c.phone}
                            </a>
                            <button
                              onClick={() => copyToClipboard(c.phone, 'Phone')}
                              className="text-gray-400 hover:text-gray-600 p-0.5"
                              title="Copy Phone"
                            >
                              <i className="ti ti-copy" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {cleanWhatsapp ? (
                          <div className="flex items-center gap-1.5">
                            <a
                              href={`https://wa.me/${cleanWhatsapp}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-mono hover:bg-emerald-100"
                            >
                              <i className="ti ti-brand-whatsapp text-emerald-600 text-sm" />
                              {c.whatsapp || c.phone}
                            </a>
                            <button
                              onClick={() => copyToClipboard(c.whatsapp || c.phone, 'WhatsApp')}
                              className="text-gray-400 hover:text-gray-600 p-0.5"
                              title="Copy WhatsApp"
                            >
                              <i className="ti ti-copy" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {c.email ? (
                          <div className="flex items-center gap-1.5">
                            <a
                              href={`mailto:${c.email}`}
                              className="text-gray-700 hover:text-brand-600 hover:underline"
                            >
                              {c.email}
                            </a>
                            <button
                              onClick={() => copyToClipboard(c.email, 'Email')}
                              className="text-gray-400 hover:text-gray-600 p-0.5"
                              title="Copy Email"
                            >
                              <i className="ti ti-copy" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5 rounded font-medium">
                          {c.source || 'Manual'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(c)}
                            className="p-1 text-gray-500 hover:text-brand-600 rounded hover:bg-gray-100"
                            title="Edit Contact"
                          >
                            <i className="ti ti-pencil text-sm" />
                          </button>
                          <button
                            onClick={() => handleDeleteContact(c.id, c.name)}
                            className="p-1 text-gray-500 hover:text-red-600 rounded hover:bg-gray-100"
                            title="Delete Contact"
                          >
                            <i className="ti ti-trash text-sm" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-gray-200 animate-in fade-in zoom-in duration-150">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <i className="ti ti-address-book text-brand-600" />
                {editingContact ? 'Edit Contact' : 'Add New Client Contact'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleSaveContact} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-gray-700 mb-1">Client Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Anas Ikhlas"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. +92 300 1234567"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">WhatsApp Number</label>
                <input
                  type="text"
                  placeholder="e.g. +92 300 1234567 (with country code)"
                  value={formData.whatsapp}
                  onChange={e => setFormData({ ...formData, whatsapp: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Client Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. client@example.com"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Notes / Remarks</label>
                <textarea
                  rows="2"
                  placeholder="Optional notes..."
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-brand-600 hover:bg-brand-700 rounded-lg font-medium shadow-sm"
                >
                  {editingContact ? 'Update Contact' : 'Save Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
