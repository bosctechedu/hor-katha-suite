// ============================================================
// 📊 TRACKER — Anonymous Device & Activation Logging
// BOSC Tech & Edu · Hoṛ Katha Suite v3.7.4 Pro Ultra
// ============================================================
// Legal compliance: Anonymous + Encrypted + Consent-based
//
// ✅ v3.7.4.43 — SECURITY HARDENED:
//    • NAME_SECRET loaded from secure source (NOT hardcoded)
//    • Multi-source config (APP_CONFIG → runtime → env → null)
//    • Consent check: no race condition
//    • Firebase endpoint: fail-safe on invalid URL
//    • encryptName: empty input guard + no-secret fail-safe
//    • getAnonDeviceId: HWID fallback (multiple layers)
//    • logActivation: 8s timeout (AbortController)
//    • Browser detection: Edge/Opera/Brave priority
//    • getLocalStats: safe JSON parse + type check
//    • setConsent: localStorage try-catch everywhere
//    • crypto.subtle guard (old browsers)
//    • No secrets in logs
//    • Platform detection: Android/iOS/macOS/Windows/Linux
//    • Debug helpers for testing
// ============================================================

// ============================================================
// 🔐 NAME_SECRET — SECURE LOAD (NOT HARDCODED)
// ============================================================
// ⚠️ IMPORTANT:
//    • यह secret tracker.js और dashboard.html दोनों में SAME होना चाहिए
//    • इसे config.js / config-private.js / env vars से load करें
//    • यह secret git में commit नहीं होना चाहिए
//    • Minimum 16 characters recommended
//
// Priority order:
//    1. APP_CONFIG.NAME_ENCRYPTION_SECRET  (from config.js)
//    2. window.__RUNTIME_CONFIG__.NAME_ENCRYPTION_SECRET  (preload/private)
//    3. process.env.NAME_ENCRYPTION_SECRET  (Electron)
//    4. null (encryption disabled with warning)
// ============================================================
const NAME_SECRET = (function getSecret() {
    'use strict';

    // Priority 1: APP_CONFIG (from config.js)
    try {
        if (typeof APP_CONFIG !== 'undefined' &&
            APP_CONFIG.NAME_ENCRYPTION_SECRET &&
            typeof APP_CONFIG.NAME_ENCRYPTION_SECRET === 'string' &&
            APP_CONFIG.NAME_ENCRYPTION_SECRET.length >= 16) {
            console.log('✅ [Tracker] NAME_SECRET loaded from APP_CONFIG');
            return APP_CONFIG.NAME_ENCRYPTION_SECRET;
        }
    } catch (e) {
        // Silent — APP_CONFIG may not be loaded
    }

    // Priority 2: Runtime config (from preload.js / config-private.js)
    try {
        if (typeof window !== 'undefined' &&
            window.__RUNTIME_CONFIG__ &&
            window.__RUNTIME_CONFIG__.NAME_ENCRYPTION_SECRET &&
            typeof window.__RUNTIME_CONFIG__.NAME_ENCRYPTION_SECRET === 'string' &&
            window.__RUNTIME_CONFIG__.NAME_ENCRYPTION_SECRET.length >= 16) {
            console.log('✅ [Tracker] NAME_SECRET loaded from window.__RUNTIME_CONFIG__');
            return window.__RUNTIME_CONFIG__.NAME_ENCRYPTION_SECRET;
        }
    } catch (e) {
        // Silent
    }

    // Priority 3: Environment (Electron only)
    try {
        if (typeof process !== 'undefined' &&
            process.env &&
            process.env.NAME_ENCRYPTION_SECRET &&
            typeof process.env.NAME_ENCRYPTION_SECRET === 'string' &&
            process.env.NAME_ENCRYPTION_SECRET.length >= 16) {
            console.log('✅ [Tracker] NAME_SECRET loaded from process.env');
            return process.env.NAME_ENCRYPTION_SECRET;
        }
    } catch (e) {
        // Silent
    }

    // ❌ No secret found — encryption will be disabled
    console.warn('⚠️ [Tracker] NAME_ENCRYPTION_SECRET not configured!');
    console.warn('   → Names will NOT be encrypted in Firebase');
    console.warn('   → Set NAME_ENCRYPTION_SECRET in:');
    console.warn('      • config-private.js (Web)');
    console.warn('      • .env file (Electron)');
    console.warn('      • Environment variables (Vercel/Netlify)');
    console.warn('   → Minimum 16 characters required');
    return null;
})();

// ============================================================
// 🔐 AES-256 Encrypt Name (with full guards)
// ============================================================
async function encryptName(name) {
    // ✅ Empty input guard
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return null;
    }

    // ✅ No secret = no encryption (safer than storing plaintext)
    if (!NAME_SECRET) {
        console.warn('[Tracker] Cannot encrypt name — NAME_SECRET missing');
        return null;
    }

    // ✅ crypto.subtle availability check
    if (!window.crypto || !window.crypto.subtle) {
        console.warn('⚠️ crypto.subtle unavailable — name not encrypted');
        return null;
    }

    try {
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            enc.encode(NAME_SECRET),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );

        const key = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: enc.encode('HorKatha-Name-Salt-v1'),
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt']
        );

        const iv = crypto.getRandomValues(new Uint8Array(12));

        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            enc.encode(String(name))
        );

        const combined = new Uint8Array(iv.length + ciphertext.byteLength);
        combined.set(iv, 0);
        combined.set(new Uint8Array(ciphertext), iv.length);

        // ✅ Chunk-based base64 (stack-overflow safe)
        let binary = '';
        const CHUNK_SIZE = 8192;
        for (let i = 0; i < combined.length; i += CHUNK_SIZE) {
            const chunk = combined.subarray(i, i + CHUNK_SIZE);
            binary += String.fromCharCode.apply(null, chunk);
        }
        return btoa(binary);
    } catch (e) {
        console.warn('Name encryption failed:', e.message);
        return null;
    }
}

// ============================================================
// 🌐 URL VALIDATION HELPER
// ============================================================
function _isValidTrackingUrl(url) {
    if (!url || typeof url !== 'string') return false;
    if (url.includes('YOUR-FIREBASE') ||
        url.includes('YOUR_PROJECT') ||
        url.includes('YOUR-')) {
        return false;
    }
    try {
        const u = new URL(url);
        return u.protocol === 'https:';
    } catch (e) {
        return false;
    }
}

// ============================================================
// 📊 TRACKER — MAIN OBJECT
// ============================================================
const Tracker = {
    // ============================================================
    // ✅ ENDPOINT — Fail-safe resolution
    // ============================================================
    ENDPOINT: (function() {
        try {
            const configured = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.TRACKING_ENDPOINT)
                ? APP_CONFIG.TRACKING_ENDPOINT
                : null;

            if (_isValidTrackingUrl(configured)) {
                return configured;
            }

            // Warn if consent granted but no endpoint
            try {
                if (localStorage.getItem('hor_tracking_consent') === 'accepted') {
                    console.warn(
                        '⚠️ [Tracker] Consent granted but TRACKING_ENDPOINT is not configured. ' +
                        'Set APP_CONFIG.TRACKING_ENDPOINT in js/config.js.'
                    );
                }
            } catch (e) {
                // localStorage may be blocked — silent
            }

            return null;
        } catch (e) {
            console.warn('Tracker endpoint resolution failed:', e.message);
            return null;
        }
    })(),

    // ============================================================
    // ✅ isEnabled — Safe localStorage (sync)
    // ============================================================
    isEnabled() {
        try {
            return localStorage.getItem('hor_tracking_consent') === 'accepted';
        } catch (e) {
            return false;
        }
    },

    // ============================================================
    // 🆔 Get Anonymous Device ID (with HWID fallback)
    // ============================================================
    async getAnonDeviceId() {
        let hwid = 'unknown';

        // Try localStorage
        try {
            hwid = localStorage.getItem('hor_device_hwid') || 'unknown';
        } catch (e) {
            // Silent
        }

        // ✅ Fallback if HWID is missing
        if (hwid === 'unknown' || !hwid) {
            try {
                hwid = 'fallback-' +
                    (navigator.platform || 'unknown') + '-' +
                    (navigator.hardwareConcurrency || 0) + '-' +
                    (navigator.language || 'en');
            } catch (e) {
                hwid = 'fallback-unknown';
            }
        }

        // Hash anonymously
        try {
            if (typeof CryptoUtils !== 'undefined' && CryptoUtils.hashAnonymous) {
                const hash = await CryptoUtils.hashAnonymous(hwid);
                if (hash) return hash;
            }
        } catch (e) {
            console.warn('Anonymous hash failed:', e.message);
        }

        // Final fallback — btoa based hash
        try {
            const base64 = btoa(hwid).substring(0, 12);
            return 'anon-' + base64.replace(/[^A-Za-z0-9]/g, '');
        } catch (e) {
            return 'anon-fallback';
        }
    },

    // ============================================================
    // 📤 Log Activation (8s timeout)
    // ============================================================
    async logActivation(name, plan, action = 'activate') {
        // Consent check
        if (!this.isEnabled()) {
            console.log('📊 Tracking disabled (no consent)');
            return { skipped: true, reason: 'no-consent' };
        }

        // Endpoint check
        if (!this.ENDPOINT) {
            console.log('📊 Tracking endpoint not configured');
            return { skipped: true, reason: 'no-endpoint' };
        }

        try {
            const anonId = await this.getAnonDeviceId();

            // Encrypt name
            const encryptedName = await encryptName(name);

            // Name hash (for dedup)
            let nameHash = null;
            try {
                if (typeof CryptoUtils !== 'undefined' && CryptoUtils.hashAnonymous) {
                    nameHash = await CryptoUtils.hashAnonymous(String(name).toLowerCase());
                }
            } catch (e) {
                // Silent
            }

            const event = {
                anonId: anonId,
                action: action,
                plan: plan,
                customerName: encryptedName,        // Encrypted (or null)
                nameHash: nameHash,                 // One-way hash
                appVersion: (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.VERSION) || '3.7.4',
                platform: this._getPlatform(),
                browser: this._getBrowser(),
                timestamp: new Date().toISOString()
            };

            // ✅ 8s timeout for fetch
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            try {
                await fetch(this.ENDPOINT, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(event),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);
                console.log('📊 Activation logged');
                return { success: true };
            } catch (fetchErr) {
                clearTimeout(timeoutId);
                throw fetchErr;
            }
        } catch (e) {
            // Silent fail — don't break user flow
            console.warn('📊 Tracking failed:', e.message);
            return { success: false, error: e.message };
        }
    },

    // ============================================================
    // 🌐 Platform Detection (better labels)
    // ============================================================
    _getPlatform() {
        try {
            // Prefer userAgentData if available
            if (navigator.userAgentData && navigator.userAgentData.platform) {
                return navigator.userAgentData.platform;
            }

            // Fallback to platform
            const p = navigator.platform || 'unknown';

            // Better labels
            if (/Win/i.test(p)) return 'Windows';
            if (/Mac/i.test(p)) return 'macOS';
            if (/Linux/i.test(p)) return 'Linux';
            if (/Android/i.test(p)) return 'Android';
            if (/iPhone|iPad|iPod/i.test(p)) return 'iOS';

            return p;
        } catch (e) {
            return 'unknown';
        }
    },

    // ============================================================
    // 🌐 Browser Detection (correct priority order)
    // ============================================================
    _getBrowser() {
        try {
            const ua = navigator.userAgent || '';

            // ✅ Order matters — check specific first
            if (ua.includes('Edg/') || ua.includes('EdgA/') || ua.includes('EdgiOS/')) {
                return 'Edge';
            }
            if (ua.includes('OPR/') || ua.includes('Opera/')) {
                return 'Opera';
            }
            if (ua.includes('Brave/') || (navigator.brave && navigator.brave.isBrave)) {
                return 'Brave';
            }
            if (ua.includes('Firefox/') || ua.includes('FxiOS/')) {
                return 'Firefox';
            }
            if (ua.includes('Chrome/') || ua.includes('CriOS/')) {
                return 'Chrome';
            }
            if (ua.includes('Safari/') && !ua.includes('Chrome')) {
                return 'Safari';
            }

            return 'Other';
        } catch (e) {
            return 'unknown';
        }
    },

    // ============================================================
    // 📊 Local Stats (safe JSON parse)
    // ============================================================
    getLocalStats() {
        try {
            const raw = localStorage.getItem('hor_receipts');
            if (!raw) return { totalActivations: 0, lastActivation: null };

            const receipts = JSON.parse(raw);
            if (!Array.isArray(receipts)) {
                return { totalActivations: 0, lastActivation: null };
            }

            return {
                totalActivations: receipts.length,
                lastActivation: receipts.length > 0
                    ? receipts[receipts.length - 1].timestamp
                    : null
            };
        } catch (e) {
            console.warn('Local stats parse failed:', e.message);
            return { totalActivations: 0, lastActivation: null };
        }
    },

    // ============================================================
    // ✅ Set Consent (safe localStorage)
    // ============================================================
    setConsent(accepted) {
        try {
            localStorage.setItem('hor_tracking_consent', accepted ? 'accepted' : 'declined');
            localStorage.setItem('hor_tracking_consent_date', new Date().toISOString());
            console.log('📊 Tracking consent:', accepted ? 'ACCEPTED' : 'DECLINED');
            return { success: true };
        } catch (e) {
            console.warn('setConsent failed:', e.message);
            return { success: false, error: e.message };
        }
    },

    // ============================================================
    // ✅ Has Consent Decision
    // ============================================================
    hasConsentDecision() {
        try {
            const c = localStorage.getItem('hor_tracking_consent');
            return c === 'accepted' || c === 'declined';
        } catch (e) {
            return false;
        }
    },

    // ============================================================
    // ✅ Get Consent State
    // ============================================================
    getConsentState() {
        try {
            const c = localStorage.getItem('hor_tracking_consent');
            if (c === 'accepted') return 'accepted';
            if (c === 'declined') return 'declined';
            return 'not-set';
        } catch (e) {
            return 'not-set';
        }
    },

    // ============================================================
    // ✅ Get Consent Date
    // ============================================================
    getConsentDate() {
        try {
            return localStorage.getItem('hor_tracking_consent_date') || null;
        } catch (e) {
            return null;
        }
    },

    // ============================================================
    // ✅ Reset Consent (for testing)
    // ============================================================
    resetConsent() {
        try {
            localStorage.removeItem('hor_tracking_consent');
            localStorage.removeItem('hor_tracking_consent_date');
            console.log('📊 Consent reset');
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }
};

// ============================================================
// 📋 DEBUG HELPERS
// ============================================================
if (typeof window !== 'undefined') {
    window.TrackerDebug = {
        /**
         * Show tracker status
         */
        status: () => {
            console.log('═══════════════════════════════════════════');
            console.log('📊 Tracker Status');
            console.log('───────────────────────────────────────────');
            console.log('  Enabled:', Tracker.isEnabled());
            console.log('  Endpoint:', Tracker.ENDPOINT ? '(configured)' : '(not configured)');
            console.log('  NAME_SECRET:', NAME_SECRET ? '(loaded, ' + NAME_SECRET.length + ' chars)' : '(NOT SET)');
            console.log('  Consent:', Tracker.getConsentState());
            console.log('  Consent Date:', Tracker.getConsentDate());
            console.log('───────────────────────────────────────────');
            const stats = Tracker.getLocalStats();
            console.log('  Local receipts:', stats.totalActivations);
            console.log('  Last activation:', stats.lastActivation || 'never');
            console.log('═══════════════════════════════════════════');
        },

        /**
         * Enable tracking
         */
        enable: () => {
            const result = Tracker.setConsent(true);
            console.log('✅ Tracking enabled:', result);
            return result;
        },

        /**
         * Disable tracking
         */
        disable: () => {
            const result = Tracker.setConsent(false);
            console.log('⚠️ Tracking disabled:', result);
            return result;
        },

        /**
         * Reset consent
         */
        reset: () => {
            const result = Tracker.resetConsent();
            console.log('🔄 Consent reset:', result);
            return result;
        },

        /**
         * Test activation log
         */
        test: async () => {
            console.log('📊 Testing activation log...');
            const result = await Tracker.logActivation('Test User', 'P1', 'test');
            console.log('Result:', result);
            return result;
        },

        /**
         * Test encryption
         */
        testEncrypt: async (name = 'Test User') => {
            console.log('🔐 Testing encryption for:', name);
            console.log('   Secret available:', !!NAME_SECRET);
            const encrypted = await encryptName(name);
            console.log('   Encrypted:', encrypted ? encrypted.substring(0, 30) + '...' : 'null');
            console.log('   Length:', encrypted ? encrypted.length : 0);
            return encrypted;
        },

        /**
         * Test device ID
         */
        testAnonId: async () => {
            console.log('🆔 Testing anon device ID...');
            const id = await Tracker.getAnonDeviceId();
            console.log('   Result:', id);
            return id;
        },

        /**
         * Show browser info
         */
        browserInfo: () => {
            console.log('🌐 Browser Info:');
            console.log('   Browser:', Tracker._getBrowser());
            console.log('   Platform:', Tracker._getPlatform());
            console.log('   User Agent:', navigator.userAgent);
            console.log('   Language:', navigator.language);
            console.log('   Platform (navigator):', navigator.platform);
            console.log('   Hardware Concurrency:', navigator.hardwareConcurrency);
            console.log('   Device Memory:', navigator.deviceMemory || 'unknown');
        },

        /**
         * Test endpoint URL validation
         */
        testUrl: (url) => {
            console.log('🌐 Testing URL:', url);
            console.log('   Valid:', _isValidTrackingUrl(url));
        },

        /**
         * Simulate full activation flow (dev only)
         */
        simulate: async (name = 'Sim User', plan = 'P1') => {
            console.log('🧪 Simulating full activation flow...');
            console.log('   1. Enable tracking');
            Tracker.setConsent(true);

            console.log('   2. Get anon ID');
            const anonId = await Tracker.getAnonDeviceId();
            console.log('      →', anonId);

            console.log('   3. Encrypt name');
            const encrypted = await encryptName(name);
            console.log('      →', encrypted ? 'OK (' + encrypted.length + ' chars)' : 'FAILED');

            console.log('   4. Log activation');
            const result = await Tracker.logActivation(name, plan, 'simulate');
            console.log('      →', result);

            console.log('🧪 Simulation complete');
            return { anonId, encrypted, result };
        }
    };
}

// ============================================================
// 📋 STARTUP LOG
// ============================================================
console.log('═══════════════════════════════════════════');
console.log('✅ tracker.js loaded — v3.7.4.43');
console.log('   🔐 NAME_SECRET:', NAME_SECRET ? 'loaded' : '⚠️ NOT SET');
console.log('   📊 Endpoint:', Tracker.ENDPOINT ? 'configured' : '⚠️ not configured');
console.log('   👤 Consent:', Tracker.getConsentState());
console.log('   🌐 Browser:', Tracker._getBrowser());
console.log('   💻 Platform:', Tracker._getPlatform());
console.log('═══════════════════════════════════════════');