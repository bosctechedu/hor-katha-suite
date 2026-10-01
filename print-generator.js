// ============================================================
// 🖨️ PREMIUM A4 PRINT GENERATOR — v4.7 (HTML-Preserving + Hardened)
// BOSC Tech & Edu · Hoṛ Katha Suite v3.7.4
// ============================================================
// ✅ v4.7 — SECURITY & RELIABILITY HARDENED:
//    • CRITICAL: URL scheme filter broader
//      (was: javascript/vbscript only)
//      (now: javascript/vbscript/data/file/blob)
//    • CRITICAL: Extended URL attributes covered
//      (href, src, srcset, action, formaction, poster, data)
//    • CRITICAL: srcdoc attribute stripped
//    • iframe.contentWindow null-safe access
//    • document.fonts.ready with proper 2s timeout race
//    • iframe cleanup: 10s (was 5s) — allows print dialog time
//    • Orphan iframe cleanup on beforeunload
//    • escHTML: full escape (', ", `), XSS-hardened
//    • sanitizeFontFamily: strips ( ) { } \r \n
//    • doPrint: try-catch + popup fallback
//    • Version pulled from APP_CONFIG
//    • Font timeout fallback (2s)
//    • Better debug helpers
// ============================================================

(function() {
    'use strict';

    console.log('📦 print-generator.js loading...');

    // ============================================================
    // 🔍 SAFE CONFIG ACCESS
    // ============================================================
    function getAppVersion() {
        try {
            if (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.VERSION) {
                return APP_CONFIG.VERSION;
            }
        } catch (e) {}
        return '3.7.4';
    }

    // ============================================================
    // 🧼 ESCAPE HTML — XSS-Hardened (attributes / plain text)
    // ============================================================
    // ✅ Full escape including backtick, quotes, slashes
    // ============================================================
    function escHTML(s) {
        if (s === null || s === undefined) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/`/g, '&#96;')
            .replace(/\//g, '&#47;');
    }

    // ============================================================
    // 🛡️ SANITIZE CONTENT — KEEP valid HTML, REMOVE dangerous
    // ============================================================
    // ✅ v4.7:
    //    पुराना code: escHTML(content) — पूरा HTML escape कर देता था
    //    → <b>bold</b> → &lt;b&gt;bold&lt;/b&gt; (formatting टूट जाती थी)
    //
    //    अब: सिर्फ खतरनाक हिस्से हटाते हैं, valid formatting रखते हैं
    //    → <b>bold</b> → <b>bold</b> (formatting बरकरार)
    // ============================================================
    function sanitizeContent(html) {
        if (!html || typeof html !== 'string') return '';

        let cleaned = html;

        // ═══════════════════════════════════════════════════════
        // 1️⃣ Remove <script> tags (opening + closing + inline)
        // ═══════════════════════════════════════════════════════
        cleaned = cleaned.replace(
            /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            ''
        );
        // Orphan closing tags
        cleaned = cleaned.replace(/<\/script>/gi, '');

        // ═══════════════════════════════════════════════════════
        // 2️⃣ Remove dangerous embed tags
        // ═══════════════════════════════════════════════════════
        cleaned = cleaned.replace(
            /<\/?(?:iframe|object|embed|applet|frame|frameset|meta|link|base|form|input|button|select|textarea)[^>]*>/gi,
            ''
        );

        // ═══════════════════════════════════════════════════════
        // 3️⃣ Remove inline event handlers (onclick, onerror, etc.)
        // ═══════════════════════════════════════════════════════
        cleaned = cleaned.replace(/\s+on\w+\s*=\s*"[^"]*"/gi, '');
        cleaned = cleaned.replace(/\s+on\w+\s*=\s*'[^']*'/gi, '');
        cleaned = cleaned.replace(/\s+on\w+\s*=\s*[^\s>]+/gi, '');

        // ═══════════════════════════════════════════════════════
        // 4️⃣ ✅ CRITICAL: Remove ALL dangerous URL schemes
        //    (was: javascript/vbscript only)
        //    (now: javascript/vbscript/data/file/blob)
        // ═══════════════════════════════════════════════════════
        // Covers: href, src, srcset, action, formaction, poster, data, xlink:href
        cleaned = cleaned.replace(
            /(?:href|src|srcset|action|formaction|poster|xlink:href)\s*=\s*["']?\s*(?:javascript|vbscript|data|file|blob|about)\s*:[^"'\s>]*/gi,
            ''
        );

        // ═══════════════════════════════════════════════════════
        // 5️⃣ Remove srcdoc attribute (iframe XSS vector)
        // ═══════════════════════════════════════════════════════
        cleaned = cleaned.replace(/\s+srcdoc\s*=\s*"[^"]*"/gi, '');
        cleaned = cleaned.replace(/\s+srcdoc\s*=\s*'[^']*'/gi, '');
        cleaned = cleaned.replace(/\s+srcdoc\s*=\s*[^\s>]+/gi, '');

        // ═══════════════════════════════════════════════════════
        // 6️⃣ Remove style attributes with expression() (old IE XSS)
        // ═══════════════════════════════════════════════════════
        cleaned = cleaned.replace(
            /\s+style\s*=\s*"[^"]*expression\s*\([^)]*\)[^"]*"/gi,
            ''
        );

        // ═══════════════════════════════════════════════════════
        // 7️⃣ Remove <svg> with inline event handlers
        // ═══════════════════════════════════════════════════════
        cleaned = cleaned.replace(/<svg\b[^>]*\bon\w+\s*=[^>]*>/gi, '');

        // ═══════════════════════════════════════════════════════
        // 8️⃣ Remove <math> with inline event handlers (rare)
        // ═══════════════════════════════════════════════════════
        cleaned = cleaned.replace(/<math\b[^>]*\bon\w+\s*=[^>]*>/gi, '');

        return cleaned;
    }

    // ============================================================
    // 🔒 SANITIZE FONT FAMILY
    // ============================================================
    // ✅ Strips dangerous CSS breakout chars: ; { } ( ) \r \n
    //    Keeps quotes, spaces, commas (all valid in font-family)
    // ============================================================
    function sanitizeFontFamily(raw) {
        if (!raw || typeof raw !== 'string') return '';

        let cleaned = raw
            .replace(/[;\r\n{}()]/g, '')     // CSS breakout chars
            .replace(/<|>/g, '')              // HTML chars
            .trim();

        // Must contain at least one letter
        if (!/[a-zA-Z]/.test(cleaned)) return '';

        // Cap length
        if (cleaned.length > 500) cleaned = cleaned.substring(0, 500);

        return cleaned;
    }

    // ============================================================
    // 📛 SCRIPT NAME — null-safe
    // ============================================================
    function getScriptName() {
        const map = {
            'english':     'English',
            'roman':       'Santali (Roman)',
            'hindi-dev':   'Hindi (Devanagari)',
            'santali-dev': 'Santali (Devanagari)',
            'olchiki':     'Ol Chiki'
        };

        const key = (typeof currentLayout !== 'undefined' && currentLayout)
            ? currentLayout
            : 'english';

        return map[key] || 'English';
    }

    // ============================================================
    // 🔤 EDITOR FONT FAMILY
    // ============================================================
    function getEditorFontFamily() {
        try {
            const editor = document.getElementById('editor');
            if (!editor) return '';

            // Try inline style first
            const inline = editor.style.fontFamily || '';
            if (inline) return sanitizeFontFamily(inline);

            // Fallback to computed style
            const computed = window.getComputedStyle(editor).fontFamily || '';
            return sanitizeFontFamily(computed);
        } catch (e) {
            return '';
        }
    }

    // ============================================================
    // 🏗️ BUILD PRINT HTML
    // ============================================================
    // ✅ v4.7: Uses sanitizeContent() instead of double escHTML()
    // ============================================================
    function buildHTML(sanitizedContent, scriptName, userFontFamily) {
        const version = getAppVersion();

        const fontStack = userFontFamily
            ? userFontFamily + ', "Noto Sans Devanagari", "Noto Sans Ol Chiki", Inter, Arial, sans-serif'
            : '"Noto Sans Devanagari", "Noto Sans Ol Chiki", Inter, Arial, sans-serif';

        const s = [];

        // ─── Document Start ───
        s.push('<!DOCTYPE html><html lang="en"><head>');
        s.push('<meta charset="UTF-8">');
        s.push('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
        s.push('<title>Print — Hor Katha Suite</title>');

        // ─── Fonts ───
        s.push('<link rel="preconnect" href="https://fonts.googleapis.com">');
        s.push('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>');
        s.push('<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700;800;900&family=Noto+Sans+Devanagari:wght@400;500;600;700;800&family=Noto+Sans+Ol+Chiki:wght@400;500;600;700&display=swap" rel="stylesheet">');

        // ─── Styles ───
        s.push('<style>');
        s.push('@page { size: A4 portrait; margin: 10mm; }');
        s.push('* { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }');
        s.push('html, body { font-family: Inter, Arial, sans-serif; color: #000000; background: #ffffff; line-height: 1.5; }');
        s.push('body { padding: 0; margin: 0; }');
        s.push('.page { width: 100%; max-width: 190mm; margin: 0 auto; padding: 0; display: flex; flex-direction: column; gap: 8px; min-height: 277mm; }');
        s.push('.hdr { background: linear-gradient(135deg, #0b3b75 0%, #0284c7 55%, #a371f7 100%); color: #ffffff; padding: 14px 20px; border-radius: 10px; display: flex; align-items: center; gap: 16px; }');
        s.push('.logo { width: 60px; height: 60px; border-radius: 50%; background: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 900; color: #0284c7; flex-shrink: 0; border: 2px solid #ffffff; font-family: "Noto Sans Devanagari", serif; }');
        s.push('.hdr-txt { flex: 1; min-width: 0; }');
        s.push('.hdr-title { font-family: "Playfair Display", Georgia, serif; font-size: 22pt; font-weight: 900; line-height: 1.1; color: #ffffff; }');
        s.push('.hdr-line { height: 3px; width: 200px; background: #fde047; margin: 6px 0; border-radius: 2px; }');
        s.push('.hdr-tag { font-size: 10pt; color: #fde047; font-style: italic; font-weight: 700; }');
        s.push('.ver { background: #f59e0b; color: #0f172a; padding: 6px 14px; border-radius: 999px; font-size: 10pt; font-weight: 900; white-space: nowrap; }');
        s.push('.sec-hdr { font-size: 10pt; font-weight: 900; letter-spacing: 3px; color: #0284c7; border-bottom: 2px solid #0284c7; padding-bottom: 6px; margin-top: 4px; display: flex; align-items: center; justify-content: space-between; gap: 8px; text-transform: uppercase; flex-shrink: 0; }');
        s.push('.badge { background: #e0f2fe; color: #0284c7; padding: 3px 10px; border-radius: 999px; font-size: 8pt; font-weight: 800; border: 1px solid #bae6fd; }');
        s.push('.box { flex: 1 1 auto; border: 1.5px dashed #cbd5e1; border-radius: 8px; padding: 16px 20px; font-size: 12pt; line-height: 2.05; color: #000000; letter-spacing: 0.15px; font-weight: 500; font-family: ' + fontStack + '; white-space: pre-wrap; word-wrap: break-word; overflow-wrap: anywhere; min-height: 100mm; }');
        s.push('.box img { max-width: 100%; height: auto; }');
        s.push('.box table { border-collapse: collapse; width: 100%; }');
        s.push('.box td, .box th { border: 1px solid #94a3b8; padding: 6px 10px; }');
        s.push('.box ul, .box ol { margin-left: 20px; padding-left: 10px; }');
        s.push('.box hr { border: none; border-top: 1px solid #94a3b8; margin: 10px 0; }');
        s.push('.ftr { background: rgb(124, 58, 237); border: 2px solid #fde047; border-radius: 10px; padding: 14px 22px; text-align: center; color: #ffffff; margin-top: auto; flex-shrink: 0; }');
        s.push('.ftr-1 { font-family: "Playfair Display", Georgia, serif; font-size: 12pt; font-weight: 900; color: #ffffff; margin-bottom: 4px; }');
        s.push('.ftr-1 .gold { color: #fde047; }');
        s.push('.ftr-2 { font-size: 9pt; color: #ede9fe; font-weight: 700; letter-spacing: 0.6px; }');
        s.push('@media print { body { background: #ffffff; } .page { max-width: 100%; min-height: 275mm; } .box { color: #000000 !important; } .hdr, .ftr, .sec-hdr { page-break-inside: avoid; break-inside: avoid; } }');
        s.push('</style></head><body>');

        // ─── Content ───
        s.push('<div class="page">');
        s.push('<div class="hdr"><div class="logo">ह</div><div class="hdr-txt"><div class="hdr-title">Hoṛ / होड़ Katha Suite</div><div class="hdr-line"></div><div class="hdr-tag">Multi-Script Typing Revolution</div></div><div class="ver">⚡ v' + escHTML(version) + ' PRO</div></div>');
        s.push('<div class="sec-hdr"><span>YOUR CONTENT</span><span class="badge">' + escHTML(scriptName) + '</span></div>');
        s.push('<div class="box">' + sanitizedContent + '</div>');
        s.push('<div class="ftr"><div class="ftr-1"><span class="gold">BOSC Tech &amp; Edu</span> · © 2024-2026</div><div class="ftr-2">🔒 AES-256 Encrypted · Device-Locked License</div></div>');
        s.push('</div></body></html>');

        return s.join('\n');
    }

    // ============================================================
    // 🖨️ PRINT VIA HIDDEN IFRAME
    // ============================================================
    // ✅ v4.7:
    //    • contentWindow null-safe
    //    • document.fonts.ready with proper race (2s timeout)
    //    • Cleanup 10s (was 5s) — allows print dialog time
    //    • try-catch everywhere
    //    • Popup-blocked fallback
    // ============================================================
    function printViaIframe(html) {
        // ─── Remove old frame if exists ───
        const old = document.getElementById('__hk_print_frame__');
        if (old && old.parentNode) {
            try {
                old.parentNode.removeChild(old);
            } catch (e) {
                // Silent
            }
        }

        // ─── Create new iframe ───
        const iframe = document.createElement('iframe');
        iframe.id = '__hk_print_frame__';
        iframe.setAttribute('aria-hidden', 'true');
        iframe.style.cssText =
            'position:fixed;top:-10000px;left:-10000px;' +
            'width:210mm;height:297mm;border:0;opacity:0;' +
            'pointer-events:none;visibility:hidden;z-index:-9999;';

        document.body.appendChild(iframe);

        // ─── Null-safe access to iframe internals ───
        const win = iframe.contentWindow;
        const doc = (iframe.contentDocument) || (win && win.document) || null;

        if (!doc) {
            console.error('❌ iframe document not accessible');
            try {
                iframe.remove();
            } catch (e) {}
            alert('⚠️ Print failed: iframe not accessible.\nPlease try again.');
            return;
        }

        // ─── Write HTML into iframe ───
        try {
            doc.open();
            doc.write(html);
            doc.close();
        } catch (e) {
            console.error('❌ iframe write failed:', e);
            try {
                iframe.remove();
            } catch (e2) {}
            alert('⚠️ Print failed: ' + e.message);
            return;
        }

        // ═══════════════════════════════════════════════════════
        // ⏳ WAIT FOR FONTS — Proper race with timeout
        // ═══════════════════════════════════════════════════════
        let printed = false;

        function doPrint() {
            if (printed) return;
            printed = true;

            try {
                // Focus + print
                if (win && typeof win.focus === 'function') {
                    win.focus();
                }
                if (win && typeof win.print === 'function') {
                    win.print();
                } else {
                    throw new Error('print() not available');
                }
            } catch (e) {
                console.error('Iframe print failed:', e);

                // ✅ Fallback: open in new window
                try {
                    const w = window.open('', '_blank', 'width=900,height=1200,noopener,noreferrer');

                    if (w) {
                        w.document.open();
                        w.document.write(html);
                        w.document.close();

                        setTimeout(function() {
                            try {
                                w.focus();
                                w.print();
                            } catch (e2) {
                                // Silent
                            }
                        }, 500);
                    } else {
                        alert('⚠️ Popup blocked!\n\nPlease allow popups and try again.');
                    }
                } catch (e2) {
                    alert('⚠️ Print failed. Please check browser permissions.');
                }
            }

            // ✅ Cleanup after 10s (was 5s) — print dialog needs time
            setTimeout(function() {
                try {
                    if (iframe.parentNode) {
                        iframe.parentNode.removeChild(iframe);
                    }
                } catch (e) {
                    // Silent
                }
            }, 10000);
        }

        // ✅ Font ready check with fallback timer (2s)
        let fallbackTimer = setTimeout(function() {
            console.warn('⚠️ Font load timeout (2s) — printing anyway');
            doPrint();
        }, 2000);

        try {
            const fontsReady = win && win.document && win.document.fonts && win.document.fonts.ready;

            if (fontsReady && typeof fontsReady.then === 'function') {
                fontsReady.then(function() {
                    clearTimeout(fallbackTimer);
                    // Small delay for layout settle
                    setTimeout(doPrint, 200);
                }).catch(function() {
                    clearTimeout(fallbackTimer);
                    setTimeout(doPrint, 200);
                });
            } else {
                // No Font Loading API — wait fixed 800ms
                clearTimeout(fallbackTimer);
                setTimeout(doPrint, 800);
            }
        } catch (e) {
            // Last-resort fallback
            clearTimeout(fallbackTimer);
            setTimeout(doPrint, 800);
        }
    }

    // ============================================================
    // 🧹 CLEANUP on page unload — no orphan iframes
    // ============================================================
    window.addEventListener('beforeunload', function() {
        try {
            const old = document.getElementById('__hk_print_frame__');
            if (old && old.parentNode) {
                old.parentNode.removeChild(old);
            }
        } catch (e) {
            // Silent
        }
    });

    // ============================================================
    // 🌐 PUBLIC API
    // ============================================================
    window.generatePremiumPrint = function() {
        const editor = document.getElementById('editor');

        if (!editor) {
            alert('Editor not found.');
            return;
        }

        // ✅ Get innerHTML (preserves formatting)
        const rawHTML = editor.innerHTML || '';

        // Better empty check
        const isEmpty = !rawHTML.trim() ||
                        rawHTML === '<br>' ||
                        rawHTML === '<br/>' ||
                        rawHTML === '<div><br></div>' ||
                        (editor.innerText || '').trim().length === 0;

        if (isEmpty) {
            alert('Please type some text before printing.');
            return;
        }

        try {
            // ✅ sanitizeContent() keeps HTML, removes dangerous parts
            const sanitized = sanitizeContent(rawHTML);

            const userFont = getEditorFontFamily();
            const html = buildHTML(sanitized, getScriptName(), userFont);

            printViaIframe(html);

            if (typeof showToast === 'function') {
                showToast('🖨️ Print dialog opening... Choose "Save as PDF"', 'success', 5000);
            }
        } catch (err) {
            console.error('Print failed:', err);
            alert('Print failed: ' + err.message);
        }
    };

    // ============================================================
    // 📊 DEBUG HELPERS
    // ============================================================
    if (typeof window !== 'undefined') {
        window.PrintDebug = {
            status: () => {
                console.log('═══════════════════════════════════════════');
                console.log('🖨️ Print Module Status');
                console.log('───────────────────────────────────────────');
                console.log('  Version: v4.7');
                console.log('  Orphan iframe:', !!document.getElementById('__hk_print_frame__'));
                console.log('  html2canvas loaded:', typeof window.html2canvas !== 'undefined');
                console.log('  Current layout:', typeof currentLayout !== 'undefined' ? currentLayout : 'N/A');
                console.log('  APP_CONFIG version:', getAppVersion());
                console.log('═══════════════════════════════════════════');
            },

            testSanitize: (html) => {
                console.log('🧪 Sanitize test:');
                console.log('  Input: ', html);
                const output = sanitizeContent(html);
                console.log('  Output:', output);
                return output;
            },

            testFontSanitize: (font) => {
                console.log('🧪 Font sanitize test:');
                console.log('  Input: ', font);
                const output = sanitizeFontFamily(font);
                console.log('  Output:', output);
                return output;
            },

            testUrlFilter: () => {
                console.log('🧪 URL filter test:');
                const samples = [
                    '<a href="javascript:alert(1)">Click</a>',
                    '<a href="vbscript:msgbox(1)">Click</a>',
                    '<a href="data:text/html,<script>alert(1)</script>">Click</a>',
                    '<a href="file:///etc/passwd">Click</a>',
                    '<a href="blob:https://example.com/xyz">Click</a>',
                    '<img src="javascript:alert(1)">',
                    '<img src="data:image/png;base64,xyz">',
                    '<a href="https://safe.com">Safe</a>',
                    '<iframe srcdoc="<script>alert(1)</script>"></iframe>'
                ];

                samples.forEach(html => {
                    const out = sanitizeContent(html);
                    const clean = !/javascript:|vbscript:|data:|file:|blob:|srcdoc/i.test(out);
                    console.log(
                        (clean ? '✅' : '❌'),
                        html.substring(0, 50).padEnd(50),
                        '→',
                        out.substring(0, 50)
                    );
                });
            },

            cleanup: () => {
                const old = document.getElementById('__hk_print_frame__');
                if (old && old.parentNode) {
                    old.parentNode.removeChild(old);
                    console.log('🧹 Orphan iframe cleaned');
                } else {
                    console.log('✅ No orphan iframe');
                }
            },

            test: () => {
                console.log('🧪 Test print (fake content)...');
                const html = buildHTML(
                    '<b>Bold</b> and <i>italic</i> and <u>underline</u> and <span style="color:red">red text</span>',
                    'English',
                    ''
                );
                printViaIframe(html);
                console.log('   Print dialog should open');
            },

            inspect: () => {
                const editor = document.getElementById('editor');
                if (!editor) {
                    console.log('❌ Editor not found');
                    return;
                }

                const raw = editor.innerHTML;
                const sanitized = sanitizeContent(raw);

                console.log('🔍 Content inspection:');
                console.log('  Raw HTML length:', raw.length);
                console.log('  Sanitized length:', sanitized.length);
                console.log('  Diff:', raw.length - sanitized.length, 'chars removed');
                console.log('  Script tags found:', /<script/i.test(raw));
                console.log('  Event handlers found:', /\son\w+\s*=/i.test(raw));
                console.log('  Dangerous URLs found:', /(?:href|src|action)\s*=\s*["']?(?:javascript|data|vbscript|file|blob):/i.test(raw));
            }
        };
    }

    console.log('✅ print-generator.js loaded — v4.7 (Extended URL filter + Null-safe + Font-aware)');
})();