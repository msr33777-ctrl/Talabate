import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocationCoordinates } from '../../types';

interface AdminServiceAreaMapProps {
  center: LocationCoordinates;
  radiusKm: number;
  onCenterChange: (coords: LocationCoordinates) => void;
  className?: string;
}

export const AdminServiceAreaMap: React.FC<AdminServiceAreaMapProps> = ({
  center,
  radiusKm,
  onCenterChange,
  className = 'w-full h-[400px] rounded-2xl overflow-hidden shadow-inner border border-slate-200',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [center.lat, center.lng],
        zoom: 12,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      // Handle map click to move center
      map.on('click', (e: L.LeafletMouseEvent) => {
        onCenterChange({
          lat: e.latlng.lat,
          lng: e.latlng.lng,
          isManualPin: true,
        });
      });

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Sync circle and marker with props
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Update or create marker
    if (markerRef.current) {
      markerRef.current.setLatLng([center.lat, center.lng]);
    } else {
      const icon = L.divIcon({
        className: 'service-area-marker',
        html: `
          <div style="width: 40px; height: 40px; background: #059669; border: 3px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });
      markerRef.current = L.marker([center.lat, center.lng], { icon }).addTo(map);
    }

    // Update or create circle
    if (circleRef.current) {
      circleRef.current.setLatLng([center.lat, center.lng]);
      circleRef.current.setRadius(radiusKm * 1000);
    } else {
      circleRef.current = L.circle([center.lat, center.lng], {
        radius: radiusKm * 1000,
        color: '#10B981',
        fillColor: '#10B981',
        fillOpacity: 0.2,
        weight: 2,
      }).addTo(map);
    }

    // Adjust view to fit circle
    const bounds = circleRef.current.getBounds();
    map.fitBounds(bounds, { padding: [20, 20] });

  }, [center, radiusKm]);

  return (
    <div className={`relative ${className} z-0`}>
      <div ref={mapContainerRef} className="w-full h-full" />
      <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-xl text-[10px] font-bold text-slate-700 shadow-sm border border-slate-200 flex items-center gap-1.5 z-10 pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>انقر على الخريطة لتغيير مركز التوصيل</span>
      </div>
    </div>
  );
};
