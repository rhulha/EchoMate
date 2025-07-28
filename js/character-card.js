/**
 * Character Card v2 Handler Module
 * Handles loading and applying AI character cards from JSON or PNG files
 */

export class CharacterCardHandler {
    constructor() {
        this.onCharacterLoaded = null;
        this.conversationHistory = null;
    }

    /**
     * Initialize the character card upload handler
     * @param {Array} conversationHistory - Reference to the conversation history array
     * @param {Function} onCharacterLoaded - Optional callback when character is loaded
     */
    init(conversationHistory, onCharacterLoaded = null) {
        this.conversationHistory = conversationHistory;
        this.onCharacterLoaded = onCharacterLoaded;
        this.initializeCharacterCardHandler();
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
        // Handle Character Card v2 format (data is nested under 'data' property)
        let data = characterData;
        if (characterData.spec === 'chara_card_v2' && characterData.data) {
            data = characterData.data;
        }
        
        const systemPrompt = data.system_prompt || data.description;
        if (systemPrompt) {
            $('#systemPrompt').val(systemPrompt);
        }
        
        if (data.name) {
            console.log(`Loaded character: ${data.name}`);
        }

        return {
            name: data.name,
            systemPrompt: systemPrompt,
            characterData: data
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

        // Handle Character Card v2 format
        let data = characterData;
        if (characterData.spec === 'chara_card_v2' && characterData.data) {
            data = characterData.data;
        }

        // Check for required fields (at least one should exist)
        const hasName = data.name;
        const hasPrompt = data.system_prompt || data.description;
        
        return hasName || hasPrompt;
    }

    initializeCharacterCardHandler() {
        $('#characterCard').on('change', (event) => {
            const file = event.target.files[0];
            const $infoDiv = $('#characterInfo');
            
            if (!file) {
                $infoDiv.text("No character card loaded").removeClass('loaded error');
                // Clear character info when no character card is loaded
                this.clearCharacterInfo();
                // Reset system prompt to default
                if (this.conversationHistory) {
                    this.conversationHistory[0].content = "You are a helpful assistant.";
                }
                console.log('Character card cleared');
                
                // Call the callback with null to indicate no character loaded
                if (this.onCharacterLoaded) {
                    this.onCharacterLoaded(null);
                }
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
                        
                        // Handle Character Card v2 format for display
                        let data = characterData;
                        if (characterData.spec === 'chara_card_v2' && characterData.data) {
                            data = characterData.data;
                        }
                        
                        // Update conversation history when character is loaded
                        const systemPrompt = data.system_prompt || data.description;
                        if (systemPrompt && this.conversationHistory) {
                            this.conversationHistory[0].content = systemPrompt;
                        }
                        
                        // Display character avatar and name on conversation tab
                        this.displayCharacterInfo(data);
                        
                        $infoDiv.text(`Loaded: ${data.name || 'Unknown Character'}`).addClass('loaded');
                        console.log('Character card applied to conversation history');
                        
                        // Call the callback if provided
                        if (this.onCharacterLoaded) {
                            this.onCharacterLoaded(data);
                        }
                    }
                    
                } catch (error) {
                    console.error('Error loading character card:', error);
                    $infoDiv.text(`Error: ${error.message}`).addClass('error');
                }
            };
            
            file.type.startsWith('image/') ? reader.readAsDataURL(file) : reader.readAsText(file);
        });
    }

    displayCharacterInfo(characterData) {
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

    clearCharacterInfo() {
        const $characterInfo = $('#conversationCharacterInfo');
        const $characterAvatar = $('#characterAvatar');
        const $characterName = $('#characterName');
        
        $characterAvatar.attr('src', '').off('error load');
        $characterName.text('');
        $characterInfo.hide();
    }
}

// Export a singleton instance for convenience
export const characterCardHandler = new CharacterCardHandler();
