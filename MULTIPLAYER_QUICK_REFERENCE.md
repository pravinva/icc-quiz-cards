# Multiplayer System - Quick Reference Guide

## Key Takeaways

### 1. System Overview
- **Quiz application** with solo and multiplayer modes
- **5-person gameplay**: 1 controller + 4 players
- **Room-based joining** via 6-char alphanumeric codes
- **Real-time scoring** and state synchronization
- **Voice-enabled**: Players can speak answers via WebRTC

### 2. Main Files
```
/public/multiplayer.html (296 lines)          → UI/Layout
/public/js/multiplayer.js (1436 lines)        → Game logic (MultiplayerQuizApp class)
/public/js/supabase-backend.js (80 lines)     → Multi-device communication
/public/css/multiplayer.css (606 lines)       → Styling
/public/config.js (21 lines)                  → Supabase credentials
```

### 3. Communication Backends

**Supabase (Primary - Multi-device)**
- URL: `https://wivhfzszyuiisdmbsakm.supabase.co`
- Uses Realtime channels: `room:{roomCode}`
- Enables cross-device multiplayer

**BroadcastChannel (Fallback - Same-browser)**
- Native browser API
- Works when Supabase not configured
- Limited to same browser/tabs only

### 4. Game Flow
```
1. Select role (Controller or Player 1-4)
2. Share room code with other players
3. Controller loads quiz
4. Questions stream word-by-word
5. Players buzz to answer
6. Buzzed player speaks answer via microphone
7. Controller judges (+1, 0, -1 points)
8. Scoreboard updates in real-time
9. Next question and repeat
```

### 5. State Management (MultiplayerQuizApp Class)

**Identity**
- `role`: 'controller' | 'player1' | 'player2' | 'player3' | 'player4'
- `playerName`: Display name for UI

**Quiz Data**
- `currentQuiz`: Full quiz object
- `allCards`: Flattened array of all questions
- `currentCardIndex`: Current question index

**Game State**
- `buzzedPlayer`: Who buzzed (null = no buzz)
- `scores`: Object with score for each player
- `connectedPlayers`: Set of connected participant IDs

**Communication**
- `backend`: Supabase or BroadcastChannel instance
- `backendType`: 'supabase' or 'broadcast'

### 6. Controller Capabilities
- Select quiz from dropdown
- Flip cards (click) to reveal answers
- Navigate with Previous/Next buttons
- Judge answers: Correct (+1), Pass (0), Wrong (-1)
- Read questions aloud (browser or AI voice)
- Control auto-read, voice speed, word speed
- See all player scores in real-time
- View connected players list

### 7. Player Capabilities
- See same questions as controller in real-time
- Buzz to answer (large circular button)
- Speak answer via microphone (WebRTC)
- View their score updates in real-time
- See who's connected and when

### 8. Message Types (Broadcast Events)
```javascript
'player-join'        → New player connected
'buzz'              → Player buzzed
'buzz-result'       → Buzz acknowledged
'reset-buzz'        → Clear buzz state
'score-update'      → Scores changed
'quiz-load'         → New quiz loaded
'next-question'     → Navigate to question
'play-sound'        → Read question aloud
'webrtc-*'          → Voice peer connection
```

### 9. WebRTC Voice Answering
**Flow:**
1. Player buzzes
2. Microphone requested
3. WebRTC offer sent to all participants
4. Peer connections established with STUN servers
5. Audio streams exchanged
6. Remote audio played in audio elements
7. Microphone indicator shows active speaker

**STUN Servers:**
- `stun:stun.l.google.com:19302`
- `stun:stun1.l.google.com:19302`

### 10. UI Architecture

**Role Selection Screen**
- 2 role cards: Controller and Players
- Room code display
- Backend status indicator

**Game Screen (Hidden until role selected)**
- Flashcard (front: question, back: answer)
- Buzz button (players only)
- Scoring controls (controller, conditional)
- Scoreboard (4 players)
- Connected players list
- Voice controls (controller)
- Navigation (controller)
- Stats and progress bar

**CSS Role-based Visibility**
```css
.controller-only        /* Hidden, shown for controller */
.buzz-button-container  /* Hidden, shown for players */
body.role-controller    /* Selector for controller styles */
body.role-player        /* Selector for player styles */
```

### 11. Room Code System
- **Format**: 6-character alphanumeric (e.g., "A1B2C3")
- **Generation**: `Math.random().toString(36).substring(2, 8)`
- **URL Persistence**: `?room=A1B2C3`
- **Channel Names**:
  - Supabase: `room:A1B2C3`
  - BroadcastChannel: `icc-quiz-A1B2C3`

### 12. Scoring System
- **+1**: Correct answer (green)
- **0**: Pass (gray)
- **-1**: Wrong answer (pink)
- **Leading player**: Green border on scoreboard
- **Buzzed player**: Pink border/highlight

### 13. Text-to-Speech Options
**Browser TTS** (Default)
- Free, browser-based
- Multiple voices available
- Speed control: 0.5x - 2.0x

**AI Voice** (Google Cloud)
- Premium neural voices
- Better quality
- Requires API key configuration
- Voices available in multiple accents (US, UK, India, Australia)

### 14. Voice Streaming
- Questions appear word-by-word
- Configurable speed: 100-400 words per minute
- Streaming pauses when player buzzes
- Auto-read can be enabled for hands-free operation

### 15. Key Methods (MultiplayerQuizApp)

**Setup**
- `selectRole(role)` → Initialize player role
- `loadQuiz()` → Fetch and parse quiz file
- `initializeBackend()` → Setup Supabase or BroadcastChannel

**Game Logic**
- `displayCard()` → Show current question
- `flipCard()` → Reveal/hide answer
- `nextCard()` / `previousCard()` → Navigate
- `buzz()` → Send buzz to controller
- `handleBuzz(player)` → Process buzz

**Scoring**
- `scoreAnswer(points)` → Judge answer (-1, 0, 1)
- `updateScoreDisplay(scores)` → Update UI

**Voice**
- `speak(text, broadcast)` → Read text aloud
- `speakWithBrowser()` → Use SpeechSynthesis API
- `speakWithAI()` → Use Google Cloud TTS

**WebRTC**
- `startVoiceAnswer()` → Begin voice session
- `createPeerConnection(peer)` → Create peer connection
- `handleWebRTCOffer/Answer()` → Process connection
- `playRemoteStream()` → Play audio from peer
- `stopVoiceAnswer()` → End voice session

### 16. Responsive Design
- **Desktop** (>768px): Full layout with side-by-side elements
- **Tablet** (768px): Stacked columns, adjusted spacing
- **Mobile** (<480px): Single column, reduced button sizes
- Buzz button: Scales from 200x200px to 150x150px

### 17. Configuration (config.js)
```javascript
window.SUPABASE_URL         // Supabase project URL
window.SUPABASE_ANON_KEY    // Supabase public API key
// Both required for multi-device support
// Leave empty to use BroadcastChannel fallback
```

### 18. Error Handling & Fallbacks
- Supabase unavailable → Falls back to BroadcastChannel
- Microphone denied → Alert to user
- WebRTC connection failed → Logs error, allows continue
- Audio playback failed → Graceful degradation

### 19. Performance Optimizations
- Audio caching: Generated AI voices cached in-memory
- Message deduplication: Via backend abstraction
- Lazy script loading: Supabase loaded on demand
- PWA support: Service worker for offline capability

### 20. Current Limitations
- BroadcastChannel: Same-browser only (no cross-device)
- 4 players maximum (hardcoded)
- No persistent game history
- No authentication (open access via room code)
- No game timer or time limits
- No spectator mode

---

## For Development

**Add new message type:**
1. Add case in `setupChannelListeners()` switch
2. Implement handler method
3. Call `this.broadcast()` from action

**Modify scoring:**
1. Edit `scoreAnswer()` method
2. Update button values in HTML

**Add new voice:**
1. Add option to AI voice dropdown in HTML
2. Voice name becomes `selectedAIVoice` value

**Change styling:**
1. Edit `/public/css/multiplayer.css`
2. Role-based: Use `body.role-* .selector`
3. Responsive: Use @media queries

---

## Documentation Files
- `MULTIPLAYER_ANALYSIS.md` - Comprehensive technical analysis
- `ARCHITECTURE_DIAGRAM.txt` - System architecture diagrams
- `MULTIPLAYER_QUICK_REFERENCE.md` - This file
