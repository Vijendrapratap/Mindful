export const Colors = {
    dark: {
        text: '#F8FAFC', // Slate 50
        textMuted: '#94A3B8', // Slate 400
        background: '#020617', // Slate 950
        tint: '#8B5CF6', // Violet 500
        icon: '#CBD5E1', // Slate 300
        tabIconDefault: '#64748B', // Slate 500
        tabIconSelected: '#8B5CF6',

        // Glass & Surface
        glass: 'rgba(15, 23, 42, 0.65)',
        glassBorder: 'rgba(255, 255, 255, 0.08)',
        surface: '#0F172A', // Slate 900

        // Accents
        primary: '#8B5CF6', // Violet 500
        secondary: '#2DD4BF', // Teal 400
        accentGradient: ['#8B5CF6', '#6366F1'] as const, // Violet -> Indigo

        // Semantic
        success: '#10B981', // Emerald 500
        error: '#EF4444', // Red 500
    },
    light: {
        // Fallback for light mode (though we are prioritizing dark)
        text: '#020617',
        background: '#FFFFFF',
        tint: '#7C3AED',
        tabIconDefault: '#ccc',
        tabIconSelected: '#7C3AED',
    }
};
