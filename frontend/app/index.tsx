import React, { useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, Animated, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/Colors';
import { Typo } from '../components/ui/Typo';
import { GradientButton } from '../components/ui/GradientButton';
import { GlassView } from '../components/ui/GlassView';

const { width } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.9);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.dark.background, '#1e1b4b']} // Deep slate to dark indigo
        style={StyleSheet.absoluteFill}
      />

      {/* Ambient background glow */}
      <View style={styles.glowContainer}>
        <View style={[styles.glowOrb, { backgroundColor: Colors.dark.primary }]} />
        <View style={[styles.glowOrb, { backgroundColor: Colors.dark.secondary, top: '40%', left: -50 }]} />
      </View>

      <GlassView intensity={50} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.content}>
        <Animated.View style={[styles.hero, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.iconContainer}>
            <LinearGradient
              colors={Colors.dark.accentGradient as any}
              style={styles.iconBackground}
            >
              <MaterialCommunityIcons name="leaf" size={64} color="white" />
            </LinearGradient>
          </View>

          <Typo variant="h1" align="center" style={styles.title}>
            MindfulMe
          </Typo>
          <Typo variant="h3" align="center" color={Colors.dark.textMuted} style={styles.subtitle}>
            Your intelligent companion for mental wellness.
          </Typo>
        </Animated.View>

        <Animated.View style={{ opacity: fadeAnim, width: '100%', gap: 20 }}>
          <GlassView intensity={20} style={styles.featuresCard}>
            <FeatureRow icon="chat-processing" text="Intelligent Conversations" delay={0} />
            <FeatureRow icon="book-open-variant" text="Mindful Journaling" delay={200} />
            <FeatureRow icon="chart-timeline-variant" text="Mood Analytics" delay={400} />
          </GlassView>

          <GradientButton
            title="Get Started"
            onPress={() => router.push('/(tabs)/home')}
            icon="arrow-forward"
          />

          <Typo variant="caption" align="center" style={{ marginTop: 10, opacity: 0.6 }}>
            Daily mental wellness, simplified.
          </Typo>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const FeatureRow = ({ icon, text, delay }: { icon: any, text: string, delay: number }) => (
  <View style={styles.featureRow}>
    <MaterialCommunityIcons name={icon} size={24} color={Colors.dark.secondary} />
    <Typo variant="body" style={{ marginLeft: 12 }}>{text}</Typo>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  glowContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  glowOrb: {
    width: width * 1.5,
    height: width * 1.5,
    borderRadius: width,
    position: 'absolute',
    top: -width * 0.5,
    left: width * 0.2,
    opacity: 0.15,
    transform: [{ scale: 1.2 }], // Slight scale instead
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 24,
    paddingBottom: 60,
  },
  hero: {
    alignItems: 'center',
    marginTop: 60,
  },
  iconContainer: {
    marginBottom: 24,
    shadowColor: Colors.dark.primary,
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  iconBackground: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    marginBottom: 12,
  },
  subtitle: {
    paddingHorizontal: 32,
  },
  featuresCard: {
    borderRadius: 24,
    padding: 24,
    gap: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  }
});