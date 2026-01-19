import { View, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';

interface BentoCardProps {
    title?: string;
    subtitle?: string;
    children: React.ReactNode;
    style?: ViewStyle;
    onPress?: () => void;
}

export const BentoCard: React.FC<BentoCardProps> = ({
    title,
    subtitle,
    children,
    style,
    onPress
}) => {
    const Content = (
        <GlassView style={[styles.container, style]} intensity={20}>
            {(title || subtitle) && (
                <View style={styles.header}>
                    {title && <Typo variant="label" weight="bold" style={styles.title}>{title}</Typo>}
                    {subtitle && <Typo variant="caption" style={styles.subtitle}>{subtitle}</Typo>}
                </View>
            )}
            <View style={styles.content}>
                {children}
            </View>
        </GlassView>
    );

    if (onPress) {
        return (
            <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
                {Content}
            </TouchableOpacity>
        );
    }

    return Content;
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 24,
        padding: 20,
        marginVertical: 8,
    },
    header: {
        marginBottom: 12,
    },
    title: {
        marginBottom: 4,
        color: Colors.dark.text,
    },
    subtitle: {
        opacity: 0.7,
    },
    content: {
        // Content layout
    },
});
