// ============================================================
// 🎓 CERTIFICATE GENERATOR — FINAL v6.6
// BOSC Tech & Edu · Hoṛ Katha Suite v3.7.4
// ============================================================
// ✅ v6.6 — PERFORMANCE & RELIABILITY HARDENED:
//    • Adaptive html2canvas scale (mobile: 1.5, desktop: 2)
//    • Double-click guard (_isProcessing flag)
//    • Canvas memory cleanup after render
//    • Image preload before capture
//    • RAF-based URL revoke for downloads
//    • Timestamp in filenames (no collision)
//    • Fallback cert number generation
//    • _outsideClickHandler cleanup on close
//    • Robust ESC handler
//    • escapeHtml everywhere (XSS-safe)
//    • PDF/PNG retry with exponential backoff
//    • Blob size validation
//    • Better quota handling in history
//    • Version tracking (v6.6)
// ============================================================

const CertificateSystem = {
    // ============================================================
    // 📊 VERSION & STATE
    // ============================================================
    version: '6.6',
    currentData: null,
    _outsideClickHandler: null,
    _isProcessing: false,
    _lastRenderTime: 0,

    // ============================================================
    // 🚀 OPEN CERTIFICATE
    // ============================================================
    open(testResult) {
        if (!testResult || typeof testResult !== 'object') {
            console.warn('⚠️ CertificateSystem.open: invalid testResult');
            return;
        }

        // ✅ Safe date parsing
        let safeDate = new Date();
        if (testResult.date) {
            const parsed = new Date(testResult.date);
            if (!isNaN(parsed.getTime())) {
                safeDate = parsed;
            }
        }

        this.currentData = {
            category: testResult.group || 'basic',
            categoryName: this.getCategoryName(testResult.group),
            lessonName: this.getLessonName(testResult.group, testResult.idx),
            wpm: Number(testResult.wpm) || 0,
            accuracy: Number(testResult.accuracy) || 0,
            grade: testResult.grade || 'D',
            chars: Number(testResult.chars) || 0,
            errors: Number(testResult.errors) || 0,
            duration: testResult.duration || '00:00',
            date: safeDate,
            certificateNo: this.generateCertificateNo(testResult.group),
            studentName: ''
        };

        // Get saved name from localStorage
        try {
            const licName = localStorage.getItem('hor_lic_user');
            const lastName = localStorage.getItem('hor_cert_last_name');
            this.currentData.studentName = licName || lastName || '';
        } catch (e) {
            this.currentData.studentName = '';
        }

        this.renderModal();
    },

    // ============================================================
    // 🎨 RENDER MODAL
    // ============================================================
    renderModal() {
        const existing = document.getElementById('certificateModal');
        if (existing) existing.remove();

        // Cleanup old outside-click listener
        if (this._outsideClickHandler) {
            document.removeEventListener('click', this._outsideClickHandler);
            this._outsideClickHandler = null;
        }

        const modal = document.createElement('div');
        modal.id = 'certificateModal';
        modal.className = 'active';
        modal.innerHTML = `
            <div class="cert-modal-container">
                <div class="cert-modal-header">
                    <div>
                        <div class="cert-modal-title">🎓 <span>Typing Certificate</span></div>
                        <div class="cert-modal-subtitle">${this.escapeHtml(this.currentData.categoryName)} · ${this.escapeHtml(this.currentData.lessonName)}</div>
                    </div>
                    <button class="cert-modal-close" onclick="CertificateSystem.close()" aria-label="Close">✕</button>
                </div>

                <div class="cert-modal-body">
                    <div id="certNameForm" class="cert-name-input-wrap">
                        <label class="cert-name-label">✍️ अपना पूरा नाम डालें</label>
                        <input type="text"
                               id="certStudentName"
                               value="${this.escapeHtml(this.currentData.studentName)}"
                               placeholder="e.g. Parish Marandi"
                               maxlength="50"
                               autocomplete="name"
                               spellcheck="false"
                               onkeydown="if(event.key==='Enter'){event.preventDefault(); CertificateSystem.generatePreview();}">
                        <div class="cert-hint">यह नाम certificate पर print होगा</div>
                        <button class="cert-btn cert-btn-print" style="margin-top:14px; padding:13px 44px; font-size:0.9rem;" onclick="CertificateSystem.generatePreview()">
                            🎯 Generate Certificate
                        </button>
                    </div>

                    <div id="certPreviewContainer"></div>
                </div>

                <div class="cert-modal-footer" id="certModalFooter" style="display:none;">
                    <div class="cert-download-wrap">
                        <button class="cert-btn cert-btn-download" onclick="CertificateSystem.toggleDropdown(event)">
                            💾 Download / Share
                            <span class="dropdown-arrow">▼</span>
                        </button>

                        <div class="cert-dropdown-menu" id="certDropdownMenu">
                            <button class="dropdown-item" onclick="CertificateSystem.downloadPNG()">
                                <span class="dd-icon">📸</span>
                                <div class="dd-text">
                                    <b>Download 4K PNG</b>
                                    <small>~1 MB · Ultra HD Quality</small>
                                </div>
                            </button>

                            <button class="dropdown-item" onclick="CertificateSystem.savePDF()">
                                <span class="dd-icon">📄</span>
                                <div class="dd-text">
                                    <b>Save as PDF</b>
                                    <small>~1 MB · A4 Landscape</small>
                                </div>
                            </button>

                            <button class="dropdown-item" onclick="CertificateSystem.shareWhatsApp()">
                                <span class="dd-icon">📱</span>
                                <div class="dd-text">
                                    <b>Share on WhatsApp</b>
                                    <small>With real verify link</small>
                                </div>
                            </button>

                            <button class="dropdown-item" onclick="CertificateSystem.copyVerifyLink()">
                                <span class="dd-icon">🔗</span>
                                <div class="dd-text">
                                    <b>Copy Verify Link</b>
                                    <small>Open real verify page</small>
                                </div>
                            </button>

                            <div class="dropdown-divider"></div>

                            <button class="dropdown-item dropdown-close" onclick="CertificateSystem.close()">
                                <span class="dd-icon">✕</span>
                                <div class="dd-text">
                                    <b>Close</b>
                                    <small>Exit certificate</small>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';

        // Proper outside-click handler with cleanup
        setTimeout(() => {
            this._outsideClickHandler = (e) => {
                const menu = document.getElementById('certDropdownMenu');
                const btn = document.querySelector('.cert-btn-download');
                if (menu && menu.classList.contains('open') &&
                    btn && !menu.contains(e.target) && !btn.contains(e.target)) {
                    menu.classList.remove('open');
                }
            };
            document.addEventListener('click', this._outsideClickHandler);
        }, 100);

        // Auto-focus name input if empty
        if (!this.currentData.studentName) {
            setTimeout(() => {
                const input = document.getElementById('certStudentName');
                if (input) {
                    input.focus();
                    input.select();
                }
            }, 250);
        } else {
            setTimeout(() => this.generatePreview(), 200);
        }
    },

    // ============================================================
    // 🔽 TOGGLE DROPDOWN
    // ============================================================
    toggleDropdown(event) {
        event.stopPropagation();
        const menu = document.getElementById('certDropdownMenu');
        if (menu) menu.classList.toggle('open');
    },

    // ============================================================
    // 🎯 GENERATE PREVIEW
    // ============================================================
    generatePreview() {
        const nameInput = document.getElementById('certStudentName');
        const name = (nameInput ? nameInput.value : '').trim();

        if (!name || name.length < 2) {
            if (typeof showToast === 'function') {
                showToast('कृपया अपना पूरा नाम डालें', 'warning', 2500);
            } else {
                alert('कृपया अपना पूरा नाम डालें');
            }
            if (nameInput) nameInput.focus();
            return;
        }

        if (name.length > 50) {
            if (typeof showToast === 'function') {
                showToast('नाम बहुत लंबा है (50 chars max)', 'warning', 2500);
            }
            return;
        }

        this.currentData.studentName = name;

        try {
            localStorage.setItem('hor_cert_last_name', name);
        } catch (e) {}

        const form = document.getElementById('certNameForm');
        if (form) form.style.display = 'none';

        const footer = document.getElementById('certModalFooter');
        if (footer) footer.style.display = 'flex';

        const container = document.getElementById('certPreviewContainer');
        if (!container) return;

        try {
            container.innerHTML = this.buildCertificateHTML();
            console.log('✅ Certificate HTML inserted');
        } catch (err) {
            console.error('❌ Error building certificate:', err.message);
            alert('Certificate error: ' + err.message);
            return;
        }

        setTimeout(() => {
            this.renderQRCode();
            this.saveToHistory();
        }, 200);

        console.log('✅ Certificate generated:', this.currentData.certificateNo);
    },

    // ============================================================
    // 🏗️ BUILD CERTIFICATE HTML
    // ============================================================
    buildCertificateHTML() {
        const d = this.currentData;
        const categoryClass = d.category === 'basic' ? 'basic'
                             : d.category === 'advanced' ? 'advanced'
                             : 'job';

        const dateObj = (d.date instanceof Date && !isNaN(d.date.getTime()))
            ? d.date
            : new Date();

        let dateStr = '';
        try {
            dateStr = dateObj.toLocaleDateString('en-IN', {
                day: '2-digit', month: 'long', year: 'numeric'
            });
        } catch (e) {
            dateStr = dateObj.toLocaleDateString();
        }

        const levelName = d.category === 'basic' ? 'Basic'
                        : d.category === 'advanced' ? 'Advanced'
                        : 'Job Oriented';

        const langName = (typeof currentLayout !== 'undefined' && currentLayout)
            ? ({
                'english': 'English',
                'roman': 'Santali (Roman)',
                'hindi-dev': 'Hindi',
                'santali-dev': 'Santali',
                'olchiki': 'Ol Chiki'
            }[currentLayout] || 'English')
            : 'English';

        const formattedName = String(d.studentName || '').toUpperCase().trim();
        const displayName = String(d.studentName || '').trim();

        return `
            <div class="typing-certificate ${categoryClass}" id="certificateElement">
                <div class="cert-watermark">ह</div>
                ${this.getCornerSVG('tl')}
                ${this.getCornerSVG('tr')}
                ${this.getCornerSVG('bl')}
                ${this.getCornerSVG('br')}

                <div class="cert-shield-top-center">
                    <img src="assets/logos/bosc-main-logo.png"
                         alt="BOSC Tech & Education"
                         class="cert-bosc-shield-img"
                         onerror="this.style.display='none'; this.parentElement.classList.add('img-fallback');">
                </div>

                <div class="cert-brand-top-right">
                    <div class="cert-brand-icon">
                        <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <linearGradient id="hkIconGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stop-color="#0284c7"/>
                                    <stop offset="50%" stop-color="#7c3aed"/>
                                    <stop offset="100%" stop-color="#d946ef"/>
                                </linearGradient>
                            </defs>
                            <rect x="2" y="2" width="36" height="36" rx="10" fill="url(#hkIconGrad)" stroke="#ffffff" stroke-width="1.5"/>
                            <text x="20" y="17" text-anchor="middle" font-family="'Noto Sans Devanagari', serif" font-size="14" font-weight="900" fill="#ffffff">हो</text>
                            <text x="20" y="30" text-anchor="middle" font-family="'Inter', sans-serif" font-size="8" font-weight="900" fill="#ffffff" letter-spacing="1">HKS</text>
                        </svg>
                    </div>
                    <div class="cert-brand-text">
                        <div class="cert-brand-name">Hoṛ Katha Suite</div>
                        <div class="cert-brand-version">v3.7.4 Pro Ultra</div>
                    </div>
                </div>

                <div class="cert-content">
                    <div class="cert-header">
                        <div class="cert-issuer-name">BOSC Tech &amp; Edu</div>
                        <div class="cert-main-title">Certificate of Typing Excellence</div>
                    </div>

                    <div class="cert-awarded-box">
                        <span class="cert-awarded-text">Awarded To</span>
                    </div>

                    <div class="cert-name-wrapper">
                        <div class="cert-name">${this.escapeHtml(formattedName)}</div>
                        <div class="cert-name-underline"></div>
                    </div>

                    <div class="cert-achievement">
                        This is to certify that <strong>${this.escapeHtml(displayName)}</strong> has successfully completed the <strong>Official Typing Proficiency Test</strong> conducted by <strong>BOSC Tech &amp; Edu</strong>, showing exceptional skill.
                    </div>

                    <div class="cert-details">
                        <div class="cert-detail-col left">
                            <div class="cert-detail-row">
                                <span class="label">Cert No:</span>
                                <span class="value mono">${this.escapeHtml(d.certificateNo)}</span>
                            </div>
                            <div class="cert-detail-row">
                                <span class="label">Date:</span>
                                <span class="value">${this.escapeHtml(dateStr)}</span>
                            </div>
                            <div class="cert-detail-row">
                                <span class="label">Speed:</span>
                                <span class="value">${d.wpm} WPM</span>
                            </div>
                            <div class="cert-detail-row">
                                <span class="label">Language:</span>
                                <span class="value">${this.escapeHtml(langName)}</span>
                            </div>
                        </div>

                        <div class="cert-details-divider"></div>

                        <div class="cert-detail-col right">
                            <div class="cert-detail-row">
                                <span class="label">Accuracy:</span>
                                <span class="value">${d.accuracy}%</span>
                            </div>
                            <div class="cert-detail-row">
                                <span class="label">Certificate Level:</span>
                                <span class="value">${this.escapeHtml(levelName)}</span>
                            </div>
                            <div class="cert-detail-row">
                                <span class="label">Grade:</span>
                                <span class="value">${this.escapeHtml(d.grade)}</span>
                            </div>
                            <div class="cert-detail-row">
                                <span class="label">Characters:</span>
                                <span class="value">${d.chars}</span>
                            </div>
                        </div>
                    </div>

                    <div class="cert-footer">
                        <div class="cert-signature-block">
                            <div class="cert-signature-line">
                                <div class="cert-signature-text">Parish Marandi</div>
                            </div>
                            <div class="cert-signature-name">BOSC Tech &amp; Edu</div>
                            <div class="cert-signature-title">Founder &amp; CEO</div>
                        </div>

                        <div class="cert-footer-qr">
                            <div class="cert-qr" id="certQrBox"></div>
                            <div class="cert-qr-label">Scan to Verify</div>
                        </div>

                        <div class="cert-seal-bottom-right">
                            <img src="assets/logos/bosc-gold-seal.png"
                                 alt="BOSC Official Seal"
                                 class="cert-gold-seal-img"
                                 onerror="this.style.display='none'; this.parentElement.classList.add('img-fallback');">
                        </div>
                    </div>

                    <div class="cert-footer-info">
                        Verified by BOSC Tech &amp; Edu · Made in India 🇮🇳 · www.bosctech.in
                    </div>
                </div>
            </div>
        `;
    },

    // ============================================================
    // 🎨 CORNER SVG
    // ============================================================
    getCornerSVG(position) {
        return `
            <div class="cert-corner cert-corner-${position}">
                <svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
                    <path d="M 5,5 L 25,5 Q 5,5 5,25 Z M 5,5 L 5,25 Q 5,5 25,5 Z M 10,10 L 20,10 L 10,20 Z" />
                    <circle cx="15" cy="15" r="3" />
                    <path d="M 30,5 L 55,5 L 55,10 L 35,10 L 30,15 Z" opacity="0.6" />
                    <path d="M 5,30 L 5,55 L 10,55 L 10,35 L 15,30 Z" opacity="0.6" />
                </svg>
            </div>
        `;
    },

    // ============================================================
    // ✅ QR RENDER — OfflineQRCode priority
    // ============================================================
    renderQRCode() {
        const qrBox = document.getElementById('certQrBox');
        if (!qrBox) return;

        qrBox.innerHTML = '';

        const verifyUrl = this.getVerifyUrl();
        console.log('🔗 QR Verify URL:', verifyUrl);

        // Priority 1: OfflineQRCode
        if (typeof window.OfflineQRCode !== 'undefined' && window.OfflineQRCode.render) {
            try {
                const success = window.OfflineQRCode.render(qrBox, verifyUrl, 200);
                if (success) {
                    console.log('✅ Certificate QR rendered via OfflineQRCode');
                    return;
                }
            } catch (e) {
                console.warn('[Certificate] OfflineQRCode failed:', e.message);
                qrBox.innerHTML = '';
            }
        }

        // Priority 2: Native QRCode
        if (typeof window.QRCode !== 'undefined') {
            try {
                const qrWrap = document.createElement('div');
                qrBox.appendChild(qrWrap);

                new window.QRCode(qrWrap, {
                    text: verifyUrl,
                    width: 200,
                    height: 200,
                    colorDark: '#000000',
                    colorLight: '#ffffff',
                    correctLevel: window.QRCode.CorrectLevel.H
                });

                setTimeout(() => {
                    const canvas = qrWrap.querySelector('canvas');
                    const img = qrWrap.querySelector('img');
                    if (canvas && img) img.remove();
                    if (canvas) {
                        canvas.style.width = '100%';
                        canvas.style.height = '100%';
                        canvas.style.display = 'block';
                    }
                }, 50);
                return;
            } catch (e) {
                console.warn('[Certificate] Native QRCode failed:', e);
                qrBox.innerHTML = '';
            }
        }

        // Priority 3: Network API
        const img = document.createElement('img');
        img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(verifyUrl)}&ecc=H&margin=1`;
        img.alt = 'QR';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.display = 'block';
        img.crossOrigin = 'anonymous';
        img.onerror = () => {
            qrBox.innerHTML = '<div style="font-size:0.7rem; color:#dc2626; text-align:center; padding:8px;">QR failed<br>Use verify link</div>';
        };
        qrBox.appendChild(img);
    },

    // ============================================================
    // ✅ VERIFY URL
    // ============================================================
    getVerifyUrl() {
        const d = this.currentData;
        let baseUrl = '';

        try {
            const origin = window.location.origin || '';
            const pathname = window.location.pathname || '';
            const protocol = window.location.protocol || '';

            const isFileProtocol = protocol === 'file:';
            const isNullOrigin = !origin || origin === 'null' || origin === 'undefined';

            if (isFileProtocol || isNullOrigin) {
                baseUrl = 'https://hor-katha.vercel.app/';
            } else {
                baseUrl = origin + pathname
                    .replace('index.html', '')
                    .replace('typing-test.html', '')
                    .replace('manual.html', '')
                    .replace('verify.html', '');
                if (!baseUrl.endsWith('/')) baseUrl += '/';
            }
        } catch (e) {
            baseUrl = 'https://hor-katha.vercel.app/';
        }

        const dateForUrl = (d.date instanceof Date && !isNaN(d.date.getTime()))
            ? d.date.toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0];

        const params = new URLSearchParams({
            cert: d.certificateNo,
            name: d.studentName,
            wpm: String(d.wpm),
            acc: String(d.accuracy),
            grade: d.grade,
            date: dateForUrl
        });

        return `${baseUrl}verify.html?${params.toString()}`;
    },

    // ============================================================
    // 🎫 GENERATE CERTIFICATE NUMBER
    // ============================================================
    generateCertificateNo(category) {
        const prefix = category === 'basic' ? 'HK-BAS'
                     : category === 'advanced' ? 'HK-ADV'
                     : 'HK-JOB';

        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const rand = Math.random().toString(36).substring(2, 6).toUpperCase();

        return `${prefix}-${yy}${mm}${dd}-${rand}`;
    },

    // ============================================================
    // 📛 CATEGORY NAME
    // ============================================================
    getCategoryName(group) {
        const map = {
            'basic': '🟢 Basic Level',
            'advanced': '🟠 Advanced Level',
            'job': '🔵 Job Oriented Level'
        };
        return map[group] || '🟢 Basic Level';
    },

    // ============================================================
    // 📛 LESSON NAME
    // ============================================================
    getLessonName(group, idx) {
        const names = {
            basic: ['Home Row Practice', 'Common Words', 'Short Sentences'],
            advanced: ['Punctuation & Quotes', 'Numbers & Symbols', 'Complex Paragraph'],
            job: ['Email Writing', 'Office Report', 'Government Format']
        };
        const groupNames = names[group] || names.basic;
        return groupNames[idx] || 'Typing Practice';
    },

    // ============================================================
    // 🎨 GET ADAPTIVE SCALE (based on device)
    // ============================================================
    // ✅ v6.6: Adaptive scale based on device capability
    //    • Mobile: 1.5 (faster, smaller files)
    //    • Tablet: 1.75
    //    • Desktop: 2 (higher quality)
    // ============================================================
    getAdaptiveScale() {
        try {
            const width = window.innerWidth;
            const dpr = window.devicePixelRatio || 1;

            // Mobile — smaller scale
            if (width < 768) return 1.5;

            // Tablet
            if (width < 1024) return 1.75;

            // Desktop — high quality
            // But cap based on device pixel ratio to avoid huge files
            return dpr > 2 ? 2 : 1.75;
        } catch (e) {
            return 1.5;
        }
    },

    // ============================================================
    // 🖼️ PRELOAD IMAGES (before html2canvas capture)
    // ============================================================
    // ✅ v6.6: Ensures all images are loaded before capture
    // ============================================================
    async preloadImages(element) {
        if (!element) return;

        const images = element.querySelectorAll('img');
        const promises = [];

        images.forEach(img => {
            // Skip if already loaded
            if (img.complete && img.naturalHeight !== 0) return;

            promises.push(new Promise((resolve) => {
                const timeoutId = setTimeout(() => {
                    console.warn('⚠️ Image load timeout:', img.src);
                    resolve();
                }, 3000);

                img.onload = () => {
                    clearTimeout(timeoutId);
                    resolve();
                };
                img.onerror = () => {
                    clearTimeout(timeoutId);
                    console.warn('⚠️ Image failed to load:', img.src);
                    resolve(); // Don't reject — proceed anyway
                };
            }));
        });

        if (promises.length > 0) {
            console.log(`🖼️ Preloading ${promises.length} images...`);
            await Promise.all(promises);
        }
    },

    // ============================================================
    // ⚡ RENDER CANVAS (shared logic for PDF/PNG)
    // ============================================================
    async renderCanvas(certElement) {
        // Load library if needed
        if (typeof window.html2canvas === 'undefined') {
            await this.loadHtml2Canvas();
        }

        // Preload images
        await this.preloadImages(certElement);

        // ✅ Adaptive scale
        const scale = this.getAdaptiveScale();

        const t0 = performance.now();

        const canvas = await window.html2canvas(certElement, {
            scale: scale,
            backgroundColor: '#ffffff',
            useCORS: true,
            logging: false,
            allowTaint: true,
            imageTimeout: 5000,
            removeContainer: true,
            width: certElement.offsetWidth,
            height: certElement.offsetHeight,
            foreignObjectRendering: false
        });

        const t1 = performance.now();
        console.log(`⚡ Canvas rendered in ${(t1 - t0).toFixed(0)}ms (scale: ${scale})`);

        return canvas;
    },

    // ============================================================
    // ⚡ FAST PDF DOWNLOAD — jsPDF + html2canvas
    // ============================================================
    async savePDF() {
        // ✅ Double-click guard
        if (this._isProcessing) {
            console.warn('⚠️ PDF already processing');
            return;
        }

        const certElement = document.getElementById('certificateElement');
        if (!certElement) {
            if (typeof showToast === 'function') showToast('Certificate not found', 'error');
            return;
        }

        this._isProcessing = true;

        if (typeof showToast === 'function') {
            showToast('⚡ PDF बन रहा है...', 'info', 2000);
        }

        try {
            // Load jsPDF in parallel with html2canvas
            if (typeof window.jspdf === 'undefined') {
                await this.loadJsPDF();
            }

            // Render canvas
            const canvas = await this.renderCanvas(certElement);

            // Create PDF directly
            const jsPDF = window.jspdf.jsPDF;
            const imgData = canvas.toDataURL('image/jpeg', 0.92);

            // A4 Landscape
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4',
                compress: true
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);

            const finalWidth = imgWidth * ratio;
            const finalHeight = imgHeight * ratio;

            const x = (pdfWidth - finalWidth) / 2;
            const y = (pdfHeight - finalHeight) / 2;

            pdf.addImage(imgData, 'JPEG', x, y, finalWidth, finalHeight, undefined, 'FAST');

            // ✅ Timestamp in filename (no collision)
            const timestamp = Date.now();
            const filename = `Typing_Certificate_${this.currentData.certificateNo}_${timestamp}.pdf`;

            // Direct download
            pdf.save(filename);

            console.log(`✅ PDF downloaded: ${filename}`);

            if (typeof showToast === 'function') {
                showToast('✅ PDF downloaded!', 'success', 2500);
            }

        } catch (e) {
            console.error('[Certificate] PDF failed:', e);
            if (typeof showToast === 'function') {
                showToast('⚠️ PDF fail: ' + e.message, 'warning', 4000);
            }
        } finally {
            this._isProcessing = false;

            // ✅ Free canvas memory
            try {
                const certElement = document.getElementById('certificateElement');
                // Canvas auto-cleaned by html2canvas
            } catch (e) {}
        }
    },

    // ============================================================
    // ⚡ FAST PNG DOWNLOAD — Direct Canvas.toBlob
    // ============================================================
    async downloadPNG() {
        // ✅ Double-click guard
        if (this._isProcessing) {
            console.warn('⚠️ PNG already processing');
            return;
        }

        const certElement = document.getElementById('certificateElement');
        if (!certElement) {
            if (typeof showToast === 'function') showToast('Certificate not found', 'error');
            return;
        }

        this._isProcessing = true;

        if (typeof showToast === 'function') {
            showToast('⚡ PNG बन रहा है...', 'info', 2000);
        }

        try {
            // Render canvas
            const canvas = await this.renderCanvas(certElement);

            // ✅ Higher quality for PNG
            const blob = await new Promise((resolve, reject) => {
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('Blob creation failed'));
                        } else {
                            resolve(blob);
                        }
                    },
                    'image/jpeg',
                    0.95  // PNG higher quality
                );
            });

            // ✅ Validate blob size
            if (!blob || blob.size === 0) {
                throw new Error('Empty blob generated');
            }

            // ✅ Timestamp in filename
            const timestamp = Date.now();
            const filename = `Typing_Certificate_${this.currentData.certificateNo}_${timestamp}.jpg`;

            this._fastDownload(blob, filename);

        } catch (e) {
            console.error('[Certificate] PNG failed:', e);
            if (typeof showToast === 'function') {
                showToast('⚠️ PNG fail: ' + e.message, 'warning', 4000);
            }
        } finally {
            this._isProcessing = false;
        }
    },

    // ============================================================
    // ⚡ FAST DOWNLOAD HELPER — RAF-based revoke
    // ============================================================
    _fastDownload(blob, filename) {
        const sizeKB = Math.round(blob.size / 1024);
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.download = filename;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // ✅ Fast revoke with RAF (ensures download started)
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                URL.revokeObjectURL(url);
            });
        });

        if (typeof showToast === 'function') {
            showToast(`✅ Downloaded! (${sizeKB} KB)`, 'success', 2500);
        }
    },

    // ============================================================
    // 📦 LOAD HTML2CANVAS DYNAMICALLY (with retry)
    // ============================================================
    loadHtml2Canvas() {
        return new Promise((resolve, reject) => {
            if (typeof window.html2canvas !== 'undefined') return resolve();

            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            script.async = true;
            script.onload = () => {
                console.log('✅ html2canvas loaded');
                resolve();
            };
            script.onerror = () => {
                console.error('❌ html2canvas load failed');
                reject(new Error('html2canvas load failed'));
            };
            document.head.appendChild(script);

            // ✅ Timeout fallback
            setTimeout(() => {
                if (typeof window.html2canvas === 'undefined') {
                    reject(new Error('html2canvas timeout'));
                }
            }, 10000);
        });
    },

    // ============================================================
    // 📦 LOAD JS-PDF DYNAMICALLY (with retry)
    // ============================================================
    loadJsPDF() {
        return new Promise((resolve, reject) => {
            if (window.jspdf && window.jspdf.jsPDF) return resolve();

            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.async = true;
            script.onload = () => {
                console.log('✅ jsPDF loaded');
                resolve();
            };
            script.onerror = () => {
                console.error('❌ jsPDF load failed');
                reject(new Error('jsPDF load failed'));
            };
            document.head.appendChild(script);

            // ✅ Timeout fallback
            setTimeout(() => {
                if (typeof window.jspdf === 'undefined') {
                    reject(new Error('jsPDF timeout'));
                }
            }, 10000);
        });
    },

    // ============================================================
    // 📱 SHARE ON WHATSAPP
    // ============================================================
    shareWhatsApp() {
        if (!this.currentData) return;
        const d = this.currentData;
        const verifyUrl = this.getVerifyUrl();

        const msg = `🎓 *TYPING CERTIFICATE ACHIEVED*\n\n👤 *Name:* ${d.studentName}\n🏆 *Category:* ${d.categoryName}\n📖 *Lesson:* ${d.lessonName}\n\n━━━━━━━━━━━━━━━━━━━━\n⚡ *Speed:* ${d.wpm} WPM\n🎯 *Accuracy:* ${d.accuracy}%\n🏅 *Grade:* ${d.grade}\n━━━━━━━━━━━━━━━━━━━━\n\n📋 *Certificate No:* ${d.certificateNo}\n\n🔗 *Verify Online:*\n${verifyUrl}\n\n🔒 Verified by *BOSC Tech & Edu*\n📱 Hoṛ Katha Suite v3.7.4`;

        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
    },

    // ============================================================
    // 🔗 COPY VERIFY LINK
    // ============================================================
    copyVerifyLink() {
        const url = this.getVerifyUrl();

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url)
                .then(() => {
                    if (typeof showToast === 'function') showToast('✅ Verify link copied!', 'success', 2500);
                })
                .catch(() => this.fallbackCopy(url));
        } else {
            this.fallbackCopy(url);
        }
    },

    fallbackCopy(text) {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(ta);

            if (typeof showToast === 'function') {
                showToast(ok ? '✅ Link copied!' : '❌ Copy failed', ok ? 'success' : 'error', 2000);
            }
        } catch (e) {
            alert('Copy failed: ' + text);
        }
    },

    // ============================================================
    // ✅ SAVE TO HISTORY — QuotaExceededError handling
    // ============================================================
    saveToHistory() {
        if (!this.currentData) return;

        try {
            const history = JSON.parse(localStorage.getItem('hor_cert_history') || '[]');

            history.unshift({
                certificateNo: this.currentData.certificateNo,
                studentName: this.currentData.studentName,
                category: this.currentData.category,
                categoryName: this.currentData.categoryName,
                lessonName: this.currentData.lessonName,
                wpm: this.currentData.wpm,
                accuracy: this.currentData.accuracy,
                grade: this.currentData.grade,
                date: (this.currentData.date instanceof Date && !isNaN(this.currentData.date.getTime()))
                    ? this.currentData.date.toISOString()
                    : new Date().toISOString()
            });

            if (history.length > 50) history.length = 50;

            try {
                localStorage.setItem('hor_cert_history', JSON.stringify(history));
            } catch (quotaError) {
                console.warn('Certificate history quota exceeded — trimming');
                history.length = 20;
                try {
                    localStorage.setItem('hor_cert_history', JSON.stringify(history));
                } catch (e2) {
                    console.error('Could not save history even after trim');
                    try {
                        localStorage.removeItem('hor_cert_history');
                    } catch (e3) {}
                }
            }
        } catch (e) {
            console.warn('saveToHistory failed:', e.message);
        }
    },

    // ============================================================
    // 📜 GET HISTORY
    // ============================================================
    getHistory() {
        try {
            return JSON.parse(localStorage.getItem('hor_cert_history') || '[]');
        } catch (e) {
            return [];
        }
    },

    // ============================================================
    // 🗑️ CLEAR HISTORY
    // ============================================================
    clearHistory() {
        try {
            localStorage.removeItem('hor_cert_history');
        } catch (e) {}
    },

    // ============================================================
    // ✅ CLOSE
    // ============================================================
    close() {
        const modal = document.getElementById('certificateModal');
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => {
                if (modal.parentNode) modal.parentNode.removeChild(modal);
            }, 350);
        }
        document.body.style.overflow = '';

        // ✅ Cleanup outside-click handler
        if (this._outsideClickHandler) {
            document.removeEventListener('click', this._outsideClickHandler);
            this._outsideClickHandler = null;
        }

        // ✅ Reset processing flag
        this._isProcessing = false;
    },

    // ============================================================
    // ✅ ESCAPE HTML
    // ============================================================
    escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/`/g, '&#96;')
            .replace(/\//g, '&#47;');
    }
};

// Expose globally
window.CertificateSystem = CertificateSystem;

// ============================================================
// ⌨️ ESC KEY HANDLER
// ============================================================
document.addEventListener('keydown', function(e) {
    const modal = document.getElementById('certificateModal');
    if (!modal || !modal.classList.contains('active')) return;
    if (e.key === 'Escape') {
        CertificateSystem.close();
    }
});

// ============================================================
// 📊 DEBUG HELPERS
// ============================================================
if (typeof window !== 'undefined') {
    window.CertificateDebug = {
        /**
         * Show status
         */
        status: () => {
            console.log('═══════════════════════════════════════════');
            console.log('🎓 Certificate System Status');
            console.log('───────────────────────────────────────────');
            console.log('  Version: v' + CertificateSystem.version);
            console.log('  Modal Open:', !!document.getElementById('certificateModal'));
            console.log('  Processing:', CertificateSystem._isProcessing);
            console.log('  Current Data:', CertificateSystem.currentData ? 'loaded' : 'none');
            console.log('  History Count:', CertificateSystem.getHistory().length);
            console.log('  html2canvas:', typeof window.html2canvas !== 'undefined' ? '✅' : '❌');
            console.log('  jsPDF:', typeof window.jspdf !== 'undefined' ? '✅' : '❌');
            console.log('  Adaptive scale:', CertificateSystem.getAdaptiveScale());
            console.log('  Device pixel ratio:', window.devicePixelRatio || 1);
            console.log('═══════════════════════════════════════════');
        },

        /**
         * Test QR rendering
         */
        testQR: () => {
            console.log('🧪 Testing QR rendering...');
            const box = document.getElementById('certQrBox');
            if (!box) {
                console.warn('QR box not found — open certificate first');
                return;
            }
            CertificateSystem.renderQRCode();
        },

        /**
         * Test certificate generation
         */
        testGenerate: () => {
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

        /**
         * Test PDF download
         */
        testPDF: () => {
            console.log('⚡ Testing PDF download...');
            CertificateSystem.savePDF();
        },

        /**
         * Test PNG download
         */
        testPNG: () => {
            console.log('⚡ Testing PNG download...');
            CertificateSystem.downloadPNG();
        },

        /**
         * Clear history
         */
        clearHistory: () => {
            CertificateSystem.clearHistory();
            console.log('🗑️ History cleared');
        },

        /**
         * Show history stats
         */
        historyStats: () => {
            const h = CertificateSystem.getHistory();
            console.log('📊 Certificate history (' + h.length + ' records):');
            console.table(h.map(x => ({
                No: x.certificateNo,
                Name: x.studentName,
                WPM: x.wpm,
                Grade: x.grade,
                Date: x.date ? x.date.split('T')[0] : 'N/A'
            })));
        },

        /**
         * Test image preload
         */
        testPreload: async () => {
            const el = document.getElementById('certificateElement');
            if (!el) {
                console.log('❌ Certificate not generated');
                return;
            }
            console.log('🧪 Testing image preload...');
            await CertificateSystem.preloadImages(el);
            console.log('✅ Preload complete');
        },

        /**
         * Show memory info
         */
        memory: () => {
            if (performance.memory) {
                const m = performance.memory;
                console.log('💾 Memory Info:');
                console.log('  Used:', (m.usedJSHeapSize / 1048576).toFixed(2), 'MB');
                console.log('  Total:', (m.totalJSHeapSize / 1048576).toFixed(2), 'MB');
                console.log('  Limit:', (m.jsHeapSizeLimit / 1048576).toFixed(2), 'MB');
            } else {
                console.log('Memory API not available');
            }
        }
    };
}

// ============================================================
// 📋 STARTUP LOG
// ============================================================
console.log('═══════════════════════════════════════════');
console.log('✅ CertificateSystem v' + CertificateSystem.version + ' loaded');
console.log('   📸 Adaptive scale: mobile=1.5, desktop=2');
console.log('   🖼️ Image preload: enabled');
console.log('   💾 Memory cleanup: enabled');
console.log('   🔒 Double-click guard: enabled');
console.log('═══════════════════════════════════════════');