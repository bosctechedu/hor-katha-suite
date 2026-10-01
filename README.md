# Hoṛ/हो़ड़ Katha Suite v3.7.4 Pro Ultra

> **Multi-script typing suite for Santali, Hindi & English**
> Developed by **BOSC Tech & Edu**

[![Version](https://img.shields.io/badge/version-3.7.4-blue.svg)](https://github.com/bosctech/hor-katha-suite)
[![License](https://img.shields.io/badge/license-ISC-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Web%20%7C%20PWA%20%7C%20Windows-orange.svg)]()
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-purple.svg)]()
[![Made in India](https://img.shields.io/badge/Made%20in-Jharkhand%2C%20India-FF9933.svg)]()

---

## 📸 Preview

| Hindi Typing | Ol Chiki Keyboard | Certificate |
|:---:|:---:|:---:|
| ![Hindi](docs/screenshots/hindi.png) | ![Ol Chiki](docs/screenshots/olchiki.png) | ![Certificate](docs/screenshots/certificate.png) |

> **Note:** Screenshots `docs/screenshots/` folder में रखें

---

## ✨ Features

### 🌐 Multi-Language Support (5 Scripts)

- **English** — QWERTY + Typography + Symbols
- **Santali (Roman)** — Diacritics (a̱, e̱, o̱, ṭ, ḍ, ṇ, ñ, ṛ)
- **Santali (Devanagari)** — Full Unicode support with glottal marks
- **Ol Chiki (ᱚᱞ ᱪᱤᱠᱤ)** — ᱐᱑᱒᱓᱔᱕᱖᱗᱘᱙ + all 30 characters
- **Hindi (Devanagari)** — Complete Hindi typing with conjuncts

### ⌨️ Virtual Keyboard

- Native-like design (Android/iOS feel)
- Shift / Caps Lock / Numpad support
- Key click sound + Hover voice + TTS
- Auto-suggestions + Vocabulary manager
- Hardware keyboard typing support
- Symbol palette + Currency symbols

### 🛠️ Productivity Tools

| Tool | Description |
|------|-------------|
| 🔤 **Phonetic Transliteration** | `johar` → `ᱡᱚᱦᱟᱨ` (live typing) |
| 🔄 **Script Converter** | Devanagari ↔ Ol Chiki ↔ Roman Santali |
| 🅰️ **Kruti Dev Converter** | Unicode → Kruti Dev 010/011 for DTP |
| ⚙️ **IME Keymap Exporter** | JSON export for system integration |
| 😀 **Emoji Palette** | 500+ emojis with search + categories |
| 🔣 **Character Map** | Unicode visualization + copy + hover zoom |
| 🔍 **Find & Replace** | Regex-capable search + replace all |
| 📊 **Live Stats** | WPM, Words, Chars, Lines, Read Time |
| 🎤 **Voice Typing** | Web Speech API integration |
| 🔊 **Text-to-Speech** | Read editor content aloud |
| 🧘 **Zen Mode** | Distraction-free fullscreen writing |
| 📱 **QR Sync** | Transfer text to mobile via QR |

### 🎯 Typing Test + Certificate Generator

- **3 Categories:** Basic · Advanced · **Job Oriented**
- **9 Lessons** with real-world text samples
- **Timer Options:** 1 / 2 / 5 / 10 minutes
- **Real-time Feedback:** Correct (green) / Wrong (red) highlighting
- **Auto-Grading:** A+ / A / B / C / D
- **3 Certificate Styles:**
  - 📘 **Basic** — Elegant Blue
  - 📕 **Advanced** — Premium Gold
  - 📗 **Job Oriented** — Executive Formal
- **Multi-Language Certificate** — test भाषा auto-detect होती है
- **Real Handwritten Signature** — Parish Marandi (with SVG flourish)
- **QR Verification** on every certificate
- **Print / Save PDF / WhatsApp Share**

### 🔐 Security & Licensing

- **ECDSA P-256** digital signatures (bank-grade)
- **Device-locked** license verification (offline capable)
- **AES-256** encrypted local storage
- **SHA-256** device fingerprinting (23 entropy sources)
- **XSS Protection** — Security Shield with real-time DOM monitoring
- **Content Security Policy** (CSP) enforced
- **localStorage Guard** — prevents tampering
- **Anonymous Tracking** — consent-based, no personal data

### 💰 Pricing Plans

| Plan | Devices | Use Case | Regular | Offer |
|------|---------|----------|---------|-------|
| **Free** | 1 | Personal / Testing | ₹0 | ₹0 |
| **P1 — Community** | 1 | Student / Individual | ₹299 | **₹199** |
| **P2 — Commercial** | 3 | DTP Shop / Freelancer | ₹499 | **₹399** |
| **P3 — Enterprise** | 5 | School / College / Office | ₹999 | **₹699** |

### 📱 Multi-Platform Support

- **Web** — Any modern browser (Chrome, Edge, Firefox, Safari, Opera)
- **PWA** — Install on Android / iOS / Desktop
- **Windows** — Electron `.exe` (Portable + NSIS Installer)
- **macOS** — `.dmg` + `.zip` *(coming soon)*
- **Linux** — AppImage *(coming soon)*

### 💾 Data Safety

- **Auto-save** drafts every 400ms
- **Undo/Redo** stack (50 steps)
- **Export:** Word (.doc) · TXT · PDF (via print)
- **QR Sync** to mobile
- **Offline-first** (Service Worker caching)
- **Local fonts** cached for offline use

---

## 🚀 Quick Start

### Option 1: Run as Web App (Easiest)

```bash
git clone https://github.com/bosctech/hor-katha-suite.git
cd hor-katha-suite
python -m http.server 8080
```

फिर browser खोलो: `http://localhost:8080`

**Alternative servers:**

```bash
npx serve .
# या
php -S localhost:8080
# या VS Code में "Live Server" extension
```

> ⚠️ **Important:** `file://` protocol पर app **काम नहीं करेगा**। Local server जरूरी है।

---

### Option 2: Desktop App (Electron)

```bash
npm install
npm start
npm run build:win
```

**Output:**
- `dist/Hor Katha Suite Pro Setup 3.7.4.exe`
- `dist/Hor Katha Suite Pro 3.7.4 Portable.exe`

---

### Option 3: PWA Install

1. App को browser में खोलो
2. **"📲 Install"** button दबाओ
3. Browser prompt accept करो
4. Home screen पर icon add होगा

---

## 🔑 License Setup (Admin Only)

**Step 1: Keypair Generate करो**
```
1. Open: http://localhost:8080/admin/keygen.html
2. Click: "🆕 Generate New Keypair"
3. Click: "💾 Download Private Key" (3 places में backup रखो)
4. Click: "📋 Copy Public Key Line"
```

**Step 2: `js/config.js` update करो**

`LICENSE_PUBLIC_KEY_JWK` line paste करो copied value से।

**Step 3: Customer के लिए License Generate करो**
```
1. admin/keygen.html खोलो
2. Private Key load करो
3. Customer Name + Device ID भरो
4. Plan select करो (P1 / P2 / P3)
5. "🔏 Generate Signed License Key" click करो
6. Key copy करके customer को WhatsApp/Email करो
```

**Step 4: Customer Activate करे**
```
1. App में "🔑 Activate Pro" click
2. Name + License Key enter करे
3. "Activate Pro Now" click
4. ✅ Done!
```

---

## 📁 Project Structure

```
hor-katha-suite/
├── index.html
├── manifest.json
├── sw.js
├── privacy.html
├── README.md
├── main.js
├── package.json
├── .gitignore
│
├── css/
│   ├── style.css
│   ├── modals.css
│   ├── certificate.css
│   └── typing-test.css
│
├── js/
│   ├── config.js
│   ├── keymaps.js
│   ├── audio.js
│   ├── crypto-utils.js
│   ├── tracker.js
│   ├── security.js
│   ├── license.js
│   ├── editor.js
│   ├── keyboard.js
│   ├── modals.js
│   ├── privacy.js
│   ├── app.js
│   ├── certificate.js
│   └── typing-test.js
│
├── assets/
│   ├── icon.ico
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── icon-maskable-512.png
│   └── fonts/
│       ├── NotoSansDevanagari-Regular.ttf
│       ├── NotoSansDevanagari-Bold.ttf
│       ├── NotoSansOlChiki-Regular.ttf
│       ├── NotoSansOlChiki-Bold.ttf
│       ├── NotoSerifDevanagari-Regular.ttf
│       └── NotoSerifDevanagari-Bold.ttf
│
├── admin/                # ⚠️ PRIVATE — never deploy!
│   ├── keygen.html
│   ├── dashboard.html
│   └── debug.html
│
└── docs/
    ├── screenshots/
    └── USER_MANUAL.md
```

---

## 🌐 Browser Support

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 90+ | ✅ Full |
| Edge | 90+ | ✅ Full |
| Firefox | 88+ | ✅ Full |
| Safari | 14+ | ⚠️ Minor issues |
| Opera | 76+ | ✅ Full |
| Brave | 1.20+ | ✅ Full |

---

## 🎤 Voice Input

| Language | Recognition | Accuracy |
|----------|-------------|----------|
| English | en-US | 95%+ |
| Hindi | hi-IN | 90%+ |
| Santali (Dev) | hi-IN | 80%+ |

---

## 🔐 Security Notes

**For Developers:**
- ⚠️ NEVER commit `admin/private-key.json` to git
- ⚠️ `admin/` folder OFF public server रखो
- ⚠️ HTTPS या localhost पर ही run करो
- ⚠️ Private key 3+ places में backup रखो

**For Users:**
- 🔒 AES-256 encryption
- 🔒 No telemetry without consent
- 🔒 No keystroke logging
- 🔒 Device-locked license

---

## 🐛 Known Issues

| Issue | Workaround |
|-------|------------|
| Safari signature format | Chrome/Edge use करो |
| PWA install on iOS 15 | Manual "Add to Home Screen" |
| TTS on Android Chrome | Page refresh करो |
| Kruti Dev font | System पर font install करो |

---

## 🗺️ Roadmap

### v3.8.0 (Q1 2026)
- [ ] Cloud sync
- [ ] Backup / Restore
- [ ] 5 certificate styles
- [ ] AI word prediction
- [ ] Android Play Store

### v4.0.0 (Q3 2026)
- [ ] Multi-user support
- [ ] Team collaboration
- [ ] Santali dictionary
- [ ] macOS signed app

---

## 🧪 Testing Checklist

- [ ] App loads
- [ ] 5 language tabs work
- [ ] Virtual keyboard renders
- [ ] Typing works (virtual + hardware)
- [ ] Voice input
- [ ] TTS
- [ ] Typing Test → Certificate
- [ ] Print / Save PDF
- [ ] WhatsApp Share
- [ ] License activation
- [ ] Offline mode
- [ ] PWA install
- [ ] Dark/Light theme
- [ ] Zen mode
- [ ] Character Map
- [ ] Kruti Dev converter
- [ ] Script converter
- [ ] Find & Replace

---

## 🤝 Contributing

Bug reports, translations, documentation — सब welcome!

**Contact:** bosctechedu@gmail.com

---

## 📞 Support

| Channel | Contact | Time |
|---------|---------|------|
| 📧 Email | bosctechedu@gmail.com | 24 hrs |
| 📱 WhatsApp | +91 91109 77117 | 2-4 hrs |
| 💬 GitHub | [Issues](https://github.com/bosctech/hor-katha-suite/issues) | 48 hrs |

**Hours:** Mon–Sat, 9 AM – 9 PM IST

---

## 📜 License

**ISC License**

- ✅ Personal / educational use — Free
- ✅ Commercial — P2/P3 plans
- ❌ Reselling without permission

---

## 🙏 Credits

**Developed by:** Parish Marandi (BOSC Tech & Edu)

**Thanks:** Santali community, Beta testers, Google Noto Fonts

---

## 📈 Version History

### v3.7.4 (Sep 2026) — Current
- ✅ 3 certificate styles
- ✅ Multi-language certificate
- ✅ Real handwritten signature
- ✅ Enhanced device fingerprint (23 sources)
- ✅ Offline fonts cache
- ✅ Certificate ↔ typing test fix
- ✅ Privacy consent banner
- ✅ SW duplicate fix
- ✅ Better receipt numbers (6 chars)

### v3.7.0 (Aug 2026)
- Kruti Dev converter
- Typing test + 9 lessons
- Certificate generator

### v3.6.0 (Jul 2026)
- Ol Chiki support
- Phonetic transliteration
- Character map

### v3.5.0 (Jun 2026) — Initial release
- Basic Hindi + English
- Virtual keyboard

---

## 🎯 Quick Links

- 🏠 **Website:** [bosctech.in](https://bosctech.in)
- 📥 **Download:** [GitHub Releases](https://github.com/bosctech/hor-katha-suite/releases)
- 📖 **Manual:** [docs/USER_MANUAL.md](docs/USER_MANUAL.md)
- 🔒 **Privacy:** [privacy.html](privacy.html)
- 💬 **WhatsApp:** [+91 91109 77117](https://wa.me/919110977117)
- 📧 **Email:** [bosctechedu@gmail.com](mailto:bosctechedu@gmail.com)

---

<div align="center">

## 🌟 Show Your Support

अगर project पसंद आया हो तो ⭐ **star** करें!

**Made with ❤️ in Jharkhand, India**

**BOSC Tech & Edu © 2024-2026**

[⬆ Back to Top](#hoṛहो़ड़-katha-suite-v374-pro-ultra)

</div>