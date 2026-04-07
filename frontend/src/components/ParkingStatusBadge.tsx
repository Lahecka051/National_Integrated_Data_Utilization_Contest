import type { ParkingStatus } from '../types'

const STYLES: Record<ParkingStatus, string> = {
  '여유': 'bg-green-100 text-green-700 border-green-200',
  '보통': 'bg-amber-100 text-amber-700 border-amber-200',
  '혼잡': 'bg-orange-100 text-orange-700 border-orange-200',
  '만차': 'bg-red-100 text-red-700 border-red-200',
  '정보없음': 'bg-gray-100 text-gray-500 border-gray-200',
}

const DOTS: Record<ParkingStatus, string> = {
  '여유': 'bg-green-500',
  '보통': 'bg-amber-500',
  '혼잡': 'bg-orange-500',
  '만차': 'bg-red-500',
  '정보없음': 'bg-gray-400',
}

interface ParkingStatusBadgeProps {
  status: ParkingStatus
  available?: number | null
  total?: number | null
}

export default function ParkingStatusBadge({ status, available, total }: ParkingStatusBadgeProps) {
  const showCount = available != null && total != null && total > 0
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${STYLES[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${DOTS[status]}`} />
      {status}
      {showCount && (
        <span className="font-normal opacity-80">
          · {available}/{total}면
        </span>
      )}
    </span>
  )
}
