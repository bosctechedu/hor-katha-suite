// ============================================================
// 🔐 CRYPTO UTILS — AES-256 Encryption for Sensitive Data
// BOSC Tech & Edu · Hoṛ Katha Suite v3.7.4 Pro Ultra
// ============================================================
// Uses Web Crypto API (built-in, no library needed)
//
// ✅ v3.7.4.35 — AUDIT FIXES:
//    • crypto.subtle availability check + graceful fallback
//    • Key cache invalidation on HWID change
//    • encrypt/decrypt: empty input guard
//    • String.fromCharCode: chunk-based (stack overflow fix)
//    • decrypt: base64 parse try-catch
//    • hashAnonymous: empty input guard
//    • getSecure: better legacy detection
//    • setSecure: quota handling
//    • getKey: race condition fix (Promise cache)
//    • Better fallback seed (not just user agent)
//    • Debug helpers: CryptoDebug
// ============================================================

const CryptoUtils = {
    // ✅ FIXED: Key cache as Promise (race-safe)
    _keyCache: null,
    _keyCacheHwid: null,

    // ✅ FIXED: crypto.subtle availability check
    _isAvailable() {
        return !!(window.crypto && window.crypto.subtle && window.crypto.getRandomValues);
    },

    // ============================================================
    // 🔑 Derive AES-256 key from a passphrase
    // ============================================================
    async deriveKey(passphrase) {
        if (!this._isAvailable()) {
            throw new Error('crypto.subtle not available');
        }

        if (!passphrase || typeof passphrase !== 'string') {
            throw new Error('Passphrase required');
        }

        const enc = new TextEncoder();

        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            enc.encode(passphrase),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );

        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: enc.encode('HorKatha-Salt-v1'),
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    },

    // ============================================================
    // 🔑 Get or create key from device fingerprint
    // ✅ FIXED: HWID change detection + Promise cache (race-safe)
    // ============================================================
    async getKey() {
        // Get current HWID
        let currentHwid = null;
        try {
            currentHwid = localStorage.getItem('hor_device_hwid');
        } catch (e) {}

        // ✅ FIXED: Better fallback seed (not just user agent)
        if (!currentHwid) {
            const fallbackParts = [
                navigator.userAgent || 'unknown',
                navigator.language || 'en',
                navigator.platform || 'unknown',
                screen ? screen.colorDepth : 24,
                new Date().getTimezoneOffset(),
                navigator.hardwareConcurrency || 4
            ];
            currentHwid = 'fallback-seed-' + fallbackParts.join('|');
        }

        // ✅ FIXED: Invalidate cache if HWID changed
        if (this._keyCacheHwid !== currentHwid) {
            this._keyCache = null;
            this._keyCacheHwid = currentHwid;
        }

        // ✅ FIXED: Return cached Promise (race-safe)
        if (this._keyCache) {
            return this._keyCache;
        }

        // Create new promise cache
        this._keyCache = this.deriveKey(currentHwid).catch((err) => {
            console.error('Key derivation failed:', err);
            this._keyCache = null;
            this._keyCacheHwid = null;
            throw err;
        });

        return this._keyCache;
    },

    // ============================================================
    // 🔒 Encrypt string → returns base64 (IV + ciphertext)
    // ============================================================
    async encrypt(plaintext) {
        // ✅ FIXED: Empty input guard
        if (plaintext === null || plaintext === undefined) {
            return null;
        }

        if (!this._isAvailable()) {
            console.warn('⚠️ Encryption unavailable (no crypto.subtle)');
            return null;
        }

        try {
            const key = await this.getKey();
            const enc = new TextEncoder();
            const iv = crypto.getRandomValues(new Uint8Array(12));

            const ciphertext = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                enc.encode(String(plaintext))
            );

            // Combine IV + ciphertext
            const combined = new Uint8Array(iv.length + ciphertext.byteLength);
            combined.set(iv, 0);
            combined.set(new Uint8Array(ciphertext), iv.length);

            // ✅ FIXED: Chunk-based base64 (stack overflow prevention)
            return this._arrayBufferToBase64(combined);
        } catch (e) {
            console.error('Encrypt failed:', e);
            return null;
        }
    },

    // ============================================================
    // 🔓 Decrypt base64 → returns plaintext
    // ============================================================
    async decrypt(encoded) {
        // ✅ FIXED: Empty input guard
        if (!encoded || typeof encoded !== 'string') {
            return null;
        }

        if (!this._isAvailable()) {
            console.warn('⚠️ Decryption unavailable (no crypto.subtle)');
            return null;
        }

        try {
            const key = await this.getKey();

            // ✅ FIXED: Base64 parse try-catch
            let combined;
            try {
                combined = this._base64ToArrayBuffer(encoded);
            } catch (e) {
                console.warn('Base64 decode failed:', e.message);
                return null;
            }

            if (combined.length < 12) {
                console.warn('Encrypted data too short');
                return null;
            }

            const iv = combined.slice(0, 12);
            const ciphertext = combined.slice(12);

            const plaintext = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                ciphertext
            );

            return new TextDecoder().decode(plaintext);
        } catch (e) {
            console.error('Decrypt failed:', e);
            return null;
        }
    },

    // ============================================================
    // 🔧 Base64 helpers — chunk-based (stack overflow safe)
    // ============================================================
    _arrayBufferToBase64(uint8Array) {
        const CHUNK_SIZE = 8192;
        let binary = '';

        for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
            const chunk = uint8Array.subarray(i, i + CHUNK_SIZE);
            // ✅ Safe for large data (no ...spread)
            binary += String.fromCharCode.apply(null, chunk);
        }

        return btoa(binary);
    },

    _base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const len = binary.length;
        const bytes = new Uint8Array(len);

        for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
        }

        return bytes;
    },

    // ============================================================
    // 💾 Store encrypted value in localStorage
    // ============================================================
    async setSecure(key, value) {
        if (!key || typeof key !== 'string') return false;

        const encrypted = await this.encrypt(String(value));
        if (!encrypted) return false;

        try {
            localStorage.setItem(key, 'enc:' + encrypted);
            return true;
        } catch (e) {
            // ✅ FIXED: Quota handling
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                console.warn('⚠️ localStorage quota exceeded for:', key);
            } else {
                console.warn('⚠️ localStorage setItem failed:', e.message);
            }
            return false;
        }
    },

    // ============================================================
    // 💾 Retrieve decrypted value from localStorage
    // ============================================================
    async getSecure(key) {
        if (!key || typeof key !== 'string') return null;

        let raw = null;
        try {
            raw = localStorage.getItem(key);
        } catch (e) {
            return null;
        }

        if (!raw) return null;

        // ✅ FIXED: Better legacy detection
        if (raw.startsWith('enc:')) {
            const decrypted = await this.decrypt(raw.substring(4));
            if (decrypted !== null) return decrypted;
            // Decrypt failed — could be wrong key
            console.warn('Decrypt returned null for:', key);
            return null;
        }

        // Legacy plain value
        return raw;
    },

    // ============================================================
    // 🔢 Anonymous hash (one-way, non-reversible)
    // ============================================================
    async hashAnonymous(input) {
        // ✅ FIXED: Empty input guard
        if (input === null || input === undefined || input === '') {
            return null;
        }

        if (!this._isAvailable()) {
            // Fallback: simple hash
            console.warn('⚠️ Using fallback hash (no crypto.subtle)');
            return this._simpleHash(String(input));
        }

        try {
            const enc = new TextEncoder();
            const buf = await crypto.subtle.digest('SHA-256', enc.encode(String(input)));

            return Array.from(new Uint8Array(buf))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('')
                .substring(0, 16)
                .toUpperCase();
        } catch (e) {
            console.warn('SHA-256 failed, using fallback:', e.message);
            return this._simpleHash(String(input));
        }
    },

    // ============================================================
    // 🔧 Simple hash fallback (not cryptographically secure)
    // ============================================================
    _simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        const hex = Math.abs(hash).toString(16).padStart(8, '0');
        return (hex + hex).substring(0, 16).toUpperCase();
    },

    // ============================================================
    // 🔄 Clear key cache (call on HWID change)
    // ============================================================
    clearKeyCache() {
        this._keyCache = null;
        this._keyCacheHwid = null;
        console.log('🔑 Key cache cleared');
    },

    // ============================================================
    // 📊 Status check
    // ============================================================
    isAvailable() {
        return this._isAvailable();
    }
};

// Expose globally
window.CryptoUtils = CryptoUtils;

// ============================================================
// 📊 Debug helpers
// ============================================================
window.CryptoDebug = {
    status: () => {
        console.log('🔐 Crypto Utils Status:');
        console.log('  Available:', CryptoUtils.isAvailable());
        console.log('  Key cached:', !!CryptoUtils._keyCache);
        console.log('  Cached for HWID:', CryptoUtils._keyCacheHwid ? 'yes' : 'no');
    },
    testEncrypt: async (text = 'Hello World') => {
        console.log('🧪 Testing encrypt:', text);
        const encrypted = await CryptoUtils.encrypt(text);
        console.log('  Encrypted:', encrypted);

        const decrypted = await CryptoUtils.decrypt(encrypted);
        console.log('  Decrypted:', decrypted);
        console.log('  Match:', decrypted === text ? '✅' : '❌');
    },
    testHash: async (input = 'test') => {
        console.log('🧪 Testing hash:', input);
        const hash = await CryptoUtils.hashAnonymous(input);
        console.log('  Hash:', hash);
    },
    testSecure: async (key = 'test_key', value = 'secret_value') => {
        console.log('🧪 Testing secure storage:');
        const set = await CryptoUtils.setSecure(key, value);
        console.log('  Set:', set);

        const got = await CryptoUtils.getSecure(key);
        console.log('  Get:', got);
        console.log('  Match:', got === value ? '✅' : '❌');
    },
    testLargeData: async (size = 100000) => {
        console.log('🧪 Testing large data (' + size + ' chars)...');
        const big = 'A'.repeat(size);

        const encrypted = await CryptoUtils.encrypt(big);
        console.log('  Encrypted length:', encrypted ? encrypted.length : 'null');

        const decrypted = await CryptoUtils.decrypt(encrypted);
        console.log('  Decrypted length:', decrypted ? decrypted.length : 'null');
        console.log('  Match:', decrypted === big ? '✅' : '❌');
    },
    clearCache: () => {
        CryptoUtils.clearKeyCache();
    }
};

console.log('✅ crypto-utils.js loaded — v3.7.4.35 (race-safe + chunk-base64 + HWID-aware)');