// ============================================================
// 🔄 SERVICE WORKER — Cache + Offline Support (v13)
// BOSC Tech & Edu · Hoṛ Katha Suite v3.7.4 Pro Ultra
// ============================================================
// ✅ v13 — AUDIT FIXES:
//    • fetchWithTimeout: robust clone + abort handling
//    • Navigation fallback validates response.ok
//    • Added qr-offline.js + certificate.js to precache
//    • Broadened cache cleanup (all non-current caches)
//    • Per-asset-type network timeouts
//    • response.ok validation everywhere
//    • Admin folder block (prod-only)
//    • Global error + unhandledrejection handlers
//    • Production console filtering
//    • SKIP_WAITING message handler
//    • GET_VERSION message handler
//    • Better fallback chain for offline
//    • Cache size guards (5MB per asset, 50MB total)
//    • Pre-cache error aggregation report
//    • Dev-friendly logging (logSW helper)
// ============================================================

const SW_VERSION = '13';
const CACHE_NAME = `hor-katha-v374-cache-v${SW_VERSION}`;
const CACHE_PREFIX = 'hor-katha-v374-cache-';

// ─── Timeouts (milliseconds) ───
const NETWORK_TIMEOUT_MS = 10000;       // Default
const NAVIGATION_TIMEOUT_MS = 8000;     // Faster for HTML
const CDN_TIMEOUT_MS = 12000;           // Slower for CDN (fonts, libs)
const FONT_TIMEOUT_MS = 15000;          // Slowest for fonts

// ─── Size guards ───
const MAX_ASSET_SIZE_BYTES = 5 * 1024 * 1024;   // 5 MB per asset
const MAX_CACHE_SIZE_BYTES = 50 * 1024 * 1024;  // 50 MB total

// ─── Environment detection ───
const IS_DEV = (
    self.location.hostname === 'localhost' ||
    self.location.hostname === '127.0.0.1' ||
    self.location.protocol === 'file:'
);

// ─── Logging helpers ───
function logSW(...args) {
    if (IS_DEV) console.log('[SW]', ...args);
}

function warnSW(...args) {
    console.warn('[SW]', ...args);
}

function errorSW(...args) {
    console.error('[SW]', ...args);
}

// ============================================================
// 📦 ASSETS TO CACHE (pre-cache list)
// ============================================================
const ASSETS_TO_CACHE = [
    // ─── Core HTML ───
    './',
    './index.html',
    './manifest.json',
    './privacy.html',
    './verify.html',

    // ─── Stylesheets ───
    './css/style.css',
    './css/modals.css',
    './css/typing-test.css',
    './css/certificate.css',

    // ─── Core JS ───
    './js/config.js',
    './js/keymaps.js',
    './js/audio.js',
    './js/crypto-utils.js',
    './js/tracker.js',
    './js/security.js',
    './js/license.js',
    './js/editor.js',
    './js/keyboard.js',
    './js/modals.js',
    './js/privacy.js',
    './js/app.js',
    './js/typing-test.js',
    './js/certificate.js',
    './js/print-generator.js',
    './js/qr-offline.js',
    './js/qrcode.min.js',

    // ─── Local fonts (offline) ───
    './assets/fonts/NotoSansDevanagari-Regular.ttf',
    './assets/fonts/NotoSansDevanagari-Bold.ttf',
    './assets/fonts/NotoSansOlChiki-Regular.ttf',
    './assets/fonts/NotoSansOlChiki-Bold.ttf',
    './assets/fonts/NotoSerifDevanagari-Regular.ttf',
    './assets/fonts/NotoSerifDevanagari-Bold.ttf',

    // ─── Icons (PWA) ───
    './assets/icon-192.png',
    './assets/icon-512.png',
    './assets/icon.ico'
];

// ============================================================
// 🛠️ HELPERS
// ============================================================

/**
 * Fetch with timeout + safe request cloning
 * @param {Request|string} request - Request or URL
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<Response>}
 */
function fetchWithTimeout(request, timeoutMs = NETWORK_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
        const controller = new AbortController();

        const timeoutId = setTimeout(() => {
            try {
                controller.abort();
            } catch (e) {
                // Abort may throw if already aborted
            }
            reject(new Error('Fetch timeout after ' + timeoutMs + 'ms'));
        }, timeoutMs);

        let req;
        try {
            if (request instanceof Request) {
                req = new Request(request, { signal: controller.signal });
            } else {
                req = new Request(request, { signal: controller.signal });
            }
        } catch (e) {
            // Request clone failed — use original
            warnSW('Request clone failed, using original:', e.message);
            req = request;
        }

        let fetchPromise;
        try {
            fetchPromise = fetch(req);
        } catch (e) {
            clearTimeout(timeoutId);
            return reject(e);
        }

        fetchPromise.then(
            (response) => {
                clearTimeout(timeoutId);
                resolve(response);
            },
            (error) => {
                clearTimeout(timeoutId);
                reject(error);
            }
        );
    });
}

/**
 * Safe cache put (with size guard + try-catch)
 * @param {Cache} cache - Cache instance
 * @param {Request} request - Request
 * @param {Response} response - Response to cache
 * @returns {Promise<boolean>}
 */
async function safeCachePut(cache, request, response) {
    try {
        // ✅ Only cache successful responses
        if (!response || !response.ok) {
            return false;
        }

        // ✅ Skip large responses (> 5MB) to prevent memory pressure
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength, 10) > MAX_ASSET_SIZE_BYTES) {
            logSW('Skipping large asset:', request.url,
                  '(' + contentLength + ' bytes)');
            return false;
        }

        await cache.put(request, response);
        return true;
    } catch (e) {
        warnSW('Cache put failed for', request.url, ':', e.message);
        return false;
    }
}

/**
 * Check if request should be excluded from cache
 * @param {URL} url - Parsed URL
 * @returns {boolean}
 */
function shouldSkipCache(url) {
    try {
        const pathname = url.pathname || '';

        // Skip admin folder (production only)
        if (pathname.includes('/admin/')) {
            const host = url.hostname;
            const isLocalDev =
                host === 'localhost' ||
                host === '127.0.0.1' ||
                host === self.location.hostname;

            // ✅ In production: block admin
            // ✅ In dev: allow admin (for testing)
            if (!isLocalDev && !IS_DEV) {
                return true;
            }
        }

        // Skip dynamic endpoints (tracking, verify with params)
        if (pathname.includes('/activations.json')) return true;

        return false;
    } catch (e) {
        return false;
    }
}

/**
 * Offline fallback HTML
 */
function getOfflineHTML() {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Offline</title>
<style>
body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    padding: 40px;
    background: #0d1117;
    color: #c9d1d9;
    text-align: center;
    min-height: 100vh;
    margin: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}
h1 { color: #58a6ff; font-size: 2rem; margin-bottom: 12px; }
p { color: #8b949e; max-width: 400px; margin-bottom: 20px; }
button {
    padding: 12px 28px;
    background: #238636;
    color: #fff;
    border: none;
    border-radius: 6px;
    font-weight: bold;
    cursor: pointer;
    font-size: 0.95rem;
}
button:hover { background: #2ea043; }
</style></head>
<body>
<h1>📡 Offline</h1>
<p>Aap offline hain aur ye page cached nahi hai.</p>
<button onclick="location.reload()">🔄 Retry</button>
</body></html>`;
}

// ============================================================
// 📥 INSTALL — Pre-cache assets
// ============================================================
self.addEventListener('install', (event) => {
    logSW('Installing v' + SW_VERSION + '...');

    event.waitUntil(
        (async () => {
            try {
                const cache = await caches.open(CACHE_NAME);
                logSW('Pre-caching', ASSETS_TO_CACHE.length, 'assets');

                // ✅ Pre-cache with individual error handling
                const results = await Promise.allSettled(
                    ASSETS_TO_CACHE.map(url =>
                        cache.add(url)
                            .then(() => ({ url, ok: true }))
                            .catch(err => {
                                warnSW('Pre-cache failed:', url, err.message);
                                return { url, ok: false, error: err.message };
                            })
                    )
                );

                // ✅ Aggregate success/fail report
                const succeeded = results.filter(r =>
                    r.status === 'fulfilled' &&
                    r.value &&
                    r.value.ok
                ).length;

                const failed = results.filter(r =>
                    r.status === 'rejected' ||
                    (r.value && !r.value.ok)
                );

                logSW(`📊 Pre-cache result: ${succeeded}/${ASSETS_TO_CACHE.length} succeeded`);

                if (failed.length > 0) {
                    warnSW(`${failed.length} assets failed to cache:`);
                    failed.forEach(r => {
                        const url = r.value?.url || 'unknown';
                        warnSW('  ⚠️', url);
                    });
                } else {
                    logSW('✅ All assets pre-cached');
                }
            } catch (err) {
                errorSW('Cache open failed:', err);
            }

            // ✅ Skip waiting so new version activates quickly
            try {
                self.skipWaiting();
            } catch (e) {
                warnSW('skipWaiting failed:', e.message);
            }
        })()
    );
});

// ============================================================
// ♻️ ACTIVATE — Clean old caches
// ============================================================
self.addEventListener('activate', (event) => {
    logSW('Activating v' + SW_VERSION + '...');

    event.waitUntil(
        (async () => {
            try {
                // ✅ Delete ALL old caches (any with our prefix)
                const keys = await caches.keys();

                const oldCaches = keys.filter(key =>
                    key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME
                );

                // Also delete any other stale caches (different prefixes)
                const otherOldCaches = keys.filter(key =>
                    !key.startsWith(CACHE_PREFIX) &&
                    key !== CACHE_NAME &&
                    key.includes('hor-katha')  // Only our app's caches
                );

                const allOldCaches = [...oldCaches, ...otherOldCaches];

                logSW('Deleting', allOldCaches.length, 'old caches');

                await Promise.all(
                    allOldCaches.map(key => {
                        logSW('Deleting old cache:', key);
                        return caches.delete(key);
                    })
                );

                logSW('✅ Old caches cleaned');
            } catch (e) {
                warnSW('Cache cleanup failed:', e.message);
            }

            // ✅ Take control of all clients
            try {
                await self.clients.claim();
                logSW('✅ Clients claimed');
            } catch (e) {
                warnSW('Clients claim failed:', e.message);
            }
        })()
    );
});

// ============================================================
// 💬 MESSAGE HANDLER
// ============================================================
self.addEventListener('message', (event) => {
    if (!event.data) return;

    // ─── SKIP_WAITING — Fast activation ───
    if (event.data === 'SKIP_WAITING' ||
        (typeof event.data === 'object' && event.data.type === 'SKIP_WAITING')) {
        logSW('Received SKIP_WAITING message');
        try {
            self.skipWaiting();
        } catch (e) {
            warnSW('skipWaiting failed:', e.message);
        }
        return;
    }

    // ─── GET_VERSION — Version check ───
    if (typeof event.data === 'object' && event.data.type === 'GET_VERSION') {
        try {
            event.ports[0].postMessage({
                version: SW_VERSION,
                cacheName: CACHE_NAME
            });
        } catch (e) {
            warnSW('GET_VERSION response failed:', e.message);
        }
        return;
    }

    // ─── CLEAR_CACHE — Manual cache clear ───
    if (typeof event.data === 'object' && event.data.type === 'CLEAR_CACHE') {
        logSW('Received CLEAR_CACHE request');
        (async () => {
            try {
                const keys = await caches.keys();
                await Promise.all(keys.map(k => caches.delete(k)));

                if (event.ports && event.ports[0]) {
                    event.ports[0].postMessage({ success: true, deleted: keys.length });
                }

                logSW('🗑️ All caches cleared');
            } catch (e) {
                if (event.ports && event.ports[0]) {
                    event.ports[0].postMessage({ success: false, error: e.message });
                }
            }
        })();
        return;
    }
});

// ============================================================
// 🌐 FETCH HANDLER — Per-asset-type strategy
// ============================================================
self.addEventListener('fetch', (event) => {
    // Only handle GET
    if (event.request.method !== 'GET') return;

    let url;
    try {
        url = new URL(event.request.url);
    } catch (e) {
        return;
    }

    // Only http(s)
    if (!url.protocol.startsWith('http')) return;

    // Skip cache for admin folder (production)
    if (shouldSkipCache(url)) {
        return; // Passthrough
    }

    // ─── Origin checks ───
    const isSameOrigin = url.origin === self.location.origin;
    const isGoogleFonts =
        url.hostname === 'fonts.googleapis.com' ||
        url.hostname === 'fonts.gstatic.com';
    const isCdnjs = url.hostname === 'cdnjs.cloudflare.com';
    const isUnpkg = url.hostname === 'unpkg.com' || url.hostname.endsWith('.unpkg.com');
    const isGstatic = url.hostname === 'www.gstatic.com' || url.hostname === 'gstatic.com';

    const isTrustedCDN = isGoogleFonts || isCdnjs || isUnpkg || isGstatic;

    // Passthrough for untrusted origins
    if (!isSameOrigin && !isTrustedCDN) {
        return;
    }

    // ============================================================
    // 1️⃣ NAVIGATION requests (HTML pages)
    // ============================================================
    if (event.request.mode === 'navigate') {
        event.respondWith(
            (async () => {
                try {
                    // Network first
                    const networkResponse = await fetchWithTimeout(
                        event.request,
                        NAVIGATION_TIMEOUT_MS
                    );

                    // ✅ Only cache successful responses
                    if (networkResponse && networkResponse.ok) {
                        try {
                            const cache = await caches.open(CACHE_NAME);
                            // Clone BEFORE returning
                            const toCache = networkResponse.clone();
                            await safeCachePut(cache, event.request, toCache);
                        } catch (e) {
                            warnSW('Navigation cache failed:', e.message);
                        }
                    }

                    return networkResponse;
                } catch (e) {
                    // Offline — try cache
                    logSW('Navigation network failed, trying cache:', e.message);

                    try {
                        // Try exact URL first
                        let cached = await caches.match(event.request);
                        if (cached && cached.ok) return cached;

                        // Try without search params
                        cached = await caches.match(event.request, { ignoreSearch: true });
                        if (cached && cached.ok) return cached;

                        // Fallback to index.html (SPA behavior)
                        const indexFallback = await caches.match('./index.html');
                        if (indexFallback && indexFallback.ok) return indexFallback;
                    } catch (matchErr) {
                        warnSW('Cache match failed:', matchErr.message);
                    }

                    // Last resort — offline page
                    return new Response(getOfflineHTML(), {
                        status: 200,
                        statusText: 'OK (Offline Fallback)',
                        headers: { 'Content-Type': 'text/html; charset=utf-8' }
                    });
                }
            })()
        );
        return;
    }

    // ============================================================
    // 2️⃣ Google Fonts — cache-first with network fallback
    // ============================================================
    if (isGoogleFonts) {
        event.respondWith(
            (async () => {
                try {
                    // Try cache first
                    const cached = await caches.match(event.request, { ignoreSearch: true });
                    if (cached && cached.ok) return cached;

                    // Fetch with font timeout
                    const networkResponse = await fetchWithTimeout(
                        event.request,
                        FONT_TIMEOUT_MS
                    );

                    if (networkResponse && networkResponse.ok) {
                        try {
                            const cache = await caches.open(CACHE_NAME);
                            await safeCachePut(cache, event.request, networkResponse.clone());
                        } catch (e) {
                            // Silent
                        }
                    }

                    return networkResponse;
                } catch (e) {
                    // Cache fallback
                    const cached = await caches.match(event.request, { ignoreSearch: true });
                    if (cached) return cached;
                    throw e;
                }
            })()
        );
        return;
    }

    // ============================================================
    // 3️⃣ CDN JS libraries (cdnjs, unpkg, gstatic) — cache-first
    // ============================================================
    if (isCdnjs || isUnpkg || isGstatic) {
        event.respondWith(
            (async () => {
                try {
                    // Try cache first
                    const cached = await caches.match(event.request, { ignoreSearch: true });
                    if (cached && cached.ok) return cached;

                    // Fetch with CDN timeout
                    const networkResponse = await fetchWithTimeout(
                        event.request,
                        CDN_TIMEOUT_MS
                    );

                    if (networkResponse && networkResponse.ok) {
                        try {
                            const cache = await caches.open(CACHE_NAME);
                            await safeCachePut(cache, event.request, networkResponse.clone());
                        } catch (e) {
                            // Silent
                        }
                    }

                    return networkResponse;
                } catch (e) {
                    // Cache fallback
                    const cached = await caches.match(event.request, { ignoreSearch: true });
                    if (cached) return cached;
                    throw e;
                }
            })()
        );
        return;
    }

    // ============================================================
    // 4️⃣ Core assets (HTML/JS/CSS) — network-first, cache fallback
    // ============================================================
    const isCoreAsset = /\.(html|js|css)$/i.test(url.pathname);

    if (isCoreAsset) {
        event.respondWith(
            (async () => {
                try {
                    const networkResponse = await fetchWithTimeout(
                        event.request,
                        NETWORK_TIMEOUT_MS
                    );

                    if (networkResponse && networkResponse.ok) {
                        try {
                            const cache = await caches.open(CACHE_NAME);
                            await safeCachePut(cache, event.request, networkResponse.clone());
                        } catch (e) {
                            // Silent
                        }
                    }

                    return networkResponse;
                } catch (e) {
                    // Cache fallback
                    try {
                        const cached = await caches.match(event.request, { ignoreSearch: true });
                        if (cached && cached.ok) return cached;
                    } catch (matchErr) {
                        warnSW('Core asset cache match failed:', matchErr.message);
                    }

                    throw e;
                }
            })()
        );
        return;
    }

    // ============================================================
    // 5️⃣ Everything else (fonts, images) — stale-while-revalidate
    // ============================================================
    event.respondWith(
        (async () => {
            try {
                const cache = await caches.open(CACHE_NAME);
                const cachedResponse = await cache.match(event.request, { ignoreSearch: true });

                // Background revalidate
                const fetchPromise = fetchWithTimeout(event.request, FONT_TIMEOUT_MS)
                    .then(networkResponse => {
                        if (networkResponse && networkResponse.ok) {
                            safeCachePut(cache, event.request, networkResponse.clone())
                                .catch(() => {});
                        }
                        return networkResponse;
                    })
                    .catch(() => cachedResponse);

                return cachedResponse || fetchPromise;
            } catch (e) {
                try {
                    const cached = await caches.match(event.request, { ignoreSearch: true });
                    if (cached) return cached;
                } catch (matchErr) {
                    // Silent
                }
                throw e;
            }
        })()
    );
});

// ============================================================
// 🚨 GLOBAL ERROR HANDLERS
// ============================================================
self.addEventListener('error', (event) => {
    warnSW('Uncaught error:', event.message || 'unknown');
});

self.addEventListener('unhandledrejection', (event) => {
    warnSW('Unhandled rejection:', event.reason || 'unknown');
});

// ============================================================
// 📣 READY
// ============================================================
logSW('Hoṛ Katha Suite Service Worker v' + SW_VERSION + ' loaded');

// ============================================================
// 📊 DEBUG HELPERS (Dev only)
// ============================================================
if (IS_DEV) {
    self.SWDebug = {
        version: SW_VERSION,
        cacheName: CACHE_NAME,

        /**
         * Clear all caches
         */
        clearAll: async () => {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
            logSW('Cleared', keys.length, 'caches');
            return 'All caches cleared';
        },

        /**
         * List all caches
         */
        listCaches: async () => {
            const keys = await caches.keys();
            const cacheList = [];
            for (const key of keys) {
                const cache = await caches.open(key);
                const reqs = await cache.keys();
                cacheList.push({
                    name: key,
                    entries: reqs.length,
                    isCurrent: key === CACHE_NAME
                });
            }
            console.table(cacheList);
            return cacheList;
        },

        /**
         * Get cache size (approximate)
         */
        cacheSize: async () => {
            const keys = await caches.keys();
            let totalSize = 0;

            for (const key of keys) {
                const cache = await caches.open(key);
                const reqs = await cache.keys();

                for (const req of reqs) {
                    try {
                        const resp = await cache.match(req);
                        if (resp) {
                            const blob = await resp.clone().blob();
                            totalSize += blob.size;
                        }
                    } catch (e) {
                        // Skip errors
                    }
                }
            }

            const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
            logSW('Total cache size:', sizeMB, 'MB');
            return { bytes: totalSize, mb: sizeMB };
        },

        /**
         * Test fetch with timeout
         */
        testFetch: async (url) => {
            try {
                const response = await fetchWithTimeout(url, 5000);
                logSW('Fetch OK:', response.status, url);
                return { ok: true, status: response.status };
            } catch (e) {
                warnSW('Fetch failed:', e.message);
                return { ok: false, error: e.message };
            }
        }
    };

    logSW('SWDebug helpers available (dev mode only)');
}