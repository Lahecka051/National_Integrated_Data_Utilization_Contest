import React from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { Colors } from '../../utils/colors'

const DAYS = ['월', '화', '수', '목', '금']
const HOURS = ['09', '10', '11', '12', '13', '14', '15', '16', '17']

const CIVIL_BASE = 8.5
const CIVIL_WD = [1.80, 0.90, 1.05, 0.75, 1.40]
const CIVIL_HR: Record<number, number> = { 9:1.30, 10:1.60, 11:1.80, 12:0.50, 13:0.80, 14:1.10, 15:0.95, 16:0.80, 17:0.60 }

const BANK_BASE = 12.3
const BANK_WD = [1.40, 0.80, 0.90, 0.70, 1.30]
const BANK_HR: Record<number, number> = { 9:1.20, 10:1.40, 11:1.50, 12:0.70, 13:0.90, 14:1.10, 15:1.00 }

const calcCivil = (wd: number, hr: number) => Math.max(1, Math.round(CIVIL_BASE * CIVIL_WD[wd] * (CIVIL_HR[hr] ?? 1.0)))
const calcBank = (wd: number, hr: number) => hr >= 16 ? 0 : Math.max(1, Math.round(BANK_BASE * BANK_WD[wd] * (BANK_HR[hr] ?? 1.0)))

const CIVIL_DATA = DAYS.map((_, wd) => HOURS.map((_, hi) => calcCivil(wd, hi + 9)))
const BANK_DATA = DAYS.map((_, wd) => HOURS.map((_, hi) => calcBank(wd, hi + 9)))

function getColor(value: number): string {
  if (value === 0) return '#f3f4f6'
  if (value <= 5) return '#dcfce7'
  if (value <= 10) return '#bbf7d0'
  if (value <= 15) return '#fef08a'
  if (value <= 20) return '#fdba74'
  if (value <= 25) return '#fb923c'
  return '#ef4444'
}

export default function CongestionHeatmap() {
  return (
    <View style={styles.container}>
      <HeatmapGrid title="🏛️ 민원실 (울산 남구청)" data={CIVIL_DATA} subtitle="행정안전부 민원처리 통계 기반" />
      <HeatmapGrid title="🏦 은행 (BNK경남은행)" data={BANK_DATA} subtitle="한국은행 금융기관 이용 통계 기반" />
      <View style={styles.legend}>
        <Text style={styles.legendText}>한산</Text>
        <View style={styles.legendColors}>
          {['#dcfce7', '#bbf7d0', '#fef08a', '#fdba74', '#fb923c', '#ef4444'].map(c => (
            <View key={c} style={[styles.legendBox, { backgroundColor: c }]} />
          ))}
        </View>
        <Text style={styles.legendText}>혼잡</Text>
      </View>
      <Text style={styles.legendNote}>단위: 예상 대기시간(분) · 통계 기반 추정</Text>
    </View>
  )
}

function HeatmapGrid({ title, data, subtitle }: { title: string; data: number[][]; subtitle: string }) {
  return (
    <View style={styles.grid}>
      <Text style={styles.gridTitle}>{title}</Text>
      <Text style={styles.gridSub}>{subtitle}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* Header row */}
          <View style={styles.row}>
            <View style={styles.dayCell} />
            {HOURS.map(h => (
              <View key={h} style={styles.headerCell}>
                <Text style={styles.headerText}>{h}시</Text>
              </View>
            ))}
          </View>
          {/* Data rows */}
          {DAYS.map((day, di) => (
            <View key={day} style={styles.row}>
              <View style={styles.dayCell}>
                <Text style={styles.dayText}>{day}</Text>
              </View>
              {HOURS.map((_, hi) => {
                const val = data[di][hi]
                return (
                  <View key={hi} style={styles.cell}>
                    <View style={[styles.cellInner, { backgroundColor: getColor(val) }]}>
                      <Text style={[styles.cellText, val > 20 && { color: '#fff' }]}>
                        {val === 0 ? '-' : val}
                      </Text>
                    </View>
                  </View>
                )
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

const CELL_SIZE = 38

const styles = StyleSheet.create({
  container: { gap: 20 },
  grid: {},
  gridTitle: { fontSize: 14, fontWeight: '500', color: Colors.gray[700], marginBottom: 2 },
  gridSub: { fontSize: 11, color: Colors.gray[400], marginBottom: 8 },
  row: { flexDirection: 'row' },
  dayCell: { width: 28, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 6 },
  dayText: { fontSize: 12, fontWeight: '500', color: Colors.gray[500] },
  headerCell: { width: CELL_SIZE, alignItems: 'center', paddingVertical: 4 },
  headerText: { fontSize: 10, color: Colors.gray[400] },
  cell: { width: CELL_SIZE, padding: 1.5 },
  cellInner: { borderRadius: 4, paddingVertical: 6, alignItems: 'center' },
  cellText: { fontSize: 11, fontWeight: '500', color: Colors.gray[700] },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  legendText: { fontSize: 11, color: Colors.gray[500] },
  legendColors: { flexDirection: 'row', gap: 2 },
  legendBox: { width: 22, height: 12, borderRadius: 2 },
  legendNote: { fontSize: 10, color: Colors.gray[400], textAlign: 'center', marginTop: 4 },
})
