// Buzzer Quiz - Interactive Flashcard App

class QuizApp {
    constructor() {
        this.quizzes = [];
        this.currentQuiz = null;
        this.allCards = [];
        this.currentCardIndex = 0;
        this.isFlipped = false;
        this.quizStarted = false;
        this.buzzed = false;

        // Text-to-speech
        this.synthesis = window.speechSynthesis;
        this.currentUtterance = null;
        this.autoRead = false;
        this.selectedVoice = null;
        this.voiceSpeed = 1.2;
        this.wordSpeed = 200;
        this.useAIVoice = false;
        this.selectedAIVoice = 'en-US-Neural2-F';
        this.currentAudio = null;
        this.audioCache = new Map(); // In-memory cache for audio

        // DOM elements
        this.flashcard = document.getElementById('flashcard');
        this.quizSelect = document.getElementById('quiz-select');
        this.prevBtn = document.getElementById('prev-btn');
        this.nextBtn = document.getElementById('next-btn');
        this.voiceBtn = document.getElementById('voice-btn');
        this.autoReadCheckbox = document.getElementById('auto-read');
        this.progressFill = document.getElementById('progress-fill');
        this.progressText = document.getElementById('progress-text');
        this.currentRound = document.getElementById('current-round');
        this.currentPlayer = document.getElementById('current-player');
        this.totalCards = document.getElementById('total-cards');
        this.voiceSelect = document.getElementById('voice-select');
        this.voiceSpeedSlider = document.getElementById('voice-speed');
        this.voiceSpeedValue = document.getElementById('voice-speed-value');
        this.wordSpeedSlider = document.getElementById('word-speed');
        this.wordSpeedValue = document.getElementById('word-speed-value');
        this.useAIVoiceCheckbox = document.getElementById('use-ai-voice');
        this.aiVoiceSelect = document.getElementById('ai-voice-select');
        this.browserVoiceGroup = document.getElementById('browser-voice-group');
        this.aiVoiceGroup = document.getElementById('ai-voice-group');
        this.buzzBtn = document.getElementById('buzz-btn');
        this.startQuizBtn = document.getElementById('start-quiz-btn');
        this.buzzIndicator = document.getElementById('buzz-indicator');

        this.init();
    }

    async init() {
        await this.loadQuizList();
        this.initializeVoice();
        this.setupEventListeners();
    }

    initializeVoice() {
        // Wait for voices to be loaded
        if (this.synthesis.getVoices().length === 0) {
            this.synthesis.addEventListener('voiceschanged', () => {
                this.selectBestVoice();
            });
        } else {
            this.selectBestVoice();
        }
    }

    selectBestVoice() {
        const voices = this.synthesis.getVoices();

        // Populate voice dropdown
        this.populateVoiceDropdown(voices);

        // Prefer neural/premium voices for natural, conversational sound
        // Neural voices sound much more natural than standard TTS voices
        const preferredVoices = [
            // Google Neural voices (most natural)
            voices.find(v => v.name.includes('Neural') && v.lang.startsWith('en')),
            voices.find(v => v.name.includes('neural') && v.lang.startsWith('en')),
            // Google premium voices
            'Google UK English Female',
            'Google US English Female',
            'Google Australian English Female',
            // Microsoft Neural voices
            voices.find(v => v.name.includes('Neural') && v.lang.startsWith('en')),
            'Microsoft Zira - English (United States)',
            'Microsoft Heera - English (India)',
            'Microsoft Aria - English (United States)',
            // Apple premium voices (natural sounding)
            'Samantha',
            'Karen',
            'Veena',
            'Alex',
            // Any Indian English voice
            voices.find(v => v.lang.includes('en-IN')),
            // Any female English voice (often more natural)
            voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female')),
            // Any premium/premium voice
            voices.find(v => v.lang.startsWith('en') && (v.name.toLowerCase().includes('premium') || v.name.toLowerCase().includes('enhanced'))),
            // Fallback to any English voice
            voices.find(v => v.lang.startsWith('en'))
        ];

        for (const voiceName of preferredVoices) {
            if (typeof voiceName === 'string') {
                const voice = voices.find(v => v.name === voiceName);
                if (voice) {
                    this.selectedVoice = voice;
                    this.updateVoiceDropdown();
                    return;
                }
            } else if (voiceName) {
                this.selectedVoice = voiceName;
                this.updateVoiceDropdown();
                return;
            }
        }

        // Ultimate fallback
        this.selectedVoice = voices[0];
        this.updateVoiceDropdown();
    }

    populateVoiceDropdown(voices) {
        if (!this.voiceSelect) return;

        // Clear existing options
        this.voiceSelect.innerHTML = '';

        // Group voices by language
        const englishVoices = voices.filter(v => v.lang.startsWith('en'));
        const otherVoices = voices.filter(v => !v.lang.startsWith('en'));

        // Add English voices first
        if (englishVoices.length > 0) {
            const englishGroup = document.createElement('optgroup');
            englishGroup.label = 'English';
            englishVoices.forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.name;
                option.textContent = `${voice.name} (${voice.lang})`;
                englishGroup.appendChild(option);
            });
            this.voiceSelect.appendChild(englishGroup);
        }

        // Add other voices
        if (otherVoices.length > 0) {
            const otherGroup = document.createElement('optgroup');
            otherGroup.label = 'Other Languages';
            otherVoices.forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.name;
                option.textContent = `${voice.name} (${voice.lang})`;
                otherGroup.appendChild(option);
            });
            this.voiceSelect.appendChild(otherGroup);
        }
    }

    updateVoiceDropdown() {
        if (!this.voiceSelect || !this.selectedVoice) return;
        this.voiceSelect.value = this.selectedVoice.name;
    }

    async loadQuizList() {
        try {
            // Try to load quiz index
            const response = await fetch('/data/quiz-index.json');
            if (response.ok) {
                const index = await response.json();
                this.quizzes = index.quizzes;
            } else {
                // Fallback: load sample quiz
                this.quizzes = [
                    {
                        name: 'Sample Quiz',
                        file: '/data/quizzes/sample_quiz.json'
                    }
                ];
            }

            this.populateQuizSelector();
        } catch (error) {
            console.error('Error loading quiz list:', error);
            this.showError('Failed to load quiz list');
        }
    }

    populateQuizSelector() {
        this.quizSelect.innerHTML = '<option value="">Select a quiz...</option>';

        this.quizzes.forEach((quiz, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = quiz.name;
            this.quizSelect.appendChild(option);
        });
    }

    setupEventListeners() {
        this.quizSelect.addEventListener('change', () => this.loadQuiz());
        this.flashcard.addEventListener('click', () => this.flipCard());
        this.prevBtn.addEventListener('click', () => this.previousCard());
        this.nextBtn.addEventListener('click', () => this.nextCard());
        this.voiceBtn.addEventListener('click', () => this.toggleSpeak());
        this.autoReadCheckbox.addEventListener('change', (e) => {
            this.autoRead = e.target.checked;
        });
        
        // Start quiz button
        if (this.startQuizBtn) {
            this.startQuizBtn.addEventListener('click', () => this.startQuiz());
        }
        
        // Buzz button
        if (this.buzzBtn) {
            this.buzzBtn.addEventListener('click', () => this.handleBuzz());
        }

        // Voice controls
        this.voiceSelect.addEventListener('change', (e) => {
            const voices = this.synthesis.getVoices();
            const selectedVoice = voices.find(v => v.name === e.target.value);
            if (selectedVoice) {
                this.selectedVoice = selectedVoice;
            }
        });

        this.voiceSpeedSlider.addEventListener('input', (e) => {
            this.voiceSpeed = parseFloat(e.target.value);
            this.voiceSpeedValue.textContent = `${this.voiceSpeed.toFixed(1)}x`;
        });

        this.wordSpeedSlider.addEventListener('input', (e) => {
            this.wordSpeed = parseInt(e.target.value);
            this.wordSpeedValue.textContent = `${this.wordSpeed} wpm`;
        });

        // AI voice toggle
        this.useAIVoiceCheckbox.addEventListener('change', (e) => {
            this.useAIVoice = e.target.checked;
            if (this.useAIVoice) {
                this.browserVoiceGroup.style.display = 'none';
                this.aiVoiceGroup.style.display = 'flex';
            } else {
                this.browserVoiceGroup.style.display = 'flex';
                this.aiVoiceGroup.style.display = 'none';
            }
        });

        this.aiVoiceSelect.addEventListener('change', (e) => {
            this.selectedAIVoice = e.target.value;
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') this.previousCard();
            if (e.key === 'ArrowRight') this.nextCard();
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                this.flipCard();
            }
            if (e.key === 'r' || e.key === 'R') {
                this.toggleSpeak();
            }
        });
    }

    async speakWithAI(text) {
        // Stop any ongoing speech
        this.stopSpeaking();

        // Normalize text
        text = this.normalizeText(text);

        // Create cache key
        const cacheKey = `${this.selectedAIVoice}-${this.voiceSpeed}-${text}`;

        // Check cache first
        if (this.audioCache.has(cacheKey)) {
            this.playAudioFromCache(cacheKey);
            return;
        }

        // Update UI
        this.voiceBtn.classList.add('speaking');

        try {
            // Call serverless function
            // Use localhost:3000 for local API server, or relative URL for production
            const apiUrl = window.location.hostname === 'localhost' && window.location.port !== '3000' 
                ? 'http://localhost:3000/api/text-to-speech'
                : '/api/text-to-speech';
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text,
                    voiceName: this.selectedAIVoice,
                    languageCode: this.selectedAIVoice.substring(0, 5), // e.g., "en-US"
                    speed: this.voiceSpeed,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('TTS API error:', error);
                alert(error.error || 'Failed to generate AI voice. Please check console.');
                this.voiceBtn.classList.remove('speaking');
                return;
            }

            const data = await response.json();

            // Convert base64 to audio
            const audioBlob = this.base64ToBlob(data.audioContent, 'audio/mp3');
            const audioUrl = URL.createObjectURL(audioBlob);

            // Cache the audio
            this.audioCache.set(cacheKey, audioUrl);

            // Play audio
            this.currentAudio = new Audio(audioUrl);
            this.currentAudio.playbackRate = 1.0; // Speed already applied in API

            this.currentAudio.onended = () => {
                this.voiceBtn.classList.remove('speaking');
                this.currentAudio = null;
            };

            this.currentAudio.onerror = (e) => {
                console.error('Audio playback error:', e);
                this.voiceBtn.classList.remove('speaking');
                this.currentAudio = null;
            };

            await this.currentAudio.play();

        } catch (error) {
            console.error('Error generating AI speech:', error);
            alert('Failed to generate AI voice. Falling back to browser voice.');
            this.voiceBtn.classList.remove('speaking');

            // Fallback to browser voice
            this.speakWithBrowser(text);
        }
    }

    playAudioFromCache(cacheKey) {
        const audioUrl = this.audioCache.get(cacheKey);

        this.voiceBtn.classList.add('speaking');

        this.currentAudio = new Audio(audioUrl);
        this.currentAudio.playbackRate = 1.0;

        this.currentAudio.onended = () => {
            this.voiceBtn.classList.remove('speaking');
            this.currentAudio = null;
        };

        this.currentAudio.onerror = (e) => {
            console.error('Cached audio playback error:', e);
            this.voiceBtn.classList.remove('speaking');
            this.currentAudio = null;
        };

        this.currentAudio.play();
    }

    base64ToBlob(base64, mimeType) {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);

        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }

        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
    }

    speakWithBrowser(text) {
        // Create new utterance
        this.currentUtterance = new SpeechSynthesisUtterance(text);

        // Set voice
        if (this.selectedVoice) {
            this.currentUtterance.voice = this.selectedVoice;
        }

        // Configure speech parameters for natural, conversational sound
        this.currentUtterance.rate = this.voiceSpeed;
        // Pitch between 1.1-1.15 sounds more natural and conversational (1.0 sounds robotic)
        this.currentUtterance.pitch = 1.12;
        this.currentUtterance.volume = 1.0;

        // Update UI when speaking starts
        this.currentUtterance.onstart = () => {
            this.voiceBtn.classList.add('speaking');
        };

        // Update UI when speaking ends
        this.currentUtterance.onend = () => {
            this.voiceBtn.classList.remove('speaking');
            this.currentUtterance = null;
        };

        // Handle errors
        this.currentUtterance.onerror = (event) => {
            console.error('Speech synthesis error:', event);
            this.voiceBtn.classList.remove('speaking');
            this.currentUtterance = null;
        };

        // Start speaking
        this.synthesis.speak(this.currentUtterance);
    }

    speak(text) {
        // Stop any ongoing speech
        this.stopSpeaking();

        // Normalize text before speaking
        text = this.normalizeText(text);

        // Use AI voice or browser voice
        if (this.useAIVoice) {
            this.speakWithAI(text);
        } else {
            this.speakWithBrowser(text);
        }
    }

    stopSpeaking() {
        // Stop browser TTS
        if (this.synthesis.speaking) {
            this.synthesis.cancel();
        }
        this.voiceBtn.classList.remove('speaking');
        this.currentUtterance = null;

        // Stop AI audio
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
        }
    }

    toggleSpeak() {
        if (this.synthesis.speaking || this.currentAudio) {
            this.stopSpeaking();
        } else {
            const card = this.allCards[this.currentCardIndex];
            if (card) {
                this.speak(card.question_text);
            }
        }
    }

    async loadQuiz() {
        const selectedIndex = this.quizSelect.value;
        if (selectedIndex === '') return;

        try {
            const quiz = this.quizzes[selectedIndex];
            const response = await fetch(quiz.file);

            if (!response.ok) {
                throw new Error(`Failed to load quiz: ${response.statusText}`);
            }

            this.currentQuiz = await response.json();
            this.prepareCards();
            
            // Show start button instead of auto-starting
            if (this.startQuizBtn) {
                this.startQuizBtn.style.display = 'block';
            }
            
            // Reset quiz state
            this.quizStarted = false;
            this.buzzed = false;
            this.currentCardIndex = 0;
            this.isFlipped = false;
            
            // Update UI
            const questionText = document.querySelector('.question-text');
            if (questionText) {
                questionText.textContent = 'Click "Start Quiz" to begin';
            }
            
            // Disable navigation and buzzer until quiz starts
            if (this.prevBtn) this.prevBtn.disabled = true;
            if (this.nextBtn) this.nextBtn.disabled = true;
            if (this.buzzBtn) this.buzzBtn.disabled = true;
            
            if (this.buzzIndicator) {
                this.buzzIndicator.textContent = 'Ready to start';
            }
            
            this.updateStats();
        } catch (error) {
            console.error('Error loading quiz:', error);
            this.showError('Failed to load quiz data');
        }
    }

    prepareCards() {
        this.allCards = [];

        this.currentQuiz.rounds.forEach(round => {
            round.players.forEach(player => {
                player.questions.forEach(question => {
                    this.allCards.push({
                        round: round.round_number,
                        roundName: round.round_name,
                        player: player.player_number,
                        ...question
                    });
                });
            });
        });

        this.totalCards.textContent = this.allCards.length;
    }

    displayCard() {
        if (this.allCards.length === 0) return;

        const card = this.allCards[this.currentCardIndex];

        // Reset flip state (unless buzzed)
        if (!this.buzzed) {
            this.isFlipped = false;
            this.flashcard.classList.remove('flipped');
        }

        // Update question side
        const questionNumber = document.querySelector('.question-number');
        const questionText = document.querySelector('.question-text');

        questionNumber.textContent = `Round ${card.round} - Player ${card.player} - Q${card.question_number}`;

        // Stream the question text word by word
        this.streamText(questionText, card.question_text);

        // Update answer side
        const answerText = document.querySelector('.answer-text');
        answerText.textContent = card.answer;

        // Update accept answers
        const acceptAnswers = document.querySelector('.accept-answers');
        if (card.accept && card.accept.length > 0) {
            const chipsHTML = card.accept.map(ans =>
                `<span class="accept-answer-chip">${ans}</span>`
            ).join('');
            acceptAnswers.innerHTML = `
                <strong>Also Accept:</strong>
                <div class="accept-answers-list">${chipsHTML}</div>
            `;
        } else {
            acceptAnswers.innerHTML = '';
        }

        // Update translations
        const translations = document.querySelector('.translations');
        if (card.translations && Object.keys(card.translations).length > 0) {
            let translationsHTML = '<strong>Translations:</strong>';
            for (const [lang, text] of Object.entries(card.translations)) {
                translationsHTML += `
                    <div class="translation-item">
                        <span class="translation-lang">${lang}:</span>
                        <span class="translation-text">${text}</span>
                    </div>
                `;
            }
            translations.innerHTML = translationsHTML;
        } else {
            translations.innerHTML = '';
        }

        // Update navigation buttons
        this.prevBtn.disabled = this.currentCardIndex === 0;
        this.nextBtn.disabled = this.currentCardIndex === this.allCards.length - 1;

        // Update progress
        this.updateProgress();
        this.updateStats();

        // Auto-read if enabled
        if (this.autoRead) {
            // Small delay to let the card animation complete
            setTimeout(() => {
                this.speak(card.question_text);
            }, 300);
        }
    }

    normalizeText(text) {
        // Replace multiple consecutive spaces with single space
        text = text.replace(/\s{2,}/g, ' ');

        // Fix split words: join single letters that are clearly part of a word
        // Pattern: word of 3+ chars, space, single consonant/letter (not 'a' or 'I')
        // This fixes cases like "Taois t" -> "Taoist"
        text = text.replace(/(\w{3,})\s([bcdefghjklmnopqrstuvwxyz])\b/gi, '$1$2');

        return text.trim();
    }

    streamText(element, text) {
        // Clear existing content
        element.innerHTML = '';

        // Normalize text to fix spacing issues from PDF extraction
        text = this.normalizeText(text);

        // Split text into words
        const words = text.split(/\s+/);

        // Use the configured word speed
        const delayPerWord = (60 * 1000) / this.wordSpeed;

        words.forEach((word, index) => {
            const span = document.createElement('span');
            span.className = 'word';
            span.textContent = word;
            span.style.animationDelay = `${index * delayPerWord}ms`;
            element.appendChild(span);

            // Add space after word (except last word)
            if (index < words.length - 1) {
                element.appendChild(document.createTextNode(' '));
            }
        });
    }

    flipCard() {
        this.isFlipped = !this.isFlipped;
        this.flashcard.classList.toggle('flipped');
    }

    previousCard() {
        if (!this.quizStarted) return;
        if (this.currentCardIndex > 0) {
            this.currentCardIndex--;
            this.resetBuzzState();
            this.displayCard();
        }
    }

    nextCard() {
        if (!this.quizStarted) return;
        if (this.currentCardIndex < this.allCards.length - 1) {
            this.currentCardIndex++;
            this.resetBuzzState();
            this.displayCard();
        }
    }
    
    startQuiz() {
        if (this.allCards.length === 0) return;
        
        this.quizStarted = true;
        this.currentCardIndex = 0;
        this.buzzed = false;
        this.isFlipped = false;
        
        // Hide start button
        if (this.startQuizBtn) {
            this.startQuizBtn.style.display = 'none';
        }
        
        // Enable navigation and buzzer
        if (this.prevBtn) this.prevBtn.disabled = false;
        if (this.nextBtn) this.nextBtn.disabled = false;
        if (this.buzzBtn) this.buzzBtn.disabled = false;
        
        // Update buzz indicator
        if (this.buzzIndicator) {
            this.buzzIndicator.textContent = 'Waiting for buzz...';
        }
        
        // Display first card with a small delay to ensure DOM is ready
        setTimeout(() => {
            this.displayCard();
        }, 100);
    }
    
    handleBuzz() {
        if (!this.quizStarted || this.buzzed) return;
        
        this.buzzed = true;
        
        // Play buzz sound
        this.playBuzzSound();
        
        // Update UI
        if (this.buzzBtn) {
            this.buzzBtn.disabled = true;
            this.buzzBtn.classList.add('buzzed');
        }
        
        if (this.buzzIndicator) {
            this.buzzIndicator.textContent = 'You buzzed!';
            this.buzzIndicator.classList.add('buzzed');
        }
        
        // Auto-reveal answer
        if (!this.isFlipped) {
            setTimeout(() => {
                this.flipCard();
            }, 500);
        }
    }
    
    playBuzzSound() {
        // Create a simple buzz sound using Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    }
    
    resetBuzzState() {
        this.buzzed = false;
        this.isFlipped = false;
        
        if (this.buzzBtn) {
            this.buzzBtn.disabled = false;
            this.buzzBtn.classList.remove('buzzed');
        }
        
        if (this.buzzIndicator) {
            this.buzzIndicator.textContent = 'Waiting for buzz...';
            this.buzzIndicator.classList.remove('buzzed');
        }
        
        if (this.flashcard) {
            this.flashcard.classList.remove('flipped');
        }
    }

    updateProgress() {
        const progress = ((this.currentCardIndex + 1) / this.allCards.length) * 100;
        this.progressFill.style.width = `${progress}%`;
        this.progressText.textContent = `${this.currentCardIndex + 1} / ${this.allCards.length}`;
    }

    updateStats() {
        if (this.allCards.length === 0) {
            this.currentRound.textContent = '-';
            this.currentPlayer.textContent = '-';
            return;
        }

        const card = this.allCards[this.currentCardIndex];
        this.currentRound.textContent = card.round;
        this.currentPlayer.textContent = card.player;
    }

    showError(message) {
        const questionText = document.querySelector('.question-text');
        questionText.innerHTML = `<span style="color: var(--secondary-color);">Error: ${message}</span>`;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new QuizApp();
});
