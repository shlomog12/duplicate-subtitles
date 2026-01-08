/**
 * --- 1. עזרים וחישובים (Helpers) ---
 */
const parseVttTime = (timeStr) => {
    const parts = timeStr.split(':');
    const seconds = parseFloat(parts.pop());
    const minutes = parseInt(parts.pop() || 0);
    const hours = parseInt(parts.pop() || 0);
    return (hours * 3600) + (minutes * 60) + seconds;
};

/**
 * --- 2. שירותי רשת ותרגום (Network & Translation) ---
 */
async function fetchVttContent(url) {
    const resp = await fetch(url);
    return await resp.text();
}


async function translateChunk(text, targetLang) {
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
        const response = await fetch(url);
        const data = await response.json();
        return data[0].map(item => item[0]).join('');
    } catch (e) {
        console.warn("Translation failed for chunk, returning original.", e);
        return text;
    }
}


function parseVttBlocks(vttText) {
    const blocks = splitToBlocks(vttText);
    return blocks
        .map(parseBlock)
        .filter(Boolean);
}

function splitToBlocks(vttText) {
    return vttText.split(/\n\s*\n/);
}

function parseBlock(block) {
    const lines = splitToLines(block);
    const timeLine = findTimeLine(lines);

    if (!timeLine) return null;

    const { start, end } = parseTimeLine(timeLine);
    const originalText = extractText(lines, timeLine);

    if (!originalText) return null;

    return { start, end, originalText };
}

function splitToLines(block) {
    return block.split('\n');
}

function findTimeLine(lines) {
    return lines.find(line => line.includes('-->'));
}

function parseTimeLine(timeLine) {
    const [start, end] = timeLine.split('-->').map(t => t.trim());
    return { start, end };
}

function extractText(lines, timeLine) {
    const startIndex = lines.indexOf(timeLine) + 1;

    return lines
        .slice(startIndex)
        .join(' ')
        .replace(/<[^>]*>/g, '')
        .trim();
}





async function translateSubtitles(subsData, targetLang) {
    const translatedSubs = [];
    const chunkSize = 15;

    for (let i = 0; i < subsData.length; i += chunkSize) {
        const chunk = subsData.slice(i, i + chunkSize);
        const combinedText = chunk.map(d => d.originalText).join(' \n ');
        
        const translatedResult = await translateChunk(combinedText, targetLang);
        const translatedLines = translatedResult.split('\n');

        chunk.forEach((item, index) => {
            translatedSubs.push({
                ...item,
                translatedText: translatedLines[index]?.trim() || item.originalText
            });
        });

        console.log(`תרגום: ${Math.min(i + chunkSize, subsData.length)} / ${subsData.length}`);
        await new Promise(r => setTimeout(r, 400));
    }
    return translatedSubs;
}

/**
 * --- 4. ממשק משתמש ועיצוב (UI & Styling) ---
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
}

function disableOriginalSubtitles() {
    const video = document.querySelector('video');
    if (!video) return;

    // כיבוי מסלולים קיימים
    Array.from(video.textTracks).forEach(track => {
        if (track.label !== "Hebrew-Translated") track.mode = 'disabled';
    });

    // הזרקת CSS להסתרה מוחלטת של הקונטיינר של Udemy
    const style = document.createElement('style');
    style.innerHTML = `[class*="captions-display--captions-container"] { display: none !important; }`;
    document.head.appendChild(style);
}

/**
 * --- 5. הזרקת כתוביות (Injection) ---
 */
function injectToNativePlayer(subsArray) {
    const video = document.querySelector('video');
    if (!video) return;

    // ניקוי מסלול קודם שלנו אם קיים
    Array.from(video.textTracks).forEach(track => {
        if (track.label === "Hebrew-Translated") track.mode = 'disabled';
    });

    const track = video.addTextTrack("captions", "Hebrew-Translated", "he");
    track.mode = 'showing';

    subsArray.forEach(sub => {
        const cue = new VTTCue(
            parseVttTime(sub.start), 
            parseVttTime(sub.end), 
            `${sub.translatedText}\n${sub.originalText}`
        );
        track.addCue(cue);
    });
}

/**
 * --- 6. הפונקציה הראשית (Main Orchestrator) ---
 */
async function runUdemyTranslator(targetLang = 'he', useStyle = true) {
    console.log("%c תהליך התחיל...", "color: orange; font-weight: bold;");

    const resources = performance.getEntriesByType('resource');
    const vttResource = resources.find(r => r.name.includes('vtt-c.udemycdn.com'));

    if (!vttResource) {
        return console.error("לא נמצא קובץ VTT. וודא שהכתוביות דולקות.");
    }

    try {
        const rawVtt = await fetchVttContent(vttResource.name);
        const parsedSubs = parseVttBlocks(rawVtt);
        const translatedSubs = await translateSubtitles(parsedSubs, targetLang);

        injectToNativePlayer(translatedSubs);
        disableOriginalSubtitles();
        if (useStyle) applyNativeSubtitleStyles();

        console.log("%c הושלם בהצלחה!", "color: green; font-weight: bold;");
    } catch (err) {
        console.error("התהליך נכשל:", err);
    }
}

// הפעלה
runUdemyTranslator('he', true);