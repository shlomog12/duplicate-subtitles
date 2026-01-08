
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


function removeSubtitles() {
    const video = document.querySelector('video');
    if (!video) return;

    Array.from(video.textTracks).forEach(track => {
        if (track.label === "Hebrew-Translated") track.mode = 'disabled';
    });
}

/**
 * Global cache to store Hebrew translations so we don't translate twice
 * Format: { index: "Hebrew Text" }
 */
let cachedHebrewTranslations = null;


async function runUdemyTranslator(srcLangCode= "en", targetLangCode = 'he', useStyle = true) {
    const resources = performance.getEntriesByType('resource');
    const vttResource = resources.findLast(r => r.name.includes('vtt') && r.name.includes(`/${srcLangCode}_`));
    if (!vttResource) return;
    try {
        const rawVtt = await fetchVttContent(vttResource.name);
        const parsedSubs = parseVttBlocks(rawVtt);
        // 1. If we don't have translations yet, fetch them once
        if (!cachedHebrewTranslations) {
            console.log("%c Fetching new Hebrew translations...", "color: orange;");
            const translatedSubs = await translateSubtitles(parsedSubs, targetLangCode);
            // Store only the Hebrew strings mapped by index
            cachedHebrewTranslations = translatedSubs.map(s => s.translatedText);
        } else {
            console.log("%c Using cached Hebrew translations with new source language.", "color: lightgreen;");
        }
        // console.log(parsedSubs);
        // 2. Map the existing Hebrew translations to the NEW original text
        const updatedSubs = parsedSubs.map((sub, index) => ({
            ...sub,
            translatedText: cachedHebrewTranslations[index] || sub.originalText
        }));

        // 3. Inject and Clean UI
        injectToNativePlayer(updatedSubs);
        disableOriginalSubtitles();
        if (useStyle) applyNativeSubtitleStyles();

        console.log("%c UI Updated with current source language.", "color: green; font-weight: bold;");
    } catch (err) {
        console.error("Process failed:", err);
    }
}







function startWatcher() {
    // let lastVttUrl = "";
    // console.log("%c Continuous Subtitle Watcher Active...", "color: cyan;");

    // setInterval(async () => {
    //     const resources = performance.getEntriesByType('resource');
    //     // Get the latest VTT resource
    //     const vttResources = resources.filter(r => r.name.includes('vtt-c.udemycdn.com'));
    //     const latestVtt = vttResources[vttResources.length - 1];

    //     if (latestVtt && latestVtt.name !== lastVttUrl) {
    //         lastVttUrl = latestVtt.name;
    //         console.log("%c New language/file detected:", "color: yellow;", lastVttUrl);
    //         await runUdemyTranslator('he', false);
    //     }
    // }, 1000);
    setInterval(() => {
        checkForLanguageChange();
    }, 2000);
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




// extrxactor current source language:


function getSelectedLanguage() {
    const selectedButton = document.querySelector('ul[aria-label="Captions"] button[aria-checked="true"]');
    if (selectedButton) {
        return selectedButton.textContent.replace(/\s*\[Auto\]/, "").trim();
    }
    return null;
}


function mapLanguageToCode(languageName) {
    let languageCodes = [
    "en","zh","es","ar","hi","fr","ru","bn","pt","id",
    "ur","de","ja","sw","mr","te","ta","tr","ko","vi",
    "it","pl","uk","fa","gu","kk","ro","nl","el","hu",
    "sv","fi","he","th","cs","pa","no","da","my",
    "ml","or","am","hy","km","lo","ps","az","eo","cy",
    "af","sq","be","bg","bs","ca","co","hr","et",
    "fo","fy","gd","gl","ka","ha","haw","ht","is","jv",
    "kn","ky","lb","la","mi","ne","ny","rn","sd",
    "sk","sl","sm","sn","so","sr","su","tg","tk",
    "ug","uz","xh","yi","yo","zu","ak","an","as","av",
    "ba","bi","br","ce","ch","cv","dz","ee","ff","fj",
    "gn","ho","io","ie","ii","iu","kg","kl",
    "kw","ln","lt","lu","lv","mh","mn",
    "ms","na","nd","ng","nn","nr","oc","om",
    "pi","qu","rm","sa","sc","se","sg","ta","te",
    "ti","tn","to","ts","tt","tw","ve","vo","wa","wo","za"
    ];
    languageCodes = [...new Set(languageCodes)];
    const dn = new Intl.DisplayNames(['en'], { type: 'language' });
    const code = languageCodes.find(code => dn.of(code).toLowerCase() === languageName.toLowerCase());
    return code || null;
}




let currentLanguage = null;
function checkForLanguageChange() {
    const selectLanguage = getSelectedLanguage();
    if (selectLanguage && selectLanguage !== currentLanguage) {
        console.log("%c Detected language change to:", "color: orange;", selectLanguage);
        currentLanguage = selectLanguage;
        if (currentLanguage.toLowerCase() === "off") {
            removeSubtitles();
            console.log("%c Subtitles turned off as per user selection.", "color: gray;");
            return;
        } else {
            const code = mapLanguageToCode(currentLanguage);
            runUdemyTranslator(code, "he", false);
        }
    } else {
        // console.log("%c No language change detected.", "color: gray;");
    }
}