import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    SafeAreaView,
    TouchableOpacity,
    Platform,
    Modal,
    Animated,
    Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { Colors } from '../../constants/Colors';
import { GlassView } from '../../components/ui/GlassView';
import { Typo } from '../../components/ui/Typo';
import { BentoCard } from '../../components/ui/BentoCard';

const { width, height } = Dimensions.get('window');

// Wellness Tool Categories
const TOOL_CATEGORIES = [
    {
        id: 'breathing',
        title: 'Breathing',
        icon: 'weather-windy',
        color: '#3BB6C6',
        description: 'Calm your nervous system',
    },
    {
        id: 'grounding',
        title: 'Grounding',
        icon: 'leaf',
        color: '#22C55E',
        description: 'Return to the present',
    },
    {
        id: 'sleep',
        title: 'Sleep',
        icon: 'weather-night',
        color: '#6366F1',
        description: 'Rest and recover',
    },
];

// Breathing Exercises
const BREATHING_EXERCISES = [
    {
        id: '478',
        title: '4-7-8 Breathing',
        subtitle: 'For anxiety & sleep',
        duration: '4 min',
        steps: [
            { action: 'Inhale', duration: 4, color: '#3BB6C6' },
            { action: 'Hold', duration: 7, color: '#2180A8' },
            { action: 'Exhale', duration: 8, color: '#22C55E' },
        ],
        cycles: 4,
        description: 'A calming technique that activates your parasympathetic nervous system.',
    },
    {
        id: 'box',
        title: 'Box Breathing',
        subtitle: 'For focus & calm',
        duration: '4 min',
        steps: [
            { action: 'Inhale', duration: 4, color: '#3BB6C6' },
            { action: 'Hold', duration: 4, color: '#2180A8' },
            { action: 'Exhale', duration: 4, color: '#22C55E' },
            { action: 'Hold', duration: 4, color: '#F59E61' },
        ],
        cycles: 4,
        description: 'Used by Navy SEALs to stay calm under pressure.',
    },
    {
        id: 'calm',
        title: 'Calming Breath',
        subtitle: 'Quick relaxation',
        duration: '2 min',
        steps: [
            { action: 'Inhale', duration: 4, color: '#3BB6C6' },
            { action: 'Exhale', duration: 6, color: '#22C55E' },
        ],
        cycles: 6,
        description: 'A simple technique for quick stress relief.',
    },
];

// Grounding Exercises
const GROUNDING_EXERCISES = [
    {
        id: '54321',
        title: '5-4-3-2-1',
        subtitle: 'Sensory grounding',
        duration: '5 min',
        steps: [
            { sense: 'See', count: 5, icon: 'eye', prompt: '5 things you can see' },
            { sense: 'Touch', count: 4, icon: 'hand-wave', prompt: '4 things you can touch' },
            { sense: 'Hear', count: 3, icon: 'ear-hearing', prompt: '3 things you can hear' },
            { sense: 'Smell', count: 2, icon: 'flower', prompt: '2 things you can smell' },
            { sense: 'Taste', count: 1, icon: 'food-apple', prompt: '1 thing you can taste' },
        ],
        description: 'Ground yourself using your five senses.',
    },
    {
        id: 'body_scan',
        title: 'Body Scan',
        subtitle: 'Physical awareness',
        duration: '3 min',
        steps: [
            { area: 'Feet', prompt: 'Notice your feet on the ground' },
            { area: 'Legs', prompt: 'Feel your legs supporting you' },
            { area: 'Torso', prompt: 'Notice your breath in your chest' },
            { area: 'Arms', prompt: 'Relax your arms and hands' },
            { area: 'Head', prompt: 'Release tension in your face' },
        ],
        description: 'Connect with your body from feet to head.',
    },
];

// Sleep Exercises
const SLEEP_EXERCISES = [
    {
        id: 'pmr',
        title: 'Progressive Muscle Relaxation',
        subtitle: 'Release tension',
        duration: '10 min',
        steps: [
            { muscle: 'Feet', instruction: 'Tense your feet for 5 seconds, then release' },
            { muscle: 'Calves', instruction: 'Tense your calves for 5 seconds, then release' },
            { muscle: 'Thighs', instruction: 'Tense your thighs for 5 seconds, then release' },
            { muscle: 'Abdomen', instruction: 'Tense your abdomen for 5 seconds, then release' },
            { muscle: 'Chest', instruction: 'Tense your chest for 5 seconds, then release' },
            { muscle: 'Arms', instruction: 'Tense your arms for 5 seconds, then release' },
            { muscle: 'Shoulders', instruction: 'Tense your shoulders for 5 seconds, then release' },
            { muscle: 'Face', instruction: 'Tense your face for 5 seconds, then release' },
        ],
        description: 'Systematically relax each muscle group for deep rest.',
    },
    {
        id: 'sleep_breath',
        title: 'Sleep Breathing',
        subtitle: '4-7-8 for sleep',
        duration: '5 min',
        steps: [
            { action: 'Inhale', duration: 4, color: '#6366F1' },
            { action: 'Hold', duration: 7, color: '#4F46E5' },
            { action: 'Exhale', duration: 8, color: '#3730A3' },
        ],
        cycles: 6,
        description: 'The 4-7-8 technique specifically for falling asleep.',
    },
];

export default function LibraryScreen() {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [activeExercise, setActiveExercise] = useState<any>(null);
    const [exerciseState, setExerciseState] = useState<'idle' | 'running' | 'paused' | 'complete'>('idle');
    const [currentStep, setCurrentStep] = useState(0);
    const [currentCycle, setCurrentCycle] = useState(0);
    const [countdown, setCountdown] = useState(0);

    const circleAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const startBreathingExercise = (exercise: any) => {
        setActiveExercise(exercise);
        setExerciseState('running');
        setCurrentStep(0);
        setCurrentCycle(0);
        runBreathingStep(exercise, 0, 0);
    };

    const runBreathingStep = (exercise: any, stepIndex: number, cycleIndex: number) => {
        if (cycleIndex >= exercise.cycles) {
            setExerciseState('complete');
            return;
        }

        const step = exercise.steps[stepIndex];
        setCountdown(step.duration);
        setCurrentStep(stepIndex);
        setCurrentCycle(cycleIndex);

        // Animate circle based on action
        if (step.action === 'Inhale') {
            Animated.timing(scaleAnim, {
                toValue: 1.5,
                duration: step.duration * 1000,
                useNativeDriver: true,
            }).start();
        } else if (step.action === 'Exhale') {
            Animated.timing(scaleAnim, {
                toValue: 1,
                duration: step.duration * 1000,
                useNativeDriver: true,
            }).start();
        }

        // Countdown timer
        let remaining = step.duration;
        timerRef.current = setInterval(() => {
            remaining--;
            setCountdown(remaining);

            if (remaining <= 0) {
                if (timerRef.current) clearInterval(timerRef.current);

                // Move to next step or cycle
                const nextStep = (stepIndex + 1) % exercise.steps.length;
                const nextCycle = nextStep === 0 ? cycleIndex + 1 : cycleIndex;

                if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }

                runBreathingStep(exercise, nextStep, nextCycle);
            }
        }, 1000);
    };

    const stopExercise = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setExerciseState('idle');
        setActiveExercise(null);
        scaleAnim.setValue(1);
    };

    const renderCategoryCard = (category: typeof TOOL_CATEGORIES[0]) => (
        <TouchableOpacity
            key={category.id}
            onPress={() => setSelectedCategory(category.id)}
            activeOpacity={0.8}
        >
            <GlassView intensity={30} style={styles.categoryCard}>
                <View style={[styles.categoryIcon, { backgroundColor: category.color + '20' }]}>
                    <MaterialCommunityIcons name={category.icon as any} size={32} color={category.color} />
                </View>
                <Typo variant="h3" weight="bold" style={styles.categoryTitle}>
                    {category.title}
                </Typo>
                <Typo variant="caption" color={Colors.dark.textMuted}>
                    {category.description}
                </Typo>
            </GlassView>
        </TouchableOpacity>
    );

    const renderExerciseCard = (exercise: any, type: string) => (
        <TouchableOpacity
            key={exercise.id}
            onPress={() => {
                if (type === 'breathing' || exercise.id === 'sleep_breath') {
                    startBreathingExercise(exercise);
                } else {
                    setActiveExercise(exercise);
                    setExerciseState('running');
                    setCurrentStep(0);
                }
            }}
            activeOpacity={0.8}
        >
            <BentoCard style={styles.exerciseCard}>
                <View style={styles.exerciseHeader}>
                    <View>
                        <Typo variant="body" weight="bold">{exercise.title}</Typo>
                        <Typo variant="caption" color={Colors.dark.textMuted}>{exercise.subtitle}</Typo>
                    </View>
                    <View style={styles.durationBadge}>
                        <Typo variant="caption" color={Colors.dark.primary}>{exercise.duration}</Typo>
                    </View>
                </View>
                <Typo variant="caption" color={Colors.dark.textMuted} style={styles.exerciseDescription}>
                    {exercise.description}
                </Typo>
            </BentoCard>
        </TouchableOpacity>
    );

    const renderBreathingModal = () => {
        if (!activeExercise || !activeExercise.steps?.[0]?.action) return null;

        const currentStepData = activeExercise.steps[currentStep];

        return (
            <Modal visible={exerciseState !== 'idle'} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <GlassView intensity={95} style={styles.breathingModal}>
                        {exerciseState === 'complete' ? (
                            <View style={styles.completeContainer}>
                                <MaterialCommunityIcons name="check-circle" size={80} color={Colors.dark.success} />
                                <Typo variant="h2" weight="bold" style={{ marginTop: 20 }}>
                                    Well done!
                                </Typo>
                                <Typo variant="body" color={Colors.dark.textMuted} align="center" style={{ marginTop: 8 }}>
                                    You completed {activeExercise.cycles} cycles of {activeExercise.title}
                                </Typo>
                                <TouchableOpacity onPress={stopExercise} style={styles.doneButton}>
                                    <LinearGradient colors={Colors.dark.accentGradient as any} style={styles.doneButtonGradient}>
                                        <Typo variant="body" weight="bold" color="white">Done</Typo>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.breathingContainer}>
                                <TouchableOpacity onPress={stopExercise} style={styles.closeButton}>
                                    <MaterialCommunityIcons name="close" size={24} color={Colors.dark.textMuted} />
                                </TouchableOpacity>

                                <Typo variant="caption" color={Colors.dark.textMuted}>
                                    Cycle {currentCycle + 1} of {activeExercise.cycles}
                                </Typo>

                                <View style={styles.breathingCircleContainer}>
                                    <Animated.View style={[
                                        styles.breathingCircle,
                                        {
                                            backgroundColor: currentStepData.color + '30',
                                            borderColor: currentStepData.color,
                                            transform: [{ scale: scaleAnim }]
                                        }
                                    ]}>
                                        <Typo variant="h1" weight="bold" style={{ fontSize: 48 }}>
                                            {countdown}
                                        </Typo>
                                    </Animated.View>
                                </View>

                                <Typo variant="h2" weight="bold" style={{ color: currentStepData.color }}>
                                    {currentStepData.action}
                                </Typo>

                                <View style={styles.stepsIndicator}>
                                    {activeExercise.steps.map((_: any, index: number) => (
                                        <View
                                            key={index}
                                            style={[
                                                styles.stepDot,
                                                index === currentStep && styles.stepDotActive
                                            ]}
                                        />
                                    ))}
                                </View>
                            </View>
                        )}
                    </GlassView>
                </View>
            </Modal>
        );
    };

    const renderGroundingModal = () => {
        if (!activeExercise || activeExercise.steps?.[0]?.action) return null;

        const isGrounding = activeExercise.steps?.[0]?.sense;
        const isSleep = activeExercise.steps?.[0]?.muscle;

        if (!isGrounding && !isSleep) return null;

        const currentStepData = activeExercise.steps[currentStep];
        const totalSteps = activeExercise.steps.length;

        return (
            <Modal visible={exerciseState !== 'idle'} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <GlassView intensity={95} style={styles.groundingModal}>
                        {exerciseState === 'complete' ? (
                            <View style={styles.completeContainer}>
                                <MaterialCommunityIcons name="check-circle" size={80} color={Colors.dark.success} />
                                <Typo variant="h2" weight="bold" style={{ marginTop: 20 }}>
                                    Well done!
                                </Typo>
                                <Typo variant="body" color={Colors.dark.textMuted} align="center" style={{ marginTop: 8 }}>
                                    You completed {activeExercise.title}
                                </Typo>
                                <TouchableOpacity onPress={stopExercise} style={styles.doneButton}>
                                    <LinearGradient colors={Colors.dark.accentGradient as any} style={styles.doneButtonGradient}>
                                        <Typo variant="body" weight="bold" color="white">Done</Typo>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.groundingContainer}>
                                <TouchableOpacity onPress={stopExercise} style={styles.closeButton}>
                                    <MaterialCommunityIcons name="close" size={24} color={Colors.dark.textMuted} />
                                </TouchableOpacity>

                                <Typo variant="caption" color={Colors.dark.textMuted}>
                                    Step {currentStep + 1} of {totalSteps}
                                </Typo>

                                <View style={styles.groundingContent}>
                                    {isGrounding ? (
                                        <>
                                            <View style={styles.groundingIconContainer}>
                                                <MaterialCommunityIcons
                                                    name={currentStepData.icon as any}
                                                    size={64}
                                                    color={Colors.dark.primary}
                                                />
                                            </View>
                                            <Typo variant="h2" weight="bold" style={{ marginTop: 20 }}>
                                                {currentStepData.count} things you can {currentStepData.sense.toLowerCase()}
                                            </Typo>
                                            <Typo variant="body" color={Colors.dark.textMuted} align="center" style={{ marginTop: 8 }}>
                                                {currentStepData.prompt}
                                            </Typo>
                                        </>
                                    ) : (
                                        <>
                                            <View style={styles.groundingIconContainer}>
                                                <MaterialCommunityIcons
                                                    name="human"
                                                    size={64}
                                                    color={Colors.dark.primary}
                                                />
                                            </View>
                                            <Typo variant="h2" weight="bold" style={{ marginTop: 20 }}>
                                                {currentStepData.muscle || currentStepData.area}
                                            </Typo>
                                            <Typo variant="body" color={Colors.dark.textMuted} align="center" style={{ marginTop: 8 }}>
                                                {currentStepData.instruction || currentStepData.prompt}
                                            </Typo>
                                        </>
                                    )}
                                </View>

                                <View style={styles.navigationButtons}>
                                    <TouchableOpacity
                                        onPress={() => {
                                            if (currentStep > 0) {
                                                setCurrentStep(currentStep - 1);
                                            }
                                        }}
                                        disabled={currentStep === 0}
                                        style={[styles.navButton, currentStep === 0 && styles.navButtonDisabled]}
                                    >
                                        <MaterialCommunityIcons name="arrow-left" size={24} color={currentStep === 0 ? Colors.dark.textMuted : Colors.dark.text} />
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => {
                                            if (currentStep < totalSteps - 1) {
                                                setCurrentStep(currentStep + 1);
                                                if (Platform.OS !== 'web') {
                                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                }
                                            } else {
                                                setExerciseState('complete');
                                            }
                                        }}
                                        style={styles.nextButton}
                                    >
                                        <LinearGradient colors={Colors.dark.accentGradient as any} style={styles.nextButtonGradient}>
                                            <Typo variant="body" weight="bold" color="white">
                                                {currentStep < totalSteps - 1 ? 'Next' : 'Complete'}
                                            </Typo>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.stepsIndicator}>
                                    {activeExercise.steps.map((_: any, index: number) => (
                                        <View
                                            key={index}
                                            style={[
                                                styles.stepDot,
                                                index === currentStep && styles.stepDotActive,
                                                index < currentStep && styles.stepDotComplete
                                            ]}
                                        />
                                    ))}
                                </View>
                            </View>
                        )}
                    </GlassView>
                </View>
            </Modal>
        );
    };

    const renderCategoryContent = () => {
        switch (selectedCategory) {
            case 'breathing':
                return (
                    <View style={styles.categoryContent}>
                        <Typo variant="h2" weight="bold" style={styles.sectionTitle}>Breathing Exercises</Typo>
                        <Typo variant="body" color={Colors.dark.textMuted} style={styles.sectionSubtitle}>
                            Regulate your nervous system through breath
                        </Typo>
                        {BREATHING_EXERCISES.map(ex => renderExerciseCard(ex, 'breathing'))}
                    </View>
                );
            case 'grounding':
                return (
                    <View style={styles.categoryContent}>
                        <Typo variant="h2" weight="bold" style={styles.sectionTitle}>Grounding Techniques</Typo>
                        <Typo variant="body" color={Colors.dark.textMuted} style={styles.sectionSubtitle}>
                            Bring yourself back to the present moment
                        </Typo>
                        {GROUNDING_EXERCISES.map(ex => renderExerciseCard(ex, 'grounding'))}
                    </View>
                );
            case 'sleep':
                return (
                    <View style={styles.categoryContent}>
                        <Typo variant="h2" weight="bold" style={styles.sectionTitle}>Sleep Tools</Typo>
                        <Typo variant="body" color={Colors.dark.textMuted} style={styles.sectionSubtitle}>
                            Prepare your mind and body for rest
                        </Typo>
                        {SLEEP_EXERCISES.map(ex => renderExerciseCard(ex, 'sleep'))}
                    </View>
                );
            default:
                return null;
        }
    };

    return (
        <View style={styles.container}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.dark.background }]} />

            <GlassView intensity={50} style={styles.header}>
                <SafeAreaView>
                    <View style={styles.headerContent}>
                        {selectedCategory ? (
                            <TouchableOpacity onPress={() => setSelectedCategory(null)} style={styles.backButton}>
                                <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.dark.text} />
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.headerLeft}>
                                <Typo variant="h2" weight="bold">Library</Typo>
                                <Typo variant="caption" color={Colors.dark.textMuted}>
                                    Wellness tools for any moment
                                </Typo>
                            </View>
                        )}
                    </View>
                </SafeAreaView>
            </GlassView>

            <ScrollView contentContainerStyle={styles.content}>
                {selectedCategory ? (
                    renderCategoryContent()
                ) : (
                    <>
                        <Typo variant="body" color={Colors.dark.textMuted} style={styles.intro}>
                            Quick tools to help you breathe, ground, and rest. Choose what you need right now.
                        </Typo>

                        <View style={styles.categoriesGrid}>
                            {TOOL_CATEGORIES.map(renderCategoryCard)}
                        </View>

                        <View style={styles.quickAccess}>
                            <Typo variant="label" color={Colors.dark.textMuted} style={styles.quickAccessLabel}>
                                QUICK ACCESS
                            </Typo>
                            <TouchableOpacity
                                onPress={() => startBreathingExercise(BREATHING_EXERCISES[0])}
                                activeOpacity={0.8}
                            >
                                <GlassView intensity={30} style={styles.quickAccessCard}>
                                    <View style={styles.quickAccessIcon}>
                                        <MaterialCommunityIcons name="weather-windy" size={28} color={Colors.dark.primary} />
                                    </View>
                                    <View style={styles.quickAccessText}>
                                        <Typo variant="body" weight="bold">Quick Calm</Typo>
                                        <Typo variant="caption" color={Colors.dark.textMuted}>4-7-8 breathing in 4 minutes</Typo>
                                    </View>
                                    <MaterialCommunityIcons name="play-circle" size={32} color={Colors.dark.primary} />
                                </GlassView>
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </ScrollView>

            {renderBreathingModal()}
            {renderGroundingModal()}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    header: {
        paddingTop: Platform.OS === 'android' ? 40 : 0,
        borderBottomWidth: 1,
        borderBottomColor: Colors.dark.glassBorder,
    },
    headerContent: {
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerLeft: {
        flex: 1,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.dark.surfaceHover,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        padding: 20,
        paddingBottom: 120,
    },
    intro: {
        marginBottom: 24,
    },
    categoriesGrid: {
        gap: 16,
    },
    categoryCard: {
        padding: 24,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.dark.glassBorder,
        alignItems: 'center',
    },
    categoryIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    categoryTitle: {
        marginBottom: 4,
    },
    categoryContent: {
        gap: 16,
    },
    sectionTitle: {
        marginBottom: 4,
    },
    sectionSubtitle: {
        marginBottom: 16,
    },
    exerciseCard: {
        padding: 16,
    },
    exerciseHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    durationBadge: {
        backgroundColor: Colors.dark.primary + '15',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    exerciseDescription: {
        lineHeight: 20,
    },
    quickAccess: {
        marginTop: 32,
    },
    quickAccessLabel: {
        marginBottom: 12,
    },
    quickAccessCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.dark.glassBorder,
    },
    quickAccessIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.dark.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
    },
    quickAccessText: {
        flex: 1,
        marginLeft: 12,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    breathingModal: {
        width: '100%',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: Colors.dark.glassBorder,
    },
    groundingModal: {
        width: '100%',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: Colors.dark.glassBorder,
    },
    breathingContainer: {
        alignItems: 'center',
    },
    groundingContainer: {
        alignItems: 'center',
    },
    closeButton: {
        position: 'absolute',
        top: 0,
        right: 0,
        padding: 8,
    },
    breathingCircleContainer: {
        marginVertical: 40,
    },
    breathingCircle: {
        width: 180,
        height: 180,
        borderRadius: 90,
        borderWidth: 3,
        justifyContent: 'center',
        alignItems: 'center',
    },
    groundingContent: {
        alignItems: 'center',
        marginVertical: 40,
        paddingHorizontal: 20,
    },
    groundingIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: Colors.dark.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
    },
    navigationButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
    },
    navButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.dark.surfaceHover,
        justifyContent: 'center',
        alignItems: 'center',
    },
    navButtonDisabled: {
        opacity: 0.5,
    },
    nextButton: {
        flex: 1,
    },
    nextButtonGradient: {
        paddingVertical: 14,
        borderRadius: 24,
        alignItems: 'center',
    },
    stepsIndicator: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 24,
    },
    stepDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.dark.surfaceHover,
    },
    stepDotActive: {
        width: 24,
        backgroundColor: Colors.dark.primary,
    },
    stepDotComplete: {
        backgroundColor: Colors.dark.success,
    },
    completeContainer: {
        alignItems: 'center',
        padding: 20,
    },
    doneButton: {
        marginTop: 32,
        width: '100%',
    },
    doneButtonGradient: {
        paddingVertical: 16,
        borderRadius: 24,
        alignItems: 'center',
    },
});
