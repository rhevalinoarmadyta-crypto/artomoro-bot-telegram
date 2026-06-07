import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock as ClockIcon, ArrowLeft } from 'lucide-react'
import './AttendancePortal.css'

const CONFIG = {
  credentials: { id: 'artomoro123', password: 'admin123' },
  employees: [
    { name: 'Farhan', initials: 'FA', role: 'Staff Galeri' },
    { name: 'Adit',   initials: 'AD', role: 'Staff Galeri' }
  ],
  storageKey: 'artomoro_attendance_logs',
  toastDuration: 3500,
  loginDelay: 800,
}

export default function AttendancePortal() {
  const navigate = useNavigate()
  
  // Checking if logged in as Admin
  const isAdmin = localStorage.getItem('artomoro_authenticated') === 'true'

  // States
  const [phase, setPhase] = useState('login') // 'login' | 'dashboard' | 'action'
  const [activeEmployee, setActiveEmployee] = useState(null)
  
  const [inputId, setInputId] = useState('')
  const [inputPw, setInputPw] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [shouldShake, setShouldShake] = useState(false)

  // Clock state
  const [clockTime, setClockTime] = useState('--:--:--')
  const [clockDate, setClockDate] = useState('Loading...')
  const [headerBadgeTime, setHeaderBadgeTime] = useState('')

  // Toast state
  const [toasts, setToasts] = useState([])

  // Logs state
  const [logs, setLogs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(CONFIG.storageKey)) || []
    } catch {
      return []
    }
  })

  // Live Clock effect
  useEffect(() => {
    const formatTimeFull = (d) => {
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    }

    const formatDate = (d) => {
      return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    }

    const formatTimeShort = (d) => {
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    }

    const tick = () => {
      const now = new Date()
      setClockTime(formatTimeFull(now))
      setClockDate(formatDate(now))
      setHeaderBadgeTime(formatTimeShort(now))
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [])

  // Sync logs state with localStorage
  const addLog = (name, action) => {
    const now = new Date()
    const entry = {
      name,
      action,
      timestamp: now.toISOString()
    }
    const updatedLogs = [entry, ...logs]
    setLogs(updatedLogs)
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(updatedLogs))

    // Show toast
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    const verb = action === 'Clock In' ? 'Clocked In' : 'Clocked Out'
    showToast(`${name} successfully ${verb} at ${timeStr} 🎉`, 'success')
  }

  // Toast Helpers
  const showToast = (message, type = 'success') => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9)
    const newToast = { id, message, type, isFadingOut: false }
    setToasts(prev => [...prev, newToast])

    setTimeout(() => {
      setToasts(prev =>
        prev.map(t => (t.id === id ? { ...t, isFadingOut: true } : t))
      )
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, 400) // Match transition out duration
    }, CONFIG.toastDuration)
  }

  // Form submit handler
  const handleLogin = (e) => {
    e.preventDefault()
    setLoginError('')
    setIsLoggingIn(true)

    setTimeout(() => {
      setIsLoggingIn(false)
      if (inputId.trim() === CONFIG.credentials.id && inputPw.trim() === CONFIG.credentials.password) {
        setPhase('dashboard')
      } else {
        setLoginError('Invalid Employee ID or Password. Please try again.')
        setShouldShake(true)
        setInputPw('')
        setTimeout(() => setShouldShake(false), 500)
      }
    }, CONFIG.loginDelay)
  }

  const selectEmployee = (empName) => {
    setActiveEmployee(empName)
    setPhase('action')
  }

  const getTodayLogs = () => {
    const today = new Date().toDateString()
    return logs.filter(l => new Date(l.timestamp).toDateString() === today)
  }

  const getTodayLogsFor = (name) => {
    const today = new Date().toDateString()
    return logs.filter(l => l.name === name && new Date(l.timestamp).toDateString() === today)
  }

  const formatTimeStr = (isoString) => {
    if (!isoString) return ''
    return new Date(isoString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  const todayLogs = getTodayLogs()
  const todayEmployeeLogs = activeEmployee ? getTodayLogsFor(activeEmployee) : []
  const clockedIn = todayEmployeeLogs.some(l => l.action === 'Clock In')
  const clockedOut = todayEmployeeLogs.some(l => l.action === 'Clock Out')

  return (
    <div className="attendance-portal-root">
      {/* Ambient blobs */}
      <div className="bg-blob bg-blob--1" aria-hidden="true"></div>
      <div className="bg-blob bg-blob--2" aria-hidden="true"></div>

      {/* Admin Quick Back Button */}
      {isAdmin && (
        <button className="admin-back-btn" onClick={() => navigate('/attendance')}>
          <ArrowLeft size={14} />
          <span>Kembali ke Dashboard Finansial</span>
        </button>
      )}

      {/* HEADER */}
      <header className="app-header" role="banner">
        <div className="header-brand">
          <div className="header-logo" aria-hidden="true">AG</div>
          <div>
            <div className="header-title">Artomoro Gallery</div>
            <div className="header-subtitle">Attendance System</div>
          </div>
        </div>
        <div className="header-badge" id="headerBadge">
          {headerBadgeTime || 'v1.0 LAN'}
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="app-main" id="appMain" role="main">
        
        {/* PHASE 1: LOGIN */}
        {phase === 'login' && (
          <div 
            className="card phase active" 
            id="phaseLogin" 
            role="region" 
            aria-label="Login"
            style={{
              transform: shouldShake ? 'translateX(-8px)' : '',
              transition: shouldShake ? 'transform 0.08s ease' : 'none',
              animation: 'fadeUp 0.38s cubic-bezier(0.4,0,0.2,1) both'
            }}
          >
            <div className="phase active" id="loginContent">
              <div className="login-icon" aria-hidden="true">🔐</div>
              <h1 className="card-heading">Welcome Back</h1>
              <p className="card-subheading">Sign in to access the attendance portal.</p>

              {/* Error message */}
              {loginError && (
                <div className="error-msg" role="alert" aria-live="polite">
                  <span aria-hidden="true">⚠️</span>
                  <span>{loginError}</span>
                </div>
              )}

              <form onSubmit={handleLogin} novalidate>
                <div className="form-group">
                  <label htmlFor="inputEmployeeId" class="form-label">Employee ID</label>
                  <input
                    type="text"
                    id="inputEmployeeId"
                    className="form-input"
                    placeholder="e.g. artomoro123"
                    value={inputId}
                    onChange={(e) => setInputId(e.target.value)}
                    autoComplete="username"
                    required
                    disabled={isLoggingIn}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <label htmlFor="inputPassword" class="form-label">Password</label>
                  <input
                    type="password"
                    id="inputPassword"
                    className="form-input"
                    placeholder="••••••••"
                    value={inputPw}
                    onChange={(e) => setInputPw(e.target.value)}
                    autoComplete="current-password"
                    required
                    disabled={isLoggingIn}
                  />
                </div>

                <button 
                  type="submit" 
                  className={`btn btn-primary ${isLoggingIn ? 'loading' : ''}`} 
                  id="btnLogin"
                  disabled={isLoggingIn}
                >
                  {isLoggingIn && <div className="spinner" aria-hidden="true" style={{ marginRight: '8px' }}></div>}
                  <span className="btn-text">{isLoggingIn ? 'Signing In...' : 'Sign In →'}</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* PHASE 2: EMPLOYEE SELECTION */}
        {phase === 'dashboard' && (
          <div className="card phase active" id="phaseDashboard" role="region" aria-label="Dashboard">
            <div className="phase active" id="dashboardContent">
              {/* Live clock */}
              <div className="live-clock" aria-live="polite" aria-atomic="true">
                <div className="live-clock__time" id="clockTime">{clockTime}</div>
                <div className="live-clock__date" id="clockDate">{clockDate}</div>
              </div>

              <div className="section-label">Select Employee</div>

              <div className="employee-grid" id="employeeGrid" role="listbox" aria-label="Employee list">
                {CONFIG.employees.map(emp => (
                  <div
                    key={emp.name}
                    className="employee-card"
                    role="option"
                    tabIndex={0}
                    aria-label={`Select ${emp.name}`}
                    onClick={() => selectEmployee(emp.name)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        selectEmployee(emp.name)
                      }
                    }}
                  >
                    <div className="employee-avatar" aria-hidden="true">{emp.initials}</div>
                    <div className="employee-name">{emp.name}</div>
                    <div className="employee-role">{emp.role}</div>
                  </div>
                ))}
              </div>

              <div className="divider"></div>

              <div className="section-label">Today's Logs</div>
              <ul className="log-list" id="logListPhase2" aria-label="Attendance log">
                {todayLogs.length === 0 ? (
                  <li style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '12px' }}>
                    No attendance recorded today.
                  </li>
                ) : (
                  todayLogs.map((log, index) => {
                    const isIn = log.action === 'Clock In'
                    return (
                      <li key={index} className="log-item">
                        <div className={`log-dot ${isIn ? 'log-dot--in' : 'log-dot--out'}`} aria-hidden="true"></div>
                        <span className="log-name">{log.name}</span>
                        <span className="log-action">{isIn ? 'clocked in' : 'clocked out'}</span>
                        <span className="log-time">{formatTimeStr(log.timestamp)}</span>
                      </li>
                    )
                  })
                )}
              </ul>
            </div>
          </div>
        )}

        {/* PHASE 3: ATTENDANCE ACTION */}
        {phase === 'action' && activeEmployee && (
          <div className="card phase active" id="phaseAction" role="region" aria-label="Clock In / Out">
            <div className="phase active" id="actionContent">
              {/* Live clock */}
              <div className="live-clock" aria-live="polite" aria-atomic="true">
                <div className="live-clock__time" id="clockTime2">{clockTime}</div>
                <div className="live-clock__date" id="clockDate2">{clockDate}</div>
              </div>

              <div className="session-badge" aria-label="Active session">
                <div className="session-pulse" aria-hidden="true"></div>
                Active Session
              </div>

              <h2 className="session-name" id="sessionName">{activeEmployee}</h2>
              <p className="session-hint" id="sessionHint">Choose your attendance action below, {activeEmployee}.</p>

              {/* Status chips (today's state) */}
              <div className="status-row" id="statusRow" aria-label="Today's attendance status">
                <span className={`status-chip ${clockedIn ? 'status-chip--in' : 'status-chip--none'}`}>
                  {clockedIn
                    ? `✓ Clocked In ${formatTimeStr(todayEmployeeLogs.find(l => l.action === 'Clock In')?.timestamp)}`
                    : '– Not yet clocked in'}
                </span>
                <span className={`status-chip ${clockedOut ? 'status-chip--out' : 'status-chip--none'}`}>
                  {clockedOut
                    ? `✓ Clocked Out ${formatTimeStr(todayEmployeeLogs.find(l => l.action === 'Clock Out')?.timestamp)}`
                    : '– Not yet clocked out'}
                </span>
              </div>

              {/* Action buttons */}
              <div className="action-buttons">
                <button 
                  className="btn btn-green action-btn" 
                  id="btnClockIn" 
                  aria-label="Clock In"
                  onClick={() => addLog(activeEmployee, 'Clock In')}
                >
                  <span className="btn-icon" aria-hidden="true">🟢</span>
                  <span className="btn-text">Absen Datang</span>
                </button>
                <button 
                  className="btn btn-red action-btn" 
                  id="btnClockOut" 
                  aria-label="Clock Out"
                  onClick={() => addLog(activeEmployee, 'Clock Out')}
                >
                  <span className="btn-icon" aria-hidden="true">🔴</span>
                  <span className="btn-text">Absen Pulang</span>
                </button>
              </div>

              <button className="btn btn-ghost" id="btnBack" aria-label="Back to employee selection" onClick={() => setPhase('dashboard')}>
                ← Back to Selection
              </button>
            </div>
          </div>
        )}

      </main>

      {/* TOAST CONTAINER */}
      <div className="toast-container" id="toastContainer" aria-live="polite" aria-atomic="false">
        {toasts.map(toast => (
          <div 
            key={toast.id} 
            className={`toast toast--${toast.type} ${toast.isFadingOut ? 'fade-out' : ''}`} 
            role="status"
          >
            <span className="toast-icon" aria-hidden="true">
              {toast.type === 'success' ? '✅' : '❌'}
            </span>
            <span>{toast.message}</span>
            <div 
              className="toast-progress" 
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                height: '3px',
                borderRadius: '3px',
                width: '100%',
                background: toast.type === 'success' ? 'var(--green)' : 'var(--red)',
                animation: `toastProgress ${CONFIG.toastDuration}ms linear forwards`
              }}
            ></div>
          </div>
        ))}
      </div>

      {/* FOOTER */}
      <footer className="app-footer" role="contentinfo">
        <span>Artomoro Gallery &copy; {new Date().getFullYear()} &mdash; Internal Use Only</span>
      </footer>
    </div>
  )
}
