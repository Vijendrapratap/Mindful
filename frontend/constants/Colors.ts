export const Colors = {
    // Light Mode - Per PRD Specifications
    dark: {
        // Text - PRD: Primary Text #134252
        text: '#134252', // Primary text
        textMuted: '#5A7A8A', // Muted text
        textLight: '#8BA5B5', // Light text

        // Backgrounds - PRD: Cream #FCFCF9
        background: '#FCFCF9', // Cream background
        backgroundWarm: '#F8F6F3', // Warmer cream
        surface: '#FFFFFF', // White for cards
        surfaceHover: '#F5F3F0', // Hover state

        // Tab & Navigation
        tint: '#2180A8', // Teal primary
        icon: '#5A7A8A',
        tabIconDefault: '#B5C5CE',
        tabIconSelected: '#2180A8', // Teal

        // Glass & Surface Effects
        glass: 'rgba(255, 255, 255, 0.9)',
        glassBorder: 'rgba(33, 128, 168, 0.1)', // Teal-tinted border
        shadow: 'rgba(19, 66, 82, 0.1)',

        // Primary Colors - PRD: Teal #2180A8
        primary: '#2180A8', // Teal - main accent
        primaryLight: '#4BA3C7', // Lighter teal
        primaryDark: '#1A6689', // Darker teal
        secondary: '#32B8C6', // Lighter teal for secondary
        secondaryMuted: '#6FCFDB',
        accent: '#F59E61', // Warm accent (Happy color)

        // Gradients
        accentGradient: ['#2180A8', '#32B8C6'] as const, // Teal gradient
        warmGradient: ['#FCFCF9', '#F5F3F0'] as const, // Cream gradient
        calmGradient: ['#3BB6C6', '#2180A8'] as const, // Calm teal gradient

        // Semantic
        success: '#22C55E', // Green
        successLight: '#DCFCE7',
        error: '#C01537', // Red (Sad color)
        errorLight: '#FECDD3',
        warning: '#F59E61', // Orange (Happy color)
        warningLight: '#FED7AA',

        // Mood Colors - PRD Specifications
        moodAmazing: '#22C55E', // Amazing - Green
        moodHappy: '#F59E61', // Happy - Orange
        moodCalm: '#3BB6C6', // Calm - Light Teal
        moodOkay: '#A7A9A9', // Okay - Grey
        moodSad: '#C01537', // Sad - Red
        moodAnxious: '#FF5459', // Anxious - Light Red

        // Legacy mood names for backwards compatibility
        moodGreat: '#22C55E',
        moodGood: '#F59E61',
        moodLow: '#A7A9A9',
    },

    // Dark Mode - Per PRD Specifications
    light: {
        // Text
        text: '#F5F5F5',
        textMuted: '#A0AEB5',
        textLight: '#6B7B85',

        // Backgrounds - PRD: #1F2121
        background: '#1F2121',
        backgroundWarm: '#252727',
        surface: '#2A2C2C',
        surfaceHover: '#353737',

        // Tab & Navigation
        tint: '#32B8C6', // Teal for dark mode
        icon: '#A0AEB5',
        tabIconDefault: '#5A6A72',
        tabIconSelected: '#32B8C6',

        // Glass & Surface Effects
        glass: 'rgba(31, 33, 33, 0.9)',
        glassBorder: 'rgba(50, 184, 198, 0.15)',
        shadow: 'rgba(0, 0, 0, 0.3)',

        // Primary Colors - PRD: #32B8C6 for dark mode
        primary: '#32B8C6',
        primaryLight: '#5CCAD6',
        primaryDark: '#2180A8',
        secondary: '#4BA3C7',
        secondaryMuted: '#6FCFDB',
        accent: '#F59E61',

        // Gradients
        accentGradient: ['#32B8C6', '#2180A8'] as const,
        warmGradient: ['#1F2121', '#252727'] as const,
        calmGradient: ['#32B8C6', '#3BB6C6'] as const,

        // Semantic
        success: '#22C55E',
        successLight: 'rgba(34, 197, 94, 0.2)',
        error: '#C01537',
        errorLight: 'rgba(192, 21, 55, 0.2)',
        warning: '#F59E61',
        warningLight: 'rgba(245, 158, 97, 0.2)',

        // Mood Colors - Same as light mode
        moodAmazing: '#22C55E',
        moodHappy: '#F59E61',
        moodCalm: '#3BB6C6',
        moodOkay: '#A7A9A9',
        moodSad: '#C01537',
        moodAnxious: '#FF5459',

        moodGreat: '#22C55E',
        moodGood: '#F59E61',
        moodLow: '#A7A9A9',
    }
};
