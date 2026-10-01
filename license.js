// ============================================================
// 🔐 LICENSE VERIFICATION SYSTEM (ECDSA P-256)
// + 3-LAYER HWID PERSISTENCE + ₹9 PAID TRIAL
// ============================================================
// ✅ v3.7.4.34 — AUDIT FIXES:
//    • CRITICAL: Future-dated trial start = CLOCK TAMPER
//      (was: infinite trial if user set clock forward)
//    • ClockGuard: forward-jump detection (30+ days)
//    • Session rollback slack: 60s → 30s
//    • Trial users: re-set lastSeen on every check
//    • All localStorage calls wrapped in try-catch
//    • Robust error handling everywhere
//    • HWID fallback for tracker
//    • Network errors = SAFE (fail-open policy)
//    • Server errors = SAFE (offline-friendly)
//    • Only confirmed time mismatch (>60min) = UNSAFE
// ============================================================

let isProLicensed = false;
const LICENSE_PAYLOAD_VERSION = 'BOSC-HKP-v3.7.4';
let _cachedPublicKey = null;

// ============================================================
// 🔐 HELPER: Check Pro Access (License OR Trial)
// ✅ SINGLE SOURCE OF TRUTH — other files use this
// ============================================================
function hasProLevelAccess() {
    // Real license check
    if (typeof isProLicensed !== 'undefined' && isProLicensed === true) return true;

    // Trial check
    if (typeof APP_CONFIG !== 'undefined' &&
        APP_CONFIG.TRIAL_ENABLED === true &&
        typeof TrialSystem !== 'undefined' &&
        typeof TrialSystem.isActive === 'function' &&
        TrialSystem.isActive() === true) {
        return true;
    }

    // Direct localStorage fallback
    try {
        const licKey = localStorage.getItem('hor_lic_key');
        const trialKey = localStorage.getItem('hor_trial_key');
        if (licKey && licKey.startsWith('HKP-')) return true;
        if (trialKey && trialKey.startsWith('HKT-')) return true;
    } catch (e) {}

    return false;
}

// ✅ Expose globally so other files can use
window.hasProLevelAccess = hasProLevelAccess;

// ============================================================
// ⏰ CLOCK TRICK DETECTION SYSTEM
// ============================================================
// ✅ FIXED v3.7.4.34:
//    • detectLocalRollback: ABSOLUTE drift check added
//    • Network errors = SAFE (fail-open, offline users unblocked)
//    • Server error = SAFE (resilience)
//    • Only confirmed time mismatch (>60min) = UNSAFE
//    • MAX_FORWARD_JUMP_DAYS = 30 (was: unbounded)
// ============================================================
const ClockGuard = {
    STORAGE_KEY: 'hor_last_seen_time',
    SESSION_KEY: 'hor_session_start_time',
    MAX_ROLLBACK_MINUTES: 5,
    MAX_SERVER_DRIFT_MINUTES: 60,
    MAX_FORWARD_JUMP_DAYS: 30,  // ✅ NEW: 30+ days forward = tamper

    now() { return Date.now(); },

    getLastSeen() {
        try {
            const val = localStorage.getItem(this.STORAGE_KEY);
            return val ? parseInt(val, 10) : null;
        } catch (e) {
            return null;
        }
    },

    setLastSeen(timestamp = null) {
        try {
            const t = timestamp || this.now();
            localStorage.setItem(this.STORAGE_KEY, String(t));
        } catch (e) {
            // Silent — localStorage may be blocked
        }
    },

    detectLocalRollback() {
        const lastSeen = this.getLastSeen();
        if (!lastSeen) {
            this.setLastSeen();
            return { safe: true, reason: 'first-time' };
        }

        const now = this.now();

        // ✅ Check backward rollback (clock set BACKWARD)
        const diffMinutes = (lastSeen - now) / 60000;
        if (diffMinutes > this.MAX_ROLLBACK_MINUTES) {
            return {
                safe: false,
                reason: 'local-rollback',
                lastSeen: new Date(lastSeen).toISOString(),
                current: new Date(now).toISOString(),
                diffMinutes: Math.round(diffMinutes)
            };
        }

        // ✅ NEW: Check forward jump (clock set FORWARD, then back)
        // अगर पिछली बार से 30+ दिन आगे बढ़ गया = संदिग्ध
        const forwardDays = (now - lastSeen) / (1000 * 60 * 60 * 24);
        if (forwardDays > this.MAX_FORWARD_JUMP_DAYS) {
            return {
                safe: false,
                reason: 'local-forward-jump',
                lastSeen: new Date(lastSeen).toISOString(),
                current: new Date(now).toISOString(),
                forwardDays: Math.round(forwardDays)
            };
        }

        this.setLastSeen();
        return { safe: true };
    },

    async detectServerMismatch() {
        try {
            // Offline = SAFE (can't verify, allow with local check)
            if (!navigator.onLine) {
                return { safe: true, reason: 'offline' };
            }

            // Build server URL
            let serverUrl = 'https://hor-katha-tracker-default-rtdb.asia-southeast1.firebasedatabase.app/.json?shallow=true';
            try {
                const endpoint = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.TRACKING_ENDPOINT)
                    ? APP_CONFIG.TRACKING_ENDPOINT
                    : '';
                if (endpoint && endpoint.includes('firebasedatabase.app')) {
                    const u = new URL(endpoint);
                    serverUrl = `${u.protocol}//${u.host}/.json?shallow=true`;
                }
            } catch (e) {
                // Use default URL
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const res = await fetch(serverUrl, {
                method: 'GET',
                cache: 'no-store',
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            const serverDateHeader = res.headers.get('date');
            if (!serverDateHeader) {
                return { safe: true, reason: 'no-server-date' };
            }

            const serverTime = new Date(serverDateHeader).getTime();
            const localTime = this.now();
            const diffMinutes = Math.abs(serverTime - localTime) / 60000;

            if (diffMinutes > this.MAX_SERVER_DRIFT_MINUTES) {
                return {
                    safe: false,
                    reason: 'server-mismatch',
                    serverTime: new Date(serverTime).toISOString(),
                    localTime: new Date(localTime).toISOString(),
                    diffMinutes: Math.round(diffMinutes)
                };
            }
            return { safe: true, serverTime };

        } catch (e) {
            // ✅ CRITICAL FIX: Network/abort/timeout error = SAFE (fail-open)
            //    Offline users, slow networks, blocked users should NOT be blocked
            console.warn('⚠️ Server time check failed (fail-open):', e.message);
            return {
                safe: true,
                reason: 'network-error-ignored',
                error: e.message
            };
        }
    },

    detectSessionRollback() {
        try {
            const sessionStart = sessionStorage.getItem(this.SESSION_KEY);
            if (!sessionStart) {
                sessionStorage.setItem(this.SESSION_KEY, String(this.now()));
                return { safe: true };
            }

            const startTime = parseInt(sessionStart, 10);
            const now = this.now();

            // ✅ FIXED: 30s slack (was 60s)
            if (now < startTime - 30000) {
                return {
                    safe: false,
                    reason: 'session-rollback',
                    startTime: new Date(startTime).toISOString(),
                    current: new Date(now).toISOString()
                };
            }
            return { safe: true };
        } catch (e) {
            return { safe: true };
        }
    },

    async fullCheck() {
        // Local + session checks (synchronous)
        const local = this.detectLocalRollback();
        if (!local.safe) return local;

        const session = this.detectSessionRollback();
        if (!session.safe) return session;

        // Server check (fail-open on network error)
        const server = await this.detectServerMismatch();
        if (!server.safe) {
            console.warn('🚨 Server time mismatch detected:', server.reason);
            if (typeof showToast === 'function') {
                showToast('⚠️ System time change detected. Please restore correct time.', 'error', 6000);
            }
            return server;
        }

        return { safe: true };
    }
};

// ============================================================
// 📱 DEVICE HARDWARE FINGERPRINT — 3-Layer Persistent
// ============================================================
async function getDeviceHardwareFingerprint() {
    // STEP 1: Try OS-level persistent storage
    if (window.electronAPI && window.electronAPI.isElectron) {
        try {
            const result = await window.electronAPI.loadHwid();
            if (result && result.success && result.hwid) {
                console.log('✅ HWID loaded from OS (' + result.source + ')');
                try {
                    localStorage.setItem('hor_device_hwid', result.hwid);
                    localStorage.setItem('hor_hwid_source', result.source);
                } catch (e) {}
                return result.hwid;
            }
        } catch (e) {
            console.warn('⚠️ OS HWID load failed:', e.message);
        }
    }

    // STEP 2: Try localStorage
    let storedHwid = null;
    try {
        storedHwid = localStorage.getItem('hor_device_hwid');
        if (storedHwid && /^DVC-[A-F0-9]{4}-[A-F0-9]{4}$/i.test(storedHwid)) {
            console.log('✅ HWID loaded from localStorage');
            if (window.electronAPI && window.electronAPI.isElectron) {
                window.electronAPI.saveHwid(storedHwid).catch(() => {});
            }
            return storedHwid;
        }
    } catch (e) {
        console.warn('⚠️ localStorage read failed:', e.message);
    }

    // STEP 3: Generate new
    console.log('🆕 Generating new HWID...');
    const stableSignals = [
        navigator.hardwareConcurrency || 4,
        navigator.deviceMemory || 'unknown',
        navigator.maxTouchPoints || 0,
        navigator.platform || 'unknown',
        (screen && screen.colorDepth) || 24,
        (screen && screen.pixelDepth) || 24,
        new Date().getTimezoneOffset(),
        (Intl.DateTimeFormat().resolvedOptions().timeZone) || 'unknown',
        navigator.language || 'en'
    ];
    const combinedData = 'HW-V2|' + stableSignals.join('|');

    let newHwid = null;
    try {
        const enc = new TextEncoder();
        const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode(combinedData));
        const hashHex = Array.from(new Uint8Array(hashBuf))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase();
        newHwid = `DVC-${hashHex.substring(0, 4)}-${hashHex.substring(4, 8)}`;
    } catch (e) {
        console.error('❌ SHA-256 failed:', e);
        const fallbackSeed = stableSignals.join('');
        let simpleHash = 0;
        for (let i = 0; i < fallbackSeed.length; i++) {
            simpleHash = ((simpleHash << 5) - simpleHash + fallbackSeed.charCodeAt(i)) | 0;
        }
        const hex = Math.abs(simpleHash).toString(16).toUpperCase().padStart(8, '0').substring(0, 8);
        newHwid = `DVC-${hex.substring(0, 4)}-${hex.substring(4, 8)}`;
    }

    if (newHwid) {
        try {
            localStorage.setItem('hor_device_hwid', newHwid);
            localStorage.setItem('hor_hwid_source', 'generated');
        } catch (e) {
            console.warn('⚠️ Could not save HWID to localStorage');
        }
        if (window.electronAPI && window.electronAPI.isElectron) {
            try {
                await window.electronAPI.saveHwid(newHwid);
                console.log('💾 HWID saved to OS storage');
            } catch (e) {
                console.warn('⚠️ Could not save HWID to OS');
            }
        }
        console.log('🔒 New Device HWID generated');
    }
    return newHwid;
}

// ============================================================
// 🎁 PAID TRIAL SYSTEM (₹9 for 7 days)
// ============================================================
// ✅ CRITICAL FIX v3.7.4.34:
//    Future-dated trial start = CLOCK TAMPER → immediately expired
//    This closes the INFINITE TRIAL exploit.
// ============================================================
const TrialSystem = {
    async getDeviceHash() {
        try {
            const hwid = await getDeviceHardwareFingerprint();
            if (!hwid || typeof hwid !== 'string') return null;

            // Format: DVC-XXXX-YYYY → extract YYYY (last 4 hex chars)
            const match = hwid.match(/DVC-([A-F0-9]{4})-([A-F0-9]{4})/i);
            if (match && match[2]) {
                return match[2].toUpperCase();
            }

            // Fallback: strip non-hex and take last 4
            const cleanHwid = hwid.replace(/[^A-F0-9]/gi, '').toUpperCase();
            return cleanHwid.slice(-4);
        } catch (e) {
            console.error('Device hash failed:', e);
            return null;
        }
    },

    hasStarted() {
        try {
            const start = localStorage.getItem(APP_CONFIG.TRIAL_STORAGE_KEY);
            const key = localStorage.getItem(APP_CONFIG.TRIAL_KEY_STORAGE);
            return !!(start && key);
        } catch (e) {
            return false;
        }
    },

    async validateKey(key) {
        if (!key || typeof key !== 'string') {
            return { valid: false, reason: 'Key खाली है' };
        }

        const cleanKey = key.trim().toUpperCase();
        const parts = cleanKey.split('-');

        if (parts.length !== 3) {
            return { valid: false, reason: 'Key format गलत है (HKT-XXXXXXX-XXXX)' };
        }

        if (parts[0] !== 'HKT') {
            return { valid: false, reason: 'Key prefix गलत है (HKT होना चाहिए)' };
        }

        if (!/^\d{7}$/.test(parts[1])) {
            return { valid: false, reason: 'Key का middle part गलत है' };
        }

        if (!/^[A-F0-9]{4}$/.test(parts[2])) {
            return { valid: false, reason: 'Key का last part गलत है' };
        }

        const currentHash = await this.getDeviceHash();
        if (!currentHash) {
            return { valid: false, reason: 'Device ID नहीं मिली' };
        }

        if (parts[2] !== currentHash) {
            return {
                valid: false,
                reason: 'यह Key इस device के लिए नहीं है',
                expected: currentHash,
                got: parts[2]
            };
        }

        let usedKey = null;
        try {
            usedKey = localStorage.getItem(APP_CONFIG.TRIAL_KEY_STORAGE);
        } catch (e) {}

        if (usedKey === cleanKey) {
            return {
                valid: false,
                reason: 'यह Key पहले ही use हो चुकी है',
                alreadyUsed: true
            };
        }

        return { valid: true, key: cleanKey };
    },

    async activateWithKey(key) {
        // Check if trial is already active
        if (this.isActive()) {
            const info = this.getInfo();
            return {
                success: false,
                reason: `Trial पहले से active है — ${info.remainingDays} दिन बचे हैं`,
                alreadyActive: true
            };
        }

        // Check if trial has ever been used (even if expired/tampered)
        if (this.hasStarted()) {
            const info = this.getInfo();
            if (info.expired || info.tampered) {
                return {
                    success: false,
                    reason: 'इस device पर trial पहले use हो चुका है',
                    alreadyUsed: true
                };
            }
        }

        const validation = await this.validateKey(key);

        if (!validation.valid) {
            console.log('❌ Trial key validation failed:', validation.reason);
            return {
                success: false,
                reason: validation.reason,
                detail: validation
            };
        }

        try {
            const now = Date.now();
            const hwid = await getDeviceHardwareFingerprint();

            localStorage.setItem(APP_CONFIG.TRIAL_STORAGE_KEY, String(now));
            localStorage.setItem(APP_CONFIG.TRIAL_DEVICE_KEY, hwid);
            localStorage.setItem(APP_CONFIG.TRIAL_KEY_STORAGE, validation.key);

            console.log('🎁 Trial activated');
            console.log('🎁 Started at:', new Date(now).toLocaleString());

            if (typeof Tracker !== 'undefined' && Tracker.isEnabled()) {
                Tracker.logActivation('Trial User', 'TRIAL', 'activate').catch(() => {});
            }

            return {
                success: true,
                startDate: now,
                key: validation.key
            };
        } catch (e) {
            console.error('Trial activation failed:', e);
            return { success: false, reason: 'Activation error: ' + e.message };
        }
    },

    // ✅ CRITICAL FIX: Future-dated start = CLOCK TAMPER
    getInfo() {
        try {
            const startStr = localStorage.getItem(APP_CONFIG.TRIAL_STORAGE_KEY);
            const trialKey = localStorage.getItem(APP_CONFIG.TRIAL_KEY_STORAGE);

            if (!startStr || !trialKey) {
                return { active: false, started: false, hasKey: false };
            }

            const startTime = parseInt(startStr, 10);
            if (isNaN(startTime) || startTime <= 0) {
                return { active: false, started: false, hasKey: false, error: 'invalid-start-time' };
            }

            const now = Date.now();
            const totalDays = APP_CONFIG.TRIAL_DURATION_DAYS || 7;
            const totalMs = totalDays * 24 * 60 * 60 * 1000;

            // ✅ CRITICAL FIX: Future-dated start = CLOCK TAMPER
            // अगर startTime future में है (1 minute से ज्यादा) → tamper detected
            if (startTime > now + 60000) {
                console.warn('🚨 Future-dated trial start detected — clock tamper');
                return {
                    active: false,
                    started: true,
                    hasKey: true,
                    trialKey: trialKey,
                    expired: true,
                    tampered: true,
                    remainingDays: 0,
                    error: 'future-date-tamper'
                };
            }

            const elapsedMs = Math.max(0, now - startTime);
            const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);

            // ✅ Clamp remainingDays to [0, totalDays]
            const remainingDaysRaw = totalDays - elapsedDays;
            const remainingDays = Math.max(0, Math.min(totalDays, Math.ceil(remainingDaysRaw)));

            const elapsedDaysClamped = Math.max(0, Math.floor(elapsedDays));

            const expired = elapsedMs >= totalMs;
            const remainingMs = Math.max(0, totalMs - elapsedMs);

            return {
                active: !expired,
                started: true,
                hasKey: true,
                trialKey: trialKey,
                startTime: startTime,
                startDate: new Date(startTime),
                elapsedDays: elapsedDaysClamped,
                remainingDays: remainingDays,
                remainingMs: remainingMs,
                expired: expired,
                totalDays: totalDays
            };
        } catch (e) {
            return { active: false, started: false, hasKey: false, error: e.message };
        }
    },

    isActive() {
        const info = this.getInfo();
        return info.active === true;
    },

    isExpired() {
        const info = this.getInfo();
        return info.expired === true || info.tampered === true;
    },

    isNew() {
        const info = this.getInfo();
        return info.started && info.elapsedDays === 0;
    },

    showBanner() {
        const existing = document.getElementById('trialBanner');
        if (existing) existing.remove();
        const info = this.getInfo();
        if (!info.started) return;
        if (info.expired) {
            this.showExpiredBanner();
            return;
        }
        const showWarning = info.remainingDays <= 2;
        const banner = document.createElement('div');
        banner.id = 'trialBanner';
        banner.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: ${showWarning ? 'linear-gradient(135deg, #dc2626, #ef4444)' : 'linear-gradient(135deg, #f59e0b, #fbbf24)'};
            color: #ffffff;
            padding: 10px 20px;
            text-align: center;
            font-weight: 800;
            font-size: 0.85rem;
            z-index: 99998;
            box-shadow: 0 -4px 12px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            flex-wrap: wrap;
        `;
        banner.innerHTML = `
            <span style="font-size: 1.2rem;">${showWarning ? '⚠️' : '🎁'}</span>
            <span>
                ${showWarning
                    ? `<b>Trial ending soon!</b> Only ${info.remainingDays} day${info.remainingDays > 1 ? 's' : ''} left`
                    : `<b>₹9 Trial:</b> ${info.remainingDays} day${info.remainingDays > 1 ? 's' : ''} left`}
            </span>
            <button onclick="openBuyModal()" style="
                background: #ffffff;
                color: ${showWarning ? '#dc2626' : '#b45309'};
                border: none;
                padding: 5px 14px;
                border-radius: 20px;
                font-weight: 900;
                font-size: 0.72rem;
                cursor: pointer;
                white-space: nowrap;
            ">💳 Buy Full License</button>
            <button onclick="this.parentElement.remove()" style="
                background: transparent;
                border: none;
                color: #ffffff;
                font-size: 1rem;
                cursor: pointer;
                padding: 0 4px;
                opacity: 0.7;
            ">✕</button>
        `;
        document.body.appendChild(banner);
    },

    showExpiredBanner() {
        const existing = document.getElementById('trialBanner');
        if (existing) existing.remove();
        const banner = document.createElement('div');
        banner.id = 'trialBanner';
        banner.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #7f1d1d, #991b1b);
            color: #ffffff;
            padding: 12px 20px;
            text-align: center;
            font-weight: 800;
            font-size: 0.85rem;
            z-index: 99998;
            box-shadow: 0 -4px 12px rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            flex-wrap: wrap;
        `;
        banner.innerHTML = `
            <span style="font-size: 1.2rem;">🔒</span>
            <span><b>Trial Expired!</b> Buy Full License to unlock all features</span>
            <button onclick="openBuyModal()" style="
                background: #ffffff;
                color: #7f1d1d;
                border: none;
                padding: 6px 16px;
                border-radius: 20px;
                font-weight: 900;
                font-size: 0.75rem;
                cursor: pointer;
                white-space: nowrap;
            ">💳 Buy Now</button>
        `;
        document.body.appendChild(banner);
    },

    showExpiryModal() {
        const info = this.getInfo();
        if (!info.started) return;
        const modal = document.getElementById('trialExpiryModal');
        if (!modal) return;
        const daysEl = document.getElementById('trialDaysRemaining');
        if (daysEl) daysEl.textContent = info.expired ? '0' : info.remainingDays;
        const statusEl = document.getElementById('trialStatusText');
        if (statusEl) {
            if (info.expired) {
                statusEl.textContent = '❌ Your trial has expired. Buy Pro to continue using all features.';
                statusEl.style.color = '#dc2626';
            } else if (info.remainingDays <= 2) {
                statusEl.textContent = `⚠️ Hurry! Only ${info.remainingDays} day${info.remainingDays > 1 ? 's' : ''} left in your trial.`;
                statusEl.style.color = '#dc2626';
            } else {
                statusEl.textContent = `🎁 You have ${info.remainingDays} day${info.remainingDays > 1 ? 's' : ''} left in your trial.`;
                statusEl.style.color = '#16a34a';
            }
        }
        modal.style.display = 'flex';
    },

    reset() {
        try {
            localStorage.removeItem(APP_CONFIG.TRIAL_STORAGE_KEY);
            localStorage.removeItem(APP_CONFIG.TRIAL_DEVICE_KEY);
            localStorage.removeItem(APP_CONFIG.TRIAL_KEY_STORAGE);
            console.log('🔄 Trial reset');
            return { success: true };
        } catch (e) {
            console.error('Trial reset failed:', e.message);
            return { success: false, error: e.message };
        }
    },

    extend(days) {
        try {
            const startStr = localStorage.getItem(APP_CONFIG.TRIAL_STORAGE_KEY);
            if (!startStr) return { success: false, error: 'Trial not started' };
            const startTime = parseInt(startStr, 10);
            if (isNaN(startTime)) return { success: false, error: 'Invalid start time' };
            const extensionMs = days * 24 * 60 * 60 * 1000;
            const newStartTime = startTime + extensionMs;
            localStorage.setItem(APP_CONFIG.TRIAL_STORAGE_KEY, String(newStartTime));
            console.log(`🎁 Trial extended by ${days} days`);
            return { success: true, newStartTime };
        } catch (e) {
            console.error('Trial extend failed:', e.message);
            return { success: false, error: e.message };
        }
    }
};

// ============================================================
// 🔑 CACHED PUBLIC KEY
// ============================================================
async function getCachedPublicKey() {
    if (_cachedPublicKey) return _cachedPublicKey;
    try {
        const jwk = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.LICENSE_PUBLIC_KEY_JWK)
            ? APP_CONFIG.LICENSE_PUBLIC_KEY_JWK
            : null;
        if (!jwk || !jwk.x || !jwk.y ||
            jwk.x === 'REPLACE_WITH_YOUR_X_COORDINATE' ||
            jwk.x === 'YOUR_X_COORDINATE_HERE') {
            console.error('⚠️ License public key not configured');
            return null;
        }
        _cachedPublicKey = await crypto.subtle.importKey(
            'jwk',
            { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y },
            { name: 'ECDSA', namedCurve: 'P-256' },
            false,
            ['verify']
        );
        return _cachedPublicKey;
    } catch (e) {
        console.error('Public key import failed:', e);
        _cachedPublicKey = null;
        return null;
    }
}

// ============================================================
// 🔢 HEX TO BYTES
// ============================================================
function hexToBytes(hex) {
    if (!hex || hex.length % 2 !== 0) return null;
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        const b = parseInt(hex.substr(i, 2), 16);
        if (isNaN(b)) return null;
        bytes[i / 2] = b;
    }
    return bytes;
}

// ============================================================
// ✅ VERIFY LICENSE PAYLOAD (Real License)
// ============================================================
async function verifyLicensePayload(name, licenseKey) {
    if (!name || !licenseKey) return { valid: false, reason: 'Missing Details' };
    const cleanKey = licenseKey.trim().toUpperCase();
    const parts = cleanKey.split('-');
    if (parts.length !== 4 || parts[0] !== 'HKP') {
        return { valid: false, reason: 'Invalid Key Format' };
    }
    const plan = parts[1];
    const expiryToken = parts[2];
    const sigHex = parts[3];

    if (!['P1', 'P2', 'P3'].includes(plan)) {
        return { valid: false, reason: 'Invalid Plan Code' };
    }
    if (sigHex.length !== 128 || !/^[0-9A-F]+$/.test(sigHex)) {
        return { valid: false, reason: 'Invalid Signature Format' };
    }

    if (expiryToken !== '9999') {
        if (expiryToken.length !== 6 || !/^\d{6}$/.test(expiryToken)) {
            return { valid: false, reason: 'Malformed Expiry Token' };
        }
        const clockCheck = await ClockGuard.fullCheck();
        if (!clockCheck.safe) {
            console.warn('🚨 Clock rollback detected:', clockCheck.reason);
            return {
                valid: false,
                reason: 'Clock Tampering Detected',
                detail: `System time change kiya gaya hai.`
            };
        }
        const year = 2000 + parseInt(expiryToken.substring(0, 2), 10);
        const month = parseInt(expiryToken.substring(2, 4), 10) - 1;
        const day = parseInt(expiryToken.substring(4, 6), 10);
        const expiryDate = new Date(year, month, day, 23, 59, 59);
        if (isNaN(expiryDate.getTime())) {
            return { valid: false, reason: 'Invalid Expiry Date' };
        }
        if (new Date() > expiryDate) {
            return {
                valid: false,
                reason: 'License Expired',
                detail: `License ${expiryDate.toLocaleDateString()} ko expire ho gaya tha.`
            };
        }
    }

    const deviceId = await getDeviceHardwareFingerprint();
    if (!deviceId) {
        return { valid: false, reason: 'Device ID not available' };
    }

    const cleanName = name.trim().toLowerCase();
    const payloadStr = `${cleanName}|${deviceId}|${plan}|${expiryToken}|${LICENSE_PAYLOAD_VERSION}`;
    const payloadBytes = new TextEncoder().encode(payloadStr);
    const publicKey = await getCachedPublicKey();
    if (!publicKey) return { valid: false, reason: 'Public key not configured' };
    const sigBytes = hexToBytes(sigHex);
    if (!sigBytes) return { valid: false, reason: 'Signature Decode Error' };

    try {
        const isValid = await crypto.subtle.verify(
            { name: 'ECDSA', hash: 'SHA-256' },
            publicKey,
            sigBytes,
            payloadBytes
        );
        return isValid
            ? { valid: true, plan, expiry: expiryToken }
            : { valid: false, reason: 'Signature Mismatch' };
    } catch (e) {
        return { valid: false, reason: 'Verification Error' };
    }
}

// ============================================================
// 🔍 CHECK LICENSE INTEGRITY
// ============================================================
async function checkLicenseIntegrity() {
    try {
        ClockGuard.setLastSeen();
        let savedName = null;
        let savedKey = null;
        try {
            savedName = localStorage.getItem('hor_lic_user');
            savedKey = localStorage.getItem('hor_lic_key');
        } catch (e) {}

        // Priority 1: Real Pro license
        if (savedName && savedKey) {
            const verification = await verifyLicensePayload(savedName, savedKey);
            if (verification.valid) {
                isProLicensed = true;
                applyProState(savedName, verification.plan, false);
                const banner = document.getElementById('trialBanner');
                if (banner) banner.remove();
                return;
            } else if (verification.reason === 'Clock Tampering Detected') {
                console.warn('🚨 Clock tampering detected — downgrading to Free mode');
                if (typeof showToast === 'function') {
                    showToast('⚠️ System time change detected. Please restore correct time.', 'error', 6000);
                }
                try {
                    localStorage.removeItem('hor_lic_user');
                    localStorage.removeItem('hor_lic_key');
                } catch (e) {}
            }
        }
    } catch (e) {
        console.error('License check error:', e);
    }

    isProLicensed = false;

    // Priority 2: Check trial
    if (typeof APP_CONFIG !== 'undefined' &&
        APP_CONFIG.TRIAL_ENABLED &&
        typeof TrialSystem !== 'undefined' &&
        TrialSystem.isActive()) {
        // ✅ FIXED: Re-set lastSeen for trial users
        ClockGuard.setLastSeen();
        applyTrialState();
    } else {
        applyFreeState();

        if (typeof APP_CONFIG !== 'undefined' &&
            APP_CONFIG.TRIAL_ENABLED &&
            typeof TrialSystem !== 'undefined' &&
            TrialSystem.isExpired()) {
            setTimeout(() => TrialSystem.showExpiredBanner(), 500);
        }
    }

    // ✅ Background server time check (non-blocking, fail-open)
    setTimeout(async () => {
        try {
            const check = await ClockGuard.detectServerMismatch();
            if (!check.safe && check.reason === 'server-mismatch') {
                console.warn('🚨 Server time mismatch detected (background):', check);
                if (typeof showToast === 'function') {
                    showToast('⚠️ System time change detected.', 'warning', 6000);
                }
                // Re-verify license
                let hasKey = false;
                try {
                    hasKey = !!localStorage.getItem('hor_lic_key');
                } catch (e) {}
                if (hasKey) {
                    checkLicenseIntegrity();
                }
            }
        } catch (e) {}
    }, 3000);
}

// ============================================================
// ✅ APPLY PRO STATE
// ============================================================
function applyProState(name, planCode = 'P3', isFreshActivation = false) {
    const ver = typeof APP_CONFIG !== 'undefined' ? APP_CONFIG.VERSION : '3.7.4';
    const badge = document.getElementById('licenseBadge');
    if (badge) {
        badge.textContent = `v${ver} PRO (${planCode})`;
        badge.classList.add('pro');
        badge.style.background = '';
        badge.style.color = '';
    }
    const trig = document.getElementById('btn-license-trigger');
    if (trig) {
        trig.textContent = '✅ Pro Active';
        trig.classList.add('activated');
    }
    const buyBtn = document.getElementById('btn-buy-top');
    if (buyBtn) buyBtn.style.display = 'none';
    const licStatus = document.getElementById('licenseStatusText');
    if (licStatus) {
        licStatus.textContent = `Activated for: ${name} [${planCode}] (Bound to Device)`;
        licStatus.style.color = '#10b981';
    }

    const trialBadge = document.getElementById('trialBadge');
    if (trialBadge) trialBadge.style.display = 'none';

    if (typeof updateStatusMode === 'function') updateStatusMode(true, planCode);

    if (isFreshActivation && typeof Tracker !== 'undefined' && Tracker.isEnabled()) {
        try {
            Tracker.logActivation(name, planCode, 'activate').catch(() => {});
        } catch (e) {
            console.warn('Tracker activation failed:', e.message);
        }
    }
}

// ============================================================
// 🎁 APPLY TRIAL STATE
// ============================================================
function applyTrialState() {
    const ver = typeof APP_CONFIG !== 'undefined' ? APP_CONFIG.VERSION : '3.7.4';
    const badge = document.getElementById('licenseBadge');
    const trialInfo = TrialSystem.getInfo();

    if (badge) {
        badge.textContent = `v${ver} Trial (${trialInfo.remainingDays}d)`;
        badge.classList.remove('pro');
        badge.style.background = '#f59e0b';
        badge.style.color = '#fff';
    }

    const trig = document.getElementById('btn-license-trigger');
    if (trig) {
        trig.textContent = '⏱️ Trial Active';
        trig.classList.remove('activated');
    }

    const licStatus = document.getElementById('licenseStatusText');
    if (licStatus) {
        licStatus.textContent = `₹9 Trial Active — ${trialInfo.remainingDays} day${trialInfo.remainingDays > 1 ? 's' : ''} remaining`;
        licStatus.style.color = '#f59e0b';
    }

    const trialBadge = document.getElementById('trialBadge');
    if (trialBadge) {
        trialBadge.textContent = `🎁 Trial (${trialInfo.remainingDays}d)`;
        trialBadge.style.display = 'inline-block';
    }

    if (typeof updateStatusMode === 'function') updateStatusMode(true, 'TRIAL');

    setTimeout(() => TrialSystem.showBanner(), 1000);
}

// ============================================================
// 🆓 APPLY FREE STATE
// ============================================================
function applyFreeState() {
    const ver = typeof APP_CONFIG !== 'undefined' ? APP_CONFIG.VERSION : '3.7.4';
    const badge = document.getElementById('licenseBadge');
    if (badge) {
        badge.textContent = `v${ver} Free`;
        badge.classList.remove('pro');
        badge.style.background = '';
        badge.style.color = '';
    }
    const trig = document.getElementById('btn-license-trigger');
    if (trig) {
        trig.textContent = '🔑 Activate Pro';
        trig.classList.remove('activated');
    }
    const buyBtn = document.getElementById('btn-buy-top');
    if (buyBtn) buyBtn.style.display = 'inline-flex';
    const licStatus = document.getElementById('licenseStatusText');
    if (licStatus) {
        licStatus.textContent = 'Free Mode — Buy ₹9 Trial or Pro License';
        licStatus.style.color = '#d97706';
    }

    const trialBadge = document.getElementById('trialBadge');
    if (trialBadge) trialBadge.style.display = 'none';

    if (typeof updateStatusMode === 'function') updateStatusMode(false);
}

// ============================================================
// 🔒 REQUIRE PRO ACCESS (TRIAL-AWARE)
// ============================================================
function requireProAccess(featureName) {
    if (!hasProLevelAccess()) {
        if (typeof showToast === 'function') {
            showToast(`'${featureName}' सुविधा Hoṛ Katha Pro में उपलब्ध है।`, 'warning');
        } else {
            alert(`'${featureName}' सुविधा Hoṛ Katha Pro में उपलब्ध है।`);
        }
        if (typeof openTrialActivationModal === 'function') {
            openTrialActivationModal();
        } else if (typeof openBuyModal === 'function') {
            openBuyModal();
        }
        return false;
    }
    return true;
}

// ============================================================
// ⏰ BACKGROUND CLOCK MONITOR
// ============================================================
setInterval(() => {
    const check = ClockGuard.detectSessionRollback();
    if (!check.safe) {
        console.warn('🚨 Session clock rollback detected:', check);
        if (typeof showToast === 'function') {
            showToast('⚠️ System time change detected! License re-verify karein.', 'error', 6000);
        }
        checkLicenseIntegrity();
    }
    ClockGuard.setLastSeen();
}, 60000);

// Trial banner refresh every 5 min
setInterval(() => {
    if (typeof APP_CONFIG !== 'undefined' &&
        APP_CONFIG.TRIAL_ENABLED &&
        typeof TrialSystem !== 'undefined' &&
        TrialSystem.isActive()) {
        const banner = document.getElementById('trialBanner');
        if (banner) TrialSystem.showBanner();
    }
}, 5 * 60 * 1000);

// Set last seen on unload
window.addEventListener('beforeunload', () => {
    ClockGuard.setLastSeen();
});

console.log('✅ license.js loaded — v3.7.4.34 (infinite trial exploit FIXED + HWID fallback + fail-open clock)');