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
  Image,
  Modal,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { BlurView } from 'expo-blur';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';
const { width } = Dimensions.get('window');

const MOODS = [
  { value: 'amazing', label: 'Amazing', icon: 'emoticon-excited', color: '#10B981' },
  { value: 'happy', label: 'Happy', icon: 'emoticon-happy', color: '#3B82F6' },
  { value: 'calm', label: 'Calm', icon: 'emoticon-cool', color: '#8B5CF6' },
  { value: 'okay', label: 'Okay', icon: 'emoticon-neutral', color: '#F59E0B' },
  { value: 'sad', label: 'Sad', icon: 'emoticon-sad', color: '#F97316' },
  { value: 'anxious', label: 'Anxious', icon: 'emoticon-confused', color: '#EF4444' },
];

const EMOTIONS = [
  'Grateful', 'Excited', 'Peaceful', 'Hopeful', 'Loved',
  'Worried', 'Stressed', 'Lonely', 'Angry', 'Confused'
];

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
  
  // New states for enhanced features
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [voiceRecording, setVoiceRecording] = useState<string | null>(null);
  const [showMoodPicker, setShowMoodPicker] = useState(false);
  const [showEmotionPicker, setShowEmotionPicker] = useState(false);

  useEffect(() => {
    loadProfile();
    checkTodayJournal();
    loadJournalHistory();
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    await ImagePicker.requestMediaLibraryPermissionsAsync();
    await ImagePicker.requestCameraPermissionsAsync();
    await Audio.requestPermissionsAsync();
  };

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
          setSelectedMood(data.mood);
          setImages(data.images || []);
          setVoiceRecording(data.voiceRecording);
          
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
            dotColor: '#A78BFA',
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

      if (!convResponse.ok) throw new Error('Failed to create conversation');

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
          mood: selectedMood,
          emotion: selectedEmotions[0],
          images: images,
          voiceRecording: voiceRecording,
        }),
      });

      if (!journalResponse.ok) throw new Error('Failed to create journal');

      const journalData = await journalResponse.json();
      setTodayJournal(journalData);

      // Add welcome message
      const welcomeMsg = {
        role: 'assistant' as const,
        content: "Hey! How did today feel for you? Take your time, I'm here to listen.",
        timestamp: new Date().toISOString(),
      };
      setMessages([welcomeMsg]);

      Speech.speak(welcomeMsg.content, {
        language: 'en',
        pitch: 1.0,
        rate: 0.9,
      });

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

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets) {
      const newImages = result.assets.map(asset => 
        `data:image/jpeg;base64,${asset.base64}`
      );
      setImages(prev => [...prev, ...newImages]);
    }
  };

  const startRecordingAudio = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const stopRecordingAudio = async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      // TODO: Convert to base64
      setRecording(null);
      Alert.alert('Recorded!', 'Voice note saved');
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  const toggleEmotion = (emotion: string) => {
    if (selectedEmotions.includes(emotion)) {
      setSelectedEmotions(prev => prev.filter(e => e !== emotion));
    } else if (selectedEmotions.length < 3) {
      setSelectedEmotions(prev => [...prev, emotion]);
    }
  };

  const getMoodConfig = (moodValue: string) => {
    return MOODS.find(m => m.value === moodValue) || MOODS[3];
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <BlurView intensity={80} tint="dark" style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Journal</Text>
          <View style={styles.streakContainer}>
            <MaterialCommunityIcons name="fire" size={18} color="#F59E0B" />
            <Text style={styles.streakText}>
              {profile?.currentStreak || 0} day streak
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => setShowCalendar(!showCalendar)}
        >
          <MaterialCommunityIcons
            name="calendar-month"
            size={24}
            color="#A78BFA"
          />
        </TouchableOpacity>
      </BlurView>

      {/* Calendar */}
      {showCalendar && (
        <View style={styles.calendarContainer}>
          <Calendar
            markedDates={markedDates}
            theme={{
              calendarBackground: 'rgba(31, 31, 31, 0.95)',
              textSectionTitleColor: '#9CA3AF',
              dayTextColor: '#FFFFFF',
              todayTextColor: '#A78BFA',
              monthTextColor: '#FFFFFF',
              textDisabledColor: '#4B5563',
            }}
          />
        </View>
      )}

      {!todayJournal || !conversationId ? (
        /* Empty State */
        <ScrollView contentContainerStyle={styles.emptyState}>
          <View style={styles.emptyContent}>
            <View style={styles.gradientIcon}>
              <MaterialCommunityIcons
                name="book-open-page-variant"
                size={64}
                color="#A78BFA"
              />
            </View>
            <Text style={styles.emptyTitle}>Today's Journal</Text>
            <Text style={styles.emptySubtitle}>
              Take a moment to reflect and capture your thoughts
            </Text>

            {/* Mood Selector */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>How are you feeling?</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.moodScroll}
              >
                {MOODS.map(mood => (
                  <TouchableOpacity
                    key={mood.value}
                    style={[
                      styles.moodChip,
                      selectedMood === mood.value && {
                        backgroundColor: mood.color + '20',
                        borderColor: mood.color,
                      },
                    ]}
                    onPress={() => setSelectedMood(mood.value)}
                  >
                    <MaterialCommunityIcons
                      name={mood.icon as any}
                      size={32}
                      color={mood.color}
                    />
                    <Text
                      style={[
                        styles.moodLabel,
                        selectedMood === mood.value && { color: mood.color },
                      ]}
                    >
                      {mood.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Emotion Tags */}
            {selectedMood && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                  What emotions? (Pick up to 3)
                </Text>
                <View style={styles.emotionGrid}>
                  {EMOTIONS.map(emotion => (
                    <TouchableOpacity
                      key={emotion}
                      style={[
                        styles.emotionTag,
                        selectedEmotions.includes(emotion) &&
                          styles.emotionTagSelected,
                      ]}
                      onPress={() => toggleEmotion(emotion)}
                    >
                      <Text
                        style={[
                          styles.emotionTagText,
                          selectedEmotions.includes(emotion) &&
                            styles.emotionTagTextSelected,
                        ]}
                      >
                        {emotion}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Media Options */}
            {selectedMood && (
              <View style={styles.mediaOptions}>
                <TouchableOpacity style={styles.mediaButton} onPress={pickImage}>
                  <MaterialCommunityIcons name="image-plus" size={24} color="#A78BFA" />
                  <Text style={styles.mediaButtonText}>Add Photos</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.mediaButton}
                  onPressIn={startRecordingAudio}
                  onPressOut={stopRecordingAudio}
                >
                  <MaterialCommunityIcons
                    name={isRecording ? 'microphone' : 'microphone-outline'}
                    size={24}
                    color={isRecording ? '#EF4444' : '#A78BFA'}
                  />
                  <Text style={styles.mediaButtonText}>
                    {isRecording ? 'Recording...' : 'Voice Note'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Selected Images Preview */}
            {images.length > 0 && (
              <View style={styles.imagePreview}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {images.map((img, idx) => (
                    <Image key={idx} source={{ uri: img }} style={styles.previewImage} />
                  ))}
                </ScrollView>
              </View>
            )}

            <TouchableOpacity
              style={[styles.startButton, !selectedMood && styles.startButtonDisabled]}
              onPress={startJournal}
              disabled={loading || !selectedMood}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.startButtonText}>Start Writing</Text>
                  <MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        /* Active Journal */
        <View style={{ flex: 1, paddingBottom: 65 }}>
          {/* Mood & Emotion Display */}
          {selectedMood && (
            <View style={styles.activeMoodBar}>
              <MaterialCommunityIcons
                name={getMoodConfig(selectedMood).icon as any}
                size={20}
                color={getMoodConfig(selectedMood).color}
              />
              <Text style={styles.activeMoodText}>
                {getMoodConfig(selectedMood).label}
              </Text>
              {selectedEmotions.length > 0 && (
                <Text style={styles.activeEmotions}>
                  • {selectedEmotions.join(', ')}
                </Text>
              )}
            </View>
          )}

          {/* Messages */}
          <ScrollView
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
          >
            {messages.map((message, index) => (
              <View
                key={index}
                style={[
                  styles.messageBubble,
                  message.role === 'user' ? styles.userMessage : styles.assistantMessage,
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
                <ActivityIndicator color="#A78BFA" />
              </View>
            )}
          </ScrollView>

          {/* Input */}
          <BlurView intensity={80} tint="dark" style={styles.inputContainer}>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Continue writing..."
                placeholderTextColor="#6B7280"
                multiline
                maxLength={2000}
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
                  size={22}
                  color={inputText.trim() && !loading ? '#FFFFFF' : '#6B7280'}
                />
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(167, 139, 250, 0.2)',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  streakText: {
    fontSize: 13,
    color: '#F59E0B',
    fontWeight: '600',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(167, 139, 250, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarContainer: {
    backgroundColor: 'rgba(31, 31, 31, 0.95)',
    padding: 12,
  },
  emptyState: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 80,
  },
  emptyContent: {
    flex: 1,
    paddingTop: 40,
  },
  gradientIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(167, 139, 250, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E5E7EB',
    marginBottom: 12,
  },
  moodScroll: {
    paddingVertical: 8,
    gap: 12,
  },
  moodChip: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: 'rgba(31, 31, 31, 0.8)',
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 8,
    minWidth: 100,
  },
  moodLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  emotionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  emotionTag: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(31, 31, 31, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.3)',
  },
  emotionTagSelected: {
    backgroundColor: 'rgba(167, 139, 250, 0.25)',
    borderColor: '#A78BFA',
  },
  emotionTagText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  emotionTagTextSelected: {
    color: '#A78BFA',
  },
  mediaOptions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  mediaButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(167, 139, 250, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.3)',
  },
  mediaButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A78BFA',
  },
  imagePreview: {
    marginBottom: 20,
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 8,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#A78BFA',
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 12,
  },
  startButtonDisabled: {
    backgroundColor: 'rgba(107, 114, 128, 0.3)',
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  activeMoodBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(31, 31, 31, 0.8)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(167, 139, 250, 0.2)',
  },
  activeMoodText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  activeEmotions: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    gap: 12,
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 14,
    borderRadius: 20,
    marginVertical: 4,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(167, 139, 250, 0.9)',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(31, 31, 31, 0.9)',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  assistantMessageText: {
    color: '#E5E7EB',
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(167, 139, 250, 0.2)',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(31, 31, 31, 0.8)',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 15,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.3)',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#A78BFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(107, 114, 128, 0.3)',
  },
});
