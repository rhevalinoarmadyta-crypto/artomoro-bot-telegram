import React, { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { LayoutDashboard, BookOpen, LineChart, FileText, Monitor, X, Users, Lock, Clock, Activity, Package, ChevronDown, Check } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '../lib/utils'
import { useFinanceStore } from '../store/useFinanceStore'

const EXCLUSIVE_USERS = [
  { name: "Dwi Astuti", id: "dwiastuti123", password: "Cybi130576?" },
  { name: "Birza Ezar Rahardian", id: "birza123", password: "Cybi130576?" },
  { name: "Rhevalino Armadyta Putra", id: "rhevalino123", password: "Cybi130576?" }
]

function getInitials(name) {
  if (!name) return '??'
  const parts = name.trim().split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return parts[0][0].toUpperCase()
}

export function Layout() {
  const { toasts, removeToast } = useFinanceStore()
  const location = useLocation()
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('artomoro_authenticated') === 'true'
  })
  const [usernameInput, setUsernameInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [loginError, setLoginError] = useState('')
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [transitioningUser, setTransitioningUser] = useState('')
  const [activeUser, setActiveUser] = useState(() => {
    const stored = localStorage.getItem('artomoro_active_user')
    return stored ? JSON.parse(stored) : { name: "Dwi Astuti", id: "dwiastuti123" }
  })
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  const handleLogin = (e) => {
    e.preventDefault()
    const matchedUser = EXCLUSIVE_USERS.find(
      u => u.id.toLowerCase() === usernameInput.trim().toLowerCase() && u.password === passwordInput
    )
    if (matchedUser) {
      const userData = { name: matchedUser.name, id: matchedUser.id }
      localStorage.setItem('artomoro_active_user', JSON.stringify(userData))
      setActiveUser(userData)
      setTransitioningUser(matchedUser.name)
      setIsTransitioning(true)
      setLoginError('')
      
      // Delay 3 seconds for the transition effect before redirecting
      setTimeout(() => {
        localStorage.setItem('artomoro_authenticated', 'true')
        setIsAuthenticated(true)
        setIsTransitioning(false)
      }, 3000)
    } else {
      setLoginError('ID atau Password salah. Silakan coba lagi.')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('artomoro_authenticated')
    localStorage.removeItem('artomoro_active_user')
    setIsAuthenticated(false)
    setUsernameInput('')
    setPasswordInput('')
  }

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/ledger', icon: BookOpen, label: 'Ledger' },
    { to: '/analytics', icon: LineChart, label: 'Analytics' },
    { to: '/report', icon: FileText, label: 'Report' },
    { to: '/inventory', icon: Package, label: 'Inventory' },
    { to: '/performance', icon: Activity, label: 'Kinerja Live' },
    { to: '/attendance', icon: Users, label: 'Absensi & Gaji' },
    { to: '/attendance-portal', icon: Clock, label: 'Portal Absen' },
  ]

  // Render Transition Overlay Screen
  if (isTransitioning) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-white relative overflow-hidden">
        {/* Aesthetic Background Accents */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-40"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/10 blur-[120px] rounded-full"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-indigo-500/10 blur-[100px] rounded-full"></div>

        <div className="text-center space-y-5 z-10 px-6 animate-welcome-text">
          <span className="text-slate-400 font-light tracking-[0.3em] text-xs md:text-sm uppercase block">
            Selamat Datang,
          </span>
          <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400 tracking-tight leading-none">
            {transitioningUser}
          </h1>
          <div className="h-[2px] w-24 bg-gradient-to-r from-emerald-500 to-indigo-500 mx-auto mt-6 rounded-full opacity-65"></div>
        </div>
      </div>
    )
  }

  // Render Login Page if not Authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 p-6 relative overflow-hidden">
        {/* Glassmorphism Background Accents */}
        <div className="absolute top-[-10%] right-[-10%] w-[400px] h-[400px] bg-emerald-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-indigo-600/10 blur-[120px] rounded-full"></div>
        
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center space-y-6 animate-scale backdrop-blur-md relative z-10">
          <div className="flex flex-col items-center">
            <div className="p-1 mb-4 bg-white rounded-2xl shadow-lg border border-slate-700/50">
              <img src="/logo.png" alt="Artomoro Gallery Logo" className="h-16 w-16 object-contain rounded-xl" />
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white">Artomoro Gallery</h2>
            <p className="text-slate-400 text-xs mt-1">Sistem Finansial & Absensi Live</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ID Pengguna</label>
              <input 
                type="text" 
                required
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="Masukkan ID Anda" 
                className="w-full border border-slate-800 bg-slate-950/80 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-slate-600 focus:border-emerald-500 transition-all duration-150"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Password</label>
              <input 
                type="password" 
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••" 
                className="w-full border border-slate-800 bg-slate-950/80 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-slate-600 focus:border-emerald-500 transition-all duration-150"
              />
            </div>

            {loginError && (
              <div className="text-xs text-rose-450 bg-rose-950/20 border border-rose-900/30 p-3 rounded-xl text-center font-semibold animate-pulse">
                {loginError}
              </div>
            )}

            <button type="submit" className="w-full bg-emerald-600 text-white font-bold text-sm py-3 rounded-xl hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-600/10 flex items-center justify-center gap-2 cursor-pointer">
              <Lock className="h-4 w-4" /> Akses Sistem
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* ── TOAST NOTIFICATIONS CONTAINER ── */}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-3 pointer-events-none max-w-sm w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-lg shadow-xl border text-sm font-medium animate-toast backdrop-blur-md",
              toast.type === 'success' 
                ? "bg-emerald-950/95 text-emerald-200 border-emerald-800/80" 
                : toast.type === 'error'
                ? "bg-rose-950/95 text-rose-200 border-rose-800/80"
                : "bg-slate-900/95 text-slate-200 border-slate-700/80"
            )}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'success' && <span className="text-base">✅</span>}
              {toast.type === 'error' && <span className="text-base">❌</span>}
              {toast.type === 'info' && <span className="text-base">📥</span>}
              <span>{toast.message}</span>
            </div>
            <button 
              onClick={() => removeToast(toast.id)} 
              className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded-full hover:bg-slate-800"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* ── MOBILE BLOCKER SCREEN ── */}
      <div className="md:hidden flex flex-col items-center justify-center min-h-screen bg-slate-950 p-6 text-center text-white">
        <Monitor className="h-16 w-16 text-emerald-500 mb-4 animate-bounce" />
        <h2 className="text-2xl font-bold mb-2">Desktop View Only</h2>
        <p className="text-slate-400 text-sm max-w-sm leading-relaxed">
          Sistem Rekonsiliasi Finansial Artomoro Gallery dirancang secara khusus untuk diakses melalui perangkat **Desktop / PC** (Windows & macOS).
          <br /><br />
          Ini memastikan ketelitian tinggi dan kemudahan pembacaan ribuan baris data ledger akuntansi. Silakan buka kembali tautan ini di komputer atau laptop Anda.
        </p>
      </div>

      {/* ── DESKTOP LAYOUT ── */}
      <div className="hidden md:flex h-screen bg-[#fafbfc] dark:bg-slate-950 overflow-hidden min-w-[1024px]">
        {/* Sidebar Desktop */}
        <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 flex flex-col shrink-0 shadow-[1px_0_10px_rgba(0,0,0,0.02)]">
          <div className="h-16 flex items-center px-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div className="font-bold text-base tracking-tight text-slate-800 dark:text-white flex items-center gap-2">
              <img src="/logo.png" alt="Artomoro Gallery Logo" className="h-8 w-8 object-contain rounded-md bg-white p-0.5 border border-slate-200/50 dark:border-slate-850" />
              <span>Artomoro <span className="text-emerald-500 font-semibold">Gallery</span></span>
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1.5">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive 
                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 shadow-[sm] border border-emerald-100/50 dark:border-emerald-900/30" 
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-white border border-transparent"
                )}
              >
                <item.icon className="h-4.5 w-4.5" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between px-8 shrink-0 shadow-sm z-10">
            <div className="flex items-center gap-4">
              {/* Interactive Profile Area & Dropdown */}
              <div className="relative">
                <button 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-850/60 px-3 py-1.5 rounded-xl transition-all duration-200 text-left border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                >
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-black text-xs shadow-md shadow-emerald-500/10 uppercase tracking-wider shrink-0">
                    {getInitials(activeUser.name)}
                  </div>
                  <div className="hidden lg:block shrink-0">
                    <div className="text-xs font-black text-slate-850 dark:text-white leading-none">{activeUser.name}</div>
                    <div className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">Akses Eksklusif</div>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                </button>

                {isDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)}></div>
                    <div className="absolute left-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xl z-50 py-3 animate-scale overflow-hidden">
                      <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                        <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Akses Eksklusif Terdaftar</h4>
                      </div>
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/50 max-h-60 overflow-y-auto">
                        {EXCLUSIVE_USERS.map((user) => {
                          const isActive = user.name === activeUser.name
                          return (
                            <div 
                              key={user.id} 
                              className={`px-4 py-2.5 flex items-center gap-3 transition-colors ${isActive ? 'bg-slate-50 dark:bg-slate-850/50' : ''}`}
                            >
                              <div className={`h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-bold uppercase tracking-wider shrink-0 ${isActive ? 'bg-emerald-500 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                                {getInitials(user.name)}
                              </div>
                              <div className="truncate flex-1">
                                <p className={`text-xs font-bold truncate ${isActive ? 'text-emerald-500' : 'text-slate-700 dark:text-slate-300'}`}>
                                  {user.name}
                                </p>
                                {user.name === "Rhevalino Armadyta Putra" && (
                                  <p className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5">Web Development</p>
                                )}
                              </div>
                              {isActive && (
                                <span className="text-[8px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 flex items-center gap-1">
                                  <Check className="h-2 w-2" /> Aktif
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      <div className="border-t border-slate-100 dark:border-slate-800 pt-2 px-3">
                        <button 
                          onClick={() => {
                            setIsDropdownOpen(false)
                            handleLogout()
                          }}
                          className="w-full text-left flex items-center gap-2 px-3 py-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5 shrink-0" />
                          <span>Log Out dari Sistem</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800 hidden md:block"></div>

              <h1 className="font-bold text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                <span>Financial Audit Platform</span>
                <span className="text-xs bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Active Session
                </span>
              </h1>
            </div>
          </header>
          
          <main className="flex-1 overflow-y-auto p-8 bg-slate-50/50 dark:bg-slate-950">
            <div className="max-w-6xl mx-auto h-full">
              <AnimatePresence mode="wait">
                <motion.div
                  key={location.pathname}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="h-full"
                >
                  <Outlet />
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
        </div>
      </div>
    </>
  )
}
