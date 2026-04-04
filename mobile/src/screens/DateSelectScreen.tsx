import React, { useState, useEffect } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/types'
import type { HalfDayType } from '../types'
import { fetchHolidays } from '../utils/api'
import { Colors } from '../utils/colors'

type Props = NativeStackScreenProps<RootStackParamList, 'DateSelect'>

export default function DateSelectScreen({ navigation, route }: Props) {
  const { errands, mode } = route.params
  const today = new Date()
  const maxDate = new Date(today)
  maxDate.setMonth(maxDate.getMonth() + 1)

  const [date, setDate] = useState<Date | null>(null)
  const [halfDay, setHalfDay] = useState<HalfDayType | ''>('')
  const [holidays, setHolidays] = useState<Record<string, string>>({})
  const [showPicker, setShowPicker] = useState(Platform.OS === 'ios')

  useEffect(() => {
    fetchHolidays(today.getFullYear().toString()).then(data => {
      const map: Record<string, string> = {}
      for (const h of data.holidays) {
        if (h.is_holiday) {
          const d = String(h.date)
          map[`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`] = h.name
        }
      }
      setHolidays(map)
    }).catch(() => {})
  }, [])

  const dateStr = date ? date.toISOString().split('T')[0] : ''
  const dayNames = ['일', '월', '화', '수', '목', '금', '토']
  const dayOfWeek = date ? dayNames[date.getDay()] : ''
  const isWeekend = date ? date.getDay() === 0 || date.getDay() === 6 : false
  const holidayName = dateStr ? holidays[dateStr] || null : null
  const isClosed = isWeekend || !!holidayName
  const canSubmit = !!date && !!halfDay && !isClosed

  const handleSubmit = () => {
    if (!canSubmit || !date) return
    navigation.navigate('Loading', { errands, mode, date: dateStr, halfDay: halfDay as HalfDayType })
  }

  const halfDayOptions: { type: HalfDayType; label: string; time: string; color: string; selColor: string; selBg: string }[] = [
    { type: '오전반차', label: '오전반차', time: '09:00~13:00', color: Colors.amber[700], selColor: Colors.amber[700], selBg: Colors.amber[50] },
    { type: '오후반차', label: '오후반차', time: '14:00~18:00', color: Colors.indigo[700], selColor: Colors.indigo[700], selBg: Colors.indigo[50] },
    { type: '연차', label: '연차', time: '09:00~18:00', color: Colors.emerald[700], selColor: Colors.emerald[700], selBg: Colors.emerald[50] },
  ]

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Date picker */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>📅  날짜 선택</Text>
        {Platform.OS === 'android' && (
          <Pressable style={styles.dateBtn} onPress={() => setShowPicker(true)}>
            <Text style={date ? styles.dateBtnText : styles.dateBtnPlaceholder}>
              {date ? `${dateStr} (${dayOfWeek}요일)` : '날짜를 선택하세요'}
            </Text>
          </Pressable>
        )}
        {showPicker && (
          <DateTimePicker
            value={date || today}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            minimumDate={today}
            maximumDate={maxDate}
            locale="ko-KR"
            onChange={(_, selectedDate) => {
              if (Platform.OS === 'android') setShowPicker(false)
              if (selectedDate) setDate(selectedDate)
            }}
          />
        )}
        {date && (
          <View style={{ marginTop: 10 }}>
            {holidayName ? (
              <Text style={styles.warning}>
                {dateStr.replace(/-/g, '.')} ({dayOfWeek}요일)은 {holidayName}으로 공공기관 휴무일입니다.
              </Text>
            ) : isWeekend ? (
              <Text style={styles.warning}>{dayOfWeek}요일은 공공기관 휴무일입니다. 평일을 선택해주세요.</Text>
            ) : (
              <Text style={styles.dateInfo}>{dateStr.replace(/-/g, '.')} ({dayOfWeek}요일)</Text>
            )}
          </View>
        )}
      </View>

      {/* Half day type */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>🕐  휴가 유형</Text>
        <View style={styles.halfDayRow}>
          {halfDayOptions.map(opt => {
            const isSel = halfDay === opt.type
            return (
              <Pressable
                key={opt.type}
                style={[
                  styles.halfDayBtn,
                  isSel && { borderColor: opt.selColor, backgroundColor: opt.selBg },
                ]}
                onPress={() => setHalfDay(opt.type)}
              >
                <Text style={[styles.halfDayLabel, isSel && { color: opt.color }]}>{opt.label}</Text>
                <Text style={styles.halfDayTime}>{opt.time}</Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      {/* Submit */}
      <Pressable
        style={[styles.submitBtn, !canSubmit && { opacity: 0.5 }]}
        onPress={handleSubmit}
        disabled={!canSubmit}
      >
        <Text style={styles.submitText}>최적 경로 찾기</Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, gap: 16 },
  card: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.gray[100],
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.gray[900], marginBottom: 14 },
  dateBtn: {
    paddingHorizontal: 14, paddingVertical: 14, borderRadius: 12,
    borderWidth: 2, borderColor: Colors.gray[200], backgroundColor: Colors.white,
  },
  dateBtnText: { fontSize: 16, color: Colors.gray[900] },
  dateBtnPlaceholder: { fontSize: 16, color: Colors.gray[400] },
  warning: { fontSize: 13, color: Colors.red[500], fontWeight: '500' },
  dateInfo: { fontSize: 13, color: Colors.gray[500] },
  halfDayRow: { flexDirection: 'row', gap: 10 },
  halfDayBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 18, borderRadius: 12,
    borderWidth: 2, borderColor: Colors.gray[100], backgroundColor: Colors.gray[50],
  },
  halfDayLabel: { fontSize: 14, fontWeight: '700', color: Colors.gray[700] },
  halfDayTime: { fontSize: 11, color: Colors.gray[400], marginTop: 4 },
  submitBtn: {
    paddingVertical: 16, borderRadius: 12, backgroundColor: Colors.primary[500],
    alignItems: 'center', marginTop: 8,
  },
  submitText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
})
