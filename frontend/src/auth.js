const AUTH_STORAGE_KEY = 'galileotools-authenticated'
const VALID_USER = {
  email: 'test@example.com',
  password: 'password',
}

export function isAuthenticated() {
  return typeof window !== 'undefined' && localStorage.getItem(AUTH_STORAGE_KEY) === '1'
}

export function login({ email, password }) {
  if (email.trim().toLowerCase() === VALID_USER.email && password === VALID_USER.password) {
    localStorage.setItem(AUTH_STORAGE_KEY, '1')
    return true
  }
  return false
}

export function logout() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(AUTH_STORAGE_KEY)
  }
}

export function getAuthUser() {
  return isAuthenticated() ? { email: VALID_USER.email } : null
}
