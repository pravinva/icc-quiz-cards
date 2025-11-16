# ICC Quiz Cards - Multiplayer System Analysis

## Executive Summary

This is a Progressive Web App (PWA) for interactive quiz flashcards with two primary modes:
1. **Solo Mode** - Single player quiz with text-to-speech
2. **Multiplayer Buzz Mode** - 4 players + 1 controller with real-time scoring

---

## 1. MULTIPLAYER GAME SYSTEM ARCHITECTURE

### Game Modes & Roles

**Controller Role:**
- Manages the quiz flow
- Reveals answers by flipping cards
- Navigates through questions (Previous/Next)
- Judges buzz-in answers (+1 point, 0 points, -1 point)
- Controls text-to-speech settings and auto-reading
- Broadcasts all game state changes

**Player Roles (4 slots):**
- Player 1, Player 2, Player 3, Player 4
- Can buzz-in to answer questions
- See questions in real-time as controller manages them
- Can speak their answers via WebRTC microphone
- Track their scores in real-time

### Key Game Flow

```
1. Role Selection
   ├─ Controller selects "Join as Controller"
   └─ Players select their number (Player 1-4)

2. Game Initialization
   ├─ Room code generated (6-char alphanumeric)
   ├─ Players share room code to join same game
   ├─ Backend initialized (Supabase or BroadcastChannel)
   ├─ Connected players list updated

3. Quiz Selection
   ├─ Controller selects quiz from dropdown
   ├─ Quiz broadcasted to all players
   └─ Questions displayed to all

4. Question Answering
   ├─ Question displays with streaming text animation
   ├─ Players buzz when they want to answer
   ├─ First player to buzz is highlighted
   ├─ Streaming pauses, answer reveal enabled
   ├─ Buzzed player speaks answer (WebRTC)
   ├─ Controller judges the answer
   ├─ Score updated and broadcasted
   ├─ Buzz reset, ready for next question

5. Scoreboard Management
   ├─ Real-time score tracking
   ├─ Leading player highlighted
   ├─ Positive/negative score colors
   └─ Game stats display (round, player question, progress)
```

---

## 2. CONTROLLER VIEW IMPLEMENTATION

### Location
`/home/user/icc-quiz-cards/public/js/multiplayer.js` (MultiplayerQuizApp class)
`/home/user/icc-quiz-cards/public/multiplayer.html` (UI/HTML)

### Controller-Only Features (CSS class: `controller-only`)

**Quiz Selection:**
- Dropdown selector with all available quizzes
- Located in game header

**Card Flipping:**
- Click flashcard to reveal/hide answer
- Only controller can flip
- Answer shows accepted answers and translations

**Navigation:**
- Previous button (disabled if on first question)
- Next button (disabled if on last question)
- Keyboard shortcuts: Arrow Left/Right, Space/Enter to flip, R to read

**Scoring Controls (appears after buzz):**
- Correct button (+1 point) - Green gradient
- Pass button (0 points) - Gray gradient
- Wrong button (-1 point) - Pink gradient
- Only visible when someone has buzzed

**Voice Controls:**
- Read Aloud button (🔊) - Speaks current question
- Auto-read toggle checkbox
- Voice selection dropdown (browser voices)
- AI Voice toggle (uses Google Cloud TTS)
- AI Voice selection (multiple neural voices available)
- Voice speed slider (0.5x - 2.0x)
- Word speed slider (100-400 wpm)

**Reset Buzz Button:**
- Clears buzz state
- Re-enables streaming
- Hides scoring controls
- Re-enables all player buzz buttons

### Visual Indicators
- **Role badge** showing "Controller" status
- **Buzz indicator** showing who buzzed and their status
- **Microphone indicator** showing active speaker (🎤)
- **Scoreboard** with all 4 players
- **Connected players** list
- **Game stats** (round, player question, progress)

---

## 3. HOW PLAYERS JOIN GAMES

### Room Code System
- 6-character alphanumeric code (e.g., "A1B2C3")
- Generated from `Math.random().toString(36).substring(2, 8)`
- Persisted in URL as query parameter: `?room=A1B2C3`

### Player Connection Flow
```javascript
1. Player navigates to /multiplayer.html
2. Room code from URL captured or new one generated
3. Backend initialized (Supabase or BroadcastChannel)
4. Player selects role (controller or player1-4)
5. Player-join message broadcast to all
6. Connected players list updated
```

### Joining Existing Game
```
Same browser (BroadcastChannel):
- Open new tab with multiplayer.html
- Both share same room code
- Both on same browser tab/window

Different devices (Supabase required):
- Scanner/share room code with other players
- They navigate to multiplayer.html?room=ABC123
- Supabase backend syncs across devices
```

---

## 4. COMMUNICATION INFRASTRUCTURE

### Dual Backend System

#### A. Supabase (Multi-Device Support) ⭐

**Configuration:**
- URL: `https://wivhfzszyuiisdmbsakm.supabase.co`
- Uses JWT token for authentication
- Configured in `/home/user/icc-quiz-cards/public/config.js`

**How it Works:**
1. Dynamically imports Supabase client from CDN
2. Creates channel: `room:{roomCode}`
3. All messages broadcast via Supabase Realtime
4. Supports cross-device communication

**Code Location:** `/home/user/icc-quiz-cards/public/js/supabase-backend.js`

```javascript
class SupabaseBackend {
    async init(roomCode) {
        // Creates room:ABC123 channel
    }
    
    subscribe(callback) {
        // Listens for broadcast events
    }
    
    broadcast(data) {
        // Sends to all players in room
    }
}
```

#### B. BroadcastChannel (Same-Browser Only)

**Fallback when Supabase unavailable:**
- Uses native browser BroadcastChannel API
- Only works for tabs/windows in same browser
- No cross-device support

**Code Location:** `/home/user/icc-quiz-cards/public/js/multiplayer.js`

```javascript
initializeBroadcastChannel() {
    this.backend = new BroadcastChannel(`icc-quiz-${this.roomCode}`);
}
```

### Message Types

All messages use abstracted `broadcast(data)` method:

```javascript
{
    type: 'player-join',
    player: 'player1'
}

{
    type: 'buzz',
    player: 'Player 1'
}

{
    type: 'buzz-result',
    player: 'Player 1',
    buzzed: true,
    startVoiceAnswer: true
}

{
    type: 'reset-buzz'
}

{
    type: 'score-update',
    scores: { player1: 1, player2: 0, player3: -1, player4: 0 }
}

{
    type: 'quiz-load',
    quizFile: '/data/quizzes/quiz-name.json'
}

{
    type: 'next-question',
    index: 5
}

{
    type: 'play-sound',
    text: 'Question text to read'
}

{
    type: 'webrtc-offer',
    offer: RTCSessionDescription,
    from: 'player1',
    to: 'controller'
}

{
    type: 'webrtc-answer',
    answer: RTCSessionDescription,
    from: 'controller',
    to: 'player1'
}

{
    type: 'webrtc-ice-candidate',
    candidate: RTCIceCandidate,
    from: 'player1',
    to: 'controller'
}

{
    type: 'stop-voice-answer',
    from: 'player1'
}
```

---

## 5. PLAYER STATE MANAGEMENT

### MultiplayerQuizApp Class State

**Player Identity:**
```javascript
this.role = 'controller' | 'player1' | 'player2' | 'player3' | 'player4'
this.playerName = 'Controller' | 'Player 1' | 'Player 2' | ...
```

**Quiz State:**
```javascript
this.currentQuiz = null          // Full quiz object
this.allCards = []               // Flattened array of all questions
this.currentCardIndex = 0        // Current question index
this.isFlipped = false           // Card flip state
```

**Multiplayer State:**
```javascript
this.buzzedPlayer = null         // Player who buzzed (null = no buzz)
this.scores = {
    player1: 0,
    player2: 0,
    player3: 0,
    player4: 0
}
this.connectedPlayers = Set(['controller', 'player1', ...])
```

**Voice/Audio State:**
```javascript
this.synthesis = window.speechSynthesis
this.currentUtterance = null     // SpeechSynthesisUtterance
this.selectedVoice = null        // Browser voice object
this.voiceSpeed = 1.2            // Playback speed
this.wordSpeed = 200             // Words per minute for streaming
this.useAIVoice = false          // AI vs browser TTS
this.selectedAIVoice = 'en-US-Neural2-F'
this.currentAudio = null         // Audio element for AI voice
this.audioCache = new Map()      // Cache for generated audio
```

**Streaming State:**
```javascript
this.isStreaming = false         // Text streaming in progress
this.streamingTimeout = null     // Timeout handle for streaming
```

**WebRTC State:**
```javascript
this.peerConnections = new Map() // Map of peer -> RTCPeerConnection
this.localStream = null          // Microphone stream
this.remoteStreams = new Map()   // Remote audio streams
this.isMicrophoneActive = false
this.audioElements = new Map()   // Audio elements for playback
```

**Backend State:**
```javascript
this.backend = null              // Supabase or BroadcastChannel instance
this.backendType = 'broadcast'   // 'broadcast' or 'supabase'
```

---

## 6. LAYOUT & UI STRUCTURE

### Overall Layout

```
/multiplayer.html
├── Container
│   ├── Role Selection Screen (initially shown)
│   │   ├── Header (h1: ICC Quiz Cards, h2: Multiplayer Buzz Mode)
│   │   ├── Role Options Grid
│   │   │   ├── Controller Card
│   │   │   │   ├── Description
│   │   │   │   └── "Join as Controller" button
│   │   │   └── Player Card
│   │   │       ├── Description
│   │   │       └── 4x Player buttons (grid 2 cols)
│   │   └── Room Info
│   │       ├── Room Code display
│   │       └── Hint text
│   │
│   └── Game Screen (hidden initially, shown after role selection)
│       ├── Header
│       │   ├── h1: ICC Quiz Cards
│       │   └── Game Header
│       │       ├── Role badge
│       │       └── Quiz selector (controller-only)
│       │
│       └── Main Content
│           ├── Buzz Status Bar
│           │   ├── Buzz indicator
│           │   └── Reset buzz button (controller-only)
│           │
│           ├── Microphone Indicator
│           │   └── "🎤 Speaking..." (when active)
│           │
│           ├── Progress Bar
│           │   ├── Visual progress fill
│           │   └── Text: "X / Y"
│           │
│           ├── Flashcard Container
│           │   ├── Card front (question)
│           │   │   ├── Question number
│           │   │   ├── Question text (streaming)
│           │   │   └── Click hint (controller-only)
│           │   └── Card back (answer)
│           │       ├── Answer text
│           │       ├── "Also Accept:" chips
│           │       ├── Translations
│           │       └── Click hint (controller-only)
│           │
│           ├── Buzz Button (players only)
│           │   ├── Large circular button
│           │   ├── Bell icon (🔔)
│           │   └── "BUZZ!" text
│           │
│           ├── Scoring Controls (controller, appears after buzz)
│           │   ├── "Judge Answer" heading
│           │   ├── Correct button (✓ +1)
│           │   ├── Pass button (− 0)
│           │   └── Wrong button (✗ −1)
│           │
│           ├── Voice Controls (controller-only)
│           │   ├── Read Aloud button (🔊)
│           │   └── Auto-read toggle
│           │
│           ├── Voice Settings (controller-only)
│           │   ├── Use AI Voice toggle
│           │   ├── Browser Voice dropdown
│           │   ├── AI Voice dropdown
│           │   ├── Voice Speed slider
│           │   └── Word Speed slider
│           │
│           ├── Navigation (controller-only)
│           │   ├── Previous button (← Previous)
│           │   └── Next button (Next →)
│           │
│           ├── Scoreboard
│           │   ├── "Scoreboard" heading
│           │   └── Score Grid (4 items)
│           │       ├── Player 1 label & score
│           │       ├── Player 2 label & score
│           │       ├── Player 3 label & score
│           │       └── Player 4 label & score
│           │
│           ├── Stats
│           │   ├── Round indicator
│           │   ├── Player indicator
│           │   └── Total Cards count
│           │
│           └── Connected Players
│               ├── "Connected Players" heading
│               └── Players list
│                   ├── Player item (online status, name)
│                   └── ... repeat
│
│       └── Footer
│           ├── App title
│           └── Links (Back to Solo Mode, Upload Quiz)
```

### CSS Classes for Role-Based Visibility

```css
.controller-only {
    display: none;  /* Hidden by default */
}

body.role-controller .controller-only {
    display: block;  /* Shown for controller */
}

body.role-player .buzz-button-container {
    display: flex !important;  /* Shown for players */
}
```

### Responsive Breakpoints

**Mobile (max-width: 768px):**
- Role options stack vertically
- Player selection single column
- Game header stacks vertically
- Buzz button reduced size

**Small Mobile (max-width: 480px):**
- Scoreboard 2-column grid
- Scoring buttons full width
- Reduced padding and font sizes

### Color Scheme

```css
--primary-color: #6366f1        /* Indigo - Controller badge */
--secondary-color: #ec4899      /* Pink - Player badge, buzz button */
--background: #0f172a           /* Dark navy */
--surface: #1e293b              /* Dark slate */
--surface-light: #334155        /* Lighter slate */
--text-primary: #f1f5f9         /* Light text */
--text-secondary: #cbd5e1       /* Dimmer text */
--success: #10b981              /* Green - correct answers */
```

### Key UI Components

**Flashcard:**
- 3D flip animation
- Front: question with streaming text
- Back: answer with metadata
- Hint text changes based on flip state

**Buzz Button:**
- Large circular (200x200px on desktop)
- Gradient background (pink to darker pink)
- Glowing shadow effect
- Animates on click (scale 1.2 → 1.05)
- Disabled state (gray, 50% opacity)
- Buzzed state (green with success animation)

**Scoreboard:**
- 4-item grid layout
- Cards show player name and score
- Leading player has green border
- Buzzed player highlighted with pink border
- Scores color-coded (positive=green, negative=pink)

**Progress Bar:**
- Full width bar with gradient fill
- Text shows current/total progress
- Updated as controller navigates

---

## 7. VOICE ANSWERING SYSTEM (WebRTC)

### How Players Speak Answers

**Trigger:**
1. Player buzzes
2. Controller sees buzz and can judge
3. Buzzed player gets microphone prompt
4. Player grants microphone access
5. WebRTC peer connections established

**WebRTC Connection Process:**

```javascript
// Player who buzzed initiates:
1. requestMicrophone() - Gets audio stream
2. For each other participant:
   - createPeerConnection(participant)
   - Create offer
   - Send via broadcast

// Other participants receive offer:
1. handleWebRTCOffer(data)
2. Create answer
3. Send via broadcast

// Offerer receives answer:
1. handleWebRTCAnswer(data)
2. Connection established, audio flowing

// ICE candidates exchanged:
1. handleICECandidate(data)
   - Adds candidates for NAT traversal
```

**STUN Servers Used:**
```javascript
{
    urls: 'stun:stun.l.google.com:19302'
}
{
    urls: 'stun:stun1.l.google.com:19302'
}
```

**Audio Playback:**
- Each participant gets audio element
- Remote stream piped to audio element
- Microphone indicator shows when active

### WebRTC Configuration

```javascript
// Audio stream settings
{
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
    }
}
```

---

## 8. KEY FILES SUMMARY

| File | Purpose | Size |
|------|---------|------|
| `/public/multiplayer.html` | UI/layout for multiplayer | 296 lines |
| `/public/js/multiplayer.js` | Game logic & state mgmt | 1436 lines |
| `/public/js/supabase-backend.js` | Multi-device backend | 80 lines |
| `/public/css/multiplayer.css` | Multiplayer styling | 606 lines |
| `/public/css/styles.css` | Base styles | ~300 lines |
| `/public/config.js` | Supabase credentials | 21 lines |
| `/public/index.html` | Solo mode UI | 169 lines |
| `/public/js/app.js` | Solo mode logic | 600+ lines |

---

## 9. GAME DATA FORMAT

Quiz JSON structure:
```javascript
{
    rounds: [
        {
            round_number: 1,
            round_name: "Round 1",
            players: [
                {
                    player_number: 1,
                    questions: [
                        {
                            question_number: 1,
                            question_text: "Who...",
                            answer: "Name",
                            accept: ["Alternative answer 1"],
                            translations: { "Hindi": "Name" }
                        }
                    ]
                }
            ]
        }
    ]
}
```

All questions flattened into single `allCards` array for easy navigation.

---

## 10. RECENT DEVELOPMENT TIMELINE

```
569080f - Add multiplayer buzz mode and PWA support
2f42456 - Add Supabase backend for multi-device
8bd5918 - Configure Supabase credentials for Vercel
b28f469 - Fix voice/text sync
23348e0 - Fix answer layout
0744ff3 - Fix word splitting from PDFs
9d8247c - Add voice controls and speed dials
274eb83 - Add Google Cloud TTS neural voices
dfcc073 - Add Google Cloud Text-to-Speech integration
6b95f03 - Add Excel file upload feature
6abf657 - Add voice controls (PR #1)
b42cf18 - Synchronize questions across multiplayer
ee50bfa - Add voice answering with WebRTC
18d60ba - Multiplayer controller & game selection (PR #2)
649fc9a - Player buzz audible answer (PR #3)
abc86b8 - Quiz Excel import (PR #4)
```

