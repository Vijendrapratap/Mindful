import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View, StyleSheet, Platform } from 'react-native';
import { Colors } from '../../constants/Colors';
import { GlassView } from '../../components/ui/GlassView';
import { Typo } from '../../components/ui/Typo';

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
          borderRadius: 30, // Pill shape
          borderTopWidth: 0,
          backgroundColor: 'transparent', // Handled by GlassView
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
                size={28}
                color={color}
              />
              {focused && <View style={styles.activeDot} />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center', top: Platform.OS === 'ios' ? 10 : 0 }}>
              <MaterialCommunityIcons
                name={focused ? "chat-processing" : "chat-processing-outline"}
                size={28}
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
                  size={28}
                  color={focused ? 'white' : Colors.dark.surface}
                />
              </View>
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
                size={28}
                color={color}
              />
              {focused && <View style={styles.activeDot} />}
            </View>
          ),
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
    backgroundColor: Colors.dark.tint,
    marginTop: 4,
  },
  journalButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.dark.tint,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30, // Float above
    shadowColor: Colors.dark.tint,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    borderWidth: 4,
    borderColor: Colors.dark.background, // Create a cutout effect
  },
  journalButtonActive: {
    transform: [{ scale: 1.1 }]
  }
});