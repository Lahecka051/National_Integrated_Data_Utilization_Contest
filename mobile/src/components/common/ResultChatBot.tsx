import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, ScrollView, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import type { SlotRecommendation, Errand, ChatMessage } from '../../types'
import { sendChatMessage } from '../../utils/api'
import { Colors } from '../../utils/colors'

const SUGGESTIONS = [
  '왜 이 날짜가 좋은가요?',
  '비 오면 어떻게 되나요?',
  '다른 시간대는 어때요?',
  '이동 경로를 설명해주세요',
]

interface Props {
  recommendation: SlotRecommendation
  errands: Errand[]
  onClose: () => void
}

export default function ResultChatBot({ recommendation, errands, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
  }, [messages])

  const handleSend = async (text?: string) => {
    const content = text || input.trim()
    if (!content || loading) return

    const userMsg: ChatMessage = { role: 'user', content }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    setLoading(true)

    try {
      const res = await sendChatMessage(updated, recommendation, errands)
      setMessages(prev => [...prev, { role: 'assistant', content: res.reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '응답을 생성할 수 없습니다.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.overlay}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.panel}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}><Text style={styles.headerIconText}>AI</Text></View>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>하루짜기 AI 어시스턴트</Text>
            <Text style={styles.headerSub}>추천 결과에 대해 물어보세요</Text>
          </View>
          <Pressable onPress={onClose}>
            <Text style={{ fontSize: 20, color: 'rgba(255,255,255,0.7)' }}>✕</Text>
          </Pressable>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.msgContent}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>추천 결과에 대해 궁금한 점을 물어보세요!</Text>
              <View style={styles.suggestRow}>
                {SUGGESTIONS.map(q => (
                  <Pressable key={q} style={styles.suggestChip} onPress={() => handleSend(q)}>
                    <Text style={styles.suggestText}>{q}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          {messages.map((msg, i) => (
            <View key={i} style={[styles.bubbleRow, msg.role === 'user' && styles.bubbleRowUser]}>
              <View style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble]}>
                <Text style={[styles.bubbleText, msg.role === 'user' && { color: Colors.white }]}>
                  {msg.content}
                </Text>
              </View>
            </View>
          ))}
          {loading && (
            <View style={styles.bubbleRow}>
              <View style={styles.aiBubble}>
                <ActivityIndicator size="small" color={Colors.violet[600]} />
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => handleSend()}
            placeholder="추천에 대해 물어보세요..."
            placeholderTextColor={Colors.gray[400]}
            editable={!loading}
            returnKeyType="send"
          />
          <Pressable
            style={[styles.sendBtn, (!input.trim() || loading) && { opacity: 0.5 }]}
            onPress={() => handleSend()}
            disabled={!input.trim() || loading}
          >
            <Text style={styles.sendBtnText}>전송</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', bottom: 90, right: 16, left: 16,
    maxHeight: 480, borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  panel: { backgroundColor: Colors.white, borderRadius: 16, flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: Colors.violet[600],
  },
  headerIcon: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerIconText: { color: Colors.white, fontSize: 11, fontWeight: '700' },
  headerInfo: { flex: 1 },
  headerTitle: { color: Colors.white, fontSize: 14, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },

  messages: { maxHeight: 300 },
  msgContent: { padding: 12, gap: 10 },
  emptyState: { alignItems: 'center', paddingVertical: 12 },
  emptyText: { fontSize: 13, color: Colors.gray[500], marginBottom: 10 },
  suggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  suggestChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: Colors.violet[50], borderWidth: 1, borderColor: Colors.violet[200],
  },
  suggestText: { fontSize: 12, color: Colors.violet[700] },

  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end' },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '85%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  aiBubble: { backgroundColor: Colors.gray[100], borderBottomLeftRadius: 4 },
  userBubble: { backgroundColor: Colors.violet[600], borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 14, lineHeight: 20, color: Colors.gray[800] },

  inputBar: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: Colors.gray[100],
  },
  textInput: {
    flex: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.gray[200], fontSize: 13, color: Colors.gray[900],
  },
  sendBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    backgroundColor: Colors.violet[600], justifyContent: 'center',
  },
  sendBtnText: { color: Colors.white, fontWeight: '600', fontSize: 13 },
})
