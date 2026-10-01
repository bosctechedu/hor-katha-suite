// ============================================================
// ✏️ EDITOR — Fast Input + Working Formatting
// BOSC Tech & Edu · Hoṛ Katha Suite v3.7.4 Pro Ultra
// ============================================================
// ✅ v3.7.4.34 — AUDIT FIXES:
//    • downloadDocFile/downloadTextFile: RAF-based revoke
//    • printEditorText: preserves HTML formatting (no escape)
//    • printEditorText: noopener/noreferrer for popup
//    • handleEditorInput: debounced enterTypingMode
//    • convertTextCasing: camelCase empty edge case
//    • saveCurrentSelection: silent try-catch
//    • clearText: recordState() before clear (undo support)
//    • escapeHtml: backtick + slash escape
//    • copyText: execCommand fallback
//    • addChar: safe selection restore
//    • _placeCursorAtEnd: try-catch wrapped
//    • Autosave: proper timer cleanup
// ============================================================

// ============================================================
// 📊 STATE
// ============================================================
let undoStack = [];
let redoStack = [];
let isUndoRedoActive = false;
let undoDebounceTimer = null;
let autoSaveTimer = null;
let savedRange = null;
let currentFontSize = 22;
let initialDefaultCode = '';
let _typingStartTime = null;
let _typingWordCount = 0;
let _typingIdleTimer = null;
let _counterDebounce = null;
let _typingModeDebounce = null;

// ============================================================
// 💾 SAVE/LOAD STATE
// ============================================================
function recordState() {
    const editor = document.getElementById('editor');
    if (isUndoRedoActive || !editor) return;

    const currentHTML = editor.innerHTML;
    if (undoStack.length === 0 || undoStack[undoStack.length - 1] !== currentHTML) {
        undoStack.push(currentHTML);
        if (undoStack.length > 50) undoStack.shift();
        redoStack.length = 0;
    }
    triggerAutoSave();
}

function debouncedRecordState() {
    clearTimeout(undoDebounceTimer);
    undoDebounceTimer = setTimeout(recordState, 600);
}

// ============================================================
// ↶ UNDO
// ============================================================
function customUndo() {
    const editor = document.getElementById('editor');
    if (undoStack.length > 1 && editor) {
        isUndoRedoActive = true;
        redoStack.push(undoStack.pop());
        editor.innerHTML = undoStack[undoStack.length - 1];
        isUndoRedoActive = false;
        updateCounter();
        updateEditorEmptyState();
        triggerAutoSave();
    }
}

// ============================================================
// ↷ REDO
// ============================================================
function customRedo() {
    const editor = document.getElementById('editor');
    if (redoStack.length > 0 && editor) {
        isUndoRedoActive = true;
        const state = redoStack.pop();
        undoStack.push(state);
        editor.innerHTML = state;
        isUndoRedoActive = false;
        updateCounter();
        updateEditorEmptyState();
        triggerAutoSave();
    }
}

// ============================================================
// 💾 AUTOSAVE
// ============================================================
function triggerAutoSave() {
    clearTimeout(autoSaveTimer);

    const draftStatusBadge = document.getElementById('draftStatusBadge');
    if (draftStatusBadge) draftStatusBadge.textContent = '⏳ Saving...';
    if (typeof updateStatusSave === 'function') updateStatusSave('typing');

    autoSaveTimer = setTimeout(() => {
        const editor = document.getElementById('editor');
        if (!editor) return;

        try {
            localStorage.setItem('hor_katha_persisted_draft', editor.innerHTML);
            if (draftStatusBadge) draftStatusBadge.textContent = '💾 Saved';
            if (typeof updateStatusSave === 'function') updateStatusSave('saved');
        } catch (e) {
            console.warn('Auto-save failed:', e.message);
            if (draftStatusBadge) draftStatusBadge.textContent = '⚠️ Save failed';
        }
    }, 800);
}

function restorePersistedDraft() {
    try {
        const saved = localStorage.getItem('hor_katha_persisted_draft');
        const editor = document.getElementById('editor');
        if (!editor) return;

        if (saved && !editor.innerText.trim()) {
            editor.innerHTML = saved;
            recordState();
            updateCounter();
        }

        updateEditorEmptyState();
    } catch (e) {
        console.warn('Draft restore failed:', e.message);
    }
}

// ============================================================
// 🔄 RESTORE DEFAULT
// ============================================================
function restoreEditorDefault() {
    const editor = document.getElementById('editor');
    if (!editor) return;
    if (!confirm('क्या आप एडिटर को डिफ़ॉल्ट स्थिति में रीस्टोर करना चाहते हैं?')) return;

    try {
        localStorage.removeItem('hor_katha_persisted_draft');
    } catch (e) {}

    editor.innerHTML = initialDefaultCode;
    undoStack.length = 0;
    redoStack.length = 0;
    _typingStartTime = null;
    _typingWordCount = 0;
    if (_typingIdleTimer) clearTimeout(_typingIdleTimer);
    if (typeof updateStatusWPM === 'function') updateStatusWPM(0);

    const draftStatusBadge = document.getElementById('draftStatusBadge');
    if (draftStatusBadge) draftStatusBadge.textContent = '🔄 Restored';

    updateEditorEmptyState();
    handleEditorInput(true);
    editor.focus();
}

// ============================================================
// 🎯 SELECTION — silent try-catch
// ============================================================
function saveCurrentSelection() {
    const editor = document.getElementById('editor');
    if (!editor) return;

    try {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            if (editor.contains(range.commonAncestorContainer)) {
                savedRange = range.cloneRange();
            }
        }
    } catch (e) {
        // ✅ Silent fail for invalid nodes
    }
}

function restoreSelection() {
    if (!savedRange) return false;
    try {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedRange);
        return true;
    } catch (e) {
        return false;
    }
}

// ✅ FIXED: try-catch wrapped
function _placeCursorAtEnd(editor) {
    if (!editor) return;
    try {
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        savedRange = range.cloneRange();
    } catch (e) {
        // Silent
    }
}

// ============================================================
// ✅ PLACEHOLDER STATE
// ============================================================
function updateEditorEmptyState() {
    const editor = document.getElementById('editor');
    if (!editor) return;

    const rawText = editor.textContent || '';
    const hasEmbedded = editor.querySelector('img, table, hr, ul, ol') !== null;
    const hasContent = rawText.length > 0 || hasEmbedded;

    editor.setAttribute('data-empty', hasContent ? 'false' : 'true');
}

// ============================================================
// ⌨️ INPUT HANDLER
// ✅ Debounced enterTypingMode
// ============================================================
function handleEditorInput(immediateState = false) {
    updateEditorEmptyState();

    if (typeof checkSmartTransliteration === 'function') {
        checkSmartTransliteration();
    }

    if (immediateState) {
        recordState();
    } else {
        debouncedRecordState();
    }

    // ✅ Debounced enterTypingMode (100ms)
    if (typeof enterTypingMode === 'function') {
        clearTimeout(_typingModeDebounce);
        _typingModeDebounce = setTimeout(() => {
            enterTypingMode();
        }, 100);
    }

    // Debounced counter update
    clearTimeout(_counterDebounce);
    _counterDebounce = setTimeout(updateCounter, 80);
}

// ============================================================
// ➕ ADD CHARACTER
// ============================================================
function addCharWithPhonics(ch) {
    if (typeof enterTypingMode === 'function') enterTypingMode();
    if (typeof playKeyClickSound === 'function') playKeyClickSound();
    if (typeof speakLetter === 'function') speakLetter(ch);
    addChar(ch);
}

function addChar(ch) {
    const editor = document.getElementById('editor');
    if (!editor) return;

    const wasAlreadyFocused = document.activeElement === editor;
    if (!wasAlreadyFocused) {
        editor.focus();
    }

    let sel = window.getSelection();
    const hasValidSelection = sel.rangeCount > 0 &&
                               sel.anchorNode &&
                               editor.contains(sel.anchorNode);

    if (!hasValidSelection) {
        // Try saved range
        if (savedRange && editor.contains(savedRange.commonAncestorContainer)) {
            try {
                sel.removeAllRanges();
                sel.addRange(savedRange);
            } catch (e) {
                _placeCursorAtEnd(editor);
            }
        } else {
            _placeCursorAtEnd(editor);
        }
        sel = window.getSelection();
    }

    // ============================================================
    // Ol Chiki digraph handling
    // ============================================================
    if (typeof currentLayout !== 'undefined' &&
        currentLayout === 'olchiki' &&
        sel.rangeCount > 0) {
        try {
            const range = sel.getRangeAt(0);
            if (range.collapsed &&
                range.startContainer.nodeType === 3 &&
                range.startOffset > 0) {

                const node = range.startContainer;
                const offset = range.startOffset;
                const prevChar = node.textContent.charAt(offset - 1);
                const pair = prevChar + ch;

                if (typeof olchikiDigraphs !== 'undefined' && olchikiDigraphs[pair]) {
                    const replacement = olchikiDigraphs[pair];
                    node.textContent = node.textContent.substring(0, offset - 1) +
                                       replacement +
                                       node.textContent.substring(offset);

                    const newOffset = (offset - 1) + replacement.length;
                    range.setStart(node, newOffset);
                    range.setEnd(node, newOffset);

                    updateEditorEmptyState();
                    saveCurrentSelection();
                    handleEditorInput();
                    return;
                }
            }
        } catch (e) {
            // Silent — continue with normal insert
        }
    }

    // ============================================================
    // Try execCommand first (fastest)
    // ============================================================
    let inserted = false;
    try {
        inserted = document.execCommand('insertText', false, ch);
    } catch (e) {
        inserted = false;
    }

    // Manual insert fallback
    if (!inserted) {
        try {
            sel = window.getSelection();
            if (sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                range.deleteContents();
                const textNode = document.createTextNode(ch);
                range.insertNode(textNode);
                range.setStartAfter(textNode);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            } else {
                editor.appendChild(document.createTextNode(ch));
                _placeCursorAtEnd(editor);
            }
        } catch (e) {
            editor.appendChild(document.createTextNode(ch));
            _placeCursorAtEnd(editor);
        }
    }

    updateEditorEmptyState();
    saveCurrentSelection();
    handleEditorInput();
}

// ============================================================
// ⌫ BACKSPACE
// ============================================================
function doBackspace() {
    if (typeof enterTypingMode === 'function') enterTypingMode();
    if (typeof playKeyClickSound === 'function') playKeyClickSound();

    const editor = document.getElementById('editor');
    if (!editor) return;

    if (document.activeElement !== editor) {
        editor.focus();
    }

    let sel = window.getSelection();
    const hasValidSelection = sel.rangeCount > 0 &&
                               sel.anchorNode &&
                               editor.contains(sel.anchorNode);

    if (!hasValidSelection) {
        if (savedRange && editor.contains(savedRange.commonAncestorContainer)) {
            try {
                sel.removeAllRanges();
                sel.addRange(savedRange);
            } catch (e) {
                _placeCursorAtEnd(editor);
            }
        } else {
            _placeCursorAtEnd(editor);
        }
    }

    try {
        document.execCommand('delete', false, null);
    } catch (e) {
        try {
            document.execCommand('delete');
        } catch (e2) {}
    }

    updateEditorEmptyState();
    saveCurrentSelection();
    handleEditorInput();
}

// ============================================================
// 📊 COUNTER + WPM
// ============================================================
function updateCounter() {
    const charCounter = document.getElementById('char-counter');
    const editor = document.getElementById('editor');
    if (!charCounter || !editor) return;

    let text = editor.innerText || '';

    // Clean invisible chars
    text = text.replace(/[\u200B-\u200D\uFEFF\u2060]/g, '');
    text = text.replace(/^\n+/, '').replace(/\n+$/, '');
    text = text.split('\n').map(line => line.replace(/[ \t]+$/, '')).join('\n');
    text = text.replace(/\n+$/, '');

    const charCount = text.length;

    const words = text.trim()
        ? text.trim().split(/\s+/).filter(w => w.length > 0).length
        : 0;

    let lines = 0;
    if (text.length > 0) {
        const parts = text.split('\n');
        while (parts.length > 0 && parts[parts.length - 1].trim() === '') parts.pop();
        lines = Math.max(1, parts.length);
    }

    const readTime = words > 0 ? Math.ceil(words / 180) : 0;

    charCounter.textContent = `Chars: ${charCount} | Words: ${words} | Lines: ${lines} | Read: ~${readTime}m`;

    if (typeof updateStatusChars === 'function') updateStatusChars(charCount);
    if (typeof updateStatusWords === 'function') updateStatusWords(words);

    trackWPM(words);
}

function trackWPM(currentWordCount) {
    if (_typingStartTime === null && currentWordCount > 0) {
        _typingStartTime = Date.now();
        _typingWordCount = 0;
    }

    if (currentWordCount === 0) {
        _typingStartTime = null;
        _typingWordCount = 0;
        if (_typingIdleTimer) clearTimeout(_typingIdleTimer);
        if (typeof updateStatusWPM === 'function') updateStatusWPM(0);
        return;
    }

    if (_typingStartTime !== null) {
        const elapsedMin = (Date.now() - _typingStartTime) / 60000;
        if (elapsedMin > 0.05) {
            const wpm = Math.round(currentWordCount / elapsedMin);
            const safeWPM = Math.min(wpm, 250);  // Clamp
            if (typeof updateStatusWPM === 'function') updateStatusWPM(safeWPM);
        }
    }

    // Idle timeout — reset WPM tracking after 3s of no typing
    if (_typingIdleTimer) clearTimeout(_typingIdleTimer);
    _typingIdleTimer = setTimeout(() => {
        _typingStartTime = null;
    }, 3000);
}

// ============================================================
// 📋 COPY — execCommand fallback
// ============================================================
function copyText() {
    const editor = document.getElementById('editor');
    const text = (editor ? editor.innerText : '') || '';
    if (!text) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
            .then(() => {
                if (typeof showToast === 'function') {
                    showToast('Text copied to clipboard', 'success');
                }
            })
            .catch(() => _legacyCopy(text));
    } else {
        _legacyCopy(text);
    }
}

function _legacyCopy(text) {
    try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        const ok = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (typeof showToast === 'function') {
            showToast(ok ? 'Text copied to clipboard' : 'Copy failed', ok ? 'success' : 'error');
        } else {
            alert(ok ? 'Clipboard par copy ho gaya!' : 'Copy failed');
        }
    } catch (e) {
        alert('Copy failed: ' + e.message);
    }
}

// ============================================================
// 🗑️ CLEAR — ✅ FIXED: recordState() BEFORE clear (undo support)
// ============================================================
function clearText() {
    const editor = document.getElementById('editor');
    if (!editor) return;

    if (confirm('Clear editor text?')) {
        // ✅ FIXED: Snapshot for undo BEFORE clearing
        recordState();

        editor.innerHTML = '';

        try {
            localStorage.removeItem('hor_katha_persisted_draft');
        } catch (e) {}

        _typingStartTime = null;
        _typingWordCount = 0;
        if (_typingIdleTimer) clearTimeout(_typingIdleTimer);
        if (typeof updateStatusWPM === 'function') updateStatusWPM(0);

        updateEditorEmptyState();
        handleEditorInput(true);
        editor.focus();
    }
}

// ============================================================
// 🔤 FONT SIZE
// ============================================================
function adjustFontSize(delta) {
    const editor = document.getElementById('editor');
    if (!editor) return;

    currentFontSize = Math.max(12, Math.min(48, currentFontSize + delta));
    editor.style.fontSize = currentFontSize + 'px';
}

// ============================================================
// 🎨 FORMATTING
// ============================================================
function formatModern(type, val = null) {
    const editor = document.getElementById('editor');
    if (!editor) return;

    editor.focus();
    restoreSelection();

    const sel = window.getSelection();
    if ((!sel || sel.rangeCount === 0) && (type === 'align')) {
        const range = document.createRange();
        range.selectNodeContents(editor);
        sel.removeAllRanges();
        sel.addRange(range);
    }

    try {
        if (type === 'align') {
            let cmd;
            if (val === 'justify') {
                cmd = 'justifyFull';
            } else {
                cmd = 'justify' + val.charAt(0).toUpperCase() + val.slice(1);
            }

            const result = document.execCommand(cmd, false, null);

            // Fallback for browsers where execCommand align fails
            if (!result && sel.rangeCount > 0) {
                let block = sel.anchorNode;
                while (block && block !== editor && block.parentElement !== editor) {
                    block = block.parentElement;
                }
                if (block && block !== editor) block.style.textAlign = val;
            }
        }
        else if (type === 'list') {
            document.execCommand(val === 'ol' ? 'insertOrderedList' : 'insertUnorderedList', false, null);
        }
        else if (type === 'removeFormat') {
            document.execCommand('removeFormat', false, null);
        }
        else if (type === 'bold') document.execCommand('bold', false, null);
        else if (type === 'italic') document.execCommand('italic', false, null);
        else if (type === 'underline') document.execCommand('underline', false, null);
        else if (type === 'strikeThrough') document.execCommand('strikeThrough', false, null);
    } catch (e) {
        console.warn('Format failed:', e);
    }

    saveCurrentSelection();
    handleEditorInput(true);
}

function applyColorModern(styleProperty, colorValue) {
    const editor = document.getElementById('editor');
    if (!editor) return;

    editor.focus();
    restoreSelection();

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;

    try {
        document.execCommand(
            styleProperty === 'color' ? 'foreColor' : 'hiliteColor',
            false,
            colorValue
        );
    } catch (e) {
        console.warn('Color failed:', e);
    }

    saveCurrentSelection();
    handleEditorInput(true);
}

// ============================================================
// 🔠 CASE CONVERT
// ✅ FIXED: camelCase empty input edge case
// ============================================================
function convertTextCasing(mode) {
    const ed = document.getElementById('editor');
    if (!ed) return;

    ed.focus();
    restoreSelection();

    const sel = window.getSelection();
    const hasSelection = sel && sel.rangeCount > 0 && !sel.isCollapsed;
    const sourceText = hasSelection ? sel.toString() : (ed.innerText || '');
    if (!sourceText) return;

    function transform(val) {
        switch (mode) {
            case 'upper': return val.toUpperCase();
            case 'lower': return val.toLowerCase();
            case 'title': return val.toLowerCase().replace(/(?:^|\s|-|_)\S/g, m => m.toUpperCase());
            case 'sentence': return val.toLowerCase().replace(/(^\s*|[.!?]\s*)\S/g, m => m.toUpperCase());

            case 'camel': {
                // ✅ FIXED: Handle empty result properly
                let c = val.replace(/[^a-zA-Z0-9\s-_]/g, '').toLowerCase();
                let r = c.replace(/[-_\s]+(.)?/g, (_, ch) => ch ? ch.toUpperCase() : '');
                if (!r) return '';  // ✅ Return empty string, not crash
                return r.charAt(0).toLowerCase() + r.slice(1);
            }
            case 'kebab': return val.trim().replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase();
            case 'snake': return val.trim().replace(/([a-z])([A-Z])/g, '$1_$2').replace(/[\s-]+/g, '_').toLowerCase();
            case 'inverse': return val.split('').map(c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()).join('');

            case 'num-to-dev': {
                const d = ['०','१','२','३','४','५','६','७','८','९'];
                return val.replace(/[0-9]/g, x => d[parseInt(x, 10)]);
            }
            case 'num-to-ol': {
                const o = ['᱐','᱑','᱒','᱓','᱔','᱕','᱖','᱗','᱘','᱙'];
                return val.replace(/[0-9]/g, x => o[parseInt(x, 10)]);
            }
            case 'num-to-lat': {
                const m = {
                    '०':'0','१':'1','२':'2','३':'3','४':'4','५':'5','६':'6','७':'7','८':'8','९':'9',
                    '᱐':'0','᱑':'1','᱒':'2','᱓':'3','᱔':'4','᱕':'5','᱖':'6','᱗':'7','᱘':'8','᱙':'9'
                };
                return val.replace(/[०-९᱐-᱙]/g, ch => m[ch] !== undefined ? m[ch] : ch);
            }
            default: return val;
        }
    }

    const converted = transform(sourceText);

    if (hasSelection) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const tn = document.createTextNode(converted);
        range.insertNode(tn);
        range.setStartAfter(tn);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    } else {
        ed.innerText = converted;
    }

    saveCurrentSelection();
    handleEditorInput(true);
}

// ============================================================
// 🔍 FIND/REPLACE
// ============================================================
function openFindReplaceModal() {
    const modal = document.getElementById('findReplaceModal');
    if (modal) modal.style.display = 'flex';
    const input = document.getElementById('findInput');
    if (input) input.focus();
}

function closeFindReplaceModal() {
    const modal = document.getElementById('findReplaceModal');
    if (modal) modal.style.display = 'none';
}

// ✅ FIXED: backtick + slash escape
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/`/g, "&#96;")    // ✅ backtick
        .replace(/\//g, "&#47;");  // ✅ slash
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function executeReplaceFirst() {
    const findStr = document.getElementById('findInput').value;
    const replaceStr = document.getElementById('replaceInput').value;
    const matchCase = document.getElementById('matchCaseCheck').checked;
    const editor = document.getElementById('editor');
    if (!findStr || !editor) return;

    const val = editor.innerText || '';
    const flags = matchCase ? '' : 'i';
    const regex = new RegExp(escapeRegex(findStr), flags);

    if (regex.test(val)) {
        editor.innerText = val.replace(regex, replaceStr);
        handleEditorInput(true);
    } else {
        alert('टेक्स्ट नहीं मिला!');
    }
}

function executeReplaceAll() {
    const findStr = document.getElementById('findInput').value;
    const replaceStr = document.getElementById('replaceInput').value;
    const matchCase = document.getElementById('matchCaseCheck').checked;
    const editor = document.getElementById('editor');
    if (!findStr || !editor) return;

    const val = editor.innerText || '';
    const flags = matchCase ? 'g' : 'gi';
    const regex = new RegExp(escapeRegex(findStr), flags);
    const matchCount = (val.match(regex) || []).length;

    if (matchCount > 0) {
        editor.innerText = val.replace(regex, replaceStr);
        handleEditorInput(true);
        alert(`${matchCount} स्थान पर बदल दिया गया।`);
        closeFindReplaceModal();
    } else {
        alert('टेक्स्ट नहीं मिला!');
    }
}

// ============================================================
// 🖨️ PRINT — Premium PDF with HTML formatting preserved
// ✅ FIXED: Use innerHTML (not innerText) to keep formatting
// ✅ FIXED: noopener/noreferrer for popup security
// ============================================================
function printEditorText() {
    const editor = document.getElementById('editor');
    if (!editor || !(editor.innerText || '').trim()) {
        alert('प्रिंट करने के लिए टेक्स्ट लिखें।');
        return;
    }

    // Priority 1: Use premium print generator (preserves HTML)
    if (typeof window.generatePremiumPrint === 'function') {
        try {
            window.generatePremiumPrint();
            return;
        } catch (err) {
            console.warn('[print] Premium generator failed:', err);
        }
    }

    // Fallback: Native window.print() with innerHTML preserved
    console.warn('[print] Falling back to native window.print()');
    try {
        const cf = editor.style.fontFamily || "'Noto Sans Devanagari', sans-serif";
        const safeFont = String(cf).replace(/[<>"']/g, '');

        // ✅ FIXED: use innerHTML (not innerText) to preserve formatting
        // Sanitize: remove scripts, event handlers, but keep <b>, <i>, etc.
        let content = editor.innerHTML || '';
        content = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        content = content.replace(/\s+on\w+\s*=\s*"[^"]*"/gi, '');
        content = content.replace(/\s+on\w+\s*=\s*'[^']*'/gi, '');
        content = content.replace(/(?:href|src)\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, '');

        // ✅ FIXED: noopener, noreferrer for tabnabbing protection
        const printWin = window.open('', '_blank', 'width=900,height=1200,noopener,noreferrer');

        if (!printWin) {
            alert('⚠️ Popup blocked! Please allow popups and try again.');
            return;
        }

        printWin.document.open();
        printWin.document.write(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Print</title>' +
            '<style>' +
            '@page { size: A4; margin: 12mm; }' +
            'body { font-family: ' + safeFont + '; font-size: 12pt; line-height: 1.8; padding: 20px; color: #000; }' +
            'img { max-width: 100%; height: auto; }' +
            'table { border-collapse: collapse; width: 100%; }' +
            'td, th { border: 1px solid #94a3b8; padding: 6px 10px; }' +
            '</style>' +
            '</head><body>' + content + '</body></html>'
        );
        printWin.document.close();

        setTimeout(() => {
            try {
                printWin.focus();
                printWin.print();
            } catch (e) {}
        }, 400);
    } catch (e) {
        alert('Print failed: ' + e.message);
    }
}

// ============================================================
// 📄 WORD EXPORT — RAF-based revoke
// ============================================================
function downloadDocFile() {
    if (typeof requireProAccess === 'function' && !requireProAccess('Word .doc Export')) return;

    const editor = document.getElementById('editor');
    const cf = (editor ? editor.style.fontFamily : '') || "'Noto Sans Devanagari', sans-serif";

    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export Document</title></head><body>";
    const footer = "</body></html>";
    const content = editor ? editor.innerHTML : '';

    const src = header + `<div style="font-family:${cf}; font-size:16pt;">${content}</div>` + footer;
    const blob = new Blob(['\ufeff' + src], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `Hor_Katha_Doc_${Date.now()}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // ✅ FIXED: RAF-based revoke — download शुरू हो चुका होगा
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            URL.revokeObjectURL(url);
        });
    });
}

// ============================================================
// 💾 TXT EXPORT — RAF-based revoke
// ============================================================
function downloadTextFile() {
    const ver = typeof APP_CONFIG !== 'undefined' ? APP_CONFIG.VERSION : '3.7.4';
    const editor = document.getElementById('editor');
    const text = (editor ? editor.innerText : '') || '';

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `Hor_Katha_v${ver}_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // ✅ FIXED: RAF-based revoke
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            URL.revokeObjectURL(url);
        });
    });
}

// ============================================================
// 📲 WHATSAPP SHARE
// ============================================================
function shareViaWhatsApp() {
    const editor = document.getElementById('editor');
    const text = (editor ? editor.innerText : '') || '';

    if (!text.trim()) {
        alert('शेयर करने के लिए टेक्स्ट लिखें!');
        return;
    }

    window.open(
        `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`,
        '_blank',
        'noopener,noreferrer'
    );
}

// ============================================================
// 📱 MOBILE QR
// ============================================================
function openMobileQrModal() {
    const editor = document.getElementById('editor');
    const val = (editor ? editor.innerText : '').trim();

    if (!val) {
        alert('QR Generate karne ke liye editor me text likhein.');
        return;
    }

    if (typeof renderQRCode === 'function') {
        renderQRCode('mobileQrBox', val.substring(0, 500), 150);
    }

    const notice = document.getElementById('qrTextLengthNotice');
    if (notice) notice.textContent = `Total: ${val.length} characters encoded.`;

    const modal = document.getElementById('mobileQrModal');
    if (modal) modal.style.display = 'flex';
}

function closeMobileQrModal() {
    const modal = document.getElementById('mobileQrModal');
    if (modal) modal.style.display = 'none';
}

// ============================================================
// 📊 Debug helpers
// ============================================================
window.EditorDebug = {
    status: () => {
        const editor = document.getElementById('editor');
        console.log('✏️ Editor Status:');
        console.log('  Content length:', editor ? (editor.innerText || '').length : 0);
        console.log('  Undo stack:', undoStack.length);
        console.log('  Redo stack:', redoStack.length);
        console.log('  Empty state:', editor ? editor.getAttribute('data-empty') : 'N/A');
        console.log('  Font size:', currentFontSize);
    },
    undo: () => customUndo(),
    redo: () => customRedo(),
    save: () => recordState(),
    clear: () => {
        const editor = document.getElementById('editor');
        if (editor) {
            editor.innerHTML = '';
            updateEditorEmptyState();
            handleEditorInput(true);
        }
    },
    testUndoAfterClear: () => {
        const editor = document.getElementById('editor');
        if (!editor) return;

        // Set some content
        editor.innerHTML = '<b>Test content</b>';
        recordState();

        console.log('📝 Test setup complete. Now calling clearText()...');

        // Simulate clear with confirm auto-accept
        const origConfirm = window.confirm;
        window.confirm = () => true;

        clearText();

        window.confirm = origConfirm;

        console.log('🗑️ Cleared. Now testing undo...');
        setTimeout(() => {
            customUndo();
            console.log('↶ After undo, content:', editor.innerHTML);
            console.log('Expected: <b>Test content</b>');
            console.log('Result:', editor.innerHTML === '<b>Test content</b>' ? '✅ PASS' : '❌ FAIL');
        }, 100);
    },
    stats: () => {
        const editor = document.getElementById('editor');
        if (!editor) return;
        const text = editor.innerText || '';
        console.table({
            'Characters': text.length,
            'Words': text.trim() ? text.trim().split(/\s+/).length : 0,
            'Lines': text.split('\n').length,
            'Undo': undoStack.length,
            'Redo': redoStack.length
        });
    }
};

// ============================================================
// ✅ Editor module loaded
// ============================================================
console.log('✅ Editor module loaded — v3.7.4.34 (RAF revoke + HTML print + debounce + undo fix)');