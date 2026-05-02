/**
 * Device-Native Biometric Authentication Hook
 *
 * Uses expo-local-authentication to leverage the device's built-in
 * biometric hardware (Face ID, Touch ID, fingerprint sensor, iris scanner).
 *
 * This replaces any third-party biometric service (e.g. SmileID) with the
 * OS-level secure enclave, which is:
 *   - Faster (no network round-trip)
 *   - More private (biometric data never leaves the device)
 *   - Cross-platform (iOS Face ID / Touch ID, Android fingerprint / face)
 */
import { useState, useEffect, useCallback } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';

export type BiometricType = 'face' | 'fingerprint' | 'iris' | 'none';

export interface BiometricCapability {
  /** Whether the device has any biometric hardware */
  hasHardware: boolean;
  /** Whether the user has enrolled at least one biometric credential */
  isEnrolled: boolean;
  /** The primary biometric type available */
  biometricType: BiometricType;
  /** Human-friendly label for the biometric type (e.g. "Face ID") */
  label: string;
  /** Whether the capability check is still loading */
  isLoading: boolean;
}

export interface AuthenticateOptions {
  /** Prompt message shown to the user */
  promptMessage?: string;
  /** Label for the fallback (passcode) button */
  fallbackLabel?: string;
  /** Label for the cancel button */
  cancelLabel?: string;
  /** Whether to allow device passcode as fallback (default: true) */
  disableDeviceFallback?: boolean;
}

export interface AuthenticateResult {
  success: boolean;
  error?: string;
}

/**
 * Map expo's AuthenticationType enum to a friendly type string
 */
function mapBiometricType(types: LocalAuthentication.AuthenticationType[]): BiometricType {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'face';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'fingerprint';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return 'iris';
  }
  return 'none';
}

function getLabelForType(type: BiometricType): string {
  switch (type) {
    case 'face': return 'Face ID';
    case 'fingerprint': return 'Fingerprint';
    case 'iris': return 'Iris Scan';
    case 'none': return 'Passcode';
  }
}

/**
 * Hook to query the device's biometric capabilities.
 * Automatically checks on mount and whenever the component re-renders.
 */
export function useBiometricCapability(): BiometricCapability {
  const [capability, setCapability] = useState<BiometricCapability>({
    hasHardware: false,
    isEnrolled: false,
    biometricType: 'none',
    label: 'Passcode',
    isLoading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        const biometricType = mapBiometricType(types);
        const label = getLabelForType(biometricType);

        if (!cancelled) {
          setCapability({ hasHardware, isEnrolled, biometricType, label, isLoading: false });
        }
      } catch {
        if (!cancelled) {
          setCapability(prev => ({ ...prev, isLoading: false }));
        }
      }
    }

    check();
    return () => { cancelled = true; };
  }, []);

  return capability;
}

/**
 * Hook that returns an `authenticate` function to trigger
 * device-native biometric verification.
 *
 * Usage:
 * ```tsx
 * const { authenticate } = useBiometricAuth();
 * const result = await authenticate({ promptMessage: 'Confirm payment' });
 * if (result.success) { /* proceed *\/ }
 * ```
 */
export function useBiometricAuth() {
  const capability = useBiometricCapability();

  const authenticate = useCallback(
    async (options?: AuthenticateOptions): Promise<AuthenticateResult> => {
      try {
        // Always prompt authentication — if biometrics aren't available
        // the OS will automatically fall back to device passcode / PIN.
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: options?.promptMessage ?? 'Verify your identity',
          fallbackLabel: options?.fallbackLabel ?? 'Use passcode',
          cancelLabel: options?.cancelLabel ?? 'Cancel',
          // Never disable device fallback — passcode is our safety net
          disableDeviceFallback: false,
        });

        if (result.success) {
          return { success: true };
        }

        return {
          success: false,
          error: result.error ?? 'Authentication failed',
        };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Unexpected biometric error',
        };
      }
    },
    [],
  );

  return { authenticate, capability };
}
