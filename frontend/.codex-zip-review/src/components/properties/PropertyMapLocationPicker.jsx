import React, { useEffect, useRef, useState, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { reverseGeocode } from '../../api/locationApi.js'
import { MapPin, Navigation, Loader, AlertCircle, CheckCircle2, RotateCw } from 'lucide-react'

// SmartEstate branded SVG marker icon using Leaflet divIcon
const createCustomPinIcon = () => {
  return L.divIcon({
    className: 'hs-custom-map-pin',
    html: `
      <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));">
        <svg viewBox="0 0 24 24" width="36" height="36" fill="#315A7D" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
          <circle cx="12" cy="10" r="3" fill="#ffffff"></circle>
        </svg>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 34],
    popupAnchor: [0, -32],
  })
}

// Fallback initial location (Hyderabad / Tech Hub, India)
const DEFAULT_CENTER = {
  lat: 17.4483,
  lng: 78.3915,
  zoom: 13,
}

/**
 * PropertyMapLocationPicker Component
 *
 * Provides interactive map selection using Leaflet & OpenStreetMap.
 * Allows owner to:
 * - Click anywhere or drag the pin to set exact coordinates
 * - Use browser geolocation to find current location
 * - Automatically calls authenticated GET /api/location/reverse-geocode to populate address fields
 *
 * @param {Object} props
 * @param {number|string} [props.latitude]
 * @param {number|string} [props.longitude]
 * @param {Function} props.onLocationChange - Callback ({ latitude, longitude })
 * @param {Function} [props.onAddressResolved] - Callback (reverseGeocodeResponse)
 * @param {Function} [props.onLookupError] - Callback (error, { latitude, longitude, message, isNotFound })
 * @param {boolean} [props.autoReverseGeocode=true]
 */
export default function PropertyMapLocationPicker({
  latitude,
  longitude,
  onLocationChange,
  onAddressResolved,
  onLookupError,
  autoReverseGeocode = true,
}) {
  const mapContainerRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef = useRef(null)

  const [isLocating, setIsLocating] = useState(false)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [geocodingSuccess, setGeocodingSuccess] = useState(null)
  const [geocodingError, setGeocodingError] = useState(null)
  const [currentCoords, setCurrentCoords] = useState(() => {
    const lat = Number(latitude)
    const lng = Number(longitude)
    return !Number.isNaN(lat) && !Number.isNaN(lng) && lat !== 0 && lng !== 0
      ? { lat, lng }
      : null
  })

  const setupMarkerRef = useRef(null)

  // Sync internal coords if external props change meaningfully
  useEffect(() => {
    const lat = Number(latitude)
    const lng = Number(longitude)
    if (!Number.isNaN(lat) && !Number.isNaN(lng) && lat !== 0 && lng !== 0) {
      if (!currentCoords || Math.abs(currentCoords.lat - lat) > 0.0001 || Math.abs(currentCoords.lng - lng) > 0.0001) {
        setCurrentCoords({ lat, lng })
        if (mapInstanceRef.current) {
          if (setupMarkerRef.current) {
            setupMarkerRef.current(lat, lng)
          }
          mapInstanceRef.current.panTo([lat, lng])
        }
      }
    }
  }, [latitude, longitude, currentCoords])

  // Reverse geocoding worker: Preserves selected pin and coordinates even on 404 or lookup failure
  const triggerReverseGeocode = useCallback(
    async (lat, lng) => {
      if (!autoReverseGeocode) return
      setIsGeocoding(true)
      setGeocodingError(null)
      setGeocodingSuccess(null)

      try {
        const result = await reverseGeocode(lat, lng)
        if (result) {
          const parts = [result.area, result.city, result.state].filter(Boolean)
          setGeocodingSuccess(parts.length > 0 ? parts.join(', ') : 'Address detected')
          if (onAddressResolved) {
            onAddressResolved(result)
          }
        }
      } catch (err) {
        console.warn('Reverse geocoding warning:', err)
        const is404 =
          err?.status === 404 ||
          err?.response?.status === 404 ||
          err?.isNotFound ||
          err?.originalError?.response?.status === 404
        const msg = is404
          ? 'Address lookup is unavailable for this location. Your selected coordinates are preserved; you can enter address fields manually.'
          : err?.response?.data?.message ||
            err?.message ||
            'Address lookup is unavailable for this location. You can enter address fields manually.'
        setGeocodingError(msg)
        if (onLookupError) {
          onLookupError(err, { latitude: lat, longitude: lng, message: msg, isNotFound: is404 })
        }
      } finally {
        setIsGeocoding(false)
      }
    },
    [autoReverseGeocode, onAddressResolved, onLookupError]
  )

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return
    if (mapInstanceRef.current) return

    const hasCoords = currentCoords != null
    const initialLat = hasCoords ? currentCoords.lat : DEFAULT_CENTER.lat
    const initialLng = hasCoords ? currentCoords.lng : DEFAULT_CENTER.lng
    const initialZoom = hasCoords ? 15 : DEFAULT_CENTER.zoom

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView([initialLat, initialLng], initialZoom)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map)

    mapInstanceRef.current = map

    const pinIcon = createCustomPinIcon()

    const setupOrUpdateMarker = (lat, lng) => {
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng])
      } else {
        const marker = L.marker([lat, lng], {
          icon: pinIcon,
          draggable: true,
          autoPan: true,
        }).addTo(map)

        marker.on('dragend', () => {
          const pos = marker.getLatLng()
          const newLat = Number(pos.lat.toFixed(6))
          const newLng = Number(pos.lng.toFixed(6))
          setCurrentCoords({ lat: newLat, lng: newLng })
          if (onLocationChange) {
            onLocationChange({ latitude: newLat, longitude: newLng })
          }
          triggerReverseGeocode(newLat, newLng)
        })

        markerRef.current = marker
      }
    }

    setupMarkerRef.current = setupOrUpdateMarker

    // Place marker if initial coordinates are provided
    if (currentCoords) {
      setupOrUpdateMarker(currentCoords.lat, currentCoords.lng)
    }

    // Map click listener to set or relocate pin
    map.on('click', (e) => {
      const { lat, lng } = e.latlng
      const newLat = Number(lat.toFixed(6))
      const newLng = Number(lng.toFixed(6))
      setupOrUpdateMarker(newLat, newLng)
      map.panTo([newLat, newLng])
      setCurrentCoords({ lat: newLat, lng: newLng })
      if (onLocationChange) {
        onLocationChange({ latitude: newLat, longitude: newLng })
      }
      triggerReverseGeocode(newLat, newLng)
    })

    // Invalidate size on load and container resize
    const timer = setTimeout(() => {
      map.invalidateSize()
    }, 200)

    let resizeObserver = null
    if (window.ResizeObserver && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize()
      })
      resizeObserver.observe(mapContainerRef.current)
    }

    return () => {
      clearTimeout(timer)
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
      map.remove()
      mapInstanceRef.current = null
      markerRef.current = null
      setupMarkerRef.current = null
    }
  }, []) // Empty dependency array ensures single initialization

  // Current Geolocation Button
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser')
      return
    }

    setIsLocating(true)
    setGeocodingError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6))
        const lng = Number(position.coords.longitude.toFixed(6))
        setIsLocating(false)
        setCurrentCoords({ lat, lng })

        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([lat, lng], 16)
          if (setupMarkerRef.current) {
            setupMarkerRef.current(lat, lng)
          }
        }

        if (onLocationChange) {
          onLocationChange({ latitude: lat, longitude: lng })
        }
        triggerReverseGeocode(lat, lng)
      },
      (error) => {
        setIsLocating(false)
        console.warn('Geolocation error:', error)
        let msg = 'Unable to retrieve location.'
        if (error.code === 1) msg = 'Location permission denied by browser.'
        else if (error.code === 2) msg = 'Location position unavailable.'
        else if (error.code === 3) msg = 'Location request timed out.'
        setGeocodingError(msg)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  // Manual re-trigger of reverse geocode
  const handleRefreshGeocode = () => {
    if (currentCoords) {
      triggerReverseGeocode(currentCoords.lat, currentCoords.lng)
    }
  }

  return (
    <div className="space-y-2.5">
      {/* Map Header / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-[#243447] font-semibold">
          <MapPin className="w-4 h-4 text-[#315A7D]" />
          <span>Interactive Property Location Map</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={isLocating}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#D9E0E6] bg-white hover:bg-[#F7F8FA] text-[#243447] text-xs font-medium transition-colors shadow-2xs disabled:opacity-50"
            title="Detect and center map on your current location"
          >
            {isLocating ? (
              <Loader className="w-3.5 h-3.5 animate-spin text-[#315A7D]" />
            ) : (
              <Navigation className="w-3.5 h-3.5 text-[#315A7D]" />
            )}
            <span>{isLocating ? 'Locating...' : 'Use My Location'}</span>
          </button>

          {currentCoords && (
            <button
              type="button"
              onClick={handleRefreshGeocode}
              disabled={isGeocoding}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#D9E0E6] bg-white hover:bg-[#F7F8FA] text-[#5B6875] text-xs transition-colors shadow-2xs disabled:opacity-50"
              title="Re-fetch address from coordinates"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isGeocoding ? 'animate-spin text-[#315A7D]' : ''}`} />
              <span>Fetch Address</span>
            </button>
          )}
        </div>
      </div>

      {/* Map Container */}
      <div className="relative rounded-xl overflow-hidden border border-[#D9E0E6] bg-slate-100 shadow-inner">
        <div
          ref={mapContainerRef}
          className="w-full h-[260px] sm:h-[300px] z-0"
          style={{ minHeight: '260px' }}
        />

        {/* Floating Instructions Banner */}
        <div className="absolute top-2.5 left-2.5 right-2.5 pointer-events-none z-[400] flex justify-between items-start gap-2">
          <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#D9E0E6] shadow-sm text-[11px] text-[#243447] font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#3F7D58] animate-pulse shrink-0" />
            <span>Click map or drag pin to position property</span>
          </div>
        </div>

        {/* Status Overlay at Bottom */}
        {(isGeocoding || geocodingSuccess || geocodingError) && (
          <div className="absolute bottom-2 left-2 right-2 z-[400] pointer-events-auto">
            {isGeocoding && (
              <div className="px-3 py-1.5 rounded-lg bg-slate-900/80 text-white backdrop-blur-md text-xs font-medium flex items-center gap-2 shadow-md">
                <Loader className="w-3.5 h-3.5 animate-spin text-sky-400 shrink-0" />
                <span>Auto-populating address via backend reverse-geocode...</span>
              </div>
            )}
            {!isGeocoding && geocodingSuccess && (
              <div className="px-3 py-1.5 rounded-lg bg-[#3F7D58]/95 text-white backdrop-blur-md text-xs font-medium flex items-center justify-between gap-2 shadow-md">
                <div className="flex items-center gap-1.5 truncate">
                  <CheckCircle2 className="w-3.5 h-3.5 text-white shrink-0" />
                  <span className="truncate">Address detected: {geocodingSuccess}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setGeocodingSuccess(null)}
                  className="text-white hover:text-white/80 font-bold ml-1 text-sm"
                >
                  &times;
                </button>
              </div>
            )}
            {!isGeocoding && geocodingError && (
              <div className="px-3 py-2 rounded-lg bg-amber-600/95 text-white backdrop-blur-md text-xs font-medium flex items-start justify-between gap-2 shadow-md">
                <div className="flex items-start gap-1.5">
                  <AlertCircle className="w-4 h-4 text-white shrink-0 mt-0.5" />
                  <span className="leading-snug">{geocodingError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setGeocodingError(null)}
                  className="text-white hover:text-white/80 font-bold ml-1 text-sm leading-none shrink-0"
                  aria-label="Dismiss error"
                >
                  &times;
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Coordinate Display Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#F7F8FA] border border-[#D9E0E6] text-xs">
        <div className="flex items-center gap-3 text-[#5B6875]">
          <span>
            Lat:{' '}
            <strong className="text-[#243447] font-mono">
              {currentCoords ? currentCoords.lat.toFixed(6) : '—'}
            </strong>
          </span>
          <span>
            Lng:{' '}
            <strong className="text-[#243447] font-mono">
              {currentCoords ? currentCoords.lng.toFixed(6) : '—'}
            </strong>
          </span>
        </div>

        <span className="text-[11px] text-[#5B6875] italic">
          Coordinates are automatically saved with the address
        </span>
      </div>
    </div>
  )
}
