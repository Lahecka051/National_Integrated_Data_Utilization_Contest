import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  View, Text, TextInput, ScrollView, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/types'
import type { ChatMessage, Errand, TimeConstraint, ConsultantAction, RecommendationResponse } from '../types'
import { sendConsultantMessage, fetchLLMStatus } from '../utils/api'
import { Colors } from '../utils/colors'

type Props = NativeStackScreenProps<RootStackParamList, 'Landing'>

const SUGGESTIONS = [
  '은행 가서 통장 만들고 싶어요',
  '주민센터에서 서류 떼야 해요',
  '오후 2시부터 4시까지 비어요',
]

export default function LandingScreen({ navigation }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: '안녕하세요! 하루짜기 일정 상담사입니다. 어떤 용무를 처리하실 건가요? 비는 시간대가 있다면 함께 알려주세요!' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionErrands, setSessionErrands] = useState<Errand[]>([])
  const [timeConstraint, setTimeConstraint] = useState<TimeConstraint | undefined>()
  const [llmAvailable, setLlmAvailable] = useState(false)
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    fetchLLMStatus().then(s => setLlmAvailable(s.available)).catch(() => {})
  }, [])

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
  }, [messages])

  const handleSend = useCallback(async (text?: string) => {
    const content = text || input.trim()
    if (!content || loading) return

    const userMsg: ChatMessage = { role: 'user', content }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    setLoading(true)

    try {
      const res = await sendConsultantMessage(updated, sessionErrands, timeConstraint)
      if (res.updated_errands?.length > 0) setSessionErrands(res.updated_errands)
      if (res.updated_time_constraint) setTimeConstraint(res.updated_time_constraint)

      const assistantMsg: ChatMessage = { role: 'assistant', content: res.reply, action: res.action }
      setMessages(prev => [...prev, assistantMsg])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '응답을 생성할 수 없습니다. 다시 시도해주세요.' }])
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, sessionErrands, timeConstraint])

  const handleViewResult = (action: ConsultantAction) => {
    if (action.recommendation) {
      navigation.navigate('Result', {
        result: action.recommendation,
        errands: sessionErrands,
        mode: 'mode1',
      })
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Text style={styles.headerIconText}>AI</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.headerTitle}>하루짜기 일정 상담사</Text>
            <Text style={styles.headerSubtitle}>용무와 시간을 알려주시면 최적 일정을 찾아드려요</Text>
          </View>
        </View>

        {/* Session chips */}
        {(sessionErrands.length > 0 || timeConstraint) && (
          <View style={styles.sessionChips}>
            {sessionErrands.map((e, i) => (
              <View key={i} style={styles.errandChip}>
                <Text style={styles.errandChipText}>{e.task_name}</Text>
              </View>
            ))}
            {timeConstraint?.start_time && timeConstraint?.end_time && (
              <View style={styles.timeChip}>
                <Text style={styles.timeChipText}>
                  {timeConstraint.start_time}~{timeConstraint.end_time}
                </Text>
              </View>
            )}
            {timeConstraint?.start_date && (
              <View style={styles.timeChip}>
                <Text style={styles.timeChipText}>{timeConstraint.start_date} 이후</Text>
              </View>
            )}
          </View>
        )}

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((msg, i) => (
            <View key={i}>
              <View style={[styles.bubbleRow, msg.role === 'user' && styles.bubbleRowUser]}>
                {msg.role === 'assistant' && (
                  <View style={styles.aiAvatar}>
                    <Text style={styles.aiAvatarText}>AI</Text>
                  </View>
                )}
                <View style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
                  <Text style={[styles.bubbleText, msg.role === 'user' && styles.userBubbleText]}>
                    {msg.content}
                  </Text>
                </View>
              </View>

              {/* Action cards */}
              {msg.action?.action_type === 'errands_parsed' && msg.action.parsed_errands && (
                <View style={styles.actionCard}>
                  <Text style={styles.actionLabel}>등록된 용무</Text>
                  <View style={styles.actionChips}>
                    {msg.action.parsed_errands.map((e, j) => (
                      <View key={j} style={styles.parsedChip}>
                        <Text style={styles.parsedChipText}>{e.task_name}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {msg.action?.action_type === 'time_constraint_set' && msg.action.time_constraint && (
                <View style={[styles.actionCard, { backgroundColor: Colors.primary[50], borderColor: Colors.primary[200] }]}>
                  <Text style={[styles.actionLabel, { color: Colors.primary[700] }]}>시간 설정 완료</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.primary[800] }}>
                    {msg.action.time_constraint.start_time} ~ {msg.action.time_constraint.end_time}
                  </Text>
                </View>
              )}

              {(msg.action?.action_type === 'recommend_triggered' || msg.action?.action_type === 'request_recommend') && msg.action.recommendation && (
                <View style={[styles.actionCard, { backgroundColor: Colors.amber[50], borderColor: Colors.amber[200] }]}>
                  <Text style={[styles.actionLabel, { color: Colors.amber[700] }]}>추천 결과</Text>
                  {msg.action.recommendation.recommendations.slice(0, 3).map((rec, j) => (
                    <View key={j} style={styles.recRow}>
                      <View style={styles.recLeft}>
                        <View style={[styles.recRank, j === 0 && { backgroundColor: Colors.amber[500] }]}>
                          <Text style={styles.recRankText}>{j + 1}</Text>
                        </View>
                        <Text style={styles.recInfo}>{rec.date} {rec.day_of_week} {rec.half_day_type}</Text>
                      </View>
                      <Text style={styles.recMinutes}>{rec.total_minutes}분</Text>
                    </View>
                  ))}
                  <Pressable
                    style={styles.viewResultBtn}
                    onPress={() => handleViewResult(msg.action!)}
                  >
                    <Text style={styles.viewResultText}>상세 결과 보기</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))}

          {loading && (
            <View style={[styles.bubbleRow]}>
              <View style={styles.aiAvatar}>
                <Text style={styles.aiAvatarText}>AI</Text>
              </View>
              <View style={styles.assistantBubble}>
                <ActivityIndicator size="small" color={Colors.violet[600]} />
              </View>
            </View>
          )}
        </ScrollView>

        {/* Suggestion chips */}
        {messages.length <= 1 && llmAvailable && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestions} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            {SUGGESTIONS.map(q => (
              <Pressable key={q} style={styles.suggestionChip} onPress={() => handleSend(q)}>
                <Text style={styles.suggestionText}>{q}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Input */}
        {llmAvailable && (
          <View style={styles.inputBar}>
            <TextInput
              style={styles.textInput}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => handleSend()}
              placeholder="용무나 비는 시간을 알려주세요..."
              placeholderTextColor={Colors.gray[400]}
              editable={!loading}
              returnKeyType="send"
            />
            <Pressable
              style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
              onPress={() => handleSend()}
              disabled={!input.trim() || loading}
            >
              <Text style={styles.sendBtnText}>전송</Text>
            </Pressable>
          </View>
        )}

        {/* Mode buttons */}
        <View style={styles.modeSection}>
          <Text style={styles.modeHint}>
            {llmAvailable ? '또는 직접 용무를 선택할 수도 있어요' : '용무를 선택하고 최적 일정을 추천받으세요'}
          </Text>
          <View style={styles.modeButtons}>
            <Pressable
              style={styles.primaryBtn}
              onPress={() => navigation.navigate('ErrandSelect', { mode: 'mode1' })}
            >
              <Text style={styles.primaryBtnText}>최적 날짜 찾기</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => navigation.navigate('ErrandSelect', { mode: 'mode2' })}
            >
              <Text style={styles.secondaryBtnText}>날짜 지정 최적 경로</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: Colors.violet[600],
  },
  headerIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerIconText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  headerTitle: { color: Colors.white, fontWeight: '700', fontSize: 16 },
  headerSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },

  sessionChips: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: Colors.violet[50], borderBottomWidth: 1, borderBottomColor: Colors.violet[100],
  },
  errandChip: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    backgroundColor: Colors.violet[100],
  },
  errandChipText: { fontSize: 12, fontWeight: '500', color: Colors.violet[700] },
  timeChip: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    backgroundColor: Colors.indigo[100],
  },
  timeChipText: { fontSize: 12, fontWeight: '500', color: Colors.indigo[700] },

  messages: { flex: 1 },
  messagesContent: { padding: 16, gap: 12 },

  bubbleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bubbleRowUser: { justifyContent: 'flex-end' },
  aiAvatar: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.violet[100],
    alignItems: 'center', justifyContent: 'center',
  },
  aiAvatarText: { fontSize: 11, fontWeight: '700', color: Colors.violet[600] },
  bubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  assistantBubble: { backgroundColor: Colors.gray[100], borderBottomLeftRadius: 6 },
  userBubble: { backgroundColor: Colors.violet[600], borderBottomRightRadius: 6 },
  bubbleText: { fontSize: 14, lineHeight: 20, color: Colors.gray[800] },
  userBubbleText: { color: Colors.white },

  actionCard: {
    marginLeft: 40, marginTop: 8, padding: 12, borderRadius: 12,
    backgroundColor: Colors.green[50], borderWidth: 1, borderColor: Colors.green[100],
  },
  actionLabel: { fontSize: 12, fontWeight: '700', color: Colors.green[700], marginBottom: 6 },
  actionChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  parsedChip: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    backgroundColor: Colors.green[100],
  },
  parsedChipText: { fontSize: 12, color: Colors.green[800] },

  recRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.white, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    marginBottom: 6, borderWidth: 1, borderColor: Colors.amber[100],
  },
  recLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recRank: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.gray[400],
    alignItems: 'center', justifyContent: 'center',
  },
  recRankText: { fontSize: 11, fontWeight: '700', color: Colors.white },
  recInfo: { fontSize: 13, color: Colors.gray[700] },
  recMinutes: { fontSize: 14, fontWeight: '700', color: Colors.gray[900] },
  viewResultBtn: {
    marginTop: 8, paddingVertical: 10, borderRadius: 10,
    backgroundColor: Colors.violet[600], alignItems: 'center',
  },
  viewResultText: { color: Colors.white, fontWeight: '700', fontSize: 13 },

  suggestions: { maxHeight: 44, marginBottom: 4 },
  suggestionChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: Colors.violet[50], borderWidth: 1, borderColor: Colors.violet[200],
  },
  suggestionText: { fontSize: 13, color: Colors.violet[700] },

  inputBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: Colors.gray[100], backgroundColor: Colors.gray[50],
  },
  textInput: {
    flex: 1, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.gray[200], backgroundColor: Colors.white,
    fontSize: 14, color: Colors.gray[900],
  },
  sendBtn: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
    backgroundColor: Colors.violet[600],
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: Colors.white, fontWeight: '600', fontSize: 14 },

  modeSection: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: Colors.gray[100],
  },
  modeHint: { fontSize: 12, color: Colors.gray[400], textAlign: 'center', marginBottom: 10 },
  modeButtons: { flexDirection: 'row', gap: 10 },
  primaryBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: Colors.primary[500], alignItems: 'center',
  },
  primaryBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  secondaryBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: Colors.gray[100], alignItems: 'center',
  },
  secondaryBtnText: { color: Colors.gray[700], fontWeight: '600', fontSize: 15 },
})
