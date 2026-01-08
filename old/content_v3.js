/**
 * 1. פונקציות עזר (Utility Functions)
 */
const parseVttTime = (timeStr) => {
    const parts = timeStr.split(':');
    const seconds = parseFloat(parts.pop());
    const minutes = parseInt(parts.pop() || 0);
    const hours = parseInt(parts.pop() || 0);
    return (hours * 3600) + (minutes * 60) + seconds;
};

async function translateText(text, targetLang = 'he') {
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
        const response = await fetch(url);
        const data = await response.json();
        return data[0].map(item => item[0]).join('');
    } catch (e) { return text; }
}

/**
 * 2. עיצוב הכתוביות (Styling)
 * פונקציה נפרדת לשליטה במראה הכתוביות של ה-Native Player
 */
function applyNativeSubtitleStyles() {
    const styleId = 'custom-native-subs-style';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
        video::cue {
            background: rgba(0, 0, 0, 0.75);
            color: #ffffff;
            font-family: "Segoe UI", Tahoma, sans-serif;
            font-size: 1.2rem;
            line-height: 1.4;
        }
    `;
    document.head.appendChild(style);
    console.log("%c עיצוב הכתוביות הופעל", "color: blue;");
}

/**
 * 3. ליבת התהליך (Core Logic)
 */
async function runUdemyTranslator(targetLang = 'he', useStyle = true) {
    console.log("%c מתחיל תהליך חילוץ ותרגום...", "color: orange; font-weight: bold;");

    // איתור קובץ ה-VTT
    const resources = performance.getEntriesByType('resource');
    const vtt = resources.find(r => r.name.includes('vtt-c.udemycdn.com'));
    // const vtt = resources.find(r => r.name.includes('.vtt') || r.name.includes('captions'));

    if (!vtt) {
        return console.error("לא נמצא קובץ כתוביות. וודא שהן דולקות בנגן.");
    }

    try {
        const resp = await fetch(vtt.name);
        const text = await resp.text();
        const blocks = text.split(/\n\s*\n/);
        
        const subs = [];
        const chunkSize = 15;

        // עיבוד ותרגום בצ'אנקים
        for (let i = 0; i < blocks.length; i += chunkSize) {
            const chunkBlocks = blocks.slice(i, i + chunkSize);
            const chunkData = [];

            for (const block of chunkBlocks) {
                const lines = block.split('\n');
                const timeLine = lines.find(l => l.includes('-->'));
                if (timeLine) {
                    const [start, end] = timeLine.split('-->').map(t => t.trim());
                    const originalText = lines.slice(lines.indexOf(timeLine) + 1).join(' ').replace(/<[^>]*>/g, '').trim();
                    if (originalText) chunkData.push({ start, end, originalText });
                }
            }

            if (chunkData.length > 0) {
                const combined = chunkData.map(d => d.originalText).join(' \n ');
                const translated = await translateText(combined, targetLang);
                const translatedLines = translated.split('\n');

                chunkData.forEach((item, index) => {
                    subs.push({
                        ...item,
                        translatedText: translatedLines[index]?.trim() || item.originalText
                    });
                });
            }
            console.log(`התקדמות: ${Math.min(i + chunkSize, blocks.length)} / ${blocks.length}`);
            await new Promise(r => setTimeout(r, 400)); // מניעת חסימה
        }

        // הזרקה לנגן
        injectToNativePlayer(subs);
        if (useStyle) applyNativeSubtitleStyles();
        disableOriginalSubtitles();

    } catch (err) {
        console.error("התהליך נכשל:", err);
    }
}

/**
 * 4. הזרקה לנגן (Native Injection)
 */
function injectToNativePlayer(subsArray) {
    const video = document.querySelector('video');
    if (!video) return;

    // הסרת מסלולים קודמים שלנו
    Array.from(video.textTracks).forEach(track => {
        if (track.label === "Hebrew-Translated") track.mode = 'disabled';
    });

    const track = video.addTextTrack("captions", "Hebrew-Translated", "he");
    track.mode = 'showing';

    subsArray.forEach(sub => {
        const start = parseVttTime(sub.start);
        const end = parseVttTime(sub.end);
        const cueText = `${sub.translatedText}\n${sub.originalText}`;
        track.addCue(new VTTCue(start, end, cueText));
    });

    console.log("%c תרגום הוזרק בהצלחה ל-Native Track!", "color: green; font-weight: bold;");
}



/**
 * 2. כיבוי כתוביות מקוריות (Disable Original Subs)
 */
function disableOriginalSubtitles() {
    const video = document.querySelector('video');
    if (!video) return;

    // 1. כיבוי כל מסלולי הטקסט הקיימים בנגן (חוץ משלנו)
    Array.from(video.textTracks).forEach(track => {
        if (track.label !== "Hebrew-Translated") {
            track.mode = 'disabled';
        }
    });

    // 2. הסתרת האלמנט הויזואלי של Udemy מה-DOM
    const originalContainer = document.querySelector('.captions-display--captions-container--PqdGQ');
    if (originalContainer) {
        originalContainer.style.display = 'none';
    }

    // הזרקת CSS למניעת הופעה חוזרת של הכתוביות המקוריות
    const hideStyle = document.createElement('style');
    hideStyle.innerHTML = `
        [class*="captions-display--captions-container"] { display: none !important; }
    `;
    document.head.appendChild(hideStyle);
    
    console.log("%c הכתוביות המקוריות כובו והוסתרו.", "color: red;");
}

// הפעלה:
runUdemyTranslator('he', true);