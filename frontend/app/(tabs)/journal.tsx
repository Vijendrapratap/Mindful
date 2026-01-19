import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  Dimensions,
  Platform,
  Modal
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import * as Speech from 'expo-speech';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';

import { Colors } from '../../constants/Colors';
import { GlassView } from '../../components/ui/GlassView';
import { Typo } from '../../components/ui/Typo';
import { GradientButton } from '../../components/ui/GradientButton';
import { BentoCard } from '../../components/ui/BentoCard';

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
  const [journalHistory, setJournalHistory] = useState<any[]>([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [markedDates, setMarkedDates] = useState<any>({});

  // Journaling Session State
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);

  // Entry Details
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [voiceRecording, setVoiceRecording] = useState<string | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadProfile();
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
      if (response.ok) setProfile(await response.json());
    } catch (e) { console.error(e); }
  };

  const loadJournalHistory = async () => {
    try {
      const response = await fetch(`${API_URL}/api/journals?limit=30`);
      if (response.ok) {
        const journals = await response.json();
        setJournalHistory(journals);
        const marked: any = {};
        journals.forEach((journal: any) => {
          marked[journal.date] = { marked: true, dotColor: Colors.dark.secondary };
        });
        setMarkedDates(marked);
      }
    } catch (e) { console.error(e); }
  };

  const startNewSession = async () => {
    setIsSessionActive(true);
    setConversationId(null);
    setMessages([]);
    setSelectedMood(null);
    setSelectedEmotions([]);
    setImages([]);

    // Initial AI Greeting
    const greeting = "Hi! I'm listening. How was your day? You can speak or type.";
    setMessages([{ role: 'assistant', content: greeting, timestamp: new Date().toISOString() }]);

    // Create Conversation
    try {
      const response = await fetch(`${API_URL}/api/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'journal' }),
      });
      if (response.ok) {
        const data = await response.json();
        setConversationId(data.id);
        Speech.speak(greeting, { language: 'en', rate: 0.9 });
      }
    } catch (e) { console.error(e); }
  };

  const endSession = async () => {
    // Save Journal Entry
    if (!selectedMood && messages.length < 2) {
      Alert.alert("Save Entry?", "You haven't added much yet.", [
        { text: "Discard", style: "destructive", onPress: () => setIsSessionActive(false) },
        { text: "Keep Editing", style: "cancel" }
      ]);
      return;
    }

    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const journalResponse = await fetch(`${API_URL}/api/journals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: today,
          conversationId: conversationId,
          mood: selectedMood || 'okay',
          emotion: selectedEmotions[0] || 'neutral',
          images: images,
          voiceRecording: voiceRecording,
        }),
      });

      if (journalResponse.ok) {
        Alert.alert("Saved!", "Your journal entry has been saved.");
        setIsSessionActive(false);
        loadJournalHistory();
        loadProfile();
      }
    } catch (error) {
      Alert.alert("Error", "Failed to save journal");
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if ((!inputText.trim() && !voiceRecording) || !conversationId || loading) return;

    const userContent = inputText.trim() || "(Voice Note)";
    const userMsg: Message = { role: 'user', content: userContent, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/conversations/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, content: userContent, hasVoice: !!voiceRecording }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
        const lastMsg = data.messages[data.messages.length - 1];
        if (lastMsg.role === 'assistant') {
          Speech.speak(lastMsg.content, { rate: 0.9 });
        }
      }
    } catch (e) {
      Alert.alert("Error", "Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  const startRecordingAudio = async () => {
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording);
      setIsRecording(true);
      Speech.stop(); // Stop AI speaking
    } catch (e) { }
  };

  const stopRecordingAudio = async () => {
    if (!recording) return;
    setIsRecording(false);
    await recording.stopAndUnloadAsync();
    setRecording(null);
    setVoiceRecording(recording.getURI()); // In real app, convert to base64

    // Simulate sending voice
    setInputText("I just recorded a voice note about my day.");
    // In a real implementation, you'd transcribe this on the server
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets) {
      setImages(prev => [...prev, ...result.assets.map(a => `data:image/jpeg;base64,${a.base64}`)]);
    }
  };

  const toggleEmotion = (emotion: string) => {
    if (selectedEmotions.includes(emotion)) setSelectedEmotions(p => p.filter(e => e !== emotion));
    else if (selectedEmotions.length < 3) setSelectedEmotions(p => [...p, emotion]);
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={[Colors.dark.background, '#1e1b4b']} style={StyleSheet.absoluteFill} />

      {/* Main Timeline View */}
      <GlassView intensity={50} style={styles.header}>
        <SafeAreaView>
          <View style={styles.headerContent}>
            <View>
              <Typo variant="h2" weight="bold">Journal</Typo>
              <View style={styles.streakContainer}>
                <MaterialCommunityIcons name="fire" size={18} color="#F59E0B" />
                <Typo variant="caption" style={{ marginLeft: 4 }}>{profile?.currentStreak || 0} day streak</Typo>
              </View>
            </View>
            <TouchableOpacity onPress={() => setShowCalendar(!showCalendar)} style={styles.iconButton}>
              <MaterialCommunityIcons name="calendar-month" size={24} color={Colors.dark.tint} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </GlassView>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Hero "New Entry" Card */}
        <TouchableOpacity onPress={startNewSession}>
          <LinearGradient
            colors={Colors.dark.accentGradient as any}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroContent}>
              <View style={styles.heroIcon}>
                <MaterialCommunityIcons name="microphone" size={32} color="white" />
              </View>
              <View>
                <Typo variant="h3" weight="bold" color="white">Capture the Moment</Typo>
                <Typo variant="caption" color="rgba(255,255,255,0.8)">Tap to speak with AI • Reflect on your day</Typo>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <Typo variant="label" style={{ marginBottom: 12, marginTop: 24 }}>Recent Memories</Typo>

        {journalHistory.map((journal: any, i) => (
          <BentoCard key={i} style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Typo variant="caption" color={Colors.dark.textMuted}>{journal.date}</Typo>
              {journal.mood && (
                <MaterialCommunityIcons
                  name={MOODS.find(m => m.value === journal.mood)?.icon as any || 'emoticon-neutral'}
                  size={20}
                  color={MOODS.find(m => m.value === journal.mood)?.color || Colors.dark.textMuted}
                />
              )}
            </View>
            {journal.images && journal.images.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {journal.images.map((img: string, idx: number) => (
                  <Image key={idx} source={{ uri: img }} style={styles.journalImage} />
                ))}
              </ScrollView>
            )}
            <Typo variant="body" numberOfLines={3} style={{ opacity: 0.8 }}>
              {journal.summary || "Journal entry..."}
            </Typo>
          </BentoCard>
        ))}
      </ScrollView>

      {/* Journaling Session Modal */}
      <Modal visible={isSessionActive} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <LinearGradient colors={[Colors.dark.background, '#1e1b4b']} style={StyleSheet.absoluteFill} />

          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setIsSessionActive(false)}>
              <Typo variant="body" color={Colors.dark.error}>Cancel</Typo>
            </TouchableOpacity>
            <Typo variant="h3" weight="bold">New Entry</Typo>
            <TouchableOpacity onPress={endSession}>
              <Typo variant="body" weight="bold" color={Colors.dark.primary}>Done</Typo>
            </TouchableOpacity>
          </View>

          {/* Chat Area */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.chatArea}
            contentContainerStyle={{ paddingBottom: 20 }}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.map((msg, i) => (
              <View key={i} style={[
                styles.msgBubble,
                msg.role === 'user' ? styles.userMsg : styles.aiMsg
              ]}>
                <Typo color={msg.role === 'user' ? 'white' : Colors.dark.text}>
                  {msg.content}
                </Typo>
              </View>
            ))}
            {loading && <ActivityIndicator color={Colors.dark.primary} style={{ marginTop: 20 }} />}
          </ScrollView>

          {/* Tools Area */}
          <GlassView intensity={50} style={styles.toolsArea}>
            {/* Mood Selector (Horizontal) */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 60, marginBottom: 12 }}>
              {MOODS.map(mood => (
                <TouchableOpacity
                  key={mood.value}
                  onPress={() => setSelectedMood(mood.value)}
                  style={[
                    styles.moodChip,
                    selectedMood === mood.value && { backgroundColor: mood.color + '20', borderColor: mood.color }
                  ]}
                >
                  <MaterialCommunityIcons name={mood.icon as any} size={20} color={mood.color} />
                  <Typo variant="caption" style={{ marginLeft: 4 }}>{mood.label}</Typo>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Input Bar */}
            <View style={styles.inputRow}>
              <TouchableOpacity onPress={pickImage} style={styles.toolBtn}>
                <MaterialCommunityIcons name="image-plus" size={24} color={Colors.dark.secondary} />
              </TouchableOpacity>

              <TextInput
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Type or speak..."
                placeholderTextColor={Colors.dark.textMuted}
                multiline
              />

              <TouchableOpacity
                onPressIn={startRecordingAudio}
                onPressOut={stopRecordingAudio}
                onPress={() => !isRecording && sendMessage()}
                style={[styles.actionBtn, isRecording && { backgroundColor: Colors.dark.error }]}
              >
                <MaterialCommunityIcons
                  name={isRecording ? "microphone-off" : (inputText ? "arrow-up" : "microphone")}
                  size={24}
                  color="white"
                />
              </TouchableOpacity>
            </View>
          </GlassView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { borderBottomWidth: 1, borderBottomColor: Colors.dark.glassBorder, paddingTop: Platform.OS === 'android' ? 40 : 0 },
  headerContent: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  streakContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.dark.surface, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, paddingBottom: 100 },
  heroCard: { padding: 24, borderRadius: 28, marginBottom: 8 },
  heroContent: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  journalImage: { width: 80, height: 80, borderRadius: 12, marginRight: 8 },

  // Modal Styles
  modalContainer: { flex: 1, backgroundColor: Colors.dark.background },
  modalHeader: { padding: 20, paddingTop: 60, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)' },
  chatArea: { flex: 1, padding: 20 },
  msgBubble: { maxWidth: '85%', padding: 16, borderRadius: 20, marginBottom: 12 },
  userMsg: { alignSelf: 'flex-end', backgroundColor: Colors.dark.primary, borderBottomRightRadius: 4 },
  aiMsg: { alignSelf: 'flex-start', backgroundColor: Colors.dark.surface, borderTopLeftRadius: 4 },

  toolsArea: { padding: 16, paddingBottom: 40, borderTopWidth: 1, borderColor: Colors.dark.glassBorder },
  moodChip: { flexDirection: 'row', alignItems: 'center', padding: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: Colors.dark.surface, marginRight: 8, borderWidth: 1, borderColor: 'transparent' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  toolBtn: { padding: 10 },
  input: { flex: 1, backgroundColor: Colors.dark.surface, borderRadius: 20, padding: 12, paddingTop: 12, color: 'white', maxHeight: 100 },
  actionBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.dark.primary, justifyContent: 'center', alignItems: 'center' },
});
