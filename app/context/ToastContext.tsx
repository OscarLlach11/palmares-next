'use client'
import { createContext, useContext, useState, useCallback, useRef } from 'react'

type Toast = { id: number; message: string; type?: 'success' | 'error' }

interface ToastCtx {
  showToast: (message: string, type?: 'success' | 'error') => void
}

const ToastContext = createContext<ToastCtx>({ showToast: () => {} })

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counter = useRef(0)

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = ++counter.current
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast stack */}
      <div style={{
        position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
        zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8,
        alignItems: 'center', pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: t.type === 'error' ? '#c0392b' : 'var(--gold)',
            color: t.type === 'error' ? '#fff' : '#000',
            padding: '10px 24px',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
            animation: 'toastIn .2s ease',
            whiteSpace: 'nowrap',
          }}>
            {t.message}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
