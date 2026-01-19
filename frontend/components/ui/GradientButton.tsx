import React from 'react';
import { Pressable, StyleSheet, ViewStyle, Animated, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/Colors';
import { Typo } from './Typo';
import { Ionicons } from '@expo/vector-icons';

interface GradientButtonProps {
    title: string;
    onPress: () => void;
    icon?: keyof typeof Ionicons.glyphMap;
    style?: ViewStyle;
    variant?: 'primary' | 'secondary' | 'outline';
    loading?: boolean;
    disabled?: boolean;
}

export const GradientButton: React.FC<GradientButtonProps> = ({
    title,
    onPress,
    icon,
    style,
    variant = 'primary',
    loading = false,
    disabled = false
}) => {
    const theme = Colors.dark;
    const scale = new Animated.Value(1);

    const handlePressIn = () => {
        Animated.spring(scale, {
            toValue: 0.96,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
        }).start();
    };

    const handlePress = () => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPress();
    };

    const getColors = () => {
        if (variant === 'primary') return theme.accentGradient;
        if (variant === 'secondary') return [theme.secondary, '#14B8A6']; // Teal 400->500
        return ['transparent', 'transparent'];
    };

    const isDisabled = loading || disabled;

    return (
        <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handlePress}
            disabled={isDisabled}
            style={[styles.container, style, isDisabled && { opacity: 0.5 }]}
        >
            <Animated.View style={{ transform: [{ scale }], width: '100%' }}>
                <LinearGradient
                    colors={getColors() as any}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                        styles.gradient,
                        variant === 'outline' && { borderWidth: 1, borderColor: theme.primary }
                    ]}
                >
                    {icon && <Ionicons name={icon} size={20} color="white" style={{ marginRight: 8 }} />}
                    <Typo variant="label" weight="bold" color="white">
                        {loading ? 'Wait...' : title}
                    </Typo>
                </LinearGradient>
            </Animated.View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: Colors.dark.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    gradient: {
        paddingVertical: 16,
        paddingHorizontal: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
    },
});
