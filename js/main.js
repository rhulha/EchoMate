import * as ort from "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/ort.js"
import { MicVAD, utils } from "./vad.js"
import { textToSpeech } from "./tts.js";
import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1/dist/transformers.min.js";

async function detectWebGPU() {
    try {
        const adapter = await navigator.gpu.requestAdapter();
        return !!adapter;
    } catch (e) {
        return false;
    }
}

let conversationHistory = [
    {
        role: "system",
        content: "You are a helpful assistant."
    }
];

let myvad = null;
let isReady = false;

document.getElementById('systemPrompt').addEventListener('change', function (event) {
    const systemPrompt = event.target.value;
    if (systemPrompt) {
        conversationHistory[0].content = systemPrompt;
    } else {
        conversationHistory[0].content = "You are a helpful assistant.";
    }
});

document.getElementById('characterCard').addEventListener('change', function(event) {
    const file = event.target.files[0];
    const infoDiv = document.getElementById('characterInfo');
    
    if (!file) {
        infoDiv.textContent = "No character card loaded";
        infoDiv.className = "file-info";
        return;
    }
    
    infoDiv.textContent = "Loading character card...";
    infoDiv.className = "file-info";
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            let characterData = null;
            
            if (file.type === 'application/json' || file.name.endsWith('.json')) {
                // Handle JSON file
                characterData = JSON.parse(e.target.result);
            } else if (file.type.startsWith('image/') || file.name.endsWith('.png')) {
                // Handle PNG with embedded data
                const base64Data = e.target.result.split(',')[1];
                const binaryData = atob(base64Data);
                
                // Look for character card data in PNG tEXt chunks
                const textChunks = extractTextChunksFromPNG(binaryData);
                if (textChunks.chara) {
                    const decodedData = atob(textChunks.chara);
                    characterData = JSON.parse(decodedData);
                } else {
                    throw new Error("No character data found in PNG file");
                }
            } else {
                throw new Error("Unsupported file type");
            }
            
            // Apply character card data
            if (characterData) {
                applyCharacterCard(characterData);
                infoDiv.textContent = `Loaded: ${characterData.name || 'Unknown Character'}`;
                infoDiv.className = "file-info loaded";
            }
            
        } catch (error) {
            console.error('Error loading character card:', error);
            infoDiv.textContent = `Error: ${error.message}`;
            infoDiv.className = "file-info error";
        }
    };
    
    if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file);
    } else {
        reader.readAsText(file);
    }
});

function extractTextChunksFromPNG(binaryData) {
    const chunks = {};
    let offset = 8; // Skip PNG signature
    
    while (offset < binaryData.length) {
        const length = (binaryData.charCodeAt(offset) << 24) |
                      (binaryData.charCodeAt(offset + 1) << 16) |
                      (binaryData.charCodeAt(offset + 2) << 8) |
                      binaryData.charCodeAt(offset + 3);
        
        const type = binaryData.substring(offset + 4, offset + 8);
        
        if (type === 'tEXt') {
            const textData = binaryData.substring(offset + 8, offset + 8 + length);
            const nullIndex = textData.indexOf('\0');
            if (nullIndex !== -1) {
                const keyword = textData.substring(0, nullIndex);
                const text = textData.substring(nullIndex + 1);
                chunks[keyword] = text;
            }
        }
        
        offset += 12 + length; // 4 (length) + 4 (type) + length + 4 (CRC)
        
        if (type === 'IEND') break;
    }
    
    return chunks;
}

function applyCharacterCard(characterData) {
    // Apply system prompt from character card
    if (characterData.system_prompt || characterData.description) {
        const systemPrompt = characterData.system_prompt || characterData.description;
        document.getElementById('systemPrompt').value = systemPrompt;
        conversationHistory[0].content = systemPrompt;
    }
    
    // Apply character name to conversation history if available
    if (characterData.name) {
        console.log(`Loaded character: ${characterData.name}`);
    }
}

document.getElementById('readyButton').addEventListener('click', function () {
    if (!isReady && myvad) {
        isReady = true;
        this.disabled = true;
        this.textContent = "Starting...";
        
        // Switch to conversation tab
        switchToConversationTab();
        
        // Start VAD
        myvad.start();
        
        this.textContent = "Recording Active";
    }
});

function switchToConversationTab() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Update active button
    tabButtons.forEach(btn => btn.classList.remove('active'));
    document.querySelector('[data-tab="conversation"]').classList.add('active');
    
    // Show conversation tab content
    tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === 'conversation') {
            content.classList.add('active');
        }
    });
}

async function main() {
    const isWebGPUSupported = await detectWebGPU();
    const device = isWebGPUSupported ? "webgpu" : "wasm";
    const dtype = isWebGPUSupported ? "fp32" : "q8";
    const options = {
        device: device,
        dtype: dtype,
        quantized: !isWebGPUSupported,
    };

    const transcriber = await pipeline('automatic-speech-recognition', 'onnx-community/moonshine-base-ONNX', options);

    // Initialize VAD but don't start it yet
    myvad = await MicVAD.new({
        onSpeechStart: () => {
            console.log("Speech start detected")
        },
        onSpeechEnd: async (audio) => {
            const output = await transcriber(audio);

            document.getElementById('transcriptionResult').innerText = output.text;

            conversationHistory.push({
                role: "user",
                content: output.text
            });

            const serverUrl = document.getElementById('serverUrl').value;
            const response = await fetch(serverUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    "messages": conversationHistory
                })
            });

            const data = await response.json();
            const response_text = data.choices[0].message.content;

            document.getElementById('transcriptionResult').innerText = response_text;

            conversationHistory.push({
                role: "assistant",
                content: response_text
            });

            textToSpeech(response_text, document.getElementById('voiceSelect').value);
        }
    });
    
    // Enable the Ready button now that VAD is initialized
    document.getElementById('readyButton').disabled = false;
}

function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            
            // Update active button
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Show selected tab content
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === tabId) {
                    content.classList.add('active');
                }
            });
        });
    });
}

document.addEventListener('DOMContentLoaded', async function () {
    main();
    setupTabNavigation();
})