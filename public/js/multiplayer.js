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
        this.roomCode = this.getRoomCodeFromURL(); // Only get from URL, don't auto-generate
        this.quizStarted = false;

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
        this.pendingPlayers = new Set(); // Players waiting for approval
        this.chatMessages = [];
        this.playerNames = {}; // Map of role -> custom display name

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

        // Backend communication (BroadcastChannel or Supabase)
        this.backend = null;
        this.backendType = 'broadcast'; // 'broadcast' or 'supabase'

        // WebRTC for voice answering
        this.peerConnections = new Map(); // Map of peer connections (player -> RTCPeerConnection)
        this.localStream = null; // Player's microphone stream
        this.remoteStreams = new Map(); // Map of remote audio streams
        this.isMicrophoneActive = false;
        this.audioElements = new Map(); // Map of audio elements for remote streams

        this.init();
    }

    async init() {
        // Setup room management buttons
        this.setupRoomManagement();

        // Check for auto-role selection from URL (from play.html)
        const urlParams = new URLSearchParams(window.location.search);
        const autoRole = urlParams.get('role');

        // If player is arriving with a role, hide role-selection immediately
        if (this.roomCode && autoRole && autoRole.startsWith('player')) {
            const roleSelection = document.getElementById('role-selection');
            if (roleSelection) {
                roleSelection.style.display = 'none';
            }
        }

        // Only initialize backend if we have a room code (i.e., player joining existing room)
        if (this.roomCode) {
            await this.initializeBackend();

            // Auto-select role if specified
            if (autoRole && autoRole.startsWith('player')) {
                this.selectRole(autoRole);
            }
        }

        await this.loadQuizList();
        this.initializeVoice();
    }

    setupRoomManagement() {
        const generateRoomBtn = document.getElementById('generate-room-btn');
        const copyBtn = document.getElementById('copy-room-code-btn');

        if (generateRoomBtn) {
            generateRoomBtn.addEventListener('click', () => this.generateRoomForController());
        }

        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.copyRoomCode());
        }
    }

    copyRoomCode() {
        navigator.clipboard.writeText(this.roomCode).then(() => {
            const copyBtn = document.getElementById('copy-room-code-btn');
            if (copyBtn) {
                const originalText = copyBtn.textContent;
                copyBtn.textContent = '✓ Copied!';
                copyBtn.style.backgroundColor = '#10b981';
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                    copyBtn.style.backgroundColor = '';
                }, 2000);
            }
        }).catch(err => {
            console.error('Failed to copy:', err);
            alert('Failed to copy room code. Please copy manually: ' + this.roomCode);
        });
    }

    generateRoomForController() {
        // Generate new room code
        const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        this.roomCode = newCode;

        // Update URL
        window.history.replaceState({}, '', `?room=${newCode}`);

        // Display room code
        const roomCodeEl = document.getElementById('room-code');
        if (roomCodeEl) {
            roomCodeEl.textContent = this.roomCode;
        }

        // Generate and display player link (root URL is the player join page)
        const playerLink = window.location.origin;
        const playerLinkInput = document.getElementById('player-link');
        if (playerLinkInput) {
            playerLinkInput.value = playerLink;
        }

        // Setup copy player link button
        const copyPlayerLinkBtn = document.getElementById('copy-player-link-btn');
        if (copyPlayerLinkBtn) {
            copyPlayerLinkBtn.addEventListener('click', () => this.copyPlayerLink());
        }

        // Show room info section
        const controllerRoomInfo = document.getElementById('controller-room-info');
        if (controllerRoomInfo) {
            controllerRoomInfo.style.display = 'block';
        }

        // Hide generate button
        const generateBtn = document.getElementById('generate-room-btn');
        if (generateBtn) {
            generateBtn.style.display = 'none';
        }

        // Initialize backend now that we have a room code
        this.initializeBackend();
    }

    copyPlayerLink() {
        const playerLinkInput = document.getElementById('player-link');
        if (!playerLinkInput) return;

        navigator.clipboard.writeText(playerLinkInput.value).then(() => {
            const copyBtn = document.getElementById('copy-player-link-btn');
            if (copyBtn) {
                const originalText = copyBtn.textContent;
                copyBtn.textContent = '✓ Copied!';
                copyBtn.style.backgroundColor = '#10b981';
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                    copyBtn.style.backgroundColor = '';
                }, 2000);
            }
        }).catch(err => {
            console.error('Failed to copy:', err);
            alert('Failed to copy player link. Please copy manually: ' + playerLinkInput.value);
        });
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

    getRoomCodeFromURL() {
        // Only get room code from URL, never generate automatically
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('room')) {
            return urlParams.get('room').toUpperCase();
        }
        return null;
    }

    selectRole(role) {
        // Check if room code exists
        if (!this.roomCode) {
            if (role === 'controller') {
                alert('Please generate a room first before entering as controller');
            } else {
                alert('No room code found. Please ask the controller to share the room URL or code');
            }
            return;
        }

        this.role = role;
        this.playerName = role === 'controller' ? 'Controller' : role.replace('player', 'Player ');

        // Initialize player name mapping
        this.playerNames[this.role] = this.playerName;

        // Set body class for CSS targeting
        document.body.classList.add(`role-${role.includes('player') ? 'player' : 'controller'}`);

        // If player, send join request and show waiting room
        if (role !== 'controller') {
            this.showWaitingRoom();

            // Send join request to controller
            this.broadcast({
                type: 'player-join-request',
                player: this.role,
                displayName: this.playerName,
                timestamp: Date.now()
            });
            return;
        }

        // Controller enters directly
        // Hide role selection, show game screen
        document.getElementById('role-selection').style.display = 'none';
        document.getElementById('game-screen').style.display = 'block';

        // Update role badge
        const roleBadge = document.getElementById('role-badge');
        roleBadge.textContent = this.playerName;
        roleBadge.classList.add('controller');

        // Initialize name input
        const nameInput = document.getElementById('player-name-input');
        if (nameInput) {
            nameInput.value = this.playerName;
        }

        // Setup event listeners
        this.setupEventListeners();

        // Add controller to connected players
        this.connectedPlayers.add(this.role);
        this.updateConnectedPlayers();
    }

    showWaitingRoom() {
        // Hide role selection
        document.getElementById('role-selection').style.display = 'none';

        // Show waiting room
        const waitingRoom = document.getElementById('waiting-room');
        if (waitingRoom) {
            waitingRoom.style.display = 'block';

            // Update waiting room info
            const roomCodeEl = document.getElementById('waiting-room-code');
            const playerNameEl = document.getElementById('waiting-player-name');

            if (roomCodeEl) roomCodeEl.textContent = this.roomCode;
            if (playerNameEl) playerNameEl.textContent = this.playerName;
        }
    }

    setupChannelListeners() {
        const messageHandler = (event) => {
            const data = event.data;

            switch (data.type) {
                case 'player-join-request':
                    // Controller receives join request
                    if (this.role === 'controller') {
                        this.handlePlayerJoinRequest(data);
                    }
                    break;

                case 'player-approved':
                    // Player receives approval
                    if (this.role !== 'controller' && data.player === this.role) {
                        this.enterGame();
                    }
                    break;

                case 'player-rejected':
                    // Player receives rejection
                    if (this.role !== 'controller' && data.player === this.role) {
                        alert('Your join request was declined by the controller.');
                        window.location.href = '/play.html';
                    }
                    break;

                case 'player-join':
                    this.connectedPlayers.add(data.player);
                    if (data.displayName) {
                        this.playerNames[data.player] = data.displayName;
                    }
                    this.updateConnectedPlayers();
                    break;

                case 'name-change':
                    this.playerNames[data.player] = data.displayName;
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

                case 'quiz-load':
                    if (this.role !== 'controller') {
                        this.loadQuizFromFile(data.quizFile);
                    }
                    break;

                case 'next-question':
                    if (this.role !== 'controller') {
                        this.currentCardIndex = data.index;
                        // Sync word speed from controller
                        if (data.wordSpeed !== undefined) {
                            this.wordSpeed = data.wordSpeed;
                        }
                        this.displayCard();
                    }
                    break;

                case 'start-quiz':
                    if (this.role !== 'controller') {
                        this.quizStarted = true;
                        this.currentCardIndex = data.index;
                        // Sync word speed from controller
                        if (data.wordSpeed !== undefined) {
                            this.wordSpeed = data.wordSpeed;
                        }
                        this.displayCard();
                    }
                    break;

                case 'play-sound':
                    if (this.role !== 'controller') {
                        // Sync word speed and voice speed from controller if provided
                        if (data.wordSpeed !== undefined) {
                            this.wordSpeed = data.wordSpeed;
                        }
                        if (data.voiceSpeed !== undefined) {
                            this.voiceSpeed = data.voiceSpeed;
                        }
                        this.speak(data.text, false); // false = don't re-broadcast
                    }
                    break;

                case 'chat-message':
                    this.addChatMessage(data.player, data.message, data.timestamp);
                    break;

                case 'webrtc-offer':
                    this.handleWebRTCOffer(data);
                    break;

                case 'webrtc-answer':
                    this.handleWebRTCAnswer(data);
                    break;

                case 'webrtc-ice-candidate':
                    this.handleICECandidate(data);
                    break;

                case 'stop-voice-answer':
                    this.stopRemoteVoiceAnswer(data.from);
                    break;

                case 'player-evict':
                    this.handlePlayerEvicted(data.player);
                    break;

                case 'player-leave':
                    this.connectedPlayers.delete(data.player);
                    this.updateConnectedPlayers();
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

        this.selectedVoice = voices[0];
        this.updateVoiceDropdown();
    }

    populateVoiceDropdown(voices) {
        const voiceSelect = document.getElementById('voice-select');
        if (!voiceSelect) return;

        // Clear existing options
        voiceSelect.innerHTML = '';

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
            voiceSelect.appendChild(englishGroup);
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
            voiceSelect.appendChild(otherGroup);
        }
    }

    updateVoiceDropdown() {
        const voiceSelect = document.getElementById('voice-select');
        if (!voiceSelect || !this.selectedVoice) return;
        voiceSelect.value = this.selectedVoice.name;
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
        const startQuizBtn = document.getElementById('start-quiz-btn');

        if (quizSelect) quizSelect.addEventListener('change', () => this.loadQuiz());
        if (prevBtn) prevBtn.addEventListener('click', () => this.previousCard());
        if (nextBtn) nextBtn.addEventListener('click', () => this.nextCard());
        if (startQuizBtn) startQuizBtn.addEventListener('click', () => this.startQuiz());

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

            // Voice controls
            const voiceSelect = document.getElementById('voice-select');
            const voiceSpeedSlider = document.getElementById('voice-speed');
            const voiceSpeedValue = document.getElementById('voice-speed-value');
            const wordSpeedSlider = document.getElementById('word-speed');
            const wordSpeedValue = document.getElementById('word-speed-value');

            if (voiceSelect) {
                voiceSelect.addEventListener('change', (e) => {
                    const voices = this.synthesis.getVoices();
                    const selectedVoice = voices.find(v => v.name === e.target.value);
                    if (selectedVoice) {
                        this.selectedVoice = selectedVoice;
                    }
                });
            }

            if (voiceSpeedSlider && voiceSpeedValue) {
                voiceSpeedSlider.addEventListener('input', (e) => {
                    this.voiceSpeed = parseFloat(e.target.value);
                    voiceSpeedValue.textContent = `${this.voiceSpeed.toFixed(1)}x`;
                });
            }

            if (wordSpeedSlider && wordSpeedValue) {
                wordSpeedSlider.addEventListener('input', (e) => {
                    this.wordSpeed = parseInt(e.target.value);
                    wordSpeedValue.textContent = `${this.wordSpeed} wpm`;
                });
            }

            // AI voice toggle
            const useAIVoiceCheckbox = document.getElementById('use-ai-voice');
            const aiVoiceSelect = document.getElementById('ai-voice-select');
            const browserVoiceGroup = document.getElementById('browser-voice-group');
            const aiVoiceGroup = document.getElementById('ai-voice-group');

            if (useAIVoiceCheckbox) {
                useAIVoiceCheckbox.addEventListener('change', (e) => {
                    this.useAIVoice = e.target.checked;
                    if (this.useAIVoice) {
                        browserVoiceGroup.style.display = 'none';
                        aiVoiceGroup.style.display = 'flex';
                    } else {
                        browserVoiceGroup.style.display = 'flex';
                        aiVoiceGroup.style.display = 'none';
                    }
                });
            }

            if (aiVoiceSelect) {
                aiVoiceSelect.addEventListener('change', (e) => {
                    this.selectedAIVoice = e.target.value;
                });
            }
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

        // Chat event listeners
        const chatInput = document.getElementById('chat-input');
        const chatSendBtn = document.getElementById('chat-send');

        if (chatSendBtn) {
            chatSendBtn.addEventListener('click', () => this.sendChatMessage());
        }

        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.sendChatMessage();
                }
            });
        }

        // Name change event listeners
        const nameInput = document.getElementById('player-name-input');
        const nameSaveBtn = document.getElementById('name-save-btn');

        if (nameSaveBtn) {
            nameSaveBtn.addEventListener('click', () => this.changePlayerName());
        }

        if (nameInput) {
            nameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.changePlayerName();
                }
            });
        }
    }

    async loadQuizFromFile(quizFile) {
        try {
            const response = await fetch(quizFile);
            if (!response.ok) {
                throw new Error(`Failed to load quiz: ${response.statusText}`);
            }
            this.currentQuiz = await response.json();
            this.prepareCards();
            this.currentCardIndex = 0;
            this.quizStarted = false;

            // Players wait for controller to start
            const questionText = document.querySelector('.question-text');
            if (questionText) {
                questionText.textContent = 'Waiting for controller to start quiz...';
            }

            this.updateStats();
        } catch (error) {
            console.error('Error loading quiz from file:', error);
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
            this.quizStarted = false;

            // Show start button for controller, don't display card yet
            if (this.role === 'controller') {
                const startQuizBtn = document.getElementById('start-quiz-btn');
                if (startQuizBtn) {
                    startQuizBtn.style.display = 'flex';
                }

                // Show placeholder
                const questionText = document.querySelector('.question-text');
                if (questionText) {
                    questionText.textContent = 'Press "Start Quiz" to begin';
                }

                // Broadcast quiz load to all players (but not the first question yet)
                this.broadcast({
                    type: 'quiz-load',
                    quizFile: quiz.file
                });
            } else {
                // Players wait for controller to start
                const questionText = document.querySelector('.question-text');
                if (questionText) {
                    questionText.textContent = 'Waiting for controller to start quiz...';
                }
            }

            this.updateStats();
        } catch (error) {
            console.error('Error loading quiz:', error);
        }
    }

    startQuiz() {
        if (this.role !== 'controller' || this.quizStarted) return;

        this.quizStarted = true;

        // Hide start button
        const startQuizBtn = document.getElementById('start-quiz-btn');
        if (startQuizBtn) {
            startQuizBtn.style.display = 'none';
        }

        // Display first card
        this.displayCard();

        // Broadcast to players to start
        this.broadcast({
            type: 'start-quiz',
            index: this.currentCardIndex,
            wordSpeed: this.wordSpeed
        });
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
                this.speak(card.question_text, true); // true = broadcast to all players
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
        element.innerHTML = '';

        // Remove paused class to allow animation to start fresh
        element.classList.remove('paused');

        // Normalize text to fix spacing issues from PDF extraction
        text = this.normalizeText(text);

        const words = text.split(/\s+/);
        // Use the configured word speed
        const delayPerWord = (60 * 1000) / this.wordSpeed;

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

    playBuzzSound() {
        // Create a simple buzzer sound using Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800; // Hz - buzzer frequency
        oscillator.type = 'square'; // Square wave for buzzer sound

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    }

    buzz() {
        if (this.buzzedPlayer) return; // Already buzzed

        // Play buzz sound
        this.playBuzzSound();

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

        // Play buzz sound for controller
        this.playBuzzSound();

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

        // Broadcast to other players to start voice answer
        this.broadcast({
            type: 'buzz-result',
            player: player,
            buzzed: true,
            startVoiceAnswer: true
        });
    }

    handleBuzzResult(data) {
        if (data.buzzed) {
            this.buzzedPlayer = data.player;

            // Play buzz sound for all players
            this.playBuzzSound();

            // Stop streaming and voice immediately for all players
            this.stopStreaming();
            this.stopSpeaking();

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

            // Start voice answer if this is the player who buzzed
            if (data.startVoiceAnswer && this.playerName === data.player) {
                this.startVoiceAnswer();
            }
        }
    }

    resetBuzz() {
        this.buzzedPlayer = null;

        // Stop voice answer
        this.stopVoiceAnswer();

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

    // ============ WebRTC Voice Answering Methods ============

    async requestMicrophone() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            this.isMicrophoneActive = true;
            this.updateMicrophoneIndicator(true);
            console.log('✓ Microphone access granted');
            return true;
        } catch (error) {
            console.error('Microphone access denied:', error);
            alert('Microphone access is required to speak your answer. Please allow microphone access and try again.');
            return false;
        }
    }

    createPeerConnection(targetPeer) {
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        const peerConnection = new RTCPeerConnection(configuration);

        // Add local stream tracks to peer connection
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, this.localStream);
            });
        }

        // Handle incoming audio stream
        peerConnection.ontrack = (event) => {
            console.log('Received remote stream from', targetPeer);
            const remoteStream = event.streams[0];
            this.remoteStreams.set(targetPeer, remoteStream);
            this.playRemoteStream(targetPeer, remoteStream);
        };

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.broadcast({
                    type: 'webrtc-ice-candidate',
                    candidate: event.candidate,
                    from: this.role,
                    to: targetPeer
                });
            }
        };

        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
            console.log(`Connection state with ${targetPeer}:`, peerConnection.connectionState);
            if (peerConnection.connectionState === 'disconnected' ||
                peerConnection.connectionState === 'failed') {
                this.cleanupPeerConnection(targetPeer);
            }
        };

        return peerConnection;
    }

    async startVoiceAnswer() {
        // Request microphone access
        const micGranted = await this.requestMicrophone();
        if (!micGranted) return;

        // Create peer connections to all other participants
        const allParticipants = Array.from(this.connectedPlayers).filter(p => p !== this.role);

        for (const participant of allParticipants) {
            try {
                const peerConnection = this.createPeerConnection(participant);
                this.peerConnections.set(participant, peerConnection);

                // Create and send offer
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);

                this.broadcast({
                    type: 'webrtc-offer',
                    offer: offer,
                    from: this.role,
                    to: participant
                });

                console.log(`Sent WebRTC offer to ${participant}`);
            } catch (error) {
                console.error(`Error creating peer connection with ${participant}:`, error);
            }
        }
    }

    async handleWebRTCOffer(data) {
        // Only handle offers meant for this participant
        if (data.to !== this.role && data.to !== 'all') return;

        try {
            const peerConnection = this.createPeerConnection(data.from);
            this.peerConnections.set(data.from, peerConnection);

            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));

            // Create and send answer
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            this.broadcast({
                type: 'webrtc-answer',
                answer: answer,
                from: this.role,
                to: data.from
            });

            console.log(`Sent WebRTC answer to ${data.from}`);
        } catch (error) {
            console.error('Error handling WebRTC offer:', error);
        }
    }

    async handleWebRTCAnswer(data) {
        // Only handle answers meant for this participant
        if (data.to !== this.role) return;

        try {
            const peerConnection = this.peerConnections.get(data.from);
            if (peerConnection) {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                console.log(`Received WebRTC answer from ${data.from}`);
            }
        } catch (error) {
            console.error('Error handling WebRTC answer:', error);
        }
    }

    async handleICECandidate(data) {
        // Only handle ICE candidates meant for this participant
        if (data.to !== this.role) return;

        try {
            const peerConnection = this.peerConnections.get(data.from);
            if (peerConnection && data.candidate) {
                await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
        } catch (error) {
            console.error('Error handling ICE candidate:', error);
        }
    }

    playRemoteStream(peerId, stream) {
        // Create or reuse audio element
        let audioElement = this.audioElements.get(peerId);

        if (!audioElement) {
            audioElement = new Audio();
            audioElement.autoplay = true;
            this.audioElements.set(peerId, audioElement);
        }

        audioElement.srcObject = stream;

        // Update UI to show who is speaking
        this.updateRemoteVoiceIndicator(peerId, true);

        // Handle stream ended
        stream.onremovetrack = () => {
            this.updateRemoteVoiceIndicator(peerId, false);
        };
    }

    stopVoiceAnswer() {
        // Stop local stream
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        // Close all peer connections
        for (const [peerId, peerConnection] of this.peerConnections) {
            peerConnection.close();
        }
        this.peerConnections.clear();

        this.isMicrophoneActive = false;
        this.updateMicrophoneIndicator(false);

        // Notify others to stop playing audio
        this.broadcast({
            type: 'stop-voice-answer',
            from: this.role
        });

        console.log('Voice answer stopped');
    }

    stopRemoteVoiceAnswer(peerId) {
        // Stop playing remote stream
        const audioElement = this.audioElements.get(peerId);
        if (audioElement) {
            audioElement.srcObject = null;
            audioElement.pause();
        }

        // Remove remote stream
        this.remoteStreams.delete(peerId);

        // Close peer connection
        const peerConnection = this.peerConnections.get(peerId);
        if (peerConnection) {
            peerConnection.close();
            this.peerConnections.delete(peerId);
        }

        this.updateRemoteVoiceIndicator(peerId, false);
    }

    cleanupPeerConnection(peerId) {
        const peerConnection = this.peerConnections.get(peerId);
        if (peerConnection) {
            peerConnection.close();
            this.peerConnections.delete(peerId);
        }

        const audioElement = this.audioElements.get(peerId);
        if (audioElement) {
            audioElement.srcObject = null;
            audioElement.pause();
            this.audioElements.delete(peerId);
        }

        this.remoteStreams.delete(peerId);
        this.updateRemoteVoiceIndicator(peerId, false);
    }

    updateMicrophoneIndicator(isActive) {
        const micIndicator = document.getElementById('mic-indicator');
        if (micIndicator) {
            if (isActive) {
                micIndicator.textContent = '🎤 Speaking...';
                micIndicator.classList.add('active');
            } else {
                micIndicator.textContent = '';
                micIndicator.classList.remove('active');
            }
        }
    }

    updateRemoteVoiceIndicator(peerId, isSpeaking) {
        const buzzIndicator = document.getElementById('buzz-indicator');
        if (buzzIndicator && isSpeaking) {
            const speakerName = peerId.replace('player', 'Player ').replace('controller', 'Controller');
            buzzIndicator.innerHTML = `<span class="buzzer-name">${speakerName}</span> is speaking 🎤`;
        } else if (buzzIndicator && !isSpeaking) {
            // Restore to buzzed state if someone is still buzzed
            if (this.buzzedPlayer) {
                buzzIndicator.innerHTML = `<span class="buzzer-name">${this.buzzedPlayer}</span> buzzed!`;
            }
        }
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
        const voiceBtn = document.getElementById('voice-btn');
        if (voiceBtn) voiceBtn.classList.add('speaking');

        try {
            // Call serverless function
            const response = await fetch('/api/text-to-speech', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text,
                    voiceName: this.selectedAIVoice,
                    languageCode: this.selectedAIVoice.substring(0, 5),
                    speed: this.voiceSpeed,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('TTS API error:', error);
                alert(error.error || 'Failed to generate AI voice. Please check console.');
                if (voiceBtn) voiceBtn.classList.remove('speaking');
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
            this.currentAudio.playbackRate = 1.0;

            this.currentAudio.onended = () => {
                if (voiceBtn) voiceBtn.classList.remove('speaking');
                this.currentAudio = null;
            };

            this.currentAudio.onerror = (e) => {
                console.error('Audio playback error:', e);
                if (voiceBtn) voiceBtn.classList.remove('speaking');
                this.currentAudio = null;
            };

            await this.currentAudio.play();

        } catch (error) {
            console.error('Error generating AI speech:', error);
            alert('Failed to generate AI voice. Falling back to browser voice.');
            if (voiceBtn) voiceBtn.classList.remove('speaking');
            this.speakWithBrowser(text);
        }
    }

    playAudioFromCache(cacheKey) {
        const audioUrl = this.audioCache.get(cacheKey);
        const voiceBtn = document.getElementById('voice-btn');

        if (voiceBtn) voiceBtn.classList.add('speaking');

        this.currentAudio = new Audio(audioUrl);
        this.currentAudio.playbackRate = 1.0;

        this.currentAudio.onended = () => {
            if (voiceBtn) voiceBtn.classList.remove('speaking');
            this.currentAudio = null;
        };

        this.currentAudio.onerror = (e) => {
            console.error('Cached audio playback error:', e);
            if (voiceBtn) voiceBtn.classList.remove('speaking');
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
        this.currentUtterance = new SpeechSynthesisUtterance(text);

        if (this.selectedVoice) {
            this.currentUtterance.voice = this.selectedVoice;
        }

        this.currentUtterance.rate = this.voiceSpeed;
        this.currentUtterance.pitch = 1.12; // More natural, conversational pitch (1.0 sounds robotic)
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

    speak(text, broadcast = false) {
        this.stopSpeaking();

        // Normalize text before speaking
        text = this.normalizeText(text);

        // Broadcast to all players if controller and broadcast is enabled
        if (broadcast && this.role === 'controller') {
            this.broadcast({
                type: 'play-sound',
                text: text,
                wordSpeed: this.wordSpeed,
                voiceSpeed: this.voiceSpeed
            });
        }

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
        const voiceBtn = document.getElementById('voice-btn');
        if (voiceBtn) voiceBtn.classList.remove('speaking');
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
                // Broadcast to all players when controller manually triggers speech
                this.speak(card.question_text, this.role === 'controller');
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
                index: this.currentCardIndex,
                wordSpeed: this.wordSpeed
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
                index: this.currentCardIndex,
                wordSpeed: this.wordSpeed
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

    evictPlayer(player) {
        if (this.role !== 'controller') return; // Only controller can evict

        if (!confirm(`Are you sure you want to evict ${this.getDisplayName(player)}?`)) {
            return;
        }

        // Remove from connected players
        this.connectedPlayers.delete(player);

        // Broadcast eviction
        this.broadcast({
            type: 'player-evict',
            player: player
        });

        // Update UI
        this.updateConnectedPlayers();
    }

    handlePlayerEvicted(player) {
        // Check if this player is being evicted
        if (this.role === player) {
            alert('You have been removed from the game by the controller.');

            // Broadcast that we're leaving
            this.broadcast({
                type: 'player-leave',
                player: this.role
            });

            // Disconnect and reload to role selection
            window.location.href = window.location.pathname + '?room=' + this.roomCode;
        } else {
            // Another player was evicted, just remove them from the list
            this.connectedPlayers.delete(player);
            this.updateConnectedPlayers();
        }
    }

    updateConnectedPlayers() {
        const playersList = document.getElementById('players-list');
        if (!playersList) return;

        playersList.innerHTML = '';

        // Always show all 4 player slots + controller
        const allSlots = ['controller', 'player1', 'player2', 'player3', 'player4'];

        allSlots.forEach(player => {
            const isConnected = this.connectedPlayers.has(player);
            const displayName = this.getDisplayName(player);
            const playerItem = document.createElement('div');
            playerItem.className = `player-item ${isConnected ? 'online' : 'offline'} ${player === 'controller' ? 'controller' : ''}`;

            // Add evict button for controller (but not for themselves)
            const evictButton = (this.role === 'controller' && isConnected && player !== 'controller' && player !== this.role)
                ? `<button class="evict-btn" onclick="app.evictPlayer('${player}')" title="Remove player">❌</button>`
                : '';

            playerItem.innerHTML = `
                <div class="player-status ${isConnected ? 'online' : 'offline'}"></div>
                <div class="player-name">${displayName}</div>
                ${evictButton}
            `;
            playersList.appendChild(playerItem);
        });
    }

    sendChatMessage() {
        const chatInput = document.getElementById('chat-input');
        if (!chatInput) return;

        const message = chatInput.value.trim();
        if (!message) return;

        const timestamp = Date.now();

        // Broadcast chat message
        this.broadcast({
            type: 'chat-message',
            player: this.playerName,
            message: message,
            timestamp: timestamp
        });

        // Clear input (message will be added when broadcast comes back)
        chatInput.value = '';
    }

    addChatMessage(playerName, message, timestamp) {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;

        // Check for duplicate messages (same timestamp)
        const isDuplicate = this.chatMessages.some(msg => msg.timestamp === timestamp);
        if (isDuplicate) return;

        // Add to messages array
        this.chatMessages.push({ playerName, message, timestamp });

        // Create message element
        const messageEl = document.createElement('div');
        messageEl.className = 'chat-message';

        // Add special class if it's from current user
        if (playerName === this.playerName) {
            messageEl.classList.add('own-message');
        }

        const time = new Date(timestamp);
        const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        messageEl.innerHTML = `
            <div class="message-header">
                <span class="message-player">${playerName}</span>
                <span class="message-time">${timeStr}</span>
            </div>
            <div class="message-text">${this.escapeHtml(message)}</div>
        `;

        chatMessages.appendChild(messageEl);

        // Auto-scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    changePlayerName() {
        const nameInput = document.getElementById('player-name-input');
        if (!nameInput) return;

        const newName = nameInput.value.trim();
        if (!newName || newName === this.playerName) return;

        // Update local name
        this.playerName = newName;
        this.playerNames[this.role] = newName;

        // Update role badge
        const roleBadge = document.getElementById('role-badge');
        if (roleBadge) {
            roleBadge.textContent = newName;
        }

        // Broadcast name change
        this.broadcast({
            type: 'name-change',
            player: this.role,
            displayName: newName
        });

        // Update UI
        this.updateConnectedPlayers();
    }

    getDisplayName(role) {
        return this.playerNames[role] || (role === 'controller' ? 'Controller' : role.replace('player', 'Player '));
    }

    handlePlayerJoinRequest(data) {
        // Add to pending players
        this.pendingPlayers.add(data.player);
        this.playerNames[data.player] = data.displayName || data.player;

        // Play notification sound
        this.playNotificationSound();

        // Update pending players UI
        this.updatePendingPlayers();
    }

    playNotificationSound() {
        // Create a simple bell sound using Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    }

    updatePendingPlayers() {
        const pendingSection = document.getElementById('pending-players-section');
        const pendingList = document.getElementById('pending-players-list');

        if (!pendingList) return;

        // Show/hide section based on pending players
        if (this.pendingPlayers.size > 0) {
            pendingSection.style.display = 'block';
        } else {
            pendingSection.style.display = 'none';
        }

        // Clear and rebuild list
        pendingList.innerHTML = '';

        this.pendingPlayers.forEach(playerRole => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'pending-player-item';
            playerDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; margin: 0.5rem 0; background: #fff3cd; border-radius: 4px;';

            const playerName = this.playerNames[playerRole] || playerRole;

            playerDiv.innerHTML = `
                <span style="font-weight: 500;">${playerName}</span>
                <div>
                    <button class="approve-btn" data-player="${playerRole}" style="padding: 0.25rem 0.75rem; margin-left: 0.5rem; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer;">✓ Approve</button>
                    <button class="reject-btn" data-player="${playerRole}" style="padding: 0.25rem 0.75rem; margin-left: 0.5rem; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer;">✗ Reject</button>
                </div>
            `;

            pendingList.appendChild(playerDiv);
        });

        // Add event listeners to approve/reject buttons
        pendingList.querySelectorAll('.approve-btn').forEach(btn => {
            btn.addEventListener('click', () => this.approvePlayer(btn.dataset.player));
        });

        pendingList.querySelectorAll('.reject-btn').forEach(btn => {
            btn.addEventListener('click', () => this.rejectPlayer(btn.dataset.player));
        });
    }

    approvePlayer(playerRole) {
        // Remove from pending
        this.pendingPlayers.delete(playerRole);

        // Add to connected players
        this.connectedPlayers.add(playerRole);

        // Broadcast approval
        this.broadcast({
            type: 'player-approved',
            player: playerRole
        });

        // Broadcast join to all players
        this.broadcast({
            type: 'player-join',
            player: playerRole,
            displayName: this.playerNames[playerRole]
        });

        // Update UI
        this.updatePendingPlayers();
        this.updateConnectedPlayers();
    }

    rejectPlayer(playerRole) {
        // Remove from pending
        this.pendingPlayers.delete(playerRole);
        delete this.playerNames[playerRole];

        // Broadcast rejection
        this.broadcast({
            type: 'player-rejected',
            player: playerRole
        });

        // Update UI
        this.updatePendingPlayers();
    }

    enterGame() {
        // Hide waiting room
        document.getElementById('waiting-room').style.display = 'none';

        // Show game screen
        document.getElementById('game-screen').style.display = 'block';

        // Update role badge
        const roleBadge = document.getElementById('role-badge');
        roleBadge.textContent = this.playerName;
        roleBadge.classList.add('player');

        // Initialize name input
        const nameInput = document.getElementById('player-name-input');
        if (nameInput) {
            nameInput.value = this.playerName;
        }

        // Setup event listeners
        this.setupEventListeners();

        // Add to connected players
        this.connectedPlayers.add(this.role);
        this.updateConnectedPlayers();
    }
}

// Initialize app
const app = new MultiplayerQuizApp();
