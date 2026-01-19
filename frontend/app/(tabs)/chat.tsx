import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Dimensions
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../../constants/Colors';
import { GlassView } from '../../components/ui/GlassView';
import { Typo } from '../../components/ui/Typo';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';
const { width } = Dimensions.get('window');

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  hasVoice: boolean;
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadOrCreateConversation();
    requestAudioPermissions();
  }, []);

  const requestAudioPermissions = async () => {
    try {
      await Audio.requestPermissionsAsync();
    } catch (error) {
      console.log('Audio permissions error:', error);
    }
  };

  const loadOrCreateConversation = async () => {
    try {
      const savedId = await AsyncStorage.getItem('currentChatConversation');
      if (savedId) {
        const response = await fetch(`${API_URL}/api/conversations/${savedId}`);
        if (response.ok) {
          const data = await response.json();
          setConversationId(data.id);
          setMessages(data.messages || []);
          return;
        }
      }

      const response = await fetch(`${API_URL}/api/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'chat' }),
      });

      if (response.ok) {
        const data = await response.json();
        setConversationId(data.id);
        await AsyncStorage.setItem('currentChatConversation', data.id);
        setMessages([{
          role: 'assistant',
          content: "Hi there! I'm here to listen. How are you feeling today?",
          timestamp: new Date().toISOString(),
          hasVoice: false,
        }]);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !conversationId || loading) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const userMessage = inputText.trim();
    setInputText('');
    setLoading(true);

    const newUserMessage: Message = {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
      hasVoice: false,
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
          // Only speak if user hasn't typed another message
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

  const startRecording = async () => {
    try {
      Haptics.selectionAsync();
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
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      setRecording(null);
      Alert.alert('Voice Recording', 'Voice transcription is being processed. For now, please type your message.', [{ text: 'OK' }]);
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  const clearConversation = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Clear Conversation',
      'Start fresh?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('currentChatConversation');
            setMessages([]);
            setConversationId(null);
            loadOrCreateConversation();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Background */}
      <LinearGradient
        colors={[Colors.dark.background, '#1e1b4b']}
        style={StyleSheet.absoluteFill}
      />

      <GlassView intensity={30} style={styles.header}>
        <SafeAreaView>
          <View style={styles.headerContent}>
            <View>
              <Typo variant="h2" weight="bold">Chat</Typo>
              <Typo variant="caption">Mindful Companion</Typo>
            </View>
            <TouchableOpacity onPress={clearConversation} style={styles.iconButton}>
              <MaterialCommunityIcons name="refresh" size={24} color={Colors.dark.tint} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </GlassView>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((message, index) => {
            const isUser = message.role === 'user';
            return (
              <View key={index} style={[
                styles.messageRow,
                isUser ? styles.userRow : styles.assistantRow
              ]}>
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

        <GlassView intensity={50} style={styles.inputBar}>
          <TouchableOpacity
            style={[styles.voiceButton, isRecording && styles.voiceButtonActive]}
            onPressIn={startRecording}
            onPressOut={stopRecording}
          >
            <MaterialCommunityIcons
              name={isRecording ? 'microphone' : 'microphone-outline'}
              size={24}
              color={isRecording ? 'white' : Colors.dark.textMuted}
            />
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type your message..."
            placeholderTextColor={Colors.dark.textMuted}
            multiline
          />

          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && { opacity: 0.5 }]}
            onPress={sendMessage}
            disabled={!inputText.trim() || loading}
          >
            <LinearGradient
              colors={Colors.dark.accentGradient as any}
              style={StyleSheet.absoluteFill}
            />
            <MaterialCommunityIcons name="arrow-up" size={24} color="white" />
          </TouchableOpacity>
        </GlassView>
      </KeyboardAvoidingView>
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
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 100, // Space for input bar
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
  },
  inputBar: {
    position: 'absolute',
    bottom: 90, // Above tab bar
    left: 16,
    right: 16,
    borderRadius: 30,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
  },
  input: {
    flex: 1,
    color: 'white',
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    maxHeight: 100,
  },
  voiceButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceButtonActive: {
    backgroundColor: Colors.dark.error,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  }
});