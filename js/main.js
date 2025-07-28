import * as ort from "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/ort.js"
import { MicVAD, utils } from "./vad.js"
import { textToSpeech } from "./tts.js";
import { pipeline, AutoTokenizer, AutoModelForCausalLM, TextStreamer } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1/dist/transformers.min.js";
import { characterCardHandler } from "./character-card.js";

let conversationHistory = [{ role: "system", content: "You are a helpful assistant." }];
let myvad = null;
let isReady = false;
let webLLM = null;
let webTokenizer = null;

async function detectWebGPU() {
    try {
        const adapter = await navigator.gpu.requestAdapter();
        return !!adapter;
    } catch (e) {
        return false;
    }
}

$(document).ready(async function() {
    await main();
    setupEventHandlers();
    setupTabNavigation();
    characterCardHandler.init(conversationHistory);
});

function setupEventHandlers() {
    $('#systemPrompt').on('change', function() {
        conversationHistory[0].content = $(this).val() || "You are a helpful assistant.";
    });

    $('input[name="llmProvider"]').on('change', function() {
        const isLocalhost = $(this).val() === 'localhost';
        $('#serverUrlGroup').toggle(isLocalhost);
        
        if (!isLocalhost && !webLLM) {
            loadWebLLM();
        }
    });

    $('#readyButton').on('click', function() {
        if (!isReady && myvad) {
            isReady = true;
            $(this).prop('disabled', true).text('Starting...');
            $('[data-tab="conversation"]').click();
            myvad.start();
            $(this).text('Recording Active');
        }
    });
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

async function loadWebLLM() {
    try {
        $('#transcriptionResult').text('Loading web-based LLM... This may take a moment.');
        const llm_model_id = "HuggingFaceTB/SmolLM2-1.7B-Instruct";
        webTokenizer = await AutoTokenizer.from_pretrained(llm_model_id);
        webLLM = await AutoModelForCausalLM.from_pretrained(llm_model_id, {
            dtype: "q4f16",
            device: "webgpu",
        });
        
        $('#transcriptionResult').text('Web-based LLM loaded successfully!');
        console.log('Web-based LLM loaded successfully');
    } catch (error) {
        console.error('Error loading web-based LLM:', error);
        $('#transcriptionResult').text('Error loading web-based LLM. Please try localhost server instead.');
    }
}

async function generateWebLLMResponse(messages) {
    if (!webLLM || !webTokenizer) {
        throw new Error('Web LLM not loaded');
    }
    
    // Use the proper chat template method like in worker.js
    const inputs = webTokenizer.apply_chat_template(messages, {
        add_generation_prompt: true,
        return_dict: true,
    });
    
    // Generate response
    const { sequences } = await webLLM.generate({
        ...inputs,
        max_new_tokens: 150,
        do_sample: false,
        temperature: 0.7,
        top_p: 0.9,
        return_dict_in_generate: true,
    });
    
    // Decode only the new tokens (like in worker.js)
    const decoded = webTokenizer.batch_decode(
        sequences.slice(null, [inputs.input_ids.dims[1], null]),
        { skip_special_tokens: true }
    );
    
    return decoded[0].trim();
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
                const isWebLLM = $('input[name="llmProvider"]:checked').val() === 'web';
                let responseText;
                
                if (isWebLLM) {
                    // Use web-based LLM
                    responseText = await generateWebLLMResponse(conversationHistory);
                } else {
                    // Use localhost server
                    const response = await $.ajax({
                        url: $('#serverUrl').val(),
                        method: "POST",
                        contentType: "application/json",
                        data: JSON.stringify({ messages: conversationHistory })
                    });
                    responseText = response.choices[0].message.content;
                }

                $('#transcriptionResult').text(responseText);
                conversationHistory.push({ role: "assistant", content: responseText });
                textToSpeech(responseText, $('#voiceSelect').val());
                
            } catch (error) {
                console.error('Error calling AI:', error);
                $('#transcriptionResult').text('Error: Failed to get AI response');
            }
        }
    });
    
    $('#readyButton').prop('disabled', false);
}