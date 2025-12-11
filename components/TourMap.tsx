'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

// Token Mapbox
mapboxgl.accessToken = 'pk.eyJ1IjoiYmx1YWxsaWFuY2UiLCJhIjoiY21qMXV6b253MG44ZjNmc2J5NndrZHF0aiJ9.8cQGgySYVdjD6ihHyJWe3A'

interface Coordinate {
  lat: number
  lng: number
}

interface Tappa {
  id: string
  ordine: number
  nome: string
  descrizione: string
  coordinate: Coordinate
  tipo: 'punto_interesse' | 'sosta' | 'foto_stop' | 'pranzo' | 'bagno'
  durata_minuti: number
  icona?: string
  immagine_url?: string
}

interface TourData {
  nome: string
  descrizione: string
  durata_totale_minuti: number
  distanza_km: number
  punto_partenza: Coordinate & { nome: string }
  punto_arrivo: Coordinate & { nome: string }
  tappe: Tappa[]
  stile_mappa?: 'satellite' | 'streets' | 'outdoors' | 'navigation-day'
  colore_percorso?: string
}

interface TourMapProps {
  tour: TourData
  height?: string
  showControls?: boolean
  animated?: boolean
  autoStart?: boolean
}

export default function TourMap({ 
  tour, 
  height = '500px',
  showControls = true,
  animated = true,
  autoStart = false
}: TourMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    if (!mapContainer.current || map.current) return

    // Inizializza mappa
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: getMapStyle(tour.stile_mappa || 'satellite'),
      center: [tour.punto_partenza.lng, tour.punto_partenza.lat],
      zoom: 10,
      pitch: 45, // Vista 3D
      bearing: 0
    })

    map.current.on('load', () => {
      if (!map.current) return

      // Aggiungi controlli navigazione
      if (showControls) {
        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
        map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right')
      }

      // Disegna percorso
      drawRoute()

      // Aggiungi marker
      addMarkers()

      // Avvia animazione automatica se richiesto
      if (autoStart) {
        startAnimation()
      }
    })

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      map.current?.remove()
    }
  }, [])

  function getMapStyle(style: string): string {
    const styles: Record<string, string> = {
      'satellite': 'mapbox://styles/mapbox/satellite-streets-v12',
      'streets': 'mapbox://styles/mapbox/streets-v12',
      'outdoors': 'mapbox://styles/mapbox/outdoors-v12',
      'navigation-day': 'mapbox://styles/mapbox/navigation-day-v1'
    }
    return styles[style] || styles['satellite']
  }

  function drawRoute() {
    if (!map.current) return

    // Crea array di coordinate per il percorso
    const coordinates: [number, number][] = [
      [tour.punto_partenza.lng, tour.punto_partenza.lat],
      ...tour.tappe.map(t => [t.coordinate.lng, t.coordinate.lat] as [number, number]),
      [tour.punto_arrivo.lng, tour.punto_arrivo.lat]
    ]

    // Aggiungi linea percorso
    map.current.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: coordinates
        }
      }
    })

    // Stile linea
    map.current.addLayer({
      id: 'route',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': tour.colore_percorso || '#0066FF',
        'line-width': 4,
        'line-opacity': 0.8
      }
    })

    // Aggiungi contorno bianco per maggiore visibilità
    map.current.addLayer({
      id: 'route-outline',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#FFFFFF',
        'line-width': 6,
        'line-opacity': 0.5
      }
    })

    // Riordina layer (contorno sotto)
    map.current.moveLayer('route-outline', 'route')

    // Adatta vista per mostrare tutto il percorso
    const bounds = coordinates.reduce((bounds, coord) => {
      return bounds.extend(coord as [number, number])
    }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]))

    map.current.fitBounds(bounds, {
      padding: 50,
      duration: 1000
    })
  }

  function addMarkers() {
    if (!map.current) return

    // Marker partenza
    const startEl = document.createElement('div')
    startEl.className = 'tour-marker tour-marker-start'
    startEl.innerHTML = '🚤'
    startEl.style.fontSize = '32px'

    const startMarker = new mapboxgl.Marker({ element: startEl })
      .setLngLat([tour.punto_partenza.lng, tour.punto_partenza.lat])
      .setPopup(
        new mapboxgl.Popup({ offset: 25 })
          .setHTML(`
            <div class="tour-popup">
              <h3>🚤 Partenza</h3>
              <p><strong>${tour.punto_partenza.nome}</strong></p>
              <p class="text-sm text-gray-600">Inizio tour</p>
            </div>
          `)
      )
      .addTo(map.current)

    // Marker tappe
    tour.tappe.forEach((tappa, index) => {
      const el = document.createElement('div')
      el.className = 'tour-marker tour-marker-waypoint'
      el.innerHTML = getTappaIcon(tappa)
      el.style.fontSize = '28px'
      el.style.cursor = 'pointer'

      const popup = new mapboxgl.Popup({ 
        offset: 25,
        maxWidth: '300px'
      }).setHTML(`
        <div class="tour-popup">
          <h3>${tappa.icona || '📍'} ${tappa.nome}</h3>
          ${tappa.immagine_url ? `<img src="${tappa.immagine_url}" alt="${tappa.nome}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px; margin: 8px 0;" />` : ''}
          <p>${tappa.descrizione}</p>
          <div class="tour-popup-meta">
            <span>⏱️ ${tappa.durata_minuti} min</span>
            <span>📌 Tappa ${index + 1}/${tour.tappe.length}</span>
          </div>
        </div>
      `)

      new mapboxgl.Marker({ element: el })
        .setLngLat([tappa.coordinate.lng, tappa.coordinate.lat])
        .setPopup(popup)
        .addTo(map.current!)
    })

    // Marker arrivo (se diverso da partenza)
    if (tour.punto_arrivo.lat !== tour.punto_partenza.lat || 
        tour.punto_arrivo.lng !== tour.punto_partenza.lng) {
      const endEl = document.createElement('div')
      endEl.className = 'tour-marker tour-marker-end'
      endEl.innerHTML = '🏁'
      endEl.style.fontSize = '32px'

      new mapboxgl.Marker({ element: endEl })
        .setLngLat([tour.punto_arrivo.lng, tour.punto_arrivo.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 })
            .setHTML(`
              <div class="tour-popup">
                <h3>🏁 Arrivo</h3>
                <p><strong>${tour.punto_arrivo.nome}</strong></p>
                <p class="text-sm text-gray-600">Fine tour</p>
              </div>
            `)
        )
        .addTo(map.current)
    }
  }

  function getTappaIcon(tappa: Tappa): string {
    if (tappa.icona) return tappa.icona

    const icons: Record<string, string> = {
      'punto_interesse': '📍',
      'sosta': '⚓',
      'foto_stop': '📸',
      'pranzo': '🍽️',
      'bagno': '🏊'
    }
    return icons[tappa.tipo] || '📍'
  }

  function startAnimation() {
    if (!map.current || !animated) return

    setIsAnimating(true)
    setCurrentStep(0)

    const allPoints = [
      tour.punto_partenza,
      ...tour.tappe.map(t => t.coordinate),
      tour.punto_arrivo
    ]

    let step = 0

    function animate() {
      if (step >= allPoints.length - 1) {
        setIsAnimating(false)
        return
      }

      const current = allPoints[step]
      const next = allPoints[step + 1]

      // Flyto animazione
      map.current?.flyTo({
        center: [next.lng, next.lat],
        zoom: 13,
        duration: 2000,
        pitch: 60
      })

      setCurrentStep(step)
      step++

      animationRef.current = setTimeout(animate, 3000)
    }

    animate()
  }

  function stopAnimation() {
    if (animationRef.current) {
      clearTimeout(animationRef.current)
      animationRef.current = null
    }
    setIsAnimating(false)
  }

  function resetView() {
    if (!map.current) return

    const coordinates: [number, number][] = [
      [tour.punto_partenza.lng, tour.punto_partenza.lat],
      ...tour.tappe.map(t => [t.coordinate.lng, t.coordinate.lat] as [number, number]),
      [tour.punto_arrivo.lng, tour.punto_arrivo.lat]
    ]

    const bounds = coordinates.reduce((bounds, coord) => {
      return bounds.extend(coord)
    }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]))

    map.current.fitBounds(bounds, {
      padding: 50,
      duration: 1000
    })
  }

  return (
    <div className="tour-map-container">
      {/* Mappa */}
      <div ref={mapContainer} style={{ height, width: '100%', borderRadius: '12px' }} />

      {/* Controlli animazione */}
      {animated && (
        <div className="tour-controls">
          {!isAnimating ? (
            <button
              onClick={startAnimation}
              className="tour-control-btn tour-control-play"
            >
              ▶️ Avvia Tour Virtuale
            </button>
          ) : (
            <button
              onClick={stopAnimation}
              className="tour-control-btn tour-control-stop"
            >
              ⏸️ Pausa
            </button>
          )}
          <button
            onClick={resetView}
            className="tour-control-btn tour-control-reset"
          >
            🔄 Reset Vista
          </button>
        </div>
      )}

      {/* Info tour */}
      <div className="tour-info-overlay">
        <div className="tour-info-card">
          <h3 className="tour-info-title">{tour.nome}</h3>
          <div className="tour-info-stats">
            <span>⏱️ {Math.floor(tour.durata_totale_minuti / 60)}h {tour.durata_totale_minuti % 60}min</span>
            <span>📏 {tour.distanza_km} km</span>
            <span>📍 {tour.tappe.length} tappe</span>
          </div>
        </div>
      </div>

      {/* Stili CSS inline per componente standalone */}
      <style jsx>{`
        .tour-map-container {
          position: relative;
          width: 100%;
        }

        .tour-controls {
          position: absolute;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 10px;
          z-index: 10;
        }

        .tour-control-btn {
          padding: 12px 24px;
          background: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          transition: all 0.2s;
        }

        .tour-control-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
        }

        .tour-control-play {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .tour-control-stop {
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          color: white;
        }

        .tour-control-reset {
          background: white;
          color: #333;
        }

        .tour-info-overlay {
          position: absolute;
          top: 20px;
          left: 20px;
          z-index: 10;
        }

        .tour-info-card {
          background: white;
          padding: 16px 20px;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          max-width: 300px;
        }

        .tour-info-title {
          font-size: 18px;
          font-weight: 700;
          color: #1a1a1a;
          margin: 0 0 12px 0;
        }

        .tour-info-stats {
          display: flex;
          gap: 12px;
          font-size: 13px;
          color: #666;
        }

        .tour-info-stats span {
          white-space: nowrap;
        }

        @media (max-width: 768px) {
          .tour-controls {
            bottom: 10px;
            flex-direction: column;
            width: calc(100% - 40px);
            max-width: 300px;
          }

          .tour-control-btn {
            padding: 10px 16px;
            font-size: 13px;
          }

          .tour-info-overlay {
            top: 10px;
            left: 10px;
            right: 10px;
          }

          .tour-info-card {
            max-width: 100%;
          }

          .tour-info-title {
            font-size: 16px;
          }

          .tour-info-stats {
            flex-wrap: wrap;
            gap: 8px;
            font-size: 12px;
          }
        }
      `}</style>

      {/* Stili globali per popup */}
      <style jsx global>{`
        .tour-popup {
          font-family: system-ui, -apple-system, sans-serif;
        }

        .tour-popup h3 {
          margin: 0 0 8px 0;
          font-size: 16px;
          font-weight: 700;
          color: #1a1a1a;
        }

        .tour-popup p {
          margin: 0 0 8px 0;
          font-size: 14px;
          line-height: 1.5;
          color: #333;
        }

        .tour-popup-meta {
          display: flex;
          gap: 12px;
          padding-top: 8px;
          border-top: 1px solid #eee;
          font-size: 12px;
          color: #666;
        }

        .mapboxgl-popup-content {
          border-radius: 12px;
          padding: 16px;
        }

        .mapboxgl-popup-close-button {
          font-size: 20px;
          padding: 4px 8px;
        }

        .tour-marker {
          cursor: pointer;
          transition: transform 0.2s;
        }

        .tour-marker:hover {
          transform: scale(1.2);
        }
      `}</style>
    </div>
  )
}