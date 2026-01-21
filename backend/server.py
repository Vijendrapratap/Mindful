from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from bson import ObjectId
import asyncio
import json
import base64
import tempfile

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# OpenAI client for Whisper API (fallback)
try:
    from openai import AsyncOpenAI
    openai_client = AsyncOpenAI(api_key=os.environ.get('OPENAI_API_KEY'))
except Exception as e:
    openai_client = None
    logging.warning(f"OpenAI client not initialized: {e}")

# WhisperX for local transcription (preferred if available)
whisperx_model = None
whisperx_available = False
try:
    import whisperx
    import torch

    # Check for GPU availability
    device = "cuda" if torch.cuda.is_available() else "cpu"
    compute_type = "float16" if torch.cuda.is_available() else "int8"

    # Load model on startup (use smaller model for faster loading, or large-v2 for accuracy)
    WHISPERX_MODEL_SIZE = os.environ.get('WHISPERX_MODEL', 'base')  # base, small, medium, large-v2
    whisperx_model = whisperx.load_model(WHISPERX_MODEL_SIZE, device, compute_type=compute_type)
    whisperx_available = True
    logging.info(f"WhisperX loaded successfully on {device} with model {WHISPERX_MODEL_SIZE}")
except ImportError:
    logging.info("WhisperX not installed - will use OpenAI API for transcription")
except Exception as e:
    logging.warning(f"WhisperX initialization failed: {e} - will use OpenAI API")

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
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None  # New field
    personality: Optional[dict] = None  # { type: str, traits: list, summary: str }
    profilePic: Optional[str] = None  # base64 encoded image
    currentStreak: int = 0
    longestStreak: int = 0
    totalJournalDays: int = 0
    lastJournalDate: Optional[str] = None  # YYYY-MM-DD
    personalityType: Optional[str] = None  # Result from personality test
    personalityTraits: dict = {}  # Detailed personality traits
    preferences: dict = {
        "voiceEnabled": True, 
        "notificationsEnabled": True,
        "notificationTime": "20:00"  # Default 8 PM
    }
    createdAt: datetime = Field(default_factory=datetime.utcnow)

# Knowledge Graph Models
class KnowledgeNode(BaseModel):
    id: Optional[str] = None
    profileId: str
    entityType: str  # Person, Event, Emotion, Habit, Goal, Trigger, Place, Activity, Interest
    entityName: str
    properties: dict = {}  # Additional attributes
    confidence: float = 1.0  # Confidence score for this entity
    firstMentioned: datetime = Field(default_factory=datetime.utcnow)
    lastMentioned: datetime = Field(default_factory=datetime.utcnow)
    mentionCount: int = 1

class KnowledgeEdge(BaseModel):
    id: Optional[str] = None
    profileId: str
    sourceNodeId: str
    targetNodeId: str
    relationshipType: str  # experienced, caused, triggers, enjoys, avoids, related_to, works_at, lives_in
    properties: dict = {}
    confidence: float = 1.0
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    lastUpdated: datetime = Field(default_factory=datetime.utcnow)

class ExtractionLog(BaseModel):
    id: Optional[str] = None
    profileId: str
    conversationId: str
    messageContent: str
    extractedNodes: List[str] = []  # Node IDs
    extractedEdges: List[str] = []  # Edge IDs
    timestamp: datetime = Field(default_factory=datetime.utcnow)

# New models for onboarding and transcription
class OnboardingData(BaseModel):
    name: str
    intents: List[str] = []
    reflectionTime: str = "whenever"

class TranscriptionRequest(BaseModel):
    audio: str  # base64 encoded audio

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

async def retrieve_knowledge_context(profile_id: str, user_message: str) -> str:
    """Retrieve relevant context from knowledge graph based on user message"""
    try:
        # Get recent nodes and edges for this profile
        recent_nodes = await db.knowledge_nodes.find(
            {'profileId': profile_id}
        ).sort('lastMentioned', -1).limit(20).to_list(20)
        
        recent_edges = await db.knowledge_edges.find(
            {'profileId': profile_id}
        ).sort('lastUpdated', -1).limit(15).to_list(15)
        
        if not recent_nodes:
            return "No previous context available."
        
        # Build context string
        context_parts = []
        
        # Add key entities
        entities = [node for node in recent_nodes if node['mentionCount'] > 1][:10]
        if entities:
            entity_names = [f"{node['entityName']} ({node['entityType']})" for node in entities]
            context_parts.append(f"Key people/things mentioned: {', '.join(entity_names)}")
        
        # Add recent relationships
        if recent_edges:
            relationships = []
            for edge in recent_edges[:5]:
                source_node = next((n for n in recent_nodes if str(n['_id']) == edge['sourceNodeId']), None)
                target_node = next((n for n in recent_nodes if str(n['_id']) == edge['targetNodeId']), None)
                if source_node and target_node:
                    relationships.append(f"{source_node['entityName']} {edge['relationshipType']} {target_node['entityName']}")
            
            if relationships:
                context_parts.append(f"Recent connections: {'; '.join(relationships)}")
        
        return " | ".join(context_parts) if context_parts else "No specific context available."
        
    except Exception as e:
        logger.error(f"Error retrieving knowledge context: {str(e)}")
        return "Context retrieval unavailable."

async def extract_knowledge_from_message(profile_id: str, conversation_id: str, user_message: str, ai_response: str):
    """Extract knowledge entities and relationships from conversation"""
    try:
        # Simple extraction logic - in production, you'd use NLP/LLM for this
        # For now, we'll do basic keyword extraction
        
        # Extract potential entities (simplified approach)
        import re
        
        # Look for people (capitalized names)
        people = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', user_message)
        people = [p for p in people if len(p.split()) <= 3 and p not in ['I', 'My', 'The', 'This', 'That']]
        
        # Look for emotions
        emotions = ['happy', 'sad', 'angry', 'excited', 'anxious', 'calm', 'frustrated', 'grateful', 'worried', 'content']
        found_emotions = [emotion for emotion in emotions if emotion in user_message.lower()]
        
        # Look for activities (basic patterns)
        activity_patterns = [r'went to (\w+)', r'had (\w+)', r'did (\w+)', r'played (\w+)', r'watched (\w+)']
        activities = []
        for pattern in activity_patterns:
            matches = re.findall(pattern, user_message.lower())
            activities.extend(matches)
        
        # Store extracted entities
        extracted_nodes = []
        extracted_edges = []
        
        # Store people
        for person in people[:3]:  # Limit to avoid spam
            node = await store_or_update_node(profile_id, 'Person', person)
            if node:
                extracted_nodes.append(str(node['_id']))
        
        # Store emotions
        for emotion in found_emotions[:2]:
            node = await store_or_update_node(profile_id, 'Emotion', emotion)
            if node:
                extracted_nodes.append(str(node['_id']))
        
        # Store activities
        for activity in activities[:2]:
            node = await store_or_update_node(profile_id, 'Activity', activity)
            if node:
                extracted_nodes.append(str(node['_id']))
        
        # Log the extraction
        extraction_log = ExtractionLog(
            profileId=profile_id,
            conversationId=conversation_id,
            messageContent=user_message,
            extractedNodes=extracted_nodes,
            extractedEdges=extracted_edges
        )
        await db.extraction_logs.insert_one(extraction_log.dict(exclude={'id'}))
        
    except Exception as e:
        logger.error(f"Error extracting knowledge: {str(e)}")

async def store_or_update_node(profile_id: str, entity_type: str, entity_name: str):
    """Store or update a knowledge node"""
    try:
        # Check if node already exists
        existing = await db.knowledge_nodes.find_one({
            'profileId': profile_id,
            'entityType': entity_type,
            'entityName': entity_name
        })
        
        if existing:
            # Update existing node
            await db.knowledge_nodes.update_one(
                {'_id': existing['_id']},
                {
                    '$set': {'lastMentioned': datetime.utcnow()},
                    '$inc': {'mentionCount': 1}
                }
            )
            return existing
        else:
            # Create new node
            node = KnowledgeNode(
                profileId=profile_id,
                entityType=entity_type,
                entityName=entity_name
            )
            result = await db.knowledge_nodes.insert_one(node.dict(exclude={'id'}))
            return await db.knowledge_nodes.find_one({'_id': result.inserted_id})
            
    except Exception as e:
        logger.error(f"Error storing knowledge node: {str(e)}")
        return None

try:
    from litellm import acompletion
except ImportError:
    acompletion = None

# Get API Key
OPENROUTER_API_KEY = os.environ.get('OPENROUTER_API_KEY')

# ==================== CRISIS DETECTION ====================

# Crisis keywords and phrases for detection
CRISIS_KEYWORDS = {
    'high_risk': [
        'suicide', 'kill myself', 'end my life', 'want to die', 'better off dead',
        'no reason to live', 'ending it', 'goodbye everyone', 'final goodbye',
        'self harm', 'hurt myself', 'cutting myself', 'overdose',
        'kill her', 'kill him', 'kill them', 'murder',
    ],
    'medium_risk': [
        'worthless', 'hopeless', 'nobody cares', 'no one would miss me',
        'tired of living', 'cant go on', "can't take it anymore", 'give up',
        'hate myself', 'dont want to be here', "don't want to wake up",
        'never be happy', 'pointless', 'burden to everyone',
    ],
    'low_risk': [
        'depressed', 'anxious', 'overwhelmed', 'stressed out', 'struggling',
        'feeling down', 'cant cope', 'falling apart', 'losing it',
    ]
}

# Crisis resources by region (US focused for now)
CRISIS_RESOURCES = {
    'us': {
        'suicide_hotline': '988 (Suicide & Crisis Lifeline)',
        'crisis_text': 'Text HOME to 741741',
        'emergency': '911',
        'website': 'https://988lifeline.org'
    },
    'international': {
        'website': 'https://findahelpline.com'
    }
}

def detect_crisis_level(message: str) -> dict:
    """
    Detect if a message contains crisis indicators.
    Returns: { level: 'none'|'low'|'medium'|'high', matched_keywords: [], response_type: str }
    """
    message_lower = message.lower()
    result = {
        'level': 'none',
        'matched_keywords': [],
        'requires_intervention': False,
        'show_resources': False
    }

    # Check high risk keywords first
    for keyword in CRISIS_KEYWORDS['high_risk']:
        if keyword in message_lower:
            result['level'] = 'high'
            result['matched_keywords'].append(keyword)
            result['requires_intervention'] = True
            result['show_resources'] = True

    if result['level'] == 'high':
        return result

    # Check medium risk keywords
    for keyword in CRISIS_KEYWORDS['medium_risk']:
        if keyword in message_lower:
            result['level'] = 'medium'
            result['matched_keywords'].append(keyword)
            result['show_resources'] = True

    if result['level'] == 'medium':
        return result

    # Check low risk keywords
    for keyword in CRISIS_KEYWORDS['low_risk']:
        if keyword in message_lower:
            result['level'] = 'low'
            result['matched_keywords'].append(keyword)

    return result

def get_crisis_response(crisis_level: str) -> str:
    """Get appropriate crisis response based on severity level"""
    if crisis_level == 'high':
        return """I hear that you're going through something really difficult right now. Your safety matters to me, and I want to make sure you get the support you deserve.

If you're in immediate danger, please reach out to:
- 988 (Suicide & Crisis Lifeline) - Call or text anytime
- Text HOME to 741741 (Crisis Text Line)
- 911 for emergencies

You're not alone in this. Would you like to talk about what's happening?"""

    elif crisis_level == 'medium':
        return """I can hear that you're really struggling right now, and I want you to know that what you're feeling matters. These feelings can be overwhelming, but they don't have to be faced alone.

If you need to talk to someone right now:
- 988 Suicide & Crisis Lifeline (call or text 988)
- Crisis Text Line (text HOME to 741741)

I'm here to listen. Would you like to tell me more about what's going on?"""

    else:  # low
        return None  # AI will handle normally but with extra care

async def log_crisis_event(profile_id: str, message: str, crisis_level: str, matched_keywords: list):
    """Log crisis detection for safety monitoring"""
    try:
        await db.crisis_logs.insert_one({
            'profileId': profile_id,
            'message': message[:500],  # Truncate for privacy
            'crisisLevel': crisis_level,
            'matchedKeywords': matched_keywords,
            'timestamp': datetime.utcnow(),
            'handled': True
        })
    except Exception as e:
        logger.error(f"Error logging crisis event: {str(e)}")

# Crisis-aware system prompt addition
CRISIS_SAFETY_PROMPT = """
CRITICAL SAFETY GUIDELINES:
- If the user expresses thoughts of self-harm, suicide, or harming others, your TOP PRIORITY is their safety
- Acknowledge their feelings with compassion and without judgment
- Gently encourage them to reach out to professional support (988 Lifeline, Crisis Text Line)
- Do NOT minimize their feelings or offer toxic positivity
- Do NOT promise confidentiality if they're in danger
- Keep the conversation open and supportive
- Ask if they're safe right now
- Never suggest self-harm is a solution to anything
"""

# ...

async def get_ai_response(conversation_id: str, user_message: str, conversation_type: str):
    """Get AI response using LiteLLM with enhanced personality and memory"""
    try:
        if not acompletion:
            return "AI service unavailable (LiteLLM not installed)."

        # Get profile for knowledge graph context
        profile = await get_or_create_profile()

        # Retrieve relevant context from knowledge graph
        context = await retrieve_knowledge_context(profile['id'], user_message)

        # Get personality-specific tone guidelines
        personality_type = profile.get('personalityType', 'The Balanced')
        personality_tone = get_personality_tone(personality_type)

        # Get recent conversation history for continuity
        conversation = await db.conversations.find_one({'_id': ObjectId(conversation_id)})
        recent_messages = conversation.get('messages', [])[-6:] if conversation else []

        # Build memory context from recent messages
        memory_context = ""
        if recent_messages:
            user_topics = [m['content'][:100] for m in recent_messages if m['role'] == 'user']
            if user_topics:
                memory_context = f"\n\nRecent topics they've shared: {'; '.join(user_topics[-3:])}"

        # Create enhanced system message based on type
        user_name = profile.get('name', 'friend')

        if conversation_type == "journal":
            system_message = f"""You are MindfulMe, {user_name}'s warm and compassionate journaling companion.
            You're like a thoughtful friend who remembers everything they share.

            About {user_name}:
            - Personality: {personality_type}
            - What you know about them: {context}
            {memory_context}

            Your communication style (adapted for {personality_type}):
            {personality_tone}

            Guidelines:
            - NATURALLY reference things they've told you before ("Last time you mentioned...", "You said...")
            - Ask ONE thoughtful follow-up question that shows you're listening
            - Validate their emotions without being preachy
            - Keep responses SHORT (2-3 sentences max)
            - Sound like a caring friend, not a therapist or app

            {CRISIS_SAFETY_PROMPT}"""

        elif conversation_type == "personality_test":
            system_message = f"""You are MindfulMe's Personality Assessor.
            Your goal is to determine the user's personality type through conversation.

            Guidelines:
            - Ask ONE question at a time
            - Provide 4 distinct options (A, B, C, D) but encourage elaboration
            - Analyze their words to understand: Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism
            - Be warm and curious, not clinical
            - Don't reveal what traits you're assessing

            Context: {context}"""

        else:  # chat/talk
            system_message = f"""You are MindfulMe, {user_name}'s personal mental wellness companion.
            You're the friend who truly knows them and remembers everything important.

            About {user_name}:
            - Personality: {personality_type}
            - What you know about them: {context}
            {memory_context}

            Your communication style (adapted for {personality_type}):
            {personality_tone}

            CRITICAL - Memory behavior:
            - ALWAYS reference past conversations naturally ("You mentioned...", "Last time...", "I remember you said...")
            - Connect current feelings to patterns you've noticed
            - Ask follow-up questions about things they've shared before
            - Show you remember names, events, feelings they've mentioned

            Guidelines:
            - Keep responses SHORT (2-4 sentences)
            - Sound like a caring friend, not an AI
            - Ask one thoughtful follow-up question
            - Validate emotions without being preachy
            - Match their energy - if they're casual, be casual
            - If they seem stressed, be extra gentle

            {CRISIS_SAFETY_PROMPT}"""
        
        # Select model based on conversation type
        model = "openrouter/anthropic/claude-4.5-sonnet"
        if conversation_type == "personality_test":
             model = "openrouter/moonshotai/kimi-k2-thinking"

        # Call LLM
        response = await acompletion(
            model=model, 
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ],
            api_key=OPENROUTER_API_KEY
        )
        
        ai_text = response.choices[0].message.content
        
        # Extract knowledge in background
        asyncio.create_task(extract_knowledge_from_message(
            profile['id'], 
            conversation_id, 
            user_message, 
            ai_text
        ))
        
        return ai_text
        
    except Exception as e:
        logger.error(f"Error getting AI response: {str(e)}")
        # Graceful fallback if no key
        if "api_key" in str(e).lower():
            return "I'm having trouble connecting to my brain right now (API Key missing). But I'm listening!"
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
async def update_profile(profile_data: dict):
    profile = await get_or_create_profile()
    await db.profiles.update_one(
        {'_id': ObjectId(profile['id'])},
        {'$set': profile_data}
    )
    return await get_or_create_profile()

# Personality test endpoint
@api_router.post("/personality-test")
async def submit_personality_test(answers: dict):
    """
    Process personality test answers and return personality type
    Simple Big Five-inspired personality test
    """
    profile = await get_or_create_profile()
    
    # Calculate traits based on answers (simplified scoring)
    traits = {
        "openness": answers.get("openness", 50),
        "conscientiousness": answers.get("conscientiousness", 50),
        "extraversion": answers.get("extraversion", 50),
        "agreeableness": answers.get("agreeableness", 50),
        "neuroticism": answers.get("neuroticism", 50)
    }
    
    # Determine personality type based on dominant traits
    personality_type = determine_personality_type(traits)
    
    await db.profiles.update_one(
        {'_id': ObjectId(profile['id'])},
        {'$set': {
            'personalityType': personality_type,
            'personalityTraits': traits
        }}
    )
    
    return {
        "personalityType": personality_type,
        "traits": traits,
        "description": get_personality_description(personality_type)
    }

def determine_personality_type(traits: dict) -> str:
    """Determine personality type based on trait scores"""
    # Simplified personality typing
    if traits["extraversion"] > 60 and traits["openness"] > 60:
        return "The Enthusiast"
    elif traits["conscientiousness"] > 60 and traits["agreeableness"] > 60:
        return "The Supporter"
    elif traits["openness"] > 60 and traits["conscientiousness"] > 60:
        return "The Thinker"
    elif traits["extraversion"] > 60 and traits["agreeableness"] > 60:
        return "The Socializer"
    elif traits["neuroticism"] < 40 and traits["conscientiousness"] > 60:
        return "The Achiever"
    else:
        return "The Balanced"

def get_personality_description(personality_type: str) -> str:
    """Get description for personality type"""
    descriptions = {
        "The Enthusiast": "You're energetic, creative, and always seeking new experiences. You thrive on variety and bringing fresh ideas to life.",
        "The Supporter": "You're reliable, caring, and deeply value harmony. You excel at creating supportive environments and helping others succeed.",
        "The Thinker": "You're analytical, curious, and love deep diving into complex topics. You bring careful consideration to everything you do.",
        "The Socializer": "You're warm, outgoing, and naturally connect with others. You bring people together and create positive social experiences.",
        "The Achiever": "You're driven, organized, and thrive on accomplishing goals. You bring structure and determination to your pursuits.",
        "The Balanced": "You have a well-rounded personality with strengths across multiple areas. You adapt well to different situations."
    }
    return descriptions.get(personality_type, "A unique individual with their own special strengths.")

def get_personality_tone(personality_type: str) -> str:
    """Get communication tone guidelines based on personality type"""
    tones = {
        "The Enthusiast": """- Be energetic and match their enthusiasm
- Explore possibilities and new perspectives
- Use vivid language and celebrate creativity
- Ask "what if" questions to spark imagination
- Be spontaneous and playful in responses""",

        "The Supporter": """- Be extra warm, gentle, and validating
- Focus on feelings and relationships
- Emphasize connection and understanding
- Use nurturing language ("I hear you", "That sounds hard")
- Ask about how situations affect their relationships""",

        "The Thinker": """- Be more analytical and explore the "why"
- Offer frameworks for understanding feelings
- Ask questions that invite deeper reflection
- Use precise language and clear logic
- Help them understand patterns and connections""",

        "The Socializer": """- Be warm, friendly, and conversational
- Share in their excitement about people and events
- Ask about social dynamics and relationships
- Use expressive language and show genuine interest
- Connect their feelings to their social world""",

        "The Achiever": """- Be direct and action-oriented
- Help them find solutions and next steps
- Acknowledge their accomplishments
- Frame emotions in terms of growth and progress
- Ask about goals and what they want to achieve""",

        "The Balanced": """- Adapt your tone to match their energy
- Balance emotional support with practical insight
- Be flexible in your approach
- Mirror their communication style
- Provide a mix of validation and gentle guidance"""
    }
    return tones.get(personality_type, tones["The Balanced"])

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

        # Check for crisis indicators
        crisis_check = detect_crisis_level(data.content)
        profile = await get_or_create_profile()

        if crisis_check['level'] in ['high', 'medium']:
            # Log crisis event for safety
            asyncio.create_task(log_crisis_event(
                profile['id'],
                data.content,
                crisis_check['level'],
                crisis_check['matched_keywords']
            ))

            # For high-risk messages, provide immediate crisis response
            if crisis_check['level'] == 'high':
                ai_response_text = get_crisis_response('high')
            else:
                # For medium risk, get AI response but it will be crisis-aware
                ai_response_text = await get_ai_response(
                    data.conversationId,
                    data.content,
                    conversation['type']
                )
                # Prepend supportive message with resources
                crisis_preface = get_crisis_response('medium')
                ai_response_text = f"{crisis_preface}\n\n{ai_response_text}"
        else:
            # Normal response path
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

# Crisis resources endpoint
# Session feedback endpoint
class SessionFeedback(BaseModel):
    conversationId: str
    feedback: str  # 'helpful', 'neutral', 'skip'
    mood: Optional[str] = None
    sessionDuration: int = 0
    messageCount: int = 0

@api_router.post("/session-feedback")
async def submit_session_feedback(data: SessionFeedback):
    """Store session feedback for analytics and improvement"""
    try:
        feedback_doc = {
            'conversationId': data.conversationId,
            'feedback': data.feedback,
            'mood': data.mood,
            'sessionDuration': data.sessionDuration,
            'messageCount': data.messageCount,
            'timestamp': datetime.utcnow()
        }
        await db.session_feedback.insert_one(feedback_doc)

        # Also log mood if provided
        if data.mood:
            mood_intensity = {'amazing': 9, 'happy': 8, 'calm': 7, 'okay': 5, 'sad': 3, 'anxious': 2}.get(data.mood, 5)
            mood_log = MoodLog(
                mood=data.mood,
                intensity=mood_intensity,
                note=f"Post-session ({data.feedback})"
            )
            await db.moods.insert_one(mood_log.dict(exclude={'id'}))

        return {"status": "success", "message": "Feedback recorded"}
    except Exception as e:
        logger.error(f"Session feedback error: {str(e)}")
        return {"status": "error", "message": str(e)}

@api_router.get("/crisis-resources")
async def get_crisis_resources():
    """Get crisis intervention resources"""
    return {
        "resources": CRISIS_RESOURCES,
        "message": "If you're experiencing a crisis, please reach out to one of these resources. You're not alone.",
        "hotlines": [
            {
                "name": "988 Suicide & Crisis Lifeline",
                "number": "988",
                "description": "Free, confidential support 24/7",
                "type": "call_or_text"
            },
            {
                "name": "Crisis Text Line",
                "number": "741741",
                "description": "Text HOME to start",
                "type": "text"
            },
            {
                "name": "Emergency Services",
                "number": "911",
                "description": "For immediate emergencies",
                "type": "call"
            },
            {
                "name": "SAMHSA National Helpline",
                "number": "1-800-662-4357",
                "description": "Mental health and substance abuse",
                "type": "call"
            }
        ]
    }

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

# Knowledge Graph endpoints
@api_router.get("/knowledge/nodes")
async def get_knowledge_nodes(limit: int = 50):
    """Get knowledge nodes for the user"""
    profile = await get_or_create_profile()
    nodes = await db.knowledge_nodes.find(
        {'profileId': profile['id']}
    ).sort('lastMentioned', -1).limit(limit).to_list(limit)
    return [serialize_doc(node) for node in nodes]

@api_router.get("/knowledge/edges")
async def get_knowledge_edges(limit: int = 50):
    """Get knowledge edges for the user"""
    profile = await get_or_create_profile()
    edges = await db.knowledge_edges.find(
        {'profileId': profile['id']}
    ).sort('lastUpdated', -1).limit(limit).to_list(limit)
    return [serialize_doc(edge) for edge in edges]

@api_router.get("/knowledge/graph")
async def get_knowledge_graph():
    """Get complete knowledge graph for visualization"""
    profile = await get_or_create_profile()
    
    # Get nodes and edges
    nodes = await db.knowledge_nodes.find(
        {'profileId': profile['id']}
    ).sort('mentionCount', -1).limit(100).to_list(100)
    
    edges = await db.knowledge_edges.find(
        {'profileId': profile['id']}
    ).limit(100).to_list(100)
    
    return {
        "nodes": [serialize_doc(node) for node in nodes],
        "edges": [serialize_doc(edge) for edge in edges]
    }

@api_router.get("/knowledge/stats")
async def get_knowledge_stats():
    """Get knowledge graph statistics"""
    profile = await get_or_create_profile()

    # Count nodes by type
    node_pipeline = [
        {"$match": {"profileId": profile['id']}},
        {"$group": {"_id": "$entityType", "count": {"$sum": 1}}}
    ]
    node_stats = await db.knowledge_nodes.aggregate(node_pipeline).to_list(100)

    # Count edges by type
    edge_pipeline = [
        {"$match": {"profileId": profile['id']}},
        {"$group": {"_id": "$relationshipType", "count": {"$sum": 1}}}
    ]
    edge_stats = await db.knowledge_edges.aggregate(edge_pipeline).to_list(100)

    # Total counts
    total_nodes = await db.knowledge_nodes.count_documents({'profileId': profile['id']})
    total_edges = await db.knowledge_edges.count_documents({'profileId': profile['id']})

    return {
        "totalNodes": total_nodes,
        "totalEdges": total_edges,
        "nodesByType": {stat['_id']: stat['count'] for stat in node_stats},
        "edgesByType": {stat['_id']: stat['count'] for stat in edge_stats}
    }

# ==================== NEW ENDPOINTS ====================

# Onboarding endpoint
@api_router.post("/onboarding")
async def save_onboarding(data: OnboardingData):
    """Save onboarding data and create/update profile"""
    profile = await get_or_create_profile()

    # Update profile with onboarding data
    await db.profiles.update_one(
        {'_id': ObjectId(profile['id'])},
        {'$set': {
            'name': data.name,
            'intents': data.intents,
            'reflectionTime': data.reflectionTime,
            'onboardingComplete': True
        }}
    )

    return await get_or_create_profile()

# Transcription endpoint using WhisperX (preferred) or OpenAI API (fallback)
@api_router.post("/transcribe")
async def transcribe_audio(data: TranscriptionRequest):
    """Transcribe audio using WhisperX (local) or OpenAI Whisper API (cloud fallback)"""

    # Check if any transcription service is available
    if not whisperx_available and not openai_client:
        raise HTTPException(status_code=503, detail="No transcription service available")

    try:
        # Decode base64 audio
        audio_bytes = base64.b64decode(data.audio)

        # Write to temp file
        with tempfile.NamedTemporaryFile(suffix=".m4a", delete=False) as temp_file:
            temp_file.write(audio_bytes)
            temp_path = temp_file.name

        try:
            transcript_text = ""

            # Try WhisperX first (local, free, more accurate timestamps)
            if whisperx_available and whisperx_model:
                try:
                    logger.info("Using WhisperX for transcription")
                    # Load and transcribe audio
                    audio = whisperx.load_audio(temp_path)
                    result = whisperx_model.transcribe(audio, batch_size=16)

                    # Extract text from segments
                    if result and "segments" in result:
                        transcript_text = " ".join([seg["text"] for seg in result["segments"]])
                    elif result and "text" in result:
                        transcript_text = result["text"]

                    logger.info(f"WhisperX transcription successful: {len(transcript_text)} chars")

                except Exception as wx_error:
                    logger.warning(f"WhisperX failed, falling back to OpenAI: {wx_error}")
                    transcript_text = ""  # Reset to try OpenAI

            # Fallback to OpenAI Whisper API
            if not transcript_text and openai_client:
                logger.info("Using OpenAI Whisper API for transcription")
                with open(temp_path, "rb") as audio_file:
                    transcript = await openai_client.audio.transcriptions.create(
                        model="whisper-1",
                        file=audio_file,
                        response_format="text"
                    )
                transcript_text = transcript.strip() if isinstance(transcript, str) else str(transcript)

            if not transcript_text:
                raise HTTPException(status_code=500, detail="Transcription produced no text")

            return {"text": transcript_text.strip(), "engine": "whisperx" if whisperx_available else "openai"}

        finally:
            # Clean up temp file
            import os as os_module
            os_module.unlink(temp_path)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Transcription error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

# Daily insight generation
@api_router.get("/daily-insight")
async def get_daily_insight():
    """Generate personalized daily insight from knowledge graph"""
    try:
        profile = await get_or_create_profile()

        # Get recent knowledge context
        recent_nodes = await db.knowledge_nodes.find(
            {'profileId': profile['id']}
        ).sort('lastMentioned', -1).limit(15).to_list(15)

        # Get recent moods
        recent_moods = await db.moods.find().sort('timestamp', -1).limit(7).to_list(7)

        # Get recent conversations for context
        recent_convos = await db.conversations.find().sort('updatedAt', -1).limit(3).to_list(3)

        # Build context for insight generation
        context_parts = []

        if recent_nodes:
            people = [n['entityName'] for n in recent_nodes if n['entityType'] == 'Person'][:3]
            emotions = [n['entityName'] for n in recent_nodes if n['entityType'] == 'Emotion'][:3]
            activities = [n['entityName'] for n in recent_nodes if n['entityType'] == 'Activity'][:3]

            if people:
                context_parts.append(f"Important people: {', '.join(people)}")
            if emotions:
                context_parts.append(f"Recent emotions: {', '.join(emotions)}")
            if activities:
                context_parts.append(f"Recent activities: {', '.join(activities)}")

        if recent_moods:
            mood_summary = ", ".join([m['mood'] for m in recent_moods[:3]])
            context_parts.append(f"Recent mood pattern: {mood_summary}")

        # Generate insight using AI
        if acompletion and context_parts:
            try:
                context = " | ".join(context_parts)
                response = await acompletion(
                    model="openrouter/anthropic/claude-4.5-sonnet",
                    messages=[
                        {
                            "role": "system",
                            "content": """You are MindfulMe, generating a brief, personalized daily insight.
                            Create ONE short observation (max 25 words) that:
                            - References something specific the user has shared
                            - Shows you truly understand and remember them
                            - Is warm, supportive, and actionable
                            - Feels like a thoughtful friend noticing a pattern

                            Examples:
                            - "I noticed you feel calmer on days you journal in the morning. It's 9am - perfect time?"
                            - "You've mentioned Sarah three times this week. Want to explore that?"
                            - "Your mood seems to lift on days you exercise. Today could be a good day for that."

                            Do NOT use generic advice. Be specific to this person."""
                        },
                        {
                            "role": "user",
                            "content": f"User context: {context}\n\nGenerate a personalized insight:"
                        }
                    ],
                    api_key=OPENROUTER_API_KEY,
                    max_tokens=100
                )
                insight = response.choices[0].message.content.strip()
                return {"insight": insight}
            except Exception as e:
                logger.error(f"AI insight generation failed: {e}")

        # Fallback insights based on available data
        hour = datetime.utcnow().hour
        if profile.get('currentStreak', 0) > 3:
            return {"insight": f"You're on a {profile['currentStreak']}-day streak! Consistency is building real self-awareness."}
        elif hour < 12:
            return {"insight": "Morning reflection sets the tone for your day. What's one thing you're grateful for?"}
        elif hour < 17:
            return {"insight": "Taking a moment to check in with yourself shows real self-care. I'm listening."}
        else:
            return {"insight": "Evening is a great time to reflect. How did today's experiences shape you?"}

    except Exception as e:
        logger.error(f"Daily insight error: {str(e)}")
        return {"insight": "I'm here whenever you need to talk. What's on your mind today?"}

# AI-generated insights endpoint
@api_router.get("/insights")
async def get_ai_insights():
    """Get AI-generated pattern insights from user data"""
    try:
        profile = await get_or_create_profile()
        insights = []

        # Get mood statistics
        mood_stats = await db.moods.find().sort('timestamp', -1).limit(30).to_list(30)

        # Get knowledge nodes for pattern analysis
        knowledge_nodes = await db.knowledge_nodes.find(
            {'profileId': profile['id']}
        ).sort('mentionCount', -1).limit(20).to_list(20)

        # Pattern 1: Streak celebration
        if profile.get('currentStreak', 0) >= 7:
            insights.append({
                "insight": f"Your {profile['currentStreak']}-day streak is your longest yet! You're building a powerful habit.",
                "type": "celebration"
            })
        elif profile.get('currentStreak', 0) >= 3:
            insights.append({
                "insight": f"3 days in a row - you're building momentum! Keep it going.",
                "type": "celebration"
            })

        # Pattern 2: Frequently mentioned people/topics
        frequent_people = [n for n in knowledge_nodes if n['entityType'] == 'Person' and n['mentionCount'] >= 2]
        if frequent_people:
            top_person = frequent_people[0]
            insights.append({
                "insight": f"You mention {top_person['entityName']} often. They seem important to you - want to explore that relationship?",
                "type": "pattern"
            })

        # Pattern 3: Emotion patterns
        emotion_nodes = [n for n in knowledge_nodes if n['entityType'] == 'Emotion']
        if emotion_nodes:
            common_emotion = emotion_nodes[0]['entityName']
            insights.append({
                "insight": f"'{common_emotion.capitalize()}' comes up frequently in our conversations. Let's understand what triggers it.",
                "type": "correlation"
            })

        # Pattern 4: Mood trend analysis
        if mood_stats and len(mood_stats) >= 5:
            positive_moods = sum(1 for m in mood_stats if m.get('mood') in ['great', 'good', 'happy', 'calm'])
            if positive_moods > len(mood_stats) / 2:
                insights.append({
                    "insight": "Your mood has been trending positive lately. What's working well for you?",
                    "type": "pattern"
                })
            else:
                insights.append({
                    "insight": "I've noticed some harder days recently. Remember - talking about it helps. I'm here.",
                    "type": "correlation"
                })

        # Ensure at least one insight
        if not insights:
            insights.append({
                "insight": "Keep sharing - the more we talk, the better I understand you and can offer meaningful insights.",
                "type": "pattern"
            })

        return {"insights": insights[:4]}  # Return max 4 insights

    except Exception as e:
        logger.error(f"Insights generation error: {str(e)}")
        return {"insights": [{"insight": "Continue your journey - insights will emerge as we learn more about you.", "type": "pattern"}]}

# Contextual journal prompt
@api_router.get("/journal-prompt")
async def get_journal_prompt():
    """Generate contextual journal prompt based on user history"""
    try:
        profile = await get_or_create_profile()

        # Get recent context
        recent_nodes = await db.knowledge_nodes.find(
            {'profileId': profile['id']}
        ).sort('lastMentioned', -1).limit(10).to_list(10)

        recent_moods = await db.moods.find().sort('timestamp', -1).limit(3).to_list(3)

        # Build prompt context
        context_parts = []

        if recent_nodes:
            events = [n['entityName'] for n in recent_nodes if n['entityType'] in ['Event', 'Activity']][:2]
            people = [n['entityName'] for n in recent_nodes if n['entityType'] == 'Person'][:2]
            if events:
                context_parts.append(f"Recent events: {', '.join(events)}")
            if people:
                context_parts.append(f"Important people: {', '.join(people)}")

        if recent_moods:
            mood = recent_moods[0].get('mood', 'okay')
            context_parts.append(f"Recent mood: {mood}")

        # Generate prompt using DeepSeek V3 (more cost effective for simple generation)
        if acompletion and context_parts:
            try:
                context = " | ".join(context_parts)
                response = await acompletion(
                    model="openrouter/deepseek/deepseek-chat",  # DeepSeek V3
                    messages=[
                        {
                            "role": "system",
                            "content": """Generate ONE short journal prompt (max 15 words) that:
                            - References something specific from the context
                            - Is open-ended and invites reflection
                            - Feels warm and personally relevant

                            Examples:
                            - "How did your meeting with Sarah go?"
                            - "What's one thing that made you smile today?"
                            - "You've had a tough week. What's one small win?"

                            Just output the prompt, no explanation."""
                        },
                        {"role": "user", "content": f"Context: {context}"}
                    ],
                    api_key=OPENROUTER_API_KEY,
                    max_tokens=50
                )
                prompt = response.choices[0].message.content.strip()
                return {"prompt": prompt}
            except Exception as e:
                logger.error(f"Journal prompt AI error: {e}")

        # Fallback prompts based on time of day
        hour = datetime.utcnow().hour
        if hour < 12:
            prompts = [
                "What are you looking forward to today?",
                "How are you feeling this morning?",
                "What would make today a good day?"
            ]
        elif hour < 17:
            prompts = [
                "What's been on your mind today?",
                "Describe a moment from today that stands out.",
                "What's something you're grateful for right now?"
            ]
        else:
            prompts = [
                "How would you describe your day in three words?",
                "What did you learn about yourself today?",
                "What's something you want to remember from today?"
            ]

        import random
        return {"prompt": random.choice(prompts)}

    except Exception as e:
        logger.error(f"Journal prompt error: {str(e)}")
        return {"prompt": "What's on your mind today?"}

# Reflection cards generation (uses DeepSeek V3)
class ReflectionRequest(BaseModel):
    journalContent: str
    conversationHistory: List[dict] = []

@api_router.post("/reflection-cards")
async def generate_reflection_cards(data: ReflectionRequest):
    """Generate reflection cards based on journal entry using DeepSeek V3"""
    try:
        if not acompletion:
            return {
                "cards": [
                    {"type": "theme", "title": "Theme", "content": "Keep journaling to discover your themes."},
                    {"type": "tone", "title": "Emotional Tone", "content": "Your feelings are valid."},
                    {"type": "suggestion", "title": "Suggestion", "content": "Try to journal again tomorrow."}
                ]
            }

        # Build conversation context
        conversation_text = data.journalContent
        if data.conversationHistory:
            messages_text = [m.get('content', '') for m in data.conversationHistory if m.get('role') == 'user']
            conversation_text = ' | '.join(messages_text[-5:]) + ' | ' + data.journalContent

        response = await acompletion(
            model="openrouter/deepseek/deepseek-chat",  # DeepSeek V3
            messages=[
                {
                    "role": "system",
                    "content": """Analyze this journal entry and generate exactly 3 reflection cards in JSON format.

                    Return ONLY valid JSON with this structure:
                    {
                        "cards": [
                            {"type": "theme", "title": "Key Theme", "content": "1-2 sentence insight about the main theme"},
                            {"type": "tone", "title": "Emotional Tone", "content": "1-2 sentence observation about emotional patterns"},
                            {"type": "suggestion", "title": "Reflection Prompt", "content": "1 thoughtful question or gentle suggestion"}
                        ]
                    }

                    Guidelines:
                    - Be warm and supportive, not clinical
                    - Identify patterns gently, not judgmentally
                    - Make suggestions feel like invitations, not prescriptions
                    - Keep each content under 50 words"""
                },
                {"role": "user", "content": f"Journal entry: {conversation_text}"}
            ],
            api_key=OPENROUTER_API_KEY,
            max_tokens=300
        )

        try:
            result_text = response.choices[0].message.content.strip()
            # Try to parse JSON from the response
            if result_text.startswith('```json'):
                result_text = result_text[7:]
            if result_text.startswith('```'):
                result_text = result_text[3:]
            if result_text.endswith('```'):
                result_text = result_text[:-3]

            result = json.loads(result_text.strip())
            return result
        except json.JSONDecodeError:
            logger.error(f"Failed to parse reflection cards JSON: {result_text}")
            # Return default cards
            return {
                "cards": [
                    {"type": "theme", "title": "Your Journey", "content": "Every journal entry is a step toward self-understanding."},
                    {"type": "tone", "title": "Emotional Awareness", "content": "Taking time to reflect shows self-compassion."},
                    {"type": "suggestion", "title": "Next Step", "content": "What would you like to explore more deeply?"}
                ]
            }

    except Exception as e:
        logger.error(f"Reflection cards error: {str(e)}")
        return {
            "cards": [
                {"type": "theme", "title": "Your Journey", "content": "Every journal entry is a step toward self-understanding."},
                {"type": "tone", "title": "Emotional Awareness", "content": "Taking time to reflect shows self-compassion."},
                {"type": "suggestion", "title": "Next Step", "content": "What would you like to explore more deeply?"}
            ]
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
