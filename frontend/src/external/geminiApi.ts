/**
 * Gemini LLM 클라이언트 (TS 포팅, @google/generative-ai SDK 사용)
 */
import { GoogleGenerativeAI } from '@google/generative-ai'
import { API_KEYS } from '../config/apiKeys'

const MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash']

let client: GoogleGenerativeAI | null = null

function getClient(): GoogleGenerativeAI | null {
  if (client) return client
  const key = API_KEYS.GEMINI
  if (!key) return null
  try {
    client = new GoogleGenerativeAI(key)
    return client
  } catch {
    return null
  }
}

export function isLlmAvailable(): boolean {
  return getClient() !== null
}

/**
 * Gemini 호출 + 429 재시도 로직.
 * 반환: 응답 텍스트 or null.
 */
export async function callGeminiWithRetry(prompt: string, maxRetries = 3): Promise<string | null> {
  const c = getClient()
  if (!c) return null

  for (const modelName of MODELS) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const model = c.getGenerativeModel({ model: modelName })
        const result = await model.generateContent(prompt)
        const text = result?.response?.text?.()
        if (text) return text.trim()
      } catch (e: any) {
        const msg = String(e?.message || e)
        if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
          const waitMatch = msg.match(/retryDelay.*?(\d+)/)
          const waitSec = waitMatch ? parseInt(waitMatch[1], 10) + 2 : 5
          if (attempt < maxRetries - 1) {
            await new Promise(r => setTimeout(r, waitSec * 1000))
            continue
          }
          break  // 다음 모델 시도
        }
        // 기타 에러는 즉시 중단
        console.warn(`Gemini ${modelName} 에러:`, msg)
        return null
      }
    }
  }
  // 모든 모델 한도 초과 시 60초 대기 후 최종 재시도
  await new Promise(r => setTimeout(r, 60000))
  try {
    const model = c.getGenerativeModel({ model: MODELS[0] })
    const result = await model.generateContent(prompt)
    return result?.response?.text?.()?.trim() || null
  } catch (e) {
    console.warn('최종 재시도 실패:', e)
    return null
  }
}

/**
 * JSON 응답 파싱 헬퍼 — ```json 블록 제거.
 */
export function extractJson(raw: string): any {
  let text = raw.trim()
  if (text.includes('```json')) {
    text = text.split('```json')[1].split('```')[0].trim()
  } else if (text.includes('```')) {
    text = text.split('```')[1].split('```')[0].trim()
  }
  return JSON.parse(text)
}
