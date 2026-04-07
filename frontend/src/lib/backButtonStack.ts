/**
 * Android 하드웨어/제스처 뒤로가기 버튼 처리용 핸들러 스택.
 *
 * 여러 컴포넌트가 각자의 "닫을 것"(모달 등)을 등록할 수 있고,
 * 스택의 맨 위 핸들러부터 차례로 실행되며, true를 반환하면 소비됨.
 */
type BackHandler = () => boolean

const handlers: BackHandler[] = []

export function pushBackHandler(h: BackHandler): () => void {
  handlers.push(h)
  return () => {
    const idx = handlers.lastIndexOf(h)
    if (idx >= 0) handlers.splice(idx, 1)
  }
}

/**
 * 스택에 등록된 핸들러를 위에서부터 시도.
 * @returns 어느 하나가 소비했으면 true
 */
export function runBackHandlers(): boolean {
  for (let i = handlers.length - 1; i >= 0; i--) {
    try {
      if (handlers[i]()) return true
    } catch (e) {
      console.warn('backHandler error:', e)
    }
  }
  return false
}
