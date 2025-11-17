# Auto-Scoring Feature Requirements

## Current State
- Players can buzz in and use voice answering (WebRTC)
- Controller manually scores answers (Correct/Wrong/Pass)
- Answer is only shown when controller flips the card

## Desired Features

### 1. Show Answer After Buzz
**Requirement:** When a player buzzes in, automatically reveal the answer to all players

**Implementation Needed:**
- Auto-flip card when buzz happens
- Broadcast answer reveal to all players
- Show answer text on all screens

### 2. Auto-Score Based on Voice Answer
**Requirement:** Use speech-to-text to capture player's voice answer and auto-score if it matches

**Components Needed:**

#### A. Speech-to-Text (STT)
- **Technology:** Web Speech API (`SpeechRecognition`) or Google Cloud Speech-to-Text
- **Where:** Client-side (browser) or server-side API
- **When:** While player is speaking after buzz

#### B. Answer Matching Logic
- **Compare:** Transcribed speech vs. correct answer + alternative answers
- **Method:** 
  - Normalize both (lowercase, remove punctuation)
  - Fuzzy matching (Levenshtein distance)
  - Check against `card.answer` and `card.accept[]` array
- **Threshold:** Consider match if similarity > 80-90%

#### C. Auto-Scoring
- **If match:** Auto-score as Correct (+1)
- **If no match:** Wait for controller judgment (manual scoring)
- **Display:** Show "Auto-scored: Correct" or "Waiting for judgment"

## Technical Implementation Plan

### Step 1: Show Answer After Buzz
```javascript
// In handleBuzz() method
// Auto-reveal answer
this.isFlipped = true;
const flashcard = document.getElementById('flashcard');
if (flashcard) flashcard.classList.add('flipped');

// Broadcast answer reveal
this.broadcast({
    type: 'answer-reveal',
    answer: this.allCards[this.currentCardIndex].answer,
    acceptAnswers: this.allCards[this.currentCardIndex].accept || []
});
```

### Step 2: Add Speech Recognition
```javascript
// Add to startVoiceAnswer()
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';
    
    this.recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        this.checkAnswerMatch(transcript);
    };
    
    this.recognition.start();
}
```

### Step 3: Answer Matching Function
```javascript
checkAnswerMatch(spokenText) {
    const card = this.allCards[this.currentCardIndex];
    const correctAnswer = card.answer.toLowerCase().trim();
    const spoken = spokenText.toLowerCase().trim();
    
    // Check exact match
    if (spoken === correctAnswer) {
        this.autoScore(1, 'exact');
        return;
    }
    
    // Check alternative answers
    if (card.accept && card.accept.length > 0) {
        for (const alt of card.accept) {
            if (spoken === alt.toLowerCase().trim()) {
                this.autoScore(1, 'alternative');
                return;
            }
        }
    }
    
    // Fuzzy matching (Levenshtein distance)
    const similarity = this.calculateSimilarity(spoken, correctAnswer);
    if (similarity > 0.85) {
        this.autoScore(1, 'fuzzy');
        return;
    }
    
    // No match - wait for controller
    this.showWaitingForJudgment();
}
```

### Step 4: Auto-Score Function
```javascript
autoScore(points, matchType) {
    // Score the answer
    this.scoreAnswer(points);
    
    // Broadcast auto-score result
    this.broadcast({
        type: 'auto-score',
        player: this.buzzedPlayer,
        points: points,
        matchType: matchType,
        autoScored: true
    });
    
    // Show result on screen
    this.showAutoScoreResult(points, matchType);
}
```

## Browser Compatibility

### Web Speech API Support
- ✅ Chrome/Edge: Full support
- ✅ Safari: Partial support (webkitSpeechRecognition)
- ❌ Firefox: Not supported (need fallback)

### Fallback Options
1. **Google Cloud Speech-to-Text API** (server-side)
   - Requires API key
   - More accurate
   - Works across all browsers

2. **Azure Speech Services** (server-side)
   - Alternative cloud service
   - Good accuracy

## Configuration Options

### Controller Settings
- Toggle auto-scoring on/off
- Set similarity threshold (default: 85%)
- Enable/disable auto-reveal answer

### Player Experience
- See answer immediately after buzz
- See transcribed text
- See auto-score result or "Waiting for judgment"

## UI Changes Needed

1. **Answer Display Area**
   - Show answer text after buzz
   - Show "Auto-scored: Correct" badge
   - Show transcribed text

2. **Settings Panel**
   - Auto-scoring toggle
   - Similarity threshold slider
   - Auto-reveal toggle

3. **Status Indicators**
   - "Listening..." while STT is active
   - "Processing..." while matching
   - "Auto-scored" or "Waiting for judgment"

## Estimated Effort

- **Show answer after buzz:** 2-3 hours
- **Speech-to-text integration:** 4-6 hours
- **Answer matching logic:** 3-4 hours
- **Auto-scoring:** 2-3 hours
- **UI updates:** 2-3 hours
- **Testing & refinement:** 4-6 hours

**Total:** ~20-25 hours of development

## Dependencies

- Web Speech API (browser-native, no install needed)
- OR Google Cloud Speech-to-Text API (requires API key)
- String similarity library (e.g., `string-similarity` npm package)
