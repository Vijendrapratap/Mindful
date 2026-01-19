import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  Animated,
  Dimensions,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../constants/Colors';
import { Typo } from '../components/ui/Typo';
import { GlassView } from '../components/ui/GlassView';
import { GradientButton } from '../components/ui/GradientButton';

const { width, height } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

const INTENTS = [
  { id: 'anxiety', label: 'Manage anxiety', icon: 'weather-windy' },
  { id: 'sleep', label: 'Better sleep', icon: 'weather-night' },
  { id: 'discovery', label: 'Self-discovery', icon: 'compass' },
  { id: 'vent', label: 'Just need to vent', icon: 'chat-processing' },
  { id: 'mood', label: 'Track my mood', icon: 'chart-line' },
];

const REFLECTION_TIMES = [
  { id: 'morning', label: 'Morning', icon: 'weather-sunny', description: 'Start your day mindfully' },
  { id: 'evening', label: 'Evening', icon: 'weather-night', description: 'Reflect before bed' },
  { id: 'whenever', label: 'Whenever', icon: 'clock-outline', description: 'No specific time' },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Onboarding data
  const [selectedIntents, setSelectedIntents] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [reflectionTime, setReflectionTime] = useState('');
  const [loading, setLoading] = useState(false);

  const animateTransition = (callback: () => void) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -50, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      callback();
      slideAnim.setValue(50);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  };

  const nextStep = () => {
    if (step < 3) {
      animateTransition(() => setStep(step + 1));
    }
  };

  const prevStep = () => {
    if (step > 0) {
      animateTransition(() => setStep(step - 1));
    }
  };

  const toggleIntent = (intentId: string) => {
    setSelectedIntents(prev =>
      prev.includes(intentId)
        ? prev.filter(i => i !== intentId)
        : [...prev, intentId]
    );
  };

  const completeOnboarding = async () => {
    setLoading(true);
    try {
      // Save onboarding data to backend
      const response = await fetch(`${API_URL}/api/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          intents: selectedIntents,
          reflectionTime,
        }),
      });

      if (response.ok) {
        // Mark onboarding as complete locally
        await AsyncStorage.setItem('onboardingComplete', 'true');
        router.replace('/(tabs)/home');
      } else {
        // Still proceed even if API fails
        await AsyncStorage.setItem('onboardingComplete', 'true');
        router.replace('/(tabs)/home');
      }
    } catch (error) {
      console.error('Onboarding error:', error);
      // Still proceed even if API fails
      await AsyncStorage.setItem('onboardingComplete', 'true');
      router.replace('/(tabs)/home');
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 0: return selectedIntents.length > 0;
      case 1: return name.trim().length > 0;
      case 2: return reflectionTime !== '';
      case 3: return true;
      default: return false;
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <View style={styles.stepContent}>
            <View style={styles.iconHeader}>
              <LinearGradient colors={Colors.dark.accentGradient as any} style={styles.iconCircle}>
                <MaterialCommunityIcons name="hand-wave" size={40} color="white" />
              </LinearGradient>
            </View>
            <Typo variant="h2" weight="bold" align="center" style={styles.title}>
              How can I help you?
            </Typo>
            <Typo variant="body" align="center" color={Colors.dark.textMuted} style={styles.subtitle}>
              Select all that apply
            </Typo>

            <View style={styles.optionsContainer}>
              {INTENTS.map((intent) => (
                <TouchableOpacity
                  key={intent.id}
                  onPress={() => toggleIntent(intent.id)}
                  style={[
                    styles.intentOption,
                    selectedIntents.includes(intent.id) && styles.intentOptionSelected
                  ]}
                >
                  <GlassView
                    intensity={selectedIntents.includes(intent.id) ? 40 : 20}
                    style={[
                      styles.intentInner,
                      selectedIntents.includes(intent.id) && styles.intentInnerSelected
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={intent.icon as any}
                      size={24}
                      color={selectedIntents.includes(intent.id) ? Colors.dark.primary : Colors.dark.textMuted}
                    />
                    <Typo
                      variant="body"
                      weight={selectedIntents.includes(intent.id) ? 'bold' : 'regular'}
                      style={{ marginLeft: 12 }}
                    >
                      {intent.label}
                    </Typo>
                    {selectedIntents.includes(intent.id) && (
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={20}
                        color={Colors.dark.primary}
                        style={{ marginLeft: 'auto' }}
                      />
                    )}
                  </GlassView>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 1:
        return (
          <View style={styles.stepContent}>
            <View style={styles.iconHeader}>
              <LinearGradient colors={[Colors.dark.secondary, Colors.dark.primary]} style={styles.iconCircle}>
                <MaterialCommunityIcons name="account-heart" size={40} color="white" />
              </LinearGradient>
            </View>
            <Typo variant="h2" weight="bold" align="center" style={styles.title}>
              What should I call you?
            </Typo>
            <Typo variant="body" align="center" color={Colors.dark.textMuted} style={styles.subtitle}>
              I'd love to get to know you better
            </Typo>

            <View style={styles.inputContainer}>
              <GlassView intensity={30} style={styles.inputWrapper}>
                <TextInput
                  style={styles.nameInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor={Colors.dark.textMuted}
                  autoFocus
                  autoCapitalize="words"
                />
              </GlassView>
            </View>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContent}>
            <View style={styles.iconHeader}>
              <LinearGradient colors={['#F59E0B', '#EF4444']} style={styles.iconCircle}>
                <MaterialCommunityIcons name="clock-time-four" size={40} color="white" />
              </LinearGradient>
            </View>
            <Typo variant="h2" weight="bold" align="center" style={styles.title}>
              When do you prefer to reflect?
            </Typo>
            <Typo variant="body" align="center" color={Colors.dark.textMuted} style={styles.subtitle}>
              I'll remind you at the right time
            </Typo>

            <View style={styles.timeOptionsContainer}>
              {REFLECTION_TIMES.map((time) => (
                <TouchableOpacity
                  key={time.id}
                  onPress={() => setReflectionTime(time.id)}
                  style={styles.timeOption}
                >
                  <GlassView
                    intensity={reflectionTime === time.id ? 40 : 20}
                    style={[
                      styles.timeOptionInner,
                      reflectionTime === time.id && styles.timeOptionSelected
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={time.icon as any}
                      size={32}
                      color={reflectionTime === time.id ? Colors.dark.primary : Colors.dark.textMuted}
                    />
                    <Typo
                      variant="body"
                      weight={reflectionTime === time.id ? 'bold' : 'regular'}
                      style={{ marginTop: 8 }}
                    >
                      {time.label}
                    </Typo>
                    <Typo variant="caption" color={Colors.dark.textMuted} align="center">
                      {time.description}
                    </Typo>
                  </GlassView>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContent}>
            <View style={styles.iconHeader}>
              <LinearGradient colors={Colors.dark.accentGradient as any} style={[styles.iconCircle, { width: 100, height: 100, borderRadius: 50 }]}>
                <MaterialCommunityIcons name="leaf" size={56} color="white" />
              </LinearGradient>
            </View>
            <Typo variant="h1" weight="bold" align="center" style={styles.title}>
              Hi, {name}!
            </Typo>
            <Typo variant="h3" align="center" color={Colors.dark.textMuted} style={styles.subtitle}>
              I'm MindfulMe
            </Typo>
            <Typo variant="body" align="center" color={Colors.dark.textMuted} style={[styles.subtitle, { marginTop: 16, paddingHorizontal: 20 }]}>
              I'm here to listen, remember what matters to you, and help you understand yourself better.
            </Typo>

            <View style={styles.readyContainer}>
              <GlassView intensity={20} style={styles.readyCard}>
                <MaterialCommunityIcons name="check-circle" size={24} color={Colors.dark.success} />
                <Typo variant="body" style={{ marginLeft: 12 }}>Ready when you are</Typo>
              </GlassView>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.dark.background }]} />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          {/* Progress indicator */}
          <View style={styles.progressContainer}>
            {step > 0 && (
              <TouchableOpacity onPress={prevStep} style={styles.backButton}>
                <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.dark.text} />
              </TouchableOpacity>
            )}
            <View style={styles.progressDots}>
              {[0, 1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.progressDot,
                    i === step && styles.progressDotActive,
                    i < step && styles.progressDotComplete
                  ]}
                />
              ))}
            </View>
            <View style={{ width: 40 }} />
          </View>

          {/* Step content */}
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View
              style={[
                styles.animatedContent,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }]
                }
              ]}
            >
              {renderStep()}
            </Animated.View>
          </ScrollView>

          {/* Navigation */}
          <View style={styles.navigation}>
            {step < 3 ? (
              <GradientButton
                title="Continue"
                onPress={nextStep}
                disabled={!canProceed()}
                icon="arrow-forward"
              />
            ) : (
              <GradientButton
                title={loading ? "Getting ready..." : "Start My Journey"}
                onPress={completeOnboarding}
                disabled={loading}
                icon="rocket-launch"
              />
            )}

            {step === 0 && (
              <TouchableOpacity
                onPress={async () => {
                  await AsyncStorage.setItem('onboardingComplete', 'true');
                  router.replace('/(tabs)/home');
                }}
                style={styles.skipButton}
              >
                <Typo variant="caption" color={Colors.dark.textMuted}>Skip for now</Typo>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
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
  keyboardView: {
    flex: 1,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 10,
    paddingBottom: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.surfaceHover,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressDots: {
    flexDirection: 'row',
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  progressDotActive: {
    width: 24,
    backgroundColor: Colors.dark.primary,
  },
  progressDotComplete: {
    backgroundColor: Colors.dark.success,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  animatedContent: {
    flex: 1,
    justifyContent: 'center',
  },
  stepContent: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  iconHeader: {
    marginBottom: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    marginBottom: 32,
  },
  optionsContainer: {
    width: '100%',
    gap: 12,
  },
  intentOption: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  intentOptionSelected: {},
  intentInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  intentInnerSelected: {
    borderColor: Colors.dark.primary,
  },
  inputContainer: {
    width: '100%',
    paddingHorizontal: 20,
  },
  inputWrapper: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  nameInput: {
    padding: 20,
    fontSize: 18,
    color: Colors.dark.text,
    textAlign: 'center',
  },
  timeOptionsContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  timeOption: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  timeOptionInner: {
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 130,
  },
  timeOptionSelected: {
    borderColor: Colors.dark.primary,
  },
  readyContainer: {
    marginTop: 32,
    width: '100%',
  },
  readyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  navigation: {
    padding: 24,
    paddingBottom: 40,
    gap: 16,
    alignItems: 'center',
  },
  skipButton: {
    padding: 8,
  },
});
