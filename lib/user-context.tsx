'use client'

import { createContext, useContext } from 'react'

export interface UserContextType {
  role: string           // 'admin' | 'operatore'
  fornitoreId: string | null  // UUID del fornitore associato (solo per operatori)
  userId: string | null
  userEmail: string | null
}

export const UserContext = createContext<UserContextType>({
  role: 'operatore',
  fornitoreId: null,
  userId: null,
  userEmail: null,
})

export function useUserContext() {
  return useContext(UserContext)
}