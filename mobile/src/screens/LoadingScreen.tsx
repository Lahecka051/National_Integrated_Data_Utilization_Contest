import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/types'
import { fetchRecommendation, fetchOptimizeSlot } from '../utils/api'
import { Colors } from '../utils/colors'

type Props = NativeStackScreenProps<RootStackParamList, 'Loading'>

const STEPS = [
  '민원실/은행 혼잡도 예측',
  '시설 간 이동시간 산출',
  '횡단보도 신호 대기시간 계산',
  '날씨 보정 적용',
  '최적 방문 순서 탐색',
]

export default function LoadingScreen({ navigation, route }: Props) {
  const { errands, mode, date, halfDay } = route.params
  const anims = useRef(STEPS.map(() => new Animated.Value(0))).current

  useEffect(() => {
    // Staggered fade-in
    const animations = anims.map((anim, i) =>
      Animated.timing(anim, { toValue: 1, duration: 400, delay: i * 300, useNativeDriver: true })
    )
    Animated.stagger(300, animations).start()

    // API call
    const doFetch = async () => {
      try {
        const result = mode === 'mode2' && date && halfDay
          ? await fetchOptimizeSlot(errands, date, halfDay)
          : await fetchRecommendation(errands)
        navigation.replace('Result', { result, errands, mode })
      } catch {
        navigation.goBack()
      }
    }
    doFetch()
  }, [])

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <View style={styles.spinner}>
          <ActivityIndicator size="large" color={Colors.primary[600]} />
        </View>
        <Text style={styles.title}>최적 날짜를 분석하고 있어요</Text>
        <Text style={styles.subtitle}>
          향후 2주간 {errands.length}개 용무의 최적 시간을 시뮬레이션 중...
        </Text>
        <View style={styles.steps}>
          {STEPS.map((label, i) => (
            <Animated.View key={i} style={[styles.step, { opacity: anims[i] }]}>
              <View style={styles.stepDot} />
              <Text style={styles.stepText}>{label}</Text>
            </Animated.View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  spinner: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primary[50],
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  title: { fontSize: 22, fontWeight: '700', color: Colors.gray[900], marginBottom: 8 },
  subtitle: { fontSize: 14, color: Colors.gray[500], marginBottom: 32, textAlign: 'center' },
  steps: { width: '100%', maxWidth: 320, gap: 10 },
  step: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.white, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
  },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary[400] },
  stepText: { fontSize: 14, color: Colors.gray[600] },
})
