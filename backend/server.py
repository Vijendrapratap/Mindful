from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId
from emergentintegrations.llm.chat import LlmChat, UserMessage
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Get Emergent LLM Key
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class Message(BaseModel):
    role: str  # "user" or "assistant"
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    hasVoice: bool = False

class Conversation(BaseModel):
    id: Optional[str] = None
    type: str  # "chat" or "journal"
    messages: List[Message] = []
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

class ConversationCreate(BaseModel):
    type: str

class MessageCreate(BaseModel):
    conversationId: str
    content: str
    hasVoice: bool = False

class JournalEntry(BaseModel):
    id: Optional[str] = None
    date: str  # YYYY-MM-DD
    conversationId: str
    mood: Optional[str] = None
    emotion: Optional[str] = None  # happy, sad, anxious, calm, excited, etc.
    images: List[str] = []  # base64 encoded images
    voiceRecording: Optional[str] = None  # base64 encoded audio
    keyTopics: List[str] = []
    summary: Optional[str] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)

class JournalCreate(BaseModel):
    date: str
    conversationId: str
    mood: Optional[str] = None
    emotion: Optional[str] = None
    images: List[str] = []
    voiceRecording: Optional[str] = None

class MoodLog(BaseModel):
    id: Optional[str] = None
    mood: str  # "great", "good", "okay", "bad", "terrible"
    intensity: int  # 1-10
    note: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class MoodCreate(BaseModel):
    mood: str
    intensity: int
    note: Optional[str] = None

class UserProfile(BaseModel):
    id: Optional[str] = None
    currentStreak: int = 0
    longestStreak: int = 0
    totalJournalDays: int = 0
    lastJournalDate: Optional[str] = None  # YYYY-MM-DD
    preferences: dict = {"voiceEnabled": True, "notificationsEnabled": True}
    createdAt: datetime = Field(default_factory=datetime.utcnow)

# ==================== HELPER FUNCTIONS ====================

def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable format"""
    if doc and '_id' in doc:
        doc['id'] = str(doc['_id'])
        del doc['_id']
    return doc

async def get_or_create_profile():
    """Get existing profile or create a new one"""
    profile = await db.profiles.find_one()
    if not profile:
        profile_obj = UserProfile()
        result = await db.profiles.insert_one(profile_obj.dict(exclude={'id'}))
        profile = await db.profiles.find_one({'_id': result.inserted_id})
    return serialize_doc(profile)

async def calculate_streak(profile):
    """Calculate current streak based on journal entries"""
    if not profile.get('lastJournalDate'):
        return 0
    
    last_date = datetime.strptime(profile['lastJournalDate'], '%Y-%m-%d').date()
    today = datetime.utcnow().date()
    
    # Check if streak is broken
    if (today - last_date).days > 1:
        return 0
    
    return profile.get('currentStreak', 0)

async def update_streak(date_str: str):
    """Update streak when a new journal entry is created"""
    profile = await get_or_create_profile()
    today = datetime.strptime(date_str, '%Y-%m-%d').date()
    
    if not profile.get('lastJournalDate'):
        # First journal entry
        new_streak = 1
        days_diff = 1  # First entry counts as 1 day
    else:
        last_date = datetime.strptime(profile['lastJournalDate'], '%Y-%m-%d').date()
        days_diff = (today - last_date).days
        
        if days_diff == 0:
            # Same day, no streak update
            return profile
        elif days_diff == 1:
            # Consecutive day
            new_streak = profile.get('currentStreak', 0) + 1
        else:
            # Streak broken, start over
            new_streak = 1
    
    longest_streak = max(new_streak, profile.get('longestStreak', 0))
    
    await db.profiles.update_one(
        {'_id': ObjectId(profile['id'])},
        {'$set': {
            'currentStreak': new_streak,
            'longestStreak': longest_streak,
            'lastJournalDate': date_str,
            'totalJournalDays': profile.get('totalJournalDays', 0) + (1 if days_diff != 0 else 0)
        }}
    )
    
    return await get_or_create_profile()

async def get_ai_response(conversation_id: str, user_message: str, conversation_type: str):
    """Get AI response using Claude via emergentintegrations"""
    try:
        # Get conversation history
        conversation = await db.conversations.find_one({'_id': ObjectId(conversation_id)})
        
        # Create system message based on type
        if conversation_type == "journal":
            system_message = """You are MindfulMe, a warm and compassionate journaling companion. 
            Your role is to help users reflect on their day through natural conversation.
            
            Guidelines:
            - Be empathetic, warm, and non-judgmental
            - Ask thoughtful follow-up questions to help users explore their thoughts
            - Don't just say "that's good" - dig deeper with curiosity
            - Keep responses concise (2-3 sentences) to maintain conversational flow
            - Validate emotions and experiences
            - Help users process their day, not solve their problems
            - Use conversational language, like a caring friend
            
            Example responses:
            - "That sounds like it was challenging. What made it particularly difficult for you?"
            - "I hear excitement in what you're sharing! What part of that experience felt most meaningful?"
            - "It seems like that really affected you. How are you feeling about it now?"""
        else:  # chat
            system_message = """You are MindfulMe, a supportive mental wellness companion and friend.
            Your role is to provide a safe, non-judgmental space for users to talk about their thoughts and feelings.
            
            Guidelines:
            - Be empathetic, warm, and genuinely caring
            - Listen actively and ask thoughtful follow-up questions
            - Help users explore their emotions without being clinical or therapeutic
            - Validate their experiences and feelings
            - You're a friend, not a therapist - be conversational and human
            - Keep responses concise but meaningful (3-4 sentences)
            - Show genuine interest in understanding their perspective
            - Recognize when to offer comfort vs. when to ask deeper questions
            
            Remember: You're here to listen, understand, and support - not to fix or diagnose."""
        
        # Initialize AI chat
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=conversation_id,
            system_message=system_message
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        
        # Create user message
        message = UserMessage(text=user_message)
        
        # Get response
        response = await chat.send_message(message)
        
        return response
        
    except Exception as e:
        logger.error(f"Error getting AI response: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI response error: {str(e)}")

# ==================== API ENDPOINTS ====================

@api_router.get("/")
async def root():
    return {"message": "MindfulMe API", "status": "running"}

# Profile endpoints
@api_router.get("/profile")
async def get_profile():
    profile = await get_or_create_profile()
    # Recalculate current streak
    current_streak = await calculate_streak(profile)
    if current_streak != profile.get('currentStreak'):
        await db.profiles.update_one(
            {'_id': ObjectId(profile['id'])},
            {'$set': {'currentStreak': current_streak}}
        )
        profile = await get_or_create_profile()
    return profile

@api_router.put("/profile")
async def update_profile(preferences: dict):
    profile = await get_or_create_profile()
    await db.profiles.update_one(
        {'_id': ObjectId(profile['id'])},
        {'$set': {'preferences': preferences}}
    )
    return await get_or_create_profile()

# Conversation endpoints
@api_router.post("/conversations")
async def create_conversation(data: ConversationCreate):
    conversation = Conversation(type=data.type)
    result = await db.conversations.insert_one(conversation.dict(exclude={'id'}))
    created = await db.conversations.find_one({'_id': result.inserted_id})
    return serialize_doc(created)

@api_router.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str):
    try:
        conversation = await db.conversations.find_one({'_id': ObjectId(conversation_id)})
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return serialize_doc(conversation)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/conversations")
async def get_conversations(type: Optional[str] = None):
    query = {'type': type} if type else {}
    conversations = await db.conversations.find(query).sort('updatedAt', -1).to_list(100)
    return [serialize_doc(c) for c in conversations]

@api_router.post("/conversations/message")
async def send_message(data: MessageCreate):
    try:
        # Get conversation
        conversation = await db.conversations.find_one({'_id': ObjectId(data.conversationId)})
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        # Add user message
        user_message = Message(
            role="user",
            content=data.content,
            hasVoice=data.hasVoice
        )
        
        # Get AI response
        ai_response_text = await get_ai_response(
            data.conversationId,
            data.content,
            conversation['type']
        )
        
        # Add assistant message
        assistant_message = Message(
            role="assistant",
            content=ai_response_text,
            hasVoice=False
        )
        
        # Update conversation
        await db.conversations.update_one(
            {'_id': ObjectId(data.conversationId)},
            {
                '$push': {
                    'messages': {
                        '$each': [user_message.dict(), assistant_message.dict()]
                    }
                },
                '$set': {'updatedAt': datetime.utcnow()}
            }
        )
        
        # Return updated conversation
        updated = await db.conversations.find_one({'_id': ObjectId(data.conversationId)})
        return serialize_doc(updated)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending message: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Journal endpoints
@api_router.post("/journals")
async def create_journal(data: JournalCreate):
    # Check if journal already exists for this date
    existing = await db.journals.find_one({'date': data.date})
    if existing:
        return serialize_doc(existing)
    
    journal = JournalEntry(
        date=data.date,
        conversationId=data.conversationId,
        mood=data.mood
    )
    result = await db.journals.insert_one(journal.dict(exclude={'id'}))
    
    # Update streak
    await update_streak(data.date)
    
    created = await db.journals.find_one({'_id': result.inserted_id})
    return serialize_doc(created)

@api_router.get("/journals")
async def get_journals(limit: int = 30):
    journals = await db.journals.find().sort('date', -1).limit(limit).to_list(limit)
    return [serialize_doc(j) for j in journals]

@api_router.get("/journals/today")
async def get_today_journal():
    today = datetime.utcnow().strftime('%Y-%m-%d')
    journal = await db.journals.find_one({'date': today})
    return serialize_doc(journal) if journal else None

# Mood endpoints
@api_router.post("/moods")
async def create_mood(data: MoodCreate):
    mood = MoodLog(
        mood=data.mood,
        intensity=data.intensity,
        note=data.note
    )
    result = await db.moods.insert_one(mood.dict(exclude={'id'}))
    created = await db.moods.find_one({'_id': result.inserted_id})
    return serialize_doc(created)

@api_router.get("/moods")
async def get_moods(days: int = 7):
    start_date = datetime.utcnow() - timedelta(days=days)
    moods = await db.moods.find(
        {'timestamp': {'$gte': start_date}}
    ).sort('timestamp', -1).to_list(100)
    return [serialize_doc(m) for m in moods]

@api_router.get("/moods/stats")
async def get_mood_stats(days: int = 30):
    start_date = datetime.utcnow() - timedelta(days=days)
    moods = await db.moods.find(
        {'timestamp': {'$gte': start_date}}
    ).to_list(1000)
    
    if not moods:
        return {
            "totalLogs": 0,
            "averageIntensity": 0,
            "moodDistribution": {}
        }
    
    # Calculate stats
    total = len(moods)
    avg_intensity = sum(m['intensity'] for m in moods) / total
    
    mood_counts = {}
    for mood in moods:
        mood_type = mood['mood']
        mood_counts[mood_type] = mood_counts.get(mood_type, 0) + 1
    
    return {
        "totalLogs": total,
        "averageIntensity": round(avg_intensity, 1),
        "moodDistribution": mood_counts
    }

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
