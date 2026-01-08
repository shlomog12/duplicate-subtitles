// פונקציית עזר להמרת זמן (00:00:00.000) לשניות
function timeToSeconds(timeStr) {
    const [hms, ms] = timeStr.split('.');
    const [h, m, s] = hms.split(':').map(parseFloat);
    return (h * 3600) + (m * 60) + s + (parseFloat(ms) / 1000 || 0);
}

// פונקציה לתרגום טקסט באמצעות API חינמי
async function translateText(text, targetLang = 'he') {
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
        const response = await fetch(url);
        const data = await response.json();
        // התוצאה של גוגל מגיעה במבנה של מערכים מקוננים
        return data[0].map(item => item[0]).join('');
    } catch (error) {
        console.error("Translation error:", error);
        return text; // מחזיר את המקור במקרה של שגיאה
    }
}


async function getSubtitlesArrayWithEnd() {
    // 1. איתור הקובץ מהרשת
    const resources = performance.getEntriesByType('resource');
    const vttResource = resources.find(r => r.name.includes('vtt-c.udemycdn.com'));

    if (!vttResource) {
        console.error("לא נמצא קובץ כתוביות. וודא שהן מופעלות בסרטון.");
        return;
    }

    try {
        const response = await fetch(vttResource.name);
        const vttText = await response.text();

        // 2. פירוק הקובץ לפי בלוקים
        const blocks = vttText.split(/\n\s*\n/);
        
        const subtitleArray = blocks.map(block => {
            const lines = block.split('\n');
            
            // חיפוש השורה עם סימן החץ -->
            const timeLine = lines.find(l => l.includes('-->'));
            if (!timeLine) return null;

            // פיצול הזמנים (התחלה וסיום)
            const [startTime, endTime] = timeLine.split('-->').map(t => t.trim());

            // איחוד הטקסט וניקוי
            const textLines = lines.slice(lines.indexOf(timeLine) + 1);
            const cleanText = textLines
                .join(' ')
                .replace(/<[^>]*>/g, '') 
                .trim();

            return {
                start: startTime,
                end: endTime,
                text: cleanText
            };
        }).filter(item => item !== null && item.text !== "");

        // console.log("%c המערך עם זמני סיום מוכן:", "color: #2ecc71; font-weight: bold;");
        console.table(subtitleArray.slice(0, 5)); // מציג את 5 הראשונים בטבלה יפה

        return subtitleArray;

    } catch (error) {
        console.error("שגיאה בעיבוד הכתוביות:", error);
    }
}


async function getTranslatedSubtitlesFast(targetLang = 'he') {
    const subs = await getSubtitlesArrayWithEnd(); // משתמש בפונקציה הקודמת שכבר כתבנו
    if (!subs) return;

    const chunkSize = 20; // מספר שורות לתרגום בכל פעם
    const finalSubs = [];
    
    // console.log(`%c מתחיל תרגום מהיר בבלוקים... (${subs.length} שורות)`, "color: blue; font-weight: bold;");

    for (let i = 0; i < subs.length; i += chunkSize) {
        const chunk = subs.slice(i, i + chunkSize);
        
        // מחברים את כל הטקסטים בבלוק עם מפריד ייחודי כדי שגוגל לא יבלבל ביניהם
        const combinedText = chunk.map(s => s.text).join(' \n '); 

        try {
            const translatedCombined = await translateText(combinedText, targetLang);
            
            // מפצלים חזרה את התרגום לפי המפריד
            const translatedLines = translatedCombined.split('\n');

            chunk.forEach((sub, index) => {
                const translated = translatedLines[index] ? translatedLines[index].trim() : sub.text;
                const result = {
                    start: sub.start,
                    end: sub.end,
                    original: sub.text,
                    translated: translated
                };
                finalSubs.push(result);
                
                // הדפסה לפורמט שביקשת
                // console.log(`[${result.start} --> ${result.end}]\nEN: ${result.original}\nHE: ${result.translated}\n---`);
            });

            // השהיה קטנה מאוד בין בלוקים כדי להיות "נחמדים" לשרת
            await new Promise(r => setTimeout(r, 500));

        } catch (error) {
            console.error("שגיאה בתרגום בלוק:", error);
        }
    }

    // console.log("%c הסתיים! המערך המלא מוכן במשתנה 'finalResult'", "color: green;");
    window.finalResult = finalSubs;
    return finalSubs;
}


let subtitleSyncInterval;

function startSubtitlesInjection(subsArray) {
    const video = document.querySelector('video');
    
    if (!video) {
        console.error("לא נמצא נגן וידאו.");
        return;
    }

    if (subtitleSyncInterval) clearInterval(subtitleSyncInterval);

    console.log("%c מנוע ההזרקה המשופר התחיל לעבוד!", "color: cyan; font-weight: bold;");

    subtitleSyncInterval = setInterval(() => {
        const currentTime = video.currentTime;

        // 1. מציאת הכתובית המתאימה במערך
        const currentSub = subsArray.find(s => 
            currentTime >= timeToSeconds(s.start) && 
            currentTime <= timeToSeconds(s.end)
        );

        // 2. איתור האלמנט החי ב-DOM בכל פעימה (פותר את בעיית האלמנט שנעלם)
        const captionDisplay = document.querySelector('[data-purpose="captions-cue-text"]');

        if (captionDisplay && currentSub) {
            // 3. בדיקה אם המידע כבר קיים (מונע רינדור מיותר)
            // נבדוק אם ה-ID של הכתובית (זמן ההתחלה) כבר רשום על האלמנט
            if (captionDisplay.getAttribute('data-last-sub-start') !== currentSub.start) {
                
                // הזרקת המידע
                captionDisplay.innerHTML = `
                    <div style="text-align: center; direction: rtl;">
                        <div style="color: #fff; font-weight: bold; margin-bottom: 4px;">${currentSub.translated}</div>
                        <div style="font-size: 0.85em; opacity: 0.9; color: #eee; direction: ltr;">${currentSub.original}</div>
                    </div>
                `;

                // עדכון ה"דגל" כדי שלא נזריק שוב את אותה כתובית
                captionDisplay.setAttribute('data-last-sub-start', currentSub.start);
                
                // אופציונלי: הדפסה קטנה ללוג לבקרה
                console.log("Injected: " + currentSub.start);
            }
        }
    }, 100); 
}
async function initSubtitleTranslation() {
    const translatedSubs = await getTranslatedSubtitlesFast('he');
    startSubtitlesInjection(translatedSubs);
}
