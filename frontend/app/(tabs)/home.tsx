import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    SafeAreaView,
    Dimensions,
    ImageBackground,
    Platform,
    RefreshControl,
    Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { Colors } from '../../constants/Colors';
import { GlassView } from '../../components/ui/GlassView';
import { Typo } from '../../components/ui/Typo';
import { BentoCard } from '../../components/ui/BentoCard';

const { width } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

const MOODS = [
    { id: 'great', emoji: '😊', label: 'Great', color: '#22C55E' },
    { id: 'good', emoji: '🙂', label: 'Good', color: '#84CC16' },
    { id: 'okay', emoji: '😐', label: 'Okay', color: '#F59E0B' },
    { id: 'low', emoji: '😔', label: 'Low', color: '#9CA3AF' },
    { id: 'anxious', emoji: '😰', label: 'Anxious', color: '#F87171' },
];

const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: 'Good morning', icon: 'weather-sunny' };
    if (hour < 17) return { text: 'Good afternoon', icon: 'weather-partly-cloudy' };
    if (hour < 21) return { text: 'Good evening', icon: 'weather-sunset' };
    return { text: 'Good night', icon: 'weather-night' };
};

const formatDate = () => {
    return new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
    });
};

export default function HomeScreen() {
    const router = useRouter();
    const [profile, setProfile] = useState<any>(null);
    const [dailyInsight, setDailyInsight] = useState<string | null>(null);
    const [selectedMood, setSelectedMood] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [insightLoading, setInsightLoading] = useState(true);
    const pulseAnim = useState(new Animated.Value(1))[0];

    const greeting = getGreeting();

    // Pulse animation for voice button
    useEffect(() => {
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.05,
                    duration: 1500,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                }),
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const loadData = async () => {
        await Promise.all([
            loadProfile(),
            loadDailyInsight(),
        ]);
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const loadProfile = async () => {
        try {
            const response = await fetch(`${API_URL}/api/profile`);
            if (response.ok) setProfile(await response.json());
        } catch (e) { console.error(e); }
    };

    const loadDailyInsight = async () => {
        setInsightLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/daily-insight`);
            if (response.ok) {
                const data = await response.json();
                setDailyInsight(data.insight);
            } else {
                // Fallback insight
                setDailyInsight("I'm here whenever you need to talk. How are you feeling today?");
            }
        } catch (e) {
            console.error(e);
            setDailyInsight("I'm here whenever you need to talk. How are you feeling today?");
        } finally {
            setInsightLoading(false);
        }
    };

    const handleMoodSelect = async (moodId: string) => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        setSelectedMood(moodId);

        // Save mood silently
        try {
            await fetch(`${API_URL}/api/moods`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mood: moodId,
                    intensity: MOODS.findIndex(m => m.id === moodId) <= 1 ? 7 : MOODS.findIndex(m => m.id === moodId) <= 2 ? 5 : 3,
                }),
            });
        } catch (e) { console.error(e); }
    };

    const handleTalkPress = () => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        router.push('/(tabs)/talk');
    };

    return (
        <View style={styles.container}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.dark.background }]} />

            {/* Header */}
            <GlassView intensity={50} style={styles.header}>
                <SafeAreaView>
                    <View style={styles.headerContent}>
                        <View style={styles.headerLeft}>
                            <View style={styles.greetingRow}>
                                <Typo variant="h2" weight="bold">
                                    {greeting.text}, {profile?.name || 'Friend'}
                                </Typo>
                                <MaterialCommunityIcons
                                    name={greeting.icon as any}
                                    size={24}
                                    color={Colors.dark.accent}
                                    style={{ marginLeft: 8 }}
                                />
                            </View>
                            <Typo variant="caption" color={Colors.dark.textMuted}>
                                {formatDate()}
                            </Typo>
                        </View>
                        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
                            {profile?.profilePic ? (
                                <ImageBackground
                                    source={{ uri: profile.profilePic }}
                                    style={styles.avatar}
                                    imageStyle={{ borderRadius: 22 }}
                                />
                            ) : (
                                <View style={styles.avatarPlaceholder}>
                                    <MaterialCommunityIcons name="account" size={24} color={Colors.dark.textMuted} />
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </GlassView>

            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={Colors.dark.primary}
                    />
                }
            >
                {/* Daily Insight Card */}
                <BentoCard style={styles.insightCard}>
                    <View style={styles.insightHeader}>
                        <MaterialCommunityIcons name="lightbulb-on" size={20} color={Colors.dark.secondary} />
                        <Typo variant="label" weight="bold" color={Colors.dark.secondary} style={{ marginLeft: 8 }}>
                            DAILY INSIGHT
                        </Typo>
                    </View>
                    <Typo variant="body" style={styles.insightText}>
                        {insightLoading ? "Thinking about you..." : `"${dailyInsight}"`}
                    </Typo>
                </BentoCard>

                {/* Voice Button - Primary CTA */}
                <View style={styles.voiceSection}>
                    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                        <TouchableOpacity
                            onPress={handleTalkPress}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={Colors.dark.accentGradient as any}
                                style={styles.voiceButton}
                            >
                                <MaterialCommunityIcons name="microphone" size={48} color="white" />
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animated.View>
                    <Typo variant="h3" weight="bold" style={styles.voiceLabel}>
                        Tap to talk
                    </Typo>
                    <Typo variant="caption" color={Colors.dark.textMuted}>
                        I'm here to listen
                    </Typo>
                </View>

                {/* Mood Quick-Select */}
                <View style={styles.moodSection}>
                    <Typo variant="body" color={Colors.dark.textMuted} style={styles.moodQuestion}>
                        How are you feeling?
                    </Typo>
                    <View style={styles.moodRow}>
                        {MOODS.map((mood) => (
                            <TouchableOpacity
                                key={mood.id}
                                onPress={() => handleMoodSelect(mood.id)}
                                style={[
                                    styles.moodButton,
                                    selectedMood === mood.id && {
                                        backgroundColor: mood.color + '30',
                                        borderColor: mood.color,
                                    }
                                ]}
                            >
                                <Typo variant="h2">{mood.emoji}</Typo>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Quick Actions */}
                <View style={styles.quickActionsSection}>
                    <Typo variant="label" color={Colors.dark.textMuted} style={styles.sectionLabel}>
                        Quick Actions
                    </Typo>
                    <View style={styles.quickActionsRow}>
                        <TouchableOpacity
                            style={styles.quickAction}
                            onPress={() => router.push('/(tabs)/journal')}
                        >
                            <GlassView intensity={20} style={styles.quickActionInner}>
                                <MaterialCommunityIcons name="notebook-outline" size={28} color={Colors.dark.secondary} />
                                <Typo variant="body" weight="medium">Journal</Typo>
                            </GlassView>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.quickAction}
                            onPress={() => router.push('/(tabs)/insights')}
                        >
                            <GlassView intensity={20} style={styles.quickActionInner}>
                                <MaterialCommunityIcons name="chart-line" size={28} color={Colors.dark.primary} />
                                <Typo variant="body" weight="medium">Insights</Typo>
                            </GlassView>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Streak Display */}
                {profile?.currentStreak > 0 && (
                    <BentoCard style={styles.streakCard}>
                        <View style={styles.streakContent}>
                            <View style={styles.streakIcon}>
                                <MaterialCommunityIcons name="fire" size={32} color={Colors.dark.accent} />
                            </View>
                            <View style={styles.streakInfo}>
                                <Typo variant="h3" weight="bold">{profile.currentStreak} Day Streak!</Typo>
                                <Typo variant="caption" color={Colors.dark.textMuted}>
                                    Keep it going! You're doing great.
                                </Typo>
                            </View>
                        </View>
                    </BentoCard>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background
    },
    header: {
        paddingTop: Platform.OS === 'android' ? 40 : 0,
        borderBottomWidth: 1,
        borderBottomColor: Colors.dark.glassBorder,
    },
    headerContent: {
        padding: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    headerLeft: {
        flex: 1,
    },
    greetingRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        overflow: 'hidden'
    },
    avatarPlaceholder: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.dark.surfaceHover,
        justifyContent: 'center',
        alignItems: 'center'
    },
    content: {
        padding: 20,
        paddingBottom: 120
    },
    insightCard: {
        marginBottom: 24,
    },
    insightHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    insightText: {
        fontStyle: 'italic',
        lineHeight: 24,
    },
    voiceSection: {
        alignItems: 'center',
        marginVertical: 24,
    },
    voiceButton: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: Colors.dark.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10,
    },
    voiceLabel: {
        marginTop: 16,
    },
    moodSection: {
        marginVertical: 24,
        alignItems: 'center',
    },
    moodQuestion: {
        marginBottom: 16,
    },
    moodRow: {
        flexDirection: 'row',
        gap: 12,
    },
    moodButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.dark.surface,
        borderWidth: 2,
        borderColor: Colors.dark.glassBorder,
    },
    quickActionsSection: {
        marginTop: 8,
    },
    sectionLabel: {
        marginBottom: 12,
    },
    quickActionsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    quickAction: {
        flex: 1,
    },
    quickActionInner: {
        padding: 20,
        borderRadius: 20,
        alignItems: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: Colors.dark.glassBorder,
        backgroundColor: Colors.dark.surface,
    },
    streakCard: {
        marginTop: 24,
    },
    streakContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    streakIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: Colors.dark.warningLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    streakInfo: {
        marginLeft: 16,
        flex: 1,
    },
});
