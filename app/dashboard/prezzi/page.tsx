// app/dashboard/prezzi/page.tsx
'use client'

import { useState, useRef, useEffect } from 'react'

export default function PrezziPage() {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  const resetView = () => {
    setZoom(1)
    setPosition({ x: 0, y: 0 })
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.15 : 0.15
    setZoom(prev => Math.min(Math.max(prev + delta, 0.5), 4))
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    }
  }

  const handleMouseUp = () => setIsDragging(false)

  const handleTouchStart = (e: React.TouchEvent) => {
    if (zoom > 1 && e.touches.length === 1) {
      setIsDragging(true)
      setDragStart({ 
        x: e.touches[0].clientX - position.x, 
        y: e.touches[0].clientY - position.y 
      })
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && e.touches.length === 1) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      })
    }
  }

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false)
        resetView()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const ImageViewer = ({ fullscreen = false }: { fullscreen?: boolean }) => (
    <div
      className={`relative overflow-hidden ${fullscreen ? 'w-full h-full' : 'rounded-lg border border-gray-200 shadow-sm bg-white'}`}
      style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in' }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => setIsDragging(false)}
      onClick={() => {
        if (!isDragging && zoom === 1 && !fullscreen) {
          setIsFullscreen(true)
        }
      }}
    >
      <div
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          transition: isDragging ? 'none' : 'transform 0.2s ease',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/listino-prezzi-2026.png"
          alt="Listino Prezzi NS3000 Rent 2026"
          className={`w-full h-auto ${fullscreen ? '' : 'max-h-[calc(100vh-220px)]'} object-contain select-none`}
          draggable={false}
        />
      </div>
    </div>
  )

  const ZoomControls = ({ onClose }: { onClose?: () => void }) => (
    <div className="flex items-center gap-2">
      <button
        onClick={(e) => { e.stopPropagation(); setZoom(prev => Math.max(prev - 0.25, 0.5)) }}
        className="p-2 bg-white hover:bg-gray-100 rounded-lg border shadow-sm transition"
        title="Zoom -"
      >
        <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      </button>
      
      <span className="text-sm font-mono text-gray-600 min-w-[52px] text-center bg-white px-2 py-1 rounded border">
        {Math.round(zoom * 100)}%
      </span>
      
      <button
        onClick={(e) => { e.stopPropagation(); setZoom(prev => Math.min(prev + 0.25, 4)) }}
        className="p-2 bg-white hover:bg-gray-100 rounded-lg border shadow-sm transition"
        title="Zoom +"
      >
        <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
      
      <button
        onClick={(e) => { e.stopPropagation(); resetView() }}
        className="p-2 bg-white hover:bg-gray-100 rounded-lg border shadow-sm transition"
        title="Reset zoom"
      >
        <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>

      {!onClose && (
        <button
          onClick={(e) => { e.stopPropagation(); setIsFullscreen(true) }}
          className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg shadow-sm transition ml-1"
          title="Schermo intero"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
      )}

      {onClose && (
        <button
          onClick={(e) => { e.stopPropagation(); onClose() }}
          className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-sm transition ml-1"
          title="Chiudi (ESC)"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )

  return (
    <>
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              💰 Listino Prezzi 2026
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Rotella mouse per zoomare · Trascina per spostare · Clicca per schermo intero
            </p>
          </div>
          <ZoomControls />
        </div>

        {/* Immagine listino */}
        <ImageViewer />
      </div>

      {/* Modale Fullscreen */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-black/50 backdrop-blur">
            <h2 className="text-white font-semibold text-lg">💰 Listino Prezzi 2026</h2>
            <ZoomControls onClose={() => { setIsFullscreen(false); resetView() }} />
          </div>
          <div className="flex-1 overflow-hidden">
            <ImageViewer fullscreen />
          </div>
          <div className="text-center py-2 bg-black/50">
            <p className="text-gray-400 text-xs">Rotella = zoom · Trascina = sposta · ESC = chiudi</p>
          </div>
        </div>
      )}
    </>
  )
}