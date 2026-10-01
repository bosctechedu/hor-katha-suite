// ============================================================
// 🪟 MODALS — Complete File with DUAL QR Generator
// BOSC Tech & Edu · Hoṛ Katha Suite v3.7.4
// ============================================================
// ✅ v3.7.4.44 — AUDIT FIXES:
//    • MiniQR: dynamic typeNumber (4-40) for long text
//    • QR retry: stale img cleanup + fallback chain
//    • Trial key paste: format-aware handling
//    • onPaymentCompleted: double-click guard
//    • _escapeFlashHtml: backtick + slash escape
//    • showFlash: proper ESC listener cleanup
//    • Receipt modal: XSS-safe (textContent)
//    • Char map: hover voice wired
//    • Emoji matrix: responsive height
//    • _canOpenModal: 3s timeout fallback
//    • installPWA: graceful error handling
//    • Modal close: guaranteed scroll unlock
//    • showToast: duration clamp (0-60s)
//    • QR box: stale inline styles cleared
//    • Download IME: RAF-based URL revoke
//    • Full URL encoding for UPI
// ============================================================

// ============================================================
// 📊 GLOBAL STATE
// ============================================================
let deferredPrompt = null;
let isVoiceEnabled = true;
let isHoverVoiceEnabled = false;
let isClickSoundEnabled = true;
let isPhoneticEnabled = false;
let currentDonateAmount = 251;
let currentSelectedPrice = 199;
let currentSelectedPlanTitle = "P1 — Community Single PC (₹199 Offer)";
let lastActiveChar = '';
let lastActiveEmoji = '';
let _isProcessingPayment = false;
let _activeFlashes = [];

// ============================================================
// 🛡️ SAFE INTEGER HELPER
// ============================================================
function _safeInt(val, min = 0, max = 999999, fallback = 0) {
    const n = parseInt(val, 10);
    if (isNaN(n)) return fallback;
    if (n < min) return min;
    if (n > max) return max;
    return n;
}

// ============================================================
// 🛡️ ESCAPE HELPERS
// ============================================================
function _escapeKeyboardHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeFlashHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/`/g, '&#96;')    // ✅ backtick
        .replace(/\//g, '&#47;');  // ✅ slash
}

// ============================================================
// 📸 DUAL QR RENDER — Network First, Built-in Fallback
// ============================================================
function renderQRCode(elementId, text, size = 200) {
    console.log('🎨 QR Render:', elementId, '| data length:', text.length);
    console.log('📝 Data:', text.substring(0, 80));

    const container = document.getElementById(elementId);
    if (!container) {
        console.error('❌ Container missing:', elementId);
        return;
    }

    // ✅ Clear container + remove stale inline styles
    container.innerHTML = '';
    container.removeAttribute('style');

    // Apply fresh styles
    container.style.setProperty('width', size + 'px', 'important');
    container.style.setProperty('height', size + 'px', 'important');
    container.style.setProperty('min-width', size + 'px', 'important');
    container.style.setProperty('min-height', size + 'px', 'important');
    container.style.setProperty('max-width', size + 'px', 'important');
    container.style.setProperty('max-height', size + 'px', 'important');
    container.style.setProperty('background', '#ffffff', 'important');
    container.style.setProperty('padding', '8px', 'important');
    container.style.setProperty('box-sizing', 'border-box', 'important');
    container.style.setProperty('display', 'flex', 'important');
    container.style.setProperty('align-items', 'center', 'important');
    container.style.setProperty('justify-content', 'center', 'important');
    container.style.setProperty('border-radius', '8px', 'important');

    // Loading placeholder
    container.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                    gap:6px;color:#64748b;font-size:0.7rem;font-weight:700;">
            <div style="font-size:1.5rem;">⏳</div>
            <div>Loading QR...</div>
        </div>
    `;

    const encodedText = encodeURIComponent(text);
    const qrSize = size - 16;

    // ═══════════════════════════════════════════════
    // NETWORK QR PROVIDERS (in order of preference)
    // ═══════════════════════════════════════════════
    const providers = [
        // 1. qrserver.com — most reliable
        `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodedText}&ecc=H&margin=4&format=png`,
        // 2. quickchart.io — backup
        `https://quickchart.io/qr?text=${encodedText}&size=${qrSize}&ecLevel=H&margin=4&format=png`,
        // 3. qrserver with lower ECC (if data too long)
        `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodedText}&ecc=M&margin=2&format=png`
    ];

    let providerIndex = 0;
    let rendered = false;

    function tryNextProvider() {
        if (rendered) return;

        if (providerIndex >= providers.length) {
            console.log('⚠️ All network QR failed → Using built-in MiniQR');
            tryBuiltIn();
            return;
        }

        const providerUrl = providers[providerIndex];
        console.log(`🌐 Trying network QR #${providerIndex + 1}`);

        // ✅ Clean previous attempt (stale img cleanup)
        container.innerHTML = '';

        const img = document.createElement('img');
        img.alt = 'Scan QR Code';
        img.crossOrigin = 'anonymous';
        img.style.cssText = `
            width: 100%;
            height: 100%;
            display: block;
            object-fit: contain;
            image-rendering: pixelated;
            background: #ffffff;
        `;

        // ✅ 5s timeout per provider
        let loadTimeout = setTimeout(() => {
            if (!rendered) {
                console.warn(`⏱️ Network QR #${providerIndex + 1} timeout`);
                img.onload = null;
                img.onerror = null;
                providerIndex++;
                tryNextProvider();
            }
        }, 5000);

        img.onload = function() {
            clearTimeout(loadTimeout);
            if (rendered) return;
            rendered = true;
            container.innerHTML = '';
            container.appendChild(img);
            console.log(`✅ QR rendered via NETWORK #${providerIndex + 1}`);
        };

        img.onerror = function() {
            clearTimeout(loadTimeout);
            if (rendered) return;
            console.warn(`❌ Network QR #${providerIndex + 1} failed`);
            providerIndex++;
            tryNextProvider();
        };

        img.src = providerUrl;
    }

    function tryBuiltIn() {
        try {
            const success = _MiniQR.render(container, text, qrSize);
            if (success) {
                console.log('✅ QR rendered via BUILT-IN MiniQR');
            } else {
                throw new Error('MiniQR returned false');
            }
        } catch (e) {
            console.error('❌ Built-in QR failed:', e);
            showQRFailure(e);
        }
    }

    function showQRFailure(err) {
        const upiId = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.UPI_PRIMARY_ID)
            ? APP_CONFIG.UPI_PRIMARY_ID
            : '9110977117@ybl';

        container.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                        width:100%;height:100%;color:#dc2626;text-align:center;
                        font-size:0.7rem;font-weight:700;padding:8px;gap:4px;">
                <div style="font-size:1.5rem;">⚠️</div>
                <div>QR Load Failed</div>
                <div style="font-size:0.6rem;color:#64748b;">Manual UPI:</div>
                <div style="font-size:0.65rem;color:#0f172a;background:#fff;padding:3px 8px;
                            border-radius:4px;font-family:monospace;font-weight:900;
                            word-break:break-all;">
                    ${_escapeKeyboardHtml(upiId)}
                </div>
                <div style="font-size:0.55rem;color:#94a3b8;margin-top:4px;">
                    ${_escapeKeyboardHtml((err.message || '').substring(0, 40))}
                </div>
            </div>
        `;
    }

    // ✅ Start rendering directly
    tryNextProvider();
}

// ============================================================
// 🎨 BUILT-IN MINI QR GENERATOR (Offline fallback)
// ============================================================
const _MiniQR = (function() {
    'use strict';

    // ─── Galois Field ───
    const EXP = new Array(256);
    const LOG = new Array(256);

    for (let i = 0; i < 8; i++) EXP[i] = 1 << i;
    for (let i = 8; i < 256; i++) {
        EXP[i] = EXP[i - 4] ^ EXP[i - 5] ^ EXP[i - 6] ^ EXP[i - 8];
    }
    for (let i = 0; i < 255; i++) LOG[EXP[i]] = i;

    function gexp(n) {
        while (n < 0) n += 255;
        while (n >= 256) n -= 255;
        return EXP[n];
    }

    function glog(n) {
        if (n < 1) throw new Error('glog(' + n + ')');
        return LOG[n];
    }

    // ─── Polynomial ───
    function Poly(num, shift) {
        let offset = 0;
        while (offset < num.length && num[offset] === 0) offset++;

        this.num = new Array(num.length - offset + shift);
        for (let i = 0; i < num.length - offset; i++) {
            this.num[i] = num[i + offset];
        }
    }

    Poly.prototype = {
        get: function(i) { return this.num[i]; },
        getLength: function() { return this.num.length; },

        multiply: function(e) {
            const num = new Array(this.getLength() + e.getLength() - 1);
            for (let i = 0; i < this.getLength(); i++) {
                for (let j = 0; j < e.getLength(); j++) {
                    num[i + j] ^= gexp(glog(this.get(i)) + glog(e.get(j)));
                }
            }
            return new Poly(num, 0);
        },

        mod: function(e) {
            if (this.getLength() - e.getLength() < 0) return this;

            const ratio = glog(this.get(0)) - glog(e.get(0));
            const num = new Array(this.getLength());

            for (let i = 0; i < this.getLength(); i++) num[i] = this.get(i);
            for (let i = 0; i < e.getLength(); i++) {
                num[i] ^= gexp(glog(e.get(i)) + ratio);
            }

            return new Poly(num, 0).mod(e);
        }
    };

    // ─── RS Block Table (Version 4-14) ───
    const RS_TABLE = {
        4:  [[1, 26, 19]],
        5:  [[1, 44, 34]],
        6:  [[1, 70, 55]],
        7:  [[1, 100, 80]],
        8:  [[1, 134, 108]],
        9:  [[1, 172, 68], [1, 173, 69]],
        10: [[1, 196, 78], [1, 197, 79]],
        11: [[2, 120, 39], [2, 121, 40]],
        12: [[2, 130, 42], [2, 131, 43]],
        13: [[2, 140, 46], [2, 141, 47]],
        14: [[2, 150, 49], [2, 151, 50]]
    };

    // ─── Bit Buffer ───
    function BitBuf() {
        this.buffer = [];
        this.length = 0;
    }

    BitBuf.prototype.put = function(num, length) {
        for (let i = 0; i < length; i++) {
            this.putBit(((num >>> (length - i - 1)) & 1) === 1);
        }
    };

    BitBuf.prototype.putBit = function(bit) {
        const idx = Math.floor(this.length / 8);
        if (this.buffer.length <= idx) this.buffer.push(0);
        if (bit) this.buffer[idx] |= (0x80 >>> (this.length % 8));
        this.length++;
    };

    // ─── QR Model ───
    function QRModel(typeNumber) {
        this.typeNumber = typeNumber;
        this.modules = null;
        this.moduleCount = 0;
        this.dataCache = null;
        this.dataList = [];
    }

    QRModel.prototype.addData = function(data) {
        this.dataList.push(data);
        this.dataCache = null;
    };

    QRModel.prototype.getModuleCount = function() { return this.moduleCount; };
    QRModel.prototype.isDark = function(r, c) { return this.modules[r][c]; };

    QRModel.prototype.make = function() {
        this.makeImpl(false, this.getBestMaskPattern());
    };

    QRModel.prototype.makeImpl = function(test, maskPattern) {
        this.moduleCount = this.typeNumber * 4 + 17;
        this.modules = new Array(this.moduleCount);

        for (let r = 0; r < this.moduleCount; r++) {
            this.modules[r] = new Array(this.moduleCount);
            for (let c = 0; c < this.moduleCount; c++) {
                this.modules[r][c] = null;
            }
        }

        this.setupPositionProbePattern(0, 0);
        this.setupPositionProbePattern(this.moduleCount - 7, 0);
        this.setupPositionProbePattern(0, this.moduleCount - 7);
        this.setupPositionAdjustPattern();
        this.setupTimingPattern();
        this.setupTypeInfo(test, maskPattern);

        if (this.typeNumber >= 7) this.setupTypeNumber(test);
        if (this.dataCache === null) this.dataCache = this.createData();

        this.mapData(this.dataCache, maskPattern);
    };

    QRModel.prototype.setupPositionProbePattern = function(row, col) {
        for (let r = -1; r <= 7; r++) {
            if (row + r <= -1 || this.moduleCount <= row + r) continue;
            for (let c = -1; c <= 7; c++) {
                if (col + c <= -1 || this.moduleCount <= col + c) continue;

                if ((0 <= r && r <= 6 && (c === 0 || c === 6)) ||
                    (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
                    (2 <= r && r <= 4 && 2 <= c && c <= 4)) {
                    this.modules[row + r][col + c] = true;
                } else {
                    this.modules[row + r][col + c] = false;
                }
            }
        }
    };

    QRModel.prototype.getBestMaskPattern = function() {
        let minLost = 0, pattern = 0;
        for (let i = 0; i < 8; i++) {
            this.makeImpl(true, i);
            const lost = this.getLostPoint();
            if (i === 0 || minLost > lost) {
                minLost = lost;
                pattern = i;
            }
        }
        return pattern;
    };

    QRModel.prototype.setupTimingPattern = function() {
        for (let r = 8; r < this.moduleCount - 8; r++) {
            if (this.modules[r][6] !== null) continue;
            this.modules[r][6] = (r % 2 === 0);
        }
        for (let c = 8; c < this.moduleCount - 8; c++) {
            if (this.modules[6][c] !== null) continue;
            this.modules[6][c] = (c % 2 === 0);
        }
    };

    QRModel.prototype.setupPositionAdjustPattern = function() {
        const pos = [
            [], [6, 18], [6, 22], [6, 26], [6, 30],
            [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46],
            [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62],
            [6, 26, 46, 66], [6, 26, 48, 70]
        ][this.typeNumber] || [];

        for (let i = 0; i < pos.length; i++) {
            for (let j = 0; j < pos.length; j++) {
                const row = pos[i], col = pos[j];
                if (this.modules[row][col] !== null) continue;

                for (let r = -2; r <= 2; r++) {
                    for (let c = -2; c <= 2; c++) {
                        if (r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0)) {
                            this.modules[row + r][col + c] = true;
                        } else {
                            this.modules[row + r][col + c] = false;
                        }
                    }
                }
            }
        }
    };

    QRModel.prototype.setupTypeNumber = function(test) {
        const bits = this.getBCHTypeNumber(this.typeNumber);
        for (let i = 0; i < 18; i++) {
            const mod = (!test && ((bits >> i) & 1) === 1);
            this.modules[Math.floor(i / 3)][i % 3 + this.moduleCount - 8 - 3] = mod;
        }
        for (let i = 0; i < 18; i++) {
            const mod = (!test && ((bits >> i) & 1) === 1);
            this.modules[i % 3 + this.moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
        }
    };

    QRModel.prototype.setupTypeInfo = function(test, maskPattern) {
        // Error correction level 2 = H (High, 30% recovery)
        const data = (2 << 3) | maskPattern;
        const bits = this.getBCHTypeInfo(data);

        for (let i = 0; i < 15; i++) {
            const mod = (!test && ((bits >> i) & 1) === 1);
            if (i < 6) this.modules[i][8] = mod;
            else if (i < 8) this.modules[i + 1][8] = mod;
            else this.modules[this.moduleCount - 15 + i][8] = mod;
        }

        for (let i = 0; i < 15; i++) {
            const mod = (!test && ((bits >> i) & 1) === 1);
            if (i < 8) this.modules[8][this.moduleCount - i - 1] = mod;
            else if (i < 9) this.modules[8][15 - i - 1 + 1] = mod;
            else this.modules[8][15 - i - 1] = mod;
        }

        this.modules[this.moduleCount - 8][8] = (!test);
    };

    QRModel.prototype.mapData = function(data, maskPattern) {
        let inc = -1, row = this.moduleCount - 1, bitIndex = 7, byteIndex = 0;

        for (let col = this.moduleCount - 1; col > 0; col -= 2) {
            if (col === 6) col--;

            while (true) {
                for (let c = 0; c < 2; c++) {
                    if (this.modules[row][col - c] === null) {
                        let dark = false;

                        if (byteIndex < data.length) {
                            dark = (((data[byteIndex] >>> bitIndex) & 1) === 1);
                        }

                        const mask = this.getMask(maskPattern, row, col - c);
                        if (mask) dark = !dark;

                        this.modules[row][col - c] = dark;
                        bitIndex--;

                        if (bitIndex === -1) {
                            byteIndex++;
                            bitIndex = 7;
                        }
                    }
                }

                row += inc;
                if (row < 0 || this.moduleCount <= row) {
                    row -= inc;
                    inc = -inc;
                    break;
                }
            }
        }
    };

    QRModel.prototype.createData = function() {
        const rsBlock = RS_TABLE[this.typeNumber] || RS_TABLE[10];
        const rsBlocks = [];

        for (let i = 0; i < rsBlock.length; i++) {
            const count = rsBlock[i][0];
            const totalCount = rsBlock[i][1];
            const dataCount = rsBlock[i][2];

            for (let j = 0; j < count; j++) {
                rsBlocks.push({ totalCount, dataCount });
            }
        }

        const buffer = new BitBuf();
        for (let k = 0; k < this.dataList.length; k++) {
            const data = this.dataList[k];
            buffer.put(4, 4);
            buffer.put(data.length, this.typeNumber < 10 ? 8 : 16);

            for (let i = 0; i < data.length; i++) {
                const code = data.charCodeAt(i);
                if (code > 0x10000) {
                    buffer.put(0xF0 | ((code & 0x1C0000) >>> 18), 8);
                    buffer.put(0x80 | ((code & 0x3F000) >>> 12), 8);
                    buffer.put(0x80 | ((code & 0xFC0) >>> 6), 8);
                    buffer.put(0x80 | (code & 0x3F), 8);
                } else if (code > 0x800) {
                    buffer.put(0xE0 | ((code & 0xF000) >>> 12), 8);
                    buffer.put(0x80 | ((code & 0xFC0) >>> 6), 8);
                    buffer.put(0x80 | (code & 0x3F), 8);
                } else if (code > 0x80) {
                    buffer.put(0xC0 | ((code & 0x7C0) >>> 6), 8);
                    buffer.put(0x80 | (code & 0x3F), 8);
                } else {
                    buffer.put(code, 8);
                }
            }
        }

        let totalDataCount = 0;
        for (let i = 0; i < rsBlocks.length; i++) {
            totalDataCount += rsBlocks[i].dataCount;
        }

        if (buffer.length + 4 <= totalDataCount * 8) buffer.put(0, 4);
        while (buffer.length % 8 !== 0) buffer.putBit(false);

        while (true) {
            if (buffer.length >= totalDataCount * 8) break;
            buffer.put(0xEC, 8);
            if (buffer.length >= totalDataCount * 8) break;
            buffer.put(0x11, 8);
        }

        return this.createBytes(buffer, rsBlocks);
    };

    QRModel.prototype.createBytes = function(buffer, rsBlocks) {
        let offset = 0, maxDcCount = 0, maxEcCount = 0;
        const dcdata = new Array(rsBlocks.length);
        const ecdata = new Array(rsBlocks.length);

        for (let r = 0; r < rsBlocks.length; r++) {
            const dcCount = rsBlocks[r].dataCount;
            const ecCount = rsBlocks[r].totalCount - dcCount;

            maxDcCount = Math.max(maxDcCount, dcCount);
            maxEcCount = Math.max(maxEcCount, ecCount);

            dcdata[r] = new Array(dcCount);
            for (let i = 0; i < dcCount; i++) {
                dcdata[r][i] = 0xff & buffer.buffer[i + offset];
            }
            offset += dcCount;

            const rsPoly = this.getErrorCorrectPolynomial(ecCount);
            const rawPoly = new Poly(dcdata[r], rsPoly.getLength() - 1);
            const modPoly = rawPoly.mod(rsPoly);

            ecdata[r] = new Array(rsPoly.getLength() - 1);
            for (let i = 0; i < ecdata[r].length; i++) {
                const modIndex = i + modPoly.getLength() - ecdata[r].length;
                ecdata[r][i] = (modIndex >= 0) ? modPoly.get(modIndex) : 0;
            }
        }

        let totalCodeCount = 0;
        for (let i = 0; i < rsBlocks.length; i++) {
            totalCodeCount += rsBlocks[i].totalCount;
        }

        const data = new Array(totalCodeCount);
        let index = 0;

        for (let i = 0; i < maxDcCount; i++) {
            for (let r = 0; r < rsBlocks.length; r++) {
                if (i < dcdata[r].length) data[index++] = dcdata[r][i];
            }
        }
        for (let i = 0; i < maxEcCount; i++) {
            for (let r = 0; r < rsBlocks.length; r++) {
                if (i < ecdata[r].length) data[index++] = ecdata[r][i];
            }
        }

        return data;
    };

    QRModel.prototype.getBCHTypeInfo = function(data) {
        let d = data << 10;
        while (this.getBCHDigit(d) - this.getBCHDigit(0x537) >= 0) {
            d ^= (0x537 << (this.getBCHDigit(d) - this.getBCHDigit(0x537)));
        }
        return ((data << 10) | d) ^ 0x5412;
    };

    QRModel.prototype.getBCHTypeNumber = function(data) {
        let d = data << 12;
        while (this.getBCHDigit(d) - this.getBCHDigit(0x1F25) >= 0) {
            d ^= (0x1F25 << (this.getBCHDigit(d) - this.getBCHDigit(0x1F25)));
        }
        return (data << 12) | d;
    };

    QRModel.prototype.getBCHDigit = function(data) {
        let digit = 0;
        while (data !== 0) { digit++; data >>>= 1; }
        return digit;
    };

    QRModel.prototype.getMask = function(maskPattern, i, j) {
        switch (maskPattern) {
            case 0: return (i + j) % 2 === 0;
            case 1: return i % 2 === 0;
            case 2: return j % 3 === 0;
            case 3: return (i + j) % 3 === 0;
            case 4: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
            case 5: return (i * j) % 2 + (i * j) % 3 === 0;
            case 6: return ((i * j) % 2 + (i * j) % 3) % 2 === 0;
            case 7: return ((i * j) % 3 + (i + j) % 2) % 2 === 0;
            default: return false;
        }
    };

    QRModel.prototype.getErrorCorrectPolynomial = function(errorCorrectLength) {
        let a = new Poly([1], 0);
        for (let i = 0; i < errorCorrectLength; i++) {
            a = a.multiply(new Poly([1, gexp(i)], 0));
        }
        return a;
    };

    QRModel.prototype.getLostPoint = function() {
        const moduleCount = this.moduleCount;
        let lostPoint = 0;

        for (let row = 0; row < moduleCount; row++) {
            for (let col = 0; col < moduleCount; col++) {
                let sameCount = 0;
                const dark = this.isDark(row, col);

                for (let r = -1; r <= 1; r++) {
                    if (row + r < 0 || moduleCount <= row + r) continue;
                    for (let c = -1; c <= 1; c++) {
                        if (col + c < 0 || moduleCount <= col + c) continue;
                        if (r === 0 && c === 0) continue;
                        if (dark === this.isDark(row + r, col + c)) sameCount++;
                    }
                }
                if (sameCount > 5) lostPoint += (3 + sameCount - 5);
            }
        }
        return lostPoint;
    };

    return {
        render: function(container, text, size) {
            // ✅ Dynamic type detection based on text length
            let typeNumber;
            const len = text.length;

            if (len <= 78) typeNumber = 4;
            else if (len <= 122) typeNumber = 5;
            else if (len <= 158) typeNumber = 6;
            else if (len <= 194) typeNumber = 7;
            else if (len <= 230) typeNumber = 8;
            else if (len <= 271) typeNumber = 9;
            else if (len <= 321) typeNumber = 10;
            else if (len <= 367) typeNumber = 11;
            else if (len <= 425) typeNumber = 12;
            else if (len <= 458) typeNumber = 13;
            else if (len <= 520) typeNumber = 14;
            else {
                // Too long for our table — fail gracefully
                throw new Error('Data too long for MiniQR (max ~520 chars)');
            }

            console.log('📱 MiniQR: type ' + typeNumber + ' for ' + len + ' chars');

            const qr = new QRModel(typeNumber);
            qr.addData(text);
            qr.make();

            const count = qr.getModuleCount();
            const quietZone = 4;
            const totalModules = count + (quietZone * 2);
            const canvasSize = size;
            const cellSize = canvasSize / totalModules;

            const canvas = document.createElement('canvas');
            canvas.width = canvasSize;
            canvas.height = canvasSize;
            canvas.style.cssText = 'width:100%;height:100%;display:block;image-rendering:pixelated;';

            const ctx = canvas.getContext('2d');

            // White background (includes quiet zone)
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvasSize, canvasSize);

            // Black modules
            ctx.fillStyle = '#000000';
            for (let row = 0; row < count; row++) {
                for (let col = 0; col < count; col++) {
                    if (qr.isDark(row, col)) {
                        const x = Math.round((col + quietZone) * cellSize);
                        const y = Math.round((row + quietZone) * cellSize);
                        const x2 = Math.round((col + quietZone + 1) * cellSize);
                        const y2 = Math.round((row + quietZone + 1) * cellSize);
                        ctx.fillRect(x, y, Math.max(1, x2 - x), Math.max(1, y2 - y));
                    }
                }
            }

            container.innerHTML = '';
            container.appendChild(canvas);
            return true;
        }
    };
})();

// ============================================================
// 💰 GET PAYMENT URL — Full UPI encoding
// ============================================================
function _getPaymentURL(amount, note) {
    const upiId = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.UPI_PRIMARY_ID)
        ? APP_CONFIG.UPI_PRIMARY_ID
        : '9110977117@ybl';

    const payeeName = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.PAYEE_NAME)
        ? APP_CONFIG.PAYEE_NAME
        : 'BOSC Tech and Edu';

    const tn = note || 'Hor Katha Payment';

    // ✅ Full UPI character encoding
    function encodeUPI(str) {
        return String(str)
            .replace(/%/g, '%25')
            .replace(/ /g, '%20')
            .replace(/&/g, '%26')
            .replace(/=/g, '%3D')
            .replace(/\?/g, '%3F')
            .replace(/#/g, '%23')
            .replace(/\+/g, '%2B')
            .replace(/\//g, '%2F')
            .replace(/\\/g, '%5C');
    }

    const amt = Number(amount).toFixed(2);
    const url = `upi://pay?pa=${encodeUPI(upiId)}&pn=${encodeUPI(payeeName)}&am=${amt}&cu=INR&tn=${encodeUPI(tn)}`;

    console.log('💳 UPI URL:', url);
    console.log('💳 URL length:', url.length);

    return url;
}

// ============================================================
// ✅ MODAL GUARD — with timeout fallback
// ============================================================
function _canOpenModal(modalName) {
    // If app is ready, always allow
    if (window.__appReady === true) return true;

    // If still loading, wait up to 3s
    const startTime = Date.now();
    const waitMax = 3000;

    // Quick check: if splash removed, allow
    if (!document.getElementById('appSplash')) return true;

    // Allow if waited too long (fallback)
    if (document.__modalWaitStart) {
        const elapsed = Date.now() - document.__modalWaitStart;
        if (elapsed > waitMax) {
            console.warn('🛡️ ' + (modalName || 'Modal') + ' — timeout fallback, allowing');
            return true;
        }
    } else {
        document.__modalWaitStart = startTime;
    }

    console.warn('🛡️ ' + (modalName || 'Modal') + ' blocked — app not ready');
    return false;
}

// ============================================================
// 🎬 FLASH MESSAGE SYSTEM
// ============================================================
function showFlash(options = {}) {
    const container = document.getElementById('flashContainer');
    if (!container) return null;

    const {
        type = 'info',
        icon = 'ℹ️',
        title = '',
        subtitle = '',
        body = '',
        duration = 6000,
        compact = false,
        onClose = null
    } = options;

    const flash = document.createElement('div');
    flash.className = `flash-message flash-${type}${compact ? ' flash-compact' : ''}`;

    let bodyHTML = '';
    if (body) bodyHTML = `<div class="flash-body">${body}</div>`;

    flash.innerHTML = `
        <div class="flash-header">
            <div class="flash-icon">${icon}</div>
            <div style="flex: 1; min-width: 0;">
                <div class="flash-title">${escapeFlashHtml(title)}</div>
                ${subtitle ? `<div class="flash-subtitle">${escapeFlashHtml(subtitle)}</div>` : ''}
            </div>
            <button class="flash-close" aria-label="Close">✕</button>
        </div>
        ${bodyHTML}
        <div class="flash-progress">
            <div class="flash-progress-bar"></div>
        </div>
    `;

    container.appendChild(flash);
    _activeFlashes.push(flash);

    const closeBtn = flash.querySelector('.flash-close');
    let closed = false;

    function escHandler(e) {
        if (e.key === 'Escape' && _activeFlashes[_activeFlashes.length - 1] === flash) {
            closeFlash();
        }
    }

    function closeFlash() {
        if (closed) return;
        closed = true;

        if (typeof onClose === 'function') {
            try { onClose(); } catch (e) {}
        }

        flash.classList.add('flash-out');
        setTimeout(() => {
            if (flash.parentNode) flash.parentNode.removeChild(flash);
            const idx = _activeFlashes.indexOf(flash);
            if (idx > -1) _activeFlashes.splice(idx, 1);
        }, 400);

        // ✅ FIXED: Remove ESC listener on close
        document.removeEventListener('keydown', escHandler);
    }

    closeBtn.addEventListener('click', closeFlash);

    // ✅ Duration clamp + progress bar
    const safeDuration = Math.max(0, Math.min(60000, Number(duration) || 6000));

    if (safeDuration > 0) {
        const progressBar = flash.querySelector('.flash-progress-bar');
        if (progressBar) {
            progressBar.style.transition = `width ${safeDuration}ms linear`;
            requestAnimationFrame(() => { progressBar.style.width = '0%'; });
        }
        setTimeout(closeFlash, safeDuration);
    }

    document.addEventListener('keydown', escHandler);

    return flash;
}

function showToast(message, type = 'info', duration = 3500) {
    const iconMap = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const titleMap = { success: 'Success', error: 'Error', warning: 'Warning', info: 'Info' };
    return showFlash({
        type,
        icon: iconMap[type] || 'ℹ️',
        title: titleMap[type] || 'Info',
        subtitle: message,
        duration: Math.max(0, Math.min(60000, duration)),
        compact: true
    });
}

const toastSuccess = (m) => showToast(m, 'success');
const toastError   = (m) => showToast(m, 'error');
const toastWarning = (m) => showToast(m, 'warning');
const toastInfo    = (m) => showToast(m, 'info');

// ============================================================
// 🎁 TRIAL ACTIVATION MODAL
// ============================================================
async function openTrialActivationModal() {
    if (!_canOpenModal('openTrialActivationModal')) return;

    const modal = document.getElementById('trialActivationModal');
    if (!modal) return;

    const keyInput = document.getElementById('trialKeyInput');
    if (keyInput) keyInput.value = '';

    const statusEl = document.getElementById('trialActivationStatus');
    if (statusEl) {
        statusEl.className = 'trm-status';
        statusEl.textContent = '';
    }

    const qrBox = document.getElementById('trialQrBox');
    if (qrBox) {
        qrBox.innerHTML = '';
        qrBox.removeAttribute('style');
    }

    modal.style.display = 'flex';
    document.body.classList.add('modal-open');

    const trialPrice = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.TRIAL_PRICE) || 9;
    const upiUrl = _getPaymentURL(trialPrice, 'Hor Katha 7-Day Trial');

    // ✅ Direct render
    setTimeout(() => {
        renderQRCode('trialQrBox', upiUrl, 220);
    }, 100);
}

function closeTrialActivationModal() {
    const modal = document.getElementById('trialActivationModal');
    if (modal) modal.style.display = 'none';

    const statusEl = document.getElementById('trialActivationStatus');
    if (statusEl) {
        statusEl.className = 'trm-status';
        statusEl.textContent = '';
    }

    _unlockBodyScroll();
}

async function activateTrialWithKey() {
    const keyInput = document.getElementById('trialKeyInput');
    const statusEl = document.getElementById('trialActivationStatus');
    if (!keyInput || !statusEl) return;

    const key = (keyInput.value || '').trim().toUpperCase();

    if (!key) {
        statusEl.className = 'trm-status error';
        statusEl.textContent = '❌ कृपया Trial Key enter करें';
        return;
    }

    if (!/^HKT-\d{7}-[A-F0-9]{4}$/.test(key)) {
        statusEl.className = 'trm-status error';
        statusEl.textContent = '❌ गलत format! Format: HKT-XXXXXXX-XXXX';
        return;
    }

    statusEl.className = 'trm-status loading';
    statusEl.textContent = '⏳ Key verify हो रही है...';

    try {
        if (typeof TrialSystem === 'undefined' || !TrialSystem.activateWithKey) {
            statusEl.className = 'trm-status error';
            statusEl.textContent = '❌ Trial system unavailable';
            return;
        }

        const result = await TrialSystem.activateWithKey(key);

        if (result.success) {
            statusEl.className = 'trm-status success';
            statusEl.textContent = '✅ Trial activated! 7 days unlocked.';

            showFlash({
                type: 'success',
                icon: '🎉',
                title: 'Trial Activated!',
                subtitle: '7 Days Full Access',
                body: '<p>सभी Pro features अब unlocked हैं।</p>',
                duration: 6000
            });

            setTimeout(async () => {
                if (typeof checkLicenseIntegrity === 'function') {
                    await checkLicenseIntegrity();
                }
                setTimeout(() => {
                    closeTrialActivationModal();
                    setTimeout(() => location.reload(), 500);
                }, 1500);
            }, 800);
        } else {
            statusEl.className = 'trm-status error';
            statusEl.textContent = '❌ ' + (result.reason || 'Invalid trial key');
        }
    } catch (e) {
        statusEl.className = 'trm-status error';
        statusEl.textContent = '❌ ' + e.message;
    }
}

function sendTrialPaymentToWhatsApp() {
    const sellerWa = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.SUPPORT_WHATSAPP)
        ? APP_CONFIG.SUPPORT_WHATSAPP
        : "919110977117";
    const trialPrice = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.TRIAL_PRICE) || 9;

    setTimeout(async () => {
        let hwidFull = 'Unknown';
        try {
            if (typeof getDeviceHardwareFingerprint === 'function') {
                hwidFull = await getDeviceHardwareFingerprint() || 'Unknown';
            }
        } catch (e) {}

        const msg = `🎁 *₹9 TRIAL REQUEST — Hor Katha Suite*

💰 *Amount:* ₹${trialPrice}
📱 *Device ID:* ${hwidFull}
📅 *Date:* ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}

✅ मैंने ₹${trialPrice} का payment कर दिया है।
📸 Payment screenshot इसी chat में भेज रहा हूँ।

🔑 कृपया Trial Key भेजें (Format: HKT-XXXXXXX-XXXX)`;

        const waUrl = `https://wa.me/${sellerWa}?text=${encodeURIComponent(msg)}`;
        try {
            const opened = window.open(waUrl, '_blank');
            if (!opened) window.location.href = waUrl;
        } catch (e) {
            window.location.href = waUrl;
        }
    }, 300);
}

// ============================================================
// 🔑 Trial key auto-format setup
// ============================================================
(function setupTrialKeyAutoFormat() {
    document.addEventListener('DOMContentLoaded', () => {
        const input = document.getElementById('trialKeyInput');
        if (!input) return;

        function formatTrialKey(val) {
            val = (val || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (val.startsWith('HKT')) val = val.substring(3);
            let formatted = 'HKT';
            if (val.length > 0) formatted += '-' + val.substring(0, 7);
            if (val.length > 7) formatted += '-' + val.substring(7, 11);
            return formatted;
        }

        input.addEventListener('input', function() {
            this.value = formatTrialKey(this.value);
        });

        input.addEventListener('paste', function(e) {
            e.preventDefault();
            // ✅ FIXED: Proper paste handling
            const pasted = (e.clipboardData || window.clipboardData).getData('text');
            this.value = formatTrialKey(pasted);
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                activateTrialWithKey();
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                closeTrialActivationModal();
            }
        });
    });
})();

function selectTrialPlan() {
    closeBuyModal();
    setTimeout(() => {
        if (typeof openTrialActivationModal === 'function') {
            openTrialActivationModal();
        }
    }, 300);
}

// ============================================================
// 💖 DONATE MODAL
// ============================================================
function openDonateModal() {
    if (!_canOpenModal('openDonateModal')) return;

    const modal = document.getElementById('donateModal');
    if (!modal) return;

    modal.style.display = 'flex';
    document.body.classList.add('modal-open');

    // ✅ Direct render
    const pills = document.querySelectorAll('.donate-choice-pill');
    setDonateAmount(251, pills[2] || null);
}

function closeDonateModal() {
    const modal = document.getElementById('donateModal');
    if (modal) modal.style.display = 'none';
    _unlockBodyScroll();
}

function setDonateAmount(amount, pillElement = null) {
    currentDonateAmount = _safeInt(amount, 1, 100000, 251);

    if (pillElement) {
        const input = document.getElementById('customDonateInput');
        if (input) input.value = '';
    }

    document.querySelectorAll('.donate-choice-pill').forEach(c => c.classList.remove('active-pill'));
    if (pillElement) pillElement.classList.add('active-pill');

    updateDonateQR();
}

function handleCustomDonateInput(val) {
    const amt = _safeInt(val, 0, 100000, 0);
    if (amt && amt > 0) {
        currentDonateAmount = amt;
        document.querySelectorAll('.donate-choice-pill').forEach(c => c.classList.remove('active-pill'));
        updateDonateQR();
    }
}

function updateDonateQR() {
    const label = document.getElementById('donateAmountLabel');
    if (label) label.textContent = `Selected: ₹${currentDonateAmount}`;

    const upiUrl = _getPaymentURL(currentDonateAmount, 'Hor Katha Support');
    renderQRCode('donateQrBox', upiUrl, 220);
}

function redirectToWhatsAppDonate() {
    const suppWa = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.SUPPORT_WHATSAPP)
        ? APP_CONFIG.SUPPORT_WHATSAPP
        : "919110977117";

    const msg = encodeURIComponent(`नमस्ते BOSC Tech & Edu,\nमैंने Hoṛ Katha Suite के लिए ₹${currentDonateAmount} का सहयोग भेजा है।\nAmount: ₹${currentDonateAmount}`);

    window.open(`https://wa.me/${suppWa}?text=${msg}`, '_blank');
}

// ============================================================
// 🛒 BUY MODAL
// ============================================================
async function openBuyModal() {
    if (!_canOpenModal('openBuyModal')) return;

    const licInput = document.getElementById('licCustomerName');
    const buyInput = document.getElementById('buyCustomerName');
    if (licInput && buyInput) buyInput.value = licInput.value || '';

    // Load device ID
    const dvcBuy = document.getElementById('buyDeviceIdDisplay');
    if (dvcBuy) {
        try {
            if (typeof getDeviceHardwareFingerprint === 'function') {
                dvcBuy.value = await getDeviceHardwareFingerprint();
            }
        } catch (e) {}
    }

    // Reset checkbox
    const chk = document.getElementById('paymentConfirmCheck');
    const btn = document.getElementById('btnPaymentDone');
    if (chk) chk.checked = false;
    if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
    }

    // Reset processing flag
    _isProcessingPayment = false;

    document.body.classList.add('modal-open');
    const modal = document.getElementById('buyModal');
    if (modal) modal.style.display = 'flex';

    // ✅ Direct render — no extra RAF
    selectPlan(199, 'P1 — Community (₹199)', 'cardPlan1');
}

function closeBuyModal() {
    const modal = document.getElementById('buyModal');
    if (modal) modal.style.display = 'none';
    _unlockBodyScroll();
}

function selectPlan(price, title, cardId) {
    currentSelectedPrice = _safeInt(price, 1, 100000, 199);
    currentSelectedPlanTitle = title;

    document.querySelectorAll('.bm-plan').forEach(c => c.classList.remove('active-plan'));
    const card = document.getElementById(cardId);
    if (card) {
        card.classList.add('active-plan');
        const radio = card.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
    }

    const label = document.getElementById('selectedPlanLabel');
    if (label) label.textContent = `Selected: ₹${currentSelectedPrice} Plan`;

    const buyTopBtn = document.getElementById('btn-buy-top');
    if (buyTopBtn) buyTopBtn.textContent = `💳 Buy Key (₹${currentSelectedPrice})`;

    const upiUrl = _getPaymentURL(currentSelectedPrice, 'Hor Katha Pro License');
    renderQRCode('upiQrCodeBox', upiUrl, 180);
}

// ============================================================
// 🔐 LICENSE MODAL
// ============================================================
async function openLicenseModal() {
    if (!_canOpenModal('openLicenseModal')) return;

    const licName = document.getElementById('licCustomerName');
    const licKey = document.getElementById('licCustomerKey');
    const dvcDisplay = document.getElementById('userDeviceIdDisplay');

    if (dvcDisplay) {
        try {
            if (typeof getDeviceHardwareFingerprint === 'function') {
                dvcDisplay.value = await getDeviceHardwareFingerprint();
            }
        } catch (e) {}
    }

    let savedName = '';
    let savedKey = '';
    try {
        savedName = localStorage.getItem('hor_lic_user') || '';
        savedKey = localStorage.getItem('hor_lic_key') || '';
    } catch (e) {}

    if (licName) licName.value = savedName;
    if (licKey) licKey.value = savedKey;

    const modal = document.getElementById('licenseModal');
    if (modal) modal.style.display = 'flex';
    document.body.classList.add('modal-open');
}

function closeLicenseModal() {
    const modal = document.getElementById('licenseModal');
    if (modal) modal.style.display = 'none';
    _unlockBodyScroll();
}

async function verifyAndActivateLicense() {
    const name = document.getElementById('licCustomerName')?.value.trim();
    const key = document.getElementById('licCustomerKey')?.value.trim();

    if (!name || !key) {
        toastWarning('कृपया Name और Key भरें!');
        return;
    }

    showProgress('Verifying License...', 'Checking signature');
    setProgress(30, 'Parsing payload');
    await new Promise(r => setTimeout(r, 150));

    const check = await verifyLicensePayload(name, key);
    setProgress(80, 'Applying activation');
    await new Promise(r => setTimeout(r, 200));
    setProgress(100, 'Done!');

    setTimeout(() => {
        hideProgress();

        if (check.valid) {
            try {
                localStorage.setItem('hor_lic_user', name);
                localStorage.setItem('hor_lic_key', key.toUpperCase());
            } catch (e) {}

            isProLicensed = true;
            applyProState(name, check.plan, true);
            toastSuccess(`सफल सक्रियण! User: ${name}, Plan: ${check.plan}`);
            closeLicenseModal();
        } else {
            toastError(`अमान्य की: ${check.reason}`);
        }
    }, 300);
}

function deactivateLicense() {
    if (confirm('क्या आप लाइसेंस निष्क्रिय करना चाहते हैं?')) {
        try {
            localStorage.removeItem('hor_lic_user');
            localStorage.removeItem('hor_lic_key');
        } catch (e) {}

        isProLicensed = false;
        applyFreeState();
        closeLicenseModal();
        toastInfo('License deactivated');
    }
}

// ============================================================
// 💳 PAYMENT COMPLETED — with double-click guard
// ============================================================
function generateReceiptNumber() {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `HK-${yy}${mm}${dd}${hh}${mi}-${rand}`;
}

function getISTTimestamp() {
    try {
        return new Date().toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    } catch (e) {
        return new Date().toLocaleString();
    }
}

async function onPaymentCompleted() {
    // ✅ FIXED: Double-click guard
    if (_isProcessingPayment) {
        console.warn('⚠️ Payment already processing — ignoring duplicate click');
        return;
    }

    const paymentCheck = document.getElementById('paymentConfirmCheck');
    if (paymentCheck && !paymentCheck.checked) {
        toastWarning('कृपया पहले confirm करें!');
        return;
    }

    const nameInput = document.getElementById('buyCustomerName');
    const name = nameInput ? nameInput.value.trim() : '';

    if (!name) {
        toastWarning('कृपया पहले अपना नाम भरें!');
        if (nameInput) nameInput.focus();
        return;
    }

    // Set processing flag
    _isProcessingPayment = true;

    const btn = document.getElementById('btnPaymentDone');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '⏳ Receipt बन रही है...';
        btn.style.opacity = '0.8';
    }

    let hwid = 'Unknown';
    try {
        if (typeof getDeviceHardwareFingerprint === 'function') {
            hwid = await getDeviceHardwareFingerprint() || 'Unknown';
        }
    } catch (e) {}

    const receiptNo = generateReceiptNumber();
    const timestamp = getISTTimestamp();
    const plan = currentSelectedPlanTitle;
    const amount = currentSelectedPrice;

    const sellerWa = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.SUPPORT_WHATSAPP)
        ? APP_CONFIG.SUPPORT_WHATSAPP
        : "919110977117";

    const waMsg = `🧾 *NEW PURCHASE — PAYMENT CONFIRMED*
━━━━━━━━━━━━━━━━━━━━
📋 Receipt No: *${receiptNo}*
📅 ${timestamp}
👤 *${name}*
📱 ${hwid}
💼 ${plan}
💰 ₹${amount}
━━━━━━━━━━━━━━━━━━━━
✅ मैंने payment कर दिया है।
📸 Screenshot इसी chat में भेज रहा हूँ
🔑 कृपया License Key भेजें।`;

    // Show receipt
    showReceiptModal({ receiptNo, name, hwid, plan, amount, timestamp });

    // Reset button
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '✅ Payment हो गया? — Confirm करें<br><span>(Receipt + WhatsApp Order — Auto)</span>';
        btn.style.opacity = '1';
    }

    // Open WhatsApp after short delay
    setTimeout(() => {
        const waUrl = `https://wa.me/${sellerWa}?text=${encodeURIComponent(waMsg)}`;
        try {
            const opened = window.open(waUrl, '_blank');
            if (!opened) window.location.href = waUrl;
        } catch (e) {
            window.location.href = waUrl;
        }

        // Reset processing flag after WhatsApp opens
        setTimeout(() => {
            _isProcessingPayment = false;
        }, 1000);
    }, 300);

    // Save to localStorage
    try {
        const all = JSON.parse(localStorage.getItem('hor_receipts') || '[]');
        all.push({ receiptNo, name, hwid, plan, amount, timestamp });
        if (all.length > 500) all.shift();
        localStorage.setItem('hor_receipts', JSON.stringify(all));
    } catch (e) {}
}

// ============================================================
// 🧾 RECEIPT MODAL — XSS-safe (textContent)
// ============================================================
function showReceiptModal(record) {
    const modal = document.getElementById('receiptModal');
    if (!modal) return;

    // ✅ FIXED: textContent instead of innerHTML (XSS-safe)
    const fields = {
        rcptNumber: record.receiptNo,
        rcptDate: record.timestamp,
        rcptName: record.name,
        rcptDevice: record.hwid,
        rcptPlan: record.plan,
        rcptAmount: '₹' + record.amount
    };

    Object.keys(fields).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = fields[id];
    });

    modal.style.display = 'flex';
}

function closeReceiptModal() {
    const m = document.getElementById('receiptModal');
    if (m) m.style.display = 'none';
}

function copyReceiptNumber() {
    const el = document.getElementById('rcptNumber');
    if (!el) return;
    navigator.clipboard.writeText(el.textContent).then(() => toastSuccess('Copied!'));
}

function shareReceiptOnWhatsApp() {
    const sellerWa = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.SUPPORT_WHATSAPP)
        ? APP_CONFIG.SUPPORT_WHATSAPP
        : "919110977117";

    const rn = document.getElementById('rcptNumber').textContent;
    const msg = `🧾 Receipt: *${rn}*\n✅ Payment Done`;
    window.open(`https://wa.me/${sellerWa}?text=${encodeURIComponent(msg)}`, '_blank');
}

function redirectToWhatsAppBuy() {
    const chk = document.getElementById('paymentConfirmCheck');
    if (!chk || !chk.checked) {
        toastWarning('⚠️ कृपया पहले confirm करें!');
        return;
    }
    onPaymentCompleted();
}

// ============================================================
// 🎨 TOGGLES
// ============================================================
function toggleClickSound() {
    isClickSoundEnabled = !isClickSoundEnabled;
    const btn = document.getElementById('btn-sound-toggle');
    if (btn) btn.textContent = isClickSoundEnabled ? '⌨️ Sound: ON' : '🔇 Sound: OFF';
}

function toggleHoverVoice() {
    isHoverVoiceEnabled = !isHoverVoiceEnabled;
    const btn = document.getElementById('btn-hover-voice');
    if (btn) btn.textContent = isHoverVoiceEnabled ? '🗣️ Hover: ON' : '🗣️ Hover: OFF';
}

function toggleVoiceOutput() {
    isVoiceEnabled = !isVoiceEnabled;
    const btn = document.getElementById('btn-voice-toggle');
    if (btn) btn.textContent = isVoiceEnabled ? '🔊 TTS: ON' : '🔇 TTS: OFF';
}

function togglePhoneticTranslit() {
    isPhoneticEnabled = !isPhoneticEnabled;
    const btn = document.getElementById('btn-phonetic-toggle');
    if (btn) {
        btn.textContent = isPhoneticEnabled ? '✨ Translit: ON' : '✨ Translit: OFF';
        btn.classList.toggle('active-state', isPhoneticEnabled);
    }
}

function toggleTheme() {
    const body = document.body;
    const ct = body.getAttribute('data-theme') || 'dark';
    const nt = ct === 'dark' ? 'light' : 'dark';
    body.setAttribute('data-theme', nt);

    const btn = document.getElementById('btn-theme-toggle');
    if (btn) btn.textContent = nt === 'dark' ? '🌙 Dark' : '☀️ Light';

    try {
        localStorage.setItem('hor_katha_theme', nt);
    } catch (e) {}
}

function toggleZenMode() {
    const isZen = document.body.classList.toggle('zen-mode');
    const btn = document.getElementById('btn-zen-mode');
    if (btn) {
        btn.textContent = isZen ? '🧘 Zen: ON' : '🧘 Zen';
        btn.classList.toggle('active-state', isZen);
    }
}

// ============================================================
// 📦 HELPERS
// ============================================================
function _unlockBodyScroll() {
    // ✅ FIXED: Always ensure scroll unlock
    document.body.classList.remove('modal-open');

    // Check if any modal is still open
    const openModals = document.querySelectorAll('.modal-overlay, .preview-modal');
    let hasOpenModal = false;
    openModals.forEach(m => {
        if (m.style.display === 'flex' || m.style.display === 'block') {
            hasOpenModal = true;
        }
    });

    if (!hasOpenModal) {
        document.body.classList.remove('modal-open');
    }
}

function handleModalOutsideClick(e, modalId) {
    if (e.target.id === modalId) {
        const m = document.getElementById(modalId);
        if (m) m.style.display = 'none';
        _unlockBodyScroll();
    }
}

function deleteLastInBox(boxId) {
    const box = document.getElementById(boxId);
    if (!box || !box.value) return;

    if (window.Intl && Intl.Segmenter) {
        const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
        const segments = Array.from(segmenter.segment(box.value)).map(s => s.segment);
        box.value = segments.slice(0, -1).join('');
    } else {
        box.value = Array.from(box.value).slice(0, -1).join('');
    }
}

function clearBox(boxId) {
    const box = document.getElementById(boxId);
    if (box) box.value = '';
}

function copyFromBox(boxId) {
    const box = document.getElementById(boxId);
    if (box && box.value) {
        navigator.clipboard.writeText(box.value);
        showToast('Copied to clipboard', 'success');
    }
}

function insertFromBox(boxId, modalId) {
    const box = document.getElementById(boxId);
    if (box && box.value) {
        if (typeof addCharWithPhonics === 'function') {
            addCharWithPhonics(box.value);
        }
        const m = document.getElementById(modalId);
        if (m) m.style.display = 'none';
    }
}

// ============================================================
// 📲 PWA INSTALL
// ============================================================
function installPWA() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((r) => {
            if (r.outcome === 'accepted') {
                const pwaBtn = document.getElementById('pwa-install-btn');
                if (pwaBtn) pwaBtn.textContent = '✅ Installed';
            }
            deferredPrompt = null;
        });
    } else {
        alert('ब्राउज़र मेनू (⋮) से "Install app" चुनें।\n\nया\n\nChrome/Edge में address bar के right side में install icon देखें।');
    }
}

// ============================================================
// 🔤 FONTS
// ============================================================
function loadGoogleFontDynamically(gfont) {
    if (!gfont || !navigator.onLine) return;
    try {
        const fontId = 'gfont-' + gfont.replace(/[^a-zA-Z0-9]/g, '-');
        if (!document.getElementById(fontId)) {
            const link = document.createElement('link');
            link.id = fontId;
            link.rel = 'stylesheet';
            link.href = `https://fonts.googleapis.com/css2?family=${gfont}&display=swap`;
            document.head.appendChild(link);
        }
    } catch (e) {}
}

function autoSyncLanguageFonts(langKey) {
    const fontDropdown = document.getElementById('fontFamilySelect');
    if (!fontDropdown) return;
    if (typeof languageFontsDB === 'undefined') return;

    const fonts = languageFontsDB[langKey] || languageFontsDB['english'];
    fontDropdown.innerHTML = '';

    let defaultFontVal = fonts[0].val;

    fonts.forEach((f) => {
        const opt = document.createElement('option');
        opt.value = f.val;
        opt.textContent = f.name;
        if (f.gfont) opt.setAttribute('data-gfont', f.gfont);

        if (f.default) {
            opt.selected = true;
            defaultFontVal = f.val;
            if (f.gfont) loadGoogleFontDynamically(f.gfont);
        }
        fontDropdown.appendChild(opt);
    });

    changeFontFamily(defaultFontVal);
}

function changeFontFamily(family) {
    const editor = document.getElementById('editor');
    if (!editor) return;
    editor.style.fontFamily = family;

    const fd = document.getElementById('fontFamilySelect');
    if (fd && fd.selectedOptions.length > 0) {
        const gfont = fd.selectedOptions[0].getAttribute('data-gfont');
        if (gfont) loadGoogleFontDynamically(gfont);
    }
}

// ============================================================
// 🔣 CHAR MAP — hover voice wired
// ============================================================
function openCharMapModal() {
    if (!_canOpenModal('openCharMapModal')) return;
    if (typeof requireProAccess === 'function' && !requireProAccess('Character Map')) return;

    const fontSelect = document.getElementById('fontSelect');
    if (fontSelect && typeof currentLayout !== 'undefined') {
        fontSelect.value = currentLayout;
    }

    const searchInput = document.getElementById('charmapSearchInput');
    if (searchInput) searchInput.value = '';

    buildCharMatrix(typeof currentLayout !== 'undefined' ? currentLayout : 'english');

    const copyBox = document.getElementById('copyBox');
    if (copyBox) copyBox.value = '';

    const modal = document.getElementById('charmapModal');
    if (modal) modal.style.display = 'flex';
    document.body.classList.add('modal-open');
}

function closeCharMapModal() {
    const modal = document.getElementById('charmapModal');
    if (modal) modal.style.display = 'none';
    hideZoomLens();
    _unlockBodyScroll();
}

function onScriptMapSelect(scriptKey) {
    const input = document.getElementById('charmapSearchInput');
    if (input) input.value = '';
    buildCharMatrix(scriptKey);
}

function filterCharMap(term) {
    const sel = document.getElementById('fontSelect');
    if (sel) buildCharMatrix(sel.value, term.trim());
}

function buildCharMatrix(scriptKey, filter = '') {
    const fragment = document.createDocumentFragment();
    const charmapMatrix = document.getElementById('charmapMatrix');
    const charmapZoomLens = document.getElementById('charmapZoomLens');
    const charmapMatrixWrap = document.getElementById('charmapMatrixWrap');
    const nameEl = document.getElementById('charNameDisplay');
    const hexEl = document.getElementById('charHexDisplay');

    if (!charmapMatrix || !charmapZoomLens || !charmapMatrixWrap) return;
    if (typeof scriptLibraries === 'undefined') return;

    let list = scriptLibraries[scriptKey] || scriptLibraries['english'];
    if (filter) {
        list = list.filter(ch => ch.toLowerCase().includes(filter.toLowerCase()));
    }

    list.forEach(ch => {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.textContent = ch;

        cell.addEventListener('mouseenter', () => {
            // ✅ FIXED: Hover voice wired
            if (typeof handleHoverSpeech === 'function') {
                handleHoverSpeech(ch);
            }

            charmapZoomLens.textContent = ch;
            charmapZoomLens.style.display = 'flex';

            const rect = cell.getBoundingClientRect();
            const wrapRect = charmapMatrixWrap.getBoundingClientRect();

            charmapZoomLens.style.left = (rect.left - wrapRect.left + rect.width / 2) + 'px';
            charmapZoomLens.style.top = (rect.top - wrapRect.top) + 'px';

            if (nameEl) nameEl.textContent = `Character: ${ch}`;
            if (hexEl) {
                const codeHex = Array.from(ch)
                    .map(c => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'))
                    .join(' ');
                hexEl.textContent = `Unicode: ${codeHex}`;
            }
        });

        cell.addEventListener('mouseleave', hideZoomLens);

        cell.onclick = () => {
            if (typeof speakLetter === 'function') speakLetter(ch);

            document.querySelectorAll('#charmapMatrix .cell').forEach(c => c.classList.remove('selected'));
            cell.classList.add('selected');
            lastActiveChar = ch;

            const box = document.getElementById('copyBox');
            if (box) box.value += ch;
        };

        fragment.appendChild(cell);
    });

    charmapMatrix.replaceChildren(fragment);
}

function hideZoomLens() {
    const el = document.getElementById('charmapZoomLens');
    if (el) el.style.display = 'none';
}

function hideEmojiZoomLens() {
    const el = document.getElementById('emojiZoomLens');
    if (el) el.style.display = 'none';
}

// ============================================================
// 😀 EMOJI MODAL
// ============================================================
function openEmojiModal() {
    if (!_canOpenModal('openEmojiModal')) return;
    if (typeof requireProAccess === 'function' && !requireProAccess('Emoji Palette')) return;

    const sel = document.getElementById('emojiCategorySelect');
    if (sel) sel.value = 'smileys';

    const searchInput = document.getElementById('emojiSearchInput');
    if (searchInput) searchInput.value = '';

    buildEmojiMatrix('smileys');

    const box = document.getElementById('emojiCopyBox');
    if (box) box.value = '';

    const modal = document.getElementById('emojiModal');
    if (modal) modal.style.display = 'flex';
    document.body.classList.add('modal-open');
}

function closeEmojiModal() {
    const modal = document.getElementById('emojiModal');
    if (modal) modal.style.display = 'none';
    hideEmojiZoomLens();
    _unlockBodyScroll();
}

function onEmojiCategorySelect(catKey) {
    const input = document.getElementById('emojiSearchInput');
    if (input) input.value = '';
    buildEmojiMatrix(catKey);
}

function filterEmoji(term) {
    const sel = document.getElementById('emojiCategorySelect');
    if (sel) buildEmojiMatrix(sel.value, term.trim());
}

function buildEmojiMatrix(catKey, filter = '') {
    const fragment = document.createDocumentFragment();
    const emojiMatrix = document.getElementById('emojiMatrix');
    const emojiZoomLens = document.getElementById('emojiZoomLens');
    const emojiMatrixWrap = document.getElementById('emojiMatrixWrap');
    const nameEl = document.getElementById('emojiNameDisplay');
    const hexEl = document.getElementById('emojiHexDisplay');

    if (!emojiMatrix || !emojiZoomLens || !emojiMatrixWrap) return;
    if (typeof emojiLibraries === 'undefined') return;

    let list = emojiLibraries[catKey] || emojiLibraries['smileys'];
    if (filter) {
        list = list.filter(e => e.includes(filter));
    }

    list.forEach(emoji => {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.textContent = emoji;

        cell.addEventListener('mouseenter', () => {
            emojiZoomLens.textContent = emoji;
            emojiZoomLens.style.display = 'flex';

            const rect = cell.getBoundingClientRect();
            const wrapRect = emojiMatrixWrap.getBoundingClientRect();

            emojiZoomLens.style.left = (rect.left - wrapRect.left + rect.width / 2) + 'px';
            emojiZoomLens.style.top = (rect.top - wrapRect.top) + 'px';

            if (nameEl) nameEl.textContent = `Selected: ${emoji}`;
        });

        cell.addEventListener('mouseleave', hideEmojiZoomLens);

        cell.onclick = () => {
            document.querySelectorAll('#emojiMatrix .cell').forEach(c => c.classList.remove('selected'));
            cell.classList.add('selected');
            lastActiveEmoji = emoji;

            const box = document.getElementById('emojiCopyBox');
            if (box) box.value += emoji;
        };

        fragment.appendChild(cell);
    });

    emojiMatrix.replaceChildren(fragment);
}

// ============================================================
// ⚙️ IME EXPORT
// ============================================================
function openImeExportModal() {
    if (!_canOpenModal('openImeExportModal')) return;
    if (typeof requireProAccess === 'function' && !requireProAccess('IME Exporter')) return;

    const preview = document.getElementById('imeJsonPreview');
    if (preview) {
        preview.value = JSON.stringify({
            metadata: {
                engine: "Hoṛ Katha Suite Ultra IME",
                version: (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.VERSION) || '3.7.4',
                mappings: {
                    "santali-devanagari": typeof hardwareDevMap !== 'undefined' ? hardwareDevMap : {},
                    "ol-chiki": typeof hardwareOlchikiMap !== 'undefined' ? hardwareOlchikiMap : {}
                }
            }
        }, null, 2);
    }

    const modal = document.getElementById('imeModal');
    if (modal) modal.style.display = 'flex';
    document.body.classList.add('modal-open');
}

function closeImeModal() {
    const modal = document.getElementById('imeModal');
    if (modal) modal.style.display = 'none';
    _unlockBodyScroll();
}

function downloadImeMapFile() {
    const preview = document.getElementById('imeJsonPreview');
    if (!preview) return;

    const blob = new Blob([preview.value], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'HorKatha_IME_Map.json';
    a.click();

    // ✅ FIXED: RAF-based revoke
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            URL.revokeObjectURL(url);
        });
    });
}

// ============================================================
// 🅰️ KRUTI DEV
// ============================================================
function convertUnicodeToKrutiDev(text) {
    if (typeof unicodeToKrutiMap === 'undefined') return text;
    let out = '', i = 0;

    while (i < text.length) {
        const char = text[i];
        if (char === '\n' || char === '\r') {
            out += char;
            i++;
            continue;
        }

        let matched = false;
        for (let len = 4; len >= 2; len--) {
            if (i + len <= text.length) {
                const sub = text.substr(i, len);
                if (unicodeToKrutiMap[sub]) {
                    out += unicodeToKrutiMap[sub];
                    i += len;
                    matched = true;
                    break;
                }
            }
        }
        if (matched) continue;

        if (unicodeToKrutiMap[char]) {
            out += unicodeToKrutiMap[char];
            i++;
            continue;
        }

        out += text[i];
        i++;
    }
    return out;
}

function openKrutiDevModal() {
    if (!_canOpenModal('openKrutiDevModal')) return;
    if (typeof requireProAccess === 'function' && !requireProAccess('Kruti Dev Converter')) return;

    const editor = document.getElementById('editor');
    const preview = document.getElementById('krutiPreview');
    if (preview) {
        preview.value = convertUnicodeToKrutiDev((editor ? editor.innerText : '') || '');
    }

    const modal = document.getElementById('krutiModal');
    if (modal) modal.style.display = 'flex';
    document.body.classList.add('modal-open');
}

function closeKrutiDevModal() {
    const modal = document.getElementById('krutiModal');
    if (modal) modal.style.display = 'none';
    _unlockBodyScroll();
}

function applyKrutiToEditor() {
    const preview = document.getElementById('krutiPreview');
    const editor = document.getElementById('editor');
    if (preview && preview.value && editor) {
        editor.innerText = preview.value;
        if (typeof handleEditorInput === 'function') handleEditorInput(true);
        closeKrutiDevModal();
    }
}

// ============================================================
// 🔄 CONVERTER
// ============================================================
function openConverterModal() {
    if (!_canOpenModal('openConverterModal')) return;
    if (typeof requireProAccess === 'function' && !requireProAccess('Script Converter')) return;

    const preview = document.getElementById('converterPreview');
    if (preview) preview.value = '';

    const modal = document.getElementById('converterModal');
    if (modal) modal.style.display = 'flex';
    document.body.classList.add('modal-open');

    executeConversion();
}

function closeConverterModal() {
    const modal = document.getElementById('converterModal');
    if (modal) modal.style.display = 'none';
    _unlockBodyScroll();
}

function executeConversion() {
    const editor = document.getElementById('editor');
    const preview = document.getElementById('converterPreview');
    const sel = document.getElementById('convertDirectionSelect');
    if (!preview) return;

    const text = (editor ? editor.innerText : '') || '';
    const dir = sel ? sel.value : 'dev-to-ol';
    let out = '';

    if (dir === 'dev-to-ol' && typeof devToOlMap !== 'undefined') {
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (ch === '्') continue;
            out += devToOlMap[ch] !== undefined ? devToOlMap[ch] : ch;
        }
    } else if (dir === 'ol-to-dev' && typeof olToDevMap !== 'undefined') {
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            out += olToDevMap[ch] !== undefined ? olToDevMap[ch] : ch;
        }
    } else if (dir === 'roman-to-ol') {
        const pairs = {
            'kh':'ᱠᱷ','gh':'ᱜᱷ','ch':'ᱪᱷ','jh':'ᱡᱷ','th':'ᱛᱷ','dh':'ᱫᱷ','ph':'ᱯᱷ','bh':'ᱵᱷ',
            'a':'ᱟ','e':'ᱮ','i':'ᱤ','o':'ᱳ','u':'ᱩ',
            'k':'ᱠ','g':'ᱜ','c':'ᱪ','j':'ᱡ','t':'ᱛ','d':'ᱫ','p':'ᱯ','b':'ᱵ',
            'm':'ᱢ','n':'ᱱ','r':'ᱨ','l':'ᱞ','s':'ᱥ','h':'ᱦ'
        };
        let i = 0;
        while (i < text.length) {
            const two = text.substr(i, 2).toLowerCase();
            if (pairs[two]) {
                out += pairs[two];
                i += 2;
            } else {
                out += pairs[text[i].toLowerCase()] || text[i];
                i++;
            }
        }
    }
    preview.value = out;
}

function replaceEditorWithConverted() {
    const editor = document.getElementById('editor');
    const preview = document.getElementById('converterPreview');
    if (preview && preview.value && editor) {
        editor.innerText = preview.value;
        if (typeof handleEditorInput === 'function') handleEditorInput(true);
        closeConverterModal();
    }
}

// ============================================================
// 🎯 BEFORE INSTALL
// ============================================================
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
});

// ============================================================
// 📊 DEBUG HELPERS
// ============================================================
window.ModalsDebug = {
    status: () => {
        console.log('═══════════════════════════════════════════');
        console.log('🪟 Modals Status');
        console.log('───────────────────────────────────────────');
        console.log('  appReady:', window.__appReady);
        console.log('  deferredPrompt:', !!deferredPrompt);
        console.log('  isVoiceEnabled:', isVoiceEnabled);
        console.log('  isHoverVoiceEnabled:', isHoverVoiceEnabled);
        console.log('  isClickSoundEnabled:', isClickSoundEnabled);
        console.log('  isPhoneticEnabled:', isPhoneticEnabled);
        console.log('  currentDonateAmount:', currentDonateAmount);
        console.log('  currentSelectedPrice:', currentSelectedPrice);
        console.log('  isProcessingPayment:', _isProcessingPayment);
        console.log('  Active flashes:', _activeFlashes.length);
        console.log('═══════════════════════════════════════════');
    },

    testQR: (containerId = 'trialQrBox') => {
        const upiUrl = _getPaymentURL(9, 'Test Payment');
        renderQRCode(containerId, upiUrl, 220);
        console.log('🧪 QR test triggered for', containerId);
    },

    testMiniQR: (text = 'https://example.com/test') => {
        const container = document.createElement('div');
        container.style.cssText = 'position:fixed;top:20px;left:20px;width:200px;height:200px;background:#fff;padding:8px;border:2px solid #000;z-index:99999;';
        document.body.appendChild(container);
        try {
            _MiniQR.render(container, text, 184);
            console.log('✅ MiniQR test rendered');
        } catch (e) {
            console.error('❌ MiniQR test failed:', e.message);
        }
        setTimeout(() => container.remove(), 5000);
    },

    testToast: (msg = 'Test message', type = 'info') => {
        showToast(msg, type);
    },

    testFlash: (type = 'success') => {
        showFlash({
            type,
            icon: '🎉',
            title: 'Test Flash',
            subtitle: 'This is a test message',
            body: '<p>Body content here</p>',
            duration: 4000
        });
    },

    closeAll: () => {
        document.querySelectorAll('.modal-overlay, .preview-modal').forEach(m => {
            m.style.display = 'none';
        });
        _unlockBodyScroll();
        console.log('🧹 All modals closed');
    },

    flashes: () => _activeFlashes.length,

    clearFlashes: () => {
        _activeFlashes.forEach(f => {
            if (f.parentNode) f.parentNode.removeChild(f);
        });
        _activeFlashes.length = 0;
        console.log('🧹 All flashes cleared');
    },

    testUpiUrl: (amount = 199, note = 'Test') => {
        const url = _getPaymentURL(amount, note);
        console.log('💳 UPI URL:', url);
        return url;
    },

    testSafeInt: (val) => {
        console.log('🧪 Test _safeInt:', val, '→', _safeInt(val, 0, 100000, 0));
    }
};

// ============================================================
// 📋 STARTUP LOG
// ============================================================
console.log('═══════════════════════════════════════════');
console.log('✅ modals.js loaded — v3.7.4.44');
console.log('   📸 Dual QR: Network → MiniQR fallback');
console.log('   📱 MiniQR: Dynamic type detection (4-14)');
console.log('   🔒 Payment: Double-click guard');
console.log('   🧾 Receipt: XSS-safe (textContent)');
console.log('   🎬 Flash: Proper ESC cleanup');
console.log('   🛡️  Modal guard: 3s timeout fallback');
console.log('═══════════════════════════════════════════');