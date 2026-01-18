# MindfulMe 🌱

> Your Mental Wellness Companion - A conversational AI friend that listens, understands, and supports your emotional journey.

## 🎯 Vision

MindfulMe is not a therapist replacement - it's a supportive friend in your pocket. A safe space where you can talk freely about your thoughts, feelings, and daily experiences. The app uses empathetic AI to create meaningful conversations that help you process emotions, maintain mental wellness, and build healthy habits.

### Why MindfulMe?

- **Always Available**: Talk anytime, anywhere - no appointments needed
- **Non-Judgmental**: Express yourself freely without fear of judgment
- **Conversational**: Natural dialogue that goes deeper, not just Q&A
- **Private**: Your thoughts stay with you, stored securely on your device
- **Streak-Based Growth**: Build consistency through daily journaling habits

## ✨ Core Features

### 1. 💬 Conversational Chat (Main Feature)
The heart of MindfulMe - an open conversation space where you can:
- Talk about anything on your mind
- Get thoughtful, empathetic responses
- Experience AI that asks meaningful follow-up questions
- Feel heard and understood, like talking to a caring friend

**How it works:**
- Voice-first: Just speak naturally (or type if you prefer)
- AI listens actively and responds with empathy
- Asks deeper questions to help you explore your thoughts
- No agenda, no judgment - just supportive conversation

### 2. 📔 Daily Journaling with Streaks
Build a consistent wellness practice through conversational journaling:
- **Daily Check-ins**: AI asks how your day went
- **Natural Flow**: Not rigid questions - it's a conversation
- **Deeper Exploration**: AI asks follow-up questions based on your responses
- **Streak Tracking**: Visual motivation to maintain your journaling habit
- **Reflection**: Look back at your journey and see patterns

**Journaling Philosophy:**
Instead of "How was your day? (1-10)", you get:
- "Hey! How did today feel for you?"
- "That sounds challenging. What made it particularly difficult?"
- "I noticed you mentioned work stress. Want to talk more about that?"

### 3. 🎭 Mood Tracking
Simple, visual mood logging:
- Quick mood check-ins throughout the day
- Visual analytics to spot patterns
- Connect moods with journal entries
- Understand your emotional landscape over time

### 4. 🗣️ Voice Support
Natural voice interactions:
- **Speak**: Use voice-to-text to share your thoughts hands-free
- **Listen**: AI responds with voice for a more personal experience
- **Flexible**: Switch between voice and text anytime

## 🏗️ Technical Architecture

### Frontend (Expo React Native)
```
Tech Stack:
- Expo SDK 54
- React Native 0.81.5
- Expo Router (file-based routing)
- Expo Speech (Voice-to-Text & Text-to-Speech)
- React Navigation (Tab navigation)
```

**Navigation Structure:**
```
/app
  ├── index.tsx           # Home/Onboarding
  ├── chat.tsx            # Main conversational chat
  ├── journal.tsx         # Daily journaling with streaks
  ├── mood.tsx            # Mood tracking
  └── profile.tsx         # User profile & settings
```

### Backend (FastAPI + MongoDB)
```
Tech Stack:
- FastAPI (async web framework)
- MongoDB with Motor (async driver)
- Claude AI (via Emergent LLM Key)
- emergentintegrations library
```

**Database Schema:**

```javascript
// Conversations Collection
{
  _id: ObjectId,
  type: "chat" | "journal",
  messages: [{
    role: "user" | "assistant",
    content: String,
    timestamp: Date,
    hasVoice: Boolean
  }],
  createdAt: Date,
  updatedAt: Date
}

// Journal Entries Collection
{
  _id: ObjectId,
  date: Date,  // YYYY-MM-DD for streak tracking
  conversation_id: ObjectId,
  mood: String,
  keyTopics: [String],
  summary: String,
  createdAt: Date
}

// Mood Logs Collection
{
  _id: ObjectId,
  mood: String,  // "great", "good", "okay", "bad", "terrible"
  intensity: Number,  // 1-10
  note: String,
  timestamp: Date
}

// User Profile Collection
{
  _id: ObjectId,
  currentStreak: Number,
  longestStreak: Number,
  totalJournalDays: Number,
  lastJournalDate: Date,
  preferences: {
    voiceEnabled: Boolean,
    notificationsEnabled: Boolean
  },
  createdAt: Date
}
```

### AI Integration (Claude)
```python
# Using emergentintegrations library with Emergent LLM Key
from emergentintegrations.llm.chat import LlmChat, UserMessage

chat = LlmChat(
    api_key=EMERGENT_LLM_KEY,
    session_id=conversation_id,
    system_message="You are MindfulMe, a compassionate mental wellness companion..."
).with_model("anthropic", "claude-sonnet-4-5-20250929")
```

**System Prompt Philosophy:**
- Empathetic and warm, never clinical
- Asks thoughtful follow-up questions
- Non-judgmental and supportive
- Helps users explore their thoughts deeper
- Recognizes when to validate vs. when to probe deeper

## 🚀 Future Enhancements (Post-MVP)

### Knowledge Graph Integration
The current database structure is designed to support advanced features:

**Phase 2: Conversation Memory**
- Build knowledge graph from conversation history
- Connect related topics across conversations
- "Remember you mentioned work stress last week? How's that going?"

**Phase 3: Personalized Insights**
- AI learns user's patterns, triggers, and coping mechanisms
- Proactive check-ins based on patterns
- "I noticed you tend to feel stressed on Mondays. How can I help?"

**Phase 4: Progress Visualization**
- Track emotional growth over time
- Visualize connections between life events and moods
- Celebrate wins and identify growth areas

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+
- Python 3.10+
- MongoDB (running locally)
- Expo CLI

### Installation

1. **Clone and Install Dependencies:**
```bash
# Install backend dependencies
cd backend
pip install -r requirements.txt

# Install frontend dependencies
cd ../frontend
yarn install
```

2. **Environment Setup:**

Backend `.env` (already configured):
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=mindfulme
EMERGENT_LLM_KEY=sk-emergent-aFd87569e5b78D0134
```

Frontend `.env` (auto-configured):
```
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
```

3. **Run the Application:**
```bash
# Start backend (runs on port 8001)
cd backend
python server.py

# Start frontend (runs on port 3000)
cd frontend
yarn start
```

4. **Access the App:**
- **Web**: http://localhost:3000
- **Mobile**: Scan QR code with Expo Go app

## 📱 User Experience Flow

### First Time User:
1. Welcome screen with calming visuals
2. Quick onboarding: "MindfulMe is your space to talk, reflect, and grow"
3. Choose first action: Start chatting or Begin journaling

### Daily User:
1. Open app → See streak status
2. Option to continue yesterday's thoughts or start fresh
3. Quick mood check-in
4. Enter main chat or journal mode
5. Voice or text - user's choice

### Journaling Flow:
1. "Hey! Want to talk about your day?"
2. User responds (voice/text)
3. AI asks follow-up: "That sounds interesting. What stood out most?"
4. Natural back-and-forth conversation
5. AI naturally closes: "Thanks for sharing. Same time tomorrow?"
6. Streak updated ✅

## 🎨 Design Principles

### Visual Design:
- **Calming Colors**: Soft blues, purples, and greens
- **Minimalist UI**: Remove distractions, focus on conversation
- **Thumb-Friendly**: All actions within easy reach
- **Breathing Room**: Generous spacing, not cluttered

### UX Principles:
- **Voice-First**: Optimize for natural speech
- **Quick Actions**: Start talking in 1 tap
- **Forgiving**: Easy to pause, resume, or start over
- **Motivating**: Visual streaks without pressure

### Conversational Design:
- **Natural Language**: Write like a friend, not a bot
- **Active Listening**: Acknowledge feelings, validate experiences
- **Curiosity**: Ask open-ended questions
- **Patience**: Never rush, let user guide the pace

## 🔒 Privacy & Security

- **Local-First**: All data stored locally on device (for MVP)
- **No Tracking**: Zero analytics or third-party tracking
- **Secure Storage**: Encrypted local database
- **User Control**: Delete data anytime

## 🤝 Contributing

This is an MVP built for exploration. Future contributions welcome:
- Enhanced AI prompting strategies
- Better voice quality
- Offline mode
- Multi-language support

## 📄 License

Private project - All rights reserved

---

**Built with ❤️ for mental wellness**

*Remember: MindfulMe is a supportive tool, not a replacement for professional mental health care. If you're in crisis, please reach out to a mental health professional or crisis hotline.*
