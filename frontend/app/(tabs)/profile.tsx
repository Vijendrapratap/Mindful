import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Switch,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

export default function ProfileScreen() {
  const [profile, setProfile] = useState<any>(null);
  const [preferences, setPreferences] = useState({
    voiceEnabled: true,
    notificationsEnabled: true,
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await fetch(`${API_URL}/api/profile`);
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
        if (data.preferences) {
          setPreferences(data.preferences);
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const updatePreferences = async (newPreferences: any) => {
    try {
      const response = await fetch(`${API_URL}/api/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPreferences),
      });

      if (response.ok) {
        setPreferences(newPreferences);
      }
    } catch (error) {
      console.error('Error updating preferences:', error);
    }
  };

  const clearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'This will delete all conversations, journals, and mood logs. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.clear();
            Alert.alert('Success', 'All local data has been cleared');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Stats Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Journey</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <MaterialCommunityIcons name="fire" size={32} color="#F59E0B" />
              <Text style={styles.statValue}>{profile?.currentStreak || 0}</Text>
              <Text style={styles.statLabel}>Current Streak</Text>
            </View>
            <View style={styles.statCard}>
              <MaterialCommunityIcons
                name="trophy"
                size={32}
                color="#7C3AED"
              />
              <Text style={styles.statValue}>{profile?.longestStreak || 0}</Text>
              <Text style={styles.statLabel}>Longest Streak</Text>
            </View>
            <View style={styles.statCard}>
              <MaterialCommunityIcons
                name="book-open-variant"
                size={32}
                color="#3B82F6"
              />
              <Text style={styles.statValue}>
                {profile?.totalJournalDays || 0}
              </Text>
              <Text style={styles.statLabel}>Total Journals</Text>
            </View>
          </View>
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          
          <View style={styles.preferenceItem}>
            <View style={styles.preferenceLeft}>
              <MaterialCommunityIcons
                name="volume-high"
                size={24}
                color="#9CA3AF"
              />
              <View style={styles.preferenceInfo}>
                <Text style={styles.preferenceLabel}>Voice Responses</Text>
                <Text style={styles.preferenceSubtext}>
                  AI will speak responses aloud
                </Text>
              </View>
            </View>
            <Switch
              value={preferences.voiceEnabled}
              onValueChange={value =>
                updatePreferences({ ...preferences, voiceEnabled: value })
              }
              trackColor={{ false: '#374151', true: '#7C3AED' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.preferenceItem}>
            <View style={styles.preferenceLeft}>
              <MaterialCommunityIcons
                name="bell-outline"
                size={24}
                color="#9CA3AF"
              />
              <View style={styles.preferenceInfo}>
                <Text style={styles.preferenceLabel}>Notifications</Text>
                <Text style={styles.preferenceSubtext}>
                  Daily reminders to journal
                </Text>
              </View>
            </View>
            <Switch
              value={preferences.notificationsEnabled}
              onValueChange={value =>
                updatePreferences({
                  ...preferences,
                  notificationsEnabled: value,
                })
              }
              trackColor={{ false: '#374151', true: '#7C3AED' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          
          <TouchableOpacity style={styles.menuItem}>
            <MaterialCommunityIcons
              name="information-outline"
              size={24}
              color="#9CA3AF"
            />
            <Text style={styles.menuLabel}>About MindfulMe</Text>
            <MaterialCommunityIcons
              name="chevron-right"
              size={24}
              color="#6B7280"
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <MaterialCommunityIcons
              name="shield-check-outline"
              size={24}
              color="#9CA3AF"
            />
            <Text style={styles.menuLabel}>Privacy Policy</Text>
            <MaterialCommunityIcons
              name="chevron-right"
              size={24}
              color="#6B7280"
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <MaterialCommunityIcons
              name="help-circle-outline"
              size={24}
              color="#9CA3AF"
            />
            <Text style={styles.menuLabel}>Help & Support</Text>
            <MaterialCommunityIcons
              name="chevron-right"
              size={24}
              color="#6B7280"
            />
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data</Text>
          <TouchableOpacity
            style={styles.dangerButton}
            onPress={clearAllData}
          >
            <MaterialCommunityIcons name="delete-outline" size={24} color="#EF4444" />
            <Text style={styles.dangerButtonText}>Clear All Data</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <MaterialCommunityIcons name="leaf" size={24} color="#7C3AED" />
          <Text style={styles.footerText}>MindfulMe v1.0</Text>
          <Text style={styles.footerSubtext}>
            Remember: This is a supportive tool, not a replacement for
            professional mental health care.
          </Text>
        </View>
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
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1F1F1F',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  preferenceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1F1F1F',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  preferenceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  preferenceInfo: {
    flex: 1,
  },
  preferenceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  preferenceSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F1F',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1F1F1F',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  footer: {
    alignItems: 'center',
    padding: 32,
    gap: 8,
  },
  footerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  footerSubtext: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 8,
  },
});