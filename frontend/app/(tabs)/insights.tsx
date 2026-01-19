import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Platform,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { GlassView } from '../../components/ui/GlassView';
import { Typo } from '../../components/ui/Typo';
import { BentoCard } from '../../components/ui/BentoCard';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';
const { width } = Dimensions.get('window');

interface InsightData {
  insight: string;
  type: 'pattern' | 'correlation' | 'celebration';
}

interface SessionSummary {
  id: string;
  date: string;
  type: string;
  mood?: string;
  duration?: number;
  summary?: string;
}

const MOOD_COLORS: Record<string, string> = {
  great: '#10B981',
  good: '#8B5CF6',
  okay: '#F59E0B',
  low: '#6B7280',
  anxious: '#EF4444',
  happy: '#10B981',
  sad: '#6B7280',
  calm: '#2DD4BF',
};

const MOOD_EMOJIS: Record<string, string> = {
  great: '😊',
  good: '🙂',
  okay: '😐',
  low: '😔',
  anxious: '😰',
  happy: '😊',
  sad: '😢',
  calm: '😌',
};

export default function InsightsScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [insights, setInsights] = useState<InsightData[]>([]);
  const [moodStats, setMoodStats] = useState<any>(null);
  const [recentSessions, setRecentSessions] = useState<SessionSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadAllData();
    }, [])
  );

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      loadProfile(),
      loadInsights(),
      loadMoodStats(),
      loadRecentSessions(),
    ]);
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

  const loadProfile = async () => {
    try {
      const response = await fetch(`${API_URL}/api/profile`);
      if (response.ok) setProfile(await response.json());
    } catch (e) { console.error(e); }
  };

  const loadInsights = async () => {
    try {
      const response = await fetch(`${API_URL}/api/insights`);
      if (response.ok) {
        const data = await response.json();
        setInsights(data.insights || []);
      } else {
        // Fallback insights
        setInsights([
          { insight: "You tend to feel better on days you journal in the morning.", type: 'pattern' },
          { insight: "This week you've been more reflective than usual - that's growth!", type: 'celebration' },
        ]);
      }
    } catch (e) {
      console.error(e);
      setInsights([
        { insight: "Start tracking your mood to discover patterns.", type: 'pattern' },
      ]);
    }
  };

  const loadMoodStats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/moods/stats?days=7`);
      if (response.ok) {
        const data = await response.json();
        setMoodStats(data);
      }
    } catch (e) { console.error(e); }
  };

  const loadRecentSessions = async () => {
    try {
      const response = await fetch(`${API_URL}/api/conversations?type=chat`);
      if (response.ok) {
        const data = await response.json();
        // Transform conversations to session summaries
        const sessions = data.slice(0, 5).map((conv: any) => ({
          id: conv.id,
          date: conv.updatedAt || conv.createdAt,
          type: conv.type,
          mood: conv.mood,
          duration: conv.messages?.length || 0,
        }));
        setRecentSessions(sessions);
      }
    } catch (e) { console.error(e); }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getMoodDistributionBars = () => {
    if (!moodStats?.moodDistribution) return null;
    const total = moodStats.totalLogs || 1;
    const moods = Object.entries(moodStats.moodDistribution) as [string, number][];

    return moods.map(([mood, count]) => ({
      mood,
      percentage: (count / total) * 100,
      color: MOOD_COLORS[mood] || Colors.dark.textMuted,
    }));
  };

  const renderMoodTrend = () => {
    const bars = getMoodDistributionBars();
    if (!bars || bars.length === 0) {
      return (
        <View style={styles.emptyMood}>
          <MaterialCommunityIcons name="chart-line" size={32} color={Colors.dark.textMuted} />
          <Typo variant="caption" color={Colors.dark.textMuted} style={{ marginTop: 8 }}>
            Log moods to see your trend
          </Typo>
        </View>
      );
    }

    return (
      <View style={styles.moodBars}>
        {bars.map(({ mood, percentage, color }) => (
          <View key={mood} style={styles.moodBarContainer}>
            <View style={[styles.moodBar, { height: `${Math.max(percentage, 10)}%`, backgroundColor: color }]} />
            <Typo variant="caption" style={{ marginTop: 4 }}>{MOOD_EMOJIS[mood] || '😐'}</Typo>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={[Colors.dark.background, '#1e1b4b']} style={StyleSheet.absoluteFill} />

      <GlassView intensity={50} style={styles.header}>
        <SafeAreaView>
          <View style={styles.headerContent}>
            <View>
              <Typo variant="h2" weight="bold">Your Journey</Typo>
              <Typo variant="caption" color={Colors.dark.textMuted}>Insights & Progress</Typo>
            </View>
            {profile?.currentStreak > 0 && (
              <View style={styles.streakBadge}>
                <MaterialCommunityIcons name="fire" size={20} color="#F59E0B" />
                <Typo variant="body" weight="bold" style={{ marginLeft: 4 }}>
                  {profile.currentStreak}
                </Typo>
              </View>
            )}
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
        {/* This Week's Mood */}
        <BentoCard title="This Week's Mood" style={styles.moodCard}>
          {renderMoodTrend()}
        </BentoCard>

        {/* AI Insights */}
        <View style={styles.insightsSection}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="lightbulb-on" size={20} color={Colors.dark.secondary} />
            <Typo variant="label" weight="bold" style={{ marginLeft: 8 }}>AI INSIGHTS</Typo>
          </View>

          {insights.length > 0 ? (
            insights.map((insight, index) => (
              <BentoCard key={index} style={styles.insightCard}>
                <View style={styles.insightContent}>
                  <MaterialCommunityIcons
                    name={insight.type === 'celebration' ? 'party-popper' : insight.type === 'pattern' ? 'chart-timeline-variant' : 'link-variant'}
                    size={24}
                    color={insight.type === 'celebration' ? '#F59E0B' : Colors.dark.primary}
                  />
                  <Typo variant="body" style={styles.insightText}>
                    "{insight.insight}"
                  </Typo>
                </View>
              </BentoCard>
            ))
          ) : (
            <BentoCard style={styles.insightCard}>
              <View style={styles.emptyInsight}>
                <MaterialCommunityIcons name="brain" size={32} color={Colors.dark.textMuted} />
                <Typo variant="body" color={Colors.dark.textMuted} style={{ marginTop: 8 }}>
                  Chat more to unlock personalized insights
                </Typo>
              </View>
            </BentoCard>
          )}
        </View>

        {/* Recent Sessions */}
        <View style={styles.sessionsSection}>
          <Typo variant="label" weight="bold" style={styles.sectionTitle}>
            Recent Sessions
          </Typo>

          {recentSessions.length > 0 ? (
            recentSessions.map((session, index) => (
              <TouchableOpacity key={session.id || index} style={styles.sessionItem}>
                <GlassView intensity={15} style={styles.sessionContent}>
                  <View style={styles.sessionLeft}>
                    <View style={[styles.sessionIcon, { backgroundColor: Colors.dark.primary + '20' }]}>
                      <MaterialCommunityIcons
                        name={session.type === 'journal' ? 'notebook-outline' : 'chat-processing-outline'}
                        size={20}
                        color={Colors.dark.primary}
                      />
                    </View>
                    <View style={styles.sessionInfo}>
                      <Typo variant="body" weight="medium">
                        {session.type === 'journal' ? 'Journal Entry' : 'Talk Session'}
                      </Typo>
                      <Typo variant="caption" color={Colors.dark.textMuted}>
                        {formatDate(session.date)} • {session.duration || 0} messages
                      </Typo>
                    </View>
                  </View>
                  {session.mood && (
                    <View style={[styles.moodTag, { backgroundColor: (MOOD_COLORS[session.mood] || Colors.dark.textMuted) + '20' }]}>
                      <Typo variant="caption">{MOOD_EMOJIS[session.mood] || '😐'}</Typo>
                    </View>
                  )}
                </GlassView>
              </TouchableOpacity>
            ))
          ) : (
            <GlassView intensity={15} style={styles.emptySession}>
              <MaterialCommunityIcons name="history" size={32} color={Colors.dark.textMuted} />
              <Typo variant="body" color={Colors.dark.textMuted} style={{ marginTop: 8 }}>
                Your conversations will appear here
              </Typo>
            </GlassView>
          )}
        </View>

        {/* Stats Summary */}
        <View style={styles.statsRow}>
          <GlassView intensity={20} style={styles.statCard}>
            <MaterialCommunityIcons name="fire" size={28} color="#F59E0B" />
            <Typo variant="h2" weight="bold" style={{ marginTop: 8 }}>{profile?.currentStreak || 0}</Typo>
            <Typo variant="caption" color={Colors.dark.textMuted}>Current Streak</Typo>
          </GlassView>
          <GlassView intensity={20} style={styles.statCard}>
            <MaterialCommunityIcons name="trophy" size={28} color={Colors.dark.primary} />
            <Typo variant="h2" weight="bold" style={{ marginTop: 8 }}>{profile?.longestStreak || 0}</Typo>
            <Typo variant="caption" color={Colors.dark.textMuted}>Best Streak</Typo>
          </GlassView>
          <GlassView intensity={20} style={styles.statCard}>
            <MaterialCommunityIcons name="notebook-outline" size={28} color={Colors.dark.secondary} />
            <Typo variant="h2" weight="bold" style={{ marginTop: 8 }}>{profile?.totalJournalDays || 0}</Typo>
            <Typo variant="caption" color={Colors.dark.textMuted}>Total Entries</Typo>
          </GlassView>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
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
    alignItems: 'center',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  content: {
    padding: 20,
    paddingBottom: 120,
  },
  moodCard: {
    marginBottom: 24,
    minHeight: 160,
  },
  moodBars: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 120,
    paddingTop: 16,
  },
  moodBarContainer: {
    alignItems: 'center',
    flex: 1,
  },
  moodBar: {
    width: 24,
    borderRadius: 12,
    minHeight: 10,
  },
  emptyMood: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  insightsSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  insightCard: {
    marginBottom: 12,
  },
  insightContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  insightText: {
    flex: 1,
    fontStyle: 'italic',
    lineHeight: 22,
  },
  emptyInsight: {
    alignItems: 'center',
    padding: 16,
  },
  sessionsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  sessionItem: {
    marginBottom: 8,
  },
  sessionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
  },
  sessionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sessionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sessionInfo: {
    marginLeft: 12,
    flex: 1,
  },
  moodTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  emptySession: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
});
