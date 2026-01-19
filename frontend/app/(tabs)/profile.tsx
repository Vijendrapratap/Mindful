import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Switch,
  Alert,
  Platform,
  Dimensions,
  TextInput,
  InteractionManager
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../../constants/Colors';
import { GlassView } from '../../components/ui/GlassView';
import { Typo } from '../../components/ui/Typo';
import { BentoCard } from '../../components/ui/BentoCard';
import { GradientButton } from '../../components/ui/GradientButton';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';
const { width } = Dimensions.get('window');

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [preferences, setPreferences] = useState({
    voiceEnabled: true,
    notificationsEnabled: true,
  });

  // Edit State
  const [editForm, setEditForm] = useState({
    name: '',
    age: '',
    gender: '',
    profilePic: null as string | null,
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
        if (data.preferences) setPreferences(data.preferences);
        setEditForm({
          name: data.name || '',
          age: data.age?.toString() || '',
          gender: data.gender || '',
          profilePic: data.profilePic || null,
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const handleSaveProfile = async () => {
    try {
      const response = await fetch(`${API_URL}/api/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          age: parseInt(editForm.age) || null,
          gender: editForm.gender,
          profilePic: editForm.profilePic
        }),
      });
      if (response.ok) {
        const updated = await response.json();
        setProfile(updated);
        setIsEditing(false);
        Alert.alert('Success', 'Profile updated!');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setEditForm(prev => ({
        ...prev,
        profilePic: `data:image/jpeg;base64,${result.assets[0].base64}`
      }));
    }
  };

  const updatePreferences = async (newPreferences: any) => {
    try {
      const response = await fetch(`${API_URL}/api/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: newPreferences }), // Wrap in preferences key if backend expects simple dict merge, but checking backend logic: update_profile accepts flat dict. 
        // Backend: {'$set': profile_data}. So we should pass {preferences: newPreferences} to update JUST preferences nested object, OR pass full object?
        // Checking server.py: update_profile takes profile_data: dict and does $set. UserProfile model has preferences: dict.
        // So passing { "preferences": { ... } } is correct to update that field.
      });
      if (response.ok) setPreferences(newPreferences);
    } catch (error) {
      console.error('Error updating preferences:', error);
    }
  };

  const clearAllData = () => {
    Alert.alert('Clear All Data', 'Cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.clear();
          Alert.alert('Success', 'Local data cleared');
          loadProfile();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={[Colors.dark.background, '#1e1b4b']} style={StyleSheet.absoluteFill} />

      <GlassView intensity={50} style={styles.header}>
        <SafeAreaView>
          <View style={styles.headerContent}>
            <View>
              <Typo variant="h2" weight="bold">Profile</Typo>
              <Typo variant="caption">Manage your journey</Typo>
            </View>
            <TouchableOpacity onPress={() => isEditing ? handleSaveProfile() : setIsEditing(true)}>
              <Typo variant="body" weight="bold" color={Colors.dark.primary}>
                {isEditing ? 'Save' : 'Edit'}
              </Typo>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </GlassView>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile Header Card */}
        <BentoCard style={{ alignItems: 'center', marginBottom: 24 }}>
          <TouchableOpacity onPress={isEditing ? pickImage : undefined} disabled={!isEditing}>
            <View style={styles.avatarContainer}>
              {editForm.profilePic ? (
                <Image source={{ uri: editForm.profilePic }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, { backgroundColor: Colors.dark.surface, justifyContent: 'center', alignItems: 'center' }]}>
                  <MaterialCommunityIcons name="account" size={48} color={Colors.dark.textMuted} />
                </View>
              )}
              {isEditing && (
                <View style={styles.editBadge}>
                  <MaterialCommunityIcons name="camera" size={16} color="white" />
                </View>
              )}
            </View>
          </TouchableOpacity>

          {isEditing ? (
            <View style={{ width: '100%', gap: 12, marginTop: 16 }}>
              <View style={styles.inputGroup}>
                <Typo variant="caption">Name</Typo>
                <TextInput
                  style={styles.input}
                  value={editForm.name}
                  onChangeText={t => setEditForm(p => ({ ...p, name: t }))}
                  placeholder="Your Name"
                  placeholderTextColor={Colors.dark.textMuted}
                />
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Typo variant="caption">Age</Typo>
                  <TextInput
                    style={styles.input}
                    value={editForm.age}
                    onChangeText={t => setEditForm(p => ({ ...p, age: t }))}
                    placeholder="Age"
                    keyboardType="numeric"
                    placeholderTextColor={Colors.dark.textMuted}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 2 }]}>
                  <Typo variant="caption">Gender</Typo>
                  <TextInput
                    style={styles.input}
                    value={editForm.gender}
                    onChangeText={t => setEditForm(p => ({ ...p, gender: t }))}
                    placeholder="Gender"
                    placeholderTextColor={Colors.dark.textMuted}
                  />
                </View>
              </View>
            </View>
          ) : (
            <View style={{ alignItems: 'center', marginTop: 12 }}>
              <Typo variant="h3" weight="bold">{profile?.name || 'Mindful User'}</Typo>
              <Typo variant="body" color={Colors.dark.textMuted}>
                {[
                  profile?.age ? `${profile.age} years old` : null,
                  profile?.gender
                ].filter(Boolean).join(' • ') || 'Complete your profile'}
              </Typo>
            </View>
          )}
        </BentoCard>

        <Typo variant="label" style={{ marginBottom: 12 }}>Your Journey</Typo>
        <View style={styles.statsRow}>
          <GlassView intensity={20} style={[styles.statCard, { flex: 1 }]}>
            <MaterialCommunityIcons name="fire" size={32} color="#F59E0B" />
            <Typo variant="h2" weight="bold" style={{ marginTop: 8 }}>{profile?.currentStreak || 0}</Typo>
            <Typo variant="caption">Current Streak</Typo>
          </GlassView>
          <GlassView intensity={20} style={[styles.statCard, { flex: 1 }]}>
            <MaterialCommunityIcons name="trophy" size={32} color={Colors.dark.primary} />
            <Typo variant="h2" weight="bold" style={{ marginTop: 8 }}>{profile?.longestStreak || 0}</Typo>
            <Typo variant="caption">Longest Streak</Typo>
          </GlassView>
        </View>

        {/* Personality Section */}
        <View style={{ marginBottom: 24 }}>
          <Typo variant="label" style={{ marginBottom: 12 }}>Personality</Typo>
          {profile?.personalityType ? (
            <BentoCard onPress={() => router.push('/personality')}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.dark.primary, justifyContent: 'center', alignItems: 'center' }}>
                  <Typo variant="h2" weight="bold">
                    {profile.personalityType[0]}
                  </Typo>
                </View>
                <View style={{ flex: 1 }}>
                  <Typo variant="h3" weight="bold">{profile.personalityType}</Typo>
                  <Typo variant="caption" color={Colors.dark.textMuted}>Tap to retake assessment</Typo>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color={Colors.dark.textMuted} />
              </View>
            </BentoCard>
          ) : (
            <TouchableOpacity onPress={() => router.push('/personality')}>
              <LinearGradient
                colors={[Colors.dark.primary, Colors.dark.secondary]}
                style={{ padding: 20, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <View>
                  <Typo variant="h3" weight="bold">Discover Yourself</Typo>
                  <Typo variant="caption" style={{ opacity: 0.8 }}>Take the personality assessment</Typo>
                </View>
                <MaterialCommunityIcons name="arrow-right" size={24} color="white" />
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        <BentoCard>
          <View style={styles.statRow}>
            <MaterialCommunityIcons name="book-open-variant" size={24} color={Colors.dark.secondary} />
            <Typo variant="body" style={{ flex: 1, marginLeft: 12 }}>Total Journal Entries</Typo>
            <Typo variant="h3" weight="bold">{profile?.totalJournalDays || 0}</Typo>
          </View>
        </BentoCard>

        <View style={styles.section}>
          <Typo variant="label" style={{ marginBottom: 12, marginTop: 24 }}>Preferences</Typo>
          <BentoCard>
            <PreferenceItem
              icon="volume-high"
              title="Voice Responses"
              subtitle="AI will speak responses aloud"
              value={preferences.voiceEnabled}
              onValueChange={(v: boolean) => updatePreferences({ ...preferences, voiceEnabled: v })}
            />
            <View style={styles.divider} />
            <PreferenceItem
              icon="bell-outline"
              title="Notifications"
              subtitle="Daily reminders to journal"
              value={preferences.notificationsEnabled}
              onValueChange={(v: boolean) => updatePreferences({ ...preferences, notificationsEnabled: v })}
            />
          </BentoCard>
        </View>

        <View style={styles.section}>
          <Typo variant="label" style={{ marginBottom: 12, marginTop: 24 }}>Support</Typo>
          <GlassView intensity={20} style={{ borderRadius: 24, overflow: 'hidden' }}>
            <MenuItem icon="information-outline" title="About MindfulMe" />
            <View style={styles.divider} />
            <MenuItem icon="shield-check-outline" title="Privacy Policy" />
            <View style={styles.divider} />
            <MenuItem icon="help-circle-outline" title="Help & Support" />
          </GlassView>
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.dangerButton} onPress={clearAllData}>
            <GlassView intensity={10} style={styles.dangerInner}>
              <MaterialCommunityIcons name="delete-outline" size={24} color={Colors.dark.error} />
              <Typo variant="body" weight="medium" color={Colors.dark.error}>Clear All Data</Typo>
            </GlassView>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <MaterialCommunityIcons name="leaf" size={24} color={Colors.dark.primary} />
          <Typo variant="caption" style={{ marginTop: 8 }}>MindfulMe v1.0</Typo>
        </View>
      </ScrollView>
    </View>
  );
}

const PreferenceItem = ({ icon, title, subtitle, value, onValueChange }: any) => (
  <View style={styles.prefItem}>
    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
      <View style={styles.iconBox}>
        <MaterialCommunityIcons name={icon} size={20} color={Colors.dark.textMuted} />
      </View>
      <View style={{ marginLeft: 12 }}>
        <Typo variant="body" weight="medium">{title}</Typo>
        <Typo variant="caption" style={{ opacity: 0.7 }}>{subtitle}</Typo>
      </View>
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: Colors.dark.surface, true: Colors.dark.primary }}
      thumbColor="white"
    />
  </View>
);

const MenuItem = ({ icon, title }: any) => (
  <TouchableOpacity style={styles.menuItem}>
    <View style={styles.iconBox}>
      <MaterialCommunityIcons name={icon} size={20} color={Colors.dark.textMuted} />
    </View>
    <Typo variant="body" style={{ flex: 1, marginLeft: 12 }}>{title}</Typo>
    <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.dark.textMuted} />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { borderBottomWidth: 1, borderBottomColor: Colors.dark.glassBorder, paddingTop: Platform.OS === 'android' ? 40 : 0 },
  headerContent: { padding: 20, paddingBottom: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  content: { padding: 20, paddingBottom: 100 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statCard: { padding: 20, borderRadius: 24, alignItems: 'center', gap: 4 },
  statRow: { flexDirection: 'row', alignItems: 'center' },
  section: {},
  prefItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  iconBox: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
  divider: { height: 1, backgroundColor: Colors.dark.glassBorder, marginLeft: 56 },
  dangerButton: { marginTop: 24 },
  dangerInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 20, gap: 8, borderWidth: 1, borderColor: Colors.dark.error + '50' },
  footer: { alignItems: 'center', padding: 40, opacity: 0.5 },
  avatarContainer: { position: 'relative' },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: Colors.dark.glassBorder },
  editBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: Colors.dark.primary, width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.dark.background },
  inputGroup: { marginBottom: 0 },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12, color: 'white', marginTop: 4, borderWidth: 1, borderColor: Colors.dark.glassBorder }
});