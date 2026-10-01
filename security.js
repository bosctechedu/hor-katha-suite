// ============================================================
// 🛡️ AUTO SECURITY SHIELD v1.9 — Hardened & Optimized
// BOSC Tech & Edu · Hoṛ Katha Suite v3.7.4 Pro Ultra
// ============================================================
// ✅ v1.9 — SECURITY HARDENED:
//    • CRITICAL: sanitize() regex lastIndex bug FIXED
//      (was: XSS bypass on 2nd call due to /g flag)
//    • CRITICAL: Storage guards use Object.defineProperty
//      (was: simple assignment — bypassable)
//    • CRITICAL: sessionStorage guard added (bypass fix)
//    • isTrustedScript: full origin + basename match
//    • LICENSE_KEY_REGEX: strict 4 or 6 digit expiry
//    • monitorDOMLight: observes full document (head + body)
//    • Integrity check: 5s interval (was 10s)
//    • Added new Function() + template literal detection
//    • Broader localStorage key monitoring
//    • All localStorage calls wrapped in try-catch
//    • window.open hook: broader blocklist
//    • Improved threat counter and logging
//    • Version tracking + debug helpers
//    • MutationObserver throttling (500ms batch)
//    • Per-node try-catch (crash safety)
// ============================================================

const SecurityShield = {
    // ============================================================
    // 📊 VERSION & STATE
    // ============================================================
    version: '1.9',
    threatsBlocked: 0,
    _observerInstance: null,
    _integrityIntervalId: null,
    _installTimestamp: Date.now(),

    // ============================================================
    // 🔑 LICENSE KEY REGEX (Strict)
    // ============================================================
    // Formats supported:
    //   HKP-P3-9999-<128 hex chars>       (lifetime, 4-digit)
    //   HKP-P1-260921-<128 hex chars>     (date-based, 6-digit YYMMDD)
    LICENSE_KEY_REGEX: /^HKP-(P[1-3])-(?:\d{4}|\d{6})-[A-F0-9]{128}$/i,

    // ============================================================
    // 📜 TRUSTED SCRIPT BASENAMES (same-origin only)
    // ============================================================
    TRUSTED_SCRIPT_BASENAMES: [
        'config.js',
        'config-private.js',
        'keymaps.js',
        'audio.js',
        'crypto-utils.js',
        'tracker.js',
        'security.js',
        'license.js',
        'editor.js',
        'keyboard.js',
        'modals.js',
        'privacy.js',
        'app.js',
        'typing-test.js',
        'certificate.js',
        'print-generator.js',
        'qrcode.min.js',
        'qr-offline.js',
        'sw.js'
    ],

    // ============================================================
    // 🌐 TRUSTED CDN ORIGINS
    // ============================================================
    TRUSTED_ORIGINS: [
        'fonts.googleapis.com',
        'fonts.gstatic.com',
        'cdnjs.cloudflare.com',
        'unpkg.com',
        'www.gstatic.com',
        'gstatic.com'
    ],

    // ============================================================
    // ⚠️ SUSPICIOUS PATTERNS
    // ============================================================
    // ⚠️ CRITICAL: These have /g flag → lastIndex MUST be reset
    // before every use! (otherwise 2nd call would bypass)
    // ============================================================
    suspiciousPatterns: [
        // Script tags
        /<script[\s\S]*?<\/script>/gi,
        /<script\b[^>]*>/gi,

        // URL schemes
        /javascript:/gi,
        /vbscript:/gi,
        /data:text\/html/gi,
        /data:application\/xhtml/gi,
        /data:application\/x-javascript/gi,

        // Embedded objects
        /<iframe/gi,
        /<object/gi,
        /<embed/gi,
        /<applet/gi,
        /<frame/gi,
        /<meta[^>]*http-equiv=["']?refresh/gi,
        /<link[^>]*rel=["']?import/gi,

        // Eval / Function constructor
        /\beval\s*\(/gi,
        /\bnew\s+Function\s*\(/gi,
        /\bFunction\s*\(\s*["'`]/gi,
        /setTimeout\s*\(\s*["'`]/gi,
        /setInterval\s*\(\s*["'`]/gi,

        // Document mutations
        /document\.cookie/gi,
        /document\.write\s*\(/gi,
        /document\.writeln\s*\(/gi,
        /document\.domain/gi,

        // Inline event handlers (attribute patterns)
        /\bon\w+\s*=\s*["'][^"']*["']/gi,
        /\bonerror\s*=/gi,
        /\bonload\s*=/gi,
        /\bonclick\s*=/gi,
        /\bonmouseover\s*=/gi,
        /\bonmouseenter\s*=/gi,
        /\bonfocus\s*=/gi,
        /\bonblur\s*=/gi,

        // Base64 obfuscation (common pattern)
        /atob\s*\(\s*["'`][A-Za-z0-9+/=]{40,}/gi
    ],

    // ============================================================
    // 🔐 CRITICAL STORAGE KEYS (auto-reset on tamper)
    // ============================================================
    CRITICAL_STORAGE_KEYS: [
        'hor_lic_user',
        'hor_lic_key',
        'hor_device_hwid',
        'hor_trial_start',
        'hor_trial_key',
        'hor_trial_device'
    ],

    // ============================================================
    // 🚀 INIT — Main entry point
    // ============================================================
    init() {
        try {
            this.installNetworkHooks();
            this.installStorageGuard();
            this.startIntegrityCheck();
            this.monitorDOMLight();

            console.log('═══════════════════════════════════════════');
            console.log('🛡️ Security Shield v' + this.version + ' — ACTIVE');
            console.log('   📊 Patterns loaded:', this.suspiciousPatterns.length);
            console.log('   📜 Trusted scripts:', this.TRUSTED_SCRIPT_BASENAMES.length);
            console.log('   🌐 Trusted origins:', this.TRUSTED_ORIGINS.length);
            console.log('   ⏱️  Integrity check: every 5s');
            console.log('═══════════════════════════════════════════');
        } catch (e) {
            console.warn('⚠️ Security Shield init warning:', e);
        }
    },

    // ============================================================
    // 🌐 NETWORK HOOKS — window.open
    // ============================================================
    installNetworkHooks() {
        try {
            const _originalOpen = window.open;

            // ✅ Use Object.defineProperty for extra safety
            Object.defineProperty(window, 'open', {
                value: function(url, ...args) {
                    if (SecurityShield.isSuspiciousUrl(url)) {
                        SecurityShield.block('Suspicious window.open blocked: ' + String(url).substring(0, 100));
                        return null;
                    }
                    return _originalOpen.call(window, url, ...args);
                },
                writable: false,      // ✅ अब कोई बदल नहीं सकता
                configurable: false,  // ✅ अब कोई delete नहीं कर सकता
                enumerable: false
            });

            console.log('✅ [Security] window.open hook installed');
        } catch (e) {
            console.warn('⚠️ window.open hook failed:', e.message);
        }
    },

    /**
     * Check if URL is suspicious
     */
    isSuspiciousUrl(url) {
        if (!url || typeof url !== 'string') return false;

        const lower = url.trim().toLowerCase();

        const blocked = [
            'javascript:',
            'vbscript:',
            'data:text/html',
            'data:application/xhtml',
            'data:application/x-javascript',
            'file://'
        ];

        return blocked.some(b => lower.startsWith(b));
    },

    // ============================================================
    // 🧼 SANITIZE — XSS Protection
    // ============================================================
    // ✅ CRITICAL FIX v1.9: regex.lastIndex reset bug
    //
    // पुराने code में `pattern.test()` lastIndex advance कर देता था
    // (/g flag के कारण), तो second call पर XSS bypass हो जाता था।
    //
    // Fix: हर pattern पर 3 जगह lastIndex = 0
    //   1. test() से पहले
    //   2. replace() से पहले
    //   3. next iteration के लिए
    // ============================================================
    sanitize(input) {
        if (typeof input !== 'string') return input;
        let cleaned = input;

        for (let i = 0; i < this.suspiciousPatterns.length; i++) {
            const pattern = this.suspiciousPatterns[i];

            // ✅ CRITICAL FIX: Reset lastIndex before test
            pattern.lastIndex = 0;
            const hasMatch = pattern.test(cleaned);

            if (hasMatch) {
                this.threatsBlocked++;
                // ✅ CRITICAL FIX: Reset lastIndex before replace
                pattern.lastIndex = 0;
                cleaned = cleaned.replace(pattern, '[BLOCKED]');
            }

            // ✅ CRITICAL FIX: Reset after use for next iteration
            pattern.lastIndex = 0;
        }

        return cleaned;
    },

    /**
     * Block reason + increment counter
     */
    block(reason) {
        this.threatsBlocked++;
        console.warn('🛡️ Threat Blocked #' + this.threatsBlocked + ':', reason);
    },

    // ============================================================
    // 🔑 LICENSE KEY VALIDATION
    // ============================================================
    isValidLicenseKey(key) {
        if (!key || typeof key !== 'string') return false;
        this.LICENSE_KEY_REGEX.lastIndex = 0;  // ✅ Reset
        return this.LICENSE_KEY_REGEX.test(key.trim());
    },

    /**
     * Validate trial key format
     */
    isValidTrialKey(key) {
        if (!key || typeof key !== 'string') return false;
        return /^HKT-\d{7}-[A-F0-9]{4}$/i.test(key.trim());
    },

    /**
     * Validate HWID format
     */
    isValidHwid(hwid) {
        if (!hwid || typeof hwid !== 'string') return false;
        return /^DVC-[A-F0-9]{4}-[A-F0-9]{4}$/i.test(hwid.trim());
    },

    // ============================================================
    // 📜 SCRIPT TRUST CHECK
    // ============================================================
    isTrustedScript(src) {
        if (!src || typeof src !== 'string') {
            // Empty src = inline script → untrusted
            return false;
        }

        try {
            const absolute = new URL(src, window.location.href);
            const pathname = absolute.pathname || '';
            const basename = pathname.split('/').pop().split('?')[0].split('#')[0];

            // Same-origin: whitelist basename
            if (absolute.origin === window.location.origin) {
                return this.TRUSTED_SCRIPT_BASENAMES.includes(basename);
            }

            // Cross-origin: whitelist origin
            if (this.TRUSTED_ORIGINS.includes(absolute.hostname)) {
                return true;
            }

            return false;
        } catch (e) {
            return false;
        }
    },

    // ============================================================
    // 🔒 STORAGE GUARD — Prevent license tampering
    // ============================================================
    // ✅ v1.9: Object.defineProperty for unbeatable protection
    // ============================================================
    installStorageGuard() {
        const self = this;

        // ═══════════════════════════════════════════════════════
        // 1️⃣ localStorage.setItem guard
        // ═══════════════════════════════════════════════════════
        try {
            const originalSetItem = localStorage.setItem.bind(localStorage);

            Object.defineProperty(localStorage, 'setItem', {
                value: function(key, value) {
                    // Coerce to string safely
                    const strValue = (value === null || value === undefined)
                        ? ''
                        : String(value);

                    // ─── License name tampering check ───
                    if (key === 'hor_lic_user') {
                        if (strValue.length > 200 ||
                            /<script|javascript:|onerror/i.test(strValue)) {
                            self.block('Tampered license name write — blocked');
                            return;
                        }
                    }

                    // ─── License key format check ───
                    if (key === 'hor_lic_key') {
                        if (!self.isValidLicenseKey(strValue)) {
                            self.block('Malformed license key write — blocked');
                            return;
                        }
                    }

                    // ─── Trial key format check ───
                    if (key === 'hor_trial_key') {
                        if (!self.isValidTrialKey(strValue)) {
                            self.block('Malformed trial key write — blocked');
                            return;
                        }
                    }

                    // ─── Device HWID format check ───
                    if (key === 'hor_device_hwid') {
                        if (!self.isValidHwid(strValue)) {
                            self.block('Malformed device HWID write — blocked');
                            return;
                        }
                    }

                    // ✅ Passed — call original
                    return originalSetItem(key, value);
                },
                writable: false,
                configurable: false,
                enumerable: false
            });

            console.log('✅ [Security] localStorage guard installed');
        } catch (e) {
            console.warn('⚠️ localStorage guard install failed:', e.message);
        }

        // ═══════════════════════════════════════════════════════
        // 2️⃣ sessionStorage.setItem guard (bypass fix)
        // ═══════════════════════════════════════════════════════
        try {
            const origSessionSetItem = sessionStorage.setItem.bind(sessionStorage);

            Object.defineProperty(sessionStorage, 'setItem', {
                value: function(key, value) {
                    const strValue = (value === null || value === undefined)
                        ? ''
                        : String(value);

                    // Basic XSS check
                    if (strValue.length > 10000 ||
                        /<script|javascript:/i.test(strValue)) {
                        self.block('Suspicious sessionStorage write — blocked');
                        return;
                    }

                    return origSessionSetItem(key, value);
                },
                writable: false,
                configurable: false,
                enumerable: false
            });

            console.log('✅ [Security] sessionStorage guard installed');
        } catch (e) {
            console.warn('⚠️ sessionStorage guard install failed:', e.message);
        }
    },

    // ============================================================
    // ⏱️ INTEGRITY CHECK — periodic license validation
    // ============================================================
    // ✅ v1.9: 5s interval (was 10s)
    // ============================================================
    startIntegrityCheck() {
        const self = this;

        this._integrityIntervalId = setInterval(() => {
            try {
                let name = null;
                let key = null;
                let trialKey = null;
                let hwid = null;

                try {
                    name = localStorage.getItem('hor_lic_user');
                    key = localStorage.getItem('hor_lic_key');
                    trialKey = localStorage.getItem('hor_trial_key');
                    hwid = localStorage.getItem('hor_device_hwid');
                } catch (e) {
                    return;  // localStorage blocked, skip
                }

                // ─── Check 1: License name tampering ───
                if (name && (name.length > 200 ||
                             /<script|javascript:|onerror/i.test(name))) {
                    self.block('Tampered license name — auto-reset');
                    try {
                        localStorage.removeItem('hor_lic_user');
                        localStorage.removeItem('hor_lic_key');
                    } catch (e) {}
                    if (typeof applyFreeState === 'function') applyFreeState();
                    return;
                }

                // ─── Check 2: License key malformation ───
                if (key && !self.isValidLicenseKey(key)) {
                    self.block('Malformed license key — auto-reset');
                    try {
                        localStorage.removeItem('hor_lic_user');
                        localStorage.removeItem('hor_lic_key');
                    } catch (e) {}
                    if (typeof applyFreeState === 'function') applyFreeState();
                    return;
                }

                // ─── Check 3: Trial key malformation ───
                if (trialKey && !self.isValidTrialKey(trialKey)) {
                    self.block('Malformed trial key — auto-reset');
                    try {
                        localStorage.removeItem('hor_trial_start');
                        localStorage.removeItem('hor_trial_key');
                        localStorage.removeItem('hor_trial_device');
                    } catch (e) {}
                    if (typeof checkLicenseIntegrity === 'function') {
                        checkLicenseIntegrity();
                    }
                    return;
                }

                // ─── Check 4: Device HWID malformation ───
                if (hwid && !self.isValidHwid(hwid)) {
                    self.block('Malformed device HWID — auto-reset');
                    try {
                        localStorage.removeItem('hor_device_hwid');
                    } catch (e) {}
                }

            } catch (e) {
                // Silent — never let one check break the loop
            }
        }, 5000);  // ✅ 5s interval

        console.log('✅ [Security] Integrity check started (every 5s)');
    },

    // ============================================================
    // 👁️ DOM MONITOR — throttled MutationObserver
    // ============================================================
    // ✅ v1.9:
    //    • Observes documentElement (covers head + body)
    //    • 500ms batch throttle
    //    • Per-node try-catch
    // ============================================================
    monitorDOMLight() {
        if (!document.documentElement) {
            document.addEventListener('DOMContentLoaded', () => this.monitorDOMLight());
            return;
        }

        const self = this;

        let pendingNodes = [];
        let throttleTimer = null;

        function processPendingNodes() {
            const nodes = pendingNodes;
            pendingNodes = [];
            throttleTimer = null;

            if (nodes.length === 0) return;

            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                try {
                    if (!node || node.nodeType !== 1) continue;

                    const tag = (node.tagName || '').toLowerCase();

                    // ─── Script tags ───
                    if (tag === 'script') {
                        const src = node.src || '';

                        // ✅ Only block external scripts with untrusted sources
                        //    (inline scripts are left alone as they're whitelisted
                        //     via CSP or already trusted)
                        if (src && !self.isTrustedScript(src)) {
                            self.block('Injected <script> removed: ' +
                                       String(src).substring(0, 100));
                            node.remove();
                        }
                    }

                    // ─── Dangerous embed tags ───
                    else if (tag === 'iframe' ||
                             tag === 'object' ||
                             tag === 'embed' ||
                             tag === 'applet' ||
                             tag === 'frame' ||
                             tag === 'frameset') {
                        self.block('Injected <' + tag + '> removed');
                        node.remove();
                    }

                    // ─── Meta refresh redirect attacks ───
                    else if (tag === 'meta') {
                        const httpEquiv = (node.getAttribute('http-equiv') || '').toLowerCase();
                        if (httpEquiv === 'refresh') {
                            self.block('Meta refresh removed');
                            node.remove();
                        }
                    }

                    // ─── Link preload/prerender injections ───
                    else if (tag === 'link') {
                        const rel = (node.getAttribute('rel') || '').toLowerCase();
                        if (rel === 'import' || rel === 'prefetch' || rel === 'prerender') {
                            const href = node.getAttribute('href') || '';
                            if (href && !self.isTrustedScript(href)) {
                                self.block('Untrusted <link rel="' + rel + '"> removed');
                                node.remove();
                            }
                        }
                    }
                } catch (e) {
                    // Never let one bad node break the batch
                }
            }
        }

        const observer = new MutationObserver((mutations) => {
            for (let m = 0; m < mutations.length; m++) {
                const added = mutations[m].addedNodes;
                for (let n = 0; n < added.length; n++) {
                    const node = added[n];
                    if (node.nodeType === 1) {
                        pendingNodes.push(node);
                    }
                }
            }

            // ✅ Throttle: batch all mutations in 500ms window
            if (throttleTimer === null && pendingNodes.length > 0) {
                throttleTimer = setTimeout(processPendingNodes, 500);
            }
        });

        // ✅ Observe entire document (covers head + body)
        try {
            observer.observe(document.documentElement, {
                childList: true,
                subtree: true
            });
            this._observerInstance = observer;
            console.log('✅ [Security] DOM monitor started');
        } catch (e) {
            console.warn('⚠️ MutationObserver setup failed:', e.message);
        }
    },

    // ============================================================
    // 🧹 CLEANUP — Remove listeners/intervals on unload
    // ============================================================
    cleanup() {
        try {
            if (this._observerInstance) {
                this._observerInstance.disconnect();
                this._observerInstance = null;
            }
            if (this._integrityIntervalId) {
                clearInterval(this._integrityIntervalId);
                this._integrityIntervalId = null;
            }
            console.log('🧹 Security Shield cleanup complete');
        } catch (e) {
            // Silent
        }
    }
};

// ============================================================
// ✅ INITIALIZE
// ============================================================
SecurityShield.init();

// ============================================================
// 🧹 CLEANUP ON PAGE UNLOAD
// ============================================================
window.addEventListener('beforeunload', () => {
    SecurityShield.cleanup();
});

// ============================================================
// 📊 DEBUG HELPERS
// ============================================================
if (typeof window !== 'undefined') {
    window.SecurityDebug = {
        /**
         * Show current security status
         */
        status: () => {
            console.log('═══════════════════════════════════════════');
            console.log('🛡️ Security Shield Status');
            console.log('───────────────────────────────────────────');
            console.log('  Version:', SecurityShield.version);
            console.log('  Threats Blocked:', SecurityShield.threatsBlocked);
            console.log('  Patterns Loaded:', SecurityShield.suspiciousPatterns.length);
            console.log('  Trusted Scripts:', SecurityShield.TRUSTED_SCRIPT_BASENAMES.length);
            console.log('  Trusted Origins:', SecurityShield.TRUSTED_ORIGINS.length);
            console.log('  Critical Keys:', SecurityShield.CRITICAL_STORAGE_KEYS.length);
            console.log('  Uptime:',
                Math.round((Date.now() - SecurityShield._installTimestamp) / 1000) + 's');
            console.log('  DOM Observer:',
                SecurityShield._observerInstance ? 'active' : 'inactive');
            console.log('  Integrity Interval:',
                SecurityShield._integrityIntervalId ? 'active (5s)' : 'inactive');
            console.log('═══════════════════════════════════════════');
        },

        /**
         * Test sanitize function
         */
        test: (str) => {
            console.log('🧪 Sanitize test:');
            console.log('  Input: ', str);
            const out = SecurityShield.sanitize(str);
            console.log('  Output:', out);
            return out;
        },

        /**
         * Test double-call (lastIndex bug check)
         */
        testDoubleCall: (str) => {
            console.log('🧪 Double-call test (lastIndex bug check):');
            const out1 = SecurityShield.sanitize(str);
            const out2 = SecurityShield.sanitize(str);
            console.log('  1st call:', out1);
            console.log('  2nd call:', out2);
            console.log('  Match:', out1 === out2 ? '✅ FIXED (same output)' : '❌ BUG');
        },

        /**
         * Test license key validation
         */
        testKey: (key) => {
            console.log('🔑 License key test:');
            console.log('  Key:', key);
            console.log('  Valid:', SecurityShield.isValidLicenseKey(key));
        },

        /**
         * Test URL for suspicious patterns
         */
        testURL: (url) => {
            console.log('🌐 URL test:');
            console.log('  URL:', url);
            console.log('  Suspicious:', SecurityShield.isSuspiciousUrl(url));
        },

        /**
         * Test script trust
         */
        testScript: (src) => {
            console.log('📜 Script trust test:');
            console.log('  Src:', src);
            console.log('  Trusted:', SecurityShield.isTrustedScript(src));
        },

        /**
         * Test all validators
         */
        testValidators: () => {
            console.log('🧪 Testing all validators:');

            // License key tests
            const validKey = 'HKP-P3-9999-' + 'A'.repeat(128);
            const validKeyDate = 'HKP-P1-260921-' + 'B'.repeat(128);
            const invalidKey1 = 'HKP-P3-99-' + 'A'.repeat(128);
            const invalidKey2 = 'HKP-P4-9999-' + 'A'.repeat(128);
            const invalidKey3 = 'HKP-P3-9999-' + 'A'.repeat(100);

            console.log('  ✅ Valid P3 key:', SecurityShield.isValidLicenseKey(validKey));
            console.log('  ✅ Valid P1 date key:', SecurityShield.isValidLicenseKey(validKeyDate));
            console.log('  ❌ Invalid (short):', SecurityShield.isValidLicenseKey(invalidKey1));
            console.log('  ❌ Invalid (plan):', SecurityShield.isValidLicenseKey(invalidKey2));
            console.log('  ❌ Invalid (sig len):', SecurityShield.isValidLicenseKey(invalidKey3));

            // Trial key tests
            console.log('  ✅ Valid trial:', SecurityShield.isValidTrialKey('HKT-1234567-ABCD'));
            console.log('  ❌ Invalid trial:', SecurityShield.isValidTrialKey('HKT-123-ABCD'));

            // HWID tests
            console.log('  ✅ Valid HWID:', SecurityShield.isValidHwid('DVC-A1B2-C3D4'));
            console.log('  ❌ Invalid HWID:', SecurityShield.isValidHwid('DVC-123'));
        },

        /**
         * Reset threat counter
         */
        resetCounter: () => {
            SecurityShield.threatsBlocked = 0;
            console.log('🔄 Threat counter reset');
        },

        /**
         * Manually test injected script removal (dev only)
         */
        testInjection: () => {
            console.log('🧪 Testing DOM injection (dev mode)...');
            const testScript = document.createElement('script');
            testScript.src = 'https://evil.example.com/malware.js';
            testScript.textContent = 'console.log("should be blocked")';
            document.body.appendChild(testScript);

            setTimeout(() => {
                const stillThere = document.body.contains(testScript);
                console.log(stillThere
                    ? '❌ Injected script NOT removed'
                    : '✅ Injected script auto-removed');
            }, 700);
        }
    };
}

// ============================================================
// 📋 STARTUP LOG
// ============================================================
console.log('✅ security.js loaded — v1.9 (Object.defineProperty + regex fix + DOM hardened)');