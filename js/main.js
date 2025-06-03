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

    // 'vad' must be available as an import or global (if using script tags)
    const myvad = await MicVAD.new({
        onSpeechStart: () => {
            console.log("Speech start detected")
        },
        onSpeechEnd: async (audio) => {
            const output = await transcriber(audio);

            conversationHistory.push({
                role: "user",
                content: output.text
            });

            const response = await fetch("http://localhost:8080/v1/chat/completions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    "messages": conversationHistory
                })
            });

            const data = await response.json();
            const response_text = data.choices[0].message.content;

            textToSpeech(response_text, "af_heart");


        }
    })
    myvad.start()
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