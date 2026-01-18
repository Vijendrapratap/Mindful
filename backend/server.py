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
from emergentintegrations.llm.chat import LlmChat, UserMessage
import asyncio
import json

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
    name: Optional[str] = None
    age: Optional[int] = None
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

async def get_ai_response(conversation_id: str, user_message: str, conversation_type: str):
    """Get AI response using Claude via emergentintegrations"""
    try:
        # Get profile for knowledge graph context
        profile = await get_or_create_profile()
        
        # Retrieve relevant context from knowledge graph
        context = await retrieve_knowledge_context(profile['id'], user_message)
        
        # Create system message based on type
        if conversation_type == "journal":
            system_message = f"""You are MindfulMe, a warm and compassionate journaling companion. 
            Your role is to help users reflect on their day through natural conversation.
            
            Guidelines:
            - Be empathetic, warm, and non-judgmental
            - Ask thoughtful follow-up questions to help users explore their thoughts
            - Don't just say "that's good" - dig deeper with curiosity
            - Keep responses concise (2-3 sentences) to maintain conversational flow
            - Validate emotions and experiences
            - Help users process their day, not solve their problems
            - Use conversational language, like a caring friend
            
            Context about the user (from previous conversations):
            {context}
            
            Use this context naturally when relevant, but don't force it into every response.
            
            Example responses:
            - "That sounds like it was challenging. What made it particularly difficult for you?"
            - "I hear excitement in what you're sharing! What part of that experience felt most meaningful?"
            - "It seems like that really affected you. How are you feeling about it now?\""""
        else:  # chat
            system_message = f"""You are MindfulMe, a supportive mental wellness companion and friend.
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
            
            Context about the user (from previous conversations):
            {context}
            
            Use this context to show you remember them and care about their journey.
            Reference past events naturally when appropriate.
            
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
        
        # Extract knowledge in background (don't wait for it)
        asyncio.create_task(extract_knowledge_from_message(
            profile['id'], 
            conversation_id, 
            user_message, 
            response
        ))
        
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
