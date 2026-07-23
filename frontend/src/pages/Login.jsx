import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { login } from '../auth'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const [showPassword, setShowPassword] = useState(false)

  const from = location.state?.from?.pathname || '/'

  const handleSubmit = (event) => {
    event.preventDefault()
    if (login({ email, password })) {
      navigate(from, { replace: true })
      return
    }
    setError('Invalid email or password')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-lg shadow-slate-200/80">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">Login to Tools</h1>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              required
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Password
            <div className="relative mt-2">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 text-lg focus:outline-none transition-colors"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                <i className={`ti ${showPassword ? 'ti-eye-off' : 'ti-eye'}`} />
              </button>
            </div>
          </label>

          <button
            type="submit"
            className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            Sign in
          </button>
        </form>

        
      </div>
    </div>
  )
}
