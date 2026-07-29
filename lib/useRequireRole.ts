'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export function useRequireRole(allowed: string[]) {
  const { user, loading } = useAuth()
  const router = useRouter()

  const authorized = !!user && allowed.includes(user.role)

  useEffect(() => {
    if (!loading && user && !authorized) {
      router.replace('/dashboard')
    }
  }, [user, loading, authorized, router])

  return { authorized, loading }
}
