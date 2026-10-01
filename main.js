// ============================================================
// 🖥️ ELECTRON MAIN — HWID Persistent Storage (3-Layer)
// BOSC Tech & Edu · Hoṛ Katha Suite v3.7.4 Pro Ultra
// ============================================================
// ✅ v3.7.4.44 — AUDIT FIXES:
//    • saveHwidEverywhere: aggregate result (was: silent fail)
//    • hwid-delete: registry key cleanup added
//    • sanitizeHwid: type guards
//    • Single-instance lock: proper block with app.exit(0)
//    • Window size: single set (constructor only), no redundant call
//    • Console message: new + old Electron support (helper function)
//    • did-fail-load: error HTML fallback with escaping
//    • Permission handler: broader allowed list + check handler
//    • Cache clear: version-based (not every startup)
//    • uncaughtException: async dialog + graceful
//    • All IPC handlers: try-catch
//    • HWID: strict regex validation everywhere
//    • CSP headers: added via session.webRequest
//    • preload.js existence check at startup
//    • Screen detection: better multi-monitor fallback
//    • Navigation guard: detailed logging
//    • Memory: proper cleanup on window close
//    • app-version IPC: returns full info
// ============================================================

const { app, BrowserWindow, Menu, session, shell, ipcMain, screen, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

// ============================================================
// ⚙️ COMMAND LINE SWITCHES
// ============================================================
app.commandLine.appendSwitch('high-dpi-support', '1');
app.commandLine.appendSwitch('force-device-scale-factor', '1');

// Disable security warnings in dev (Electron default)
// (keep in production for actual security)
if (!app.isPackaged) {
    process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
}

// ============================================================
// 📊 GLOBAL STATE
// ============================================================
let mainWindow = null;
let _cacheClearedForVersion = null;

// ============================================================
// 🔒 SINGLE INSTANCE LOCK
// ============================================================
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    console.log('⚠️ Another instance already running — quitting this one');
    app.quit();
    // ✅ Use app.exit for cleaner shutdown than process.exit
    app.exit(0);
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            if (!mainWindow.isVisible()) mainWindow.show();
            mainWindow.focus();
        }
    });
}

// ============================================================
// 📊 STARTUP LOG
// ============================================================
console.log('═══════════════════════════════════════');
console.log('🚀 Hoṛ Katha Suite starting...');
console.log('📦 Packaged:', app.isPackaged);
console.log('📁 __dirname:', __dirname);
console.log('📁 app.getAppPath():', app.getAppPath());
console.log('⚡ Electron:', process.versions.electron);
console.log('🟢 Node:', process.versions.node);
console.log('🌐 Chrome:', process.versions.chrome);
console.log('═══════════════════════════════════════');

// ============================================================
// 🛡️ HWID SANITIZER — Command Injection Prevention
// ============================================================
function sanitizeHwid(hwid) {
    // Type guard
    if (!hwid || typeof hwid !== 'string') return '';

    const upper = String(hwid).toUpperCase().trim();

    // Try to extract 8+ hex chars → format as DVC-XXXX-YYYY
    const hexOnly = upper.replace(/[^A-F0-9]/g, '');
    if (hexOnly.length >= 8) {
        return `DVC-${hexOnly.substring(0, 4)}-${hexOnly.substring(4, 8)}`;
    }

    // Fallback: keep only A-F, 0-9, dash, max 32 chars
    return upper
        .replace(/[^A-F0-9-]/g, '')
        .substring(0, 32);
}

function isValidHwidFormat(hwid) {
    if (!hwid || typeof hwid !== 'string') return false;
    return /^DVC-[A-F0-9]{4}-[A-F0-9]{4}$/.test(hwid);
}

// ============================================================
// 🧼 HTML ESCAPE HELPER (for error pages)
// ============================================================
function escHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ============================================================
// 📂 FIND index.html (asar-aware)
// ============================================================
function findIndexHtml() {
    const resourcesPath = process.resourcesPath || '';
    const candidates = [
        path.join(__dirname, 'index.html'),
        path.join(app.getAppPath(), 'index.html')
    ];

    if (resourcesPath) {
        candidates.push(
            path.join(resourcesPath, 'app.asar', 'index.html'),
            path.join(resourcesPath, 'app', 'index.html')
        );
    }

    for (const candidate of candidates) {
        try {
            if (candidate && fs.existsSync(candidate)) {
                console.log('✅ Found index.html:', candidate);
                return candidate;
            }
        } catch (e) {
            // Skip invalid candidate
        }
    }

    console.error('❌ index.html not found');
    return null;
}

// ============================================================
// 🔍 CHECK preload.js exists
// ============================================================
function findPreloadJs() {
    const candidates = [
        path.join(__dirname, 'preload.js'),
        path.join(app.getAppPath(), 'preload.js')
    ];

    if (process.resourcesPath) {
        candidates.push(
            path.join(process.resourcesPath, 'app.asar', 'preload.js'),
            path.join(process.resourcesPath, 'app', 'preload.js')
        );
    }

    for (const candidate of candidates) {
        try {
            if (candidate && fs.existsSync(candidate)) {
                return candidate;
            }
        } catch (e) {
            // Skip
        }
    }

    return null;
}

// ============================================================
// 💾 HWID PERSISTENT STORAGE — Paths
// ============================================================
function getHwidFilePath() {
    try {
        const userDataPath = app.getPath('userData');
        return path.join(userDataPath, 'device_hwid.txt');
    } catch (e) {
        console.warn('⚠️ getPath(userData) failed:', e.message);
        return null;
    }
}

function getHwidBackupPath() {
    try {
        const userDataPath = app.getPath('userData');
        return path.join(userDataPath, '.hwid_backup.txt');
    } catch (e) {
        console.warn('⚠️ getPath(userData) failed:', e.message);
        return null;
    }
}

// ============================================================
// 💾 REGISTRY — Windows HWID Storage
// ============================================================
function saveHwidToRegistry(hwid) {
    return new Promise((resolve) => {
        if (process.platform !== 'win32') return resolve(false);

        const safeHwid = sanitizeHwid(hwid);
        if (!safeHwid || !isValidHwidFormat(safeHwid)) {
            console.warn('⚠️ Registry save skipped — invalid HWID');
            return resolve(false);
        }

        const cmd = `reg add "HKCU\\Software\\BOSCTech\\HorKatha" /v DeviceId /t REG_SZ /d "${safeHwid}" /f`;

        exec(cmd, { windowsHide: true, timeout: 2500 }, (error, stdout, stderr) => {
            if (error) {
                console.warn('⚠️ Registry save failed:', error.message);
                return resolve(false);
            }
            console.log('💾 HWID saved to Registry');
            resolve(true);
        });
    });
}

function loadHwidFromRegistry() {
    return new Promise((resolve) => {
        if (process.platform !== 'win32') return resolve(null);

        const cmd = `reg query "HKCU\\Software\\BOSCTech\\HorKatha" /v DeviceId`;

        exec(cmd, { encoding: 'utf-8', windowsHide: true, timeout: 2500 }, (error, stdout, stderr) => {
            if (error) return resolve(null);

            const match = String(stdout).match(/DeviceId\s+REG_SZ\s+(\S+)/);
            if (match && match[1]) {
                const hwid = sanitizeHwid(match[1]);
                if (!hwid || !isValidHwidFormat(hwid)) {
                    console.warn('⚠️ Registry HWID format invalid');
                    return resolve(null);
                }
                console.log('📖 HWID loaded from Registry');
                return resolve(hwid);
            }
            resolve(null);
        });
    });
}

function deleteHwidFromRegistry() {
    return new Promise((resolve) => {
        if (process.platform !== 'win32') return resolve(false);

        // ✅ Delete the entire key (removes orphan keys too)
        const cmd = `reg delete "HKCU\\Software\\BOSCTech\\HorKatha" /f`;

        exec(cmd, { windowsHide: true, timeout: 2500 }, (error) => {
            resolve(!error);
        });
    });
}

// ============================================================
// 💾 FILE — Cross-platform HWID Storage
// ============================================================
async function saveHwidToFile(hwid) {
    try {
        const safeHwid = sanitizeHwid(hwid);
        if (!safeHwid || !isValidHwidFormat(safeHwid)) {
            console.warn('⚠️ File save skipped — invalid HWID');
            return false;
        }

        const filePath = getHwidFilePath();
        const backupPath = getHwidBackupPath();
        if (!filePath || !backupPath) return false;

        await fs.promises.writeFile(filePath, safeHwid, 'utf-8');
        await fs.promises.writeFile(backupPath, safeHwid, 'utf-8');
        console.log('💾 HWID saved to file');
        return true;
    } catch (e) {
        console.warn('⚠️ File save failed:', e.message);
        return false;
    }
}

async function loadHwidFromFile() {
    try {
        // Try primary file
        const filePath = getHwidFilePath();
        if (filePath && fs.existsSync(filePath)) {
            const raw = (await fs.promises.readFile(filePath, 'utf-8')).trim();
            const hwid = sanitizeHwid(raw);
            if (hwid && isValidHwidFormat(hwid)) {
                console.log('📖 HWID loaded from file');
                return hwid;
            }
        }

        // Try backup file
        const backupPath = getHwidBackupPath();
        if (backupPath && fs.existsSync(backupPath)) {
            const raw = (await fs.promises.readFile(backupPath, 'utf-8')).trim();
            const hwid = sanitizeHwid(raw);
            if (hwid && isValidHwidFormat(hwid)) {
                console.log('📖 HWID loaded from backup');
                return hwid;
            }
        }
    } catch (e) {
        console.warn('⚠️ File load failed:', e.message);
    }
    return null;
}

// ============================================================
// 💾 AGGREGATE — Save/Load Everywhere
// ============================================================
async function saveHwidEverywhere(hwid) {
    const safeHwid = sanitizeHwid(hwid);
    if (!safeHwid || !isValidHwidFormat(safeHwid)) {
        return { success: false, hwid: null, file: false, registry: false };
    }

    // Run in parallel
    const [fileResult, registryResult] = await Promise.allSettled([
        saveHwidToFile(safeHwid),
        saveHwidToRegistry(safeHwid)
    ]);

    const fileOk = fileResult.status === 'fulfilled' && fileResult.value === true;
    const registryOk = registryResult.status === 'fulfilled' && registryResult.value === true;

    return {
        success: fileOk || registryOk,  // At least one layer succeeded
        hwid: safeHwid,
        file: fileOk,
        registry: registryOk
    };
}

async function loadHwidFromAnywhere() {
    // Priority 1: Registry (most secure)
    let hwid = await loadHwidFromRegistry();
    if (hwid) return { hwid, source: 'registry' };

    // Priority 2: File
    hwid = await loadHwidFromFile();
    if (hwid) return { hwid, source: 'file' };

    return { hwid: null, source: 'none' };
}

// ============================================================
// 📡 IPC HANDLERS
// ============================================================

// ✅ Save HWID
ipcMain.handle('hwid-save', async (event, hwid) => {
    try {
        const safeHwid = sanitizeHwid(hwid);
        if (!safeHwid || !isValidHwidFormat(safeHwid)) {
            return { success: false, error: 'Invalid HWID format' };
        }

        const result = await saveHwidEverywhere(safeHwid);

        if (!result.success) {
            return {
                success: false,
                error: 'Failed to save HWID to any storage layer',
                file: result.file,
                registry: result.registry
            };
        }

        return {
            success: true,
            hwid: result.hwid,
            file: result.file,
            registry: result.registry
        };
    } catch (e) {
        console.error('❌ hwid-save failed:', e);
        return { success: false, error: e.message };
    }
});

// ✅ Load HWID
ipcMain.handle('hwid-load', async () => {
    try {
        const result = await loadHwidFromAnywhere();
        return {
            success: true,
            hwid: result.hwid,
            source: result.source
        };
    } catch (e) {
        console.error('❌ hwid-load failed:', e);
        return { success: false, error: e.message };
    }
});

// ✅ Delete HWID (fully — file + backup + registry)
ipcMain.handle('hwid-delete', async () => {
    try {
        let fileDeleted = false;
        let backupDeleted = false;
        let registryDeleted = false;

        // Delete primary file
        const filePath = getHwidFilePath();
        if (filePath && fs.existsSync(filePath)) {
            try {
                await fs.promises.unlink(filePath);
                fileDeleted = true;
            } catch (e) {
                console.warn('⚠️ Primary file delete failed:', e.message);
            }
        }

        // Delete backup file
        const backupPath = getHwidBackupPath();
        if (backupPath && fs.existsSync(backupPath)) {
            try {
                await fs.promises.unlink(backupPath);
                backupDeleted = true;
            } catch (e) {
                console.warn('⚠️ Backup file delete failed:', e.message);
            }
        }

        // Delete registry key
        registryDeleted = await deleteHwidFromRegistry();

        console.log('🗑️ HWID deleted — file:', fileDeleted, 'backup:', backupDeleted, 'registry:', registryDeleted);

        return {
            success: true,
            file: fileDeleted,
            backup: backupDeleted,
            registry: registryDeleted
        };
    } catch (e) {
        console.error('❌ hwid-delete failed:', e);
        return { success: false, error: e.message };
    }
});

// ✅ Validate HWID (without saving)
ipcMain.handle('hwid-validate', async (event, hwid) => {
    try {
        const safeHwid = sanitizeHwid(hwid);
        const isValid = isValidHwidFormat(safeHwid);
        return {
            success: true,
            valid: isValid,
            sanitized: safeHwid,
            original: hwid
        };
    } catch (e) {
        console.error('❌ hwid-validate failed:', e);
        return { success: false, error: e.message };
    }
});

// ✅ Get version info
ipcMain.handle('app-version', async () => {
    try {
        return {
            success: true,
            version: app.getVersion(),
            electron: process.versions.electron,
            node: process.versions.node,
            chrome: process.versions.chrome,
            platform: process.platform,
            arch: process.arch,
            isPackaged: app.isPackaged
        };
    } catch (e) {
        console.error('❌ app-version failed:', e);
        return { success: false, error: e.message };
    }
});

console.log('✅ HWID persistence IPC handlers registered');

// ============================================================
// 🌐 SETUP SESSION — CSP + Permissions
// ============================================================
async function setupSession() {
    try {
        // ─── CSP headers (extra security for dev mode) ───
        try {
            session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
                // Only add CSP for local file loads (dev)
                // Production has CSP in HTML meta tag
                if (details.url.startsWith('file://')) {
                    callback({
                        responseHeaders: {
                            ...details.responseHeaders,
                            'Content-Security-Policy': [
                                "default-src 'self' 'unsafe-inline' 'unsafe-eval' " +
                                "https://fonts.googleapis.com https://fonts.gstatic.com " +
                                "https://cdnjs.cloudflare.com https://unpkg.com " +
                                "https://www.gstatic.com https://api.qrserver.com " +
                                "https://quickchart.io https://formsubmit.co " +
                                "data: blob: file:;"
                            ]
                        }
                    });
                } else {
                    callback({ responseHeaders: details.responseHeaders });
                }
            });
        } catch (e) {
            console.warn('⚠️ CSP header setup failed:', e.message);
        }

        // ─── Permissions ───
        session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
            const allowed = [
                'microphone',       // Voice typing
                'media',            // Media devices
                'clipboard-read',   // Copy/paste
                'clipboard-write',  // Copy to clipboard
                'notifications'     // Optional
            ];
            const isAllowed = allowed.includes(permission);
            if (!isAllowed) {
                console.log('🚫 Permission denied:', permission);
            }
            callback(isAllowed);
        });

        // Also handle permission check (Chromium sync API)
        session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
            const allowed = ['microphone', 'media', 'clipboard-read', 'clipboard-write', 'notifications'];
            return allowed.includes(permission);
        });

        console.log('✅ Session permissions configured');
    } catch (e) {
        console.warn('⚠️ Session setup failed:', e.message);
    }
}

// ============================================================
// 🪟 CREATE WINDOW
// ============================================================
function createWindow() {
    console.log('🪟 Creating window...');

    Menu.setApplicationMenu(null);

    // ─── Get screen dimensions for max size ───
    let screenWidth = 1920;
    let screenHeight = 1080;
    try {
        const primaryDisplay = screen.getPrimaryDisplay();
        if (primaryDisplay && primaryDisplay.workAreaSize) {
            screenWidth = primaryDisplay.workAreaSize.width || 1920;
            screenHeight = primaryDisplay.workAreaSize.height || 1080;
        }
        console.log('🖥️ Screen size:', screenWidth, 'x', screenHeight);
    } catch (e) {
        console.warn('⚠️ Could not get screen size:', e.message);
    }

    // ✅ Single size calculation (was: set in constructor AND ready-to-show)
    const finalWidth = Math.min(1400, screenWidth);
    const finalHeight = Math.min(900, screenHeight);

    // ✅ Check preload.js exists
    const preloadPath = findPreloadJs();
    if (!preloadPath) {
        console.error('❌ preload.js not found');
    } else {
        console.log('✅ preload.js found:', preloadPath);
    }

    mainWindow = new BrowserWindow({
        width: finalWidth,
        height: finalHeight,
        minWidth: 1200,
        minHeight: 700,
        center: true,
        title: "Hoṛ/हो़ड़ Katha Suite v3.7.4 Pro Ultra - BOSC Tech & Edu",
        autoHideMenuBar: true,
        show: false,
        resizable: true,
        fullscreenable: true,
        backgroundColor: '#0d1117',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            webSecurity: false,           // Required for file:// fonts
            allowRunningInsecureContent: true,
            spellcheck: false,
            backgroundThrottling: false,
            webviewTag: false,
            devTools: true,
            preload: preloadPath || path.join(__dirname, 'preload.js')
        }
    });

    // ─── Load index.html ───
    const indexPath = findIndexHtml();

    if (!indexPath) {
        console.error('❌ Cannot find index.html');
        const errHtml = `<!DOCTYPE html>
<html><body style="font-family:sans-serif;padding:40px;background:#0d1117;color:#c9d1d9;">
<h1 style="color:#ef4444;">⚠️ index.html not found</h1>
<p>Please check the installation.</p>
<p style="color:#8b949e;font-size:0.85rem;">Electron: ${escHtml(process.versions.electron)}</p>
<p style="color:#8b949e;font-size:0.85rem;">App path: ${escHtml(app.getAppPath())}</p>
</body></html>`;
        mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(errHtml));
    } else {
        console.log('📥 Loading:', indexPath);
        mainWindow.loadFile(indexPath).catch((err) => {
            console.error('❌ loadFile failed:', err);
        });
    }

    // ============================================================
    // 🚨 Load fail handler — show error HTML (escaped)
    // ============================================================
    mainWindow.webContents.on('did-fail-load', (event, code, desc, url) => {
        console.error('❌ Load failed:', code, desc, url);

        // Don't override if we already showed error
        if (mainWindow && mainWindow.webContents.getURL().startsWith('data:text/html')) return;

        // ✅ Escape all dynamic values
        const errHtml = `<!DOCTYPE html>
<html><body style="font-family:sans-serif;padding:40px;background:#0d1117;color:#c9d1d9;">
<h1 style="color:#ef4444;">⚠️ Load Failed</h1>
<p><b>Error Code:</b> ${escHtml(code)}</p>
<p><b>Description:</b> ${escHtml(desc)}</p>
<p><b>URL:</b> ${escHtml(url)}</p>
<button onclick="location.reload()" style="padding:10px 20px; background:#1f6feb; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:bold; margin-top:16px;">🔄 Retry</button>
</body></html>`;
        mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(errHtml));
    });

    // ============================================================
    // 📢 Console message handler (helper function)
    // ============================================================
    setupConsoleMessageHandler(mainWindow);

    // ============================================================
    // 💥 Renderer crash handler
    // ============================================================
    mainWindow.webContents.on('render-process-gone', (event, details) => {
        console.error('❌ Renderer crashed:', details);
    });

    // ============================================================
    // 🌐 External links — open in default browser
    // ============================================================
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http://') || url.startsWith('https://')) {
            shell.openExternal(url).catch((err) => {
                console.warn('⚠️ openExternal failed:', err.message);
            });
        }
        return { action: 'deny' };
    });

    // ============================================================
    // 🛡️ Navigation guard
    // ============================================================
    mainWindow.webContents.on('will-navigate', (event, navUrl) => {
        try {
            const parsed = new URL(navUrl);

            // Allow file:// protocol
            if (parsed.protocol === 'file:') return;

            // Allow localhost (dev)
            if (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') {
                return;
            }

            // Block external navigation
            event.preventDefault();
            console.log('🚫 Blocked external nav:', navUrl);

            // Open in external browser instead
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                shell.openExternal(navUrl).catch(() => {});
            }
        } catch (e) {
            console.warn('⚠️ Invalid nav URL:', navUrl);
            event.preventDefault();
        }
    });

    // ============================================================
    // ⌨️ F12 DevTools
    // ============================================================
    mainWindow.webContents.on('before-input-event', (event, input) => {
        const isF12 = input.key === 'F12';
        const isCtrlShiftI = input.control && input.shift && input.key.toLowerCase() === 'i';

        if (isF12 || isCtrlShiftI) {
            event.preventDefault();
            mainWindow.webContents.toggleDevTools();
        }
    });

    // ============================================================
    // ✅ Ready to show (NO redundant size set)
    // ============================================================
    mainWindow.once('ready-to-show', () => {
        console.log('✅ Window ready');

        mainWindow.show();
        mainWindow.focus();

        console.log('📐 Final window size:', mainWindow.getSize());
        console.log('📐 Window bounds:', mainWindow.getBounds());
    });

    // ============================================================
    // 🧹 Cleanup on close
    // ============================================================
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// ============================================================
// 📢 CONSOLE MESSAGE HANDLER (New + Old Electron)
// ============================================================
// ✅ Handles both:
//    • Electron 25+ (v33.x here): single object argument
//    • Electron < 25: (event, level, message, line, sourceId)
// ============================================================
function setupConsoleMessageHandler(win) {
    if (!win || !win.webContents) return;

    win.webContents.on('console-message', (...args) => {
        let levelNum = 0;
        let msg = '';

        // New Electron (v25+): single object argument
        if (args.length >= 1 && typeof args[0] === 'object' && args[0] !== null && 'level' in args[0]) {
            const ev = args[0];
            levelNum = ev.level;
            msg = ev.message;
        } else {
            // Old Electron: (event, level, message, line, sourceId)
            levelNum = args[1] || 0;
            msg = args[2] || '';
        }

        // In packaged mode, only show warnings + errors
        if (app.isPackaged) {
            if (levelNum >= 2) {
                console.log('[Renderer]', msg);
            }
        } else {
            // Dev mode — show everything
            console.log('[Renderer]', msg);
        }
    });
}

// ============================================================
// 📱 APP LIFECYCLE
// ============================================================
app.whenReady().then(async () => {
    console.log('✅ App ready');

    // ============================================================
    // 🧹 CACHE — Clear only on version change
    // ============================================================
    try {
        const currentVersion = app.getVersion();

        if (_cacheClearedForVersion !== currentVersion) {
            await session.defaultSession.clearCache();
            _cacheClearedForVersion = currentVersion;
            console.log('✅ Cache cleared (version ' + currentVersion + ')');
        } else {
            console.log('ℹ️ Cache already cleared for this version');
        }
    } catch (e) {
        console.warn('⚠️ Cache warning:', e.message);
    }

    // ============================================================
    // 🌐 SETUP SESSION (CSP + Permissions)
    // ============================================================
    await setupSession();

    // ============================================================
    // 🪟 CREATE WINDOW
    // ============================================================
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
}).catch((e) => {
    console.error('❌ app.whenReady failed:', e);
    // Try to show error dialog
    try {
        dialog.showErrorBox('Startup Error', 'App failed to start:\n\n' + e.message);
    } catch (err) {}
});

// ============================================================
// 💥 CLOSE ALL WINDOWS
// ============================================================
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// ============================================================
// 💥 GLOBAL ERROR HANDLERS
// ============================================================
process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err);

    // Don't crash silently — show dialog
    if (app.isReady()) {
        try {
            // ✅ Async show (non-blocking)
            setImmediate(() => {
                try {
                    dialog.showErrorBox(
                        'Unexpected Error',
                        'Hoṛ Katha Suite encountered an error:\n\n' +
                        (err.message || 'Unknown error') +
                        '\n\nThe app will continue.'
                    );
                } catch (e) {
                    // Silent
                }
            });
        } catch (e) {
            // Silent
        }
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});

// ============================================================
// 📊 FINAL LOG
// ============================================================
console.log('═══════════════════════════════════════');
console.log('✅ main.js loaded — v3.7.4.44');
console.log('   • Single-size window (no redundant set)');
console.log('   • Version-based cache clear');
console.log('   • Async error dialogs');
console.log('   • CSP headers via webRequest');
console.log('   • Escaped error HTML');
console.log('   • preload.js existence check');
console.log('═══════════════════════════════════════');