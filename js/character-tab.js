/**
 * Character Tab Handler Module
 * Manages the character information display and editing interface
 */

export class CharacterTabHandler {
    constructor() {
        this.currentCharacterData = null;
        this.conversationHistory = null;
    }

    /**
     * Initialize the character tab handler
     * @param {Array} conversationHistory - Reference to the conversation history array
     */
    init(conversationHistory) {
        this.conversationHistory = conversationHistory;
        this.setupEventHandlers();
    }

    /**
     * Set up event handlers for character tab elements
     */
    setupEventHandlers() {
        // Apply changes button
        $('#applyCharacterChanges').on('click', () => {
            this.applyCharacterChanges();
        });

        // Clear fields button
        $('#clearCharacterFields').on('click', () => {
            this.clearCharacterFields();
        });

        // Auto-save system prompt changes to conversation history
        $('#characterTabSystemPrompt').on('input', () => {
            const systemPrompt = $('#characterTabSystemPrompt').val();
            if (this.conversationHistory && systemPrompt) {
                this.conversationHistory[0].content = systemPrompt;
                // Also update the settings tab system prompt
                $('#systemPrompt').val(systemPrompt);
            }
        });
    }

    /**
     * Update character tab with data from uploaded character card
     * @param {Object} characterData - Character card data
     */
    updateFromCharacterCard(characterData) {
        if (!characterData) {
            this.clearCharacterFields();
            return;
        }

        this.currentCharacterData = characterData;

        // Handle Character Card v2 format
        let data = characterData;
        if (characterData.spec === 'chara_card_v2' && characterData.data) {
            data = characterData.data;
        }

        // Populate fields
        $('#characterTabName').val(data.name || '');
        $('#characterTabPersonality').val(data.personality || '');
        $('#characterTabDescription').val(data.description || '');
        $('#characterTabFirstMessage').val(data.first_mes || '');
        $('#characterTabScenario').val(data.scenario || '');
        $('#characterTabSystemPrompt').val(data.system_prompt || data.description || '');
        $('#characterTabCreator').val(data.creator || '');
        
        // Handle tags array
        const tags = Array.isArray(data.tags) ? data.tags.join(', ') : (data.tags || '');
        $('#characterTabTags').val(tags);

        // Handle avatar
        this.updateAvatar(data.avatar);

        console.log('Character tab updated with character data');
    }

    /**
     * Update the avatar display
     * @param {string} avatarUrl - URL or data URI of the avatar
     */
    updateAvatar(avatarUrl) {
        const $avatar = $('#characterTabAvatar');
        const $placeholder = $('#characterAvatarPlaceholder');

        if (avatarUrl && avatarUrl !== 'none') {
            $avatar.attr('src', avatarUrl);
            $avatar.off('error load');
            
            $avatar.on('error', function() {
                $(this).hide();
                $placeholder.show();
            });
            
            $avatar.on('load', function() {
                $(this).show();
                $placeholder.hide();
            });
            
            // Handle case where image is already cached
            if ($avatar[0].complete) {
                $avatar.show();
                $placeholder.hide();
            }
        } else {
            $avatar.hide();
            $placeholder.show();
        }
    }

    /**
     * Apply changes from character tab back to the conversation and settings
     */
    applyCharacterChanges() {
        // Get current values from the form
        const characterData = {
            name: $('#characterTabName').val(),
            personality: $('#characterTabPersonality').val(),
            description: $('#characterTabDescription').val(),
            first_mes: $('#characterTabFirstMessage').val(),
            scenario: $('#characterTabScenario').val(),
            system_prompt: $('#characterTabSystemPrompt').val(),
            creator: $('#characterTabCreator').val(),
            tags: $('#characterTabTags').val().split(',').map(tag => tag.trim()).filter(tag => tag)
        };

        // Update conversation history with new system prompt
        if (this.conversationHistory && characterData.system_prompt) {
            this.conversationHistory[0].content = characterData.system_prompt;
        }

        // Update settings tab system prompt
        $('#systemPrompt').val(characterData.system_prompt);

        // Update conversation tab character display
        this.updateConversationDisplay(characterData);

        // Update character info in settings
        const characterName = characterData.name || 'Modified Character';
        $('#characterInfo').text(`Loaded: ${characterName} (Modified)`).addClass('loaded');

        // Store the updated data
        this.currentCharacterData = characterData;

        console.log('Character changes applied', characterData);
        
        // Show feedback
        this.showApplyFeedback();
    }

    /**
     * Update the character display in the conversation tab
     * @param {Object} characterData - Character data
     */
    updateConversationDisplay(characterData) {
        const $characterInfo = $('#conversationCharacterInfo');
        const $characterAvatar = $('#characterAvatar');
        const $characterName = $('#characterName');

        if (characterData.name) {
            $characterName.text(characterData.name);
            $characterInfo.show();
        } else {
            $characterInfo.hide();
        }

        // Note: Avatar update would need to be handled separately as it's not editable in this tab
    }

    /**
     * Clear all character fields
     */
    clearCharacterFields() {
        $('#characterTabName').val('');
        $('#characterTabPersonality').val('');
        $('#characterTabDescription').val('');
        $('#characterTabFirstMessage').val('');
        $('#characterTabScenario').val('');
        $('#characterTabSystemPrompt').val('');
        $('#characterTabCreator').val('');
        $('#characterTabTags').val('');

        // Hide avatar and show placeholder
        $('#characterTabAvatar').hide();
        $('#characterAvatarPlaceholder').show();

        // Reset conversation history to default
        if (this.conversationHistory) {
            this.conversationHistory[0].content = "You are a helpful assistant.";
        }

        // Reset settings tab system prompt
        $('#systemPrompt').val("You are a helpful assistant.");

        // Clear character info
        $('#characterInfo').text("No character card loaded").removeClass('loaded error');

        // Hide conversation character info
        $('#conversationCharacterInfo').hide();

        this.currentCharacterData = null;

        console.log('Character fields cleared');
    }

    /**
     * Show visual feedback when changes are applied
     */
    showApplyFeedback() {
        const $button = $('#applyCharacterChanges');
        const originalText = $button.text();
        
        $button.text('Applied!').prop('disabled', true);
        setTimeout(() => {
            $button.text(originalText).prop('disabled', false);
        }, 1500);
    }

    /**
     * Get the current character data
     * @returns {Object|null} Current character data
     */
    getCurrentCharacterData() {
        return this.currentCharacterData;
    }

    /**
     * Check if character tab has been modified
     * @returns {boolean} True if fields have been modified
     */
    hasModifications() {
        if (!this.currentCharacterData) return false;

        const currentValues = {
            name: $('#characterTabName').val(),
            personality: $('#characterTabPersonality').val(),
            description: $('#characterTabDescription').val(),
            first_mes: $('#characterTabFirstMessage').val(),
            scenario: $('#characterTabScenario').val(),
            system_prompt: $('#characterTabSystemPrompt').val(),
            creator: $('#characterTabCreator').val(),
            tags: $('#characterTabTags').val()
        };

        const originalTags = Array.isArray(this.currentCharacterData.tags) 
            ? this.currentCharacterData.tags.join(', ') 
            : (this.currentCharacterData.tags || '');

        return (
            currentValues.name !== (this.currentCharacterData.name || '') ||
            currentValues.personality !== (this.currentCharacterData.personality || '') ||
            currentValues.description !== (this.currentCharacterData.description || '') ||
            currentValues.first_mes !== (this.currentCharacterData.first_mes || '') ||
            currentValues.scenario !== (this.currentCharacterData.scenario || '') ||
            currentValues.system_prompt !== (this.currentCharacterData.system_prompt || this.currentCharacterData.description || '') ||
            currentValues.creator !== (this.currentCharacterData.creator || '') ||
            currentValues.tags !== originalTags
        );
    }
}

// Export a singleton instance
export const characterTabHandler = new CharacterTabHandler();
