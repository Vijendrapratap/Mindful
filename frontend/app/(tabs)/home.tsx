import React, { useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    SafeAreaView,
    Dimensions,
    ImageBackground,
    Alert
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import { useRouter } from 'expo-router';
import { Audio } from 'expo-av';

import { Colors } from '../../constants/Colors';
import { GlassView } from '../../components/ui/GlassView';
import { Typo } from '../../components/ui/Typo';
import { BentoCard } from '../../components/ui/BentoCard';
import { GradientButton } from '../../components/ui/GradientButton';

const { width } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

export default function HomeScreen() {
    const router = useRouter();
    const [profile, setProfile] = useState<any>(null);
    const [quote, setQuote] = useState({ text: "Peace comes from within. Do not seek it without.", author: "Buddha" });
    const [isSpeaking, setIsSpeaking] = useState(false);

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const response = await fetch(`${API_URL}/api/profile`);
            if (response.ok) setProfile(await response.json());
        } catch (e) { console.error(e); }
    };

    const startSession = () => {
        // Navigate to Journal or Chat with specific intent? 
        // User wants "Digital Psychologist". Chat is best for this.
        // We can pass params to chat to start a "Psychologist" mode.
        router.push('/(tabs)/chat');
    };

    const handleVoiceCheckIn = async () => {
        // Navigate to Journal for voice entry
        router.push('/(tabs)/journal');
    };

    return (
        <View style={styles.container}>
            <LinearGradient colors={[Colors.dark.background, '#1e1b4b']} style={StyleSheet.absoluteFill} />

            <GlassView intensity={50} style={styles.header}>
                <SafeAreaView>
                    <View style={styles.headerContent}>
                        <View>
                            <Typo variant="caption" color={Colors.dark.textMuted}>
                                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                            </Typo>
                            <Typo variant="h2" weight="bold">Hello, {profile?.name || 'Friend'}</Typo>
                        </View>
                        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
                            {profile?.profilePic ? (
                                <ImageBackground source={{ uri: profile.profilePic }} style={styles.avatar} imageStyle={{ borderRadius: 20 }} />
                            ) : (
                                <View style={styles.avatarPlaceholder}>
                                    <MaterialCommunityIcons name="account" size={24} color={Colors.dark.textMuted} />
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </GlassView>

            <ScrollView contentContainerStyle={styles.content}>

                {/* Digital Psychologist Hero */}
                <View style={styles.psychContainer}>
                    <View style={styles.orbContainer}>
                        <LinearGradient
                            colors={[Colors.dark.primary, Colors.dark.secondary]}
                            style={styles.orb}
                        />
                        <GlassView intensity={20} style={styles.orbGlass} />
                    </View>
                    <Typo variant="h3" weight="bold" align="center" style={{ marginTop: 24 }}>
                        I'm here for you.
                    </Typo>
                    <Typo variant="body" align="center" color={Colors.dark.textMuted} style={{ marginTop: 8, maxWidth: '80%' }}>
                        Whether you need to vent, reflect, or find clarity, I'm listening.
                    </Typo>

                    <View style={styles.actionRow}>
                        <TouchableOpacity onPress={startSession} style={styles.mainActionCmd}>
                            <LinearGradient
                                colors={[Colors.dark.primary, '#4c1d95']}
                                style={styles.actionGradient}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                            >
                                <MaterialCommunityIcons name="chat-processing" size={28} color="white" />
                                <Typo variant="body" weight="bold" color="white">Chat Session</Typo>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={handleVoiceCheckIn} style={styles.secondaryAction}>
                            <GlassView intensity={30} style={styles.glassBtn}>
                                <MaterialCommunityIcons name="microphone" size={28} color={Colors.dark.secondary} />
                                <Typo variant="body" weight="medium" color={Colors.dark.secondary}>Voice Note</Typo>
                            </GlassView>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Daily Insight */}
                <BentoCard style={{ marginTop: 24 }}>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <MaterialCommunityIcons name="format-quote-open" size={32} color={Colors.dark.textMuted} style={{ opacity: 0.3 }} />
                        <View style={{ flex: 1 }}>
                            <Typo variant="body" style={{ fontStyle: 'italic', lineHeight: 24 }}>
                                "{quote.text}"
                            </Typo>
                            <Typo variant="caption" weight="bold" style={{ marginTop: 12, opacity: 0.7 }}>
                                — {quote.author}
                            </Typo>
                        </View>
                    </View>
                </BentoCard>

                {/* Stats / Quick Look */}
                <View style={styles.statsRow}>
                    <GlassView intensity={20} style={styles.statItem}>
                        <MaterialCommunityIcons name="brain" size={24} color={Colors.dark.tint} />
                        <Typo variant="caption" style={{ marginTop: 8 }}>Mental Wellness</Typo>
                        <Typo variant="h3" weight="bold" color={Colors.dark.tint}>85%</Typo>
                    </GlassView>
                    <GlassView intensity={20} style={styles.statItem}>
                        <MaterialCommunityIcons name="chart-line" size={24} color="#F59E0B" />
                        <Typo variant="caption" style={{ marginTop: 8 }}>Mood Trend</Typo>
                        <Typo variant="h3" weight="bold" color="#F59E0B">Stable</Typo>
                    </GlassView>
                </View>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.dark.background },
    header: { paddingTop: Platform.OS === 'android' ? 40 : 0 },
    headerContent: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    avatar: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
    avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
    content: { padding: 20, paddingBottom: 100 },
    psychContainer: { alignItems: 'center', marginTop: 20 },
    orbContainer: { width: 120, height: 120, justifyContent: 'center', alignItems: 'center', position: 'relative' },
    orb: { width: 100, height: 100, borderRadius: 50, position: 'absolute' },
    orbGlass: { width: 120, height: 120, borderRadius: 60, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    actionRow: { flexDirection: 'row', gap: 16, marginTop: 32, width: '100%' },
    mainActionCmd: { flex: 1, height: 60, borderRadius: 30, shadowColor: Colors.dark.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
    actionGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, borderRadius: 30 },
    secondaryAction: { flex: 1, height: 60 },
    glassBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, borderRadius: 30, borderWidth: 1, borderColor: Colors.dark.glassBorder },
    statsRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
    statItem: { flex: 1, padding: 16, borderRadius: 24, alignItems: 'center', gap: 4 },
});
