import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { OrderStatus, LocationCoordinates } from '../../types';
import { useApp } from '../../context/AppContext';
import { isLocationInServiceArea } from '../../utils/distancePricing';
import {
  MapPin,
  Store,
  Navigation,
  Compass,
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  ShieldAlert,
  Info,
  Clock,
  ExternalLink,
} from 'lucide-react';

interface RealInteractiveMapProps {
  status?: OrderStatus;
  storeName?: string;
  storeAddress?: string;
  customerAddress?: string;
  customerCoordinates?: LocationCoordinates;
  destinationCoords?: LocationCoordinates;
  courierName?: string;
  courierLocation?: {
    lat: number;
    lng: number;
    accuracy?: number;
    updatedAt: string;
    isSharingEnabled: boolean;
  };
  onCoordinatesChange?: (coords: LocationCoordinates) => void;
  onCoordinateSelect?: (coords: LocationCoordinates) => void;
  isInteractivePicker?: boolean; // For customer or merchant to pick or adjust location
}

// Baghdad default coordinates (Al-Mansour area)
const DEFAULT_BAGHDAD = { lat: 33.3130, lng: 44.3512, name: 'بغداد - المنصور' };

// Iraq Bounding Box for Fraud / Geofencing Check
const IRAQ_BOUNDS = {
  minLat: 29.0,
  maxLat: 38.0,
  minLng: 38.5,
  maxLng: 49.0,
};

export const RealInteractiveMap: React.FC<RealInteractiveMapProps> = ({
  status,
  storeName = 'موقع المتجر',
  storeAddress = 'بغداد - المنصور',
  customerAddress = 'عنوان الموقع المحدد',
  customerCoordinates,
  destinationCoords,
  courierName,
  courierLocation,
  onCoordinatesChange,
  onCoordinateSelect,
  isInteractivePicker = false,
}) => {
  const { pricingSettings } = useApp();
  const effectiveCoords = destinationCoords || customerCoordinates;
  
  const [currentCoords, setCurrentCoords] = useState<LocationCoordinates>(
    effectiveCoords || {
      lat: DEFAULT_BAGHDAD.lat,
      lng: DEFAULT_BAGHDAD.lng,
      accuracy: 25,
      isManualPin: true,
      verifiedAt: new Date().toLocaleTimeString('ar-IQ'),
    }
  );

  // Sync internal state with props when they change (e.g. from GPS button in parent)
  useEffect(() => {
    if (effectiveCoords) {
      const isDifferent = 
        Math.abs(effectiveCoords.lat - currentCoords.lat) > 0.0001 || 
        Math.abs(effectiveCoords.lng - currentCoords.lng) > 0.0001;
      
      if (isDifferent) {
        setCurrentCoords(effectiveCoords);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([effectiveCoords.lat, effectiveCoords.lng]);
        }
      }
    }
  }, [effectiveCoords]);

  const [gpsStatus, setGpsStatus] = useState<
    'idle' | 'requesting' | 'acquired' | 'denied' | 'weak' | 'out_of_bounds'
  >('idle');
  const [accuracyNotice, setAccuracyNotice] = useState<string | null>(null);
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const customerMarkerRef = useRef<L.Marker | null>(null);
  const storeMarkerRef = useRef<L.Marker | null>(null);
  const courierMarkerRef = useRef<L.Marker | null>(null);
  const serviceAreaCircleRef = useRef<L.Circle | null>(null);

  // Check Iraq bounds
  const isInsideIraq = (lat: number, lng: number) => {
    return (
      lat >= IRAQ_BOUNDS.minLat &&
      lat <= IRAQ_BOUNDS.maxLat &&
      lng >= IRAQ_BOUNDS.minLng &&
      lng <= IRAQ_BOUNDS.maxLng
    );
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [currentCoords.lat, currentCoords.lng],
        zoom: 14,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      if (isInteractivePicker) {
        map.on('click', (e: L.LeafletMouseEvent) => {
          const updated: LocationCoordinates = {
            lat: Number(e.latlng.lat.toFixed(6)),
            lng: Number(e.latlng.lng.toFixed(6)),
            isManualPin: true,
            verifiedAt: new Date().toLocaleTimeString('ar-IQ'),
          };
          updateLocation(updated);
        });
      }

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.stop(); // Stop any pending transitions
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const updateLocation = (coords: LocationCoordinates) => {
    setCurrentCoords(coords);
    if (onCoordinatesChange) onCoordinatesChange(coords);
    if (onCoordinateSelect) onCoordinateSelect(coords);
  };

  // Sync markers and circle
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // 1. Customer Marker
    if (customerMarkerRef.current) {
      customerMarkerRef.current.setLatLng([currentCoords.lat, currentCoords.lng]);
    } else {
      const customerIcon = L.divIcon({
        className: 'custom-customer-marker',
        html: `
          <div style="width: 36px; height: 36px; background: #10B981; border: 3px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      customerMarkerRef.current = L.marker([currentCoords.lat, currentCoords.lng], { 
        icon: customerIcon,
        draggable: isInteractivePicker 
      }).addTo(map);

      if (isInteractivePicker) {
        customerMarkerRef.current.on('dragend', (e) => {
          const marker = e.target;
          const pos = marker.getLatLng();
          const updated: LocationCoordinates = {
            lat: Number(pos.lat.toFixed(6)),
            lng: Number(pos.lng.toFixed(6)),
            isManualPin: true,
            verifiedAt: new Date().toLocaleTimeString('ar-IQ'),
          };
          updateLocation(updated);
        });
      }
    }

    // 2. Service Area Circle (from admin settings)
    if (pricingSettings.serviceArea?.isEnabled) {
      const center = pricingSettings.serviceArea.center;
      const radiusMeters = pricingSettings.serviceArea.radiusKm * 1000;
      
      if (serviceAreaCircleRef.current) {
        serviceAreaCircleRef.current.setLatLng([center.lat, center.lng]);
        serviceAreaCircleRef.current.setRadius(radiusMeters);
      } else {
        serviceAreaCircleRef.current = L.circle([center.lat, center.lng], {
          radius: radiusMeters,
          color: '#10B981',
          fillColor: '#10B981',
          fillOpacity: 0.1,
          weight: 2,
          dashArray: '5, 5'
        }).addTo(map);
      }
    } else {
      if (serviceAreaCircleRef.current) {
        serviceAreaCircleRef.current.remove();
        serviceAreaCircleRef.current = null;
      }
    }

    // 3. Store Marker (if viewing tracking)
    if (status && !isInteractivePicker) {
      // Mock store location if not provided
      const storeLat = 33.3225;
      const storeLng = 44.3685;
      if (storeMarkerRef.current) {
        storeMarkerRef.current.setLatLng([storeLat, storeLng]);
      } else {
        const storeIcon = L.divIcon({
          className: 'custom-store-marker',
          html: `
            <div style="width: 32px; height: 32px; background: #EF4444; border: 2px solid white; border-radius: 8px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        storeMarkerRef.current = L.marker([storeLat, storeLng], { icon: storeIcon }).addTo(map);
      }
    }

    // 4. Courier Marker
    if (courierLocation?.isSharingEnabled) {
      if (courierMarkerRef.current) {
        courierMarkerRef.current.setLatLng([courierLocation.lat, courierLocation.lng]);
      } else {
        const courierIcon = L.divIcon({
          className: 'custom-courier-marker',
          html: `
            <div style="width: 32px; height: 32px; background: #172554; border: 2px solid #F47721; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 8px rgba(0,0,0,0.4);">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F47721" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="5.5" cy="17.5" r="2.5"/><circle cx="18.5" cy="17.5" r="2.5"/>
                <path d="M15 6h2.5l2 4h-5zM9 18h6M12 9v9"/>
              </svg>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        courierMarkerRef.current = L.marker([courierLocation.lat, courierLocation.lng], { icon: courierIcon }).addTo(map);
      }
    } else {
      if (courierMarkerRef.current) {
        courierMarkerRef.current.remove();
        courierMarkerRef.current = null;
      }
    }

    // Adjust view if needed
    if (!isInteractivePicker && mapInstanceRef.current) {
      const group = L.featureGroup([
        customerMarkerRef.current,
        storeMarkerRef.current,
        courierMarkerRef.current
      ].filter(Boolean) as L.Marker[]);
      if (group.getLayers().length > 0) {
        mapInstanceRef.current.fitBounds(group.getBounds(), { padding: [50, 50] });
      }
    }

  }, [currentCoords, courierLocation, pricingSettings, isInteractivePicker, status]);

  // Real Geolocation API request
  const requestRealLocation = () => {
    if (!navigator.geolocation) {
      setGpsStatus('denied');
      setAccuracyNotice('متصفحك لا يدعم خدمة تحديد المواقع الجغرافية.');
      return;
    }

    setGpsStatus('requesting');
    setAccuracyNotice('جاري طلب إذن الموقع من جهازك...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;

        if (!isInsideIraq(latitude, longitude)) {
          setGpsStatus('out_of_bounds');
          setAccuracyNotice('تنبيه: أنت حالياً خارج نطاق الخدمة في العراق.');
        } else if (accuracy > 1000) {
          setGpsStatus('weak');
          setAccuracyNotice(`دقة الموقع منخفضة (±${Math.round(accuracy)} م). يرجى التأكد يدوياً.`);
        } else {
          setGpsStatus('acquired');
          setAccuracyNotice(`تم تحديد موقعك بنجاح بدقة ±${Math.round(accuracy)} متر.`);
        }

        const newCoords: LocationCoordinates = {
          lat: latitude,
          lng: longitude,
          accuracy: Math.round(accuracy),
          isManualPin: false,
          verifiedAt: new Date().toLocaleTimeString('ar-IQ'),
        };

        updateLocation(newCoords);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([latitude, longitude], 16);
        }
      },
      (err) => {
        setGpsStatus('denied');
        let msg = 'تعذر الوصول للموقع.';
        if (err.code === err.PERMISSION_DENIED) msg = 'تم رفض إذن الوصول للموقع.';
        else if (err.code === err.POSITION_UNAVAILABLE) msg = 'إشارة GPS غير متوفرة.';
        else if (err.code === err.TIMEOUT) msg = 'انتهت مهلة طلب الموقع.';
        setAccuracyNotice(msg + ' يرجى التحديد يدوياً على الخريطة.');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  // Check if current selection is in service area
  const { isInArea } = isLocationInServiceArea(currentCoords, pricingSettings);

  const openExternalMap = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${currentCoords.lat},${currentCoords.lng}`;
    window.open(url, '_blank');
  };

  return (
    <div className="w-full bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-lg flex flex-col">
      {/* Top Map Bar */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <span className="font-extrabold text-xs block text-slate-800">تحديد موقع التوصيل</span>
            <span className="text-[10px] text-slate-500 font-mono">
              {currentCoords.lat.toFixed(5)}, {currentCoords.lng.toFixed(5)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isInteractivePicker && (
            <button
              onClick={requestRealLocation}
              disabled={gpsStatus === 'requesting'}
              className="px-3 py-1.5 bg-[#F47721] hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <Crosshair className={`w-3.5 h-3.5 ${gpsStatus === 'requesting' ? 'animate-spin' : ''}`} />
              <span>{gpsStatus === 'requesting' ? 'جاري الفحص...' : 'موقعي الحالي'}</span>
            </button>
          )}

          <button
            onClick={openExternalMap}
            className="p-1.5 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-slate-600 transition-colors"
            title="فتح في خرائط خارجية"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Accuracy & Service Area Status */}
      {(accuracyNotice || !isInArea) && (
        <div
          className={`px-4 py-2 text-[11px] flex items-center gap-2 border-b ${
            !isInArea
              ? 'bg-rose-50 text-rose-700 border-rose-100'
              : gpsStatus === 'acquired'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
              : 'bg-amber-50 text-amber-700 border-amber-100'
          }`}
        >
          {!isInArea ? (
            <ShieldAlert className="w-4 h-4 shrink-0" />
          ) : gpsStatus === 'acquired' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span className="font-bold">
            {!isInArea ? 'عذراً، التوصيل غير متوفر في موقعك حالياً' : accuracyNotice}
          </span>
        </div>
      )}

      {/* Map Area */}
      <div className="relative w-full h-[320px] sm:h-[400px] z-0">
        <div ref={mapContainerRef} className="w-full h-full" />
        
        {isInteractivePicker && (
          <div className="absolute bottom-3 left-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-xl border border-slate-200 text-[10px] text-slate-600 flex items-center justify-between pointer-events-none shadow-sm z-[1000]">
            <span>يمكنك سحب العلامة أو الضغط على الخريطة</span>
            <span className="text-orange-600 font-bold">دبوس تحديد دقيق</span>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 bg-slate-50 text-xs border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-600 truncate max-w-[250px]">
            {customerAddress}
          </span>
        </div>
        
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <Info className="w-3.5 h-3.5" />
          <span>تأكد من وضع الدبوس فوق باب منزلك تماماً</span>
        </div>
      </div>
    </div>
  );
};

export default RealInteractiveMap;
