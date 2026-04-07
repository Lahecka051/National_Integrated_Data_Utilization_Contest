import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import type { SlotRecommendation } from '../../types'
import { Colors } from '../../utils/colors'

const WEATHER_ICONS: Record<string, string> = { '맑음': '☀️', '흐림': '⛅', '비': '🌧️', '눈': '❄️' }

interface Props {
  recommendation: SlotRecommendation
  isSelected: boolean
  onPress: () => void
}

function formatDate(dateStr: string) {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}

export default function RecommendationCard({ recommendation: rec, isSelected, onPress }: Props) {
  const isTop = rec.rank === 1

  return (
    <Pressable
      style={[
        styles.card,
        isSelected && styles.cardSelected,
        isTop && styles.cardTop,
      ]}
      onPress={onPress}
    >
      {isTop && (
        <View style={styles.bestBadge}>
          <Text style={styles.bestText}>BEST</Text>
        </View>
      )}

      <Text style={styles.date}>{formatDate(rec.date)} {rec.day_of_week}</Text>
      <Text style={[styles.halfDay, rec.half_day_type === '오전반차' ? { color: Colors.amber[600] } : { color: Colors.indigo[600] }]}>
        {rec.half_day_type}
        <Text style={styles.timeRange}>
          {' '}({rec.half_day_type === '오전반차' ? '09:00~13:00' : '14:00~18:00'})
        </Text>
      </Text>

      <View style={styles.totalRow}>
        <Text style={styles.totalNum}>{rec.total_minutes}</Text>
        <Text style={styles.totalUnit}>분 소요</Text>
      </View>

      <View style={styles.breakdown}>
        <BreakdownRow icon="⏳" label="대기시간" value={`${rec.total_wait_time}분`} />
        <BreakdownRow icon="🚶" label="이동시간" value={`${rec.total_travel_time}분`} />
        <BreakdownRow
          icon={WEATHER_ICONS[rec.weather.condition] || '🌤️'}
          label="날씨"
          value={`${rec.weather.condition} ${rec.weather.temperature}°C`}
        />
      </View>

      <Text style={styles.reason} numberOfLines={3}>{rec.reason}</Text>
    </Pressable>
  )
}

function BreakdownRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.breakdownRow}>
      <Text style={styles.breakdownLabel}>{icon} {label}</Text>
      <Text style={styles.breakdownValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    width: 260, backgroundColor: Colors.white, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.gray[100], marginRight: 12,
  },
  cardSelected: { borderColor: Colors.primary[500], borderWidth: 2, shadowColor: Colors.primary[500], shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  cardTop: { backgroundColor: Colors.primary[50], borderColor: Colors.primary[100] },
  bestBadge: {
    position: 'absolute', top: -10, left: 14,
    backgroundColor: Colors.primary[600], paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8,
  },
  bestText: { color: Colors.white, fontSize: 11, fontWeight: '700' },
  date: { fontSize: 17, fontWeight: '700', color: Colors.gray[900], marginTop: 4 },
  halfDay: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  timeRange: { color: Colors.gray[400], fontWeight: '400' },
  totalRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 12, marginBottom: 14 },
  totalNum: { fontSize: 30, fontWeight: '700', color: Colors.gray[900] },
  totalUnit: { fontSize: 13, color: Colors.gray[400], marginBottom: 4 },
  breakdown: { gap: 8, marginBottom: 12 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between' },
  breakdownLabel: { fontSize: 13, color: Colors.gray[500] },
  breakdownValue: { fontSize: 13, fontWeight: '500', color: Colors.gray[700] },
  reason: { fontSize: 13, color: Colors.gray[500], lineHeight: 19 },
})
