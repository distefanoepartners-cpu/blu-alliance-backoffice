'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string>('operatore')
  const [loading, setLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    checkUser()
  }, [])

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      router.push('/')
      return
    }

    setUser(session.user)

    // Carica il ruolo dell'utente dalla tabella amministratori (case-insensitive)
    if (session.user.email) {
      const { data: adminData } = await supabase
        .from('amministratori')
        .select('ruolo')
        .ilike('email', session.user.email)
        .eq('attivo', true)
        .maybeSingle()

      if (adminData && adminData.ruolo) {
        setUserRole(adminData.ruolo)
      }
    }

    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut({ scope: 'local' })
    router.push('/')
  }

  // Menu completo con ruoli
  const allMenuItems = [
  { href: '/dashboard/disponibilita', label: 'Planning', icon: '📅', roles: ['admin', 'operatore'] },
  { href: '/dashboard/statistiche', label: 'Statistiche', icon: '📈', roles: ['admin'] },
  { href: '/dashboard/prenotazioni', label: 'Prenotazioni', icon: '📋', roles: ['admin', 'operatore'] },
  { href: '/dashboard/calendario', label: 'Calendario', icon: '🗓️', roles: ['admin', 'operatore'] },
  { href: '/dashboard/blocchi', label: 'Blocchi', icon: '🚫', roles: ['admin', 'operatore'] },
  { href: '/dashboard/clienti', label: 'Clienti', icon: '👥', roles: ['admin', 'operatore'] },
  { href: '/dashboard/chatbot-leads', label: 'Lead Chatbot', icon: '💬', roles: ['admin', 'operatore'] },
  { href: '/dashboard/servizi', label: 'Servizi', icon: '🎯', roles: ['admin'] },
  { href: '/dashboard/imbarcazioni', label: 'Imbarcazioni', icon: '🚤', roles: ['admin'] },
  { href: '/dashboard/fornitori', label: 'Fornitori', icon: '🏢', roles: ['admin'] },
  { href: '/dashboard/amministratori', label: 'Amministratori', icon: '👤', roles: ['admin'] },
]

  // Filtra menu in base al ruolo
  const menuItems = allMenuItems.filter(item => item.roles.includes(userRole))

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard'
    }
    return pathname.startsWith(href)
  }

  // Verifica accesso alla pagina corrente
  useEffect(() => {
    if (!loading && userRole === 'operatore') {
      const currentPage = allMenuItems.find(item => pathname.startsWith(item.href))
      if (currentPage && !currentPage.roles.includes('operatore')) {
        router.push('/dashboard/disponibilita')
      }
    }
  }, [pathname, userRole, loading])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Caricamento...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex md:flex-col fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200">
        <div className="flex-1 flex flex-col overflow-y-auto p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center overflow-hidden">
              <img
                src="/logo.png"
                alt="Blu Alliance Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Blu Alliance</h2>
              <p className="text-xs text-gray-600">Backoffice</p>
            </div>
          </div>

          <nav className="flex-1 space-y-1">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors
                  ${isActive(item.href)
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                  }
                `}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="pt-6 border-t border-gray-200">
            <div className="flex items-center gap-3 px-4 py-3 mb-2">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-sm font-semibold">
                {user?.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.email?.split('@')[0] || 'Utente'}
                </p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                <p className={`text-xs font-medium mt-1 ${userRole === 'admin' ? 'text-purple-600' : 'text-green-600'}`}>
                  {userRole === 'admin' ? '👑 Admin' : '👤 Operatore'}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-40">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center overflow-hidden">
              <img
                src="/logo.png"
                alt="Blu Alliance Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-sm">Blu Alliance</h2>
              <p className="text-xs text-gray-600">Backoffice</p>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black bg-opacity-50" onClick={() => setMobileMenuOpen(false)}>
          <div className="fixed inset-y-0 right-0 w-64 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col h-full p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center overflow-hidden">
                    <img
                      src="/logo.png"
                      alt="Blu Alliance Logo"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900">Blu Alliance</h2>
                    <p className="text-xs text-gray-600">Backoffice</p>
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-lg hover:bg-gray-100"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <nav className="flex-1 space-y-1">
                {menuItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors
                      ${isActive(item.href)
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50'
                      }
                    `}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </nav>

              <div className="pt-6 border-t border-gray-200">
                <div className="flex items-center gap-3 px-4 py-3 mb-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-sm font-semibold">
                    {user?.email?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {user?.email?.split('@')[0] || 'Utente'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                    <p className={`text-xs font-medium mt-1 ${userRole === 'admin' ? 'text-purple-600' : 'text-green-600'}`}>
                      {userRole === 'admin' ? '👑 Admin' : '👤 Operatore'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="md:ml-64 pt-16 md:pt-0">
        {children}
      </main>
    </div>
  )
}