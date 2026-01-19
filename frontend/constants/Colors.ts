export const Colors = {
    // Light/Neutral Theme - Warm Beige & Grey
    dark: {
        // Text
        text: '#1F2937', // Grey 800 - dark text for readability
        textMuted: '#6B7280', // Grey 500
        textLight: '#9CA3AF', // Grey 400

        // Backgrounds
        background: '#F9FAFB', // Grey 50 - soft off-white
        backgroundWarm: '#FBF9F7', // Warm beige tint
        surface: '#FFFFFF', // Pure white for cards
        surfaceHover: '#F3F4F6', // Grey 100

        // Tab & Navigation
        tint: '#6B7280', // Grey 500 - subtle accent
        icon: '#9CA3AF', // Grey 400
        tabIconDefault: '#D1D5DB', // Grey 300
        tabIconSelected: '#374151', // Grey 700

        // Glass & Surface Effects
        glass: 'rgba(255, 255, 255, 0.85)',
        glassBorder: 'rgba(0, 0, 0, 0.06)',
        shadow: 'rgba(0, 0, 0, 0.08)',

        // Accents - Warm & Calming
        primary: '#78716C', // Stone 500 - warm grey
        primaryLight: '#A8A29E', // Stone 400
        secondary: '#84CC16', // Lime 500 - fresh, calming green
        secondaryMuted: '#A3E635', // Lime 400
        accent: '#F59E0B', // Amber 500 - warm highlight

        // Gradient - Soft, warm tones
        accentGradient: ['#78716C', '#57534E'] as const, // Stone gradient
        warmGradient: ['#FEF3C7', '#FDE68A'] as const, // Amber light gradient
        calmGradient: ['#ECFCCB', '#D9F99D'] as const, // Lime light gradient

        // Semantic
        success: '#22C55E', // Green 500
        successLight: '#DCFCE7', // Green 100
        error: '#EF4444', // Red 500
        errorLight: '#FEE2E2', // Red 100
        warning: '#F59E0B', // Amber 500
        warningLight: '#FEF3C7', // Amber 100

        // Mood Colors - Softer versions
        moodGreat: '#22C55E',
        moodGood: '#84CC16',
        moodOkay: '#F59E0B',
        moodLow: '#9CA3AF',
        moodAnxious: '#F87171',
    },

    // Keep light as alias for consistency
    light: {
        text: '#1F2937',
        textMuted: '#6B7280',
        background: '#F9FAFB',
        tint: '#78716C',
        tabIconDefault: '#D1D5DB',
        tabIconSelected: '#374151',
        primary: '#78716C',
        secondary: '#84CC16',
        surface: '#FFFFFF',
        glass: 'rgba(255, 255, 255, 0.85)',
        glassBorder: 'rgba(0, 0, 0, 0.06)',
        accentGradient: ['#78716C', '#57534E'] as const,
        success: '#22C55E',
        error: '#EF4444',
    }
};
