let translatedCues = []; // כאן נשמור את כל הכתוביות המתורגמות

// 1. פונקציה לחילוץ הכתוביות מקובץ ה-VTT של Udemy
async function loadAndTranslateSubtitles() {
    const track = document.querySelector('track[kind="captions"]');
    if (!track || !track.src) return;

    console.log("Found subtitles file, starting pre-translation...");

    const response = await fetch(track.src);
    const vttText = await response.text();
    
    // פירוק ה-VTT למערך של אובייקטים (זמן התחלה, סוף וטקסט)
    const cues = parseVTT(vttText);
    const rawTexts = cues.map(c => c.text);

    // שליחה לתרגום מרוכז
    chrome.runtime.sendMessage({
        type: "TRANSLATE_BATCH",
        texts: rawTexts
    }, (res) => {
        if (res.translatedTexts) {
            translatedCues = cues.map((cue, i) => ({
                ...cue,
                translatedText: res.translatedTexts[i]
            }));
            console.log("All subtitles translated and ready!");
        }
    });
}

// 2. פונקציה פשוטה לפירוק קובץ כתוביות (Parser)
function parseVTT(vttText) {
    const blocks = vttText.split(/\n\s*\n/);
    return blocks.filter(b => b.includes('-->')).map(block => {
        const lines = block.split('\n');
        const times = lines[0].split(' --> ');
        return {
            start: timeToSeconds(times[0]),
            end: timeToSeconds(times[1]),
            text: lines.slice(1).join(' ')
        };
    });
}

function timeToSeconds(timeStr) {
    const p = timeStr.trim().split(':');
    let s = 0, m = 1;
    while (p.length > 0) {
        s += m * parseFloat(p.pop(), 10);
        m *= 60;
    }
    return s;
}

// 3. סנכרון והצגה לפי זמן הסרטון (רץ 10 פעמים בשנייה)
setInterval(() => {
    const video = document.querySelector('video');
    if (!video || translatedCues.length === 0) return;

    const currentTime = video.currentTime;
    const currentCue = translatedCues.find(c => currentTime >= c.start && currentTime <= c.end);

    if (currentCue) {
        updateUI(currentCue.translatedText);
    } else {
        updateUI(""); // הסתרת כתוביות אם אין טקסט בזמן הזה
    }
}, 100);

function updateUI(text) {
    let el = document.getElementById("hebrew-sub-overlay");
    if (!el) {
        el = document.createElement("div");
        el.id = "hebrew-sub-overlay";
        document.querySelector(".video-viewer--container--2_U95").appendChild(el);
    }
    el.innerText = text;
    el.style.display = text ? "block" : "none";
}

// זיהוי החלפת שיעור
let lastUrl = location.href;
setInterval(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        translatedCues = []; // איפוס
        setTimeout(loadAndTranslateSubtitles, 3000); // המתנה לטעינת הנגן החדש
    }
}, 2000);

// הפעלה ראשונית
setTimeout(loadAndTranslateSubtitles, 3000);