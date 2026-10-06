// ── SINGLE SOURCE OF TRUTH for app versions ─────────────────────────────
// Each platform keeps its OWN version lineage; apps/update-config.cjs (run on
// every build) syncs these into Android build.gradle and the iOS pbxproj.
export const APP_VERSION_ANDROID = "2.6.5"; // Android versionName
export const APP_VERSION_IOS = "1.0.1"; // iOS MARKETING_VERSION (own lineage)
export const BUILD_ANDROID = 33; // Android versionCode counter
export const BUILD_IOS = 5; // iOS CURRENT_PROJECT_VERSION counter
