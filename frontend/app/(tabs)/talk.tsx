import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Dimensions,
  TextInput,
  Animated,
  Modal,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../../constants/Colors';
import { GlassView } from '../../components/ui/GlassView';
import { Typo } from '../../components/ui/Typo';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';
const { width, height } = Dimensions.get('window');

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  hasVoice: boolean;
}

export default function TalkScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [sessionTimer, setSessionTimer] = useState(0);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [sessionMood, setSessionMood] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const waveAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadOrCreateConversation();
    requestAudioPermissions();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Waveform animation while recording
  useEffect(() => {
    if (isRecording) {
      const wave = Animated.loop(
        Animated.sequence([
          Animated.timing(waveAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(waveAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
        ])
      );
      wave.start();
      return () => wave.stop();
    }
  }, [isRecording]);

  // Pulse animation for record button
  useEffect(() => {
    if (!sessionStarted || loading) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [sessionStarted, loading]);

  const requestAudioPermissions = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Audio permission is needed for voice conversations.');
      }
    } catch (error) {
      console.log('Audio permissions error:', error);
    }
  };

  const loadOrCreateConversation = async () => {
    try {
      const savedId = await AsyncStorage.getItem('currentTalkConversation');
      if (savedId) {
        const response = await fetch(`${API_URL}/api/conversations/${savedId}`);
        if (response.ok) {
          const data = await response.json();
          setConversationId(data.id);
          setMessages(data.messages || []);
          if (data.messages?.length > 0) {
            setSessionStarted(true);
            startSessionTimer();
          }
          return;
        }
      }
      await createNewConversation();
    } catch (error) {
      console.error('Error loading conversation:', error);
      await createNewConversation();
    }
  };

  const createNewConversation = async () => {
    try {
      const response = await fetch(`${API_URL}/api/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'chat' }),
      });

      if (response.ok) {
        const data = await response.json();
        setConversationId(data.id);
        await AsyncStorage.setItem('currentTalkConversation', data.id);
        setMessages([{
          role: 'assistant',
          content: "Hey! I'm here. What's on your mind?",
          timestamp: new Date().toISOString(),
          hasVoice: false,
        }]);
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  const startSessionTimer = () => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      setSessionTimer(prev => prev + 1);
    }, 1000);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setIsRecording(true);

      if (!sessionStarted) {
        setSessionStarted(true);
        startSessionTimer();
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (uri) {
        await transcribeAndSend(uri);
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setIsRecording(false);
    }
  };

  const transcribeAndSend = async (audioUri: string) => {
    setLoading(true);
    try {
      // Read audio file and convert to base64
      const base64Audio = await FileSystem.readAsStringAsync(audioUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Send to transcription endpoint
      const transcribeResponse = await fetch(`${API_URL}/api/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64Audio }),
      });

      if (transcribeResponse.ok) {
        const { text } = await transcribeResponse.json();
        if (text && text.trim()) {
          await sendMessage(text.trim(), true);
        } else {
          Alert.alert('No Speech Detected', 'Could not detect any speech. Please try again.');
          setLoading(false);
        }
      } else {
        // Fallback: show text input if transcription fails
        setShowTextInput(true);
        Alert.alert('Voice Processing', 'Voice transcription is being set up. Please type your message for now.');
        setLoading(false);
      }
    } catch (error) {
      console.error('Transcription error:', error);
      setShowTextInput(true);
      Alert.alert('Connection Issue', 'Could not process voice. Please type your message.');
      setLoading(false);
    }
  };

  const sendMessage = async (content: string, hasVoice: boolean = false) => {
    if (!content.trim() || !conversationId) return;

    setLoading(true);
    const userMessage: Message = {
      role: 'user',
      content: content.trim(),
      timestamp: new Date().toISOString(),
      hasVoice,
    };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');

    try {
      const response = await fetch(`${API_URL}/api/conversations/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          content: content.trim(),
          hasVoice,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);

        // Speak the response if not muted
        if (!isMuted && data.messages?.length > 0) {
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
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const handleTextSubmit = () => {
    if (inputText.trim()) {
      if (!sessionStarted) {
        setSessionStarted(true);
        startSessionTimer();
      }
      sendMessage(inputText, false);
    }
  };

  const endSession = () => {
    if (sessionStarted && messages.length > 0) {
      // Show feedback modal before ending
      setShowFeedbackModal(true);
    } else {
      // No session to end, just reset
      resetSession();
    }
  };

  const submitFeedback = async (feedback: 'helpful' | 'neutral' | 'skip', mood?: string) => {
    try {
      // Submit session feedback to backend
      if (feedback !== 'skip') {
        await fetch(`${API_URL}/api/session-feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId,
            feedback,
            mood: mood || sessionMood,
            sessionDuration: sessionTimer,
            messageCount: messages.length,
          }),
        });
      }
    } catch (e) {
      console.error('Error submitting feedback:', e);
    }
    setShowFeedbackModal(false);
    resetSession();
  };

  const resetSession = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    Speech.stop();
    await AsyncStorage.removeItem('currentTalkConversation');
    setMessages([]);
    setConversationId(null);
    setSessionTimer(0);
    setSessionStarted(false);
    setSessionMood(null);
    await createNewConversation();
  };

  const toggleMute = () => {
    if (!isMuted) {
      Speech.stop();
    }
    setIsMuted(!isMuted);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.dark.background }]} />

      {/* Header */}
      <GlassView intensity={30} style={styles.header}>
        <SafeAreaView>
          <View style={styles.headerContent}>
            <View>
              <Typo variant="h2" weight="bold">Talk</Typo>
              <Typo variant="caption" color={Colors.dark.textMuted}>
                Voice Conversation
              </Typo>
            </View>
            <View style={styles.headerRight}>
              {sessionStarted && (
                <View style={styles.timerContainer}>
                  <MaterialCommunityIcons name="clock-outline" size={16} color={Colors.dark.textMuted} />
                  <Typo variant="body" weight="medium" style={{ marginLeft: 4 }}>
                    {formatTime(sessionTimer)}
                  </Typo>
                </View>
              )}
              <TouchableOpacity onPress={endSession} style={styles.iconButton}>
                <MaterialCommunityIcons name="refresh" size={22} color={Colors.dark.tint} />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </GlassView>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((message, index) => {
            const isUser = message.role === 'user';
            return (
              <View key={index} style={[styles.messageRow, isUser ? styles.userRow : styles.assistantRow]}>
                {!isUser && (
                  <View style={styles.avatar}>
                    <MaterialCommunityIcons name="leaf" size={16} color="white" />
                  </View>
                )}

                {isUser ? (
                  <LinearGradient
                    colors={Colors.dark.accentGradient as any}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.bubble, styles.userBubble]}
                  >
                    <Typo color="white" style={{ lineHeight: 22 }}>{message.content}</Typo>
                    {message.hasVoice && (
                      <MaterialCommunityIcons name="microphone" size={14} color="rgba(255,255,255,0.6)" style={{ marginTop: 4 }} />
                    )}
                  </LinearGradient>
                ) : (
                  <GlassView intensity={20} style={[styles.bubble, styles.assistantBubble]}>
                    <Typo color={Colors.dark.text} style={{ lineHeight: 22 }}>{message.content}</Typo>
                  </GlassView>
                )}
              </View>
            );
          })}

          {loading && (
            <View style={[styles.messageRow, styles.assistantRow]}>
              <View style={styles.avatar}>
                <MaterialCommunityIcons name="leaf" size={16} color="white" />
              </View>
              <GlassView intensity={10} style={[styles.bubble, styles.assistantBubble, { width: 60, alignItems: 'center' }]}>
                <ActivityIndicator color={Colors.dark.tint} size="small" />
              </GlassView>
            </View>
          )}
        </ScrollView>

        {/* Voice Controls */}
        <View style={styles.controlsContainer}>
          {isRecording && (
            <View style={styles.recordingIndicator}>
              <Animated.View
                style={[
                  styles.waveBar,
                  { transform: [{ scaleY: waveAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }
                ]}
              />
              <Animated.View
                style={[
                  styles.waveBar,
                  { transform: [{ scaleY: waveAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0.4] }) }] }
                ]}
              />
              <Animated.View
                style={[
                  styles.waveBar,
                  { transform: [{ scaleY: waveAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }
                ]}
              />
              <Animated.View
                style={[
                  styles.waveBar,
                  { transform: [{ scaleY: waveAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0.5] }) }] }
                ]}
              />
              <Animated.View
                style={[
                  styles.waveBar,
                  { transform: [{ scaleY: waveAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.9] }) }] }
                ]}
              />
              <Typo variant="body" style={{ marginLeft: 12 }}>Listening...</Typo>
            </View>
          )}

          <GlassView intensity={50} style={styles.controlsBar}>
            <TouchableOpacity onPress={toggleMute} style={styles.controlButton}>
              <MaterialCommunityIcons
                name={isMuted ? 'volume-off' : 'volume-high'}
                size={24}
                color={isMuted ? Colors.dark.error : Colors.dark.textMuted}
              />
            </TouchableOpacity>

            <Animated.View style={{ transform: [{ scale: loading ? 1 : pulseAnim }] }}>
              <TouchableOpacity
                style={[styles.recordButton, isRecording && styles.recordButtonActive]}
                onPressIn={startRecording}
                onPressOut={stopRecording}
                disabled={loading}
              >
                <LinearGradient
                  colors={isRecording ? ['#EF4444', '#DC2626'] : Colors.dark.accentGradient as any}
                  style={styles.recordButtonGradient}
                >
                  <MaterialCommunityIcons
                    name={isRecording ? 'stop' : 'microphone'}
                    size={32}
                    color="white"
                  />
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity
              onPress={() => setShowTextInput(!showTextInput)}
              style={styles.controlButton}
            >
              <MaterialCommunityIcons
                name="keyboard"
                size={24}
                color={showTextInput ? Colors.dark.primary : Colors.dark.textMuted}
              />
            </TouchableOpacity>
          </GlassView>

          {/* Text Input (Secondary) */}
          {showTextInput && (
            <GlassView intensity={40} style={styles.textInputBar}>
              <TextInput
                style={styles.textInput}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Type a message..."
                placeholderTextColor={Colors.dark.textMuted}
                multiline
                returnKeyType="send"
                onSubmitEditing={handleTextSubmit}
              />
              <TouchableOpacity
                style={[styles.sendButton, !inputText.trim() && { opacity: 0.5 }]}
                onPress={handleTextSubmit}
                disabled={!inputText.trim() || loading}
              >
                <LinearGradient
                  colors={Colors.dark.accentGradient as any}
                  style={StyleSheet.absoluteFill}
                />
                <MaterialCommunityIcons name="arrow-up" size={20} color="white" />
              </TouchableOpacity>
            </GlassView>
          )}

          <Typo variant="caption" color={Colors.dark.textMuted} align="center" style={{ marginTop: 8 }}>
            Hold to speak, release to send
          </Typo>
        </View>
      </KeyboardAvoidingView>

      {/* Post-Session Feedback Modal */}
      <Modal visible={showFeedbackModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <GlassView intensity={95} style={styles.feedbackModal}>
            <Typo variant="h3" weight="bold" align="center" style={{ marginBottom: 8 }}>
              How was this session?
            </Typo>
            <Typo variant="body" color={Colors.dark.textMuted} align="center" style={{ marginBottom: 24 }}>
              Your feedback helps me improve
            </Typo>

            {/* Feedback Options */}
            <View style={styles.feedbackOptions}>
              <TouchableOpacity
                style={styles.feedbackOption}
                onPress={() => submitFeedback('helpful')}
              >
                <View style={[styles.feedbackIcon, { backgroundColor: Colors.dark.success + '20' }]}>
                  <MaterialCommunityIcons name="thumb-up" size={28} color={Colors.dark.success} />
                </View>
                <Typo variant="body" weight="medium">Helpful</Typo>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.feedbackOption}
                onPress={() => submitFeedback('neutral')}
              >
                <View style={[styles.feedbackIcon, { backgroundColor: Colors.dark.moodOkay + '20' }]}>
                  <MaterialCommunityIcons name="minus" size={28} color={Colors.dark.moodOkay} />
                </View>
                <Typo variant="body" weight="medium">Neutral</Typo>
              </TouchableOpacity>
            </View>

            {/* Mood Selection */}
            <Typo variant="body" color={Colors.dark.textMuted} align="center" style={{ marginTop: 24, marginBottom: 12 }}>
              How are you feeling now?
            </Typo>
            <View style={styles.moodRow}>
              {[
                { id: 'amazing', emoji: '🤩', color: Colors.dark.moodAmazing },
                { id: 'happy', emoji: '😊', color: Colors.dark.moodHappy },
                { id: 'calm', emoji: '😌', color: Colors.dark.moodCalm },
                { id: 'okay', emoji: '😐', color: Colors.dark.moodOkay },
                { id: 'sad', emoji: '😔', color: Colors.dark.moodSad },
              ].map((mood) => (
                <TouchableOpacity
                  key={mood.id}
                  onPress={() => setSessionMood(mood.id)}
                  style={[
                    styles.moodButton,
                    sessionMood === mood.id && {
                      backgroundColor: mood.color + '30',
                      borderColor: mood.color,
                    }
                  ]}
                >
                  <Typo variant="h3">{mood.emoji}</Typo>
                </TouchableOpacity>
              ))}
            </View>

            {/* Skip Button */}
            <TouchableOpacity
              onPress={() => submitFeedback('skip')}
              style={styles.skipFeedbackButton}
            >
              <Typo variant="caption" color={Colors.dark.textMuted}>Skip for now</Typo>
            </TouchableOpacity>
          </GlassView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.glassBorder,
    paddingTop: Platform.OS === 'android' ? 40 : 0,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surfaceHover,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.surfaceHover,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 20,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    maxWidth: '85%',
  },
  userRow: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  },
  assistantRow: {
    alignSelf: 'flex-start',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.dark.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginTop: 4,
  },
  bubble: {
    padding: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    borderTopLeftRadius: 4,
    backgroundColor: Colors.dark.surface,
  },
  controlsContainer: {
    padding: 20,
    paddingBottom: 100,
    alignItems: 'center',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.dark.errorLight,
    borderRadius: 24,
  },
  waveBar: {
    width: 4,
    height: 24,
    backgroundColor: Colors.dark.error,
    borderRadius: 2,
    marginHorizontal: 2,
  },
  controlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    padding: 16,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
    backgroundColor: Colors.dark.surface,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.dark.surfaceHover,
  },
  recordButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
  },
  recordButtonActive: {
    transform: [{ scale: 1.1 }],
  },
  recordButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 12,
    padding: 8,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
    width: '100%',
    backgroundColor: Colors.dark.surface,
  },
  textInput: {
    flex: 1,
    color: Colors.dark.text,
    paddingVertical: 10,
    paddingHorizontal: 16,
    fontSize: 16,
    maxHeight: 80,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  feedbackModal: {
    width: '100%',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  feedbackOptions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  feedbackOption: {
    alignItems: 'center',
    gap: 8,
  },
  feedbackIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  moodButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderWidth: 2,
    borderColor: Colors.dark.glassBorder,
  },
  skipFeedbackButton: {
    marginTop: 20,
    alignItems: 'center',
    padding: 8,
  },
});
