import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <MaterialCommunityIcons name="leaf" size={60} color="#7C3AED" />
          <Text style={styles.title}>MindfulMe</Text>
          <Text style={styles.subtitle}>Your mental wellness companion</Text>
        </View>

        <View style={styles.features}>
          <View style={styles.feature}>
            <MaterialCommunityIcons
              name="chat-processing"
              size={32}
              color="#7C3AED"
            />
            <Text style={styles.featureText}>Talk freely about your thoughts</Text>
          </View>
          <View style={styles.feature}>
            <MaterialCommunityIcons
              name="book-open-variant"
              size={32}
              color="#7C3AED"
            />
            <Text style={styles.featureText}>Journal your daily experiences</Text>
          </View>
          <View style={styles.feature}>
            <MaterialCommunityIcons
              name="fire"
              size={32}
              color="#7C3AED"
            />
            <Text style={styles.featureText}>Build consistent streaks</Text>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/(tabs)/chat')}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            MindfulMe is a supportive tool, not a replacement for professional
            mental health care.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 8,
  },
  features: {
    gap: 24,
    marginVertical: 40,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#1F1F1F',
    padding: 20,
    borderRadius: 16,
  },
  featureText: {
    fontSize: 16,
    color: '#FFFFFF',
    flex: 1,
  },
  buttonContainer: {
    gap: 16,
  },
  primaryButton: {
    backgroundColor: '#7C3AED',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 16,
  },
});