interface BackButtonProps {
  onClick: () => void
  label?: string
}

export default function BackButton({ onClick, label = '뒤로가기' }: BackButtonProps) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-700 transition-colors mb-6 text-sm font-medium"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      {label}
    </button>
  )
}
