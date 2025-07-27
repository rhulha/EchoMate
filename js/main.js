import * as ort from "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/ort.js"
import { MicVAD, utils } from "./vad.js"
import { textToSpeech } from "./tts.js";
import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1/dist/transformers.min.js";

let conversationHistory = [{ role: "system", content: "You are a helpful assistant." }];
let myvad = null;
let isReady = false;

async function detectWebGPU() {
    try {
        const adapter = await navigator.gpu.requestAdapter();
        return !!adapter;
    } catch (e) {
        return false;
    }
}

// jQuery Document Ready
$(document).ready(async function() {
    await main();
    setupEventHandlers();
    setupTabNavigation();
});

function setupEventHandlers() {
    // System prompt change
    $('#systemPrompt').on('change', function() {
        conversationHistory[0].content = $(this).val() || "You are a helpful assistant.";
    });

    // Ready button click
    $('#readyButton').on('click', function() {
        if (!isReady && myvad) {
            isReady = true;
            $(this).prop('disabled', true).text('Starting...');
            switchToConversationTab();
            myvad.start();
            $(this).text('Recording Active');
        }
    });

    // Character card upload
    $('#characterCard').on('change', handleCharacterCardUpload);
}

function handleCharacterCardUpload(event) {
    const file = event.target.files[0];
    const $infoDiv = $('#characterInfo');
    
    if (!file) {
        $infoDiv.text("No character card loaded").removeClass('loaded error');
        return;
    }
    
    $infoDiv.text("Loading character card...").removeClass('loaded error');
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            let characterData = null;
            
            if (file.type === 'application/json' || file.name.endsWith('.json')) {
                characterData = JSON.parse(e.target.result);
            } else if (file.type.startsWith('image/') || file.name.endsWith('.png')) {
                const base64Data = e.target.result.split(',')[1];
                const binaryData = atob(base64Data);
                const textChunks = extractTextChunksFromPNG(binaryData);
                
                if (textChunks.chara) {
                    characterData = JSON.parse(atob(textChunks.chara));
                } else {
                    throw new Error("No character data found in PNG file");
                }
            } else {
                throw new Error("Unsupported file type");
            }
            
            if (characterData) {
                applyCharacterCard(characterData);
                $infoDiv.text(`Loaded: ${characterData.name || 'Unknown Character'}`).addClass('loaded');
            }
            
        } catch (error) {
            console.error('Error loading character card:', error);
            $infoDiv.text(`Error: ${error.message}`).addClass('error');
        }
    };
    
    file.type.startsWith('image/') ? reader.readAsDataURL(file) : reader.readAsText(file);
}

function extractTextChunksFromPNG(binaryData) {
    const chunks = {};
    let offset = 8;
    
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
        
        offset += 12 + length;
        if (type === 'IEND') break;
    }
    
    return chunks;
}

function applyCharacterCard(characterData) {
    const systemPrompt = characterData.system_prompt || characterData.description;
    if (systemPrompt) {
        $('#systemPrompt').val(systemPrompt);
        conversationHistory[0].content = systemPrompt;
    }
    
    if (characterData.name) {
        console.log(`Loaded character: ${characterData.name}`);
    }
}

function switchToConversationTab() {
    $('.tab-button').removeClass('active');
    $('[data-tab="conversation"]').addClass('active');
    $('.tab-content').removeClass('active');
    $('#conversation').addClass('active');
}

function setupTabNavigation() {
    $('.tab-button').on('click', function() {
        const tabId = $(this).data('tab');
        $('.tab-button').removeClass('active');
        $(this).addClass('active');
        $('.tab-content').removeClass('active');
        $(`#${tabId}`).addClass('active');
    });
}

async function main() {
    const isWebGPUSupported = await detectWebGPU();
    const options = {
        device: isWebGPUSupported ? "webgpu" : "wasm",
        dtype: isWebGPUSupported ? "fp32" : "q8",
        quantized: !isWebGPUSupported,
    };

    const transcriber = await pipeline('automatic-speech-recognition', 'onnx-community/moonshine-base-ONNX', options);

    myvad = await MicVAD.new({
        onSpeechStart: () => console.log("Speech start detected"),
        onSpeechEnd: async (audio) => {
            const output = await transcriber(audio);
            $('#transcriptionResult').text(output.text);

            conversationHistory.push({ role: "user", content: output.text });

            try {
                const response = await $.ajax({
                    url: $('#serverUrl').val(),
                    method: "POST",
                    contentType: "application/json",
                    data: JSON.stringify({ messages: conversationHistory })
                });

                const responseText = response.choices[0].message.content;
                $('#transcriptionResult').text(responseText);
                conversationHistory.push({ role: "assistant", content: responseText });
                textToSpeech(responseText, $('#voiceSelect').val());
                
            } catch (error) {
                console.error('Error calling chat API:', error);
                $('#transcriptionResult').text('Error: Failed to get AI response');
            }
        }
    });
    
    $('#readyButton').prop('disabled', false);
}