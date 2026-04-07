import React, { useState, useEffect } from 'react'
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native'
import type { FacilityVisit, HalfDayType } from '../../types'
import { Colors, FacilityColors } from '../../utils/colors'

interface Props {
  visits: FacilityVisit[]
  halfDayType: HalfDayType
  onVisitPress?: (index: number) => void
}

export default function Timeline({ visits, halfDayType, onVisitPress }: Props) {
  const startTime = halfDayType === '오후반차' ? '14:00' : '09:00'

  return (
    <View>
      {/* Start */}
      <Pressable onPress={() => onVisitPress?.(-1)}>
        <TimelineItem
          time={startTime}
          title="출발"
          subtitle="울산시청"
          icon="📍"
          colors={{ bg: Colors.gray[50], text: Colors.gray[700], dot: Colors.gray[400] }}
        />
      </Pressable>

      {visits.map((visit, i) => {
        const fc = FacilityColors[visit.facility.type] || FacilityColors['민원실']
        const tasks = visit.task_names?.length > 0 ? visit.task_names : [visit.facility.type + ' 업무']
        const icon = visit.facility.type === '민원실' ? '🏛️' : visit.facility.type === '은행' ? '🏦' : '📮'

        return (
          <View key={i}>
            <TravelSegment visit={visit} />
            <Pressable onPress={() => onVisitPress?.(i)}>
              <TimelineItem
                time={visit.arrival_time}
                title={visit.facility.name}
                subtitle={`대기 ${visit.wait_time}분 + 처리 ${visit.process_time}분`}
                detail={`${visit.arrival_time} 도착 → ${visit.departure_time} 완료`}
                tasks={tasks}
                icon={icon}
                colors={fc}
                waitTime={visit.wait_time}
              />
            </Pressable>
          </View>
        )
      })}

      {visits.length > 0 && (
        <View style={styles.completeLine}>
          <Text style={styles.completeText}>✅ 모든 용무 완료!</Text>
        </View>
      )}
    </View>
  )
}

function TravelSegment({ visit }: { visit: FacilityVisit }) {
  const [showAlt, setShowAlt] = useState(false)

  if (visit.travel_mode === 'bus' && visit.bus_info) {
    const info = visit.bus_info
    return (
      <View style={styles.travelLine}>
        {info.walk_to_stop_minutes > 0 && (
          <Text style={styles.travelText}>🚶 도보 {info.walk_to_stop_minutes}분 → {info.stop_name}</Text>
        )}
        <View style={styles.busCard}>
          <View style={styles.busRow}>
            <View>
              <Text style={styles.busTitle}>🚌 {info.bus_no}번 승차</Text>
              <Text style={styles.busSub}>{info.stop_name} → 승차 {info.ride_minutes}분</Text>
            </View>
            <BusCountdown intervalSec={info.alternatives[0]?.interval_min ? info.alternatives[0].interval_min * 60 : 600} />
          </View>
          {info.alternatives.length > 1 && (
            <View style={styles.altSection}>
              <Pressable onPress={() => setShowAlt(!showAlt)}>
                <Text style={styles.altToggle}>{showAlt ? '접기' : `다른 버스 ${info.alternatives.length - 1}개 더 보기`}</Text>
              </Pressable>
              {showAlt && info.alternatives.filter(a => a.bus_no !== info.bus_no).map((alt, j) => (
                <View key={j} style={styles.altRow}>
                  <Text style={styles.altBus}>{alt.bus_no}번</Text>
                  <Text style={styles.altInfo}>배차 {alt.interval_min}분 · 승차 {alt.ride_min}분</Text>
                </View>
              ))}
            </View>
          )}
        </View>
        <Text style={styles.travelText}>총 이동 {visit.travel_minutes}분</Text>
      </View>
    )
  }

  return (
    <View style={styles.travelLine}>
      <Text style={styles.travelText}>🚶 도보 이동 {visit.travel_minutes}분</Text>
    </View>
  )
}

function BusCountdown({ intervalSec }: { intervalSec: number }) {
  const [remain, setRemain] = useState(() => {
    const now = Math.floor(Date.now() / 1000)
    return intervalSec - (now % intervalSec)
  })

  useEffect(() => {
    const timer = setInterval(() => {
      setRemain(prev => prev <= 1 ? intervalSec : prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [intervalSec])

  const min = Math.floor(remain / 60)
  const sec = remain % 60

  return (
    <View style={{ alignItems: 'flex-end' }}>
      <Text style={styles.countdown}>{min}:{sec.toString().padStart(2, '0')}</Text>
      <Text style={styles.countdownLabel}>후 도착</Text>
    </View>
  )
}

interface TimelineItemProps {
  time: string; title: string; subtitle: string; detail?: string
  tasks?: string[]; icon: string
  colors: { bg: string; text: string; dot: string }
  waitTime?: number
}

function TimelineItem({ time, title, subtitle, detail, tasks, icon, colors, waitTime }: TimelineItemProps) {
  return (
    <View style={styles.itemRow}>
      <View style={[styles.itemIcon, { backgroundColor: colors.bg, borderColor: Colors.white }]}>
        <Text style={{ fontSize: 14 }}>{icon}</Text>
      </View>
      <View style={[styles.itemBody, { backgroundColor: colors.bg }]}>
        <View style={styles.itemHeader}>
          <Text style={[styles.itemTitle, { color: colors.text }]}>{title}</Text>
          <Text style={styles.itemTime}>{time}</Text>
        </View>
        <Text style={styles.itemSub}>{subtitle}</Text>
        {detail && <Text style={styles.itemDetail}>{detail}</Text>}
        {tasks && tasks.length > 0 && (
          <View style={styles.taskChips}>
            {tasks.map((t, i) => (
              <View key={i} style={styles.taskChip}>
                <Text style={styles.taskChipText}>{t}</Text>
              </View>
            ))}
          </View>
        )}
        {waitTime != null && waitTime > 15 && (
          <Text style={styles.warnText}>⚠️ 대기시간 다소 길 수 있음</Text>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  itemRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  itemIcon: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.white,
  },
  itemBody: { flex: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  itemTitle: { fontWeight: '700', fontSize: 14 },
  itemTime: { fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: Colors.gray[500] },
  itemSub: { fontSize: 12, color: Colors.gray[500] },
  itemDetail: { fontSize: 11, color: Colors.gray[400], marginTop: 2 },
  taskChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  taskChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.7)' },
  taskChipText: { fontSize: 11, color: Colors.gray[600] },
  warnText: { fontSize: 11, color: Colors.amber[600], marginTop: 6 },

  travelLine: {
    marginLeft: 18, borderLeftWidth: 2, borderLeftColor: Colors.gray[200],
    borderStyle: 'dashed', paddingLeft: 28, paddingVertical: 6, gap: 4,
  },
  travelText: { fontSize: 12, color: Colors.gray[400] },

  busCard: {
    backgroundColor: Colors.primary[50], borderWidth: 1, borderColor: Colors.primary[100],
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
  },
  busRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  busTitle: { fontSize: 12, fontWeight: '500', color: Colors.primary[700] },
  busSub: { fontSize: 11, color: Colors.primary[500], marginTop: 2 },
  countdown: { fontSize: 14, fontWeight: '700', color: Colors.primary[700], fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  countdownLabel: { fontSize: 9, color: Colors.primary[400] },

  altSection: { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: Colors.primary[100] },
  altToggle: { fontSize: 11, fontWeight: '500', color: Colors.primary[600] },
  altRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 4,
    backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4,
  },
  altBus: { fontSize: 11, fontWeight: '500', color: Colors.primary[700] },
  altInfo: { fontSize: 11, color: Colors.gray[500] },

  completeLine: {
    marginLeft: 18, borderLeftWidth: 2, borderLeftColor: Colors.gray[200],
    borderStyle: 'dashed', paddingLeft: 28, paddingVertical: 8,
  },
  completeText: { fontSize: 13, fontWeight: '500', color: Colors.green[600] },
})

