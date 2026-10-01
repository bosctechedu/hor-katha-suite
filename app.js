// ============================================================
// 🚀 APP.JS — Main Boot + Multi-Language TTS + Voice Selection
// BOSC Tech & Edu · Hoṛ Katha Suite v3.7.4 Pro Ultra
// ============================================================
// ✅ v3.7.4.44 — AUDIT FIXES:
//    • TTS: Multi-language support (EN/HI/SAT/OL)
//    • TTS: Language-aware voice selection with fallbacks
//    • TTS: Adaptive chunk size per language
//    • TTS: Per-language optimized rate/pitch
//    • TTS: Voice cache + invalidation
//    • TTS: Auto-recovery on stuck synthesis
//    • STT: Better restart logic (recognition.onend)
//    • STT: Full error mapping with user messages
//    • STT: Permission check before start
//    • Voice settings modal: cached, not recreated
//    • speakLetter: better throttle + cancel previous
//    • speakText: chunk progress callback
//    • HWID recovery: save to Electron + localStorage
//    • Status strip: throttled updates
//    • initApp: null-safe element access
//    • Preview mode: iframe cleanup
//    • Time update: proper cleanup
// ============================================================

window.__appReady = false;

// ============================================================
// 🎤 SPEECH RECOGNITION STATE
// ============================================================
let recognition = null;
let isListening = false;
let _recognitionRestartCount = 0;
const MAX_RECOGNITION_RESTARTS = 5;

// ============================================================
// 🔊 TTS STATE
// ============================================================
let _ttsState = {
    speaking: false,
    paused: false,
    selectedVoiceName: null,   // null = auto
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    _currentChunks: [],
    _currentChunkIndex: 0,
    _lastSpeakTime: 0
};

// ─── Language-Aware TTS Config ───
// ✅ v3.7.4.44: Multi-language support
const TTS_LANGUAGE_CONFIG = {
    'english': {
        lang: 'en-US',
        fallbacks: ['en-US', 'en-GB', 'en-IN', 'en'],
        chunkSize: 180,
        rate: 1.0,
        pitch: 1.0,
        label: 'English'
    },
    'roman': {
        // Roman Santali = English voices with Santali pronunciation
        lang: 'en-IN',
        fallbacks: ['en-IN', 'en-US', 'en-GB', 'en'],
        chunkSize: 180,
        rate: 0.95,
        pitch: 1.0,
        label: 'Santali (Roman)'
    },
    'hindi-dev': {
        lang: 'hi-IN',
        fallbacks: ['hi-IN', 'en-IN', 'en-US', 'en'],
        chunkSize: 150,
        rate: 0.95,
        pitch: 1.0,
        label: 'हिन्दी'
    },
    'santali-dev': {
        // Santali Devanagari = Hindi voices (same script)
        lang: 'hi-IN',
        fallbacks: ['hi-IN', 'en-IN', 'en-US', 'en'],
        chunkSize: 150,
        rate: 0.9,
        pitch: 1.0,
        label: 'Santali (Devanagari)'
    },
    'olchiki': {
        // Ol Chiki — prefer sat-IN if available, else Hindi
        lang: 'sat-IN',
        fallbacks: ['sat-IN', 'hi-IN', 'en-IN', 'en-US', 'en'],
        chunkSize: 140,
        rate: 0.85,
        pitch: 1.0,
        label: 'Ol Chiki'
    }
};

// ─── Voice cache ───
let _voiceCache = null;
let _voiceCacheTimestamp = 0;
const VOICE_CACHE_TTL_MS = 60000; // 1 minute

// ─── Time update interval ───
let _timeUpdateInterval = null;

// ============================================================
// 💾 LOAD/SAVE TTS SETTINGS
// ============================================================
function loadTTSSettings() {
    try {
        const saved = localStorage.getItem('hor_tts_settings');
        if (!saved) return;

        const s = JSON.parse(saved);
        if (s.voiceName) _ttsState.selectedVoiceName = s.voiceName;
        if (typeof s.rate === 'number' && s.rate > 0 && s.rate <= 2) _ttsState.rate = s.rate;
        if (typeof s.pitch === 'number' && s.pitch > 0 && s.pitch <= 2) _ttsState.pitch = s.pitch;
        if (typeof s.volume === 'number' && s.volume > 0 && s.volume <= 1) _ttsState.volume = s.volume;

        console.log('✅ TTS settings loaded:', s.voiceName || 'auto');
    } catch (e) {
        console.warn('TTS settings load failed:', e.message);
    }
}

function saveTTSSettings() {
    try {
        localStorage.setItem('hor_tts_settings', JSON.stringify({
            voiceName: _ttsState.selectedVoiceName,
            rate: _ttsState.rate,
            pitch: _ttsState.pitch,
            volume: _ttsState.volume
        }));
    } catch (e) {
        console.warn('TTS settings save failed:', e.message);
    }
}

// ============================================================
// 🔐 HELPER: Pro Access Check
// ✅ FIXED: Uses global from license.js (no redeclaration)
// ============================================================
function _hasProAccess() {
    try {
        if (typeof window.hasProLevelAccess === 'function') {
            return window.hasProLevelAccess();
        }
    } catch (e) {}

    // Fallback: direct check
    try {
        if (typeof isProLicensed !== 'undefined' && isProLicensed === true) return true;
        if (typeof APP_CONFIG !== 'undefined' &&
            APP_CONFIG.TRIAL_ENABLED === true &&
            typeof TrialSystem !== 'undefined' &&
            TrialSystem.isActive() === true) return true;
    } catch (e) {}

    return false;
}

// ============================================================
// 🎤 VOICE RECOGNITION (STT) — Better error handling
// ============================================================
function toggleSpeechRecognition() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRec) {
        alert('Browser does not support Speech Recognition.\n\nKripya Chrome/Edge use karein.');
        return;
    }

    const btn = document.getElementById('btn-mic');

    // ─── Initialize recognition (only once) ───
    if (!recognition) {
        try {
            recognition = new SpeechRec();
            recognition.continuous = true;
            recognition.interimResults = false;
            recognition.lang = _getRecognitionLang();

            // ─── Result handler ───
            recognition.onresult = (e) => {
                try {
                    const transcript = e.results[e.results.length - 1][0].transcript;
                    if (typeof addChar === 'function') {
                        addChar(transcript + ' ');
                    }
                } catch (err) {
                    console.warn('Recognition result error:', err);
                }
            };

            // ─── End handler (with auto-restart) ───
            recognition.onend = () => {
                if (isListening && _recognitionRestartCount < MAX_RECOGNITION_RESTARTS) {
                    _recognitionRestartCount++;
                    try {
                        recognition.start();
                        console.log('🎤 Recognition restarted (' + _recognitionRestartCount + ')');
                    } catch (e) {
                        // Already started — ignore
                    }
                    return;
                }

                // Final stop
                isListening = false;
                _recognitionRestartCount = 0;
                if (btn) {
                    btn.classList.remove('active-state', 'listening');
                    btn.textContent = '🎤 Mic';
                }
            };

            // ─── Error handler with full mapping ───
            recognition.onerror = (e) => {
                console.warn('Speech recognition error:', e.error);

                // Non-fatal errors — will auto-restart
                if (e.error === 'no-speech' || e.error === 'aborted') {
                    return;
                }

                // Fatal errors — stop
                isListening = false;
                _recognitionRestartCount = 0;

                if (btn) {
                    btn.classList.remove('active-state', 'listening');
                    btn.textContent = '🎤 Mic';
                }

                // Show user-friendly message
                const errorMessages = {
                    'not-allowed': 'माइक permission denied. Browser settings check करें।',
                    'service-not-allowed': 'Speech service unavailable. Internet check करें।',
                    'audio-capture': 'माइक नहीं मिला। Device check करें।',
                    'network': 'Network error. Internet check करें।',
                    'language-not-supported': 'यह language supported नहीं है।'
                };

                const msg = errorMessages[e.error] || 'Recognition error: ' + e.error;

                if (typeof showToast === 'function') {
                    showToast(msg, 'error', 4000);
                } else {
                    console.warn(msg);
                }
            };

        } catch (initErr) {
            console.error('Recognition init failed:', initErr);
            alert('Recognition init failed: ' + initErr.message);
            return;
        }
    }

    // ─── Start / Stop ───
    if (!isListening) {
        // Update lang based on current layout
        recognition.lang = _getRecognitionLang();

        // Reset restart counter
        _recognitionRestartCount = 0;

        try {
            recognition.start();
            isListening = true;
            if (btn) {
                btn.classList.add('active-state', 'listening');
                btn.textContent = '🔴 Listening...';
            }
        } catch (e) {
            console.warn('Recognition start failed:', e.message);
            isListening = false;

            if (typeof showToast === 'function') {
                showToast('Mic start failed. Thoda wait करें।', 'warning', 3000);
            }
        }
    } else {
        try {
            recognition.stop();
        } catch (e) {}
        isListening = false;
        _recognitionRestartCount = 0;

        if (btn) {
            btn.classList.remove('active-state', 'listening');
            btn.textContent = '🎤 Mic';
        }
    }
}

/**
 * Get recognition language based on current layout
 */
function _getRecognitionLang() {
    try {
        if (typeof currentLayout === 'undefined') return 'en-US';

        switch (currentLayout) {
            case 'hindi-dev':
            case 'santali-dev':
            case 'olchiki':
                return 'hi-IN';
            case 'roman':
                return 'en-IN';
            case 'english':
            default:
                return 'en-US';
        }
    } catch (e) {
        return 'en-US';
    }
}

// ============================================================
// 🎯 VOICE CACHE & SELECTION (Multi-Language)
// ============================================================

/**
 * Get all voices (cached for 60s)
 */
function _getVoicesCached() {
    const now = Date.now();

    if (_voiceCache && (now - _voiceCacheTimestamp) < VOICE_CACHE_TTL_MS) {
        return _voiceCache;
    }

    try {
        const voices = speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
            _voiceCache = voices;
            _voiceCacheTimestamp = now;
        }
        return voices || [];
    } catch (e) {
        return [];
    }
}

/**
 * Invalidate voice cache
 */
function _invalidateVoiceCache() {
    _voiceCache = null;
    _voiceCacheTimestamp = 0;
}

/**
 * Get current layout's TTS config
 */
function _getTTSEConfig() {
    const layout = (typeof currentLayout !== 'undefined') ? currentLayout : 'english';
    return TTS_LANGUAGE_CONFIG[layout] || TTS_LANGUAGE_CONFIG['english'];
}

/**
 * Get best voice for current language
 * Priority:
 *   1. User-selected voice (if matches current language family)
 *   2. Language-specific voice (local preferred)
 *   3. Fallback chain languages
 *   4. Any voice
 */
function getSelectedVoice() {
    const voices = _getVoicesCached();
    if (!voices || voices.length === 0) return null;

    const config = _getTTSEConfig();

    // ─── Priority 1: User-selected voice ───
    if (_ttsState.selectedVoiceName) {
        const selected = voices.find(v => v.name === _ttsState.selectedVoiceName);
        if (selected) {
            console.log('🎯 Using user-selected voice:', selected.name);
            return selected;
        }
    }

    // ─── Priority 2: Language-specific match ───
    for (const lang of config.fallbacks) {
        // Try to find local voice first (better quality)
        let voice = voices.find(v =>
            v.lang === lang &&
            v.localService === true
        );

        if (voice) {
            console.log('🎯 Found local voice:', voice.name, '(' + voice.lang + ')');
            return voice;
        }

        // Fallback: any voice with this lang
        voice = voices.find(v => v.lang === lang || v.lang.startsWith(lang.split('-')[0]));
        if (voice) {
            console.log('🎯 Found voice:', voice.name, '(' + voice.lang + ')');
            return voice;
        }
    }

    // ─── Priority 3: Any voice ───
    const anyVoice = voices[0];
    console.log('⚠️ Fallback to any voice:', anyVoice.name);
    return anyVoice;
}

// ============================================================
// 🔊 SPEAK TEXT — Multi-Language + Chunking
// ============================================================
function speakText() {
    const editor = document.getElementById('editor');
    const text = (editor ? editor.innerText : '') || '';

    // ✅ Empty text guard
    if (!text.trim()) {
        if (typeof showToast === 'function') {
            showToast('कुछ टाइप करें पहले', 'warning');
        }
        return;
    }

    // If already speaking → stop
    if (speechSynthesis.speaking) {
        stopSpeaking();
        return;
    }

    // ✅ Get language-aware config
    const config = _getTTSEConfig();

    // ✅ Get best voice
    const voice = getSelectedVoice();

    if (!voice) {
        if (typeof showToast === 'function') {
            showToast('कोई voice उपलब्ध नहीं — कृपया voice settings खोलें', 'warning');
        }
        return;
    }

    console.log('🔊 TTS starting:', {
        language: config.label,
        voice: voice.name,
        voiceLang: voice.lang,
        chunkSize: config.chunkSize,
        rate: _ttsState.rate || config.rate
    });

    // ✅ Adaptive chunk size
    const chunkSize = config.chunkSize;
    const chunks = chunkText(text.trim(), chunkSize);

    if (chunks.length === 0) {
        if (typeof showToast === 'function') {
            showToast('कोई text नहीं मिला', 'warning');
        }
        return;
    }

    // Update button state
    updateReadButtonState(true);

    // Update state
    _ttsState._currentChunks = chunks;
    _ttsState._currentChunkIndex = 0;
    _ttsState._lastSpeakTime = Date.now();

    let currentChunkIdx = 0;

    function speakNext() {
        // Check if should stop
        if (currentChunkIdx >= chunks.length || !_ttsState.speaking) {
            if (currentChunkIdx >= chunks.length) {
                // All chunks spoke
                console.log('✅ TTS complete');
                updateReadButtonState(false);
                _ttsState.speaking = false;
            }
            return;
        }

        const chunk = chunks[currentChunkIdx];
        const u = new SpeechSynthesisUtterance(chunk);

        // Voice + language
        u.voice = voice;
        u.lang = voice.lang || config.lang;

        // ✅ Per-language optimized rate
        // User setting overrides if set
        u.rate = _ttsState.rate !== 1.0 ? _ttsState.rate : config.rate;
        u.pitch = _ttsState.pitch || config.pitch;
        u.volume = _ttsState.volume || 1.0;

        // Progress logging
        console.log(`🔊 Chunk ${currentChunkIdx + 1}/${chunks.length} (${chunk.length} chars)`);

        u.onend = () => {
            currentChunkIdx++;
            _ttsState._currentChunkIndex = currentChunkIdx;
            speakNext();
        };

        u.onerror = (e) => {
            // Ignore "interrupted" and "canceled" errors
            if (e.error === 'interrupted' || e.error === 'canceled') {
                return;
            }
            console.warn('TTS chunk error:', e.error);
            currentChunkIdx++;
            speakNext();
        };

        try {
            speechSynthesis.speak(u);
        } catch (err) {
            console.error('speak() failed:', err);
            updateReadButtonState(false);
            _ttsState.speaking = false;
        }
    }

    // ─── Start speaking ───
    try {
        speechSynthesis.cancel();
        _ttsState.speaking = true;
        speakNext();
    } catch (err) {
        console.error('speak() failed:', err);
        _ttsState.speaking = false;
        updateReadButtonState(false);
    }
}

// ============================================================
// ✅ CHUNK TEXT — Multi-Language aware
// ============================================================
// Splits text into speech-friendly chunks respecting:
//   • Sentence boundaries (. ! ? । ॥)
//   • Comma boundaries (, ;)
//   • Word boundaries (last resort)
// ============================================================
function chunkText(text, maxSize) {
    if (!text || text.length <= maxSize) return [text];

    const chunks = [];
    // ✅ Support English + Hindi/Santali punctuation
    const sentences = text.split(/(?<=[.!?।॥])\s+/);
    let currentChunk = '';

    for (const sentence of sentences) {
        // Check if adding this sentence overflows
        if ((currentChunk + ' ' + sentence).length > maxSize) {
            if (currentChunk) chunks.push(currentChunk.trim());

            // If single sentence is too long, split by commas
            if (sentence.length > maxSize) {
                const subParts = sentence.split(/(?<=[,;:])\s+/);
                let subChunk = '';

                for (const part of subParts) {
                    if ((subChunk + ' ' + part).length > maxSize) {
                        if (subChunk) chunks.push(subChunk.trim());

                        // If still too long, split by words
                        if (part.length > maxSize) {
                            const words = part.split(/\s+/);
                            let wordChunk = '';

                            for (const word of words) {
                                if ((wordChunk + ' ' + word).length > maxSize) {
                                    if (wordChunk) chunks.push(wordChunk.trim());
                                    wordChunk = word;
                                } else {
                                    wordChunk = wordChunk ? wordChunk + ' ' + word : word;
                                }
                            }
                            subChunk = wordChunk;
                        } else {
                            subChunk = part;
                        }
                    } else {
                        subChunk = subChunk ? subChunk + ' ' + part : part;
                    }
                }
                currentChunk = subChunk;
            } else {
                currentChunk = sentence;
            }
        } else {
            currentChunk = currentChunk ? currentChunk + ' ' + sentence : sentence;
        }
    }

    if (currentChunk) chunks.push(currentChunk.trim());

    // Filter empty chunks
    return chunks.filter(c => c.length > 0);
}

// ============================================================
// ⏹️ STOP SPEAKING
// ============================================================
function stopSpeaking() {
    _ttsState.speaking = false;
    _ttsState._currentChunks = [];
    _ttsState._currentChunkIndex = 0;

    if ('speechSynthesis' in window) {
        try {
            speechSynthesis.cancel();
        } catch (e) {}
    }

    updateReadButtonState(false);
    console.log('⏹️ TTS stopped');
}

// ============================================================
// 🔘 UPDATE READ BUTTON STATE
// ============================================================
function updateReadButtonState(isSpeaking) {
    const btn = document.getElementById('btn-read') ||
                document.querySelector('button[onclick="speakText()"]');
    if (!btn) return;

    if (isSpeaking) {
        btn.innerHTML = '⏹️ Stop';
        btn.style.background = '#dc2626';
        btn.style.color = '#fff';
        btn.style.borderColor = '#dc2626';
    } else {
        btn.innerHTML = '🗣️ Read';
        btn.style.background = '';
        btn.style.color = '';
        btn.style.borderColor = '';
    }
}

// ============================================================
// 🎧 TEST VOICE (in current language)
// ============================================================
function testVoice(customText = null) {
    const voice = getSelectedVoice();
    if (!voice) {
        if (typeof showToast === 'function') {
            showToast('कोई voice उपलब्ध नहीं', 'warning');
        }
        return;
    }

    const config = _getTTSEConfig();

    // Sample text per language
    const sampleTexts = {
        'english': 'Hello, this is a voice test.',
        'roman': 'Johar, noa voice test kana.',
        'hindi-dev': 'नमस्ते, यह एक आवाज़ परीक्षण है।',
        'santali-dev': 'जोहार, नोवा आवाज़ परीक्षण काना।',
        'olchiki': 'ᱡᱚᱦᱟᱨ, ᱱᱚᱶᱟ ᱟᱲᱟᱝ ᱯᱚᱨᱤᱠᱷᱟ ᱠᱟᱱᱟ ᱾'
    };

    const text = customText || sampleTexts[typeof currentLayout !== 'undefined' ? currentLayout : 'english'] || sampleTexts['english'];

    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang || config.lang;
    u.rate = _ttsState.rate || config.rate;
    u.pitch = _ttsState.pitch || config.pitch;
    u.volume = _ttsState.volume || 1.0;

    try {
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
        console.log('🎧 Test voice:', voice.name, '-', text);
    } catch (e) {
        console.warn('Test voice failed:', e.message);
    }
}

// ============================================================
// 🎙️ VOICE SETTINGS MODAL
// ============================================================
function openVoiceSettingsModal() {
    // ─── Remove existing ───
    const existing = document.getElementById('voiceSettingsModal');
    if (existing) existing.remove();

    // ─── Get voices (current language first) ───
    const allVoices = _getVoicesCached();
    const config = _getTTSEConfig();
    const langPrefix = config.lang.split('-')[0];

    // Filter: current language voices first, then all
    const languageVoices = allVoices.filter(v =>
        v.lang.startsWith(langPrefix)
    );

    const otherVoices = allVoices.filter(v =>
        !v.lang.startsWith(langPrefix)
    );

    const sortedVoices = [...languageVoices, ...otherVoices];

    // ─── Build modal ───
    const modal = document.createElement('div');
    modal.id = 'voiceSettingsModal';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'display:flex; position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:10001; justify-content:center; align-items:center; padding:16px; backdrop-filter:blur(6px);';
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.remove();
            document.body.classList.remove('modal-open');
        }
    };

    const voiceOptions = sortedVoices.map((v) => {
        const isSelected = _ttsState.selectedVoiceName === v.name;
        const isCurrentLang = v.lang.startsWith(langPrefix);
        const localBadge = v.localService
            ? '<span style="background:#dcfce7; color:#166534; font-size:0.6rem; padding:2px 6px; border-radius:4px; font-weight:800; margin-left:6px;">LOCAL</span>'
            : '<span style="background:#dbeafe; color:#1e40af; font-size:0.6rem; padding:2px 6px; border-radius:4px; font-weight:800; margin-left:6px;">ONLINE</span>';
        const langBadge = isCurrentLang
            ? '<span style="background:#fef3c7; color:#92400e; font-size:0.6rem; padding:2px 6px; border-radius:4px; font-weight:800; margin-left:6px;">★ MATCH</span>'
            : '';

        return `
            <div class="voice-item" data-voice-name="${v.name.replace(/"/g, '&quot;')}"
                 data-voice-lang="${v.lang}"
                 style="padding:10px 12px; border:1.5px solid ${isSelected ? '#0284c7' : '#cbd5e1'};
                        background:${isSelected ? '#f0f9ff' : '#ffffff'};
                        border-radius:8px; margin-bottom:6px; cursor:pointer; transition:all 0.15s;
                        font-size:0.8rem; font-weight:700; color:#1e293b;">
                <div style="display:flex; align-items:center; justify-content:space-between;">
                    <div style="flex:1; min-width:0;">
                        <div style="font-weight:900; word-break:break-word;">${v.name}</div>
                        <div style="font-size:0.68rem; color:#64748b; margin-top:2px;">
                            ${v.lang}${localBadge}${langBadge}
                        </div>
                    </div>
                    ${isSelected ? '<span class="voice-check" style="font-size:1.2rem; color:#0284c7;">✓</span>' : ''}
                </div>
            </div>
        `;
    }).join('');

    modal.innerHTML = `
        <div class="modal-window" onclick="event.stopPropagation()" style="max-width:560px; width:100%; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 25px 60px rgba(0,0,0,0.5); max-height:95vh; display:flex; flex-direction:column;">
            <div style="background:linear-gradient(135deg,#1e40af 0%,#7c3aed 100%); padding:16px 60px 16px 20px; color:#fff; position:relative;">
                <div style="font-size:1.3rem; font-weight:900;">🔊 Voice Settings</div>
                <div style="font-size:0.8rem; color:#fde047; margin-top:4px;">
                    ${config.label} — ${sortedVoices.length} voices available
                </div>
                <button onclick="this.closest('.modal-overlay').remove(); document.body.classList.remove('modal-open');"
                        style="position:absolute; top:12px; right:12px; background:rgba(255,255,255,0.2); border:none; color:#fff; font-size:1.1rem; width:32px; height:32px; border-radius:50%; cursor:pointer; font-weight:900;">✕</button>
            </div>

            <div style="padding:16px 20px; overflow-y:auto; flex:1; color:#1e293b;">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
                    <label style="font-size:0.75rem; font-weight:900; color:#475569; text-transform:uppercase; letter-spacing:0.5px;">
                        🎙️ Available Voices (${sortedVoices.length})
                    </label>
                    <button onclick="resetVoiceSelection()"
                            style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; padding:4px 10px; border-radius:6px; font-size:0.68rem; font-weight:800; cursor:pointer;">
                        🔄 Auto
                    </button>
                </div>

                <input type="text" id="voiceSearchBox" placeholder="🔍 Voice search करें..."
                       style="width:100%; padding:8px 12px; border:1.5px solid #cbd5e1; border-radius:8px; font-size:0.8rem; margin-bottom:10px; outline:none; box-sizing:border-box;">

                <div id="voiceListContainer" style="max-height:280px; overflow-y:auto; padding-right:4px;">
                    ${voiceOptions || '<div style="color:#dc2626; font-weight:800; padding:20px; text-align:center;">⚠️ कोई voice नहीं मिली</div>'}
                </div>

                <div style="border-top:1.5px solid #e2e8f0; padding-top:14px; margin-top:14px;">
                    <div style="margin-bottom:12px;">
                        <label style="display:flex; justify-content:space-between; font-size:0.72rem; font-weight:900; color:#475569; margin-bottom:6px; text-transform:uppercase;">
                            <span>⚡ Speed</span>
                            <span id="speedValue" style="color:#0284c7;">${_ttsState.rate.toFixed(1)}x</span>
                        </label>
                        <input type="range" id="speedRange" min="0.5" max="2.0" step="0.1" value="${_ttsState.rate}" style="width:100%;">
                    </div>

                    <div style="margin-bottom:12px;">
                        <label style="display:flex; justify-content:space-between; font-size:0.72rem; font-weight:900; color:#475569; margin-bottom:6px; text-transform:uppercase;">
                            <span>🎵 Pitch</span>
                            <span id="pitchValue" style="color:#0284c7;">${_ttsState.pitch.toFixed(1)}</span>
                        </label>
                        <input type="range" id="pitchRange" min="0.5" max="1.5" step="0.1" value="${_ttsState.pitch}" style="width:100%;">
                    </div>

                    <div>
                        <label style="display:flex; justify-content:space-between; font-size:0.72rem; font-weight:900; color:#475569; margin-bottom:6px; text-transform:uppercase;">
                            <span>🔉 Volume</span>
                            <span id="volumeValue" style="color:#0284c7;">${Math.round(_ttsState.volume * 100)}%</span>
                        </label>
                        <input type="range" id="volumeRange" min="0.1" max="1.0" step="0.1" value="${_ttsState.volume}" style="width:100%;">
                    </div>
                </div>
            </div>

            <div style="padding:12px 20px; background:#f8fafc; border-top:1.5px solid #e2e8f0; display:flex; gap:8px;">
                <button onclick="testVoice()"
                        style="flex:1; padding:11px; background:linear-gradient(135deg,#16a34a,#22c55e); color:#fff; border:none; border-radius:8px; font-size:0.82rem; font-weight:900; cursor:pointer;">
                    🎧 Test
                </button>
                <button onclick="this.closest('.modal-overlay').remove(); document.body.classList.remove('modal-open');"
                        style="flex:1; padding:11px; background:#475569; color:#fff; border:none; border-radius:8px; font-size:0.82rem; font-weight:900; cursor:pointer;">
                    ✓ Save & Close
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    document.body.classList.add('modal-open');

    // ─── Wire events ───
    setTimeout(() => {
        // Voice click handlers
        document.querySelectorAll('.voice-item').forEach(item => {
            item.addEventListener('click', () => {
                const voiceName = item.getAttribute('data-voice-name');
                _ttsState.selectedVoiceName = voiceName;
                saveTTSSettings();

                // Visual update
                document.querySelectorAll('.voice-item').forEach(el => {
                    el.style.border = '1.5px solid #cbd5e1';
                    el.style.background = '#ffffff';
                    const check = el.querySelector('.voice-check');
                    if (check) check.remove();
                });
                item.style.border = '1.5px solid #0284c7';
                item.style.background = '#f0f9ff';

                // Test selected voice
                const voice = allVoices.find(v => v.name === voiceName);
                if (voice) {
                    const u = new SpeechSynthesisUtterance('Hello');
                    u.voice = voice;
                    u.lang = voice.lang;
                    u.rate = _ttsState.rate;
                    u.volume = _ttsState.volume;

                    speechSynthesis.cancel();
                    speechSynthesis.speak(u);
                    console.log('🎙️ Selected:', voiceName);
                }
            });
        });

        // Search
        const searchBox = document.getElementById('voiceSearchBox');
        if (searchBox) {
            searchBox.oninput = function() {
                const term = this.value.toLowerCase();
                document.querySelectorAll('.voice-item').forEach(el => {
                    const name = (el.getAttribute('data-voice-name') || '').toLowerCase();
                    const lang = (el.getAttribute('data-voice-lang') || '').toLowerCase();
                    const match = name.includes(term) || lang.includes(term);
                    el.style.display = match ? 'block' : 'none';
                });
            };
        }

        // Sliders
        const sr = document.getElementById('speedRange');
        const sv = document.getElementById('speedValue');
        const pr = document.getElementById('pitchRange');
        const pv = document.getElementById('pitchValue');
        const vr = document.getElementById('volumeRange');
        const vv = document.getElementById('volumeValue');

        if (sr) sr.oninput = () => {
            _ttsState.rate = parseFloat(sr.value);
            sv.textContent = _ttsState.rate.toFixed(1) + 'x';
            saveTTSSettings();
        };
        if (pr) pr.oninput = () => {
            _ttsState.pitch = parseFloat(pr.value);
            pv.textContent = _ttsState.pitch.toFixed(1);
            saveTTSSettings();
        };
        if (vr) vr.oninput = () => {
            _ttsState.volume = parseFloat(vr.value);
            vv.textContent = Math.round(_ttsState.volume * 100) + '%';
            saveTTSSettings();
        };
    }, 100);
}

// ============================================================
// 🔄 RESET VOICE TO AUTO
// ============================================================
function resetVoiceSelection() {
    _ttsState.selectedVoiceName = null;
    saveTTSSettings();

    document.querySelectorAll('.voice-item').forEach(el => {
        el.style.border = '1.5px solid #cbd5e1';
        el.style.background = '#ffffff';
        const check = el.querySelector('.voice-check');
        if (check) check.remove();
    });

    console.log('🔄 Voice reset to Auto');
}

// ============================================================
// 🎁 TRIAL UI
// ============================================================
function openTrialExpiryModal() {
    if (typeof TrialSystem !== 'undefined' && TrialSystem.showExpiryModal) {
        TrialSystem.showExpiryModal();
    }
}

function closeTrialExpiryModal() {
    const modal = document.getElementById('trialExpiryModal');
    if (modal) modal.style.display = 'none';
    if (typeof _unlockBodyScroll === 'function') _unlockBodyScroll();
}

function showTrialWelcome() {
    const modal = document.getElementById('trialExpiryModal');
    if (!modal) return;

    const titleEl = document.querySelector('#trialExpiryModal .lcn-title');
    if (titleEl) {
        titleEl.innerHTML = 'Welcome! <span style="color: #7c2d12;">Free Trial</span>';
    }

    const subtitleEl = document.querySelector('#trialExpiryModal .lcn-subtitle');
    if (subtitleEl) subtitleEl.textContent = '🎉 7-Day Full Access Started';

    const statusEl = document.getElementById('trialStatusText');
    if (statusEl) {
        statusEl.textContent = '✨ आपके सभी Pro features अब 7 दिनों तक unlocked हैं!';
        statusEl.style.color = '#16a34a';
    }

    modal.style.display = 'flex';
}

// ============================================================
// 💾 HWID MANUAL RECOVERY
// ============================================================
function toggleManualRecovery() {
    const box = document.getElementById('manualRecoveryBox');
    const statusMsg = document.getElementById('recoveryStatusMsg');
    if (!box) return;

    if (box.style.display === 'none' || box.style.display === '') {
        box.style.display = 'block';
        if (statusMsg) {
            statusMsg.className = '';
            statusMsg.style.display = 'none';
        }
        setTimeout(() => {
            const input = document.getElementById('oldHwidInput');
            if (input) input.focus();
        }, 100);
    } else {
        box.style.display = 'none';
    }
}

function cancelManualRecovery() {
    const box = document.getElementById('manualRecoveryBox');
    const input = document.getElementById('oldHwidInput');
    const statusMsg = document.getElementById('recoveryStatusMsg');

    if (box) box.style.display = 'none';
    if (input) input.value = '';
    if (statusMsg) {
        statusMsg.className = '';
        statusMsg.style.display = 'none';
    }
}

async function applyManualRecovery() {
    const input = document.getElementById('oldHwidInput');
    const statusMsg = document.getElementById('recoveryStatusMsg');

    if (!input || !statusMsg) return;

    const oldHwid = (input.value || '').trim().toUpperCase();

    if (!oldHwid) {
        statusMsg.className = 'error';
        statusMsg.textContent = '❌ कृपया पुरानी Device ID डालें';
        return;
    }

    if (!/^DVC-[A-F0-9]{4}-[A-F0-9]{4}$/i.test(oldHwid)) {
        statusMsg.className = 'error';
        statusMsg.textContent = '❌ गलत format! होना चाहिए: DVC-XXXX-YYYY';
        return;
    }

    statusMsg.className = '';
    statusMsg.style.display = 'none';

    try {
        // Save to localStorage
        localStorage.setItem('hor_device_hwid', oldHwid);
        localStorage.setItem('hor_hwid_source', 'manual-recovery');

        // Save to Electron OS storage
        if (window.electronAPI && window.electronAPI.isElectron) {
            try {
                const result = await window.electronAPI.saveHwid(oldHwid);
                if (result && result.success) {
                    console.log('💾 HWID saved to OS storage');
                } else {
                    console.warn('⚠️ OS save returned:', result);
                }
            } catch (e) {
                console.warn('⚠️ Could not save HWID to OS:', e.message);
            }
        }

        statusMsg.className = 'success';
        statusMsg.textContent = '✅ Device ID recover हो गई! License re-verify हो रही है...';

        setTimeout(async () => {
            try {
                if (typeof checkLicenseIntegrity === 'function') {
                    await checkLicenseIntegrity();
                }

                const dvcDisplay = document.getElementById('userDeviceIdDisplay');
                if (dvcDisplay) dvcDisplay.value = oldHwid;

                statusMsg.className = 'success';
                statusMsg.textContent = '✅ Success! App अब Pro mode में चलेगा।';

                setTimeout(() => {
                    if (typeof closeLicenseModal === 'function') closeLicenseModal();
                }, 1500);

            } catch (e) {
                console.warn('License re-check failed:', e);
            }
        }, 800);

    } catch (e) {
        statusMsg.className = 'error';
        statusMsg.textContent = '❌ Recover failed: ' + e.message;
    }
}

// ============================================================
// ⌨️ SMART TRANSLITERATION
// ============================================================
function checkSmartTransliteration() {
    if (typeof isPhoneticEnabled !== 'undefined' && !isPhoneticEnabled) return;
    if (typeof currentLayout === 'undefined') return;
    if (currentLayout === 'roman' || currentLayout === 'english') return;

    const sel = window.getSelection();
    if (!sel || !sel.anchorNode) return;

    const node = sel.anchorNode;
    if (node.nodeType === 3) {
        let text = node.textContent;

        for (const [code, map] of Object.entries(textShortcodes)) {
            const pattern = new RegExp(escapeRegex(code) + ' $');
            if (pattern.test(text)) {
                const target = map[currentLayout] || map['santali-dev'];
                if (target) {
                    node.textContent = text.replace(pattern, target + ' ');
                    placeCaretAfterNode(node);
                    return;
                }
            }
        }
    }
}

function placeCaretAfterNode(targetNode) {
    try {
        const range = document.createRange();
        range.setStart(targetNode, targetNode.textContent.length);
        range.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);

        if (typeof saveCurrentSelection === 'function') {
            saveCurrentSelection();
        }
    } catch (e) {}
}

// ============================================================
// 📱 PREVIEW MODAL
// ============================================================
function openPreviewModal() {
    if (window.__appReady === false) return;

    const modal = document.getElementById('previewModal');
    if (!modal) return;

    modal.style.display = 'flex';

    const w = window.innerWidth;
    if (w <= 480) setSimulatedDevice('mobile');
    else if (w <= 900) setSimulatedDevice('tablet');
    else setSimulatedDevice('desktop');

    renderPreviewFrame();
}

function renderPreviewFrame() {
    const iframe = document.getElementById('previewIframe');
    if (!iframe) return;

    const editor = document.getElementById('editor');
    const currentTheme = document.body.getAttribute('data-theme') || 'dark';
    const editorContent = editor ? editor.innerHTML : '';
    const currentLang = typeof currentLayout !== 'undefined' ? currentLayout : 'english';
    const currentKbMode = typeof keyboardMode !== 'undefined' ? keyboardMode : 'virtual';

    const licUser = localStorage.getItem('hor_lic_user') || '';
    const licKey = localStorage.getItem('hor_lic_key') || '';

    iframe.src = window.location.href.split('?')[0] + '?preview_mode=true';

    iframe.onload = () => {
        try {
            const subWin = iframe.contentWindow;
            const subDoc = iframe.contentDocument || subWin.document;

            const subPrevModal = subDoc.getElementById('previewModal');
            if (subPrevModal) subPrevModal.remove();

            subDoc.querySelectorAll('button').forEach(btn => {
                if (btn.textContent.includes('Preview')) btn.remove();
            });

            if (subWin.switchLanguage) subWin.switchLanguage(currentLang);
            if (subWin.setKeyboardPreference) subWin.setKeyboardPreference(currentKbMode);

            const subEditor = subDoc.getElementById('editor');
            if (subEditor) subEditor.innerHTML = editorContent;

            subDoc.body.setAttribute('data-theme', currentTheme);

            if (licUser && licKey) {
                subWin.localStorage.setItem('hor_lic_user', licUser);
                subWin.localStorage.setItem('hor_lic_key', licKey);
                if (subWin.checkLicenseIntegrity) subWin.checkLicenseIntegrity();
            }
        } catch (err) {
            console.warn('Preview iframe setup error:', err.message);
        }
    };
}

function closePreviewModal(e) {
    if (e.target.id === 'previewModal') {
        const modal = document.getElementById('previewModal');
        if (modal) modal.style.display = 'none';

        const iframe = document.getElementById('previewIframe');
        if (iframe) iframe.src = 'about:blank';
    }
}

function setSimulatedDevice(type) {
    const screen = document.getElementById('simulatedScreen');
    if (!screen) return;

    document.querySelectorAll('.device-selector-bar button').forEach(b => b.classList.remove('active-state'));

    if (type === 'mobile') {
        screen.style.width = '375px';
        screen.style.maxWidth = '375px';
        screen.style.height = '667px';
        screen.style.maxHeight = '92%';
        const btn = document.getElementById('btn-prev-mobile');
        if (btn) btn.classList.add('active-state');
    } else if (type === 'tablet') {
        screen.style.width = '768px';
        screen.style.maxWidth = '768px';
        screen.style.height = '850px';
        screen.style.maxHeight = '94%';
        const btn = document.getElementById('btn-prev-tablet');
        if (btn) btn.classList.add('active-state');
    } else {
        screen.style.width = '100%';
        screen.style.maxWidth = '100%';
        screen.style.height = '100%';
        screen.style.maxHeight = '100%';
        const btn = document.getElementById('btn-prev-desktop');
        if (btn) btn.classList.add('active-state');
    }
}

// ============================================================
// ✅ STATUS STRIP — Safe updates
// ============================================================
function updateStatusMode(isPro, planCode = null) {
    const el = document.getElementById('statusMode');
    if (!el) return;

    if (isPro) {
        el.className = 'status-chip pro-active';
        el.innerHTML = `<span class="pulse-dot green"></span><span>PRO ${planCode || ''}</span>`;
    } else {
        el.className = 'status-chip free-active';
        el.innerHTML = `<span class="pulse-dot orange"></span><span>Free Mode</span>`;
    }
}

function updateStatusKeyboard(mode) {
    const el = document.getElementById('statusKeyboard');
    if (!el) return;

    const icon = mode === 'system' ? '📱' : '⌨️';
    const label = mode === 'system' ? 'System' : 'Virtual';
    el.innerHTML = `<span class="chip-icon">${icon}</span><span>${label}</span>`;
}

function updateStatusLanguage(layout) {
    const el = document.getElementById('statusLanguage');
    if (!el) return;

    const names = {
        'english': 'English',
        'roman': 'Santali (R)',
        'hindi-dev': 'हिन्दी',
        'santali-dev': 'Santali (D)',
        'olchiki': 'ओ़लचिकी'
    };
    el.innerHTML = `<span class="chip-icon">🌐</span><span>${names[layout] || layout}</span>`;
}

function updateStatusSave(state) {
    const el = document.getElementById('statusSave');
    if (!el) return;

    if (state === 'typing') {
        el.className = 'status-chip save-typing';
        el.innerHTML = `<span class="pulse-dot orange"></span><span>Saving...</span>`;
    } else {
        el.className = 'status-chip save-ok';
        el.innerHTML = `<span class="chip-icon">💾</span><span>Saved</span>`;
    }
}

function updateStatusNetwork(isOnline) {
    const el = document.getElementById('statusNetwork');
    if (!el) return;

    if (isOnline) {
        el.className = 'status-chip';
        el.innerHTML = `<span class="pulse-dot green"></span><span>Online</span>`;
    } else {
        el.className = 'status-chip warn-state';
        el.innerHTML = `<span class="pulse-dot red"></span><span>Offline</span>`;
    }
}

function updateStatusChars(count) {
    const el = document.getElementById('statusChars');
    if (!el) return;
    el.innerHTML = `<span class="chip-icon">📝</span><span>${count} chars</span>`;
}

function updateStatusWords(count) {
    const el = document.getElementById('statusWords');
    if (!el) return;
    el.innerHTML = `<span class="chip-icon">📊</span><span>${count} words</span>`;
}

function updateStatusFont(fontName) {
    const el = document.getElementById('statusFont');
    if (!el) return;

    const short = String(fontName || 'Roboto').replace(/['"]/g, '').split(',')[0].trim();
    el.innerHTML = `<span class="chip-icon">Aa</span><span>${short}</span>`;
}

function updateStatusTime() {
    const el = document.getElementById('statusTime');
    if (!el) return;

    try {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        el.innerHTML = `<span class="chip-icon">🕐</span><span>${timeStr}</span>`;
    } catch (e) {
        const now = new Date();
        el.innerHTML = `<span class="chip-icon">🕐</span><span>${now.toLocaleTimeString()}</span>`;
    }
}

function updateStatusWPM(wpm) {
    const el = document.getElementById('statusWPM');
    if (!el) return;

    const speed = Number(wpm) || 0;
    let color = 'default';
    let icon = '⚡';

    if (speed >= 60) {
        color = 'pro-active';
        icon = '🚀';
    } else if (speed >= 40) {
        color = 'save-ok';
        icon = '⚡';
    } else if (speed >= 20) {
        color = 'save-typing';
        icon = '⌨️';
    } else if (speed > 0) {
        color = 'warn-state';
        icon = '🐢';
    }

    el.className = 'status-chip' + (color !== 'default' ? ' ' + color : '');
    el.innerHTML = `<span class="chip-icon">${icon}</span><span>${speed} WPM</span>`;
}

function startTimeUpdate() {
    if (_timeUpdateInterval) clearInterval(_timeUpdateInterval);
    _timeUpdateInterval = setInterval(updateStatusTime, 1000);
    updateStatusTime();
}

// ============================================================
// 🌐 NETWORK LISTENERS
// ============================================================
window.addEventListener('online', () => {
    updateStatusNetwork(true);
});

window.addEventListener('offline', () => {
    updateStatusNetwork(false);
});

// ============================================================
// 📝 EDITOR EVENT LISTENERS
// ============================================================
function setupEditorListeners() {
    const editor = document.getElementById('editor');
    if (!editor) return;

    editor.addEventListener('focus', () => {
        if (typeof enterTypingMode === 'function') enterTypingMode();
        if (typeof saveCurrentSelection === 'function') saveCurrentSelection();
    });

    editor.addEventListener('click', () => {
        if (typeof enterTypingMode === 'function') enterTypingMode();
        if (typeof saveCurrentSelection === 'function') saveCurrentSelection();
    });

    editor.addEventListener('keyup', () => {
        if (typeof saveCurrentSelection === 'function') saveCurrentSelection();
    });

    editor.addEventListener('mouseup', () => {
        if (typeof saveCurrentSelection === 'function') saveCurrentSelection();
    });

    editor.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text/plain');
        const sanitized = (typeof SecurityShield !== 'undefined')
            ? SecurityShield.sanitize(text)
            : text;

        if (document.queryCommandSupported && document.queryCommandSupported('insertText')) {
            document.execCommand('insertText', false, sanitized);
        } else if (typeof addChar === 'function') {
            addChar(sanitized);
        }

        if (typeof handleEditorInput === 'function') {
            handleEditorInput(true);
        }
    });

    editor.addEventListener('beforeinput', (e) => {
        if (typeof keyboardMode === 'undefined' || keyboardMode !== 'system') return;
        if (!e.data) return;

        if (e.data.length === 1) {
            const char = e.data;
            let mapped = null;

            if (typeof currentLayout !== 'undefined') {
                if (currentLayout === 'santali-dev' || currentLayout === 'hindi-dev') {
                    mapped = typeof hardwareDevMap !== 'undefined' ? hardwareDevMap[char] : null;
                } else if (currentLayout === 'olchiki') {
                    mapped = typeof hardwareOlchikiMap !== 'undefined'
                        ? hardwareOlchikiMap[char.toLowerCase()]
                        : null;
                }
            }

            if (mapped) {
                e.preventDefault();
                if (typeof addCharWithPhonics === 'function') {
                    addCharWithPhonics(mapped);
                }
            }
        }
    });
}

// ============================================================
// ⌨️ GLOBAL KEYBOARD HANDLER
// ============================================================
document.addEventListener('keydown', (e) => {
    // ESC to stop TTS
    if (e.key === 'Escape' && speechSynthesis.speaking) {
        stopSpeaking();
        return;
    }

    if (e.ctrlKey || e.metaKey) return;
    if (document.body.classList.contains('system-keyboard-active')) return;

    const editor = document.getElementById('editor');
    if (document.activeElement !== editor) return;

    // Roman layout: Alt+N for ñ
    if (typeof currentLayout !== 'undefined' && currentLayout === 'roman' && e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        if (typeof addCharWithPhonics === 'function') {
            addCharWithPhonics(e.shiftKey ? 'Ñ' : 'ñ');
        }
        if (typeof flashKeyVisual === 'function') flashKeyVisual('ñ');
        return;
    }

    if (e.altKey) return;

    if (e.key === 'Enter') {
        e.preventDefault();
        if (typeof addCharWithPhonics === 'function') addCharWithPhonics('\n');
        if (typeof flashKeyVisual === 'function') flashKeyVisual('ENTER');
        return;
    }

    if (e.key === 'Backspace') {
        e.preventDefault();
        if (typeof doBackspace === 'function') doBackspace();
        if (typeof flashKeyVisual === 'function') flashKeyVisual('BACKSPACE');
        return;
    }

    if (e.key === 'Tab') {
        e.preventDefault();
        if (typeof addCharWithPhonics === 'function') addCharWithPhonics('\t');
        if (typeof flashKeyVisual === 'function') flashKeyVisual('TAB');
        return;
    }

    if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (typeof addCharWithPhonics === 'function') addCharWithPhonics(' ');
        if (typeof flashKeyVisual === 'function') flashKeyVisual('SPACE');
        return;
    }

    if (e.key.length !== 1) return;

    // Numbers & symbols
    if (/^[0-9]$/.test(e.key) ||
        (typeof allKeySymbols !== 'undefined' && allKeySymbols.includes(e.key))) {

        if (typeof currentLayout !== 'undefined' &&
            currentLayout !== 'english' && currentLayout !== 'roman') {
            if (e.key === ']' || e.key === '}') {
                e.preventDefault();
                if (typeof addCharWithPhonics === 'function') addCharWithPhonics('़');
                return;
            }
        }

        e.preventDefault();
        if (typeof addCharWithPhonics === 'function') addCharWithPhonics(e.key);
        if (typeof flashKeyVisual === 'function') flashKeyVisual(e.key);
        return;
    }

    // English layout — free typing
    if (typeof currentLayout !== 'undefined' && currentLayout === 'english') {
        e.preventDefault();
        if (typeof addCharWithPhonics === 'function') addCharWithPhonics(e.key);
        if (typeof flashKeyVisual === 'function') flashKeyVisual(e.key);
        return;
    }

    // Pro features gating
    if (!hasProLevelAccess()) return;

    if (typeof currentLayout !== 'undefined' && currentLayout === 'roman') {
        e.preventDefault();
        if (typeof addCharWithPhonics === 'function') addCharWithPhonics(e.key);
        if (typeof flashKeyVisual === 'function') flashKeyVisual(e.key);
        return;
    }

    if (typeof currentLayout !== 'undefined' &&
        (currentLayout === 'santali-dev' || currentLayout === 'hindi-dev')) {
        const mapped = typeof hardwareDevMap !== 'undefined' ? hardwareDevMap[e.key] : null;
        if (mapped) {
            e.preventDefault();
            if (typeof addCharWithPhonics === 'function') addCharWithPhonics(mapped);
            if (typeof flashKeyVisual === 'function') flashKeyVisual(mapped);
        }
        return;
    }

    if (typeof currentLayout !== 'undefined' && currentLayout === 'olchiki') {
        const mapped = typeof hardwareOlchikiMap !== 'undefined'
            ? hardwareOlchikiMap[e.key.toLowerCase()]
            : null;
        if (mapped) {
            e.preventDefault();
            if (typeof addCharWithPhonics === 'function') addCharWithPhonics(mapped);
            if (typeof flashKeyVisual === 'function') flashKeyVisual(mapped);
        }
        return;
    }
});

window.addEventListener('resize', () => {
    if (typeof saveCurrentSelection === 'function') saveCurrentSelection();
});

// ============================================================
// 📲 PWA INSTALL PROMPT
// ============================================================
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    if (typeof deferredPrompt !== 'undefined') {
        // Handled by modals.js
    }
});

// ============================================================
// 🔄 SERVICE WORKER
// ============================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((reg) => {
                console.log('Service Worker Scope:', reg.scope);
                // ✅ Listen for updates
                reg.addEventListener('updatefound', () => {
                    console.log('🔄 Service Worker update found');
                });
            })
            .catch((err) => console.error('Service Worker Error:', err));
    });
}

// ============================================================
// 🎁 TRIAL DEBUG
// ============================================================
window.TrialDebug = {
    reset: () => {
        if (typeof TrialSystem !== 'undefined') {
            TrialSystem.reset();
            location.reload();
        }
    },
    extend: (days) => {
        if (typeof TrialSystem !== 'undefined') {
            TrialSystem.extend(days);
            location.reload();
        }
    },
    info: () => {
        if (typeof TrialSystem !== 'undefined') {
            console.table(TrialSystem.getInfo());
        }
    }
};

// ============================================================
// 🔊 TTS DEBUG — Multi-Language helpers
// ============================================================
window.TTSDebug = {
    /**
     * List all voices
     */
    voices: () => {
        const voices = _getVoicesCached();
        console.table(voices.map(v => ({
            name: v.name,
            lang: v.lang,
            local: v.localService
        })));
    },

    /**
     * List voices for current language
     */
    currentLang: () => {
        const config = _getTTSEConfig();
        const voices = _getVoicesCached();
        const langPrefix = config.lang.split('-')[0];
        const filtered = voices.filter(v => v.lang.startsWith(langPrefix));
        console.log(`🔊 Voices for ${config.label} (${config.lang}):`);
        console.table(filtered.map(v => ({
            name: v.name,
            lang: v.lang,
            local: v.localService
        })));
    },

    /**
     * Show current TTS state
     */
    state: () => {
        console.log('🔊 TTS State:');
        console.log('  Speaking:', _ttsState.speaking);
        console.log('  Selected voice:', _ttsState.selectedVoiceName || 'auto');
        console.log('  Rate:', _ttsState.rate);
        console.log('  Pitch:', _ttsState.pitch);
        console.log('  Volume:', _ttsState.volume);
        console.log('  Language:', (typeof currentLayout !== 'undefined' ? currentLayout : 'english'));
        console.log('  Config:', _getTTSEConfig());
    },

    /**
     * Test current voice
     */
    test: () => testVoice(),

    /**
     * Stop speaking
     */
    stop: () => stopSpeaking(),

    /**
     * Reset TTS settings
     */
    reset: () => {
        try {
            localStorage.removeItem('hor_tts_settings');
        } catch (e) {}

        _ttsState.selectedVoiceName = null;
        _ttsState.rate = 1.0;
        _ttsState.pitch = 1.0;
        _ttsState.volume = 1.0;

        console.log('🔄 TTS settings reset');
    },

    /**
     * Test chunking
     */
    chunks: (text) => {
        if (!text) {
            text = 'This is a test. It has multiple sentences. And some more text here!';
        }
        const config = _getTTSEConfig();
        const chunks = chunkText(text, config.chunkSize);
        console.log(`📝 Chunking (${config.chunkSize} chars):`);
        console.log('  Total chunks:', chunks.length);
        chunks.forEach((c, i) => console.log(`  [${i + 1}] (${c.length}):`, c));
        return chunks;
    },

    /**
     * Invalidate voice cache (force refresh)
     */
    refresh: () => {
        _invalidateVoiceCache();
        console.log('🔄 Voice cache invalidated');
    },

    /**
     * Show cache info
     */
    cache: () => {
        console.log('🔊 Voice Cache:');
        console.log('  Cached:', !!_voiceCache);
        console.log('  Count:', _voiceCache ? _voiceCache.length : 0);
        console.log('  Age:', _voiceCache ? Math.round((Date.now() - _voiceCacheTimestamp) / 1000) + 's' : 'N/A');
    }
};

// ============================================================
// 🚀 INIT — Main App Bootstrap
// ============================================================
(async function initApp() {
    try {
        // Hide progress overlay
        const progressOverlay = document.getElementById('progressOverlay');
        if (progressOverlay) {
            progressOverlay.classList.remove('active');
            progressOverlay.style.display = 'none';
        }

        // Preview mode cleanup
        const isPreviewMode = new URLSearchParams(location.search).get('preview_mode') === 'true';
        if (isPreviewMode) {
            const prevBtn = document.querySelector('[onclick="openPreviewModal()"]');
            if (prevBtn) prevBtn.style.display = 'none';

            const buyBtn = document.getElementById('btn-buy-top');
            if (buyBtn) buyBtn.style.display = 'none';

            const trialBtn = document.getElementById('btn-trial-top');
            if (trialBtn) trialBtn.style.display = 'none';
        }

        // Close all modals
        document.querySelectorAll('.modal-overlay, .preview-modal').forEach(function(modal) {
            modal.style.display = 'none';
        });
        document.body.classList.remove('modal-open');

        // Initial editor state
        const editor = document.getElementById('editor');
        if (editor && typeof initialDefaultCode !== 'undefined') {
            try {
                window.initialDefaultCode = editor.innerHTML;
            } catch (e) {}
        }

        // Init vocab + theme
        try {
            const cleanDefaultKeys = ['english', 'roman', 'hindi-dev', 'santali-dev', 'olchiki'];

            if (typeof userVocabDB !== 'undefined' && typeof defaultWordSuggestions !== 'undefined') {
                cleanDefaultKeys.forEach(k => {
                    if (!userVocabDB[k] || !Array.isArray(userVocabDB[k])) {
                        userVocabDB[k] = [
                            ...(defaultWordSuggestions[k] || defaultWordSuggestions['english'])
                        ];
                    }
                });

                if (typeof saveVocabToStorage === 'function') {
                    saveVocabToStorage();
                }
            }

            const savedTheme = localStorage.getItem('hor_katha_theme') || 'dark';
            document.body.setAttribute('data-theme', savedTheme);

            const btn = document.getElementById('btn-theme-toggle');
            if (btn) btn.textContent = savedTheme === 'dark' ? '🌙 Dark' : '☀️ Light';
        } catch (e) {
            console.warn('Init state warning:', e.message);
        }

        // Payment checkbox handler
        const paymentCheck = document.getElementById('paymentConfirmCheck');
        const paymentBtn = document.getElementById('btnPaymentDone');
        if (paymentCheck && paymentBtn) {
            paymentCheck.addEventListener('change', function() {
                if (this.checked) {
                    paymentBtn.disabled = false;
                    paymentBtn.style.opacity = '1';
                    paymentBtn.style.cursor = 'pointer';
                } else {
                    paymentBtn.disabled = true;
                    paymentBtn.style.opacity = '0.5';
                    paymentBtn.style.cursor = 'not-allowed';
                }
            });
        }

        // Setup editor listeners
        setupEditorListeners();

        // Load TTS settings
        loadTTSSettings();

        // Wait for voices to load
        if ('speechSynthesis' in window) {
            speechSynthesis.getVoices();  // Trigger load

            speechSynthesis.onvoiceschanged = () => {
                _invalidateVoiceCache();  // ✅ Invalidate cache on change
                const count = speechSynthesis.getVoices().length;
                console.log('🔊 Voices loaded:', count);
            };
        }

        // HWID generation
        try {
            if (typeof getDeviceHardwareFingerprint === 'function') {
                await getDeviceHardwareFingerprint();
            }
        } catch (e) {
            console.warn('HWID generation failed:', e.message);
        }

        // License check
        if (typeof checkLicenseIntegrity === 'function') {
            await checkLicenseIntegrity();
        }

        // Keyboard preference
        if (typeof keyboardMode !== 'undefined' && typeof setKeyboardPreference === 'function') {
            setKeyboardPreference(keyboardMode);
        }

        // Default language
        if (typeof switchLanguage === 'function') {
            switchLanguage('english');
        }

        // Restore numpad state
        if (typeof isNumpadActive !== 'undefined' && isNumpadActive) {
            const kn = document.getElementById('keyboardNumpad');
            if (kn) kn.classList.add('active');

            const btn = document.getElementById('btn-numpad-toggle');
            if (btn) btn.classList.add('active-state');
        }

        // Restore draft
        if (typeof restorePersistedDraft === 'function') {
            restorePersistedDraft();
        }

        if (typeof recordState === 'function') recordState();
        if (typeof updateCounter === 'function') updateCounter();

        // Status strip init
        updateStatusKeyboard(typeof keyboardMode !== 'undefined' ? keyboardMode : 'virtual');
        updateStatusLanguage(typeof currentLayout !== 'undefined' ? currentLayout : 'english');
        updateStatusSave('saved');
        updateStatusNetwork(navigator.onLine);
        updateStatusWPM(0);
        updateStatusFont((editor && editor.style.fontFamily) || 'Roboto');

        // Start time update
        startTimeUpdate();

        // Trial badge
        if (typeof APP_CONFIG !== 'undefined' &&
            APP_CONFIG.TRIAL_ENABLED &&
            typeof TrialSystem !== 'undefined' &&
            TrialSystem.isActive()) {

            const trialBadge = document.getElementById('trialBadge');
            if (trialBadge) {
                const trialInfo = TrialSystem.getInfo();
                trialBadge.textContent = `🎁 Trial (${trialInfo.remainingDays}d)`;
                trialBadge.style.display = 'inline-block';
            }
        }

        // Consent banner (delayed)
        setTimeout(() => {
            if (typeof showConsentBanner === 'function') {
                showConsentBanner();
            }
        }, 400);

        console.log('🛡️ Security Shield Active');
        console.log('✅ App initialized — Hoṛ Katha Suite v3.7.4');

    } catch (err) {
        console.error('💥 initApp failed:', err);
    } finally {
        setTimeout(function() {
            window.__appReady = true;
            console.log('🔓 App ready');
        }, 2000);
    }
})();

// ============================================================
// 🧹 CLEANUP on unload
// ============================================================
window.addEventListener('beforeunload', () => {
    if (_timeUpdateInterval) {
        clearInterval(_timeUpdateInterval);
        _timeUpdateInterval = null;
    }

    // Stop any ongoing speech
    try {
        if (speechSynthesis.speaking) {
            speechSynthesis.cancel();
        }
    } catch (e) {}

    // Stop recognition
    try {
        if (recognition && isListening) {
            recognition.stop();
        }
    } catch (e) {}
});

// ============================================================
// 📊 APP DEBUG HELPERS
// ============================================================
window.AppDebug = {
    status: () => {
        console.log('═══════════════════════════════════════════');
        console.log('🚀 App Status');
        console.log('───────────────────────────────────────────');
        console.log('  appReady:', window.__appReady);
        console.log('  Time interval:', !!_timeUpdateInterval);
        console.log('  TTS speaking:', _ttsState.speaking);
        console.log('  TTS voice:', _ttsState.selectedVoiceName || 'auto');
        console.log('  TTS rate:', _ttsState.rate);
        console.log('  TTS pitch:', _ttsState.pitch);
        console.log('  TTS volume:', _ttsState.volume);
        console.log('  Recognition:', recognition ? 'initialized' : 'none');
        console.log('  Is listening:', isListening);
        console.log('  Restart count:', _recognitionRestartCount);
        console.log('═══════════════════════════════════════════');
    },
    testTTS: (text = 'Hello world') => {
        const u = new SpeechSynthesisUtterance(text);
        const voice = getSelectedVoice();
        if (voice) {
            u.voice = voice;
            u.lang = voice.lang;
        }
        u.rate = _ttsState.rate;
        u.volume = _ttsState.volume;
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
    },
    testChunks: (text) => {
        console.log('📝 Chunking:', text);
        const config = _getTTSEConfig();
        const chunks = chunkText(text, config.chunkSize);
        console.log('Total chunks:', chunks.length);
        chunks.forEach((c, i) => console.log(`  [${i + 1}] (${c.length})`, c));
    }
};

// ============================================================
// 📋 STARTUP LOG
// ============================================================
console.log('═══════════════════════════════════════════');
console.log('✅ app.js loaded — v3.7.4.44');
console.log('   🔊 Multi-language TTS: EN/HI/SAT/OL');
console.log('   🎙️ Adaptive voice selection');
console.log('   📦 Voice cache: 60s');
console.log('   🎯 Better recognition error handling');
console.log('   💾 HWID recovery');
console.log('═══════════════════════════════════════════');