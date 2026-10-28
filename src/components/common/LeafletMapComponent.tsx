import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { LocationCoordinates } from '../../types';

interface LeafletMapComponentProps {
  captainCoords: LocationCoordinates;
  restaurantCoords?: LocationCoordinates;
  customerCoords?: LocationCoordinates;
  storeName?: string;
  customerName?: string;
  showRoute?: boolean;
  className?: string;
  onDistanceCalculated?: (distanceKm: number, durationMins: number) => void;
}

export const LeafletMapComponent: React.FC<LeafletMapComponentProps> = ({
  captainCoords,
  restaurantCoords = { lat: 33.3225, lng: 44.3685 }, // Baghdad - Palestine Street
  customerCoords = { lat: 33.3080, lng: 44.3410 },   // Baghdad - University Street
  storeName = 'مطعم البيتزا الإيطالي',
  customerName = 'الزبون',
  showRoute = true,
  className = 'w-full h-full min-h-[350px]',
  onDistanceCalculated,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersGroupRef = useRef<L.LayerGroup | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [isOsrmLoading, setIsOsrmLoading] = useState<boolean>(false);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    try {
      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [captainCoords.lat, captainCoords.lng],
          zoom: 14,
          zoomControl: false,
          attributionControl: true,
        });

        // OpenStreetMap Tile Layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);

        // Layer group for dynamic markers and polylines
        const layerGroup = L.layerGroup().addTo(map);
        layersGroupRef.current = layerGroup;
        mapInstanceRef.current = map;
      }
    } catch (err: any) {
      console.error('Failed to initialize Leaflet Map:', err);
      setLoadError('تعذر تحميل الخريطة. يرجى التأكد من تشغيل الشبكة.');
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Markers & Fetch OSRM Route
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = layersGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    const capLat = captainCoords.lat;
    const capLng = captainCoords.lng;
    const restLat = restaurantCoords.lat;
    const restLng = restaurantCoords.lng;
    const custLat = customerCoords.lat;
    const custLng = customerCoords.lng;

    // 1. Captain Scooter Marker Icon (SVG)
    const captainIcon = L.divIcon({
      className: 'custom-leaflet-marker',
      html: `
        <div style="width: 44px; height: 44px; background: #1E293B; border: 3px solid #E11D48; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3);">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="5.5" cy="17.5" r="2.5"/><circle cx="18.5" cy="17.5" r="2.5"/>
            <path d="M15 6h2.5l2 4h-5zM9 18h6M12 9v9"/>
          </svg>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });

    const capMarker = L.marker([capLat, capLng], { icon: captainIcon })
      .bindPopup(`<b>كابتن التوصيل</b><br>موقعك الحالي`)
      .addTo(layerGroup);

    // 2. Restaurant Marker Icon (Red Pin)
    const storeIcon = L.divIcon({
      className: 'custom-leaflet-marker',
      html: `
        <div style="width: 38px; height: 48px; display: flex; flex-direction: column; align-items: center;">
          <div style="width: 38px; height: 38px; background: #E11D48; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; border: 2px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7 6 13 6 13s6-6 6-13z"/><circle cx="12" cy="8" r="2"/></svg>
          </div>
          <div style="width: 2px; height: 10px; background: #E11D48;"></div>
        </div>
      `,
      iconSize: [38, 48],
      iconAnchor: [19, 48],
    });

    L.marker([restLat, restLng], { icon: storeIcon })
      .bindPopup(`<b>المطعم</b><br>${storeName}`)
      .addTo(layerGroup);

    // 3. Customer Marker Icon (Green Pin)
    const customerIcon = L.divIcon({
      className: 'custom-leaflet-marker',
      html: `
        <div style="width: 38px; height: 48px; display: flex; flex-direction: column; align-items: center;">
          <div style="width: 38px; height: 38px; background: #16A34A; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; border: 2px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
          </div>
          <div style="width: 2px; height: 10px; background: #16A34A;"></div>
        </div>
      `,
      iconSize: [38, 48],
      iconAnchor: [19, 48],
    });

    L.marker([custLat, custLng], { icon: customerIcon })
      .bindPopup(`<b>الزبون</b><br>${customerName}`)
      .addTo(layerGroup);

    // 4. Draw OSRM Driving Route
    if (showRoute) {
      setIsOsrmLoading(true);
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${restLng},${restLat};${capLng},${capLat};${custLng},${custLat}?overview=full&geometries=geojson`;

      fetch(osrmUrl)
        .then((res) => res.json())
        .then((data) => {
          setIsOsrmLoading(false);
          if (data && data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const coordinates = route.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]] as [number, number]);

            const polyline = L.polyline(coordinates, {
              color: '#2563EB', // Navigation Blue
              weight: 5,
              opacity: 0.85,
            }).addTo(layerGroup);

            map.fitBounds(polyline.getBounds(), { padding: [40, 40] });

            const distKm = Math.round((route.distance / 1000) * 10) / 10 || 2.8;
            const durationMins = Math.round(route.duration / 60) || 12;

            if (onDistanceCalculated) {
              onDistanceCalculated(distKm, durationMins);
            }
          } else {
            // Fallback straight line if OSRM returns empty
            const fallbackPath: [number, number][] = [
              [restLat, restLng],
              [capLat, capLng],
              [custLat, custLng],
            ];
            const polyline = L.polyline(fallbackPath, { color: '#2563EB', weight: 4, dashArray: '6, 6' }).addTo(layerGroup);
            map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
          }
        })
        .catch((err) => {
          console.warn('OSRM routing fetch warning, fallback to straight line:', err);
          setIsOsrmLoading(false);
          const fallbackPath: [number, number][] = [
            [restLat, restLng],
            [capLat, capLng],
            [custLat, custLng],
          ];
          const polyline = L.polyline(fallbackPath, { color: '#2563EB', weight: 4, dashArray: '6, 6' }).addTo(layerGroup);
          map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
        });
    } else {
      map.setView([capLat, capLng], 14);
    }
  }, [captainCoords, restaurantCoords, customerCoords, showRoute]);

  return (
    <div className={`relative ${className}`}>
      {/* Leaflet Container */}
      <div ref={mapContainerRef} className="w-full h-full rounded-2xl overflow-hidden min-h-[300px] shadow-inner bg-slate-100 z-0" />

      {/* OSRM Loading Badge */}
      {isOsrmLoading && (
        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-slate-700 shadow-md border border-slate-200 flex items-center gap-1.5 z-10">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
          <span>جاري رسم المسار الفعلي (OSRM)...</span>
        </div>
      )}

      {/* Error Banner */}
      {loadError && (
        <div className="absolute inset-0 bg-slate-900/90 text-white flex flex-col items-center justify-center p-6 text-center space-y-2 z-20">
          <span className="text-3xl">🗺️</span>
          <p className="font-bold text-sm text-rose-400">{loadError}</p>
        </div>
      )}
    </div>
  );
};
