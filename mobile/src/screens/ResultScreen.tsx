import React, { useState, useRef } from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/types'
import type { SlotRecommendation } from '../types'
import RecommendationCard from '../components/result/RecommendationCard'
import Timeline from '../components/result/Timeline'
import KakaoMapWebView, { type KakaoMapHandle } from '../components/map/KakaoMapWebView'
import CongestionHeatmap from '../components/result/CongestionHeatmap'
import ResultChatBot from '../components/common/ResultChatBot'
import { Colors } from '../utils/colors'

type Props = NativeStackScreenProps<RootStackParamList, 'Result'>

const START_LAT = 35.5396
const START_LNG = 129.3114

export default function ResultScreen({ navigation, route }: Props) {
  const { result, errands, mode } = route.params
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [showChat, setShowChat] = useState(false)
  const selected = result.recommendations[selectedIdx]
  const mapRef = useRef<KakaoMapHandle>(null)

  const handleVisitPress = (index: number) => {
    if (!mapRef.current || !selected) return
    if (index === -1) {
      mapRef.current.focusOn(START_LAT, START_LNG, 3)
    } else if (index < selected.visits.length) {
      const v = selected.visits[index]
      mapRef.current.focusOn(v.facility.lat, v.facility.lng, 3)
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            {mode === 'mode1' ? '추천 결과' : '최적 경로 결과'}
          </Text>
          <Text style={styles.subtitle}>
            {mode === 'mode1'
              ? `${errands.length}개 용무 처리에 최적인 반차 날짜를 찾았습니다`
              : `${errands.length}개 용무의 최적 방문 순서를 찾았습니다`}
          </Text>
        </View>

        {/* Recommendation cards (horizontal scroll) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardsContainer}
          snapToInterval={272}
          decelerationRate="fast"
        >
          {result.recommendations.map((rec, i) => (
            <RecommendationCard
              key={i}
              recommendation={rec}
              isSelected={selectedIdx === i}
              onPress={() => setSelectedIdx(i)}
            />
          ))}
        </ScrollView>

        {/* Not recommended */}
        {result.not_recommended && (
          <NotRecommendedCard recommendation={result.not_recommended} />
        )}

        {/* Timeline */}
        {selected && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>🕐  방문 일정</Text>
            <Timeline
              visits={selected.visits}
              halfDayType={selected.half_day_type}
              onVisitPress={handleVisitPress}
            />
          </View>
        )}

        {/* Kakao Map */}
        {selected && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>📍  경로 지도</Text>
            <KakaoMapWebView ref={mapRef} visits={selected.visits} />
          </View>
        )}

        {/* Congestion heatmap */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📊  요일별 혼잡도 비교</Text>
          <CongestionHeatmap />
        </View>

        {/* Data sources */}
        <View style={[styles.card, { backgroundColor: Colors.primary[50] }]}>
          <Text style={styles.sectionTitle}>이 추천에 활용된 데이터</Text>
          <View style={styles.dataGrid}>
            {[
              { icon: '🏛️', name: '민원실 실시간 정보', src: '공공데이터포털' },
              { icon: '🚌', name: '버스 실시간 위치', src: '공공데이터포털' },
              { icon: '🚦', name: '신호등 실시간 정보', src: '공공데이터포털' },
              { icon: '🌤️', name: '기상청 단기예보', src: '기상청' },
              { icon: '📮', name: '전국 우체국 현황', src: '우정사업본부' },
              { icon: '🏦', name: '금융기관 이용통계', src: '한국은행' },
              { icon: '📅', name: '공휴일 정보', src: '천문연구원' },
            ].map((d, i) => (
              <View key={i} style={styles.dataItem}>
                <Text style={{ fontSize: 16 }}>{d.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dataName}>{d.name}</Text>
                  <Text style={styles.dataSrc}>{d.src}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <Pressable style={styles.resetBtn} onPress={() => navigation.popToTop()}>
            <Text style={styles.resetText}>다른 용무로 다시 추천받기</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Floating chat button */}
      <Pressable style={styles.fab} onPress={() => setShowChat(!showChat)}>
        <Text style={styles.fabText}>{showChat ? '✕' : '💬'}</Text>
      </Pressable>

      {/* Chat overlay */}
      {showChat && selected && (
        <ResultChatBot
          recommendation={selected}
          errands={errands}
          onClose={() => setShowChat(false)}
        />
      )}
    </View>
  )
}

function NotRecommendedCard({ recommendation: rec }: { recommendation: SlotRecommendation }) {
  return (
    <View style={styles.notRecCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.notRecLabel}>비추천</Text>
        <Text style={styles.notRecDate}>{rec.date} {rec.day_of_week} {rec.half_day_type}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.notRecMin}>{rec.total_minutes}분</Text>
        <Text style={styles.notRecReason} numberOfLines={1}>{rec.reason}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 100 },
  header: { alignItems: 'center', marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '700', color: Colors.gray[900] },
  subtitle: { fontSize: 14, color: Colors.gray[500], marginTop: 4, textAlign: 'center' },
  cardsContainer: { paddingRight: 16, paddingTop: 14 },
  card: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.gray[100],
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.gray[900], marginBottom: 14 },

  notRecCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.red[50], borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.red[100],
  },
  notRecLabel: { fontSize: 13, fontWeight: '700', color: Colors.red[700] },
  notRecDate: { fontSize: 13, color: Colors.red[600], marginTop: 2 },
  notRecMin: { fontSize: 18, fontWeight: '700', color: Colors.red[700] },
  notRecReason: { fontSize: 11, color: Colors.red[500], marginTop: 2, maxWidth: 150 },

  dataGrid: { gap: 8 },
  dataItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  dataName: { fontSize: 13, fontWeight: '500', color: Colors.gray[800] },
  dataSrc: { fontSize: 11, color: Colors.gray[400] },

  actions: { alignItems: 'center', marginTop: 8, marginBottom: 40 },
  resetBtn: {
    paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.gray[200], backgroundColor: Colors.white,
  },
  resetText: { fontSize: 14, fontWeight: '600', color: Colors.gray[700] },

  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.violet[600],
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  fabText: { fontSize: 22, color: Colors.white },
})
