chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "TRANSLATE_BATCH") {
        // מחברים את כל המשפטים עם מפריד ייחודי כדי לתרגם בבת אחת (חוסך בקשות API)
        const combinedText = request.texts.join(' ||| ');
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=iw&dt=t&q=${encodeURIComponent(combinedText)}`;

        fetch(url)
            .then(res => res.json())
            .then(data => {
                // גוגל מחזיר לפעמים את הטקסט בחלקים, אנחנו מחברים אותם חזרה
                let fullTranslation = data[0].map(x => x[0]).join('');
                const translatedArray = fullTranslation.split(' ||| ');
                sendResponse({ translatedTexts: translatedArray });
            })
            .catch(err => sendResponse({ error: err.message }));
        return true;
    }
});