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
  Alert,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Colors } from '../constants/Colors';
import { Typo } from '../components/ui/Typo';
import { GlassView } from '../components/ui/GlassView';
import { GradientButton } from '../components/ui/GradientButton';

const { width, height } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

// Step 1: Goals/Intents
const INTENTS = [
  { id: 'anxiety', label: 'Manage anxiety', icon: 'weather-windy' },
  { id: 'sleep', label: 'Better sleep', icon: 'weather-night' },
  { id: 'discovery', label: 'Self-discovery', icon: 'compass' },
  { id: 'vent', label: 'Just need to vent', icon: 'chat-processing' },
  { id: 'mood', label: 'Track my mood', icon: 'chart-line' },
  { id: 'gratitude', label: 'Practice gratitude', icon: 'heart' },
];

// Step 2: Personality Quiz Questions
const PERSONALITY_QUESTIONS = [
  {
    id: 'q1',
    question: 'When you're stressed, you prefer to:',
    options: [
      { id: 'a', text: 'Talk it through with someone', type: 'E' },
      { id: 'b', text: 'Process it on your own first', type: 'I' },
    ],
  },
  {
    id: 'q2',
    question: 'What helps you feel better after a tough day?',
    options: [
      { id: 'a', text: 'Understanding WHY I feel this way', type: 'T' },
      { id: 'b', text: 'Feeling heard and validated', type: 'F' },
    ],
  },
  {
    id: 'q3',
    question: 'When facing a challenge, you usually:',
    options: [
      { id: 'a', text: 'Make a plan and work through it step by step', type: 'J' },
      { id: 'b', text: 'Stay flexible and adapt as you go', type: 'P' },
    ],
  },
  {
    id: 'q4',
    question: 'You find it easier to talk about:',
    options: [
      { id: 'a', text: 'What happened and the facts', type: 'S' },
      { id: 'b', text: 'How things made you feel', type: 'N' },
    ],
  },
  {
    id: 'q5',
    question: 'In conversations, you value:',
    options: [
      { id: 'a', text: 'Practical advice and solutions', type: 'T' },
      { id: 'b', text: 'Empathy and emotional support', type: 'F' },
    ],
  },
];

// Personality Types based on quiz results
const PERSONALITY_TYPES: Record<string, { name: string; icon: string; description: string; color: string }> = {
  'The Thinker': {
    name: 'The Thinker',
    icon: 'brain',
    description: 'You process emotions through understanding. You appreciate when conversations help you make sense of your feelings and find patterns.',
    color: '#3BB6C6',
  },
  'The Feeler': {
    name: 'The Feeler',
    icon: 'heart',
    description: 'You lead with your heart. You value emotional connection and feel best when your feelings are acknowledged and validated.',
    color: '#F59E61',
  },
  'The Explorer': {
    name: 'The Explorer',
    icon: 'compass',
    description: 'You embrace life\'s journey with curiosity. You\'re open to new perspectives and enjoy discovering insights about yourself.',
    color: '#22C55E',
  },
  'The Grounded': {
    name: 'The Grounded',
    icon: 'leaf',
    description: 'You find peace in stability and routine. You appreciate practical approaches and value consistency in your self-care.',
    color: '#2180A8',
  },
  'The Connector': {
    name: 'The Connector',
    icon: 'account-heart',
    description: 'You thrive through relationships. Talking things through helps you process, and you value deep, meaningful conversations.',
    color: '#9333EA',
  },
  'The Reflector': {
    name: 'The Reflector',
    icon: 'mirror',
    description: 'You find wisdom in solitude. You prefer to process internally and appreciate space to journal and reflect on your own.',
    color: '#6366F1',
  },
};

// Privacy Data Points
const PRIVACY_POINTS = [
  { icon: 'lock', text: 'Your conversations are encrypted and private' },
  { icon: 'account-off', text: 'We never sell your personal data' },
  { icon: 'database-check', text: 'You can delete your data anytime' },
  { icon: 'shield-check', text: 'AI learns from you, not about you' },
];

const TOTAL_STEPS = 6; // Goals, Name, Quiz, Results, Privacy, Notifications

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Onboarding data
  const [selectedIntents, setSelectedIntents] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [personalityType, setPersonalityType] = useState<string>('');
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
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

  const calculatePersonality = () => {
    // Count personality traits from answers
    const traits: Record<string, number> = { E: 0, I: 0, T: 0, F: 0, J: 0, P: 0, S: 0, N: 0 };

    Object.values(quizAnswers).forEach(answer => {
      const question = PERSONALITY_QUESTIONS.find(q =>
        q.options.some(o => o.id === answer)
      );
      if (question) {
        const option = question.options.find(o => o.id === answer);
        if (option) {
          traits[option.type]++;
        }
      }
    });

    // Determine personality type based on dominant traits
    const isExtrovert = traits.E > traits.I;
    const isThinker = traits.T > traits.F;
    const isJudger = traits.J > traits.P;
    const isSensor = traits.S > traits.N;

    if (isThinker && !isExtrovert) return 'The Thinker';
    if (!isThinker && isExtrovert) return 'The Connector';
    if (!isThinker && !isExtrovert) return 'The Feeler';
    if (isThinker && isJudger) return 'The Grounded';
    if (!isSensor) return 'The Explorer';
    return 'The Reflector';
  };

  const nextStep = () => {
    if (step === 2) {
      // After quiz, calculate personality before showing results
      const type = calculatePersonality();
      setPersonalityType(type);
    }
    if (step < TOTAL_STEPS - 1) {
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

  const selectQuizAnswer = (questionId: string, answerId: string) => {
    setQuizAnswers(prev => ({ ...prev, [questionId]: answerId }));
  };

  const requestNotificationPermission = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      setNotificationsEnabled(status === 'granted');
      return status === 'granted';
    } catch (e) {
      console.error('Error requesting notification permission:', e);
      return false;
    }
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
          personalityType,
          privacyConsent,
          notificationsEnabled,
        }),
      });

      // Mark onboarding as complete locally
      await AsyncStorage.setItem('onboardingComplete', 'true');
      await AsyncStorage.setItem('userName', name);
      await AsyncStorage.setItem('personalityType', personalityType);

      router.replace('/(tabs)/home');
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
      case 2: return Object.keys(quizAnswers).length === PERSONALITY_QUESTIONS.length;
      case 3: return true; // Results screen
      case 4: return privacyConsent;
      case 5: return true; // Notifications screen
      default: return false;
    }
  };

  const renderStep = () => {
    switch (step) {
      // Step 0: Goals
      case 0:
        return (
          <View style={styles.stepContent}>
            <View style={styles.iconHeader}>
              <LinearGradient colors={Colors.dark.accentGradient as any} style={styles.iconCircle}>
                <MaterialCommunityIcons name="hand-wave" size={40} color="white" />
              </LinearGradient>
            </View>
            <Typo variant="h2" weight="bold" align="center" style={styles.title}>
              What brings you here?
            </Typo>
            <Typo variant="body" align="center" color={Colors.dark.textMuted} style={styles.subtitle}>
              Select all that resonate with you
            </Typo>

            <View style={styles.optionsContainer}>
              {INTENTS.map((intent) => (
                <TouchableOpacity
                  key={intent.id}
                  onPress={() => toggleIntent(intent.id)}
                  style={styles.intentOption}
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
                      style={{ marginLeft: 12, flex: 1 }}
                    >
                      {intent.label}
                    </Typo>
                    {selectedIntents.includes(intent.id) && (
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={20}
                        color={Colors.dark.primary}
                      />
                    )}
                  </GlassView>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      // Step 1: Name
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

      // Step 2: Personality Quiz
      case 2:
        const currentQuestionIndex = Object.keys(quizAnswers).length;
        const currentQuestion = PERSONALITY_QUESTIONS[Math.min(currentQuestionIndex, PERSONALITY_QUESTIONS.length - 1)];
        const answeredAll = Object.keys(quizAnswers).length === PERSONALITY_QUESTIONS.length;

        return (
          <View style={styles.stepContent}>
            <View style={styles.iconHeader}>
              <LinearGradient colors={['#9333EA', '#6366F1']} style={styles.iconCircle}>
                <MaterialCommunityIcons name="brain" size={40} color="white" />
              </LinearGradient>
            </View>
            <Typo variant="h2" weight="bold" align="center" style={styles.title}>
              Quick Personality Check
            </Typo>
            <Typo variant="body" align="center" color={Colors.dark.textMuted} style={styles.subtitle}>
              Help me understand how to best support you
            </Typo>

            <View style={styles.quizProgress}>
              {PERSONALITY_QUESTIONS.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.quizProgressDot,
                    i < Object.keys(quizAnswers).length && styles.quizProgressDotComplete,
                    i === Object.keys(quizAnswers).length && styles.quizProgressDotActive,
                  ]}
                />
              ))}
            </View>

            {!answeredAll ? (
              <View style={styles.quizContainer}>
                <Typo variant="body" weight="medium" align="center" style={styles.quizQuestion}>
                  {currentQuestion.question}
                </Typo>
                <View style={styles.quizOptions}>
                  {currentQuestion.options.map((option) => (
                    <TouchableOpacity
                      key={option.id}
                      onPress={() => selectQuizAnswer(currentQuestion.id, option.id)}
                      style={styles.quizOption}
                    >
                      <GlassView
                        intensity={quizAnswers[currentQuestion.id] === option.id ? 40 : 20}
                        style={[
                          styles.quizOptionInner,
                          quizAnswers[currentQuestion.id] === option.id && styles.quizOptionSelected
                        ]}
                      >
                        <Typo variant="body" align="center">
                          {option.text}
                        </Typo>
                      </GlassView>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.quizComplete}>
                <MaterialCommunityIcons name="check-circle" size={48} color={Colors.dark.success} />
                <Typo variant="body" align="center" style={{ marginTop: 12 }}>
                  All done! Let's see your results.
                </Typo>
              </View>
            )}
          </View>
        );

      // Step 3: Quiz Results
      case 3:
        const personality = PERSONALITY_TYPES[personalityType] || PERSONALITY_TYPES['The Thinker'];
        return (
          <View style={styles.stepContent}>
            <View style={styles.iconHeader}>
              <LinearGradient colors={[personality.color, Colors.dark.primary]} style={[styles.iconCircle, { width: 100, height: 100, borderRadius: 50 }]}>
                <MaterialCommunityIcons name={personality.icon as any} size={56} color="white" />
              </LinearGradient>
            </View>
            <Typo variant="h2" weight="bold" align="center" style={styles.title}>
              You're {personality.name}!
            </Typo>
            <Typo variant="body" align="center" color={Colors.dark.textMuted} style={[styles.subtitle, { paddingHorizontal: 10 }]}>
              {personality.description}
            </Typo>

            <GlassView intensity={20} style={styles.resultCard}>
              <View style={styles.resultItem}>
                <MaterialCommunityIcons name="check-circle" size={20} color={Colors.dark.success} />
                <Typo variant="body" style={{ marginLeft: 12 }}>I'll adapt my conversation style to you</Typo>
              </View>
              <View style={styles.resultItem}>
                <MaterialCommunityIcons name="check-circle" size={20} color={Colors.dark.success} />
                <Typo variant="body" style={{ marginLeft: 12 }}>Your insights will be personalized</Typo>
              </View>
              <View style={styles.resultItem}>
                <MaterialCommunityIcons name="check-circle" size={20} color={Colors.dark.success} />
                <Typo variant="body" style={{ marginLeft: 12 }}>Journal prompts matched to you</Typo>
              </View>
            </GlassView>
          </View>
        );

      // Step 4: Privacy Consent
      case 4:
        return (
          <View style={styles.stepContent}>
            <View style={styles.iconHeader}>
              <LinearGradient colors={['#22C55E', '#16A34A']} style={styles.iconCircle}>
                <MaterialCommunityIcons name="shield-check" size={40} color="white" />
              </LinearGradient>
            </View>
            <Typo variant="h2" weight="bold" align="center" style={styles.title}>
              Your Privacy Matters
            </Typo>
            <Typo variant="body" align="center" color={Colors.dark.textMuted} style={styles.subtitle}>
              Here's how we protect you
            </Typo>

            <View style={styles.privacyContainer}>
              {PRIVACY_POINTS.map((point, index) => (
                <GlassView key={index} intensity={20} style={styles.privacyItem}>
                  <View style={styles.privacyIcon}>
                    <MaterialCommunityIcons name={point.icon as any} size={24} color={Colors.dark.primary} />
                  </View>
                  <Typo variant="body" style={{ flex: 1, marginLeft: 12 }}>{point.text}</Typo>
                </GlassView>
              ))}
            </View>

            <TouchableOpacity
              onPress={() => setPrivacyConsent(!privacyConsent)}
              style={styles.consentRow}
            >
              <View style={[styles.checkbox, privacyConsent && styles.checkboxChecked]}>
                {privacyConsent && (
                  <MaterialCommunityIcons name="check" size={16} color="white" />
                )}
              </View>
              <Typo variant="body" style={{ flex: 1, marginLeft: 12 }}>
                I understand and agree to the privacy policy
              </Typo>
            </TouchableOpacity>
          </View>
        );

      // Step 5: Notifications
      case 5:
        return (
          <View style={styles.stepContent}>
            <View style={styles.iconHeader}>
              <LinearGradient colors={Colors.dark.accentGradient as any} style={[styles.iconCircle, { width: 100, height: 100, borderRadius: 50 }]}>
                <MaterialCommunityIcons name="bell" size={56} color="white" />
              </LinearGradient>
            </View>
            <Typo variant="h2" weight="bold" align="center" style={styles.title}>
              Stay Connected
            </Typo>
            <Typo variant="body" align="center" color={Colors.dark.textMuted} style={styles.subtitle}>
              Get gentle reminders to check in with yourself
            </Typo>

            <GlassView intensity={20} style={styles.notificationCard}>
              <View style={styles.notificationItem}>
                <MaterialCommunityIcons name="weather-sunny" size={28} color={Colors.dark.accent} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Typo variant="body" weight="bold">Morning check-ins</Typo>
                  <Typo variant="caption" color={Colors.dark.textMuted}>Start your day with intention</Typo>
                </View>
              </View>
              <View style={styles.notificationItem}>
                <MaterialCommunityIcons name="weather-night" size={28} color={Colors.dark.secondary} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Typo variant="body" weight="bold">Evening reflections</Typo>
                  <Typo variant="caption" color={Colors.dark.textMuted}>Process your day mindfully</Typo>
                </View>
              </View>
              <View style={styles.notificationItem}>
                <MaterialCommunityIcons name="lightbulb-on" size={28} color={Colors.dark.primary} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Typo variant="body" weight="bold">Weekly insights</Typo>
                  <Typo variant="caption" color={Colors.dark.textMuted}>Discover patterns in your journey</Typo>
                </View>
              </View>
            </GlassView>

            <View style={styles.notificationToggle}>
              <Typo variant="body" weight="medium">Enable notifications</Typo>
              <Switch
                value={notificationsEnabled}
                onValueChange={async (value) => {
                  if (value) {
                    await requestNotificationPermission();
                  } else {
                    setNotificationsEnabled(false);
                  }
                }}
                trackColor={{ false: Colors.dark.surfaceHover, true: Colors.dark.primary + '50' }}
                thumbColor={notificationsEnabled ? Colors.dark.primary : Colors.dark.textMuted}
              />
            </View>

            <Typo variant="caption" color={Colors.dark.textMuted} align="center" style={{ marginTop: 16 }}>
              You can change this anytime in settings
            </Typo>
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
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
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
            {step < TOTAL_STEPS - 1 ? (
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
    gap: 6,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.surfaceHover,
  },
  progressDotActive: {
    width: 20,
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
    gap: 10,
  },
  intentOption: {
    borderRadius: 16,
    overflow: 'hidden',
  },
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
  quizProgress: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 32,
  },
  quizProgressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.dark.surfaceHover,
  },
  quizProgressDotActive: {
    backgroundColor: Colors.dark.primary,
    transform: [{ scale: 1.2 }],
  },
  quizProgressDotComplete: {
    backgroundColor: Colors.dark.success,
  },
  quizContainer: {
    width: '100%',
  },
  quizQuestion: {
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  quizOptions: {
    gap: 12,
  },
  quizOption: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  quizOptionInner: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  quizOptionSelected: {
    borderColor: Colors.dark.primary,
  },
  quizComplete: {
    alignItems: 'center',
    padding: 32,
  },
  resultCard: {
    width: '100%',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
    gap: 16,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  privacyContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  privacyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  privacyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.dark.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.dark.primary,
  },
  notificationCard: {
    width: '100%',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
    gap: 20,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 24,
    paddingHorizontal: 4,
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
