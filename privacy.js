// ============================================================
// 🔒 PRIVACY CONSENT — First-time Banner & Management
// BOSC Tech & Edu · Hoṛ Katha Suite v3.7.4 Pro Ultra
// ============================================================
// Compliance: India DPDP Act 2023, IT Act 2000, GDPR

let _isBannerDismissing = false;

function showConsentBanner() {
    // Check if tracker module is available or consent already decided
    if (typeof Tracker !== 'undefined' && typeof Tracker.hasConsentDecision === 'function') {
        if (Tracker.hasConsentDecision()) return;
    } else {
        try {
            const stored = localStorage.getItem('hor_tracking_consent');
            if (stored === 'accepted' || stored === 'declined') return;
        } catch (e) {}
    }

    // Clean up any stale existing banner
    const existing = document.getElementById('privacyConsentBanner');
    if (existing) existing.remove();

    _isBannerDismissing = false;

    const banner = document.createElement('div');
    banner.id = 'privacyConsentBanner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Privacy and Data Consent Notice');
    banner.style.cssText = `
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, #0d1117 0%, #161b22 100%);
        border-top: 3px solid #1f6feb;
        padding: 16px 20px;
        padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
        z-index: 100002;
        box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.75);
        animation: slideUpConsent 0.4s ease backwards;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    banner.innerHTML = `
        <style>
            @keyframes slideUpConsent {
                from { transform: translateY(100%); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            @keyframes slideDownConsent {
                from { transform: translateY(0); opacity: 1; }
                to { transform: translateY(100%); opacity: 0; }
            }
            .pc-content {
                max-width: 960px;
                margin: 0 auto;
                display: flex;
                align-items: center;
                gap: 16px;
                flex-wrap: wrap;
            }
            .pc-icon {
                font-size: 2.2rem;
                line-height: 1;
                flex-shrink: 0;
            }
            .pc-text {
                flex: 1 1 280px;
                color: #c9d1d9;
                font-size: 0.82rem;
                line-height: 1.5;
            }
            .pc-text strong { color: #58a6ff; font-weight: 800; }
            .pc-text b { color: #3fb950; font-weight: 800; }
            .pc-text a {
                color: #58a6ff;
                text-decoration: underline;
                font-weight: 700;
                margin-left: 4px;
            }
            .pc-text a:hover { color: #79c0ff; }
            .pc-buttons {
                display: flex;
                gap: 8px;
                flex-shrink: 0;
                align-items: center;
            }
            .pc-btn {
                padding: 9px 20px;
                border-radius: 6px;
                font-weight: 800;
                font-size: 0.8rem;
                cursor: pointer;
                border: none;
                white-space: nowrap;
                transition: transform 0.15s ease, background 0.15s ease;
            }
            .pc-btn:active { transform: scale(0.96); }
            .pc-btn-accept {
                background: #238636;
                color: #ffffff;
                box-shadow: 0 2px 8px rgba(35, 134, 54, 0.4);
            }
            .pc-btn-accept:hover { background: #2ea043; }
            .pc-btn-decline {
                background: transparent;
                color: #8b949e;
                border: 1.5px solid #30363d;
            }
            .pc-btn-decline:hover {
                color: #ef4444;
                border-color: #dc2626;
                background: rgba(220, 38, 38, 0.1);
            }
            @media (max-width: 640px) {
                .pc-content { flex-direction: column; text-align: center; }
                .pc-buttons { width: 100%; justify-content: center; }
                .pc-btn { flex: 1; text-align: center; padding: 11px; }
            }
        </style>
        <div class="pc-content">
            <div class="pc-icon">🔒</div>
            <div class="pc-text">
                <strong>Privacy &amp; Data Notice:</strong> Hum aapke device ka ek <b>anonymous hash</b> track karte hain — sirf Pro license verify karne ke liye।
                Aapki files, documents, passwords ya keystrokes kabhi track <u>nahi</u> hoti।
                <a href="privacy.html" target="_blank" rel="noopener">Privacy Policy पढ़ें →</a>
            </div>
            <div class="pc-buttons">
                <button class="pc-btn pc-btn-decline" id="pcDeclineBtn">✕ Decline</button>
                <button class="pc-btn pc-btn-accept" id="pcAcceptBtn">✓ Accept</button>
            </div>
        </div>
    `;

    document.body.appendChild(banner);

    // Accept handler
    document.getElementById('pcAcceptBtn').addEventListener('click', () => {
        if (typeof Tracker !== 'undefined' && typeof Tracker.setConsent === 'function') {
            Tracker.setConsent(true);
        } else {
            try {
                localStorage.setItem('hor_tracking_consent', 'accepted');
                localStorage.setItem('hor_tracking_consent_date', new Date().toISOString());
            } catch (e) {}
        }

        if (typeof showToast === 'function') {
            showToast('✅ Privacy consent accepted — Pro features enabled', 'success');
        }
        hideConsentBanner();
    });

    // Decline handler
    document.getElementById('pcDeclineBtn').addEventListener('click', () => {
        if (typeof Tracker !== 'undefined' && typeof Tracker.setConsent === 'function') {
            Tracker.setConsent(false);
        } else {
            try {
                localStorage.setItem('hor_tracking_consent', 'declined');
                localStorage.setItem('hor_tracking_consent_date', new Date().toISOString());
            } catch (e) {}
        }

        if (typeof showToast === 'function') {
            showToast('⚠️ Tracking declined — Free mode active', 'warning');
        }
        hideConsentBanner();
    });
}

function hideConsentBanner() {
    if (_isBannerDismissing) return;
    const banner = document.getElementById('privacyConsentBanner');
    if (banner) {
        _isBannerDismissing = true;
        banner.style.animation = 'slideDownConsent 0.3s ease forwards';
        setTimeout(() => {
            banner.remove();
            _isBannerDismissing = false;
        }, 300);
    }
}

// ============================================================
// ⚙️ PRIVACY SETTINGS DIALOG
// ============================================================
function showPrivacySettings() {
    let currentConsent = 'not-set';
    let consentDate = 'never';

    try {
        currentConsent = localStorage.getItem('hor_tracking_consent') || 'not-set';
        consentDate = localStorage.getItem('hor_tracking_consent_date') || 'never';
    } catch (e) {}

    let stats = { totalActivations: 0, lastActivation: 'none' };
    if (typeof Tracker !== 'undefined' && typeof Tracker.getLocalStats === 'function') {
        stats = Tracker.getLocalStats();
    }

    let dateFormatted = 'not yet';
    if (consentDate && consentDate !== 'never') {
        try {
            dateFormatted = new Date(consentDate).toLocaleDateString('en-IN');
        } catch (e) {
            dateFormatted = consentDate.split('T')[0] || 'not yet';
        }
    }

    const message =
        '🔒 PRIVACY & CONSENT SETTINGS\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        'Status: ' + currentConsent.toUpperCase() + '\n' +
        'Decided on: ' + dateFormatted + '\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        '📊 Local Records:\n' +
        '   Saved Receipts: ' + (stats.totalActivations || 0) + '\n' +
        '   Last Active: ' + (stats.lastActivation || 'none') + '\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        'Do you want to change tracking consent?\n' +
        '• Click [OK] to ENABLE tracking (Pro features)\n' +
        '• Click [Cancel] to DISABLE tracking (Free only)';

    if (confirm(message)) {
        if (typeof Tracker !== 'undefined' && typeof Tracker.setConsent === 'function') {
            Tracker.setConsent(true);
        } else {
            localStorage.setItem('hor_tracking_consent', 'accepted');
            localStorage.setItem('hor_tracking_consent_date', new Date().toISOString());
        }
        if (typeof showToast === 'function') showToast('✅ Tracking enabled', 'success');
    } else {
        if (typeof Tracker !== 'undefined' && typeof Tracker.setConsent === 'function') {
            Tracker.setConsent(false);
        } else {
            localStorage.setItem('hor_tracking_consent', 'declined');
            localStorage.setItem('hor_tracking_consent_date', new Date().toISOString());
        }
        if (typeof showToast === 'function') showToast('⚠️ Tracking disabled', 'warning');
    }
}

console.log('✅ Privacy module loaded with DPDP Act & Safe DOM lifecycle');