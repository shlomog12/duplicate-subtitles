# 🎓 Udemy Live Subtitle Translator

A JavaScript script that **translates Udemy subtitles in real time** (e.g. to Hebrew) and injects them directly into the **native HTML5 video player**, while automatically reacting to subtitle language changes made by the user.

---

## ✨ Features

* 🔄 Automatically detects the currently loaded `.vtt` subtitle file
* 🌍 Translates subtitles using Google Translate (unofficial public endpoint)
* 💾 Smart caching – subtitles are translated only once
* 🎬 Injects subtitles into the native HTML5 video player (`TextTracks`)
* 🎨 Custom subtitle styling (dark background, readable font)
* 🔇 Fully disables Udemy’s original subtitle overlay
* 🧠 Detects subtitle language changes in real time
* 🚫 Supports turning subtitles off via Udemy UI

---

## 🧩 How It Works

1. Detects the active `.vtt` subtitle resource loaded by Udemy
2. Fetches and parses WebVTT subtitle blocks
3. Translates subtitles in chunks to avoid rate limits
4. Caches translated subtitles in memory
5. Injects translated subtitles into the native video player
6. Continuously watches for subtitle language changes

---

## 🛠️ Technologies Used

* Vanilla JavaScript
* HTML5 Video `TextTracks` API
* WebVTT (`VTTCue`)
* Google Translate (unofficial endpoint)
* DOM APIs
* Performance API (`performance.getEntriesByType`)

---

## ▶️ Usage

### Option 1 – Run in Browser Console (Testing)

1. Open a Udemy course video
2. Open **DevTools → Console**
3. Paste the script
4. Change the subtitle language in Udemy – translation starts automatically

### Option 2 – Chrome Extension (Recommended)

* Use the script as a `content.js` file
* Automatically runs on Udemy video pages

---

## ⚙️ Core Functions

### Translation & Injection

* `runUdemyTranslator(sourceLangCode, targetLangCode)`
* `injectToNativePlayer(subtitles)`
* `removeSubtitles()`

### Subtitle Parsing

* `parseVttBlocks()`
* `parseVttTime()`

### Translation Logic

* `translateSubtitles()`
* `translateChunk()`

### Language Detection

* `getSelectedLanguage()`
* `mapLanguageToCode()`
* `checkForLanguageChange()`

---

## 🌐 Supported Languages

* Any subtitle language supported by Udemy
* Automatic ISO-639-1 language code mapping
* Default target language: **Hebrew (`he`)**
* Easily configurable to other target languages

---

## 🎨 Subtitle Styling

Default injected subtitle style:

```css
video::cue {
    background: rgba(0, 0, 0, 0.75);
    color: #ffffff;
    font-family: "Segoe UI", Tahoma, sans-serif;
    font-size: 1.2rem;
    line-height: 1.4;
}
```

Styling can be disabled by running:

```js
runUdemyTranslator(code, "he", false);
```

---

## ⚠️ Known Limitations

* Uses an unofficial Google Translate endpoint (may change or break)
* Relies on Udemy’s internal DOM structure
* Intended for personal / educational use
* Not optimized for mobile or server-side environments

---

## 🚀 Future Improvements

* ⏱️ Better resync handling
* 🌍 Dynamic target language selection
* 🧩 UI controls
* 💾 Persistent caching (localStorage)
* 📦 Full Chrome Extension packaging

---

## 📄 Disclaimer

This project is **not affiliated with Udemy or Google**.
Provided for educational and personal use only.
