import * as ort from "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/ort.js"
import { MicVAD, utils } from "./vad.js"
import { textToSpeech } from "./tts.js";
import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1/dist/transformers.min.js";
import { characterCardHandler } from "./character-card.js";

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
    initializeCharacterCardHandler();
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
}

function initializeCharacterCardHandler() {
    characterCardHandler.init((characterData) => {
        if (characterData) {
            // Update conversation history when character is loaded
            const systemPrompt = characterData.system_prompt || characterData.description;
            if (systemPrompt) {
                conversationHistory[0].content = systemPrompt;
            }
            
            // Display character avatar and name on conversation tab
            displayCharacterInfo(characterData);
            
            console.log('Character card applied to conversation history');
        } else {
            // Clear character info when no character card is loaded
            clearCharacterInfo();
            // Reset system prompt to default
            conversationHistory[0].content = "You are a helpful assistant.";
            console.log('Character card cleared');
        }
    });
}

function displayCharacterInfo(characterData) {
    const $characterInfo = $('#conversationCharacterInfo');
    const $characterAvatar = $('#characterAvatar');
    const $characterName = $('#characterName');
    
    // Clear previous content
    $characterAvatar.attr('src', '').off('error load');
    $characterName.text('');
    
    // Display character name if available
    if (characterData.name) {
        $characterName.text(characterData.name);
    }
    
    // Display character avatar if available
    if (characterData.avatar) {
        $characterAvatar.attr('src', characterData.avatar);
        $characterAvatar.on('error', function() {
            // Hide the avatar if the image fails to load, but keep the character info if we have a name
            $(this).hide();
            if (!characterData.name) {
                $characterInfo.hide();
            }
        });
        $characterAvatar.on('load', function() {
            // Show the avatar and character info when the image loads successfully
            $(this).show();
            $characterInfo.show();
        });
        
        // Handle case where image is already cached and loads immediately
        if ($characterAvatar[0].complete) {
            $characterAvatar.show();
            $characterInfo.show();
        }
    } else {
        // Hide avatar if no avatar URL
        $characterAvatar.hide();
    }
    
    // Show character info if we have a name or avatar
    if (characterData.name || characterData.avatar) {
        $characterInfo.show();
    } else {
        $characterInfo.hide();
    }
}

function clearCharacterInfo() {
    const $characterInfo = $('#conversationCharacterInfo');
    const $characterAvatar = $('#characterAvatar');
    const $characterName = $('#characterName');
    
    $characterAvatar.attr('src', '').off('error load');
    $characterName.text('');
    $characterInfo.hide();
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