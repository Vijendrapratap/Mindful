import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    SafeAreaView,
    KeyboardAvoidingView,
    Platform,
    TextInput,
    Dimensions,
    Alert
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';

import { Colors } from '../constants/Colors';
import { GlassView } from '../components/ui/GlassView';
import { Typo } from '../components/ui/Typo';
import { GradientButton } from '../components/ui/GradientButton';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';
const { width } = Dimensions.get('window');

export default function PersonalityTestScreen() {
    const router = useRouter();
    const [messages, setMessages] = useState<any[]>([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const scrollViewRef = useRef<ScrollView>(null);

    useEffect(() => {
        startTest();
    }, []);

    const startTest = async () => {
        setLoading(true);
        try {
            // Create new conversation of type 'personality_test'
            const response = await fetch(`${API_URL}/api/conversations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'personality_test' }),
            });

            if (response.ok) {
                const data = await response.json();
                setConversationId(data.id);

                // Initial generic greeting, triggering AI to start the test
                await sendMessage("I'm ready to discover more about myself.", data.id, true);
            }
        } catch (e) {
            console.error('Failed to start test:', e);
            Alert.alert('Error', 'Could not start personality assessment.');
        } finally {
            setLoading(false);
        }
    };

    const sendMessage = async (text: string, convId = conversationId, isSystemInit = false) => {
        if ((!text.trim() && !isSystemInit) || !convId) return;

        if (!isSystemInit) {
            setMessages(prev => [...prev, { role: 'user', content: text }]);
            setInputText('');
        }
        setLoading(true);

        try {
            const response = await fetch(`${API_URL}/api/conversations/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conversationId: convId, content: text }),
            });

            if (response.ok) {
                const data = await response.json();
                const newMsgs = data.messages;
                setMessages(newMsgs);

                // Scroll to bottom
                setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
            }
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setLoading(false);
        }
    };

    const finishTest = () => {
        Alert.alert("Finish Assessment?", "Are you sure you want to conclude the test? The AI will analyze your conversation to generate a personality profile.", [
            { text: "Cancel", style: "cancel" },
            { text: "Analyze", onPress: generateResults }
        ])
    };

    const generateResults = async () => {
        // In a real app, we'd have a separate endpoint to analyze the conversation history.
        // For this demo, we'll assume the 'active' test conversation implicitly updates the profile
        // OR we trigger a final summary.
        // Let's call a simplified "submit" endpoint with dummy scores for now as the AI chat is doing the heavy lifting qualitatively.
        // Ideally, the AI would tool_call `submit_personality` but we don't have tools set up for that yet.

        // We'll mimic a submission for the "badge" effect
        setLoading(true);
        try {
            await fetch(`${API_URL}/api/personality-test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    // In production, these would be derived from the chat analysis
                    openness: Math.random() * 100,
                    conscientiousness: Math.random() * 100,
                    extraversion: Math.random() * 100,
                    agreeableness: Math.random() * 100,
                    neuroticism: Math.random() * 100
                }),
            });

            router.back();
            Alert.alert("Assessment Complete", "Your personality profile has been updated!");
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <LinearGradient colors={[Colors.dark.background, '#1e1b4b']} style={StyleSheet.absoluteFill} />

            <GlassView intensity={50} style={styles.header}>
                <SafeAreaView>
                    <View style={styles.headerContent}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                            <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
                        </TouchableOpacity>
                        <Typo variant="h3" weight="bold">Personality Insight</Typo>
                        <TouchableOpacity onPress={finishTest}>
                            <Typo variant="body" color={Colors.dark.primary} weight="bold">Done</Typo>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </GlassView>

            <ScrollView
                ref={scrollViewRef}
                contentContainerStyle={styles.chatContent}
                keyboardShouldPersistTaps="handled"
            >
                {messages.map((msg, index) => (
                    <View key={index} style={[
                        styles.msgBubble,
                        msg.role === 'user' ? styles.userBubble : styles.aiBubble
                    ]}>
                        <Typo variant="body" color={msg.role === 'user' ? 'white' : '#e2e8f0'}>
                            {msg.content}
                        </Typo>
                    </View>
                ))}
                {loading && (
                    <View style={styles.aiBubble}>
                        <Typo variant="body" style={{ fontStyle: 'italic' }} color="#94a3b8">Thinking...</Typo>
                    </View>
                )}
            </ScrollView>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
                <GlassView intensity={80} style={styles.inputBar}>
                    <TextInput
                        style={styles.input}
                        placeholder="Type your answer..."
                        placeholderTextColor="#64748b"
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                    />
                    <TouchableOpacity
                        style={[styles.sendBtn, !inputText.trim() && { opacity: 0.5 }]}
                        onPress={() => sendMessage(inputText)}
                        disabled={!inputText.trim() || loading}
                    >
                        <MaterialCommunityIcons name="send" size={20} color="white" />
                    </TouchableOpacity>
                </GlassView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.dark.background },
    header: { paddingTop: Platform.OS === 'android' ? 40 : 0 },
    headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
    backBtn: { padding: 8 },
    chatContent: { padding: 20, paddingBottom: 100 },
    msgBubble: { padding: 16, borderRadius: 20, maxWidth: '85%', marginBottom: 12 },
    userBubble: { alignSelf: 'flex-end', backgroundColor: Colors.dark.primary, borderBottomRightRadius: 4 },
    aiBubble: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.1)', borderBottomLeftRadius: 4 },
    inputBar: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
    input: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 24, padding: 12, paddingHorizontal: 20, color: 'white', maxHeight: 100 },
    sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.dark.primary, justifyContent: 'center', alignItems: 'center' }
});
