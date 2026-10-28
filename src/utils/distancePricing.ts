import { PlatformPricingSettings, Store, LocationCoordinates } from '../types';

export interface RouteDistanceResult {
  success: boolean;
  distanceKm?: number;
  durationMinutes?: number;
  routeGeometry?: any;
  serviceUsed?: 'osrm' | 'google_maps' | 'straight_line_estimate';
  error?: string;
}

// Baghdad default center (Al-Mansour)
export const DEFAULT_BAGHDAD_COORDS = { lat: 33.3130, lng: 44.3512 };

// Known neighborhood coordinate centroids in Iraq for fallback resolution
export const NEIGHBORHOOD_COORDS: Record<string, { lat: number; lng: number }> = {
  'سبع البور': { lat: 33.4632, lng: 44.1508 },
  'بغداد - سبع البور': { lat: 33.4632, lng: 44.1508 },
  'المنصور': { lat: 33.3130, lng: 44.3512 },
  'بغداد - المنصور': { lat: 33.3130, lng: 44.3512 },
  'الكرادة': { lat: 33.3055, lng: 44.4225 },
  'بغداد - الكرادة': { lat: 33.3055, lng: 44.4225 },
  'الجادرية': { lat: 33.2842, lng: 44.3820 },
  'بغداد - الجادرية': { lat: 33.2842, lng: 44.3820 },
  'زيونة': { lat: 33.3289, lng: 44.4410 },
  'بغداد - زيونة': { lat: 33.3289, lng: 44.4410 },
  'الأعظمية': { lat: 33.3710, lng: 44.3580 },
  'بغداد - الأعظمية': { lat: 33.3710, lng: 44.3580 },
  'حي الجامعة': { lat: 33.3260, lng: 44.3210 },
  'اليرموك': { lat: 33.3005, lng: 44.3415 },
  'شارع فلسطين': { lat: 33.3450, lng: 44.4290 },
  'عينكاوة': { lat: 36.2230, lng: 43.9930 },
  'أربيل - عينكاوة': { lat: 36.2230, lng: 43.9930 },
  'العشار': { lat: 30.5085, lng: 47.8130 },
  'البصرة - العشار': { lat: 30.5085, lng: 47.8130 },
};

/**
 * Resolves coordinates for a store, using its explicit coordinates or neighborhood centroid
 */
export function getStoreCoordinates(store: Partial<Store>): { lat: number; lng: number } {
  if (store.coordinates?.lat && store.coordinates?.lng) {
    return { lat: store.coordinates.lat, lng: store.coordinates.lng };
  }

  const neighborhood = store.neighborhood?.trim() || '';
  if (neighborhood && NEIGHBORHOOD_COORDS[neighborhood]) {
    return NEIGHBORHOOD_COORDS[neighborhood];
  }

  for (const [key, coords] of Object.entries(NEIGHBORHOOD_COORDS)) {
    if (neighborhood.includes(key) || (store.address && store.address.includes(key))) {
      return coords;
    }
  }

  return DEFAULT_BAGHDAD_COORDS;
}

/**
 * Calculates delivery fee based on road distance and admin pricing settings.
 * Formula: deliveryFee = baseFee + (distanceKm * feePerKm)
 * Capped at: maxFee (cannot exceed maxFee regardless of distance)
 *
 * User specification:
 * - Default Base Fee = 1,500 IQD
 * - Default Fee Per Km = 250 IQD
 * - Default Max Fee = 5,000 IQD
 *
 * Examples:
 * 1 km = 1,750 IQD
 * 2 km = 2,000 IQD
 * 5 km = 2,750 IQD
 * 10 km = 4,000 IQD
 * 14 km = 5,000 IQD
 * 20 km = 5,000 IQD (capped)
 */
export function computeDistanceDeliveryFee(
  distanceKm: number,
  settings?: Partial<PlatformPricingSettings>
): number {
  const baseFee = settings?.distanceBaseFee ?? 1500;
  const feePerKm = settings?.distanceFeePerKm ?? 250;
  const maxFee = settings?.distanceMaxFee ?? 5000;

  if (distanceKm <= 0) {
    return baseFee;
  }

  const rawFee = baseFee + distanceKm * feePerKm;
  // Round to nearest 50 IQD
  const rounded = Math.round(rawFee / 50) * 50;
  return Math.min(maxFee, rounded);
}

/**
 * Computes road network distance between store and customer location
 * Uses real routing services (OSRM road network API, and Google Directions when available).
 * If calculation fails or coordinates are missing, returns an explicit error without guessing.
 */
export async function calculateRouteDistance(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<RouteDistanceResult> {
  // 1. Validation check
  if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
    return {
      success: false,
      error: 'إحداثيات نقطة الانطلاق أو التوصيل غير محددة بدقة.',
    };
  }

  // Check valid coordinates range
  if (
    isNaN(origin.lat) ||
    isNaN(origin.lng) ||
    isNaN(destination.lat) ||
    isNaN(destination.lng) ||
    Math.abs(origin.lat) > 90 ||
    Math.abs(destination.lat) > 90
  ) {
    return {
      success: false,
      error: 'إحداثيات الموقع غير صالحة.',
    };
  }

  // 2. Try Google Maps Directions / DistanceMatrix Service if available in window
  if (typeof window !== 'undefined' && (window as any).google?.maps?.DistanceMatrixService) {
    try {
      const googleService = new (window as any).google.maps.DistanceMatrixService();
      const googleResult: any = await new Promise((resolve, reject) => {
        googleService.getDistanceMatrix(
          {
            origins: [{ lat: origin.lat, lng: origin.lng }],
            destinations: [{ lat: destination.lat, lng: destination.lng }],
            travelMode: (window as any).google.maps.TravelMode.DRIVING,
          },
          (response: any, status: string) => {
            if (status === 'OK' && response?.rows?.[0]?.elements?.[0]?.status === 'OK') {
              resolve(response.rows[0].elements[0]);
            } else {
              reject(new Error(status));
            }
          }
        );
      });

      if (googleResult && googleResult.distance?.value) {
        const meters = googleResult.distance.value;
        const seconds = googleResult.duration?.value || 0;
        const distanceKm = Math.round((meters / 1000) * 10) / 10;
        const durationMinutes = Math.max(1, Math.round(seconds / 60));
        return {
          success: true,
          distanceKm,
          durationMinutes,
          serviceUsed: 'google_maps',
        };
      }
    } catch {
      // Fall through to OSRM
    }
  }

  // 3. Query OSRM Driving Routing API (Real road network)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4-second timeout

    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false`;
    const response = await fetch(osrmUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const primaryRoute = data.routes[0];
        const distanceMeters = primaryRoute.distance; // in meters along roads
        const durationSeconds = primaryRoute.duration; // in seconds

        const distanceKm = Math.max(0.1, Math.round((distanceMeters / 1000) * 10) / 10);
        const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));

        return {
          success: true,
          distanceKm,
          durationMinutes,
          serviceUsed: 'osrm',
        };
      }
    }
  } catch (err: any) {
    console.warn('OSRM route calculation unavailable or timed out:', err?.message || err);
  }

  // 4. Return explicit failure - as required: "إذا تعذّر حساب المسافة، لا تخمّن أجرة نهائية؛ اعرض رسالة واضحة"
  return {
    success: false,
    error: 'تعذّر الاتصال بخدمة مسارات الخرائط لقياس مسافة الطريق الفعلية. يرجى التأكد من اتصال الإنترنت وإعادة تحديد الموقع.',
  };
}

/**
 * Calculates straight line (Haversine) distance between two points in KM
 */
export function calculateStraightLineDistance(
  point1: { lat: number; lng: number },
  point2: { lat: number; lng: number }
): number {
  const R = 6371; // Earth's radius in KM
  const dLat = (point2.lat - point1.lat) * (Math.PI / 180);
  const dLng = (point2.lng - point1.lng) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(point1.lat * (Math.PI / 180)) *
      Math.cos(point2.lat * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Checks if a coordinate is within the designated platform service area
 */
export function isLocationInServiceArea(
  coords: { lat: number; lng: number },
  settings?: PlatformPricingSettings
): { isInArea: boolean; distanceKm: number; limitKm: number } {
  if (!settings?.serviceArea?.isEnabled) {
    return { isInArea: true, distanceKm: 0, limitKm: 0 };
  }

  const center = settings.serviceArea.center;
  const radius = settings.serviceArea.radiusKm;
  const distance = calculateStraightLineDistance(coords, center);

  return {
    isInArea: distance <= radius,
    distanceKm: distance,
    limitKm: radius
  };
}

