/**
 * Character Card v2 Handler Module
 * Handles loading and applying AI character cards from JSON or PNG files
 */

export class CharacterCardHandler {
    constructor() {
        this.onCharacterLoaded = null;
    }

    /**
     * Initialize the character card upload handler
     * @param {Function} onCharacterLoaded - Callback when character is loaded
     */
    init(onCharacterLoaded) {
        this.onCharacterLoaded = onCharacterLoaded;
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        $('#characterCard').on('change', (event) => this.handleUpload(event));
    }

    handleUpload(event) {
        const file = event.target.files[0];
        const $infoDiv = $('#characterInfo');
        
        if (!file) {
            $infoDiv.text("No character card loaded").removeClass('loaded error');
            return;
        }
        
        $infoDiv.text("Loading character card...").removeClass('loaded error');
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                let characterData = null;
                
                if (file.type === 'application/json' || file.name.endsWith('.json')) {
                    characterData = JSON.parse(e.target.result);
                } else if (file.type.startsWith('image/') || file.name.endsWith('.png')) {
                    const base64Data = e.target.result.split(',')[1];
                    const binaryData = atob(base64Data);
                    const textChunks = this.extractTextChunksFromPNG(binaryData);
                    
                    if (textChunks.chara) {
                        characterData = JSON.parse(atob(textChunks.chara));
                    } else {
                        throw new Error("No character data found in PNG file");
                    }
                } else {
                    throw new Error("Unsupported file type");
                }
                
                if (characterData) {
                    this.applyCharacterCard(characterData);
                    $infoDiv.text(`Loaded: ${characterData.name || 'Unknown Character'}`).addClass('loaded');
                    
                    // Call the callback if provided
                    if (this.onCharacterLoaded) {
                        this.onCharacterLoaded(characterData);
                    }
                }
                
            } catch (error) {
                console.error('Error loading character card:', error);
                $infoDiv.text(`Error: ${error.message}`).addClass('error');
            }
        };
        
        file.type.startsWith('image/') ? reader.readAsDataURL(file) : reader.readAsText(file);
    }

    extractTextChunksFromPNG(binaryData) {
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

    applyCharacterCard(characterData) {
        const systemPrompt = characterData.system_prompt || characterData.description;
        if (systemPrompt) {
            $('#systemPrompt').val(systemPrompt);
        }
        
        if (characterData.name) {
            console.log(`Loaded character: ${characterData.name}`);
        }

        return {
            name: characterData.name,
            systemPrompt: systemPrompt,
            characterData: characterData
        };
    }

    /**
     * Validate character card data structure
     * @param {Object} characterData - The character card data
     * @returns {boolean} - Whether the data is valid
     */
    validateCharacterCard(characterData) {
        if (!characterData || typeof characterData !== 'object') {
            return false;
        }

        // Check for required fields (at least one should exist)
        const hasName = characterData.name;
        const hasPrompt = characterData.system_prompt || characterData.description;
        
        return hasName || hasPrompt;
    }
}

// Export a singleton instance for convenience
export const characterCardHandler = new CharacterCardHandler();
