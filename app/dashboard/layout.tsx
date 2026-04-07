'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LogOut, Menu, X, Ship, Anchor, Calendar, Users, Building2, BarChart3, UserCircle, Settings, ChevronDown, ChevronRight, MessageSquare, ShieldCheck } from 'lucide-react'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'

function DashboardLayoutContent({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [adminMenuOpen, setAdminMenuOpen] = useState(false)
  const { user, loading, isAdmin, logout } = useAuth()

  const handleLogout = async () => {
    await logout()
  }

  // Redirect al login quando non autenticato
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/")
    }
  }, [loading, user, router])

  // Loading screen
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Caricamento...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Reindirizzamento...</p>
      </div>
    )
  }

  // ═══ MENU PRINCIPALE ═══
  const mainMenuItems = [
    { href: '/dashboard/disponibilita', label: 'Planning', icon: Calendar, roles: ['admin', 'operatore', 'staff'] },
    { href: '/dashboard/prenotazioni', label: 'Prenotazioni', icon: Calendar, roles: ['admin', 'staff'] },
    { href: '/dashboard/statistiche', label: 'Statistiche', icon: BarChart3, roles: ['admin'] },
    // Operatore: vede solo le sue barche + la propria scheda fornitore
    { href: '/dashboard/mie-barche', label: 'Le mie Barche', icon: Ship, roles: ['operatore'] },
    { href: '/dashboard/mia-azienda', label: 'La mia Azienda', icon: Building2, roles: ['operatore'] },
    { href: '/dashboard/skipper', label: 'I miei Skipper', icon: UserCircle, roles: ['operatore'] },
  ]

  // ═══ SOTTOMENU AMMINISTRAZIONE (solo admin) ═══
  const adminMenuItems = [
    { href: '/dashboard/imbarcazioni', label: 'Flotta', icon: Ship },
    { href: '/dashboard/servizi', label: 'Servizi', icon: Anchor },
    { href: '/dashboard/skipper', label: 'Skipper', icon: UserCircle },
    { href: '/dashboard/clienti', label: 'Clienti', icon: Users },
    { href: '/dashboard/fornitori', label: 'Fornitori', icon: Building2 },
    { href: '/dashboard/chatbot-leads', label: 'Chatbot Leads', icon: MessageSquare },
    { href: '/dashboard/amministratori', label: 'Gestione Utenti', icon: ShieldCheck },
  ]

  function isActive(href: string) {
    return pathname === href || pathname?.startsWith(href + '/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link href="/dashboard/disponibilita">
              <div className="flex items-center gap-3 cursor-pointer">
                <img src="/icon-192.png" alt="Blu Alliance" className="h-10 w-10" />
                <div>
                  <h1 className="text-xl font-bold text-blue-600">Blu Alliance</h1>
                  {user && (
                    <p className="text-xs text-gray-500">
                      {user.full_name}
                      {isAdmin ? (
                        <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Admin</span>
                      ) : (
                        <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">
                          {user.role === 'operatore' ? 'Operatore' : 'Staff'}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex gap-1 items-center">
              {mainMenuItems.filter(item => item.roles.includes(user?.role || 'staff')).map((item) => (
                <Link key={item.href} href={item.href}>
                  <Button 
                    variant={isActive(item.href) ? 'default' : 'ghost'} 
                    size="sm"
                    className={isActive(item.href) ? 'bg-blue-600 text-white' : ''}
                  >
                    {item.label}
                  </Button>
                </Link>
              ))}
              
              {/* Dropdown Amministrazione (solo admin) */}
              {isAdmin && (
                <div className="relative">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setAdminMenuOpen(!adminMenuOpen)}
                    className="gap-1"
                  >
                    <Settings className="h-4 w-4" />
                    Amministrazione
                    <ChevronDown className={`h-4 w-4 transition-transform ${adminMenuOpen ? 'rotate-180' : ''}`} />
                  </Button>
                  
                  {adminMenuOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setAdminMenuOpen(false)}
                      />
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20">
                        {adminMenuItems.map((item) => {
                          const Icon = item.icon
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setAdminMenuOpen(false)}
                              className={`flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-sm ${
                                isActive(item.href) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                              }`}
                            >
                              <Icon className="h-4 w-4 text-blue-600" />
                              <span>{item.label}</span>
                            </Link>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </nav>

            {/* Desktop Logout */}
            <div className="hidden md:flex items-center gap-3">
              <Button variant="outline" onClick={handleLogout} size="sm" className="gap-2">
                <LogOut className="h-4 w-4" />
                Esci
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-md hover:bg-gray-100"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6 text-gray-600" />
              ) : (
                <Menu className="h-6 w-6 text-gray-600" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="px-4 py-2 space-y-1">
              {/* Menu principale mobile */}
              {mainMenuItems.filter(item => item.roles.includes(user?.role || 'staff')).map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-md ${
                      isActive(item.href) 
                        ? 'bg-blue-50 text-blue-700' 
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <Icon className="h-5 w-5 text-blue-600" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                )
              })}
              
              {/* Sottomenu Amministrazione mobile (solo admin) */}
              {isAdmin && (
                <>
                  <button
                    onClick={() => setAdminMenuOpen(!adminMenuOpen)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-md hover:bg-gray-100 text-gray-700"
                  >
                    <div className="flex items-center gap-3">
                      <Settings className="h-5 w-5 text-blue-600" />
                      <span className="font-medium">Amministrazione</span>
                    </div>
                    <ChevronRight className={`h-5 w-5 transition-transform ${adminMenuOpen ? 'rotate-90' : ''}`} />
                  </button>
                  
                  {adminMenuOpen && (
                    <div className="ml-8 space-y-1 border-l-2 border-blue-200 pl-4">
                      {adminMenuItems.map((item) => {
                        const Icon = item.icon
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={`flex items-center gap-3 px-4 py-2 rounded-md text-sm ${
                              isActive(item.href)
                                ? 'bg-blue-50 text-blue-700 font-medium'
                                : 'hover:bg-gray-50 text-gray-600'
                            }`}
                          >
                            <Icon className="h-4 w-4 text-blue-600" />
                            <span>{item.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
              
              {/* Mobile Logout */}
              <button
                onClick={() => {
                  setMobileMenuOpen(false)
                  handleLogout()
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-md hover:bg-gray-100 text-red-600"
              >
                <LogOut className="h-5 w-5" />
                <span className="font-medium">Esci</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </AuthProvider>
  )
}