import type { CongestionLevelType } from '../types'

interface CongestionGaugeProps {
  score: number // 0~100
  level: CongestionLevelType
  note?: string
  compact?: boolean
}

const LEVEL_COLOR: Record<CongestionLevelType, { bar: string; bg: string; text: string; ring: string }> = {
  '여유': { bar: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-700', ring: 'ring-green-200' },
  '보통': { bar: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200' },
  '혼잡': { bar: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-200' },
}

export default function CongestionGauge({ score, level, note, compact }: CongestionGaugeProps) {
  const c = LEVEL_COLOR[level]
  const pct = Math.max(0, Math.min(100, score))

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${c.bg} ${c.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${c.bar}`} />
        {level} · {pct}
      </span>
    )
  }

  return (
    <div className={`rounded-xl p-4 ${c.bg} ring-1 ${c.ring}`}>
      <div className="flex items-baseline justify-between mb-2">
        <span className={`text-sm font-bold ${c.text}`}>혼잡도 {level}</span>
        <span className={`text-2xl font-bold ${c.text}`}>{pct}<span className="text-sm font-normal opacity-60">/100</span></span>
      </div>
      <div className="w-full bg-white/60 rounded-full h-2 overflow-hidden">
        <div className={`h-full ${c.bar} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      {note && <p className={`mt-2 text-xs ${c.text} opacity-80`}>{note}</p>}
    </div>
  )
}
