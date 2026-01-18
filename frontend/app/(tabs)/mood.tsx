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
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

const MOODS = [
  { value: 'great', label: 'Great', icon: 'emoticon-excited', color: '#10B981' },
  { value: 'good', label: 'Good', icon: 'emoticon-happy', color: '#3B82F6' },
  { value: 'okay', label: 'Okay', icon: 'emoticon-neutral', color: '#F59E0B' },
  { value: 'bad', label: 'Bad', icon: 'emoticon-sad', color: '#F97316' },
  { value: 'terrible', label: 'Terrible', icon: 'emoticon-cry', color: '#EF4444' },
];

const { width } = Dimensions.get('window');

export default function MoodScreen() {
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [intensity, setIntensity] = useState(5);
  const [note, setNote] = useState('');
  const [recentMoods, setRecentMoods] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadRecentMoods();
    loadStats();
  }, []);

  const loadRecentMoods = async () => {
    try {
      const response = await fetch(`${API_URL}/api/moods?days=7`);
      if (response.ok) {
        const data = await response.json();
        setRecentMoods(data);
      }
    } catch (error) {
      console.error('Error loading moods:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/moods/stats?days=30`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const logMood = async () => {
    if (!selectedMood) {
      Alert.alert('Select a mood', 'Please select how you\'re feeling');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/moods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mood: selectedMood,
          intensity,
          note: note.trim() || null,
        }),
      });

      if (response.ok) {
        Alert.alert('Logged!', 'Your mood has been recorded');
        setSelectedMood(null);
        setIntensity(5);
        setNote('');
        await loadRecentMoods();
        await loadStats();
      }
    } catch (error) {
      console.error('Error logging mood:', error);
      Alert.alert('Error', 'Failed to log mood');
    } finally {
      setLoading(false);
    }
  };

  const getMoodIcon = (moodValue: string) => {
    const mood = MOODS.find(m => m.value === moodValue);
    return mood || MOODS[2];
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Mood Tracker</Text>
          <Text style={styles.headerSubtitle}>How are you feeling?</Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Mood Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select your mood</Text>
          <View style={styles.moodGrid}>
            {MOODS.map(mood => (
              <TouchableOpacity
                key={mood.value}
                style={[
                  styles.moodButton,
                  selectedMood === mood.value && {
                    backgroundColor: mood.color + '20',
                    borderColor: mood.color,
                  },
                ]}
                onPress={() => setSelectedMood(mood.value)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name={mood.icon as any}
                  size={48}
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
          </View>
        </View>

        {/* Intensity Slider */}
        {selectedMood && (
          <View style={styles.section}>
            <View style={styles.intensityHeader}>
              <Text style={styles.sectionTitle}>Intensity</Text>
              <Text style={styles.intensityValue}>{intensity}/10</Text>
            </View>
            <View style={styles.sliderContainer}>
              {[...Array(10)].map((_, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.sliderDot,
                    i < intensity && styles.sliderDotActive,
                  ]}
                  onPress={() => setIntensity(i + 1)}
                />
              ))}
            </View>
          </View>
        )}

        {/* Note */}
        {selectedMood && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Add a note (optional)</Text>
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="What's happening?"
              placeholderTextColor="#6B7280"
              multiline
              maxLength={200}
            />
          </View>
        )}

        {/* Log Button */}
        {selectedMood && (
          <TouchableOpacity
            style={styles.logButton}
            onPress={logMood}
            disabled={loading}
          >
            <Text style={styles.logButtonText}>
              {loading ? 'Logging...' : 'Log Mood'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Stats */}
        {stats && stats.totalLogs > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Mood Stats (30 days)</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.totalLogs}</Text>
                <Text style={styles.statLabel}>Total Logs</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {stats.averageIntensity.toFixed(1)}
                </Text>
                <Text style={styles.statLabel}>Avg Intensity</Text>
              </View>
            </View>
          </View>
        )}

        {/* Recent Moods */}
        {recentMoods.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent (7 days)</Text>
            {recentMoods.map((mood, index) => {
              const moodConfig = getMoodIcon(mood.mood);
              return (
                <View key={index} style={styles.moodItem}>
                  <View style={styles.moodItemLeft}>
                    <MaterialCommunityIcons
                      name={moodConfig.icon as any}
                      size={32}
                      color={moodConfig.color}
                    />
                    <View style={styles.moodItemInfo}>
                      <Text style={styles.moodItemLabel}>
                        {moodConfig.label}
                      </Text>
                      <Text style={styles.moodItemTime}>
                        {formatDate(mood.timestamp)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.intensityBadge}>
                    <Text style={styles.intensityBadgeText}>
                      {mood.intensity}/10
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
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
  headerSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F1F',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  moodButton: {
    width: (width - 64) / 3,
    aspectRatio: 1,
    backgroundColor: '#1F1F1F',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  moodLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  intensityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  intensityValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#7C3AED',
  },
  sliderContainer: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  sliderDot: {
    flex: 1,
    height: 8,
    backgroundColor: '#374151',
    borderRadius: 4,
  },
  sliderDotActive: {
    backgroundColor: '#7C3AED',
  },
  noteInput: {
    backgroundColor: '#1F1F1F',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  logButton: {
    marginHorizontal: 20,
    marginVertical: 16,
    backgroundColor: '#7C3AED',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  logButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1F1F1F',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#7C3AED',
  },
  statLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  moodItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1F1F1F',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  moodItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  moodItemInfo: {
    gap: 4,
  },
  moodItemLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  moodItemTime: {
    fontSize: 14,
    color: '#6B7280',
  },
  intensityBadge: {
    backgroundColor: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  intensityBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
});