import React from 'react';
import { Text, TextProps, TextStyle, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Colors';

interface TypoProps extends TextProps {
    variant?: 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'label';
    color?: string;
    weight?: 'regular' | 'medium' | 'bold';
    align?: 'left' | 'center' | 'right';
}

export const Typo: React.FC<TypoProps> = ({
    style,
    variant = 'body',
    color,
    weight = 'regular',
    align = 'left',
    ...props
}) => {
    const theme = Colors.dark;

    const getStyle = (): TextStyle => {
        let base: TextStyle = {
            color: color || theme.text,
            textAlign: align,
        };

        switch (variant) {
            case 'h1':
                return { ...base, fontSize: 32, lineHeight: 40, fontWeight: '700' };
            case 'h2':
                return { ...base, fontSize: 24, lineHeight: 32, fontWeight: '600' };
            case 'h3':
                return { ...base, fontSize: 18, lineHeight: 28, fontWeight: '600' };
            case 'body':
                return { ...base, fontSize: 16, lineHeight: 24, fontWeight: '400' };
            case 'label':
                return { ...base, fontSize: 14, lineHeight: 20, fontWeight: '500' };
            case 'caption':
                return { ...base, fontSize: 12, lineHeight: 16, color: theme.textMuted };
        }
    };

    return <Text style={[getStyle(), style]} {...props} />;
};
