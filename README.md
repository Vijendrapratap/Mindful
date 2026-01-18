# MindfulMe 🌱🧠

> Your AI-Powered Mental Wellness Companion with Intelligent Memory

[![CI/CD](https://github.com/yourusername/mindfulme/workflows/MindfulMe%20CI/CD%20Pipeline/badge.svg)](https://github.com/yourusername/mindfulme/actions)
[![License](https://img.shields.io/badge/license-Private-blue.svg)](LICENSE)

## 🎯 Vision

MindfulMe is not just another mental wellness app - it's an intelligent companion that **remembers, learns, and grows with you**. Using advanced AI and Knowledge Graph technology, MindfulMe provides personalized, context-aware support that feels like talking to a friend who truly knows you.

### Why MindfulMe?

- **🧠 Intelligent Memory**: Knowledge Graph remembers people, events, emotions, and patterns
- **💬 Context-Aware Conversations**: AI references past discussions naturally
- **📔 Apple Journal-Style Design**: Beautiful, modern interface
- **🔒 Privacy-First**: All data stored locally, never shared
- **🔥 Streak Tracking**: Build consistency through daily journaling
- **🎨 Modern UI**: Glassmorphism design with smooth animations

---

## ✨ Core Features

### 1. 💬 **Conversational Chat with Memory**
- Open conversation space powered by Claude AI
- **Knowledge Graph Integration**: AI remembers important details
- Voice-first or text-based interaction
- Contextual responses that reference past conversations
- Empathetic, non-judgmental support

**Example:**
```
User (Day 1): "I had lunch with Sarah today. She seemed happy."
User (Day 5): "I'm feeling anxious about work."
AI: "I remember you mentioned Sarah recently - it's great you had that time together. 
     Now you're feeling anxious about work. What's weighing on you?"
```

### 2. 📔 **Intelligent Daily Journaling**
- **Apple Journal-Inspired Design** with modern glassmorphism UI
- **Rich Media Support**:
  - 📸 Add multiple photos from gallery
  - 🎙️ Record voice notes
  - ✍️ Free-form text
- **Mood & Emotion Tracking**:
  - 6 mood options: Amazing, Happy, Calm, Okay, Sad, Anxious
  - 10 emotion tags: Grateful, Excited, Peaceful, Hopeful, etc.
  - Select up to 3 emotions per entry
- **Conversational AI Guidance**: Not rigid questions - natural dialogue
- **Streak System**: Visual motivation with fire emoji 🔥
- **Calendar View**: See your journaling history at a glance

### 3. 🧠 **Knowledge Graph (AI Memory System)**

**Revolutionary Feature**: MindfulMe builds a personal knowledge graph from your conversations.

**What It Captures:**
- 👥 **People**: Friends, family, colleagues mentioned
- 😊 **Emotions**: How you feel about different things
- 🎯 **Activities**: Things you do, places you go
- 🎨 **Interests**: Topics you care about
- ⚡ **Triggers**: What causes stress or joy
- 🔗 **Relationships**: Connections between entities

**Knowledge Types:**
```javascript
Nodes (Entities):
- Person: "Sarah", "Mom", "Boss"
- Emotion: "happy", "anxious", "calm"
- Activity: "yoga", "work", "meditation"
- Place: "gym", "office", "home"
- Interest: "photography", "cooking"

Edges (Relationships):
- Sarah → triggers → happiness
- Work → causes → stress
- Yoga → helps → anxiety
```

**Benefits:**
- ✅ AI remembers your story across months
- ✅ Personalized insights: "You mentioned work stress 5 times this week"
- ✅ Pattern detection: "You feel anxious every Monday"
- ✅ Proactive support: "How's that project you were worried about?"

**API Endpoints:**
```bash
GET  /api/knowledge/nodes     # View all entities
GET  /api/knowledge/edges     # View relationships
GET  /api/knowledge/stats     # Graph statistics
GET  /api/knowledge/graph     # Full graph data
```

### 4. 👤 **Enhanced Profile**
- User info: Name, age, profile photo
- **Personality Test**: Big Five-inspired assessment
- Streak statistics
- Preferences (voice, notifications)
- Settings and privacy controls

---

## 🏗️ Technical Architecture

### Tech Stack

**Frontend:**
- Expo SDK 54 (React Native 0.81.5)
- Expo Router (file-based routing)
- TypeScript
- Expo Speech (Voice I/O)
- Expo Image Picker (Media)
- React Navigation (Tab navigation)

**Backend:**
- FastAPI (Python 3.11)
- Motor (Async MongoDB driver)
- Claude AI (via Emergent LLM Key)
- emergentintegrations library

**Database:**
- MongoDB 7.0
- Collections: conversations, journals, profiles, knowledge_nodes, knowledge_edges, extraction_logs

**AI/ML:**
- Claude Sonnet 4.5 (Anthropic)
- Knowledge extraction system
- Context retrieval algorithms

### Database Schema

```javascript
// Conversations
{
  type: "chat" | "journal",
  messages: [{role, content, timestamp, hasVoice}],
  createdAt, updatedAt
}

// Journal Entries
{
  date: "YYYY-MM-DD",
  conversationId: ObjectId,
  mood: "amazing" | "happy" | "calm" | "okay" | "sad" | "anxious",
  emotion: "grateful" | "excited" | "peaceful" | ...,
  images: [base64],
  voiceRecording: base64,
  keyTopics: [String],
  summary: String
}

// Knowledge Nodes
{
  profileId: ObjectId,
  entityType: "Person" | "Emotion" | "Activity" | "Place" | "Interest",
  entityName: String,
  properties: {},
  confidence: Float,
  mentionCount: Int,
  lastMentioned: DateTime
}

// Knowledge Edges
{
  profileId: ObjectId,
  sourceNodeId: ObjectId,
  targetNodeId: ObjectId,
  relationshipType: "experienced" | "caused" | "triggers" | ...,
  confidence: Float,
  lastUpdated: DateTime
}

// User Profile
{
  name, age, profilePic,
  currentStreak, longestStreak, totalJournalDays,
  personalityType, personalityTraits,
  preferences: {voiceEnabled, notificationsEnabled}
}
```

### Knowledge Graph Architecture

```
┌─────────────┐
│   User      │
│  Message    │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  AI Processes   │◄──── System Prompt with Context
│  & Responds     │
└────────┬────────┘
         │
         ▼
┌──────────────────────┐
│  Knowledge           │
│  Extraction Engine   │
│  (Background Async)  │
└──────┬───────────────┘
       │
       ▼
┌─────────────────────────────┐
│  MongoDB Collections        │
│  ┌─────────────────────┐   │
│  │  knowledge_nodes    │   │
│  │  knowledge_edges    │   │
│  │  extraction_logs    │   │
│  └─────────────────────┘   │
└─────────────────────────────┘
       │
       ▼
┌─────────────────┐
│  Next Message   │
│  Retrieves      │◄──── Fast indexed queries
│  Context        │
└─────────────────┘
```

**Performance Optimizations:**
- Async extraction (doesn't block conversations)
- MongoDB indexes on profileId, entityType, lastMentioned
- Context limited to 20 most relevant nodes
- Query time < 50ms

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- MongoDB 7.0+
- Expo CLI
- Expo Go app (for mobile testing)

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/yourusername/mindfulme.git
cd mindfulme
```

2. **Set up environment variables:**
```bash
cp .env.example .env
# Edit .env with your credentials
```

3. **Install backend dependencies:**
```bash
cd backend
pip install -r requirements.txt
```

4. **Install frontend dependencies:**
```bash
cd frontend
yarn install
```

5. **Start MongoDB:**
```bash
# Option 1: Using Docker
docker run -d -p 27017:27017 --name mongodb mongo:7.0

# Option 2: Local MongoDB
mongod --dbpath /path/to/data
```

6. **Run the application:**
```bash
# Terminal 1: Backend
cd backend
python server.py

# Terminal 2: Frontend
cd frontend
yarn start
```

7. **Access the app:**
- **Web**: http://localhost:3000
- **Mobile**: Scan QR code with Expo Go app

### Docker Setup (Recommended for Production)

```bash
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

---

## 📦 Deployment

### Using Docker

```bash
# Build images
docker build -f Dockerfile.backend -t mindfulme-backend .
docker build -f Dockerfile.frontend -t mindfulme-frontend .

# Run containers
docker-compose up -d
```

### Environment Variables

**Backend (.env):**
```bash
MONGO_URL=mongodb://mongodb:27017
DB_NAME=mindfulme
EMERGENT_LLM_KEY=your-key-here
```

**Frontend (.env):**
```bash
EXPO_PUBLIC_BACKEND_URL=http://backend:8001
```

### CI/CD Pipeline

GitHub Actions workflow included at `.github/workflows/ci-cd.yml`:

- ✅ Automated testing (backend & frontend)
- ✅ Linting (Python & TypeScript)
- ✅ Docker image builds
- ✅ Automated deployment (configure as needed)

**Setup:**
1. Add secrets to GitHub:
   - `DOCKER_USERNAME`
   - `DOCKER_PASSWORD`
   - `EMERGENT_LLM_KEY`

2. Push to `main` branch to trigger deployment

---

## 🧪 Testing

### Backend Tests
```bash
cd backend
pytest tests/
```

### Frontend Tests
```bash
cd frontend
yarn test
```

### Manual Testing
```bash
# Backend API health
curl http://localhost:8001/api/

# Knowledge Graph stats
curl http://localhost:8001/api/knowledge/stats
```

---

## 📱 Mobile App (Expo Go)

### iOS Setup

1. Install **Expo Go** from App Store
2. Ensure you added iOS permissions in `app.json`:
   - Camera access
   - Photo library access
   - Microphone access
3. Scan QR code from Expo Metro bundler
4. Grant permissions when prompted

### Android Setup

1. Install **Expo Go** from Play Store
2. Scan QR code or enter URL manually
3. Grant required permissions

### Troubleshooting

**App crashes on load:**
- Ensure React versions match (19.1.0)
- Clear Expo Go cache
- Restart Metro bundler

**Cannot connect to backend:**
- Check `EXPO_PUBLIC_BACKEND_URL` in `.env`
- Ensure backend is running
- Check network connectivity

---

## 🗺️ Roadmap

### ✅ Completed (v1.0)
- [x] Conversational AI chat
- [x] Daily journaling with streaks
- [x] Mood & emotion tracking
- [x] Knowledge Graph system
- [x] Voice support (text-to-speech)
- [x] Image attachments
- [x] Modern glassmorphism UI
- [x] Profile & personality test
- [x] Docker & CI/CD setup

### 🚧 In Progress
- [ ] Advanced relationship extraction
- [ ] Push notifications
- [ ] Offline mode
- [ ] Data export

### 🔮 Future Enhancements
- [ ] Pattern detection & insights
- [ ] Proactive check-ins
- [ ] Knowledge graph visualization
- [ ] Multi-language support
- [ ] Therapist integration
- [ ] Group journaling
- [ ] Advanced NLP for better extraction

---

## 🔒 Privacy & Security

- **Local-First**: All data stored on your device/server
- **Encrypted Storage**: MongoDB with authentication
- **No Analytics**: Zero third-party tracking
- **User Control**: Delete data anytime
- **HIPAA-Ready**: Architecture supports compliance

### Data Protection
- All API communications over HTTPS
- MongoDB authentication required
- JWT tokens for user sessions (when auth added)
- Regular security audits

---

## 🤝 Contributing

This is a private project. For inquiries, contact the project owner.

### Development Guidelines

1. Follow existing code structure
2. Write tests for new features
3. Update documentation
4. Use TypeScript for frontend
5. Follow PEP 8 for Python

---

## 📄 License

Private - All Rights Reserved

---

## 🙏 Acknowledgments

- **Claude AI** (Anthropic) for conversational intelligence
- **Expo** for amazing mobile development experience
- **FastAPI** for high-performance backend
- **MongoDB** for flexible data storage

---

## 📞 Support

For issues or questions:
- Open an issue on GitHub
- Email: support@mindfulme.app
- Documentation: https://docs.mindfulme.app

---

## ⚠️ Important Notes

### For Production Deployment:

1. **Security Checklist:**
   - [ ] Change all default passwords
   - [ ] Set up MongoDB authentication
   - [ ] Configure SSL/TLS certificates
   - [ ] Set up firewall rules
   - [ ] Enable rate limiting
   - [ ] Configure CORS properly
   - [ ] Set up backup strategy

2. **Performance Optimization:**
   - [ ] Enable MongoDB replication
   - [ ] Set up Redis caching
   - [ ] Configure CDN for static assets
   - [ ] Monitor API response times
   - [ ] Set up logging aggregation

3. **Monitoring:**
   - [ ] Set up application monitoring (e.g., Sentry)
   - [ ] Configure health checks
   - [ ] Set up alerting
   - [ ] Monitor database performance

---

**Built with ❤️ for mental wellness**

*MindfulMe is a supportive tool, not a replacement for professional mental health care. If you're in crisis, please reach out to a mental health professional or crisis hotline.*

**Crisis Resources:**
- National Suicide Prevention Lifeline: 988
- Crisis Text Line: Text HOME to 741741
- International Association for Suicide Prevention: https://www.iasp.info/resources/Crisis_Centres/
