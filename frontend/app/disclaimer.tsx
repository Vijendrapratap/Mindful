import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../constants/Colors';
import { Typo } from '../components/ui/Typo';
import { GlassView } from '../components/ui/GlassView';
import { GradientButton } from '../components/ui/GradientButton';

const DISCLAIMER_POINTS = [
  {
    icon: 'medical-bag',
    title: 'Not a Replacement for Professional Care',
    description: 'MindfulMe is a wellness companion, not a licensed therapist, psychologist, or medical professional. It cannot diagnose, treat, or cure any mental health condition.',
  },
  {
    icon: 'alert-circle',
    title: 'In Case of Emergency',
    description: 'If you are experiencing a mental health crisis, suicidal thoughts, or are in danger, please contact emergency services (911) or a crisis helpline (988) immediately.',
  },
  {
    icon: 'robot',
    title: 'AI Limitations',
    description: 'MindfulMe uses AI to provide responses. While designed to be supportive, AI can make mistakes and may not always understand the full context of your situation.',
  },
  {
    icon: 'account-heart',
    title: 'Seek Professional Help',
    description: 'For serious mental health concerns, we strongly encourage you to seek help from qualified mental health professionals who can provide personalized care.',
  },
];

const CRISIS_RESOURCES = [
  { name: '988 Suicide & Crisis Lifeline', number: '988' },
  { name: 'Crisis Text Line', number: 'Text HOME to 741741' },
  { name: 'Emergency Services', number: '911' },
];

export default function DisclaimerScreen() {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);

  const handleAccept = async () => {
    if (!accepted) return;
    try {
      await AsyncStorage.setItem('disclaimerAccepted', 'true');
      // Check if onboarding is complete
      const onboardingComplete = await AsyncStorage.getItem('onboardingComplete');
      if (onboardingComplete === 'true') {
        router.replace('/(tabs)/home');
      } else {
        router.replace('/onboarding');
      }
    } catch (error) {
      console.error('Error accepting disclaimer:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.dark.background }]} />

      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <LinearGradient
              colors={['#F59E61', '#C01537']}
              style={styles.iconCircle}
            >
              <MaterialCommunityIcons name="alert-decagram" size={48} color="white" />
            </LinearGradient>
            <Typo variant="h2" weight="bold" align="center" style={styles.title}>
              Important Information
            </Typo>
            <Typo variant="body" align="center" color={Colors.dark.textMuted} style={styles.subtitle}>
              Please read before continuing
            </Typo>
          </View>

          {/* Disclaimer Points */}
          <View style={styles.pointsContainer}>
            {DISCLAIMER_POINTS.map((point, index) => (
              <GlassView key={index} intensity={20} style={styles.pointCard}>
                <View style={styles.pointIcon}>
                  <MaterialCommunityIcons
                    name={point.icon as any}
                    size={24}
                    color={point.icon === 'alert-circle' ? Colors.dark.error : Colors.dark.primary}
                  />
                </View>
                <View style={styles.pointContent}>
                  <Typo variant="body" weight="bold" style={styles.pointTitle}>
                    {point.title}
                  </Typo>
                  <Typo variant="caption" color={Colors.dark.textMuted} style={styles.pointDescription}>
                    {point.description}
                  </Typo>
                </View>
              </GlassView>
            ))}
          </View>

          {/* Crisis Resources */}
          <View style={styles.crisisSection}>
            <Typo variant="label" color={Colors.dark.error} style={styles.crisisTitle}>
              CRISIS RESOURCES
            </Typo>
            <GlassView intensity={30} style={styles.crisisCard}>
              {CRISIS_RESOURCES.map((resource, index) => (
                <View key={index} style={styles.resourceRow}>
                  <MaterialCommunityIcons name="phone" size={18} color={Colors.dark.primary} />
                  <Typo variant="body" weight="medium" style={{ marginLeft: 12 }}>
                    {resource.name}:
                  </Typo>
                  <Typo variant="body" color={Colors.dark.primary} style={{ marginLeft: 4 }}>
                    {resource.number}
                  </Typo>
                </View>
              ))}
            </GlassView>
          </View>

          {/* Agreement Checkbox */}
          <TouchableOpacity
            onPress={() => setAccepted(!accepted)}
            style={styles.agreementRow}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>
              {accepted && (
                <MaterialCommunityIcons name="check" size={16} color="white" />
              )}
            </View>
            <Typo variant="body" style={styles.agreementText}>
              I understand that MindfulMe is not a substitute for professional mental health care and agree to use it responsibly.
            </Typo>
          </TouchableOpacity>
        </ScrollView>

        {/* Continue Button */}
        <View style={styles.footer}>
          <GradientButton
            title="I Understand & Accept"
            onPress={handleAccept}
            disabled={!accepted}
            icon="check"
          />
          <Typo variant="caption" align="center" color={Colors.dark.textMuted} style={styles.footerNote}>
            You can access crisis resources anytime from the app settings
          </Typo>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: Platform.OS === 'android' ? 40 : 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    paddingHorizontal: 20,
  },
  pointsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  pointCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  pointIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.dark.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  pointContent: {
    flex: 1,
  },
  pointTitle: {
    marginBottom: 4,
  },
  pointDescription: {
    lineHeight: 18,
  },
  crisisSection: {
    marginBottom: 24,
  },
  crisisTitle: {
    marginBottom: 12,
  },
  crisisCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.error + '30',
    gap: 12,
  },
  resourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  agreementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.dark.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: Colors.dark.primary,
  },
  agreementText: {
    flex: 1,
    lineHeight: 22,
  },
  footer: {
    padding: 24,
    paddingBottom: 40,
  },
  footerNote: {
    marginTop: 12,
  },
});
