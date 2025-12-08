'use client'

import { useEffect } from 'react'

export default function RegisterSW() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('✅ Service Worker registrato:', registration.scope)
        })
        .catch((error) => {
          console.error('❌ Errore registrazione Service Worker:', error)
        })
    }
  }, [])

  return null
}