// ============================================================
// ⌨️ VIRTUAL KEYBOARD SYSTEM — Trial-Aware + Conflict-Free
// BOSC Tech & Edu · Hoṛ Katha Suite v3.7.4 Pro Ultra
// ============================================================
// ✅ v3.7.4.45 — CONFLICT-FREE FIXES:
//    • REMOVED duplicate hasProLevelAccess (uses license.js)
//    • No duplicate `let` declarations (all in IIFE)
//    • Everything wrapped in IIFE for isolation
//    • Exposes only necessary globals via window.*
//    • Prevents "already declared" SyntaxError
// ============================================================

(function() {
    'use strict';

    // ─── Safe Guard: Skip if already loaded ───
    if (window.__keyboardLoaded) {
        console.log('⚠️ keyboard.js already loaded — skipping');
        return;
    }
    window.__keyboardLoaded = true;

    console.log('📦 keyboard.js loading...');

    // ============================================================
    // 📊 GLOBAL STATE — wrapped in namespace to avoid conflicts
    // ============================================================
    const KB = {
        currentLayout: 'english',
        isShift: false,
        isCaps: false,
        isNumpadActive: false,
        keyboardMode: 'virtual',
        userVocabDB: {},
        _olchikiReverseMap: null,
        _switchInProgress: false,
        _lastHoverSpeechTime: 0,
        _typingModeDebounce: null,
        _scrollDebounce: null
    };

    // ─── Load keyboard mode from storage ───
    try {
        KB.keyboardMode = localStorage.getItem('hor_kb_mode') || 'virtual';
    } catch (e) {
        console.warn('⚠️ localStorage read blocked');
        KB.keyboardMode = 'virtual';
    }

    // ─── Load user vocab ───
    try {
        const raw = localStorage.getItem('hor_user_vocab_db');
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                Object.keys(parsed).forEach(key => {
                    if (Array.isArray(parsed[key])) {
                        KB.userVocabDB[key] = parsed[key];
                    }
                });
            }
        }
    } catch (e) {
        console.warn('⚠️ userVocabDB parse failed');
        KB.userVocabDB = {};
    }

    // ============================================================
    // ⚙️ CONSTANTS
    // ============================================================
    const VOCAB_MAX_PER_LANG = 1000;
    const KEYBOARD_LANGUAGES = ['english', 'roman', 'hindi-dev', 'santali-dev', 'olchiki'];
    const HOVER_SPEECH_THROTTLE_MS = 300;

    // ============================================================
    // 🔐 Pro Access — Uses license.js version
    // ============================================================
    // ✅ FIXED: Don't redefine! Just use existing or provide safe fallback
    function _getProAccess() {
        // Try existing global first
        try {
            if (typeof hasProLevelAccess === 'function') {
                return hasProLevelAccess();
            }
        } catch (e) {}

        // Fallback: check localStorage directly
        try {
            const licKey = localStorage.getItem('hor_lic_key');
            const trialKey = localStorage.getItem('hor_trial_key');
            if (licKey && licKey.startsWith('HKP-')) return true;
            if (trialKey && trialKey.startsWith('HKT-')) return true;
        } catch (e) {}

        return false;
    }

    // ============================================================
    // 🎨 XSS-Safe HTML escape
    // ============================================================
    function _escapeKeyboardHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/`/g, '&#96;')
            .replace(/\//g, '&#47;');
    }

    // ============================================================
    // 🔒 Ol Chiki Reverse Map (eager build)
    // ============================================================
    function _buildOlchikiReverseMap() {
        if (KB._olchikiReverseMap) return KB._olchikiReverseMap;

        KB._olchikiReverseMap = {};
        try {
            if (typeof hardwareOlchikiMap !== 'undefined') {
                Object.keys(hardwareOlchikiMap).forEach(k => {
                    const v = hardwareOlchikiMap[k];
                    if (v && !KB._olchikiReverseMap[v]) {
                        KB._olchikiReverseMap[v] = k;
                    }
                });
            }
        } catch (e) {}
        return KB._olchikiReverseMap;
    }

    // ============================================================
    // ⌨️ DRAW KEYBOARD
    // ============================================================
    function drawKeyboard() {
        const keyboard = document.getElementById('keyboard');
        if (!keyboard) {
            console.warn('⚠️ Keyboard element not found');
            return;
        }

        if (typeof baseLayouts === 'undefined') {
            console.warn('⚠️ baseLayouts not loaded');
            return;
        }

        const fragment = document.createDocumentFragment();
        const layoutObj = baseLayouts[KB.currentLayout] || baseLayouts['english'];

        if (!layoutObj) {
            console.warn('⚠️ Layout not found:', KB.currentLayout);
            return;
        }

        const rows = (KB.isShift || KB.isCaps) ? layoutObj.shift : layoutObj.normal;

        if (!rows || !Array.isArray(rows)) {
            console.warn('⚠️ Rows not found');
            return;
        }

        rows.forEach((row, rIdx) => {
            if (!Array.isArray(row)) return;

            const rowDiv = document.createElement('div');
            rowDiv.className = 'key-row';

            row.forEach(k => {
                if (k === undefined || k === null) return;

                const btn = document.createElement('button');
                btn.className = 'key';
                btn.setAttribute('data-key', k);
                btn.setAttribute('data-hint', getKeyHint(k));
                btn.onmousedown = (e) => e.preventDefault();
                btn.addEventListener('mouseenter', () => handleHoverSpeech(k));

                if (rIdx === 0) btn.classList.add('key-func');

                if (k === 'BACKSPACE') {
                    btn.textContent = '⌫ Del';
                    btn.classList.add('key-func', 'key-side');
                    btn.onclick = () => {
                        if (typeof doBackspace === 'function') doBackspace();
                    };
                }
                else if (k === 'SPACE') {
                    btn.textContent = 'Space Bar';
                    btn.classList.add('key-space', 'key-func');
                    btn.onclick = () => {
                        if (typeof addCharWithPhonics === 'function') addCharWithPhonics(' ');
                    };
                }
                else if (k === 'ENTER') {
                    btn.textContent = '↵ Enter';
                    btn.classList.add('key-func', 'key-side');
                    btn.onclick = () => {
                        if (typeof addCharWithPhonics === 'function') addCharWithPhonics('\n');
                    };
                }
                else if (k === 'SHIFT') {
                    btn.textContent = '⇧ Shift';
                    btn.classList.add('key-func', 'key-side');
                    if (KB.isShift) btn.classList.add('active-lock');
                    btn.onclick = toggleShift;
                }
                else if (k === 'CAPS') {
                    btn.textContent = 'Caps';
                    btn.classList.add('key-func');
                    if (KB.isCaps) btn.classList.add('active-lock');
                    btn.onclick = toggleCaps;
                }
                else if (k === 'LANG_SWITCH') {
                    btn.textContent = '🌐 Switch';
                    btn.classList.add('key-func', 'key-side');
                    btn.onclick = () => {
                        if (typeof playKeyClickSound === 'function') playKeyClickSound();
                        if (typeof speakLetter === 'function') speakLetter('Language');
                        cycleNextLanguage();
                    };
                }
                else if (k === 'ALTGR') {
                    btn.textContent = 'AltGr';
                    btn.classList.add('key-func');
                }
                else if (['TAB', 'CTRL', 'ALT', 'UP', 'DOWN', 'LEFT', 'RIGHT'].includes(k)) {
                    btn.textContent = k;
                    btn.classList.add('key-func');
                    if (k === 'TAB') {
                        btn.onclick = () => {
                            if (typeof addCharWithPhonics === 'function') addCharWithPhonics('\t');
                        };
                    }
                }
                else if (['ESC', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'].includes(k)) {
                    btn.textContent = k;
                    btn.classList.add('key-func');
                    btn.onclick = () => {
                        if (typeof playKeyClickSound === 'function') playKeyClickSound();
                    };
                }
                else {
                    btn.textContent = k;
                    btn.onclick = () => {
                        if (typeof addCharWithPhonics === 'function') addCharWithPhonics(k);
                        if (KB.isShift && !KB.isCaps) {
                            KB.isShift = false;
                            drawKeyboard();
                        }
                    };
                }

                rowDiv.appendChild(btn);
            });
            fragment.appendChild(rowDiv);
        });

        keyboard.replaceChildren(fragment);
        console.log('✅ Keyboard rendered:', KB.currentLayout, '-', keyboard.children.length, 'rows');
    }

    // ============================================================
    // 🔢 DRAW NUMPAD
    // ============================================================
    function drawNumpad() {
        const keyboardNumpad = document.getElementById('keyboardNumpad');
        if (!keyboardNumpad) return;

        const defaultNumpad = [['7', '8', '9'], ['4', '5', '6'], ['1', '2', '3'], ['0', '.', '⌫']];
        const digits = (typeof numpadLayouts !== 'undefined' && numpadLayouts[KB.currentLayout])
            ? numpadLayouts[KB.currentLayout]
            : defaultNumpad;

        const fragment = document.createDocumentFragment();

        digits.forEach(row => {
            if (!Array.isArray(row)) return;

            const rDiv = document.createElement('div');
            rDiv.className = 'key-row';

            row.forEach(val => {
                const btn = document.createElement('button');
                btn.className = 'key';
                btn.setAttribute('data-key', val);
                btn.textContent = val;
                btn.onmousedown = (e) => e.preventDefault();
                btn.addEventListener('mouseenter', () => handleHoverSpeech(val));
                btn.onclick = () => {
                    if (val === '⌫') {
                        if (typeof doBackspace === 'function') doBackspace();
                    } else {
                        if (typeof addCharWithPhonics === 'function') addCharWithPhonics(val);
                    }
                };
                rDiv.appendChild(btn);
            });
            fragment.appendChild(rDiv);
        });

        keyboardNumpad.replaceChildren(fragment);

        const names = {
            'olchiki': 'Ol Chiki (᱐-᱙)',
            'hindi-dev': 'Devanagari (०-९)',
            'santali-dev': 'Devanagari (०-९)',
            'roman': 'English (0-9)',
            'english': 'English (0-9)'
        };
        const numpadScriptTag = document.getElementById('numpad-script-tag');
        if (numpadScriptTag) {
            numpadScriptTag.textContent = `Numpad: ${names[KB.currentLayout] || names['english']}`;
        }
    }

    // ============================================================
    // 🔢 TOGGLE NUMPAD
    // ============================================================
    function toggleNumpad() {
        KB.isNumpadActive = !KB.isNumpadActive;

        const keyboardNumpad = document.getElementById('keyboardNumpad');
        if (keyboardNumpad) keyboardNumpad.classList.toggle('active', KB.isNumpadActive);

        const btn = document.getElementById('btn-numpad-toggle');
        if (btn) btn.classList.toggle('active-state', KB.isNumpadActive);

        if (KB.isNumpadActive) drawNumpad();
    }

    // ============================================================
    // ⇧ SHIFT / CAPS
    // ============================================================
    function toggleShift() {
        if (typeof playKeyClickSound === 'function') playKeyClickSound();
        KB.isShift = !KB.isShift;
        drawKeyboard();
    }

    function toggleCaps() {
        if (typeof playKeyClickSound === 'function') playKeyClickSound();
        KB.isCaps = !KB.isCaps;
        KB.isShift = KB.isCaps;
        drawKeyboard();
    }

    // ============================================================
    // ✨ FLASH KEY VISUAL
    // ============================================================
    function flashKeyVisual(keyChar) {
        try {
            if (typeof CSS !== 'undefined' && CSS.escape) {
                const selector = `.key[data-key="${CSS.escape(keyChar)}"]`;
                document.querySelectorAll(selector).forEach(k => {
                    k.classList.add('key-active');
                    setTimeout(() => k.classList.remove('key-active'), 100);
                });
            } else {
                document.querySelectorAll('.key').forEach(k => {
                    if (k.getAttribute('data-key') === keyChar) {
                        k.classList.add('key-active');
                        setTimeout(() => k.classList.remove('key-active'), 100);
                    }
                });
            }
        } catch (e) {}
    }

    // ============================================================
    // 💡 KEY HINT
    // ============================================================
    function getKeyHint(keyChar) {
        if (!keyChar) return '';

        if (/^F\d+$/.test(keyChar)) return 'Fn';
        if (keyChar === 'ESC') return 'Esc';
        if (keyChar === 'TAB') return 'Tab';
        if (keyChar === 'CAPS') return 'Caps';
        if (keyChar === 'SHIFT') return 'Shift';
        if (keyChar === 'BACKSPACE') return 'Backspace';
        if (keyChar === 'ENTER') return 'Enter';
        if (keyChar === 'SPACE') return 'Space';
        if (keyChar === 'LANG_SWITCH') return 'Switch';
        if (keyChar === 'ALTGR') return 'AltGr';
        if (keyChar === 'CTRL') return 'Ctrl';
        if (keyChar === 'ALT') return 'Alt';

        if (typeof symbolPhonics !== 'undefined' && symbolPhonics[keyChar]) {
            return `Symbol: ${keyChar}`;
        }

        if (KB.currentLayout === 'roman') {
            if (keyChar === 'ñ') return 'Alt+N';
            if (keyChar === 'Ñ') return 'Shift+N';
            return `Key: ${keyChar}`;
        }

        if (KB.currentLayout === 'olchiki') {
            const reverseMap = _buildOlchikiReverseMap();
            return `Key: ${reverseMap[keyChar] || keyChar}`;
        }

        if (typeof devMapHints !== 'undefined' && devMapHints[keyChar]) {
            return `Key: ${devMapHints[keyChar]}`;
        }

        return `Key: ${keyChar}`;
    }

    // ============================================================
    // 🎤 HOVER SPEECH — throttled
    // ============================================================
    function handleHoverSpeech(ch) {
        if (typeof isHoverVoiceEnabled === 'undefined' || !isHoverVoiceEnabled) return;

        const now = Date.now();
        if (now - KB._lastHoverSpeechTime < HOVER_SPEECH_THROTTLE_MS) return;
        KB._lastHoverSpeechTime = now;

        if (typeof speakLetter === 'function') {
            speakLetter(ch);
        }
    }

    // ============================================================
    // 🎨 MODIFIERS PANEL
    // ============================================================
    function renderModifiersPanel() {
        const container = document.getElementById('modifiers-container');
        const title = document.getElementById('modifiers-panel-title');
        if (!container) return;

        const titles = {
            'santali-dev': 'संताली देवनागरी संयुक्ताक्षर व मात्राएँ:',
            'hindi-dev': 'हिन्दी देवनागरी संयुक्ताक्षर व मात्राएँ:',
            'olchiki': 'संताली ओ़लचिकी चिह्नों व संख्या:',
            'roman': 'Roman Santali Accents, Diacritics & Modifiers:',
            'english': 'English Symbols, Typography & Currency:'
        };
        if (title) title.textContent = titles[KB.currentLayout] || 'Modifiers & Conjuncts:';

        const items = (typeof languageModifiersDB !== 'undefined' && languageModifiersDB[KB.currentLayout])
            ? languageModifiersDB[KB.currentLayout]
            : (typeof languageModifiersDB !== 'undefined' ? languageModifiersDB['english'] : []);

        if (!Array.isArray(items)) return;

        const fragment = document.createDocumentFragment();

        items.forEach(item => {
            if (!item) return;

            const btn = document.createElement('button');
            btn.className = 'key-dia';
            btn.setAttribute('data-hint', item.hint || item.char || '');
            btn.textContent = item.label || item.char || '';
            btn.onmousedown = (e) => e.preventDefault();
            btn.onmouseenter = () => handleHoverSpeech(item.char || '');
            btn.onclick = () => {
                if (typeof addCharWithPhonics === 'function') {
                    addCharWithPhonics(item.char || '');
                }
            };
            fragment.appendChild(btn);
        });

        container.replaceChildren(fragment);
    }

    // ============================================================
    // 🗺️ MAPPING GUIDE
    // ============================================================
    function renderMappingGuide() {
        const mappingInfo = document.getElementById('mapping-info');
        if (!mappingInfo) return;

        const fragment = document.createDocumentFragment();
        let guide = [];

        if (KB.currentLayout === 'english') {
            guide = [
                { k: 'A-Z, 0-9', v: 'Physical Keys' },
                { k: 'Symbols', v: '`~@#$%^&*()' },
                { k: '/jh', v: 'Johar' },
                { k: '/sg', v: 'Sagun Daram' },
                { k: '/hl', v: 'Hello' }
            ];
        } else if (KB.currentLayout === 'roman') {
            guide = [
                { k: 'Alt+N', v: 'ñ' },
                { k: 'Alt+Shift+N', v: 'Ñ' },
                { k: '◌̱', v: 'a̱, e̱, o̱' },
                { k: '◌̣', v: 'ḍ, ṭ, ṇ, ṛ' },
                { k: '◌̃', v: 'ã, ẽ, ĩ' },
                { k: '◌̄', v: 'ā, ē, ō' },
                { k: '/jh', v: 'Johar' },
                { k: '/sg', v: 'Sagun' }
            ];
        } else if (KB.currentLayout === 'olchiki') {
            guide = [
                { k: 'q w e r', v: 'ᱚ ᱛ ᱜ ᱝ' },
                { k: 'a s d f', v: 'ᱤ ᱥ ᱦ ᱧ' },
                { k: 'z x c v', v: 'ᱮ ᱯ ᱰ ᱱ' },
                { k: 't y u i', v: 'ᱞ ᱟᱹ ᱠ ᱡ' },
                { k: 'o p g h', v: 'ᱢ ᱣ ᱨ ᱩ' },
                { k: 'j k l b', v: 'ᱪ ᱫ ᱬ ᱲ' },
                { k: 'n m', v: 'ᱳ ᱴ' },
                { k: 'kh, gh..', v: 'ᱠᱷ, ᱜᱷ' },
                { k: 'Shift 0-9', v: '᱐-᱙ Num' },
                { k: '/jh', v: 'ᱡᱚᱦᱟᱨ' },
                { k: '/sg', v: 'ᱥᱟᱹᱜᱩᱱ' }
            ];
        } else if (KB.currentLayout === 'hindi-dev') {
            guide = [
                { k: 'k / Shift+K', v: 'क / ख' },
                { k: 'g / Shift+G', v: 'ग / घ' },
                { k: 't / Shift+T', v: 'त / ट' },
                { k: 'd / Shift+D', v: 'द / ड' },
                { k: 'p / Shift+P', v: 'प / फ' },
                { k: 'b / Shift+B', v: 'ब / भ' },
                { k: 'q', v: '् (हलंत)' },
                { k: 'x', v: 'ं (अनुस्वार)' },
                { k: '/jh', v: 'नमस्ते' },
                { k: '/sg', v: 'शुभकामनाएं' }
            ];
        } else {
            guide = [
                { k: 'k / Shift+K', v: 'क / ख' },
                { k: 'g / Shift+G', v: 'ग / घ' },
                { k: 'c / Shift+C', v: 'च / छ' },
                { k: 'j / Shift+J', v: 'ज / झ' },
                { k: 'Shift+R / H', v: 'ड़ / ढ़' },
                { k: 'Shift+Z / W', v: 'ञ / ङ' },
                { k: 'Shift+k,g,c', v: 'कʼ, गʼ, चʼ' },
                { k: 'Shift+j,t,d', v: 'जʼ, तʼ, दʼ' },
                { k: 'Key: ] / }', v: '़ (Nukta)' },
                { k: '/jh', v: 'जोहार' },
                { k: '/sg', v: 'सगुन दाराम' }
            ];
        }

        guide.forEach(item => {
            const div = document.createElement('div');
            div.className = 'map-badge';

            const span1 = document.createElement('span');
            span1.textContent = item.k;

            const span2 = document.createElement('span');
            span2.textContent = item.v;

            div.appendChild(span1);
            div.appendChild(span2);
            fragment.appendChild(div);
        });

        mappingInfo.replaceChildren(fragment);
    }

    // ============================================================
    // 🔐 LANGUAGE SWITCH
    // ============================================================
    function switchLanguage(mode) {
        if (KB._switchInProgress) {
            console.warn('⚠️ Switch in progress');
            return;
        }

        if (!KEYBOARD_LANGUAGES.includes(mode)) {
            console.warn('⚠️ Invalid mode:', mode);
            return;
        }

        const hasProAccess = _getProAccess();

        if (mode !== 'english' && !hasProAccess) {
            if (typeof showToast === 'function') {
                showToast('🎁 Pro लाइसेंस या Trial आवश्यक है (₹9 में 7 दिन)', 'warning');
            } else {
                alert('Pro लाइसेंस या ₹9 Trial आवश्यक है।');
            }

            if (typeof openTrialActivationModal === 'function') {
                openTrialActivationModal();
            } else if (typeof openBuyModal === 'function') {
                openBuyModal();
            }
            return;
        }

        KB._switchInProgress = true;

        try {
            KB.currentLayout = mode;
            KB.isShift = false;
            KB.isCaps = false;

            document.querySelectorAll('.tab-pill').forEach(btn => btn.classList.remove('active'));
            const tabEl = document.getElementById(`tab-${mode}`);
            if (tabEl) tabEl.classList.add('active');

            const titles = {
                'english': 'Default English',
                'roman': 'Santali (R)',
                'hindi-dev': 'हिन्दी',
                'santali-dev': 'Santali (D)',
                'olchiki': 'ओ़लचिकी'
            };
            const deckModeTitle = document.getElementById('deck-mode-title');
            if (deckModeTitle) {
                deckModeTitle.textContent = `Virtual Keyboard: ${titles[mode] || mode}`;
            }

            const deckContainer = document.querySelector('.keyboard-deck');
            if (deckContainer) {
                if (mode === 'hindi-dev' || mode === 'santali-dev') {
                    deckContainer.classList.add('dense-layout');
                } else {
                    deckContainer.classList.remove('dense-layout');
                }
            }

            drawKeyboard();
            if (KB.isNumpadActive) drawNumpad();
            renderModifiersPanel();
            renderMappingGuide();
            updateSuggestionBar();

            if (typeof autoSyncLanguageFonts === 'function') autoSyncLanguageFonts(mode);
            if (typeof updateStatusLanguage === 'function') updateStatusLanguage(mode);

            // ─── Expose current layout globally ───
            window.currentLayout = mode;

            console.log('✅ Language switched:', mode);

        } catch (e) {
            console.error('❌ switchLanguage error:', e);
        } finally {
            KB._switchInProgress = false;
        }
    }

    // ============================================================
    // 🔄 CYCLE NEXT LANGUAGE
    // ============================================================
    function cycleNextLanguage() {
        const hasAccess = _getProAccess();
        const order = hasAccess ? KEYBOARD_LANGUAGES : ['english'];

        if (order.length <= 1) {
            if (typeof showToast === 'function') {
                showToast('🎁 Pro लाइसेंस या Trial आवश्यक है', 'warning');
            }
            return;
        }

        let idx = order.indexOf(KB.currentLayout);
        if (idx < 0) idx = 0;
        idx = (idx + 1) % order.length;

        switchLanguage(order[idx]);
    }

    // ============================================================
    // ⌨️ KEYBOARD PREFERENCE
    // ============================================================
    function setKeyboardPreference(mode) {
        KB.keyboardMode = (mode === 'system') ? 'system' : 'virtual';

        try {
            localStorage.setItem('hor_kb_mode', KB.keyboardMode);
        } catch (e) {}

        const btn = document.getElementById('btn-kb-choice');
        const statusText = document.getElementById('systemKbStatusText');
        const editor = document.getElementById('editor');

        if (KB.keyboardMode === 'system') {
            document.body.classList.add('system-keyboard-active');

            if (btn) {
                btn.textContent = '📱 Keyboard: System (Device)';
                btn.classList.add('system-mode');
            }

            if (editor) {
                editor.setAttribute('inputmode', 'text');
                editor.setAttribute('autocorrect', 'off');
                editor.setAttribute('autocapitalize', 'none');
                editor.setAttribute('spellcheck', 'false');
            }

            if (statusText) statusText.style.display = 'flex';
        } else {
            document.body.classList.remove('system-keyboard-active');

            if (btn) {
                btn.textContent = '⌨️ Keyboard: App Virtual';
                btn.classList.remove('system-mode');
            }

            if (editor) editor.setAttribute('inputmode', 'none');
            if (statusText) statusText.style.display = 'none';
        }

        if (typeof updateStatusKeyboard === 'function') updateStatusKeyboard(KB.keyboardMode);

        // ─── Expose globally ───
        window.keyboardMode = KB.keyboardMode;
    }

    function toggleKeyboardPreference() {
        setKeyboardPreference(KB.keyboardMode === 'virtual' ? 'system' : 'virtual');

        setTimeout(() => {
            const editor = document.getElementById('editor');
            if (editor) editor.focus();
        }, 50);
    }

    // ============================================================
    // 💡 SUGGESTION BAR
    // ============================================================
    function getActiveWordList() {
        if (!KB.userVocabDB[KB.currentLayout] || !Array.isArray(KB.userVocabDB[KB.currentLayout])) {
            const defaults = (typeof defaultWordSuggestions !== 'undefined' &&
                             defaultWordSuggestions[KB.currentLayout])
                ? defaultWordSuggestions[KB.currentLayout]
                : ((typeof defaultWordSuggestions !== 'undefined' && defaultWordSuggestions['english'])
                    ? defaultWordSuggestions['english']
                    : []);

            KB.userVocabDB[KB.currentLayout] = [...defaults];
            saveVocabToStorage();
        }
        return KB.userVocabDB[KB.currentLayout];
    }

    function saveVocabToStorage() {
        try {
            localStorage.setItem('hor_user_vocab_db', JSON.stringify(KB.userVocabDB));
        } catch (e) {
            console.warn('⚠️ Vocab save failed:', e.message);

            if (e.name === 'QuotaExceededError' || e.code === 22) {
                try {
                    const trimmed = {};
                    ['english', 'hindi-dev', 'olchiki'].forEach(k => {
                        if (KB.userVocabDB[k] && Array.isArray(KB.userVocabDB[k])) {
                            trimmed[k] = KB.userVocabDB[k].slice(0, 20);
                        }
                    });
                    localStorage.setItem('hor_user_vocab_db', JSON.stringify(trimmed));
                } catch (e2) {
                    try {
                        localStorage.removeItem('hor_user_vocab_db');
                    } catch (e3) {}
                }
            }
        }
    }

    function updateSuggestionBar() {
        const suggestionBar = document.getElementById('suggestionBar');
        if (!suggestionBar) return;

        const fragment = document.createDocumentFragment();

        const manageBtn = document.createElement('button');
        manageBtn.className = 'tool-btn';
        manageBtn.style.background = 'var(--primary)';
        manageBtn.style.color = '#fff';
        manageBtn.style.fontWeight = 'bold';
        manageBtn.style.padding = '1px 6px';
        manageBtn.textContent = '⚙️ Edit';
        manageBtn.onmousedown = (e) => e.preventDefault();
        manageBtn.onclick = openVocabManagerModal;
        fragment.appendChild(manageBtn);

        const list = getActiveWordList();
        list.slice(0, 30).forEach(w => {
            const chip = document.createElement('span');
            chip.className = 'sugg-chip';
            chip.textContent = w;
            chip.onmousedown = (e) => e.preventDefault();
            chip.onclick = () => {
                if (typeof addCharWithPhonics === 'function') {
                    addCharWithPhonics(w + ' ');
                }
            };
            fragment.appendChild(chip);
        });

        suggestionBar.replaceChildren(fragment);
    }

    // ============================================================
    // 📚 VOCAB MANAGER
    // ============================================================
    function openVocabManagerModal() {
        renderVocabManagerList();

        const modal = document.getElementById('vocabManagerModal');
        if (modal) modal.style.display = 'flex';

        const input = document.getElementById('newVocabInput');
        if (input) input.focus();
    }

    function closeVocabManagerModal() {
        const modal = document.getElementById('vocabManagerModal');
        if (modal) modal.style.display = 'none';
        updateSuggestionBar();
    }

    function saveNewVocabWord() {
        const inp = document.getElementById('newVocabInput');
        if (!inp) return;

        const word = (inp.value || '').trim();
        if (!word) return;

        if (word.length > 100) {
            alert('शब्द बहुत लंबा है (max 100 chars)');
            return;
        }

        const list = getActiveWordList();

        if (list.length >= VOCAB_MAX_PER_LANG) {
            alert(`Maximum ${VOCAB_MAX_PER_LANG} words allowed per language`);
            return;
        }

        if (!list.includes(word)) {
            list.unshift(word);
            saveVocabToStorage();
            inp.value = '';
            renderVocabManagerList();
            updateSuggestionBar();
        } else {
            alert(`"${word}" पहले से मौजूद है।`);
        }
    }

    function editCustomVocabWord(index) {
        const list = getActiveWordList();
        if (index < 0 || index >= list.length) return;

        const updated = prompt('शब्द एडिट करें:', list[index]);

        if (updated !== null) {
            const trimmed = updated.trim();
            if (trimmed && trimmed !== list[index] && trimmed.length <= 100) {
                list[index] = trimmed;
                saveVocabToStorage();
                renderVocabManagerList();
                updateSuggestionBar();
            }
        }
    }

    function deleteCustomVocabWord(index) {
        const list = getActiveWordList();
        if (index < 0 || index >= list.length) return;

        if (confirm(`"${list[index]}" को डिलीट करें?`)) {
            list.splice(index, 1);
            saveVocabToStorage();
            renderVocabManagerList();
            updateSuggestionBar();
        }
    }

    function resetActiveVocabToDefault() {
        const titles = {
            'english': 'English',
            'roman': 'Santali (R)',
            'hindi-dev': 'हिन्दी',
            'santali-dev': 'Santali (D)',
            'olchiki': 'ओ़लचिकी'
        };

        if (confirm(`क्या आप ${titles[KB.currentLayout]} के शब्द रीसेट करना चाहते हैं?`)) {
            const defaults = (typeof defaultWordSuggestions !== 'undefined' &&
                             defaultWordSuggestions[KB.currentLayout])
                ? defaultWordSuggestions[KB.currentLayout]
                : ((typeof defaultWordSuggestions !== 'undefined' && defaultWordSuggestions['english'])
                    ? defaultWordSuggestions['english']
                    : []);

            KB.userVocabDB[KB.currentLayout] = [...defaults];
            saveVocabToStorage();
            renderVocabManagerList();
            updateSuggestionBar();
        }
    }

    function renderVocabManagerList() {
        const container = document.getElementById('vocabListContainer');
        const countSpan = document.getElementById('customWordCount');
        if (!container) return;

        const list = getActiveWordList();
        if (countSpan) countSpan.textContent = list.length;

        const fragment = document.createDocumentFragment();

        if (list.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'font-size:0.75rem; color:var(--text-muted); text-align:center; padding:15px 0;';
            empty.textContent = 'कोई शब्द नहीं है।';
            fragment.appendChild(empty);
        } else {
            list.forEach((word, idx) => {
                const row = document.createElement('div');
                row.className = 'vocab-item-row';

                const textSpan = document.createElement('span');
                textSpan.className = 'vocab-item-text';
                textSpan.textContent = word;
                row.appendChild(textSpan);

                const btnGroup = document.createElement('div');
                btnGroup.style.cssText = 'display:flex; gap:4px;';

                const editBtn = document.createElement('button');
                editBtn.className = 'tool-btn';
                editBtn.style.color = 'var(--primary)';
                editBtn.textContent = '✏️ Edit';
                editBtn.onclick = () => editCustomVocabWord(idx);
                btnGroup.appendChild(editBtn);

                const delBtn = document.createElement('button');
                delBtn.className = 'tool-btn';
                delBtn.style.color = '#d00';
                delBtn.textContent = '🗑️ Delete';
                delBtn.onclick = () => deleteCustomVocabWord(idx);
                btnGroup.appendChild(delBtn);

                row.appendChild(btnGroup);
                fragment.appendChild(row);
            });
        }

        container.replaceChildren(fragment);
    }

    // ============================================================
    // ⌨️ TYPING MODE
    // ============================================================
    function enterTypingMode() {
        if (window.innerWidth > 768) return;
        if (KB.keyboardMode !== 'virtual') return;

        clearTimeout(KB._typingModeDebounce);
        KB._typingModeDebounce = setTimeout(() => {
            document.body.classList.add('typing-focus');
        }, 100);
    }

    function exitTypingMode() {
        document.body.classList.remove('typing-focus');
    }

    // ============================================================
    // 🌐 EXPOSE GLOBALLY (window.*)
    // ============================================================
    window.drawKeyboard = drawKeyboard;
    window.drawNumpad = drawNumpad;
    window.toggleNumpad = toggleNumpad;
    window.toggleShift = toggleShift;
    window.toggleCaps = toggleCaps;
    window.flashKeyVisual = flashKeyVisual;
    window.getKeyHint = getKeyHint;
    window.handleHoverSpeech = handleHoverSpeech;
    window.renderModifiersPanel = renderModifiersPanel;
    window.renderMappingGuide = renderMappingGuide;
    window.switchLanguage = switchLanguage;
    window.cycleNextLanguage = cycleNextLanguage;
    window.setKeyboardPreference = setKeyboardPreference;
    window.toggleKeyboardPreference = toggleKeyboardPreference;
    window.getActiveWordList = getActiveWordList;
    window.saveVocabToStorage = saveVocabToStorage;
    window.updateSuggestionBar = updateSuggestionBar;
    window.openVocabManagerModal = openVocabManagerModal;
    window.closeVocabManagerModal = closeVocabManagerModal;
    window.saveNewVocabWord = saveNewVocabWord;
    window.editCustomVocabWord = editCustomVocabWord;
    window.deleteCustomVocabWord = deleteCustomVocabWord;
    window.resetActiveVocabToDefault = resetActiveVocabToDefault;
    window.renderVocabManagerList = renderVocabManagerList;
    window.enterTypingMode = enterTypingMode;
    window.exitTypingMode = exitTypingMode;

    // ─── Expose state getters ───
    window.getCurrentLayout = () => KB.currentLayout;
    window.getKeyboardMode = () => KB.keyboardMode;

    // ─── Set initial global values ───
    window.currentLayout = KB.currentLayout;
    window.keyboardMode = KB.keyboardMode;
    window.isNumpadActive = KB.isNumpadActive;

    // ============================================================
    // 📊 DEBUG HELPERS
    // ============================================================
    window.KeyboardDebug = {
        state: () => {
            console.log('═══════════════════════════════════════════');
            console.log('⌨️ Keyboard State');
            console.log('───────────────────────────────────────────');
            console.log('  Layout:', KB.currentLayout);
            console.log('  Mode:', KB.keyboardMode);
            console.log('  Shift:', KB.isShift);
            console.log('  Caps:', KB.isCaps);
            console.log('  Numpad:', KB.isNumpadActive);
            console.log('  Pro access:', _getProAccess());
            console.log('  Vocab loaded:', Object.keys(KB.userVocabDB).length, 'languages');
            console.log('═══════════════════════════════════════════');
        },
        render: () => {
            drawKeyboard();
            console.log('✅ Keyboard re-rendered');
        },
        vocab: () => {
            console.table(Object.keys(KB.userVocabDB).map(k => ({
                language: k,
                wordCount: Array.isArray(KB.userVocabDB[k]) ? KB.userVocabDB[k].length : 0
            })));
        },
        resetVocab: () => {
            KB.userVocabDB = {};
            try {
                localStorage.removeItem('hor_user_vocab_db');
            } catch (e) {}
            updateSuggestionBar();
            console.log('🔄 Vocab DB reset');
        },
        switchTo: (lang) => {
            switchLanguage(lang);
            console.log('🔄 Switched to:', lang);
        }
    };

    // ============================================================
    // 🚀 INITIAL RENDER — Try immediately + after delay
    // ============================================================
    function initialRender() {
        try {
            drawKeyboard();
            if (KB.isNumpadActive) drawNumpad();
            renderModifiersPanel();
            renderMappingGuide();
            updateSuggestionBar();
            console.log('✅ Initial keyboard render complete');
        } catch (e) {
            console.error('❌ Initial render failed:', e);
        }
    }

    // Try on DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(initialRender, 100));
    } else {
        setTimeout(initialRender, 100);
    }

    // Fallback: also try after app is ready
    setTimeout(() => {
        const kb = document.getElementById('keyboard');
        if (kb && kb.children.length === 0) {
            console.log('🔄 Keyboard empty — retrying render');
            initialRender();
        }
    }, 1500);

    console.log('═══════════════════════════════════════════');
    console.log('✅ keyboard.js loaded — v3.7.4.45');
    console.log('   ⌨️  Layouts:', KEYBOARD_LANGUAGES.length);
    console.log('   🔐 Pro access: uses license.js');
    console.log('   📦 Namespace: KB object');
    console.log('   🌐 Globals exposed via window.*');
    console.log('═══════════════════════════════════════════');

})();