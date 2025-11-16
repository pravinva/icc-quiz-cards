// ICC Quiz Cards - Interactive Flashcard App

class QuizApp {
    constructor() {
        this.quizzes = [];
        this.currentQuiz = null;
        this.allCards = [];
        this.currentCardIndex = 0;
        this.isFlipped = false;

        // Text-to-speech
        this.synthesis = window.speechSynthesis;
        this.currentUtterance = null;
        this.autoRead = false;
        this.selectedVoice = null;
        this.voiceSpeed = 1.2;
        this.wordSpeed = 200;

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

        // Prefer Indian English female voices with neutral accents
        const preferredVoices = [
            // Google Indian voices
            'Google हिन्दी',
            'Google UK English Female',
            'Google US English Female',
            // Microsoft voices
            'Microsoft Heera - English (India)',
            'Microsoft Zira - English (United States)',
            // Apple voices
            'Samantha',
            'Karen',
            'Veena',
            // Any Indian English voice
            voices.find(v => v.lang.includes('en-IN')),
            // Any female English voice
            voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female')),
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

    speak(text) {
        // Stop any ongoing speech
        this.stopSpeaking();

        // Normalize text before speaking
        text = this.normalizeText(text);

        // Create new utterance
        this.currentUtterance = new SpeechSynthesisUtterance(text);

        // Set voice
        if (this.selectedVoice) {
            this.currentUtterance.voice = this.selectedVoice;
        }

        // Configure speech parameters
        this.currentUtterance.rate = this.voiceSpeed;
        this.currentUtterance.pitch = 1.0;
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

    stopSpeaking() {
        if (this.synthesis.speaking) {
            this.synthesis.cancel();
        }
        this.voiceBtn.classList.remove('speaking');
        this.currentUtterance = null;
    }

    toggleSpeak() {
        if (this.synthesis.speaking) {
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
            this.currentCardIndex = 0;
            this.displayCard();
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

        // Reset flip state
        this.isFlipped = false;
        this.flashcard.classList.remove('flipped');

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
        if (this.currentCardIndex > 0) {
            this.currentCardIndex--;
            this.displayCard();
        }
    }

    nextCard() {
        if (this.currentCardIndex < this.allCards.length - 1) {
            this.currentCardIndex++;
            this.displayCard();
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
