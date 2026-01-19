import React from 'react';
import { BlurView, BlurViewProps } from 'expo-blur';
import { ViewStyle, StyleSheet, useColorScheme, View, Platform, StyleProp } from 'react-native';
import { Colors } from '../../constants/Colors';

interface GlassViewProps extends BlurViewProps {
    style?: StyleProp<ViewStyle>;
    children?: React.ReactNode;
    intensity?: number;
}

export const GlassView: React.FC<GlassViewProps> = ({
    style,
    children,
    intensity = 30,
    ...props
}) => {
    const isDark = true; // Force dark mode aesthetics for now as per plan
    const theme = Colors.dark;

    if (Platform.OS === 'web') {
        return (
            <View style={[
                styles.webGlass,
                {
                    backgroundColor: theme.glass,
                    borderColor: theme.glassBorder
                },
                style
            ]} {...props}>
                {children}
            </View>
        )
    }

    return (
        <BlurView
            intensity={intensity}
            tint="dark"
            style={[
                styles.container,
                {
                    borderColor: theme.glassBorder,
                    backgroundColor: 'rgba(2, 6, 23, 0.4)' // Slight overlay for better text contrast
                },
                style
            ]}
            {...props}
        >
            {children}
        </BlurView>
    );
};

const styles = StyleSheet.create({
    container: {
        borderWidth: 1,
        overflow: 'hidden',
    },
    webGlass: {
        borderWidth: 1,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
    } as ViewStyle,
});
