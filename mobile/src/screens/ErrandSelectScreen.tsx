import React, { useState, useEffect } from 'react'
import {
  View, Text, TextInput, ScrollView, Pressable, StyleSheet,
  Modal, FlatList, ActivityIndicator,
} from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/types'
import type { Errand, FacilityType } from '../types'
import { fetchNearbyBanks, parseErrandsFromText, fetchLLMStatus, type NearbyPlace } from '../utils/api'
import { Colors } from '../utils/colors'

type Props = NativeStackScreenProps<RootStackParamList, 'ErrandSelect'>

const TASK_MAP: Record<string, { type: FacilityType; tasks: string[] }> = {
  '민원실': { type: '민원실', tasks: ['전입신고', '주민등록등본 발급', '인감증명서 발급', '여권 신청'] },
  '은행':   { type: '은행',   tasks: ['통장 개설', '카드 발급', '대출 상담', '환전'] },
  '우체국': { type: '우체국', tasks: ['등기우편 발송', '택배 발송'] },
}

const DURATIONS: Record<string, number> = {
  '전입신고': 10, '주민등록등본 발급': 5, '인감증명서 발급': 5, '여권 신청': 15,
  '통장 개설': 20, '카드 발급': 15, '대출 상담': 30, '환전': 10,
  '등기우편 발송': 10, '택배 발송': 5,
}

const ICONS: Record<string, string> = { '민원실': '🏛️', '은행': '🏦', '우체국': '📮' }

export default function ErrandSelectScreen({ navigation, route }: Props) {
  const { mode } = route.params
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [nearbyBanks, setNearbyBanks] = useState<NearbyPlace[]>([])
  const [selectedBank, setSelectedBank] = useState<NearbyPlace | null>(null)
  const [showBankPicker, setShowBankPicker] = useState(false)
  const [banksLoading, setBanksLoading] = useState(false)

  const [nlText, setNlText] = useState('')
  const [nlLoading, setNlLoading] = useState(false)
  const [nlMessage, setNlMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [llmAvailable, setLlmAvailable] = useState(false)

  useEffect(() => {
    fetchLLMStatus().then(s => setLlmAvailable(s.available)).catch(() => {})
  }, [])

  const hasBankTask = Array.from(selected).some(t => TASK_MAP['은행'].tasks.includes(t))

  useEffect(() => {
    if (hasBankTask && nearbyBanks.length === 0 && !banksLoading) {
      setBanksLoading(true)
      fetchNearbyBanks().then(data => { setNearbyBanks(data.banks); setBanksLoading(false) })
        .catch(() => setBanksLoading(false))
    }
  }, [hasBankTask])

  const toggle = (task: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(task)) next.delete(task); else next.add(task)
      return next
    })
  }

  const handleNLParse = async () => {
    if (!nlText.trim()) return
    setNlLoading(true); setNlMessage(null)
    try {
      const result = await parseErrandsFromText(nlText)
      if (result.parsed_successfully && result.errands.length > 0) {
        const newSel = new Set(selected)
        const names: string[] = []
        result.errands.forEach(e => { newSel.add(e.task_name); names.push(e.task_name) })
        setSelected(newSel)
        setNlMessage({ type: 'success', text: `AI가 분석한 용무: ${names.join(', ')}` })
      } else {
        setNlMessage({ type: 'error', text: '자동 분석에 실패했습니다. 아래에서 직접 선택해주세요.' })
      }
    } catch {
      setNlMessage({ type: 'error', text: '자동 분석에 실패했습니다.' })
    } finally { setNlLoading(false) }
  }

  const handleSubmit = () => {
    const errands: Errand[] = []
    for (const [, info] of Object.entries(TASK_MAP)) {
      for (const task of info.tasks) {
        if (selected.has(task)) {
          errands.push({
            task_type: info.type,
            task_name: task,
            facility_id: info.type === '은행' && selectedBank ? selectedBank.id : undefined,
            estimated_duration: DURATIONS[task] || 15,
          })
        }
      }
    }
    if (errands.length === 0) return

    if (mode === 'mode2') {
      navigation.navigate('DateSelect', { errands, mode })
    } else {
      navigation.navigate('Loading', { errands, mode })
    }
  }

  const totalTime = Array.from(selected).reduce((s, t) => s + (DURATIONS[t] || 15), 0)

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* AI NL input */}
        {llmAvailable && (
          <View style={styles.nlCard}>
            <View style={styles.nlHeader}>
              <View style={styles.nlIcon}><Text style={styles.nlIconText}>AI</Text></View>
              <Text style={styles.nlTitle}>AI로 용무 입력</Text>
            </View>
            <View style={styles.nlInputRow}>
              <TextInput
                style={styles.nlInput}
                value={nlText}
                onChangeText={setNlText}
                onSubmitEditing={handleNLParse}
                placeholder="예: 은행 가서 통장 만들고 서류 떼야 해"
                placeholderTextColor={Colors.gray[400]}
                editable={!nlLoading}
                returnKeyType="send"
              />
              <Pressable
                style={[styles.nlBtn, (nlLoading || !nlText.trim()) && { opacity: 0.5 }]}
                onPress={handleNLParse}
                disabled={nlLoading || !nlText.trim()}
              >
                {nlLoading ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.nlBtnText}>AI 분석</Text>}
              </Pressable>
            </View>
            {nlMessage && (
              <Text style={[styles.nlMsg, nlMessage.type === 'error' && { color: Colors.red[600] }]}>
                {nlMessage.text}
              </Text>
            )}
          </View>
        )}

        {/* Task categories */}
        {Object.entries(TASK_MAP).map(([category, info]) => (
          <View key={category} style={styles.card}>
            <View style={styles.catHeader}>
              <Text style={styles.catIcon}>{ICONS[category]}</Text>
              <View>
                <Text style={styles.catTitle}>{category}</Text>
                <Text style={styles.catSub}>
                  {category === '은행' ? '영업시간 09:00~16:00' : '운영시간 09:00~18:00'}
                </Text>
              </View>
            </View>
            <View style={styles.taskGrid}>
              {info.tasks.map(task => {
                const isSel = selected.has(task)
                return (
                  <Pressable
                    key={task}
                    style={[styles.taskBtn, isSel && styles.taskBtnSel]}
                    onPress={() => toggle(task)}
                  >
                    <View>
                      <Text style={[styles.taskName, isSel && { color: Colors.primary[700] }]}>{task}</Text>
                      <Text style={styles.taskDur}>~{DURATIONS[task]}분</Text>
                    </View>
                    {isSel && <Text style={{ color: Colors.primary[600], fontSize: 18 }}>✓</Text>}
                  </Pressable>
                )
              })}
            </View>

            {/* Bank picker */}
            {category === '은행' && hasBankTask && (
              <View style={styles.bankSection}>
                <Text style={styles.bankLabel}>방문할 은행 선택</Text>
                {selectedBank ? (
                  <View style={styles.bankSelected}>
                    <View style={styles.flex}>
                      <Text style={styles.bankName}>{selectedBank.name}</Text>
                      <Text style={styles.bankAddr}>{selectedBank.address} · {selectedBank.distance}m</Text>
                    </View>
                    <Pressable onPress={() => setShowBankPicker(true)}>
                      <Text style={styles.bankChange}>변경</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable style={styles.bankPlaceholder} onPress={() => setShowBankPicker(true)}>
                    <Text style={styles.bankPlaceholderText}>
                      {banksLoading ? '근처 은행 검색 중...' : '근처 은행을 선택하세요'}
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.bottomLabel}>선택된 용무</Text>
          <Text style={styles.bottomCount}>
            {selected.size}개
            {selected.size > 0 && (
              <Text style={styles.bottomTime}>  처리시간 약 {totalTime}분</Text>
            )}
          </Text>
        </View>
        <Pressable
          style={[styles.submitBtn, selected.size === 0 && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={selected.size === 0}
        >
          <Text style={styles.submitBtnText}>
            {mode === 'mode1' ? '최적 날짜 찾기' : '날짜 선택하기'}
          </Text>
        </Pressable>
      </View>

      {/* Bank picker modal */}
      <Modal visible={showBankPicker} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowBankPicker(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>근처 은행 선택</Text>
              <Pressable onPress={() => setShowBankPicker(false)}>
                <Text style={{ fontSize: 20, color: Colors.gray[400] }}>✕</Text>
              </Pressable>
            </View>
            <FlatList
              data={nearbyBanks}
              keyExtractor={b => b.id}
              renderItem={({ item: bank }) => (
                <Pressable
                  style={[styles.bankItem, selectedBank?.id === bank.id && styles.bankItemSel]}
                  onPress={() => { setSelectedBank(bank); setShowBankPicker(false) }}
                >
                  <View style={styles.flex}>
                    <Text style={styles.bankItemName}>{bank.name}</Text>
                    <Text style={styles.bankItemAddr}>{bank.road_address || bank.address}</Text>
                  </View>
                  <Text style={styles.bankItemDist}>{bank.distance}m</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>은행을 검색 중입니다...</Text>}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  flex: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100, gap: 16 },

  nlCard: {
    backgroundColor: Colors.violet[50], borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.violet[200],
  },
  nlHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  nlIcon: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.violet[100],
    alignItems: 'center', justifyContent: 'center',
  },
  nlIconText: { fontSize: 11, fontWeight: '700', color: Colors.violet[800] },
  nlTitle: { fontSize: 14, fontWeight: '700', color: Colors.violet[800] },
  nlInputRow: { flexDirection: 'row', gap: 8 },
  nlInput: {
    flex: 1, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.violet[200], backgroundColor: Colors.white,
    fontSize: 13, color: Colors.gray[900],
  },
  nlBtn: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    backgroundColor: Colors.violet[600], justifyContent: 'center',
  },
  nlBtnText: { color: Colors.white, fontWeight: '600', fontSize: 13 },
  nlMsg: { marginTop: 8, fontSize: 13, color: Colors.violet[700] },

  card: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.gray[100],
  },
  catHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  catIcon: { fontSize: 28 },
  catTitle: { fontSize: 17, fontWeight: '700', color: Colors.gray[900] },
  catSub: { fontSize: 11, color: Colors.gray[400] },

  taskGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  taskBtn: {
    width: '47%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12,
    borderWidth: 2, borderColor: Colors.gray[100], backgroundColor: Colors.gray[50],
  },
  taskBtnSel: { borderColor: Colors.primary[500], backgroundColor: Colors.primary[50] },
  taskName: { fontSize: 14, fontWeight: '500', color: Colors.gray[700] },
  taskDur: { fontSize: 11, color: Colors.gray[400], marginTop: 2 },

  bankSection: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.gray[100] },
  bankLabel: { fontSize: 13, fontWeight: '500', color: Colors.gray[700], marginBottom: 8 },
  bankSelected: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.amber[50],
    borderWidth: 1, borderColor: Colors.amber[200], borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  },
  bankName: { fontSize: 14, fontWeight: '700', color: Colors.amber[800] },
  bankAddr: { fontSize: 12, color: Colors.amber[600], marginTop: 2 },
  bankChange: { fontSize: 12, fontWeight: '500', color: Colors.amber[700], textDecorationLine: 'underline' },
  bankPlaceholder: {
    paddingVertical: 12, borderRadius: 12, borderWidth: 2,
    borderStyle: 'dashed', borderColor: Colors.gray[200], alignItems: 'center',
  },
  bankPlaceholderText: { fontSize: 13, color: Colors.gray[500] },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.95)', borderTopWidth: 1, borderTopColor: Colors.gray[200],
  },
  bottomLabel: { fontSize: 12, color: Colors.gray[500] },
  bottomCount: { fontSize: 18, fontWeight: '700', color: Colors.gray[900] },
  bottomTime: { fontSize: 13, fontWeight: '400', color: Colors.gray[400] },
  submitBtn: {
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12,
    backgroundColor: Colors.primary[500],
  },
  submitBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '70%', paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.gray[100],
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: Colors.gray[900] },
  bankItem: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 8,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12,
    borderWidth: 2, borderColor: Colors.gray[100],
  },
  bankItemSel: { borderColor: Colors.amber[500], backgroundColor: Colors.amber[50] },
  bankItemName: { fontSize: 14, fontWeight: '500', color: Colors.gray[900] },
  bankItemAddr: { fontSize: 12, color: Colors.gray[400], marginTop: 2 },
  bankItemDist: { fontSize: 12, color: Colors.gray[400], marginLeft: 8 },
  emptyText: { textAlign: 'center', color: Colors.gray[400], paddingVertical: 40, fontSize: 13 },
})
