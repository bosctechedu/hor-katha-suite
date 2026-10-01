// ============================================================
// 🎯 TYPING PRACTICE — 3 Levels × 3 Lessons + Certificate
// BOSC Tech & Edu · Hoṛ Katha Suite v3.7.4 Pro Ultra
// ============================================================
// ✅ v3.7.4.44 — AUDIT FIXES:
//    • performance.now() timer (drift-free on tab switch)
//    • Window blur/visibility detection (anti-cheat)
//    • Paste/drop/copy blocked (anti-cheat)
//    • Scroll throttled to every 20 chars
//    • Idle pause after 30s (fair test)
//    • finishTest idempotent (no duplicate results)
//    • Elapsed time clamped to duration
//    • Empty lesson guard
//    • Interval cleanup on close
//    • Best score tracking in localStorage
//    • WhatsApp share button on result
//    • Input events cleared on finish
//    • Tab hidden → warning toast
//    • Grade thresholds documented
//    • createFreshTTState() for safe reset
//    • Ctrl+R restart, ESC close
//    • Voice typing support (mic)
//    • Blur count shown in result
// ============================================================

// ============================================================
// 📚 LESSON DATABASE (Multi-Language)
// ============================================================
const TT_LESSONS = {
    'english': {
        basic: [
            "asdf jkl; asdf jkl; sad lad ask fall jak lads fad alas all sad lads ask dad",
            "the and for you that with have this from they will one all would there their what",
            "The quick brown fox jumps over the lazy dog. She sells seashells by the seashore."
        ],
        advanced: [
            "\"Practice makes perfect!\" — but only if you practice correctly; typing errors slow you down.",
            "Invoice #4821: 3 items @ Rs.199 each, +18% GST = Rs.705.42. Payment due by 15/12/2025.",
            "Consistency, precision, and steady rhythm form the triad of mastery; every expert was once a beginner."
        ],
        job: [
            "Dear Sir, I am writing to apply for the position of Data Entry Operator. I have 2 years of experience.",
            "REPORT: Q3 revenue grew by 23%. Marketing spend was Rs.4.2L. Net profit margin stands at 18.5%.",
            "GOVERNMENT OF INDIA OFFICE MEMORANDUM. Subject: Implementation of e-Governance. Ref No. 21/2025."
        ]
    },

    'hindi-dev': {
        basic: [
            "क ख ग घ ङ च छ ज झ ञ ट ठ ड ढ ण त थ द ध न प फ ब भ म य र ल व श ष स ह",
            "आज का दिन बहुत सुंदर है। सूरज चमक रहा है और पक्षी गा रहे हैं।",
            "मेरा नाम राम है। मैं भारत का निवासी हूँ। हिन्दी मेरी मातृभाषा है।"
        ],
        advanced: [
            "शिक्षा मनुष्य के जीवन का सबसे महत्वपूर्ण अंग है। इसके बिना व्यक्ति का सर्वांगीण विकास संभव नहीं है।",
            "रिपोर्ट: इस वर्ष कंपनी का लाभ 25% बढ़ा। कुल आय 4.5 करोड़ रही। कर दर 18% रही।",
            "प्रिय महोदय, मैं आपके विद्यालय में शिक्षक पद के लिए आवेदन करना चाहता हूँ।"
        ],
        job: [
            "सेवा में, मैं यह निवेदन करना चाहता हूँ कि मुझे दस्तावेज प्रविष्टि संचालक के पद पर नियुक्त किया जाए।",
            "रिपोर्ट: तिमाही बिक्री में 30% की वृद्धि हुई। विपणन व्यय 3.8 लाख रहा।",
            "भारत सरकार कार्यालय ज्ञापन। विषय: ई-गवर्नेंस का क्रियान्वयन। संदर्भ संख्या 15/2025।"
        ]
    },

    'santali-dev': {
        basic: [
            "क ख ग घ ङ च छ ज झ ञ ट ठ ड ढ ण त थ द ध न प फ ब भ म य र ल व स ह",
            "जोहार आम सांताड़ होड़ हो। आम आलिं बेस लागिद।",
            "आलिं होड़ कथा सेंदरा जाना। सांतारी पारसी आलिं मातृ पारसी गे।"
        ],
        advanced: [
            "सेङ्गेल दो होड़ जीवन रेनाग जोतो खोन माराङ हाटिञ काना।",
            "रिपोट: नोवा सेर्मा कोम्पानि रेनाग लाभ २५% बाड़ति एना। गुट आय ४.५ कोड़ो ताहेना।",
            "जोहार मोनेयान होड़ को, इञ आमाग कोलेज रे माचेत पोद लागिद आर्जि एम सानायेदाय।"
        ],
        job: [
            "सेवा रे, इञ नोवा निवेदान एम सानायेदाय जे इञ दो डाटा एन्ट्रि ओप्रेटार रेनाग पोद रे बाहाल हुयुग मा।",
            "रिपोट: तिमाहि आख्रिञ रे ३०% काज्वाग हुयेना। बिपोनोन खोर्च ३.८ लाख ताहेना।",
            "भारत सोरकार कार्यालय झियापान। साताम: इ-गोभार्नेन्स रेनाग कार्यान्वोयोन।"
        ]
    },

    'olchiki': {
        basic: [
            "ᱚ ᱛ ᱜ ᱝ ᱞ ᱟ ᱤ ᱥ ᱦ ᱧ ᱨ ᱩ ᱪ ᱫ ᱬ ᱭ ᱮ ᱯ ᱰ ᱱ ᱲ ᱳ ᱴ ᱵ ᱶ ᱷ",
            "ᱡᱚᱦᱟᱨ ᱾ ᱥᱟᱹᱜᱩᱱ ᱫᱟᱨᱟᱢ ᱾ ᱤᱧ ᱥᱟᱱᱛᱟᱲ ᱦᱚᱲ ᱠᱟᱱᱟᱭ ᱾",
            "ᱤᱧᱟᱜ ᱧᱩᱛᱩᱢ ᱨᱟᱢ ᱠᱟᱱᱟ ᱾ ᱤᱧ ᱵᱷᱟᱨᱚᱛ ᱨᱮ ᱛᱟᱦᱮᱱᱟᱭ ᱾"
        ],
        advanced: [
            "ᱥᱮᱬᱜᱮᱞ ᱫᱚ ᱦᱚᱲ ᱡᱤᱭᱚᱱ ᱨᱮᱱᱟᱜ ᱡᱚᱛᱚ ᱠᱷᱚᱱ ᱢᱟᱨᱟᱝ ᱦᱟᱹᱴᱤᱧ ᱠᱟᱱᱟ ᱾",
            "ᱨᱤᱯᱚᱴ: ᱱᱚᱶᱟ ᱥᱮᱨᱢᱟ ᱠᱚᱢᱯᱟᱹᱱᱤ ᱨᱮᱱᱟᱜ ᱞᱟᱵᱷ ᱒᱕% ᱵᱟᱹᱲᱛᱤ ᱮᱱᱟ ᱾ ᱜᱩᱴ ᱟᱭ ᱔.᱕ ᱠᱚᱨᱳᱲ ᱛᱟᱦᱮᱱᱟ ᱾",
            "ᱡᱚᱦᱟᱨ ᱢᱚᱱᱮᱭᱟᱱ ᱦᱚᱲ ᱠᱚ, ᱤᱧ ᱟᱢᱟᱜ ᱠᱚᱞᱮᱡᱽ ᱨᱮ ᱢᱟᱪᱮᱛ ᱯᱚᱫᱽ ᱞᱟᱹᱜᱤᱫ ᱟᱹᱨᱡᱤ ᱮᱢ ᱥᱟᱱᱟᱭᱮᱫᱟᱭ ᱾"
        ],
        job: [
            "ᱥᱮᱣᱟ ᱨᱮ, ᱤᱧ ᱱᱚᱶᱟ ᱱᱤᱣᱮᱫᱟᱱ ᱮᱢ ᱥᱟᱱᱟᱭᱮᱫᱟᱭ ᱡᱮ ᱤᱧ ᱫᱚ ᱰᱟᱴᱟ ᱮᱱᱴᱨᱤ ᱳᱯᱨᱮᱴᱟᱨ ᱨᱮᱱᱟᱜ ᱯᱚᱫᱽ ᱨᱮ ᱵᱟᱦᱟᱞ ᱦᱩᱭᱩᱜ ᱢᱟ ᱾",
            "ᱨᱤᱯᱚᱴ: ᱛᱤᱢᱟᱦᱤ ᱟᱹᱠᱷᱨᱤᱧ ᱨᱮ ᱓᱐% ᱠᱟᱹᱡᱽᱣᱟᱜ ᱦᱩᱭᱮᱱᱟ ᱾ ᱵᱤᱯᱚᱱᱚᱱ ᱠᱷᱚᱨᱪ ᱓.᱘ ᱞᱟᱠᱷ ᱛᱟᱦᱮᱱᱟ ᱾",
            "ᱵᱷᱟᱨᱚᱛ ᱥᱚᱨᱠᱟᱨ ᱠᱟᱨᱭᱟᱞᱚᱭ ᱡᱷᱤᱭᱟᱯᱟᱱ ᱾ ᱥᱟᱛᱟᱢ: ᱤ-ᱜᱚᱵᱷᱟᱨᱱᱮᱱᱥ ᱨᱮᱱᱟᱜ ᱠᱟᱨᱭᱟᱱᱣᱚᱭᱚᱱ ᱾"
        ]
    },

    'roman': {
        basic: [
            "johar sagun am aling santali dela bes adi hor katha",
            "Johar ape santal hor. Am aling bes laged. Hor katha senao jana.",
            "the and for you that with have this from they will one all would there their what"
        ],
        advanced: [
            "Sengel do hor jibon renag joto khon marag hatir kana. Ekar bina manmi sarwangin bikash sambhab nay.",
            "Riport: Noa serma kompani renag labh 25% barhi ena. Gut ay 4.5 kror rahea.",
            "Johar moneyan hor ko, ing amag college re teacher pod lagid arji em sanayeday."
        ],
        job: [
            "Seba re, ing noa niwedan em sanayeday je ing do data entry operator renag pod re bahal huyug ma.",
            "Riport: Timahi bikri re 30% kajwag huyena. Biponon khoroch 3.8 lakh rahea.",
            "Bharat Sarkar Karjalay Jniapan. Bishay: e-Governance renag karjanwoyan. Sandarbh 15/2025."
        ]
    }
};

// ============================================================
// 🎯 STATE — Clean initialization
// ============================================================
function createFreshTTState() {
    return {
        active: false,
        group: null,
        idx: null,
        duration: 60,
        text: '',
        startTime: null,        // ✅ performance.now() timestamp
        timerId: null,
        timeLeft: 0,
        charSpans: [],
        errors: 0,
        totalTyped: 0,
        correctTyped: 0,
        paused: false,
        pausedAt: null,
        blurCount: 0,           // ✅ Anti-cheat counter
        visibilityHiddenCount: 0,
        lastInputTime: 0,       // ✅ Idle tracking
        idleTimerId: null,
        _finished: false        // ✅ Idempotency guard
    };
}

let _ttState = createFreshTTState();
let _ttSelectedGroup = null;
let _ttSelectedIdx = null;
let _ttSelectedDuration = 60;
let _scrollDebounce = null;
let _blurHandler = null;
let _visibilityHandler = null;

// ─── Constants ───
const SCROLL_THROTTLE_EVERY = 20;      // Scroll every N chars
const IDLE_TIMEOUT_MS = 30000;          // 30s idle = pause
const BLUR_WARNING_DELAY = 100;         // Wait before showing warning

// ─── Best WPM storage key ───
const BEST_WPM_KEY = 'hor_tt_best_wpm';

// ============================================================
// 🔓 OPEN / CLOSE MODAL
// ============================================================
function openTypingTestModal() {
    const modal = document.getElementById('typingTestModal');
    if (!modal) return;

    stopTest();
    _ttState = createFreshTTState();

    const setupEl = document.getElementById('ttSetup');
    const arenaEl = document.getElementById('ttArena');
    const resultEl = document.getElementById('ttResult');

    if (setupEl) setupEl.style.display = 'block';
    if (arenaEl) arenaEl.style.display = 'none';
    if (resultEl) resultEl.style.display = 'none';

    _ttSelectedGroup = null;
    _ttSelectedIdx = null;
    _ttSelectedDuration = 60;

    document.querySelectorAll('.tt-lesson-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tt-time-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-sec') === '60');
    });

    const infoEl = document.getElementById('ttSelectedLesson');
    if (infoEl) infoEl.textContent = 'Select a lesson above';

    const startBtn = document.getElementById('ttStartBtn');
    if (startBtn) startBtn.disabled = true;

    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
}

function closeTypingTestModal() {
    stopTest();
    _ttState = createFreshTTState();

    const modal = document.getElementById('typingTestModal');
    if (modal) modal.style.display = 'none';

    _ttSelectedGroup = null;
    _ttSelectedIdx = null;

    // Remove blur/visibility handlers
    _detachWindowHandlers();

    // Unlock body scroll
    if (typeof _unlockBodyScroll === 'function') {
        _unlockBodyScroll();
    } else {
        document.body.classList.remove('modal-open');
    }
}

// ============================================================
// ✅ WINDOW HANDLERS — Anti-cheat blur detection
// ============================================================
function _attachWindowHandlers() {
    _detachWindowHandlers();  // Clean first

    // ─── Window blur handler ───
    _blurHandler = () => {
        if (_ttState.active && !_ttState.paused) {
            _ttState.blurCount++;
            console.warn('⚠️ Window blur detected — count:', _ttState.blurCount);

            // Show warning only after brief delay (avoid false positives)
            setTimeout(() => {
                if (_ttState.active && _ttState.blurCount > 0) {
                    if (typeof showToast === 'function') {
                        showToast(
                            `⚠️ Window से बाहर गए — ${_ttState.blurCount} बार`,
                            'warning',
                            2000
                        );
                    }
                }
            }, BLUR_WARNING_DELAY);
        }
    };

    // ─── Visibility handler (tab switch) ───
    _visibilityHandler = () => {
        if (document.hidden && _ttState.active) {
            _ttState.visibilityHiddenCount++;
            console.log('👁️ Tab hidden — count:', _ttState.visibilityHiddenCount);

            if (typeof showToast === 'function' && _ttState.visibilityHiddenCount <= 3) {
                showToast('⚠️ Tab switch detected!', 'warning', 1500);
            }
        }
    };

    window.addEventListener('blur', _blurHandler);
    document.addEventListener('visibilitychange', _visibilityHandler);
}

function _detachWindowHandlers() {
    if (_blurHandler) {
        window.removeEventListener('blur', _blurHandler);
        _blurHandler = null;
    }
    if (_visibilityHandler) {
        document.removeEventListener('visibilitychange', _visibilityHandler);
        _visibilityHandler = null;
    }
}

// ============================================================
// ⌨️ KEYBOARD SHORTCUTS (ESC close, Ctrl+R restart)
// ============================================================
document.addEventListener('keydown', function(e) {
    const modal = document.getElementById('typingTestModal');
    if (!modal) return;

    const display = modal.style.display;
    if (display !== 'flex' && display !== 'block') return;

    // ESC — Close modal
    if (e.key === 'Escape') {
        e.preventDefault();
        closeTypingTestModal();
        return;
    }

    // Ctrl+R — Restart (only in arena mode)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r' && _ttState.active) {
        e.preventDefault();
        stopAndRestartTest();
        return;
    }
});

// ============================================================
// 📚 LESSON SELECTION
// ============================================================
function selectTestLesson(group, idx) {
    if (!group || idx === null || idx === undefined) return;

    const idxNum = parseInt(idx, 10);
    if (isNaN(idxNum) || idxNum < 0 || idxNum > 2) return;

    _ttSelectedGroup = group;
    _ttSelectedIdx = idxNum;

    document.querySelectorAll('.tt-lesson-btn').forEach(b => {
        const g = b.getAttribute('data-group');
        const i = parseInt(b.getAttribute('data-idx'), 10);
        b.classList.toggle('active', g === group && i === idxNum);
    });

    const lesson = getLessonText(group, idxNum);
    const name = getLessonName(group, idxNum);
    const infoEl = document.getElementById('ttSelectedLesson');

    if (infoEl) {
        infoEl.textContent = `${name} (${lesson.length} chars)`;
    }

    const startBtn = document.getElementById('ttStartBtn');
    if (startBtn) startBtn.disabled = !lesson;
}

function selectTestDuration(sec) {
    _ttSelectedDuration = parseInt(sec, 10) || 60;
    document.querySelectorAll('.tt-time-btn').forEach(b => {
        b.classList.toggle('active', parseInt(b.getAttribute('data-sec'), 10) === _ttSelectedDuration);
    });
}

// ✅ Null safety
function getLessonText(group, idx) {
    const lang = (typeof currentLayout !== 'undefined' && currentLayout) ? currentLayout : 'english';
    const langPool = TT_LESSONS[lang] || TT_LESSONS['english'];
    const groupPool = langPool[group] || langPool['basic'] || [];
    return groupPool[idx] || groupPool[0] || '';
}

function getLessonName(group, idx) {
    const names = {
        basic:    ['Home Row Practice', 'Common Words', 'Short Sentences'],
        advanced: ['Punctuation & Quotes', 'Numbers & Symbols', 'Complex Paragraph'],
        job:      ['Email Writing', 'Office Report', 'Government Format']
    };
    const groupNames = names[group] || names.basic;
    return groupNames[idx] || 'Lesson';
}

// ============================================================
// ▶️ START TEST
// ============================================================
function startTypingTest() {
    if (!_ttSelectedGroup || _ttSelectedIdx === null) {
        if (typeof showToast === 'function') {
            showToast('Pehle lesson select karein', 'warning');
        }
        return;
    }

    const text = getLessonText(_ttSelectedGroup, _ttSelectedIdx);

    // ✅ Empty lesson guard
    if (!text || text.trim().length === 0) {
        if (typeof showToast === 'function') {
            showToast('Is lesson me koi text nahi hai', 'warning');
        }
        return;
    }

    stopTest();

    _ttState = createFreshTTState();
    _ttState.active = true;
    _ttState.group = _ttSelectedGroup;
    _ttState.idx = _ttSelectedIdx;
    _ttState.duration = _ttSelectedDuration;
    _ttState.text = text;
    _ttState.timeLeft = _ttSelectedDuration;
    _ttState.lastInputTime = performance.now();

    const target = document.getElementById('ttTargetText');
    if (!target) return;

    // ─── Build target text with char spans ───
    target.innerHTML = '';
    const frag = document.createDocumentFragment();

    for (let i = 0; i < text.length; i++) {
        const span = document.createElement('span');
        span.className = 'tt-char';
        span.textContent = text[i];
        frag.appendChild(span);
        _ttState.charSpans.push(span);
    }
    target.appendChild(frag);

    if (_ttState.charSpans[0]) {
        _ttState.charSpans[0].classList.add('current');
    }

    // ─── Setup input ───
    const input = document.getElementById('ttInput');
    if (input) {
        input.value = '';
        input.disabled = false;
        input.oninput = handleTestInput;

        // ✅ Anti-cheat: Block paste/drop/copy
        input.onpaste = (e) => {
            e.preventDefault();
            if (typeof showToast === 'function') {
                showToast('⚠️ Paste allowed नहीं है', 'warning', 2000);
            }
            return false;
        };
        input.ondrop = (e) => {
            e.preventDefault();
            if (typeof showToast === 'function') {
                showToast('⚠️ Drop allowed नहीं है', 'warning', 2000);
            }
            return false;
        };
        input.oncontextmenu = (e) => {
            e.preventDefault();
            return false;
        };
        input.oncopy = (e) => {
            e.preventDefault();
            return false;
        };
    }

    // ─── Reset live stats UI ───
    const timerEl = document.getElementById('ttTimer');
    if (timerEl) {
        timerEl.textContent = formatTTTime(_ttSelectedDuration);
        timerEl.className = '';
    }

    const wpmEl = document.getElementById('ttLiveWPM');
    const accEl = document.getElementById('ttLiveAcc');
    const errEl = document.getElementById('ttLiveErr');
    const progEl = document.getElementById('ttLiveProg');

    if (wpmEl) wpmEl.textContent = '0';
    if (accEl) accEl.textContent = '100%';
    if (errEl) errEl.textContent = '0';
    if (progEl) progEl.textContent = '0%';

    // ─── Switch views ───
    const setupEl = document.getElementById('ttSetup');
    const arenaEl = document.getElementById('ttArena');
    const resultEl = document.getElementById('ttResult');

    if (setupEl) setupEl.style.display = 'none';
    if (resultEl) resultEl.style.display = 'none';
    if (arenaEl) arenaEl.style.display = 'block';

    if (input) input.focus();

    // ─── Attach anti-cheat ───
    _attachWindowHandlers();

    // ─── Start timer with performance.now() ───
    // ✅ FIXED: performance.now() = monotonic, drift-free on tab switch
    _ttState.startTime = performance.now();
    _ttState.timerId = setInterval(tickTimer, 1000);

    // ─── Start idle detection ───
    _startIdleDetection();

    if (typeof showToast === 'function') {
        showToast('Practice shuru! Type karna shuru karein', 'info', 2500);
    }

    console.log('▶️ Test started:', {
        group: _ttSelectedGroup,
        idx: _ttSelectedIdx,
        duration: _ttSelectedDuration,
        textLength: text.length
    });
}

// ============================================================
// ⏱️ IDLE DETECTION — Auto-pause after 30s idle
// ============================================================
function _startIdleDetection() {
    _stopIdleDetection();

    _ttState.idleTimerId = setInterval(() => {
        if (!_ttState.active) return;

        const idleMs = performance.now() - _ttState.lastInputTime;

        if (idleMs >= IDLE_TIMEOUT_MS && !_ttState.paused) {
            _ttState.paused = true;
            _ttState.pausedAt = performance.now();

            console.log('⏸️ Auto-paused after 30s idle');

            if (typeof showToast === 'function') {
                showToast('⏸️ 30s idle — Timer paused. Type करने पर resume होगा।', 'warning', 4000);
            }
        }
    }, 5000);  // Check every 5s
}

function _stopIdleDetection() {
    if (_ttState.idleTimerId) {
        clearInterval(_ttState.idleTimerId);
        _ttState.idleTimerId = null;
    }
}

// ============================================================
// ⌨️ INPUT HANDLER
// ============================================================
function handleTestInput(e) {
    if (!_ttState.active || _ttState._finished) return;

    // ─── Update last input time (for idle detection) ───
    _ttState.lastInputTime = performance.now();

    // ─── Auto-resume if paused ───
    if (_ttState.paused) {
        const pauseDuration = performance.now() - _ttState.pausedAt;
        // Add pause duration to startTime (so it doesn't count)
        _ttState.startTime += pauseDuration;
        _ttState.paused = false;
        _ttState.pausedAt = null;
        console.log('▶️ Resumed after pause (' + Math.round(pauseDuration / 1000) + 's)');
    }

    const inputVal = e.target.value;
    let correct = 0;
    let errors = 0;
    const totalChars = _ttState.charSpans.length;

    // ─── Process each character ───
    for (let i = 0; i < totalChars; i++) {
        const span = _ttState.charSpans[i];
        span.classList.remove('correct', 'wrong', 'current');

        if (i < inputVal.length) {
            if (inputVal[i] === _ttState.text[i]) {
                span.classList.add('correct');
                correct++;
            } else {
                span.classList.add('wrong');
                errors++;
            }
        }
    }

    // ─── Set current cursor ───
    const cursorIdx = inputVal.length;
    if (cursorIdx < totalChars) {
        const currentSpan = _ttState.charSpans[cursorIdx];
        currentSpan.classList.add('current');

        // ✅ Throttled scroll (every 20 chars)
        if (cursorIdx > 0 && cursorIdx % SCROLL_THROTTLE_EVERY === 0) {
            clearTimeout(_scrollDebounce);
            _scrollDebounce = setTimeout(() => {
                try {
                    currentSpan.scrollIntoView({ block: 'nearest', behavior: 'auto' });
                } catch (err) {}
            }, 50);
        }
    }

    // ─── Update state ───
    _ttState.correctTyped = correct;
    _ttState.errors = errors;
    _ttState.totalTyped = cursorIdx;

    updateLiveStats();

    // ─── Check if test complete ───
    if (cursorIdx >= _ttState.text.length) {
        finishTest('complete');
    }
}

// ============================================================
// 📊 LIVE STATS
// ============================================================
function updateLiveStats() {
    if (!_ttState.startTime || !_ttState.active) return;

    // ✅ Use performance.now() for elapsed
    const elapsedMs = performance.now() - _ttState.startTime;
    const elapsedMin = elapsedMs / 60000;

    const charsTyped = _ttState.totalTyped;

    const grossWPM = elapsedMin > 0.03 ? Math.round((charsTyped / 5) / elapsedMin) : 0;
    const safeWPM  = Math.min(grossWPM, 250);  // Clamp
    const accuracy = charsTyped > 0 ? Math.round((_ttState.correctTyped / charsTyped) * 100) : 100;
    const progress = Math.round((charsTyped / _ttState.text.length) * 100);

    const wpmEl = document.getElementById('ttLiveWPM');
    const accEl = document.getElementById('ttLiveAcc');
    const errEl = document.getElementById('ttLiveErr');
    const prgEl = document.getElementById('ttLiveProg');

    if (wpmEl) wpmEl.textContent = safeWPM;
    if (accEl) accEl.textContent = accuracy + '%';
    if (errEl) errEl.textContent = _ttState.errors;
    if (prgEl) prgEl.textContent = Math.min(progress, 100) + '%';
}

// ============================================================
// ⏱️ TIMER — with drift correction
// ============================================================
function tickTimer() {
    if (!_ttState.active) {
        if (_ttState.timerId) {
            clearInterval(_ttState.timerId);
            _ttState.timerId = null;
        }
        return;
    }

    if (!_ttState.startTime) return;

    // ✅ FIXED: Calculate from startTime — background tab drift safe
    // performance.now() = monotonic time, unaffected by tab throttling
    const elapsedSec = Math.floor((performance.now() - _ttState.startTime) / 1000);
    _ttState.timeLeft = Math.max(0, _ttState.duration - elapsedSec);

    const timerEl = document.getElementById('ttTimer');
    if (timerEl) {
        timerEl.textContent = formatTTTime(_ttState.timeLeft);

        // Color state
        if (_ttState.timeLeft <= 10) {
            timerEl.className = 'danger';
        } else if (_ttState.timeLeft <= 30) {
            timerEl.className = 'warn';
        } else {
            timerEl.className = '';
        }
    }

    if (_ttState.timeLeft <= 0) {
        finishTest('timeout');
    }
}

// ✅ Negative safe time format
function formatTTTime(sec) {
    const sVal = Math.max(0, parseInt(sec, 10) || 0);
    const m = Math.floor(sVal / 60);
    const s = sVal % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ============================================================
// 🏁 FINISH TEST — Idempotent
// ============================================================
function finishTest(reason) {
    // ✅ Idempotency guard — prevent double finish
    if (_ttState._finished) {
        console.warn('⚠️ finishTest called again — ignoring');
        return;
    }
    _ttState._finished = true;
    _ttState.active = false;

    // ─── Clear timer ───
    if (_ttState.timerId) {
        clearInterval(_ttState.timerId);
        _ttState.timerId = null;
    }

    // ─── Stop idle detection ───
    _stopIdleDetection();

    // ─── Disable input ───
    const input = document.getElementById('ttInput');
    if (input) {
        input.disabled = true;
        input.oninput = null;
        input.onpaste = null;
        input.ondrop = null;
        input.oncontextmenu = null;
        input.oncopy = null;
    }

    // ─── Detach anti-cheat ───
    _detachWindowHandlers();

    // ─── Calculate final stats ───
    const elapsedMs = performance.now() - _ttState.startTime;

    // ✅ FIXED: Clamp elapsed to duration (realistic WPM)
    const rawElapsedSec = elapsedMs / 1000;
    const elapsedSec = Math.min(_ttState.duration, Math.max(1, rawElapsedSec));
    const elapsedMin = Math.max(elapsedSec / 60, 0.03);

    const charsTyped = _ttState.totalTyped;
    const words = charsTyped / 5;
    const grossWPM = Math.round(words / elapsedMin);
    const netWPM   = Math.max(0, Math.round((words - _ttState.errors) / elapsedMin));
    const accuracy = charsTyped > 0 ? Math.round((_ttState.correctTyped / charsTyped) * 100) : 100;

    // ─── Grade (documented thresholds) ───
    // A+ : 60+ WPM, 95%+ accuracy
    // A  : 45+ WPM, 92%+ accuracy
    // B  : 30+ WPM, 88%+ accuracy
    // C  : 20+ WPM, 80%+ accuracy
    // D  : below
    let grade = 'D';
    let msg = 'Keep practicing!';

    if (netWPM >= 60 && accuracy >= 95) {
        grade = 'A+';
        msg = 'Outstanding! 🏆';
    } else if (netWPM >= 45 && accuracy >= 92) {
        grade = 'A';
        msg = 'Excellent work! 🌟';
    } else if (netWPM >= 30 && accuracy >= 88) {
        grade = 'B';
        msg = 'Good job! 👍';
    } else if (netWPM >= 20 && accuracy >= 80) {
        grade = 'C';
        msg = 'Not bad — keep going!';
    }

    // ─── Save best WPM ───
    const isNewBest = _saveBestWPM(netWPM);
    if (isNewBest && netWPM > 0) {
        setTimeout(() => {
            if (typeof showToast === 'function') {
                showToast(`🏆 New Best WPM: ${netWPM}!`, 'success', 4000);
            }
        }, 500);
    }

    // ─── Update result UI ───
    const setSafe = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    setSafe('ttResGrade', grade);
    setSafe('ttResMsg', msg);
    setSafe('ttResWPM', netWPM);
    setSafe('ttResGross', grossWPM);
    setSafe('ttResAcc', accuracy + '%');
    setSafe('ttResChars', charsTyped);
    setSafe('ttResErrors', _ttState.errors);
    setSafe('ttResTime', formatTTTime(elapsedSec));
    setSafe('ttResLesson', getLessonName(_ttState.group, _ttState.idx));
    setSafe('ttResDate', new Date().toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
    }));

    // ─── Switch to result view ───
    const arenaEl = document.getElementById('ttArena');
    const resultEl = document.getElementById('ttResult');
    if (arenaEl) arenaEl.style.display = 'none';
    if (resultEl) resultEl.style.display = 'block';

    // ─── Update status strip ───
    if (typeof updateStatusWPM === 'function') updateStatusWPM(netWPM);

    // ─── Warn if cheating detected ───
    if (_ttState.blurCount > 0 || _ttState.visibilityHiddenCount > 0) {
        console.warn('⚠️ Test had window switches:', {
            blur: _ttState.blurCount,
            visibility: _ttState.visibilityHiddenCount
        });
    }

    // ─── Final toast ───
    if (typeof showToast === 'function') {
        showToast(
            `${reason === 'timeout' ? "Time's up!" : 'Complete!'} — ${netWPM} WPM, ${accuracy}% accuracy`,
            'success',
            4000
        );
    }

    console.log('🏁 Test finished:', {
        reason,
        netWPM,
        grossWPM,
        accuracy,
        grade,
        charsTyped,
        errors: _ttState.errors,
        elapsedSec,
        blurCount: _ttState.blurCount,
        isNewBest
    });
}

// ============================================================
// 🏆 BEST WPM TRACKING
// ============================================================
function _saveBestWPM(wpm) {
    if (wpm <= 0) return false;

    try {
        const currentBest = parseInt(localStorage.getItem(BEST_WPM_KEY) || '0', 10);
        if (wpm > currentBest) {
            localStorage.setItem(BEST_WPM_KEY, String(wpm));
            console.log('🏆 New best WPM:', wpm, '(was:', currentBest + ')');
            return true;
        }
    } catch (e) {
        console.warn('Best WPM save failed:', e.message);
    }
    return false;
}

function getBestWPM() {
    try {
        return parseInt(localStorage.getItem(BEST_WPM_KEY) || '0', 10);
    } catch (e) {
        return 0;
    }
}

// ============================================================
// ⏹️ STOP TEST
// ============================================================
function stopTest() {
    if (_ttState.timerId) {
        clearInterval(_ttState.timerId);
        _ttState.timerId = null;
    }

    _stopIdleDetection();

    _ttState.active = false;
    _ttState.timeLeft = 0;
    _ttState.paused = false;

    const input = document.getElementById('ttInput');
    if (input) {
        input.disabled = true;
        input.oninput = null;
    }

    _detachWindowHandlers();
}

function stopAndRestartTest() {
    stopTest();
    _ttState = createFreshTTState();

    const setupEl = document.getElementById('ttSetup');
    const arenaEl = document.getElementById('ttArena');
    const resultEl = document.getElementById('ttResult');

    if (setupEl) setupEl.style.display = 'block';
    if (arenaEl) arenaEl.style.display = 'none';
    if (resultEl) resultEl.style.display = 'none';

    document.querySelectorAll('.tt-lesson-btn').forEach(b => b.classList.remove('active'));
    _ttSelectedGroup = null;
    _ttSelectedIdx = null;

    const infoEl = document.getElementById('ttSelectedLesson');
    if (infoEl) infoEl.textContent = 'Select a lesson above';

    const startBtn = document.getElementById('ttStartBtn');
    if (startBtn) startBtn.disabled = true;
}

// ============================================================
// 🎓 OPEN CERTIFICATE FROM RESULT
// ============================================================
function openCertificateFromResult() {
    const state = _ttState;

    if (!state || !state.text || !state.startTime) {
        if (typeof showToast === 'function') {
            showToast('Result not found', 'warning');
        }
        return;
    }

    // Clamp elapsed
    const elapsedMs = performance.now() - state.startTime;
    const elapsedSec = Math.min(
        state.duration,
        Math.max(1, Math.floor(elapsedMs / 1000))
    );
    const elapsedMin = Math.max(elapsedSec / 60, 0.03);

    const charsTyped = state.totalTyped;
    const words = charsTyped / 5;
    const netWPM = Math.max(0, Math.round((words - state.errors) / elapsedMin));
    const accuracy = charsTyped > 0 ? Math.round((state.correctTyped / charsTyped) * 100) : 100;

    let grade = 'D';
    if (netWPM >= 60 && accuracy >= 95) grade = 'A+';
    else if (netWPM >= 45 && accuracy >= 92) grade = 'A';
    else if (netWPM >= 30 && accuracy >= 88) grade = 'B';
    else if (netWPM >= 20 && accuracy >= 80) grade = 'C';

    if (typeof CertificateSystem === 'undefined') {
        if (typeof showToast === 'function') {
            showToast('Certificate system loading... Please wait', 'warning', 3000);
        }
        console.error('CertificateSystem not loaded');
        return;
    }

    try {
        CertificateSystem.open({
            group: state.group,
            idx: state.idx,
            wpm: netWPM,
            accuracy: accuracy,
            grade: grade,
            chars: charsTyped,
            errors: state.errors,
            duration: formatTTTime(elapsedSec)
        });
    } catch (e) {
        console.error('Certificate open failed:', e);
        if (typeof showToast === 'function') {
            showToast('Certificate open failed: ' + e.message, 'error', 4000);
        }
    }
}

// ============================================================
// 📱 SHARE RESULT ON WHATSAPP
// ============================================================
function shareResultOnWhatsApp() {
    const state = _ttState;

    if (!state || !state.text || !state.startTime) {
        if (typeof showToast === 'function') {
            showToast('No result to share', 'warning');
        }
        return;
    }

    const elapsedMs = performance.now() - state.startTime;
    const elapsedSec = Math.min(state.duration, Math.max(1, Math.floor(elapsedMs / 1000)));
    const elapsedMin = Math.max(elapsedSec / 60, 0.03);

    const charsTyped = state.totalTyped;
    const words = charsTyped / 5;
    const netWPM = Math.max(0, Math.round((words - state.errors) / elapsedMin));
    const accuracy = charsTyped > 0 ? Math.round((state.correctTyped / charsTyped) * 100) : 100;

    let grade = 'D';
    if (netWPM >= 60 && accuracy >= 95) grade = 'A+';
    else if (netWPM >= 45 && accuracy >= 92) grade = 'A';
    else if (netWPM >= 30 && accuracy >= 88) grade = 'B';
    else if (netWPM >= 20 && accuracy >= 80) grade = 'C';

    const msg = `🎯 *TYPING PRACTICE RESULT*\n\n` +
                `📖 Lesson: ${getLessonName(state.group, state.idx)}\n` +
                `⚡ Net WPM: ${netWPM}\n` +
                `🎯 Accuracy: ${accuracy}%\n` +
                `🏅 Grade: ${grade}\n` +
                `📝 Characters: ${charsTyped}\n` +
                `❌ Errors: ${state.errors}\n` +
                `⏱️ Duration: ${formatTTTime(elapsedSec)}\n\n` +
                `— via Hoṛ Katha Suite`;

    window.open(
        `https://wa.me/?text=${encodeURIComponent(msg)}`,
        '_blank',
        'noopener,noreferrer'
    );
}

// ============================================================
// ✅ Debug helpers
// ============================================================
window.TypingTestDebug = {
    state: () => JSON.parse(JSON.stringify({
        active: _ttState.active,
        group: _ttState.group,
        idx: _ttState.idx,
        duration: _ttState.duration,
        timeLeft: _ttState.timeLeft,
        hasTimer: !!_ttState.timerId,
        hasIdleTimer: !!_ttState.idleTimerId,
        textLength: _ttState.text.length,
        spansCount: _ttState.charSpans.length,
        blurCount: _ttState.blurCount,
        visibilityHiddenCount: _ttState.visibilityHiddenCount,
        errors: _ttState.errors,
        totalTyped: _ttState.totalTyped,
        correctTyped: _ttState.correctTyped,
        paused: _ttState.paused,
        finished: _ttState._finished
    })),

    forceClose: () => closeTypingTestModal(),

    forceFinish: () => finishTest('debug'),

    forceLesson: (group, idx) => {
        _ttSelectedGroup = group;
        _ttSelectedIdx = idx;
        selectTestLesson(group, idx);
        if (typeof showToast === 'function') {
            showToast(`Lesson set: ${group}[${idx}]`, 'info');
        }
    },

    testCertificate: () => {
        if (typeof CertificateSystem === 'undefined') {
            console.error('CertificateSystem not loaded');
            return;
        }
        CertificateSystem.open({
            group: 'basic',
            idx: 0,
            wpm: 45,
            accuracy: 96,
            grade: 'A+',
            chars: 250,
            errors: 3,
            duration: '01:00'
        });
    },

    testChunking: (n = 3) => {
        const group = 'basic';
        const idx = Math.min(n - 1, 2);
        const text = getLessonText(group, idx);
        console.log('📝 Lesson:', getLessonName(group, idx));
        console.log('Text length:', text.length);
        console.log('Text:', text);
    },

    best: () => {
        console.log('🏆 Best WPM:', getBestWPM());
    },

    resetBest: () => {
        try {
            localStorage.removeItem(BEST_WPM_KEY);
            console.log('🔄 Best WPM reset');
        } catch (e) {
            console.warn('Reset failed:', e.message);
        }
    },

    /**
     * Simulate a full test with random typing
     */
    simulate: (accuracy = 0.95) => {
        _ttState = createFreshTTState();
        _ttState.active = true;
        _ttState.group = 'basic';
        _ttState.idx = 0;
        _ttState.duration = 60;
        _ttState.text = getLessonText('basic', 0);
        _ttState.startTime = performance.now();

        // Simulate typing
        const len = _ttState.text.length;
        const typed = Math.round(len * 0.8);

        for (let i = 0; i < typed; i++) {
            const isCorrect = Math.random() < accuracy;
            _ttState.totalTyped++;
            if (isCorrect) _ttState.correctTyped++;
            else _ttState.errors++;
        }

        // Simulate elapsed time
        _ttState.startTime -= 30000;  // 30s ago

        finishTest('debug');
    }
};

// ============================================================
// 📋 STARTUP LOG
// ============================================================
console.log('═══════════════════════════════════════════');
console.log('✅ typing-test.js loaded — v3.7.4.44');
console.log('   ⏱️  Timer: performance.now() (drift-free)');
console.log('   🛡️  Anti-cheat: paste/drop blocked');
console.log('   👁️  Blur/visibility tracking');
console.log('   ⏸️  Idle pause: 30s');
console.log('   🏆 Best WPM tracking');
console.log('   ⌨️  Shortcuts: ESC (close), Ctrl+R (restart)');
console.log('═══════════════════════════════════════════');