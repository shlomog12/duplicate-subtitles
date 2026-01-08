
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
 * Global cache to store Hebrew translations so we don't translate twice
 * Format: { index: "Hebrew Text" }
 */
/**
 * --- Updated Global Cache & State ---
 */
let cachedHebrewTranslations = null;
let currentActiveVttUrl = ""; // לעקוב אחרי מה שבאמת מוצג כרגע

async function runUdemyTranslator(vttUrl, targetLang = 'he', useStyle = true) {
    if (!vttUrl) return;

    try {
        const rawVtt = await fetchVttContent(vttUrl);
        const parsedSubs = parseVttBlocks(rawVtt);

        // 1. Logic for Translation Cache
        if (!cachedHebrewTranslations) {
            console.log("%c Fetching new Hebrew translations...", "color: orange;");
            const translatedSubs = await translateSubtitles(parsedSubs, targetLang);
            cachedHebrewTranslations = translatedSubs.map(s => s.translatedText);
        } else {
            console.log("%c Using cached Hebrew translations.", "color: lightgreen;");
        }
        console.log(parsedSubs);
        // 2. Map Hebrew to the new Source Language
        const updatedSubs = parsedSubs.map((sub, index) => ({
            ...sub,
            translatedText: cachedHebrewTranslations[index] || sub.originalText
        }));

        // 3. UI Updates
        injectToNativePlayer(updatedSubs);
        disableOriginalSubtitles();
        if (useStyle) applyNativeSubtitleStyles();

        console.log("%c Subtitles Refreshed Successfully!", "color: green; font-weight: bold;");
    } catch (err) {
        console.error("Process failed:", err);
    }
}

/**
 * --- Enhanced Watcher (Fixed for Re-selecting languages) ---
 */
function startWatcher() {
    console.log("%c Subtitle Switcher Watcher Active...", "color: cyan;");

    setInterval(async () => {
        // Find the active <track> element that Udemy is currently using
        // Udemy usually adds a track element to the video when subtitles are enabled
        const video = document.querySelector('video');
        if (!video) return;

        const activeTrack = Array.from(video.querySelectorAll('track'))
            .find(t => t.src.includes('vtt-c.udemycdn.com'));

        if (activeTrack && activeTrack.src !== currentActiveVttUrl) {
            currentActiveVttUrl = activeTrack.src;
            console.log("%c Active subtitle track changed:", "color: yellow;", currentActiveVttUrl);
            await runUdemyTranslator(currentActiveVttUrl, 'he', false);
            return;
        }

        // Fallback: Check performance entries for the very first load if track is not yet in DOM
        if (!currentActiveVttUrl) {
            const resources = performance.getEntriesByType('resource');
            const latestVtt = resources.findLast(r => r.name.includes('vtt-c.udemycdn.com'));
            if (latestVtt) {
                currentActiveVttUrl = latestVtt.name;
                await runUdemyTranslator(currentActiveVttUrl, 'he', false);
            }
        }
    }, 1000);
}

// Start monitoring
startWatcher();


















// parser:


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








// transltor:


async function translateSubtitles(subsData, targetLang) {
    const chunkSize = 30;
    const translatedSubs = [];

    for (const { chunk, startIndex } of iterateChunks(subsData, chunkSize)) {
        const translatedLines = await translateSubsChunk(chunk, targetLang);
        appendTranslatedChunk(translatedSubs, chunk, translatedLines);
        // logProgress(startIndex, chunkSize, subsData.length);
        await delay(400);
    }

    return translatedSubs;
}

function* iterateChunks(data, chunkSize) {
    for (let i = 0; i < data.length; i += chunkSize) {
        yield {
            chunk: data.slice(i, i + chunkSize),
            startIndex: i
        };
    }
}

async function translateSubsChunk(chunk, targetLang) {
    const combinedText = combineOriginalTexts(chunk);
    const translatedResult = await translateChunk(combinedText, targetLang);
    return splitTranslatedLines(translatedResult);
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



function combineOriginalTexts(chunk) {
    return chunk.map(item => item.originalText).join(' \n ');
}


function splitTranslatedLines(translatedResult) {
    return translatedResult.split('\n');
}

function appendTranslatedChunk(result, chunk, translatedLines) {
    chunk.forEach((item, index) => {
        result.push({
            ...item,
            translatedText: translatedLines[index]?.trim() || item.originalText
        });
    });
}

function logProgress(startIndex, chunkSize, total) {
    const done = Math.min(startIndex + chunkSize, total);
    console.log(`תרגום: ${done} / ${total}`);
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}