# ICC Quiz Cards

An interactive flashcard application for ICC quiz questions. Features beautiful card animations, text-to-speech, multiplayer buzz-in mode, and Progressive Web App support for mobile devices.

## Features

### Solo Mode
- **Interactive Flashcards**: Click to flip cards and reveal answers
- **Streaming Text Animation**: Questions appear word-by-word at natural reading speed
- **Text-to-Speech**: Voice reading with neutral English male voice
- **Auto-Read Mode**: Automatically read questions as they appear
- **Smooth Animations**: Beautiful hover effects and transitions
- **Progress Tracking**: Visual progress bar and statistics
- **Keyboard Navigation**: Arrow keys to navigate, Space/Enter to flip, R to read

### Multiplayer Buzz Mode 🎮
- **4-Player Support**: Up to 4 players can compete simultaneously
- **Controller Role**: 5th player manages the quiz and judges answers
- **Buzz-In System**: Players buzz to answer, stopping question stream
- **Live Scoreboard**: Real-time score tracking with +1, 0, -1 scoring
- **Auto-Progression**: Automatically moves to next question after scoring
- **Role-Based Access**: Only controller can flip cards and reveal answers

### Progressive Web App
- **Install on Mobile**: Add to home screen on iOS and Android
- **Offline Support**: Works without internet after first visit
- **Native Feel**: Full-screen mode with no browser UI
- **Responsive Design**: Optimized for all screen sizes

## Project Structure

```
icc-quiz-cards/
├── public/                      # Web application
│   ├── index.html              # Solo mode
│   ├── multiplayer.html        # Multiplayer buzz mode
│   ├── manifest.json           # PWA manifest
│   ├── sw.js                   # Service worker
│   ├── css/
│   │   ├── styles.css          # Solo mode styles
│   │   └── multiplayer.css     # Multiplayer styles
│   └── js/
│       ├── app.js              # Solo mode logic
│       └── multiplayer.js      # Multiplayer logic
├── data/
│   ├── quizzes/                # JSON quiz files
│   │   └── sample_quiz.json
│   └── quiz-index.json         # Index of available quizzes
├── scripts/                    # PDF processing scripts
│   ├── extract_pdf.py          # Single PDF converter
│   ├── parse_quiz.py           # Text parser
│   └── batch_convert.py        # Batch PDF converter
├── docs/
│   └── schema.json             # Quiz data schema
├── vercel.json                 # Vercel deployment config
├── requirements.txt            # Python dependencies
└── README.md                  # This file
```

## Quick Start

### 1. Convert PDFs to JSON

First, install Python dependencies:

```bash
pip install -r requirements.txt
```

Convert all PDF files in the root directory:

```bash
python scripts/batch_convert.py
```

Or convert a single PDF:

```bash
python scripts/extract_pdf.py "ICC Season 9, Week 2.pdf"
```

This will:
- Extract text from PDFs
- Parse questions, answers, and translations
- Generate JSON files in `data/quizzes/`
- Update `data/quiz-index.json`

### 2. Deploy to Vercel

#### Option A: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

#### Option B: Deploy via GitHub

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your GitHub repository
4. Vercel will automatically detect the configuration
5. Click "Deploy"

Your app will be live at: `https://your-project.vercel.app`

### 3. Local Development

You can also run locally using any static server:

```bash
# Using Python
python -m http.server 8000 --directory public

# Using Node.js
npx http-server public -p 8000

# Using PHP
php -S localhost:8000 -t public
```

Then open: `http://localhost:8000`

## Usage Guide

### Converting PDFs

The PDF extraction script automatically detects and parses:
- Round numbers (ROUND ONE, ROUND TWO, etc.)
- Player numbers (PLAYER ONE, PLAYER TWO, etc.)
- Questions and answers
- Alternative acceptable answers
- Translations in multiple languages

**Example PDF Format:**
```
PLAYER ONE
QUESTION ONE
What is the capital of France?
ANS: Paris
Mandarin: Bālí

QUESTION TWO
...
```

### Quiz Data Format

Quizzes are stored in JSON format following this structure:

```json
{
  "metadata": {
    "title": "Quiz Title",
    "source": "source.pdf",
    "date": "2025-11-16",
    "rounds": 5
  },
  "rounds": [
    {
      "round_number": 1,
      "round_name": "Round 1",
      "players": [
        {
          "player_number": 1,
          "questions": [
            {
              "question_number": 1,
              "question_text": "Question text here",
              "answer": "Answer here",
              "accept": ["Alternative answer 1", "Alternative answer 2"],
              "translations": {
                "mandarin": "Translation text",
                "french": "Translation text"
              }
            }
          ]
        }
      ]
    }
  ]
}
```

See `docs/schema.json` for the complete JSON schema.

### Using the Flashcard App (Solo Mode)

1. **Select a Quiz**: Choose from the dropdown menu
2. **Read the Question**: Watch words stream in naturally
3. **Listen (Optional)**: Click "Read Aloud" or enable "Auto-read questions"
4. **Reveal Answer**: Click the card or press Space/Enter
5. **Navigate**: Use arrow buttons or arrow keys
6. **Track Progress**: Watch the progress bar fill up

#### Keyboard Shortcuts

- **←/→**: Previous/Next question
- **Space/Enter**: Flip card
- **R**: Read question aloud

### Using Multiplayer Buzz Mode

Access multiplayer mode at `/multiplayer.html`

#### Setting Up a Game

1. **Controller** starts first and shares the room code with players
2. **Players 1-4** join using the same room code
3. Everyone selects their role (Controller or Player 1-4)
4. **Controller** selects a quiz to begin

#### How to Play

1. **Question Appears**: Words stream in at natural reading speed
2. **Players Buzz** (Optional): Click the buzz button when you know the answer
   - Buzzing stops the question stream and voice
   - First to buzz gets to answer
3. **Controller Reveals Answer**: Click/tap the card to flip and show answer
4. **Controller Judges** (if someone buzzed):
   - **Correct (+1)**: Award point
   - **Wrong (−1)**: Deduct point
   - **Pass (0)**: No points
5. **Controller Advances**: Press "Next" button to move to next question
6. **Repeat**: Continue through all questions

#### Multiplayer Features

- **Room Codes**: Share unique room codes to connect players
- **Real-Time Scoreboard**: Live score updates for all 4 players
- **Controller-Only Access**: Only controller can flip cards and judge answers
- **Buzz Indicators**: Shows who buzzed and when
- **Auto-Progression**: Moves to next question after scoring

#### Backend Modes

The app automatically detects which backend to use:

**🏠 Local Mode (Default)**
- Uses BroadcastChannel API (built into browsers)
- Works great for **same-browser testing** (multiple tabs)
- No setup required!
- Perfect for: testing, local play, single-device demos

**🌐 Multi-Device Mode (Supabase)**
- Real-time sync across **different devices and locations**
- Uses Supabase free tier (no credit card needed)
- **5-minute setup** - see [`SUPABASE_SETUP.md`](SUPABASE_SETUP.md)
- Supports: phones, tablets, laptops, different networks

#### Testing Locally (No Setup)

1. Open `/multiplayer.html` in 5 browser tabs
2. Tab 1: Select "Controller"
3. Tabs 2-5: Select "Player 1", "Player 2", etc.
4. All tabs sync automatically via BroadcastChannel

#### Enable Multi-Device (5-Minute Setup)

Want players on different phones/computers?

**Quick Setup:**
1. Create free account at [supabase.com](https://supabase.com) (no credit card)
2. Create new project, copy URL and API key
3. Add to `public/config.local.js` (see [`SUPABASE_SETUP.md`](SUPABASE_SETUP.md))
4. Done! Now works across any device/network

**Detailed Guide:** See [`SUPABASE_SETUP.md`](SUPABASE_SETUP.md) for step-by-step instructions with screenshots.

### Installing as PWA on Mobile

#### iOS (Safari)
1. Open the app in Safari
2. Tap the Share button
3. Select "Add to Home Screen"
4. Tap "Add"

#### Android (Chrome)
1. Open the app in Chrome
2. Tap the menu (⋮)
3. Select "Add to Home Screen"
4. Tap "Add"

The app will now appear as an icon on your home screen and run in full-screen mode!

## Customization

### Styling

Edit `public/css/styles.css` to customize:
- Colors (CSS variables in `:root`)
- Animations and transitions
- Card sizes and spacing
- Font styles

### Text Animation Speed

In `public/js/app.js`, adjust the reading speed:

```javascript
const wordsPerMinute = 400; // Default: 400 words/min
```

Lower = slower, Higher = faster

### Voice Settings

Modify voice parameters in `public/js/app.js`:

```javascript
this.currentUtterance.rate = 0.9;  // Speed (0.1 to 10)
this.currentUtterance.pitch = 1.0; // Pitch (0 to 2)
this.currentUtterance.volume = 1.0; // Volume (0 to 1)
```

## Scripts Reference

### extract_pdf.py

Convert a single PDF to JSON:

```bash
python scripts/extract_pdf.py <pdf_file> [options]

Options:
  -o, --output   Output JSON file (default: same name as PDF)
  -t, --title    Quiz title (default: filename)
```

### batch_convert.py

Convert all PDFs in a directory:

```bash
python scripts/batch_convert.py [options]

Options:
  -i, --input    Input directory (default: current directory)
  -o, --output   Output directory (default: ./data/quizzes)
```

### parse_quiz.py

Parse extracted text (if you already have text from PDF):

```bash
python scripts/parse_quiz.py <text_file> [options]

Options:
  -o, --output   Output JSON file (default: output.json)
  -t, --title    Quiz title
  -s, --source   Source document name
```

## Troubleshooting

### PDFs not converting properly

- Ensure PDFs follow the expected format (ROUND, PLAYER, QUESTION, ANS)
- Check that text is selectable in the PDF (not scanned images)
- Try using alternative PDF libraries (see requirements.txt)

### Voice not working

- Check browser compatibility (Chrome, Safari, Edge recommended)
- Ensure HTTPS (required for some browsers)
- Check browser speech synthesis permissions

### Cards not displaying

- Verify `data/quiz-index.json` exists and lists your quizzes
- Check browser console for errors
- Ensure JSON files are valid (use a JSON validator)

## Browser Support

- **Chrome/Edge**: Full support
- **Firefox**: Full support (voice may vary)
- **Safari**: Full support
- **Mobile**: Supported on iOS Safari and Android Chrome

## License

MIT License - Feel free to use and modify for your needs.

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## Support

For issues or questions, please open an issue on GitHub.
