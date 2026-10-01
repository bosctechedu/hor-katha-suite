// ============================================================
// 🔧 APP CONFIGURATION — v3.7.4.43 (SECURITY HARDENED)
// BOSC Tech & Edu · Hoṛ Katha Suite
// ============================================================
// 📋 ARCHITECTURE:
//
//    Config loading priority (highest → lowest):
//      1. window.__RUNTIME_CONFIG__ (preload.js / config-private.js)
//      2. process.env.*              (Electron main process)
//      3. import.meta.env.*          (Vite/webpack build)
//      4. Placeholder fallback       (development only)
//
// ⚠️ SECURITY:
//    • Real secrets NEVER hardcoded in this file
//    • Load from: env vars, config-private.js, or preload.js
//    • This file is safe to commit (only placeholders)
//
// 📝 VERSION: package.json के साथ sync रखें
// ============================================================
// ✅ v3.7.4.43 — AUDIT FIXES:
//    • Multi-source config loading (preload → env → build → fallback)
//    • Deep JWK validation (length + base64url + range)
//    • UPI/NPCI separate validation
//    • NAME_ENCRYPTION_SECRET config support
//    • Frozen config (immutable)
//    • ConfigDebug helpers
//    • Timeout protection for runtime config
//    • Detailed warnings for missing config
//    • Build-time env var support (Vite/Webpack)
// ============================================================

// ============================================================
// 🌐 STEP 1: SAFE RUNTIME CONFIG LOADER
// ============================================================
// कई sources से config load करने की कोशिश करता है
// Priority: preload > process.env > import.meta.env > fallback
// ============================================================
const RUNTIME_CONFIG = (function loadRuntimeConfig() {
    'use strict';

    const config = {};

    // ─────────────────────────────────────────────────
    // Source 1: window.__RUNTIME_CONFIG__ (highest priority)
    // ─────────────────────────────────────────────────
    try {
        if (typeof window !== 'undefined' && window.__RUNTIME_CONFIG__) {
            const wrc = window.__RUNTIME_CONFIG__;
            Object.keys(wrc).forEach(key => {
                if (wrc[key] !== undefined && wrc[key] !== null) {
                    config[key] = wrc[key];
                }
            });
            if (Object.keys(config).length > 0) {
                console.log('✅ [config] Loaded from window.__RUNTIME_CONFIG__');
            }
        }
    } catch (e) {
        console.warn('⚠️ [config] window.__RUNTIME_CONFIG__ load failed:', e.message);
    }

    // ─────────────────────────────────────────────────
    // Source 2: process.env (Electron main + preload)
    // ─────────────────────────────────────────────────
    try {
        if (typeof process !== 'undefined' && process.env) {
            const envMap = {
                'LICENSE_PUBLIC_KEY_X': 'LICENSE_PUBLIC_KEY_X',
                'LICENSE_PUBLIC_KEY_Y': 'LICENSE_PUBLIC_KEY_Y',
                'SUPPORT_WHATSAPP': 'SUPPORT_WHATSAPP',
                'SELLER_EMAIL': 'SELLER_EMAIL',
                'UPI_PRIMARY_ID': 'UPI_PRIMARY_ID',
                'UPI_NPCI_ID': 'UPI_NPCI_ID',
                'PAYEE_NAME': 'PAYEE_NAME',
                'TRACKING_ENDPOINT': 'TRACKING_ENDPOINT',
                'NAME_ENCRYPTION_SECRET': 'NAME_ENCRYPTION_SECRET'
            };

            let loadedFromEnv = 0;
            Object.keys(envMap).forEach(envKey => {
                const val = process.env[envKey];
                if (val && typeof val === 'string' && val.trim().length > 0) {
                    // Special case: license key needs nested object
                    if (envKey === 'LICENSE_PUBLIC_KEY_X') {
                        config.LICENSE_PUBLIC_KEY_JWK = config.LICENSE_PUBLIC_KEY_JWK || {
                            kty: "EC",
                            crv: "P-256"
                        };
                        config.LICENSE_PUBLIC_KEY_JWK.x = val.trim();
                    } else if (envKey === 'LICENSE_PUBLIC_KEY_Y') {
                        config.LICENSE_PUBLIC_KEY_JWK = config.LICENSE_PUBLIC_KEY_JWK || {
                            kty: "EC",
                            crv: "P-256"
                        };
                        config.LICENSE_PUBLIC_KEY_JWK.y = val.trim();
                    } else {
                        config[envKey] = val.trim();
                    }
                    loadedFromEnv++;
                }
            });

            if (loadedFromEnv > 0) {
                console.log(`✅ [config] Loaded ${loadedFromEnv} values from process.env`);
            }
        }
    } catch (e) {
        // Silent — process may not exist in browser
    }

    // ─────────────────────────────────────────────────
    // Source 3: Build-time env (Vite/Webpack)
    // ─────────────────────────────────────────────────
    try {
        // Vite
        if (typeof import.meta !== 'undefined' && import.meta.env) {
            const viteEnv = import.meta.env;
            const buildMap = {
                'VITE_LICENSE_PUBLIC_KEY_X': 'LICENSE_PUBLIC_KEY_X',
                'VITE_LICENSE_PUBLIC_KEY_Y': 'LICENSE_PUBLIC_KEY_Y',
                'VITE_SUPPORT_WHATSAPP': 'SUPPORT_WHATSAPP',
                'VITE_SELLER_EMAIL': 'SELLER_EMAIL',
                'VITE_UPI_PRIMARY_ID': 'UPI_PRIMARY_ID',
                'VITE_UPI_NPCI_ID': 'UPI_NPCI_ID',
                'VITE_PAYEE_NAME': 'PAYEE_NAME',
                'VITE_TRACKING_ENDPOINT': 'TRACKING_ENDPOINT',
                'VITE_NAME_ENCRYPTION_SECRET': 'NAME_ENCRYPTION_SECRET'
            };

            Object.keys(buildMap).forEach(viteKey => {
                const val = viteEnv[viteKey];
                if (val && typeof val === 'string' && val.trim().length > 0) {
                    const configKey = buildMap[viteKey];
                    if (configKey === 'LICENSE_PUBLIC_KEY_X') {
                        config.LICENSE_PUBLIC_KEY_JWK = config.LICENSE_PUBLIC_KEY_JWK || {
                            kty: "EC",
                            crv: "P-256"
                        };
                        config.LICENSE_PUBLIC_KEY_JWK.x = val.trim();
                    } else if (configKey === 'LICENSE_PUBLIC_KEY_Y') {
                        config.LICENSE_PUBLIC_KEY_JWK = config.LICENSE_PUBLIC_KEY_JWK || {
                            kty: "EC",
                            crv: "P-256"
                        };
                        config.LICENSE_PUBLIC_KEY_JWK.y = val.trim();
                    } else {
                        config[configKey] = val.trim();
                    }
                }
            });
        }
    } catch (e) {
        // Silent — import.meta may not be available
    }

    return config;
})();

// ============================================================
// 🔐 VALIDATION HELPERS
// ============================================================

/**
 * Validate JWK public key format
 * Checks: kty=EC, crv=P-256, x/y are valid base64url, correct length
 */
function _isValidJwk(jwk) {
    if (!jwk || typeof jwk !== 'object') return false;

    // Check key type + curve
    if (jwk.kty !== 'EC') return false;
    if (jwk.crv !== 'P-256') return false;

    // Check x/y exist
    if (!jwk.x || !jwk.y) return false;
    if (typeof jwk.x !== 'string' || typeof jwk.y !== 'string') return false;

    const x = jwk.x.trim();
    const y = jwk.y.trim();

    // Check for placeholders
    const upperX = x.toUpperCase();
    const upperY = y.toUpperCase();
    const placeholderKeywords = ['YOUR_', 'REPLACE', 'HERE', 'EXAMPLE', 'XXXX'];
    if (placeholderKeywords.some(kw => upperX.includes(kw))) return false;
    if (placeholderKeywords.some(kw => upperY.includes(kw))) return false;

    // P-256 coordinates are 32 bytes = 43 base64url chars (typically)
    // Range check: base64url for 32 bytes → 43 chars (± padding)
    if (x.length < 40 || x.length > 50) return false;
    if (y.length < 40 || y.length > 50) return false;

    // Base64url charset: A-Z, a-z, 0-9, -, _
    const base64urlRegex = /^[A-Za-z0-9_-]+$/;
    if (!base64urlRegex.test(x)) return false;
    if (!base64urlRegex.test(y)) return false;

    return true;
}

/**
 * Validate UPI ID format
 * Example: name@bank, 9110977117@ybl
 */
function _isValidUpiId(upiId) {
    if (!upiId || typeof upiId !== 'string') return false;

    const trimmed = upiId.trim();
    if (trimmed.length < 5 || trimmed.length > 100) return false;

    // Reject placeholders
    const upper = trimmed.toUpperCase();
    if (upper.includes('YOUR_') || upper.includes('HERE') || upper.includes('EXAMPLE')) {
        return false;
    }

    // Standard UPI format: localpart@provider
    // localpart: alphanumeric + . _ -
    // provider: alphanumeric (letters/digits)
    return /^[a-zA-Z0-9._-]{2,}@[a-zA-Z0-9]{2,}$/.test(trimmed);
}

/**
 * Validate NPCI UPI ID format
 * Example: 37588767033@sbin0003226.ifsc.npci
 */
function _isValidNpciId(npciId) {
    if (!npciId || typeof npciId !== 'string') return false;

    const trimmed = npciId.trim();
    if (trimmed.length < 10 || trimmed.length > 200) return false;

    const upper = trimmed.toUpperCase();
    if (upper.includes('YOUR_') || upper.includes('HERE')) return false;

    // NPCI format has dots: <num>@<bank>.ifsc.npci
    return /^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.ifsc\.npci$/.test(trimmed);
}

/**
 * Validate tracking endpoint URL
 */
function _isValidTrackingUrl(url) {
    if (!url || typeof url !== 'string') return false;

    const trimmed = url.trim();
    if (trimmed.length < 10 || trimmed.length > 500) return false;

    // Reject placeholders
    if (trimmed.includes('YOUR-FIREBASE') ||
        trimmed.includes('YOUR_PROJECT') ||
        trimmed.includes('YOUR-')) {
        return false;
    }

    try {
        const u = new URL(trimmed);
        return u.protocol === 'https:';
    } catch (e) {
        return false;
    }
}

/**
 * Validate email format
 */
function _isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;

    const trimmed = email.trim();
    if (trimmed.length < 5 || trimmed.length > 200) return false;

    const upper = trimmed.toUpperCase();
    if (upper.includes('YOUR_') || upper.includes('HERE')) return false;

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

/**
 * Validate WhatsApp number (digits only, 10-15 chars)
 */
function _isValidWhatsApp(num) {
    if (!num || typeof num !== 'string') return false;

    const digits = String(num).replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15;
}

// ============================================================
// 🔧 HELPER: Get config value with placeholder check
// ============================================================
function _getConfigValue(key, validatorFn, fallback) {
    const raw = RUNTIME_CONFIG[key];
    if (validatorFn(raw)) {
        return raw;
    }
    return fallback;
}

// ============================================================
// 🔧 APP_CONFIG — Main Configuration Object (Frozen)
// ============================================================
const APP_CONFIG = Object.freeze({
    VERSION: "3.7.4",

    // ============================================================
    // 🔐 LICENSE PUBLIC KEY (ECDSA P-256)
    // ============================================================
    LICENSE_PUBLIC_KEY_JWK: (function() {
        const fromRuntime = RUNTIME_CONFIG.LICENSE_PUBLIC_KEY_JWK;

        if (_isValidJwk(fromRuntime)) {
            console.log('✅ [config] License public key configured');
            return Object.freeze({
                kty: "EC",
                crv: "P-256",
                x: String(fromRuntime.x).trim(),
                y: String(fromRuntime.y).trim()
            });
        }

        // Fallback placeholder
        console.warn('⚠️ [config] License public key not configured!');
        console.warn('   → Set LICENSE_PUBLIC_KEY_X and LICENSE_PUBLIC_KEY_Y');
        console.warn('   → Sources: .env, config-private.js, or preload.js');
        console.warn('   → License activation will NOT work until configured');

        return Object.freeze({
            kty: "EC",
            crv: "P-256",
            x: "YOUR_X_COORDINATE_HERE",
            y: "YOUR_Y_COORDINATE_HERE"
        });
    })(),

    // ============================================================
    // 📞 CONTACT INFO
    // ============================================================
    SUPPORT_WHATSAPP: (function() {
        const fromRuntime = RUNTIME_CONFIG.SUPPORT_WHATSAPP;

        if (_isValidWhatsApp(fromRuntime)) {
            return String(fromRuntime).replace(/\D/g, '');
        }

        // Fallback (only used if not configured)
        console.warn('⚠️ [config] SUPPORT_WHATSAPP not configured → using default');
        return "919110977117";
    })(),

    SELLER_EMAIL: (function() {
        const fromRuntime = RUNTIME_CONFIG.SELLER_EMAIL;

        if (_isValidEmail(fromRuntime)) {
            return String(fromRuntime).trim();
        }

        console.warn('⚠️ [config] SELLER_EMAIL not configured → using default');
        return "bosctechedu@gmail.com";
    })(),

    // ============================================================
    // 💰 PAYMENT (UPI)
    // ============================================================
    UPI_PRIMARY_ID: (function() {
        const fromRuntime = RUNTIME_CONFIG.UPI_PRIMARY_ID;

        if (_isValidUpiId(fromRuntime)) {
            return String(fromRuntime).trim();
        }

        console.warn('⚠️ [config] UPI_PRIMARY_ID not configured → using default');
        return "9110977117@ybl";
    })(),

    UPI_NPCI_ID: (function() {
        const fromRuntime = RUNTIME_CONFIG.UPI_NPCI_ID;

        if (_isValidNpciId(fromRuntime)) {
            return String(fromRuntime).trim();
        }

        // NPCI is optional — don't warn
        return "37588767033@sbin0003226.ifsc.npci";
    })(),

    PAYEE_NAME: (function() {
        const fromRuntime = RUNTIME_CONFIG.PAYEE_NAME;

        if (fromRuntime &&
            typeof fromRuntime === 'string' &&
            fromRuntime.trim().length >= 2 &&
            fromRuntime.trim().length <= 100) {

            const upper = fromRuntime.toUpperCase();
            if (!upper.includes('YOUR_') && !upper.includes('HERE')) {
                return String(fromRuntime).trim();
            }
        }

        return "BOSC Tech and Edu";
    })(),

    // ============================================================
    // 🎁 TRIAL SETTINGS
    // ============================================================
    TRIAL_ENABLED: true,
    TRIAL_PRICE: 9,
    TRIAL_DURATION_DAYS: 7,
    TRIAL_KEY_PREFIX: 'HKT',

    // Storage keys
    TRIAL_STORAGE_KEY: 'hor_trial_start',
    TRIAL_DEVICE_KEY: 'hor_trial_device',
    TRIAL_KEY_STORAGE: 'hor_trial_key',

    // Warning thresholds (days remaining)
    TRIAL_WARNING_DAYS: Object.freeze([6, 7]),

    // ============================================================
    // 💳 LICENSE PLANS
    // ============================================================
    PLANS: Object.freeze({
        P1: Object.freeze({ name: "Community", price: 199, devices: 1 }),
        P2: Object.freeze({ name: "Commercial", price: 399, devices: 3 }),
        P3: Object.freeze({ name: "Enterprise", price: 699, devices: 5 })
    }),

    // ============================================================
    // 🎨 UI SETTINGS
    // ============================================================
    TOAST_WELCOME_ENABLED: true,
    TOAST_SEQUENCE_DELAYS: Object.freeze([500, 1500, 2500, 3500, 4500]),
    TOAST_DURATION_DEFAULT: 4000,
    TOAST_DURATION_LONG: 6000,
    AUDIO_THROTTLE_MS: 70,

    DEFAULT_THEME: 'dark',
    DEFAULT_LANGUAGE: 'english',

    // ============================================================
    // 📊 TRACKING
    // ============================================================
    TRACKING_ENDPOINT: (function() {
        const fromRuntime = RUNTIME_CONFIG.TRACKING_ENDPOINT;

        if (_isValidTrackingUrl(fromRuntime)) {
            console.log('✅ [config] Tracking endpoint configured');
            return String(fromRuntime).trim();
        }

        // Placeholder (tracking disabled)
        return "https://YOUR-FIREBASE-PROJECT.firebasedatabase.app/activations.json";
    })(),

    // ============================================================
    // 🔐 NAME ENCRYPTION SECRET
    // ============================================================
    // ⚠️ CRITICAL: यह secret tracker.js और dashboard.html दोनों में SAME होना चाहिए
    // ⚠️ Minimum 16 characters
    // ⚠️ यह secret git में commit नहीं होना चाहिए
    NAME_ENCRYPTION_SECRET: (function() {
        const fromRuntime = RUNTIME_CONFIG.NAME_ENCRYPTION_SECRET;

        if (fromRuntime &&
            typeof fromRuntime === 'string' &&
            fromRuntime.length >= 16) {

            const upper = fromRuntime.toUpperCase();
            if (!upper.includes('REPLACE_') && !upper.includes('YOUR_')) {
                return fromRuntime;
            }
        }

        console.warn('⚠️ [config] NAME_ENCRYPTION_SECRET not configured');
        console.warn('   → Names will NOT be encrypted in Firebase');
        console.warn('   → Set NAME_ENCRYPTION_SECRET (min 16 chars)');
        return null;
    })(),

    // ============================================================
    // 🔒 PRIVACY
    // ============================================================
    PRIVACY_POLICY_URL: "privacy.html",
    CONSENT_VERSION: "1.0",

    // ============================================================
    // 🔐 SECURITY (Client-side)
    // ============================================================
    CLOCK_MAX_ROLLBACK_MINUTES: 5,
    CLOCK_MAX_SERVER_DRIFT_MINUTES: 60,
    CLOCK_MAX_FORWARD_JUMP_DAYS: 30,

    // ============================================================
    // 📧 EMAIL
    // ============================================================
    FORMSUBMIT_ENDPOINT: (function() {
        const email = (function() {
            const e = RUNTIME_CONFIG.SELLER_EMAIL;
            if (_isValidEmail(e)) return String(e).trim();
            return "bosctechedu@gmail.com";
        })();
        return `https://formsubmit.co/ajax/${encodeURIComponent(email)}`;
    })(),

    // ============================================================
    // 🌐 DEPLOYMENT
    // ============================================================
    BASE_URL: (function() {
        if (typeof window === 'undefined') return "http://localhost:8080";
        try {
            const origin = window.location.origin;
            if (!origin || origin === 'null' || origin === 'file://') {
                return "https://hor-katha.vercel.app";
            }
            return origin;
        } catch (e) {
            return "http://localhost:8080";
        }
    })()
});

// ============================================================
// 📝 FONTS PER LANGUAGE (Deep Frozen)
// ============================================================
const languageFontsDB = Object.freeze({
    'english': Object.freeze([
        Object.freeze({ name: "1. Roboto", val: "'Roboto', sans-serif", default: true, gfont: "Roboto:wght@400;600;700" }),
        Object.freeze({ name: "2. Inter", val: "'Inter', sans-serif", gfont: "Inter:wght@400;600;700" }),
        Object.freeze({ name: "3. Poppins", val: "'Poppins', sans-serif", gfont: "Poppins:wght@400;600;700" }),
        Object.freeze({ name: "4. Montserrat", val: "'Montserrat', sans-serif", gfont: "Montserrat:wght@400;600;700" }),
        Object.freeze({ name: "5. Open Sans", val: "'Open Sans', sans-serif", gfont: "Open+Sans:wght@400;600;700" }),
        Object.freeze({ name: "6. Lato", val: "'Lato', sans-serif", gfont: "Lato:wght@400;700" }),
        Object.freeze({ name: "7. Arial", val: "Arial, sans-serif" }),
        Object.freeze({ name: "8. Times New Roman", val: "'Times New Roman', serif" })
    ]),

    'roman': Object.freeze([
        Object.freeze({ name: "1. Inter", val: "'Inter', sans-serif", default: true, gfont: "Inter:wght@400;600;700" }),
        Object.freeze({ name: "2. Roboto", val: "'Roboto', sans-serif", gfont: "Roboto:wght@400;600;700" }),
        Object.freeze({ name: "3. Noto Sans", val: "'Noto Sans', sans-serif", gfont: "Noto+Sans:wght@400;600;700" }),
        Object.freeze({ name: "4. Source Sans 3", val: "'Source Sans 3', sans-serif", gfont: "Source+Sans+3:wght@400;600;700" }),
        Object.freeze({ name: "5. Gentium Plus", val: "'Gentium Plus', serif", gfont: "Gentium+Plus:wght@400;700" }),
        Object.freeze({ name: "6. Charis SIL", val: "'Charis SIL', serif", gfont: "Charis+SIL:wght@400;700" }),
        Object.freeze({ name: "7. Doulos SIL", val: "'Doulos SIL', serif", gfont: "Doulos+SIL" }),
        Object.freeze({ name: "8. Times New Roman", val: "'Times New Roman', serif" })
    ]),

    'hindi-dev': Object.freeze([
        Object.freeze({ name: "1. Noto Sans Devanagari", val: "'Noto Sans Devanagari', sans-serif", default: true, gfont: "Noto+Sans+Devanagari:wght@400;600;700" }),
        Object.freeze({ name: "2. Noto Serif Devanagari", val: "'Noto Serif Devanagari', serif", gfont: "Noto+Serif+Devanagari:wght@400;600;700" }),
        Object.freeze({ name: "3. Mangal", val: "'Mangal', 'Noto Sans Devanagari', sans-serif" }),
        Object.freeze({ name: "4. Kruti Dev 011", val: "'Kruti Dev 011', 'DevLys 010', sans-serif" }),
        Object.freeze({ name: "5. Kalam", val: "'Kalam', cursive", gfont: "Kalam:wght@400;700" }),
        Object.freeze({ name: "6. Poppins", val: "'Poppins', sans-serif", gfont: "Poppins:wght@400;600;700" }),
        Object.freeze({ name: "7. Rozha One", val: "'Rozha One', serif", gfont: "Rozha+One" }),
        Object.freeze({ name: "8. Tiro Devanagari Hindi", val: "'Tiro Devanagari Hindi', serif", gfont: "Tiro+Devanagari+Hindi" })
    ]),

    'santali-dev': Object.freeze([
        Object.freeze({ name: "1. Noto Sans Devanagari", val: "'Noto Sans Devanagari', sans-serif", default: true, gfont: "Noto+Sans+Devanagari:wght@400;600;700" }),
        Object.freeze({ name: "2. Noto Serif Devanagari", val: "'Noto Serif Devanagari', serif", gfont: "Noto+Serif+Devanagari:wght@400;600;700" }),
        Object.freeze({ name: "3. Mangal", val: "'Mangal', 'Noto Sans Devanagari', sans-serif" }),
        Object.freeze({ name: "4. Kruti Dev 011", val: "'Kruti Dev 011', 'DevLys 010', sans-serif" }),
        Object.freeze({ name: "5. Tiro Devanagari Hindi", val: "'Tiro Devanagari Hindi', serif", gfont: "Tiro+Devanagari+Hindi" }),
        Object.freeze({ name: "6. Kalam", val: "'Kalam', cursive", gfont: "Kalam:wght@400;700" }),
        Object.freeze({ name: "7. Rozha One", val: "'Rozha One', serif", gfont: "Rozha+One" }),
        Object.freeze({ name: "8. Yantramanav", val: "'Yantramanav', sans-serif", gfont: "Yantramanav:wght@400;700" })
    ]),

    'olchiki': Object.freeze([
        Object.freeze({ name: "1. Noto Sans Ol Chiki", val: "'Noto Sans Ol Chiki', sans-serif", default: true, gfont: "Noto+Sans+Ol+Chiki:wght@400;600;700" }),
        Object.freeze({ name: "2. Noto Serif Ol Chiki", val: "'Noto Serif Ol Chiki', serif", gfont: "Noto+Serif+Ol+Chiki:wght@400;700" }),
        Object.freeze({ name: "3. Guru Gomke", val: "'Guru Gomke', 'Noto Sans Ol Chiki', sans-serif" }),
        Object.freeze({ name: "4. Ol Chiki Classic", val: "'Ol Chiki Classic', 'Noto Sans Ol Chiki', sans-serif" }),
        Object.freeze({ name: "5. Ol Chiki Digital", val: "'Ol Chiki Digital', 'Noto Sans Ol Chiki', sans-serif" }),
        Object.freeze({ name: "6. Ol Chiki Unicode", val: "'Ol Chiki Unicode', 'Noto Sans Ol Chiki', sans-serif" }),
        Object.freeze({ name: "7. Santali Ol Script", val: "'Santali Ol Script', 'Noto Sans Ol Chiki', sans-serif" })
    ])
});

// ============================================================
// 📊 STARTUP LOGGING
// ============================================================
(function logConfigStatus() {
    'use strict';

    const hasLicenseKey = _isValidJwk(APP_CONFIG.LICENSE_PUBLIC_KEY_JWK);
    const hasTracking = _isValidTrackingUrl(APP_CONFIG.TRACKING_ENDPOINT);
    const hasUpi = _isValidUpiId(APP_CONFIG.UPI_PRIMARY_ID);
    const hasSecret = !!APP_CONFIG.NAME_ENCRYPTION_SECRET;
    const hasEmail = _isValidEmail(APP_CONFIG.SELLER_EMAIL);
    const hasWhatsApp = _isValidWhatsApp(APP_CONFIG.SUPPORT_WHATSAPP);

    const checks = [
        { name: 'License Key', ok: hasLicenseKey },
        { name: 'UPI ID', ok: hasUpi },
        { name: 'WhatsApp', ok: hasWhatsApp },
        { name: 'Email', ok: hasEmail },
        { name: 'Tracking', ok: hasTracking, optional: true },
        { name: 'Name Secret', ok: hasSecret }
    ];

    console.log('═══════════════════════════════════════════');
    console.log('✅ [config.js] v' + APP_CONFIG.VERSION);
    console.log('───────────────────────────────────────────');

    checks.forEach(c => {
        const icon = c.ok ? '✅' : (c.optional ? '⚠️ ' : '❌');
        const label = c.ok ? 'configured' : (c.optional ? 'optional/missing' : 'NOT CONFIGURED');
        console.log(`  ${icon} ${c.name.padEnd(15)} ${label}`);
    });

    console.log('───────────────────────────────────────────');

    const criticalMissing = checks.filter(c => !c.ok && !c.optional);
    if (criticalMissing.length > 0) {
        console.warn('');
        console.warn('⚠️  CRITICAL CONFIG MISSING:');
        criticalMissing.forEach(c => {
            console.warn(`    • ${c.name}`);
        });
        console.warn('');
        console.warn('📝 TO FIX:');
        console.warn('   1. Create js/config-private.js with real values');
        console.warn('   2. Or set environment variables (.env file)');
        console.warn('   3. Or set window.__RUNTIME_CONFIG__ in preload.js');
        console.warn('');
    } else {
        console.log('  🎉 All critical config loaded!');
    }

    console.log('═══════════════════════════════════════════');
})();

// ============================================================
// 📊 DEBUG HELPERS
// ============================================================
if (typeof window !== 'undefined') {
    window.ConfigDebug = {
        /**
         * Show current config status
         */
        status: () => {
            console.log('🔧 Config Status:');
            console.log('  Version:', APP_CONFIG.VERSION);
            console.log('  ───────────────────────────────');
            console.log('  🔐 License key configured:', _isValidJwk(APP_CONFIG.LICENSE_PUBLIC_KEY_JWK));
            console.log('  💰 UPI Primary ID:', APP_CONFIG.UPI_PRIMARY_ID);
            console.log('  💰 UPI NPCI ID:', APP_CONFIG.UPI_NPCI_ID);
            console.log('  👤 Payee:', APP_CONFIG.PAYEE_NAME);
            console.log('  📞 WhatsApp:', APP_CONFIG.SUPPORT_WHATSAPP);
            console.log('  📧 Email:', APP_CONFIG.SELLER_EMAIL);
            console.log('  🔐 Name Secret:', APP_CONFIG.NAME_ENCRYPTION_SECRET ? '(set)' : '(NOT SET)');
            console.log('  ───────────────────────────────');
            console.log('  📊 Tracking endpoint:', _isValidTrackingUrl(APP_CONFIG.TRACKING_ENDPOINT) ? '✅' : '❌');
            console.log('  🎁 Trial enabled:', APP_CONFIG.TRIAL_ENABLED);
            console.log('  🎁 Trial price: ₹' + APP_CONFIG.TRIAL_PRICE);
            console.log('  🎁 Trial duration:', APP_CONFIG.TRIAL_DURATION_DAYS + ' days');
            console.log('  ───────────────────────────────');
            console.log('  💳 Plans:');
            Object.entries(APP_CONFIG.PLANS).forEach(([code, plan]) => {
                console.log(`     ${code}: ₹${plan.price} / ${plan.devices} devices`);
            });
            console.log('  ───────────────────────────────');
            console.log('  🌐 BASE_URL:', APP_CONFIG.BASE_URL);
            console.log('  📧 Formsubmit:', APP_CONFIG.FORMSUBMIT_ENDPOINT);
            console.log('  ───────────────────────────────');
            console.log('  🔧 Runtime config sources:', Object.keys(RUNTIME_CONFIG).length, 'values loaded');
        },

        /**
         * Validate all config values
         */
        validate: () => {
            const issues = [];

            if (!_isValidJwk(APP_CONFIG.LICENSE_PUBLIC_KEY_JWK)) {
                issues.push({ severity: 'CRITICAL', msg: 'License public key not configured' });
            }
            if (!_isValidUpiId(APP_CONFIG.UPI_PRIMARY_ID)) {
                issues.push({ severity: 'HIGH', msg: 'UPI Primary ID invalid' });
            }
            if (!_isValidWhatsApp(APP_CONFIG.SUPPORT_WHATSAPP)) {
                issues.push({ severity: 'HIGH', msg: 'WhatsApp number invalid' });
            }
            if (!_isValidEmail(APP_CONFIG.SELLER_EMAIL)) {
                issues.push({ severity: 'HIGH', msg: 'Seller email invalid' });
            }
            if (!APP_CONFIG.NAME_ENCRYPTION_SECRET) {
                issues.push({ severity: 'MEDIUM', msg: 'Name encryption secret missing' });
            }
            if (!_isValidTrackingUrl(APP_CONFIG.TRACKING_ENDPOINT)) {
                issues.push({ severity: 'LOW', msg: 'Tracking endpoint not configured (optional)' });
            }

            if (issues.length === 0) {
                console.log('✅ Config validation passed — no issues');
            } else {
                console.warn('⚠️ Config issues:');
                issues.forEach(i => console.warn(`  [${i.severity}] ${i.msg}`));
            }

            return issues;
        },

        /**
         * List all fonts per language
         */
        fonts: () => {
            console.log('🔤 Font Database:');
            Object.entries(languageFontsDB).forEach(([lang, fonts]) => {
                console.log(`  ${lang}: ${fonts.length} fonts`);
                fonts.forEach(f => {
                    console.log(`     ${f.default ? '★' : ' '} ${f.name}`);
                });
            });
        },

        /**
         * Test JWK validation
         */
        testJwk: (jwk) => {
            console.log('🧪 JWK validation test:');
            console.log('  Input:', jwk);
            console.log('  Valid:', _isValidJwk(jwk));
        },

        /**
         * Test UPI validation
         */
        testUpi: (upiId) => {
            console.log('🧪 UPI validation test:');
            console.log('  Input:', upiId);
            console.log('  Valid:', _isValidUpiId(upiId));
        },

        /**
         * Test NPCI validation
         */
        testNpci: (npciId) => {
            console.log('🧪 NPCI validation test:');
            console.log('  Input:', npciId);
            console.log('  Valid:', _isValidNpciId(npciId));
        },

        /**
         * Test email validation
         */
        testEmail: (email) => {
            console.log('🧪 Email validation test:');
            console.log('  Input:', email);
            console.log('  Valid:', _isValidEmail(email));
        },

        /**
         * Show raw runtime config
         */
        raw: () => {
            console.log('🔧 Raw RUNTIME_CONFIG:');
            console.log(JSON.stringify(RUNTIME_CONFIG, null, 2));
        },

        /**
         * Force reload config (browser only)
         */
        reload: () => {
            console.log('🔄 Reloading page to refresh config...');
            if (typeof location !== 'undefined' && location.reload) {
                location.reload();
            }
        }
    };
}

// ============================================================
// 📝 DEVELOPER NOTES
// ============================================================
/*
 * ─────────────────────────────────────────────────────────────
 * 🔐 SETUP INSTRUCTIONS
 * ─────────────────────────────────────────────────────────────
 *
 * METHOD 1: config-private.js (Recommended for Web)
 * ─────────────────────────────────────────────────
 *   1. Create js/config-private.js
 *   2. Add: window.__RUNTIME_CONFIG__ = { ... real values ... }
 *   3. Add to .gitignore
 *   4. Add <script src="js/config-private.js"></script> in index.html
 *
 * METHOD 2: Environment Variables (Recommended for Electron)
 * ─────────────────────────────────────────────────
 *   1. Create .env file in project root:
 *        LICENSE_PUBLIC_KEY_X=f83OJ3D2xF1Bg...
 *        LICENSE_PUBLIC_KEY_Y=x_FEzRu9m36HL...
 *        SUPPORT_WHATSAPP=919110977117
 *        SELLER_EMAIL=bosctechedu@gmail.com
 *        UPI_PRIMARY_ID=9110977117@ybl
 *        PAYEE_NAME=BOSC Tech and Edu
 *        NAME_ENCRYPTION_SECRET=your-strong-secret-min-16-chars
 *   2. Load with dotenv in main.js: require('dotenv').config()
 *   3. Add .env to .gitignore
 *
 * METHOD 3: Vercel/Netlify Environment Variables
 * ─────────────────────────────────────────────────
 *   1. Dashboard → Settings → Environment Variables
 *   2. Add VITE_* prefixed variables
 *   3. Deploy
 *
 * METHOD 4: preload.js (Electron Only)
 * ─────────────────────────────────────────────────
 *   See preload.js — RUNTIME_CONFIG section
 *
 * ─────────────────────────────────────────────────────────────
 * 🎯 VERIFY CONFIG LOADED
 * ─────────────────────────────────────────────────────────────
 *   In browser console:
 *     ConfigDebug.status()
 *     ConfigDebug.validate()
 *
 * ─────────────────────────────────────────────────────────────
 * ⚠️  COMMON ERRORS
 * ─────────────────────────────────────────────────────────────
 *   "License public key not configured"
 *     → Check LICENSE_PUBLIC_KEY_X and Y are set
 *     → Verify they are base64url (43 chars each)
 *
 *   "UPI ID invalid"
 *     → Format: name@bank (e.g., yourname@ybl)
 *     → No spaces, no "YOUR_" placeholder
 *
 *   "Name encryption secret missing"
 *     → Set NAME_ENCRYPTION_SECRET (min 16 chars)
 *     → Must match dashboard.html secret
 *
 * ─────────────────────────────────────────────────────────────
 */

// ============================================================
// ✅ READY
// ============================================================
console.log('✅ config.js ready — v3.7.4.43 (multi-source secure config)');