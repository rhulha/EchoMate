import { AudioPlayer } from "./AudioPlayer.js";

const my_worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });

let audioPlayer = new AudioPlayer();

// Create a promise that will resolve when the TTS model is ready
export const ttsModelReadyPromise = new Promise((resolve) => {
    window.ttsModelReadyResolve = resolve;
});

const onMessageReceived = async (e) => {
    switch (e.data.status) {
        case "ready":
            console.log("TTS model loaded successfully");
            // Resolve the promise to indicate the TTS model is ready
            window.ttsModelReadyResolve();
            break;

        case "device":
            console.log(e.data);
            break;

        case "progress":
            break;

        case "stream":
            console.log("audioPlayer.queueAudio", e.data);
            audioPlayer.queueAudio(e.data.audio);
            break;
    }
};

const onErrorReceived = (e) => { console.error("Worker error:", e); };

my_worker.addEventListener("message", onMessageReceived);
my_worker.addEventListener("error", onErrorReceived);

// Function to remove emojis from text
function removeEmojis(text) {
    // Comprehensive emoji regex pattern that covers:
    // - Emoticons (U+1F600-U+1F64F)
    // - Miscellaneous Symbols (U+1F300-U+1F5FF)
    // - Transport and Map Symbols (U+1F680-U+1F6FF)
    // - Miscellaneous Symbols and Pictographs (U+1F900-U+1F9FF)
    // - Supplemental Symbols and Pictographs (U+1F1E0-U+1F1FF)
    // - Various other emoji ranges
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F900}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F004}]|[\u{1F0CF}]|[\u{1F170}-\u{1F171}]|[\u{1F17E}-\u{1F17F}]|[\u{1F18E}]|[\u{3030}]|[\u{2B50}]|[\u{2B55}]|[\u{2934}-\u{2935}]|[\u{2B05}-\u{2B07}]|[\u{2B1B}-\u{2B1C}]|[\u{3297}]|[\u{3299}]|[\u{303D}]|[\u{00A9}]|[\u{00AE}]|[\u{2122}]|[\u{23F3}]|[\u{24C2}]|[\u{23E9}-\u{23EF}]|[\u{25B6}]|[\u{23F8}-\u{23FA}]/gu;
    return text.replace(emojiRegex, '');
}

export function textToSpeech(text, voice) {
    if (!text || !voice) {
        console.error("Text and voice parameters are required for text-to-speech.");
        return;
    }

    text = text.replaceAll("*", "");
    
    // Remove emojis to prevent TTS flow issues
    text = removeEmojis(text);
    
    // Remove any special Markdown formatting for better speech
    text = text.replace(/\*\*(.*?)\*\*/g, '$1'); // Bold
    text = text.replace(/\*(.*?)\*/g, '$1');     // Italic
    text = text.replace(/`(.*?)`/g, '$1');       // Code
    text = text.replace(/~~(.*?)~~/g, '$1');     // Strikethrough
    
    my_worker.postMessage({ type: "generate", text: text, voice: voice });
    
    return text;
}
