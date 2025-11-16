// ICC Quiz Cards - Multiplayer Buzz Mode

class MultiplayerQuizApp {
    constructor() {
        this.quizzes = [];
        this.currentQuiz = null;
        this.allCards = [];
        this.currentCardIndex = 0;
        this.isFlipped = false;
        this.role = null;
        this.playerName = null;
        this.roomCode = this.generateRoomCode();

        // Multiplayer state
        this.buzzedPlayer = null;
        this.isStreaming = false;
        this.streamingTimeout = null;
        this.scores = {
            player1: 0,
            player2: 0,
            player3: 0,
            player4: 0
        };
        this.connectedPlayers = new Set(['controller']);

        // Text-to-speech
        this.synthesis = window.speechSynthesis;
        this.currentUtterance = null;
        this.autoRead = false;
        this.selectedVoice = null;

        // Backend communication (BroadcastChannel or Supabase)
        this.backend = null;
        this.backendType = 'broadcast'; // 'broadcast' or 'supabase'

        this.init();
    }

    async init() {
        // Display room code
        const roomCodeEl = document.getElementById('room-code');
        if (roomCodeEl) {
            roomCodeEl.textContent = this.roomCode;
        }

        // Initialize backend
        await this.initializeBackend();

        await this.loadQuizList();
        this.initializeVoice();
    }

    async initializeBackend() {
        // Check for Supabase configuration
        const supabaseUrl = window.SUPABASE_URL || null;
        const supabaseKey = window.SUPABASE_ANON_KEY || null;

        if (supabaseUrl && supabaseKey) {
            // Use Supabase for real multiplayer
            try {
                // Load Supabase backend script
                await this.loadScript('/js/supabase-backend.js');

                this.backend = new window.SupabaseBackend(supabaseUrl, supabaseKey);
                await this.backend.init(this.roomCode);
                this.backendType = 'supabase';

                console.log('✓ Using Supabase for multiplayer (multi-device support)');
                this.showBackendStatus('Connected via Supabase (Multi-device)');
            } catch (error) {
                console.error('Supabase initialization failed, falling back to BroadcastChannel:', error);
                this.initializeBroadcastChannel();
            }
        } else {
            // Fall back to BroadcastChannel (same-browser only)
            this.initializeBroadcastChannel();
        }

        this.setupChannelListeners();
    }

    initializeBroadcastChannel() {
        this.backend = new BroadcastChannel(`icc-quiz-${this.roomCode}`);
        this.backendType = 'broadcast';
        console.log('ℹ Using BroadcastChannel (same-browser only)');
        this.showBackendStatus('Local Mode (Same browser only)');
    }

    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    showBackendStatus(message) {
        const roomInfo = document.querySelector('.room-info');
        if (roomInfo) {
            const statusEl = roomInfo.querySelector('.backend-status') || document.createElement('p');
            statusEl.className = 'backend-status';
            statusEl.style.fontSize = '0.85rem';
            statusEl.style.opacity = '0.8';
            statusEl.textContent = `Mode: ${message}`;
            if (!roomInfo.querySelector('.backend-status')) {
                roomInfo.appendChild(statusEl);
            }
        }
    }

    generateRoomCode() {
        // Check URL for room code
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('room')) {
            return urlParams.get('room');
        }

        // Generate new room code
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();

        // Update URL without reload
        window.history.replaceState({}, '', `?room=${code}`);
        return code;
    }

    selectRole(role) {
        this.role = role;
        this.playerName = role === 'controller' ? 'Controller' : role.replace('player', 'Player ');

        // Set body class for CSS targeting
        document.body.classList.add(`role-${role.includes('player') ? 'player' : 'controller'}`);

        // Hide role selection, show game screen
        document.getElementById('role-selection').style.display = 'none';
        document.getElementById('game-screen').style.display = 'block';

        // Update role badge
        const roleBadge = document.getElementById('role-badge');
        roleBadge.textContent = this.playerName;
        roleBadge.classList.add(role === 'controller' ? 'controller' : 'player');

        // Setup event listeners
        this.setupEventListeners();

        // Announce join
        this.broadcast({
            type: 'player-join',
            player: this.role
        });

        // Add to connected players
        this.connectedPlayers.add(this.role);
        this.updateConnectedPlayers();
    }

    setupChannelListeners() {
        const messageHandler = (event) => {
            const data = event.data;

            switch (data.type) {
                case 'player-join':
                    this.connectedPlayers.add(data.player);
                    this.updateConnectedPlayers();
                    break;

                case 'buzz':
                    if (this.role === 'controller') {
                        this.handleBuzz(data.player);
                    }
                    break;

                case 'buzz-result':
                    this.handleBuzzResult(data);
                    break;

                case 'reset-buzz':
                    this.resetBuzz();
                    break;

                case 'score-update':
                    this.updateScoreDisplay(data.scores);
                    break;

                case 'next-question':
                    if (this.role !== 'controller') {
                        this.currentCardIndex = data.index;
                        this.displayCard();
                    }
                    break;
            }
        };

        if (this.backendType === 'supabase') {
            // Supabase uses subscribe
            this.backend.subscribe(messageHandler);
        } else {
            // BroadcastChannel uses onmessage
            this.backend.onmessage = messageHandler;
        }
    }

    broadcast(data) {
        if (this.backendType === 'supabase') {
            this.backend.broadcast(data);
        } else {
            this.backend.postMessage(data);
        }
    }

    async loadQuizList() {
        try {
            const response = await fetch('/data/quiz-index.json');
            if (response.ok) {
                const index = await response.json();
                this.quizzes = index.quizzes;
            } else {
                this.quizzes = [{
                    name: 'Sample Quiz',
                    file: '/data/quizzes/sample_quiz.json'
                }];
            }

            this.populateQuizSelector();
        } catch (error) {
            console.error('Error loading quiz list:', error);
        }
    }

    populateQuizSelector() {
        const quizSelect = document.getElementById('quiz-select');
        quizSelect.innerHTML = '<option value="">Select a quiz...</option>';

        this.quizzes.forEach((quiz, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = quiz.name;
            quizSelect.appendChild(option);
        });
    }

    initializeVoice() {
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
        const preferredVoices = [
            'Google UK English Male',
            'Google US English Male',
            'Microsoft David - English (United States)',
            'Microsoft George - English (United Kingdom)',
            'Daniel',
            'Alex',
            voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('male')),
            voices.find(v => v.lang.startsWith('en'))
        ];

        for (const voiceName of preferredVoices) {
            if (typeof voiceName === 'string') {
                const voice = voices.find(v => v.name === voiceName);
                if (voice) {
                    this.selectedVoice = voice;
                    return;
                }
            } else if (voiceName) {
                this.selectedVoice = voiceName;
                return;
            }
        }

        this.selectedVoice = voices[0];
    }

    setupEventListeners() {
        const quizSelect = document.getElementById('quiz-select');
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        const flashcard = document.getElementById('flashcard');
        const buzzBtn = document.getElementById('buzz-btn');
        const resetBuzzBtn = document.getElementById('reset-buzz-btn');
        const voiceBtn = document.getElementById('voice-btn');
        const autoReadCheckbox = document.getElementById('auto-read');
        const correctBtn = document.getElementById('correct-btn');
        const passBtn = document.getElementById('pass-btn');
        const wrongBtn = document.getElementById('wrong-btn');

        if (quizSelect) quizSelect.addEventListener('change', () => this.loadQuiz());
        if (prevBtn) prevBtn.addEventListener('change', () => this.previousCard());
        if (nextBtn) nextBtn.addEventListener('click', () => this.nextCard());

        // Controller-only controls
        if (this.role === 'controller') {
            if (flashcard) flashcard.addEventListener('click', () => this.flipCard());
            if (voiceBtn) voiceBtn.addEventListener('click', () => this.toggleSpeak());
            if (autoReadCheckbox) {
                autoReadCheckbox.addEventListener('change', (e) => {
                    this.autoRead = e.target.checked;
                });
            }
            if (resetBuzzBtn) {
                resetBuzzBtn.addEventListener('click', () => {
                    this.broadcast({ type: 'reset-buzz' });
                    this.resetBuzz();
                });
            }
            if (correctBtn) correctBtn.addEventListener('click', () => this.scoreAnswer(1));
            if (passBtn) passBtn.addEventListener('click', () => this.scoreAnswer(0));
            if (wrongBtn) wrongBtn.addEventListener('click', () => this.scoreAnswer(-1));
        } else {
            // Player buzz button
            if (buzzBtn) {
                buzzBtn.addEventListener('click', () => this.buzz());
            }
        }

        // Keyboard navigation (controller only)
        if (this.role === 'controller') {
            document.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowLeft') this.previousCard();
                if (e.key === 'ArrowRight') this.nextCard();
                if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    this.flipCard();
                }
                if (e.key === 'r' || e.key === 'R') this.toggleSpeak();
            });
        }
    }

    async loadQuiz() {
        const quizSelect = document.getElementById('quiz-select');
        const selectedIndex = quizSelect.value;
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

        const totalCardsEl = document.getElementById('total-cards');
        if (totalCardsEl) {
            totalCardsEl.textContent = this.allCards.length;
        }
    }

    displayCard() {
        if (this.allCards.length === 0) return;

        const card = this.allCards[this.currentCardIndex];

        // Reset states
        this.isFlipped = false;
        this.buzzedPlayer = null;
        const flashcard = document.getElementById('flashcard');
        if (flashcard) flashcard.classList.remove('flipped');

        // Update question
        const questionNumber = document.querySelector('.question-number');
        const questionText = document.querySelector('.question-text');

        if (questionNumber) {
            questionNumber.textContent = `Round ${card.round} - Player ${card.player} - Q${card.question_number}`;
        }

        // Stream text
        if (questionText) {
            this.streamText(questionText, card.question_text);
        }

        // Update answer
        const answerText = document.querySelector('.answer-text');
        if (answerText) answerText.textContent = card.answer;

        const acceptAnswers = document.querySelector('.accept-answers');
        if (acceptAnswers) {
            if (card.accept && card.accept.length > 0) {
                acceptAnswers.innerHTML = `<strong>Also Accept:</strong><p>${card.accept.join(', ')}</p>`;
            } else {
                acceptAnswers.innerHTML = '';
            }
        }

        const translations = document.querySelector('.translations');
        if (translations && card.translations && Object.keys(card.translations).length > 0) {
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
        } else if (translations) {
            translations.innerHTML = '';
        }

        // Update navigation
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        if (prevBtn) prevBtn.disabled = this.currentCardIndex === 0;
        if (nextBtn) nextBtn.disabled = this.currentCardIndex === this.allCards.length - 1;

        this.updateProgress();
        this.updateStats();

        // Auto-read if enabled and controller
        if (this.autoRead && this.role === 'controller') {
            setTimeout(() => {
                this.speak(card.question_text);
            }, 300);
        }

        // Reset buzz indicator
        const buzzIndicator = document.getElementById('buzz-indicator');
        if (buzzIndicator) {
            buzzIndicator.innerHTML = 'Waiting for buzz...';
            buzzIndicator.classList.remove('buzzed');
        }

        // Hide scoring controls
        const scoringControls = document.getElementById('scoring-controls');
        if (scoringControls) scoringControls.style.display = 'none';

        // Enable buzz button for players
        const buzzBtn = document.getElementById('buzz-btn');
        if (buzzBtn) {
            buzzBtn.disabled = false;
            buzzBtn.classList.remove('buzzed');
        }
    }

    streamText(element, text) {
        element.innerHTML = '';
        const words = text.split(/\s+/);
        const wordsPerMinute = 400;
        const delayPerWord = (60 * 1000) / wordsPerMinute;

        this.isStreaming = true;

        words.forEach((word, index) => {
            const span = document.createElement('span');
            span.className = 'word';
            span.textContent = word;
            span.style.animationDelay = `${index * delayPerWord}ms`;
            element.appendChild(span);

            if (index < words.length - 1) {
                element.appendChild(document.createTextNode(' '));
            }
        });

        // Set timeout to mark streaming complete
        if (this.streamingTimeout) clearTimeout(this.streamingTimeout);
        this.streamingTimeout = setTimeout(() => {
            this.isStreaming = false;
        }, words.length * delayPerWord + 500);
    }

    stopStreaming() {
        this.isStreaming = false;
        if (this.streamingTimeout) {
            clearTimeout(this.streamingTimeout);
        }

        // Pause animation
        const questionText = document.querySelector('.question-text');
        if (questionText) {
            questionText.classList.add('paused');
        }
    }

    buzz() {
        if (this.buzzedPlayer) return; // Already buzzed

        // Send buzz to controller
        this.broadcast({
            type: 'buzz',
            player: this.playerName
        });

        // Update local UI
        const buzzBtn = document.getElementById('buzz-btn');
        if (buzzBtn) {
            buzzBtn.disabled = true;
            buzzBtn.classList.add('buzzed');
        }
    }

    handleBuzz(player) {
        if (this.buzzedPlayer) return; // Already buzzed

        this.buzzedPlayer = player;

        // Stop streaming and voice
        this.stopStreaming();
        this.stopSpeaking();

        // Update buzz indicator
        const buzzIndicator = document.getElementById('buzz-indicator');
        if (buzzIndicator) {
            buzzIndicator.innerHTML = `<span class="buzzer-name">${player}</span> buzzed!`;
            buzzIndicator.classList.add('buzzed');
        }

        // Show reset button
        const resetBuzzBtn = document.getElementById('reset-buzz-btn');
        if (resetBuzzBtn) resetBuzzBtn.style.display = 'block';

        // Show scoring controls
        const scoringControls = document.getElementById('scoring-controls');
        if (scoringControls) scoringControls.style.display = 'block';

        // Highlight buzzed player in scoreboard
        const playerNum = player.toLowerCase().replace('player ', '').replace(' ', '');
        const scoreItem = document.querySelector(`#score-${playerNum}`)?.parentElement;
        if (scoreItem) scoreItem.classList.add('buzzed');

        // Broadcast to other players
        this.broadcast({
            type: 'buzz-result',
            player: player,
            buzzed: true
        });
    }

    handleBuzzResult(data) {
        if (data.buzzed) {
            this.buzzedPlayer = data.player;

            // Update UI
            const buzzIndicator = document.getElementById('buzz-indicator');
            if (buzzIndicator) {
                buzzIndicator.innerHTML = `<span class="buzzer-name">${data.player}</span> buzzed!`;
                buzzIndicator.classList.add('buzzed');
            }

            // Disable buzz button
            const buzzBtn = document.getElementById('buzz-btn');
            if (buzzBtn) {
                buzzBtn.disabled = true;
            }
        }
    }

    resetBuzz() {
        this.buzzedPlayer = null;

        // Reset UI
        const buzzIndicator = document.getElementById('buzz-indicator');
        if (buzzIndicator) {
            buzzIndicator.innerHTML = 'Waiting for buzz...';
            buzzIndicator.classList.remove('buzzed');
        }

        const resetBuzzBtn = document.getElementById('reset-buzz-btn');
        if (resetBuzzBtn) resetBuzzBtn.style.display = 'none';

        const scoringControls = document.getElementById('scoring-controls');
        if (scoringControls) scoringControls.style.display = 'none';

        // Enable buzz button
        const buzzBtn = document.getElementById('buzz-btn');
        if (buzzBtn) {
            buzzBtn.disabled = false;
            buzzBtn.classList.remove('buzzed');
        }

        // Remove highlight from scoreboard
        document.querySelectorAll('.score-item').forEach(item => {
            item.classList.remove('buzzed');
        });

        // Resume streaming
        const questionText = document.querySelector('.question-text');
        if (questionText) {
            questionText.classList.remove('paused');
        }
    }

    scoreAnswer(points) {
        if (!this.buzzedPlayer) return;

        // Extract player number
        const playerMatch = this.buzzedPlayer.toLowerCase().match(/player (\d+)/);
        if (!playerMatch) return;

        const playerKey = `player${playerMatch[1]}`;
        this.scores[playerKey] += points;

        // Update score display
        this.updateScoreDisplay(this.scores);

        // Broadcast score update
        this.broadcast({
            type: 'score-update',
            scores: this.scores
        });

        // Hide scoring controls
        const scoringControls = document.getElementById('scoring-controls');
        if (scoringControls) scoringControls.style.display = 'none';

        // Reset buzz (but don't auto-advance - controller presses next manually)
        this.resetBuzz();
    }

    updateScoreDisplay(scores) {
        // Update all player scores
        for (const [player, score] of Object.entries(scores)) {
            const scoreEl = document.getElementById(`score-${player}`);
            if (scoreEl) {
                scoreEl.textContent = score;
                scoreEl.className = 'player-score';
                if (score > 0) scoreEl.classList.add('positive');
                if (score < 0) scoreEl.classList.add('negative');
            }
        }

        // Highlight leader
        const maxScore = Math.max(...Object.values(scores));
        document.querySelectorAll('.score-item').forEach(item => {
            item.classList.remove('leading');
        });

        if (maxScore > 0) {
            for (const [player, score] of Object.entries(scores)) {
                if (score === maxScore) {
                    const scoreEl = document.getElementById(`score-${player}`);
                    if (scoreEl) {
                        scoreEl.parentElement.classList.add('leading');
                    }
                }
            }
        }
    }

    speak(text) {
        this.stopSpeaking();

        this.currentUtterance = new SpeechSynthesisUtterance(text);

        if (this.selectedVoice) {
            this.currentUtterance.voice = this.selectedVoice;
        }

        this.currentUtterance.rate = 0.9;
        this.currentUtterance.pitch = 1.0;
        this.currentUtterance.volume = 1.0;

        this.currentUtterance.onstart = () => {
            const voiceBtn = document.getElementById('voice-btn');
            if (voiceBtn) voiceBtn.classList.add('speaking');
        };

        this.currentUtterance.onend = () => {
            const voiceBtn = document.getElementById('voice-btn');
            if (voiceBtn) voiceBtn.classList.remove('speaking');
            this.currentUtterance = null;
        };

        this.currentUtterance.onerror = (event) => {
            console.error('Speech synthesis error:', event);
            const voiceBtn = document.getElementById('voice-btn');
            if (voiceBtn) voiceBtn.classList.remove('speaking');
            this.currentUtterance = null;
        };

        this.synthesis.speak(this.currentUtterance);
    }

    stopSpeaking() {
        if (this.synthesis.speaking) {
            this.synthesis.cancel();
        }
        const voiceBtn = document.getElementById('voice-btn');
        if (voiceBtn) voiceBtn.classList.remove('speaking');
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

    flipCard() {
        if (this.role !== 'controller') return; // Only controller can flip

        this.isFlipped = !this.isFlipped;
        const flashcard = document.getElementById('flashcard');
        if (flashcard) flashcard.classList.toggle('flipped');
    }

    previousCard() {
        if (this.role !== 'controller') return;
        if (this.currentCardIndex > 0) {
            this.currentCardIndex--;
            this.displayCard();
            this.broadcast({
                type: 'next-question',
                index: this.currentCardIndex
            });
        }
    }

    nextCard() {
        if (this.role !== 'controller') return;
        if (this.currentCardIndex < this.allCards.length - 1) {
            this.currentCardIndex++;
            this.displayCard();
            this.broadcast({
                type: 'next-question',
                index: this.currentCardIndex
            });
        }
    }

    updateProgress() {
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');

        if (progressFill && progressText) {
            const progress = ((this.currentCardIndex + 1) / this.allCards.length) * 100;
            progressFill.style.width = `${progress}%`;
            progressText.textContent = `${this.currentCardIndex + 1} / ${this.allCards.length}`;
        }
    }

    updateStats() {
        if (this.allCards.length === 0) return;

        const card = this.allCards[this.currentCardIndex];
        const currentRound = document.getElementById('current-round');
        const currentPlayer = document.getElementById('current-player');

        if (currentRound) currentRound.textContent = card.round;
        if (currentPlayer) currentPlayer.textContent = card.player;
    }

    updateConnectedPlayers() {
        const playersList = document.getElementById('players-list');
        if (!playersList) return;

        playersList.innerHTML = '';

        this.connectedPlayers.forEach(player => {
            const playerItem = document.createElement('div');
            playerItem.className = `player-item online ${player === 'controller' ? 'controller' : ''}`;
            playerItem.innerHTML = `
                <div class="player-status online"></div>
                <div class="player-name">${player === 'controller' ? 'Controller' : player.replace('player', 'Player ')}</div>
            `;
            playersList.appendChild(playerItem);
        });
    }
}

// Initialize app
const app = new MultiplayerQuizApp();
