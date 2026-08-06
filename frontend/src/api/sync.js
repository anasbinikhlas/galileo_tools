import axios from 'axios'

const API_BASE = '/api'

export async function fetchServerClients() {
  try {
    const res = await axios.get(`${API_BASE}/clients`)
    if (res.data && res.data.success && Array.isArray(res.data.clients)) {
      if (res.data.clients.length > 0) {
        localStorage.setItem('galileo_clients', JSON.stringify(res.data.clients))
      }
      return res.data.clients
    }
  } catch (err) {
    console.warn('Backend API client fetch fallback to localStorage:', err.message)
  }
  try {
    const stored = localStorage.getItem('galileo_clients')
    return stored ? JSON.parse(stored) : []
  } catch (e) {
    return []
  }
}

export async function saveServerClients(clients) {
  try {
    localStorage.setItem('galileo_clients', JSON.stringify(clients))
    await axios.post(`${API_BASE}/clients/sync`, { clients })
  } catch (err) {
    console.warn('Backend API client sync error:', err.message)
  }
}

export async function deleteServerClient(clientId) {
  try {
    await axios.delete(`${API_BASE}/clients/${clientId}`)
  } catch (err) {
    console.warn('Backend API client delete error:', err.message)
  }
}

export async function fetchServerInvoices() {
  try {
    const res = await axios.get(`${API_BASE}/invoices`)
    if (res.data && res.data.success && Array.isArray(res.data.invoices)) {
      if (res.data.invoices.length > 0) {
        localStorage.setItem('galileo_invoices', JSON.stringify(res.data.invoices))
      }
      return res.data.invoices
    }
  } catch (err) {
    console.warn('Backend API invoice fetch fallback to localStorage:', err.message)
  }
  try {
    const stored = localStorage.getItem('galileo_invoices')
    return stored ? JSON.parse(stored) : []
  } catch (e) {
    return []
  }
}

export async function saveServerInvoices(invoices) {
  try {
    localStorage.setItem('galileo_invoices', JSON.stringify(invoices))
    await axios.post(`${API_BASE}/invoices/sync`, { invoices })
  } catch (err) {
    console.warn('Backend API invoice sync error:', err.message)
  }
}

export async function deleteServerInvoice(invoiceId) {
  try {
    await axios.delete(`${API_BASE}/invoices/${invoiceId}`)
  } catch (err) {
    console.warn('Backend API invoice delete error:', err.message)
  }
}

export async function fetchServerContacts() {
  try {
    const res = await axios.get(`${API_BASE}/contacts`)
    if (res.data && res.data.success && Array.isArray(res.data.contacts)) {
      if (res.data.contacts.length > 0) {
        localStorage.setItem('galileo_contacts', JSON.stringify(res.data.contacts))
      }
      return res.data.contacts
    }
  } catch (err) {
    console.warn('Backend API contact fetch fallback to localStorage:', err.message)
  }
  try {
    const stored = localStorage.getItem('galileo_contacts')
    return stored ? JSON.parse(stored) : []
  } catch (e) {
    return []
  }
}

export async function saveServerContacts(contacts) {
  try {
    localStorage.setItem('galileo_contacts', JSON.stringify(contacts))
    await axios.post(`${API_BASE}/contacts/sync`, { contacts })
  } catch (err) {
    console.warn('Backend API contact sync error:', err.message)
  }
}

export async function deleteServerContact(contactId) {
  try {
    await axios.delete(`${API_BASE}/contacts/${contactId}`)
  } catch (err) {
    console.warn('Backend API contact delete error:', err.message)
  }
}
