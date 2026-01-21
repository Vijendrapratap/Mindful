#!/usr/bin/env python3
"""
MindfulMe Backend API Testing Suite
Tests all backend endpoints for the MindfulMe mental wellness app
"""

import requests
import json
from datetime import datetime, timedelta
import time
import sys
import os

# Get backend URL from environment variable or use localhost default
BACKEND_URL = os.environ.get('BACKEND_URL', 'http://localhost:8001/api')

class MindfulMeAPITester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.session = requests.Session()
        self.test_results = []
        self.conversation_id = None
        self.journal_conversation_id = None
        
    def log_test(self, test_name, success, message, details=None):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if details and not success:
            print(f"   Details: {details}")
    
    def test_api_health(self):
        """Test basic API connectivity"""
        try:
            response = self.session.get(f"{self.base_url}/")
            if response.status_code == 200:
                data = response.json()
                if data.get("message") == "MindfulMe API" and data.get("status") == "running":
                    self.log_test("API Health Check", True, "API is running and accessible")
                    return True
                else:
                    self.log_test("API Health Check", False, "API response format incorrect", data)
                    return False
            else:
                self.log_test("API Health Check", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("API Health Check", False, f"Connection failed: {str(e)}")
            return False
    
    def test_profile_management(self):
        """Test profile creation and management"""
        print("\n=== Testing Profile Management ===")
        
        # Test GET /api/profile - should return or create profile
        try:
            response = self.session.get(f"{self.base_url}/profile")
            if response.status_code == 200:
                profile = response.json()
                required_fields = ['id', 'currentStreak', 'longestStreak', 'totalJournalDays', 'preferences']
                missing_fields = [field for field in required_fields if field not in profile]
                
                if not missing_fields:
                    self.log_test("GET /profile", True, "Profile retrieved/created successfully", profile)
                else:
                    self.log_test("GET /profile", False, f"Missing required fields: {missing_fields}", profile)
            else:
                self.log_test("GET /profile", False, f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_test("GET /profile", False, f"Request failed: {str(e)}")
        
        # Test PUT /api/profile - should update preferences
        try:
            new_preferences = {
                "voiceEnabled": False,
                "notificationsEnabled": True,
                "theme": "dark"
            }
            response = self.session.put(f"{self.base_url}/profile", json=new_preferences)
            if response.status_code == 200:
                updated_profile = response.json()
                if updated_profile.get('preferences') == new_preferences:
                    self.log_test("PUT /profile", True, "Profile preferences updated successfully")
                else:
                    self.log_test("PUT /profile", False, "Preferences not updated correctly", updated_profile)
            else:
                self.log_test("PUT /profile", False, f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_test("PUT /profile", False, f"Request failed: {str(e)}")
    
    def test_conversations(self):
        """Test conversation management and AI responses"""
        print("\n=== Testing Conversations ===")
        
        # Test POST /api/conversations - create chat conversation
        try:
            chat_data = {"type": "chat"}
            response = self.session.post(f"{self.base_url}/conversations", json=chat_data)
            if response.status_code == 200:
                conversation = response.json()
                if conversation.get('type') == 'chat' and 'id' in conversation:
                    self.conversation_id = conversation['id']
                    self.log_test("POST /conversations (chat)", True, "Chat conversation created successfully")
                else:
                    self.log_test("POST /conversations (chat)", False, "Invalid conversation format", conversation)
            else:
                self.log_test("POST /conversations (chat)", False, f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_test("POST /conversations (chat)", False, f"Request failed: {str(e)}")
        
        # Test POST /api/conversations - create journal conversation
        try:
            journal_data = {"type": "journal"}
            response = self.session.post(f"{self.base_url}/conversations", json=journal_data)
            if response.status_code == 200:
                conversation = response.json()
                if conversation.get('type') == 'journal' and 'id' in conversation:
                    self.journal_conversation_id = conversation['id']
                    self.log_test("POST /conversations (journal)", True, "Journal conversation created successfully")
                else:
                    self.log_test("POST /conversations (journal)", False, "Invalid conversation format", conversation)
            else:
                self.log_test("POST /conversations (journal)", False, f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_test("POST /conversations (journal)", False, f"Request failed: {str(e)}")
        
        # Test GET /api/conversations - list all conversations
        try:
            response = self.session.get(f"{self.base_url}/conversations")
            if response.status_code == 200:
                conversations = response.json()
                if isinstance(conversations, list) and len(conversations) >= 2:
                    self.log_test("GET /conversations", True, f"Retrieved {len(conversations)} conversations")
                else:
                    self.log_test("GET /conversations", False, "Expected at least 2 conversations", conversations)
            else:
                self.log_test("GET /conversations", False, f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_test("GET /conversations", False, f"Request failed: {str(e)}")
        
        # Test GET /api/conversations with type filter
        try:
            response = self.session.get(f"{self.base_url}/conversations?type=chat")
            if response.status_code == 200:
                conversations = response.json()
                if isinstance(conversations, list):
                    chat_conversations = [c for c in conversations if c.get('type') == 'chat']
                    if len(chat_conversations) == len(conversations):
                        self.log_test("GET /conversations?type=chat", True, f"Retrieved {len(conversations)} chat conversations")
                    else:
                        self.log_test("GET /conversations?type=chat", False, "Filter not working correctly", conversations)
                else:
                    self.log_test("GET /conversations?type=chat", False, "Invalid response format", conversations)
            else:
                self.log_test("GET /conversations?type=chat", False, f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_test("GET /conversations?type=chat", False, f"Request failed: {str(e)}")
        
        # Test GET /api/conversations/{id} - get specific conversation
        if self.conversation_id:
            try:
                response = self.session.get(f"{self.base_url}/conversations/{self.conversation_id}")
                if response.status_code == 200:
                    conversation = response.json()
                    if conversation.get('id') == self.conversation_id:
                        self.log_test("GET /conversations/{id}", True, "Retrieved specific conversation successfully")
                    else:
                        self.log_test("GET /conversations/{id}", False, "Wrong conversation returned", conversation)
                else:
                    self.log_test("GET /conversations/{id}", False, f"HTTP {response.status_code}", response.text)
            except Exception as e:
                self.log_test("GET /conversations/{id}", False, f"Request failed: {str(e)}")
        
        # Test POST /api/conversations/message - send message and get AI response
        if self.conversation_id:
            try:
                message_data = {
                    "conversationId": self.conversation_id,
                    "content": "I'm feeling a bit anxious about work today. How can I manage these feelings?",
                    "hasVoice": False
                }
                response = self.session.post(f"{self.base_url}/conversations/message", json=message_data)
                if response.status_code == 200:
                    updated_conversation = response.json()
                    messages = updated_conversation.get('messages', [])
                    
                    if len(messages) >= 2:
                        user_msg = messages[-2]
                        ai_msg = messages[-1]
                        
                        # Verify message structure
                        if (user_msg.get('role') == 'user' and 
                            ai_msg.get('role') == 'assistant' and
                            len(ai_msg.get('content', '')) > 10):
                            
                            # Check if AI response is empathetic and asks follow-up questions
                            ai_content = ai_msg['content'].lower()
                            empathy_indicators = ['understand', 'feel', 'sounds', 'hear', 'sorry', 'difficult']
                            question_indicators = ['?', 'what', 'how', 'why', 'tell me']
                            
                            has_empathy = any(indicator in ai_content for indicator in empathy_indicators)
                            has_questions = any(indicator in ai_content for indicator in question_indicators)
                            
                            if has_empathy and has_questions:
                                self.log_test("POST /conversations/message (AI Response Quality)", True, 
                                            "AI response is empathetic and asks follow-up questions")
                            else:
                                self.log_test("POST /conversations/message (AI Response Quality)", False, 
                                            f"AI response lacks empathy ({has_empathy}) or questions ({has_questions})", 
                                            ai_msg['content'])
                            
                            self.log_test("POST /conversations/message", True, "Message sent and AI response received")
                        else:
                            self.log_test("POST /conversations/message", False, "Invalid message structure", messages)
                    else:
                        self.log_test("POST /conversations/message", False, "Expected 2 messages in conversation", messages)
                else:
                    self.log_test("POST /conversations/message", False, f"HTTP {response.status_code}", response.text)
            except Exception as e:
                self.log_test("POST /conversations/message", False, f"Request failed: {str(e)}")
        
        # Test journal conversation with different system prompt
        if self.journal_conversation_id:
            try:
                message_data = {
                    "conversationId": self.journal_conversation_id,
                    "content": "Today was a really good day. I accomplished a lot at work and felt productive.",
                    "hasVoice": False
                }
                response = self.session.post(f"{self.base_url}/conversations/message", json=message_data)
                if response.status_code == 200:
                    updated_conversation = response.json()
                    messages = updated_conversation.get('messages', [])
                    
                    if len(messages) >= 2:
                        ai_msg = messages[-1]
                        ai_content = ai_msg.get('content', '').lower()
                        
                        # Check for journal-specific responses (deeper reflection)
                        reflection_indicators = ['what made', 'how did', 'tell me more', 'explore', 'reflect', 'what was it', 'particular moment', 'stands out', 'what about']
                        has_reflection = any(indicator in ai_content for indicator in reflection_indicators)
                        
                        if has_reflection:
                            self.log_test("Journal Conversation System Prompt", True, 
                                        "Journal conversation uses appropriate reflective prompts")
                        else:
                            self.log_test("Journal Conversation System Prompt", False, 
                                        "Journal conversation doesn't show reflective prompting", ai_content)
                    else:
                        self.log_test("Journal Conversation System Prompt", False, "No AI response in journal conversation")
                else:
                    self.log_test("Journal Conversation System Prompt", False, f"HTTP {response.status_code}", response.text)
            except Exception as e:
                self.log_test("Journal Conversation System Prompt", False, f"Request failed: {str(e)}")
    
    def test_journals(self):
        """Test journal entry management and streak calculation"""
        print("\n=== Testing Journals ===")
        
        today = datetime.now().strftime('%Y-%m-%d')
        # Use a future date to ensure we create a new journal entry
        future_date = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        
        # Test POST /api/journals - create journal entry
        if self.journal_conversation_id:
            try:
                journal_data = {
                    "date": future_date,
                    "conversationId": self.journal_conversation_id,
                    "mood": "excellent"
                }
                response = self.session.post(f"{self.base_url}/journals", json=journal_data)
                if response.status_code == 200:
                    journal = response.json()
                    if (journal.get('date') == future_date and 
                        journal.get('conversationId') == self.journal_conversation_id and
                        'id' in journal and
                        journal.get('mood') == 'excellent'):
                        self.log_test("POST /journals", True, "Journal entry created successfully")
                        
                        # Test streak update by checking profile
                        profile_response = self.session.get(f"{self.base_url}/profile")
                        if profile_response.status_code == 200:
                            profile = profile_response.json()
                            if profile.get('currentStreak', 0) >= 1:
                                self.log_test("Journal Streak Update", True, f"Streak updated to {profile['currentStreak']}")
                            else:
                                self.log_test("Journal Streak Update", False, "Streak not updated correctly", profile)
                    else:
                        self.log_test("POST /journals", False, "Invalid journal entry format", journal)
                else:
                    self.log_test("POST /journals", False, f"HTTP {response.status_code}", response.text)
            except Exception as e:
                self.log_test("POST /journals", False, f"Request failed: {str(e)}")
        
        # Test GET /api/journals - list journal entries
        try:
            response = self.session.get(f"{self.base_url}/journals")
            if response.status_code == 200:
                journals = response.json()
                if isinstance(journals, list) and len(journals) >= 1:
                    self.log_test("GET /journals", True, f"Retrieved {len(journals)} journal entries")
                else:
                    self.log_test("GET /journals", False, "Expected at least 1 journal entry", journals)
            else:
                self.log_test("GET /journals", False, f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_test("GET /journals", False, f"Request failed: {str(e)}")
        
        # Test GET /api/journals/today - get today's journal
        try:
            response = self.session.get(f"{self.base_url}/journals/today")
            if response.status_code == 200:
                journal = response.json()
                if journal and journal.get('date') == today:
                    self.log_test("GET /journals/today", True, "Today's journal retrieved successfully")
                elif journal is None:
                    self.log_test("GET /journals/today", True, "No journal for today (expected if none created)")
                else:
                    self.log_test("GET /journals/today", False, "Wrong journal returned", journal)
            else:
                self.log_test("GET /journals/today", False, f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_test("GET /journals/today", False, f"Request failed: {str(e)}")
    
    def test_moods(self):
        """Test mood logging and statistics"""
        print("\n=== Testing Moods ===")
        
        # Test POST /api/moods - create mood log
        try:
            mood_data = {
                "mood": "good",
                "intensity": 7,
                "note": "Feeling productive and positive today"
            }
            response = self.session.post(f"{self.base_url}/moods", json=mood_data)
            if response.status_code == 200:
                mood = response.json()
                if (mood.get('mood') == 'good' and 
                    mood.get('intensity') == 7 and
                    'id' in mood and 'timestamp' in mood):
                    self.log_test("POST /moods", True, "Mood log created successfully")
                else:
                    self.log_test("POST /moods", False, "Invalid mood log format", mood)
            else:
                self.log_test("POST /moods", False, f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_test("POST /moods", False, f"Request failed: {str(e)}")
        
        # Create a few more mood entries for testing
        test_moods = [
            {"mood": "great", "intensity": 9, "note": "Excellent day!"},
            {"mood": "okay", "intensity": 5, "note": "Average day"},
            {"mood": "bad", "intensity": 3, "note": "Stressful day"}
        ]
        
        for mood_data in test_moods:
            try:
                self.session.post(f"{self.base_url}/moods", json=mood_data)
                time.sleep(0.1)  # Small delay to ensure different timestamps
            except:
                pass  # Continue even if some fail
        
        # Test GET /api/moods?days=7 - get recent moods
        try:
            response = self.session.get(f"{self.base_url}/moods?days=7")
            if response.status_code == 200:
                moods = response.json()
                if isinstance(moods, list) and len(moods) >= 1:
                    # Check if moods are sorted by timestamp (most recent first)
                    if len(moods) > 1:
                        timestamps = [mood.get('timestamp') for mood in moods if mood.get('timestamp')]
                        is_sorted = all(timestamps[i] >= timestamps[i+1] for i in range(len(timestamps)-1))
                        if is_sorted:
                            self.log_test("GET /moods?days=7", True, f"Retrieved {len(moods)} recent moods (properly sorted)")
                        else:
                            self.log_test("GET /moods?days=7", False, "Moods not sorted by timestamp", moods)
                    else:
                        self.log_test("GET /moods?days=7", True, f"Retrieved {len(moods)} recent moods")
                else:
                    self.log_test("GET /moods?days=7", False, "Expected at least 1 mood entry", moods)
            else:
                self.log_test("GET /moods?days=7", False, f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_test("GET /moods?days=7", False, f"Request failed: {str(e)}")
        
        # Test GET /api/moods/stats?days=30 - get mood statistics
        try:
            response = self.session.get(f"{self.base_url}/moods/stats?days=30")
            if response.status_code == 200:
                stats = response.json()
                required_fields = ['totalLogs', 'averageIntensity', 'moodDistribution']
                missing_fields = [field for field in required_fields if field not in stats]
                
                if not missing_fields:
                    total_logs = stats.get('totalLogs', 0)
                    avg_intensity = stats.get('averageIntensity', 0)
                    mood_dist = stats.get('moodDistribution', {})
                    
                    if total_logs > 0 and isinstance(avg_intensity, (int, float)) and isinstance(mood_dist, dict):
                        self.log_test("GET /moods/stats", True, 
                                    f"Mood statistics calculated: {total_logs} logs, avg intensity {avg_intensity}")
                    else:
                        self.log_test("GET /moods/stats", False, "Invalid statistics values", stats)
                else:
                    self.log_test("GET /moods/stats", False, f"Missing required fields: {missing_fields}", stats)
            else:
                self.log_test("GET /moods/stats", False, f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_test("GET /moods/stats", False, f"Request failed: {str(e)}")
    
    def test_data_persistence(self):
        """Test that data is properly stored in MongoDB"""
        print("\n=== Testing Data Persistence ===")
        
        # Test that conversations persist with message history
        if self.conversation_id:
            try:
                response = self.session.get(f"{self.base_url}/conversations/{self.conversation_id}")
                if response.status_code == 200:
                    conversation = response.json()
                    messages = conversation.get('messages', [])
                    if len(messages) >= 2:
                        self.log_test("Conversation Message Persistence", True, 
                                    f"Conversation maintains {len(messages)} messages in history")
                    else:
                        self.log_test("Conversation Message Persistence", False, 
                                    "Conversation message history not maintained", conversation)
                else:
                    self.log_test("Conversation Message Persistence", False, f"HTTP {response.status_code}", response.text)
            except Exception as e:
                self.log_test("Conversation Message Persistence", False, f"Request failed: {str(e)}")
    
    def run_all_tests(self):
        """Run all test suites"""
        print("🧠 Starting MindfulMe Backend API Tests")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)
        
        # Test API health first
        if not self.test_api_health():
            print("\n❌ API is not accessible. Stopping tests.")
            return False
        
        # Run all test suites
        self.test_profile_management()
        self.test_conversations()
        self.test_journals()
        self.test_moods()
        self.test_data_persistence()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result['success'])
        failed = len(self.test_results) - passed
        
        print(f"Total Tests: {len(self.test_results)}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"Success Rate: {(passed/len(self.test_results)*100):.1f}%")
        
        if failed > 0:
            print(f"\n🔍 FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"   • {result['test']}: {result['message']}")
        
        return failed == 0

if __name__ == "__main__":
    tester = MindfulMeAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)