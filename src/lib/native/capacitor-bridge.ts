/**
 * Native bridge — thin wrappers around Capacitor plugins.
 *
 * Every helper is safe to call from the web build too: when Capacitor isn't
 * present (i.e. we're running in a desktop browser), the helpers fall back
 * to web equivalents OR return a graceful "no-op" answer.
 *
 * Usage from React components:
 *
 *   import { isNative, scanQrCode, biometricLogin } from "@/lib/native/capacitor-bridge";
 *
 *   if (isNative()) {
 *     const code = await scanQrCode();
 *     // …
 *   }
 *
 * No npm imports happen at module top-level — every plugin is loaded via
 * dynamic import so the web bundle stays small.
 */
"use client";

/** True when the page is running inside the Capacitor native shell. */
export function isNative(): boolean {
  if (typeof window === "undefined") return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return !!(window as any).Capacitor?.isNativePlatform?.();
}

/** Current platform: "ios" | "android" | "web". */
export function getPlatform(): "ios" | "android" | "web" {
  if (typeof window === "undefined") return "web";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((window as any).Capacitor?.getPlatform?.() ?? "web") as
    | "ios" | "android" | "web";
}

// ============================================================
// QR Scanner — used by visitor check-in + unit barcode lookup
// ============================================================
export async function scanQrCode(): Promise<string | null> {
  if (!isNative()) {
    // Fallback: use the device camera via the web BarcodeDetector API
    // when available, otherwise return null and let the caller show a
    // manual input.
    return await webBarcodeFallback();
  }
  try {
    const { BarcodeScanner } = await import("@capacitor-mlkit/barcode-scanning");
    const supported = await BarcodeScanner.isSupported();
    if (!supported.supported) return null;
    const perm = await BarcodeScanner.checkPermissions();
    if (perm.camera !== "granted") {
      const req = await BarcodeScanner.requestPermissions();
      if (req.camera !== "granted") return null;
    }
    const { barcodes } = await BarcodeScanner.scan();
    return barcodes[0]?.rawValue ?? null;
  } catch (e) {
    console.warn("[native] scanQrCode failed:", e);
    return null;
  }
}

async function webBarcodeFallback(): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const BarcodeDetector = (window as any).BarcodeDetector;
  if (!BarcodeDetector) return null;
  // We can't open a camera modal from this helper — caller handles UI.
  return null;
}

// ============================================================
// Biometric login — Face ID / Touch ID
// ============================================================
export interface BiometricResult {
  ok: boolean;
  reason?: string;
}

export async function biometricLogin(reason: string): Promise<BiometricResult> {
  if (!isNative()) return { ok: false, reason: "not-native" };
  try {
    const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
    const info = await BiometricAuth.checkBiometry();
    if (!info.isAvailable) return { ok: false, reason: info.reason ?? "unavailable" };
    await BiometricAuth.authenticate({
      reason,
      cancelTitle: "إلغاء",
      iosFallbackTitle: "استخدم رمز المرور",
      androidTitle: reason,
      androidSubtitle: "تأكيد الهوية",
      androidConfirmationRequired: false,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "denied" };
  }
}

// ============================================================
// Camera + Photo upload — for maintenance tickets, ID photos, etc.
// ============================================================
export async function takePhoto(): Promise<Blob | null> {
  if (!isNative()) {
    // Web fallback: use <input type="file" accept="image/*" capture="environment">
    // handled by the caller.
    return null;
  }
  try {
    const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
    });
    if (!photo.webPath) return null;
    const blob = await fetch(photo.webPath).then((r) => r.blob());
    return blob;
  } catch (e) {
    console.warn("[native] takePhoto failed:", e);
    return null;
  }
}

// ============================================================
// Haptic feedback — small but elevates the native feel.
// ============================================================
export async function haptic(style: "light" | "medium" | "heavy" = "light"): Promise<void> {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    const styleMap = {
      light:  ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy:  ImpactStyle.Heavy,
    } as const;
    await Haptics.impact({ style: styleMap[style] });
  } catch { /* swallow */ }
}

// ============================================================
// Share — native share sheet (receipts, contracts, QR codes)
// ============================================================
export async function shareNative(opts: { title?: string; text?: string; url?: string }): Promise<boolean> {
  if (!isNative()) {
    // Web fallback
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (navigator as any).share(opts);
        return true;
      } catch { return false; }
    }
    return false;
  }
  try {
    const { Share } = await import("@capacitor/share");
    await Share.share(opts);
    return true;
  } catch (e) {
    console.warn("[native] share failed:", e);
    return false;
  }
}

// ============================================================
// Network status — for offline UI
// ============================================================
export async function isOnline(): Promise<boolean> {
  if (!isNative()) return typeof navigator === "undefined" ? true : navigator.onLine;
  try {
    const { Network } = await import("@capacitor/network");
    const status = await Network.getStatus();
    return status.connected;
  } catch {
    return true;
  }
}

// ============================================================
// Persistent storage — survives across launches (offline cache)
// ============================================================
export async function setCached(key: string, value: unknown): Promise<void> {
  if (!isNative()) {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, JSON.stringify(value));
    }
    return;
  }
  try {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key, value: JSON.stringify(value) });
  } catch { /* swallow */ }
}

export async function getCached<T = unknown>(key: string): Promise<T | null> {
  if (!isNative()) {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }
  try {
    const { Preferences } = await import("@capacitor/preferences");
    const res = await Preferences.get({ key });
    return res.value ? (JSON.parse(res.value) as T) : null;
  } catch { return null; }
}
