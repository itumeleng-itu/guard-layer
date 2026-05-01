import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

// Map of ISO country codes → currency info
const COUNTRY_CURRENCY_MAP: Record<string, { code: string; flag: string; symbol: string }> = {
  ZA: { code: 'ZAR', flag: '🇿🇦', symbol: 'R' },
  NG: { code: 'NGN', flag: '🇳🇬', symbol: '₦' },
  KE: { code: 'KES', flag: '🇰🇪', symbol: 'KSh' },
  GH: { code: 'GHS', flag: '🇬🇭', symbol: 'GH₵' },
  TZ: { code: 'TZS', flag: '🇹🇿', symbol: 'TSh' },
  UG: { code: 'UGX', flag: '🇺🇬', symbol: 'USh' },
  RW: { code: 'RWF', flag: '🇷🇼', symbol: 'FRw' },
  ET: { code: 'ETB', flag: '🇪🇹', symbol: 'Br' },
  EG: { code: 'EGP', flag: '🇪🇬', symbol: 'E£' },
  MA: { code: 'MAD', flag: '🇲🇦', symbol: 'MAD' },
  GB: { code: 'GBP', flag: '🇬🇧', symbol: '£' },
  US: { code: 'USD', flag: '🇺🇸', symbol: '$' },
  IN: { code: 'INR', flag: '🇮🇳', symbol: '₹' },
  BR: { code: 'BRL', flag: '🇧🇷', symbol: 'R$' },
  MZ: { code: 'MZN', flag: '🇲🇿', symbol: 'MT' },
  BW: { code: 'BWP', flag: '🇧🇼', symbol: 'P' },
  ZM: { code: 'ZMW', flag: '🇿🇲', symbol: 'ZK' },
  MW: { code: 'MWK', flag: '🇲🇼', symbol: 'MK' },
  NA: { code: 'NAD', flag: '🇳🇦', symbol: 'N$' },
  SZ: { code: 'SZL', flag: '🇸🇿', symbol: 'E' },
  LS: { code: 'LSL', flag: '🇱🇸', symbol: 'L' },
};

const DEFAULT_CURRENCY = { code: 'ZAR', flag: '🇿🇦', symbol: 'R' };

export interface LocationInfo {
  city: string;
  countryCode: string;
  currency: { code: string; flag: string; symbol: string };
  coords: { latitude: number; longitude: number } | null;
  loading: boolean;
}

export function useUserLocation(): LocationInfo {
  const [info, setInfo] = useState<LocationInfo>({
    city: 'Loading...',
    countryCode: 'ZA',
    currency: DEFAULT_CURRENCY,
    coords: null,
    loading: true,
  });

  useEffect(() => {
    async function fetchLocation() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setInfo(prev => ({
            ...prev,
            city: 'Location denied',
            loading: false,
          }));
          return;
        }

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const [place] = await Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });

        if (place) {
          const city = place.city || place.subregion || place.region || 'Unknown';
          const countryCode = place.isoCountryCode || 'ZA';
          const currency = COUNTRY_CURRENCY_MAP[countryCode] || DEFAULT_CURRENCY;

          setInfo({
            city: `${city}, ${countryCode}`,
            countryCode,
            currency,
            coords: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            },
            loading: false,
          });
        }
      } catch {
        setInfo(prev => ({
          ...prev,
          city: 'Johannesburg, ZA',
          loading: false,
        }));
      }
    }

    fetchLocation();
  }, []);

  return info;
}
