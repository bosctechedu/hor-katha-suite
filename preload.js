// ============================================================
// 🌉 PRELOAD — Secure IPC Bridge + Runtime Config Injection
// BOSC Tech & Edu · Hoṛ Katha Suite v3.7.4 Pro Ultra
// ============================================================
// ⚠️ SECURITY ARCHITECTURE:
//    • Ye file renderer (browser) se isolated hai
//    • Real secrets ENV VARIABLES se load honge (hardcode nahi)
//    • contextBridge → isolated world
//    • contextIsolation: true (in main.js webPreferences)
//    • nodeIntegration: false (in main.js webPreferences)
//    • sandbox: false (Electron 20+ needed for preload)
// ============================================================
// ✅ v3.7.4.43 — SECURITY HARDENED:
//    • Real secrets REMOVED → env vars से load
//    • Input validation on IPC params
//    • Frozen config object (Object.freeze)
//    • IS_CONFIG_PLACEHOLDER flag
//    • Safe version info fallback
//    • Try-catch wrapper on all bridges
//    • Better logging (no secrets)
// ============================================================

const { contextBridge, ipcRenderer } = require('electron');

// ============================================================
// 🔐 SAFE ENV READER
// ============================================================
// process.env से value लेता है, अगर न मिले तो fallback देता है
function envOr(key, fallback = '') {
    try {
        const val = process.env[key];
        if (val && typeof val === 'string' && val.trim().length > 0) {
            return val.trim();
        }
        return fallback;
    } catch (e) {
        return fallback;
    }
}

// ============================================================
// 🔐 RUNTIME CONFIG — ENV VARIABLES से LOAD
// ============================================================
// ⚠️ IMPORTANT:
//    • Real values .env file में रखें (production build के लिए)
//    • Public GitHub पर real values commit MAT करें
//    • Development में ये placeholder रहेंगे (expected)
//
// .env file example:
//    LICENSE_PUBLIC_KEY_X=f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU
//    LICENSE_PUBLIC_KEY_Y=x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0
//    SUPPORT_WHATSAPP=919110977117
//    SELLER_EMAIL=bosctechedu@gmail.com
//    UPI_PRIMARY_ID=9110977117@ybl
//    UPI_NPCI_ID=37588767033@sbin0003226.ifsc.npci
//    PAYEE_NAME=BOSC Tech and Edu
//    TRACKING_ENDPOINT=https://your-firebase.firebasedatabase.app/activations.json
// ============================================================
const RUNTIME_CONFIG = Object.freeze({
    // ─── License Public Key (from admin/keygen.html) ───
    LICENSE_PUBLIC_KEY_JWK: Object.freeze({
        kty: "EC",
        crv: "P-256",
        x: envOr('LICENSE_PUBLIC_KEY_X', 'YOUR_X_COORDINATE_HERE'),
        y: envOr('LICENSE_PUBLIC_KEY_Y', 'YOUR_Y_COORDINATE_HERE')
    }),

    // ─── Contact & Payment ───
    SUPPORT_WHATSAPP: envOr('SUPPORT_WHATSAPP', 'YOUR_WHATSAPP_NUMBER_HERE'),
    SELLER_EMAIL: envOr('SELLER_EMAIL', 'YOUR_EMAIL_HERE'),

    // ─── UPI Payment ───
    UPI_PRIMARY_ID: envOr('UPI_PRIMARY_ID', 'YOUR_UPI_ID_HERE'),
    UPI_NPCI_ID: envOr('UPI_NPCI_ID', 'YOUR_NPCI_ID_HERE'),
    PAYEE_NAME: envOr('PAYEE_NAME', 'YOUR_PAYEE_NAME_HERE'),

    // ─── Firebase Tracking (optional) ───
    TRACKING_ENDPOINT: envOr('TRACKING_ENDPOINT', 'https://YOUR-FIREBASE-PROJECT.firebasedatabase.app/activations.json')
});

// ============================================================
// 🔍 DETECT IF CONFIG IS STILL PLACEHOLDER
// ============================================================
// Renderer को बताएगा कि config properly set है या नहीं
const IS_CONFIG_PLACEHOLDER = (function detect() {
    try {
        const values = [
            RUNTIME_CONFIG.SUPPORT_WHATSAPP,
            RUNTIME_CONFIG.SELLER_EMAIL,
            RUNTIME_CONFIG.UPI_PRIMARY_ID,
            RUNTIME_CONFIG.PAYEE_NAME,
            RUNTIME_CONFIG.LICENSE_PUBLIC_KEY_JWK.x,
            RUNTIME_CONFIG.LICENSE_PUBLIC_KEY_JWK.y
        ];

        return values.some(v => {
            if (!v || typeof v !== 'string') return true;
            const upper = v.toUpperCase();
            return upper.includes('YOUR_') ||
                   upper.includes('REPLACE_') ||
                   upper.includes('HERE') ||
                   upper.includes('EXAMPLE');
        });
    } catch (e) {
        return true;
    }
})();

// ============================================================
// 🛡️ SAFE VALIDATION HELPERS
// ============================================================

/**
 * Validate HWID format: DVC-XXXX-XXXX
 */
function isValidHwid(hwid) {
    if (!hwid || typeof hwid !== 'string') return false;
    return /^DVC-[A-F0-9]{4}-[A-F0-9]{4}$/i.test(hwid.trim());
}

/**
 * Validate license key: HKP-P1-9999-XXXX... (128 hex signature)
 */
function isValidLicenseKey(key) {
    if (!key || typeof key !== 'string') return false;
    return /^HKP-(P[1-3])-(?:\d{4}|\d{6})-[A-F0-9]{128}$/i.test(key.trim());
}

/**
 * Validate trial key: HKT-XXXXXXX-XXXX
 */
function isValidTrialKey(key) {
    if (!key || typeof key !== 'string') return false;
    return /^HKT-\d{7}-[A-F0-9]{4}$/i.test(key.trim());
}

// ============================================================
// 🌉 EXPOSE RUNTIME CONFIG (safe read-only)
// ============================================================
try {
    contextBridge.exposeInMainWorld('__RUNTIME_CONFIG__', RUNTIME_CONFIG);
} catch (e) {
    console.error('❌ Failed to expose __RUNTIME_CONFIG__:', e.message);
}

// ============================================================
// 🌉 EXPOSE ELECTRON API
// ============================================================
try {
    contextBridge.exposeInMainWorld('electronAPI', {
        // ─── Environment Flag ───
        isElectron: true,
        isConfigPlaceholder: IS_CONFIG_PLACEHOLDER,

        // ─── Version Info (safe fallback) ───
        versions: Object.freeze({
            electron: (process.versions && process.versions.electron) || 'unknown',
            node: (process.versions && process.versions.node) || 'unknown',
            chrome: (process.versions && process.versions.chrome) || 'unknown'
        }),

        // ============================================================
        // 💾 HWID PERSISTENT STORAGE (IPC)
        // ============================================================
        saveHwid: (hwid) => {
            try {
                if (!isValidHwid(hwid)) {
                    return Promise.resolve({
                        success: false,
                        error: 'Invalid HWID format (expected DVC-XXXX-XXXX)'
                    });
                }
                return ipcRenderer.invoke('hwid-save', String(hwid).trim());
            } catch (e) {
                return Promise.resolve({ success: false, error: e.message });
            }
        },

        loadHwid: () => {
            try {
                return ipcRenderer.invoke('hwid-load');
            } catch (e) {
                return Promise.resolve({ success: false, error: e.message });
            }
        },

        deleteHwid: () => {
            try {
                return ipcRenderer.invoke('hwid-delete');
            } catch (e) {
                return Promise.resolve({ success: false, error: e.message });
            }
        },

        validateHwid: (hwid) => {
            try {
                if (!hwid || typeof hwid !== 'string') {
                    return Promise.resolve({
                        success: false,
                        error: 'HWID must be a non-empty string'
                    });
                }
                return ipcRenderer.invoke('hwid-validate', String(hwid).trim());
            } catch (e) {
                return Promise.resolve({ success: false, error: e.message });
            }
        },

        // ============================================================
        // ℹ️ APP INFO (matches main.js handler)
        // ============================================================
        getAppVersion: () => {
            try {
                return ipcRenderer.invoke('app-version');
            } catch (e) {
                return Promise.resolve({
                    success: false,
                    error: e.message,
                    version: 'unknown',
                    electron: process.versions.electron,
                    node: process.versions.node,
                    chrome: process.versions.chrome
                });
            }
        }
    });
} catch (e) {
    console.error('❌ Failed to expose electronAPI:', e.message);
}

// ============================================================
// 🌉 EXPOSE VALIDATION HELPERS (for renderer use)
// ============================================================
try {
    contextBridge.exposeInMainWorld('__validators__', Object.freeze({
        isValidHwid,
        isValidLicenseKey,
        isValidTrialKey
    }));
} catch (e) {
    console.error('❌ Failed to expose validators:', e.message);
}

// ============================================================
// 📋 LOGGING (no secrets)
// ============================================================
try {
    console.log('═══════════════════════════════════════════');
    console.log('✅ Preload bridge loaded');
    console.log('   📦 electronAPI exposed');
    console.log('   🔐 __RUNTIME_CONFIG__ exposed');
    console.log('   ✔️  __validators__ exposed');
    console.log('   ⚡ Electron:', process.versions.electron);
    console.log('   🟢 Node:', process.versions.node);
    console.log('   🌐 Chrome:', process.versions.chrome);

    if (IS_CONFIG_PLACEHOLDER) {
        console.warn('');
        console.warn('⚠️  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.warn('⚠️  RUNTIME CONFIG NOT CONFIGURED');
        console.warn('⚠️  .env file में real values डालें:');
        console.warn('⚠️    • LICENSE_PUBLIC_KEY_X');
        console.warn('⚠️    • LICENSE_PUBLIC_KEY_Y');
        console.warn('⚠️    • SUPPORT_WHATSAPP');
        console.warn('⚠️    • SELLER_EMAIL');
        console.warn('⚠️    • UPI_PRIMARY_ID');
        console.warn('⚠️    • PAYEE_NAME');
        console.warn('⚠️  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.warn('');
    } else {
        console.log('   ✅ Runtime config: configured');
    }
    console.log('═══════════════════════════════════════════');
} catch (e) {
    // Silent — logging failed is not critical
}