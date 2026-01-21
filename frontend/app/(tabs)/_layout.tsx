import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View, StyleSheet, Platform } from 'react-native';
import { Colors } from '../../constants/Colors';
import { GlassView } from '../../components/ui/GlassView';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.dark.tint,
        tabBarInactiveTintColor: Colors.dark.tabIconDefault,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 20,
          left: 16,
          right: 16,
          height: 72,
          borderRadius: 30,
          borderTopWidth: 0,
          backgroundColor: 'transparent',
          elevation: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.25,
          shadowRadius: 10,
        },
        tabBarBackground: () => (
          <GlassView
            style={StyleSheet.absoluteFill}
            intensity={80}
          />
        ),
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center', top: Platform.OS === 'ios' ? 10 : 0 }}>
              <MaterialCommunityIcons
                name={focused ? "home" : "home-outline"}
                size={24}
                color={color}
              />
              {focused && <View style={styles.activeDot} />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="talk"
        options={{
          title: 'Talk',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center', top: Platform.OS === 'ios' ? 10 : 0 }}>
              <MaterialCommunityIcons
                name={focused ? "microphone" : "microphone-outline"}
                size={24}
                color={color}
              />
              {focused && <View style={styles.activeDot} />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center', top: Platform.OS === 'ios' ? 10 : 0 }}>
              <MaterialCommunityIcons
                name={focused ? "book-open-variant" : "book-open-outline"}
                size={24}
                color={color}
              />
              {focused && <View style={styles.activeDot} />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: 'Journal',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center', top: Platform.OS === 'ios' ? 10 : 0 }}>
              <View style={[styles.journalButton, focused && styles.journalButtonActive]}>
                <MaterialCommunityIcons
                  name="notebook"
                  size={24}
                  color={focused ? 'white' : Colors.dark.surface}
                />
              </View>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center', top: Platform.OS === 'ios' ? 10 : 0 }}>
              <MaterialCommunityIcons
                name={focused ? "chart-line" : "chart-line-variant"}
                size={24}
                color={color}
              />
              {focused && <View style={styles.activeDot} />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center', top: Platform.OS === 'ios' ? 10 : 0 }}>
              <MaterialCommunityIcons
                name={focused ? "account-circle" : "account-circle-outline"}
                size={24}
                color={color}
              />
              {focused && <View style={styles.activeDot} />}
            </View>
          ),
        }}
      />
      {/* Hide the old chat screen from tabs */}
      <Tabs.Screen
        name="chat"
        options={{
          href: null, // This hides it from the tab bar
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.dark.primary,
    marginTop: 4,
  },
  journalButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.dark.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    borderWidth: 3,
    borderColor: Colors.dark.surface,
  },
  journalButtonActive: {
    transform: [{ scale: 1.1 }]
  }
});
