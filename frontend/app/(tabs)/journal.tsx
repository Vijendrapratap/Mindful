import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export default function JournalScreen() {
  const [profile, setProfile] = useState<any>(null);
  const [todayJournal, setTodayJournal] = useState<any>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [markedDates, setMarkedDates] = useState<any>({});

  useEffect(() => {
    loadProfile();
    checkTodayJournal();
    loadJournalHistory();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await fetch(`${API_URL}/api/profile`);
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const checkTodayJournal = async () => {
    try {
      const response = await fetch(`${API_URL}/api/journals/today`);
      if (response.ok) {
        const data = await response.json();
        if (data) {
          setTodayJournal(data);
          // Load the conversation
          const convResponse = await fetch(
            `${API_URL}/api/conversations/${data.conversationId}`
          );
          if (convResponse.ok) {
            const convData = await convResponse.json();
            setConversationId(convData.id);
            setMessages(convData.messages || []);
          }
        }
      }
    } catch (error) {
      console.error('Error checking today journal:', error);
    }
  };

  const loadJournalHistory = async () => {
    try {
      const response = await fetch(`${API_URL}/api/journals?limit=30`);
      if (response.ok) {
        const journals = await response.json();
        const marked: any = {};
        journals.forEach((journal: any) => {
          marked[journal.date] = {
            marked: true,
            dotColor: '#7C3AED',
          };
        });
        setMarkedDates(marked);
      }
    } catch (error) {
      console.error('Error loading journal history:', error);
    }
  };

  const startJournal = async () => {
    try {
      setLoading(true);

      // Create new conversation
      const convResponse = await fetch(`${API_URL}/api/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'journal' }),
      });

      if (!convResponse.ok) {
        throw new Error('Failed to create conversation');
      }

      const convData = await convResponse.json();
      setConversationId(convData.id);

      // Create journal entry
      const today = new Date().toISOString().split('T')[0];
      const journalResponse = await fetch(`${API_URL}/api/journals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: today,
          conversationId: convData.id,
        }),
      });

      if (!journalResponse.ok) {
        throw new Error('Failed to create journal');
      }

      const journalData = await journalResponse.json();
      setTodayJournal(journalData);

      // Add welcome message
      const welcomeMsg = {
        role: 'assistant' as const,
        content: "Hey! How did today feel for you? Take your time, I'm here to listen.",
        timestamp: new Date().toISOString(),
      };
      setMessages([welcomeMsg]);

      // Speak welcome message
      Speech.speak(welcomeMsg.content, {
        language: 'en',
        pitch: 1.0,
        rate: 0.9,
      });

      // Reload profile for updated streak
      await loadProfile();
      await loadJournalHistory();
    } catch (error) {
      console.error('Error starting journal:', error);
      Alert.alert('Error', 'Failed to start journal');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !conversationId || loading) return;

    const userMessage = inputText.trim();
    setInputText('');
    setLoading(true);

    // Add user message to UI
    const newUserMessage: Message = {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, newUserMessage]);

    try {
      const response = await fetch(`${API_URL}/api/conversations/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          content: userMessage,
          hasVoice: false,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);

        // Speak assistant's response
        if (data.messages && data.messages.length > 0) {
          const lastMessage = data.messages[data.messages.length - 1];
          if (lastMessage.role === 'assistant') {
            Speech.speak(lastMessage.content, {
              language: 'en',
              pitch: 1.0,
              rate: 0.9,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Daily Journal</Text>
          <View style={styles.streakContainer}>
            <MaterialCommunityIcons name="fire" size={20} color="#F59E0B" />
            <Text style={styles.streakText}>
              {profile?.currentStreak || 0} day streak
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => setShowCalendar(!showCalendar)}>
          <MaterialCommunityIcons
            name="calendar-month"
            size={24}
            color="#7C3AED"
          />
        </TouchableOpacity>
      </View>

      {showCalendar && (
        <View style={styles.calendarContainer}>
          <Calendar
            markedDates={markedDates}
            theme={{
              calendarBackground: '#1F1F1F',
              textSectionTitleColor: '#9CA3AF',
              dayTextColor: '#FFFFFF',
              todayTextColor: '#7C3AED',
              monthTextColor: '#FFFFFF',
              textDisabledColor: '#4B5563',
            }}
          />
        </View>
      )}

      {!todayJournal || !conversationId ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons
            name="book-open-variant"
            size={80}
            color="#374151"
          />
          <Text style={styles.emptyTitle}>Ready to journal?</Text>
          <Text style={styles.emptySubtitle}>
            Take a few minutes to reflect on your day through conversation
          </Text>
          <TouchableOpacity
            style={styles.startButton}
            onPress={startJournal}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.startButtonText}>Start Today's Journal</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
          >
            {messages.map((message, index) => (
              <View
                key={index}
                style={[
                  styles.messageBubble,
                  message.role === 'user'
                    ? styles.userMessage
                    : styles.assistantMessage,
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    message.role === 'user'
                      ? styles.userMessageText
                      : styles.assistantMessageText,
                  ]}
                >
                  {message.content}
                </Text>
              </View>
            ))}
            {loading && (
              <View style={[styles.messageBubble, styles.assistantMessage]}>
                <ActivityIndicator color="#7C3AED" />
              </View>
            )}
          </ScrollView>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Share your thoughts..."
              placeholderTextColor="#6B7280"
              multiline
              maxLength={1000}
            />

            <TouchableOpacity
              style={[
                styles.sendButton,
                (!inputText.trim() || loading) && styles.sendButtonDisabled,
              ]}
              onPress={sendMessage}
              disabled={!inputText.trim() || loading}
            >
              <MaterialCommunityIcons
                name="send"
                size={24}
                color={inputText.trim() && !loading ? '#FFFFFF' : '#6B7280'}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  streakText: {
    fontSize: 14,
    color: '#F59E0B',
    fontWeight: '600',
  },
  calendarContainer: {
    backgroundColor: '#1F1F1F',
    padding: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 24,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 22,
  },
  startButton: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 32,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    gap: 12,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginVertical: 4,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#7C3AED',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#1F1F1F',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  assistantMessageText: {
    color: '#E5E7EB',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1F1F1F',
    borderTopWidth: 1,
    borderTopColor: '#374151',
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#262626',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#262626',
  },
});