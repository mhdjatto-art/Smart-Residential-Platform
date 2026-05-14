/**
 * Capacitor configuration — generated PER ORGANIZATION at build time.
 *
 * The values below are templated. The `scripts/build-org-app.sh` script
 * reads each organization's row from `public.organizations` + `public.organization_branding`
 * and replaces the placeholders before invoking `npx cap sync`.
 *
 * Defaults here target the umbrella "Bonyan" demo app — useful while
 * developing the native shell locally before any org is provisioned.
 *
 * Required env vars at build time:
 *   ORG_SLUG          — e.g. "bonyan"          (defaults to "bonyan")
 *   ORG_NAME          — e.g. "Bonyan Residents"
 *   ORG_BUNDLE_ID     — e.g. "app.bonyan.bonyan"
 *   ORG_SERVER_URL    — e.g. "https://bonyan.bonyan.app/m"
 *
 * See docs/MOBILE_APPS_SETUP.md for the full pipeline.
 */
import type { CapacitorConfig } from "@capacitor/cli";

const orgSlug     = process.env.ORG_SLUG     ?? "bonyan";
const orgName     = process.env.ORG_NAME     ?? "Bonyan Residents";
const orgBundleId = process.env.ORG_BUNDLE_ID ?? `app.bonyan.${orgSlug}`;
const orgServerUrl = process.env.ORG_SERVER_URL ?? "https://www.bonyan.app/m";

const isDev = process.env.NODE_ENV !== "production";

const config: CapacitorConfig = {
  appId:   orgBundleId,
  appName: orgName,

  // The static shell we ship inside the binary. Keep the path small —
  // it's just an HTML entry point + the JS shim that boots the WebView
  // pointing at our hosted /m routes. The shell is built into `mobile/dist`.
  webDir:  "mobile/dist",

  // Hybrid mode — the static shell handles boot + offline fallback, then
  // hands off to the live web app on first online connect.
  server: {
    url: orgServerUrl,
    cleartext: false,
    // Allow our own subdomains + Supabase + Stripe + the Iraqi gateways.
    allowNavigation: [
      `${orgSlug}.bonyan.app`,
      "www.bonyan.app",
      "*.supabase.co",
      "checkout.stripe.com",
      "*.nass.iq",
      "*.fast-pay.iq",
      "*.zaincash.iq",
      "*.asiahawala.com",
      "*.qi.iq",
    ],
    // Use HTTPS — Apple requires it for App Transport Security.
    iosScheme: "https",
    androidScheme: "https",
  },

  // iOS-specific tuning
  ios: {
    contentInset: "always",
    backgroundColor: "#ffffff",
    // Make the WebView respect safe areas (notch, dynamic island).
    preferredContentMode: "mobile",
  },

  // Android-specific tuning
  android: {
    backgroundColor: "#ffffff",
    // Allow loading from our HTTPS subdomains.
    allowMixedContent: false,
    captureInput: true,
    // Status bar color — matches our default theme. Overridden per-org
    // at build time when ORG_THEME_COLOR is set.
    overrideUserAgent: undefined,
  },

  // Splash screen — extended timing while we boot the shell and connect.
  // Real images live under `mobile/resources/` and are regenerated per
  // organization by the build script.
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: process.env.ORG_THEME_COLOR ?? "#0F172A",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: true,
      spinnerColor: "#ffffff",
    },
    PushNotifications: {
      // Channel description shown in Android settings.
      presentationOptions: ["badge", "sound", "alert"],
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: process.env.ORG_THEME_COLOR ?? "#0F172A",
      overlaysWebView: false,
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
    // ML Kit barcode scanner — used for visitor QR codes + unit barcodes.
    BarcodeScanner: {
      // Configured at runtime, not here.
    },
  },

  // Logging — quiet by default in release, chatty in dev so we can debug.
  loggingBehavior: isDev ? "debug" : "production",
};

export default config;
