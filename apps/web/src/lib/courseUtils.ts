export function lessonStatusLabel(status: 'todo' | 'doing' | 'done') {
  if (status === 'done') return '已完成'
  if (status === 'doing') return '学习中'
  return '未开始'
}

export function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function courseHref(lessonId: string, progress?: { currentTime: number }) {
  return progress ? `/courses/${lessonId}?t=${Math.floor(progress.currentTime)}` : `/courses/${lessonId}`
}

export function formatCourseProgress(progress?: { progress: number; currentTime: number }) {
  return progress ? `${progress.progress}% · ${formatTime(progress.currentTime)}` : '未开始'
}

export function progressBarWidth(progress?: { progress: number }) {
  return `${progress?.progress ?? 0}%`
}

export function lessonLevelBadge(level: string | null) {
  const lvl = level || '简单'
  let className = 'text-xs px-2 py-0.5 rounded-full border border-accent text-accent'
  if (lvl === '中等') {
    className = 'text-xs px-2 py-0.5 rounded-full border border-[#f5c31c] text-[#f5c31c]'
  } else if (lvl === '困难') {
    className = 'text-xs px-2 py-0.5 rounded-full border border-[#e05a5a] text-[#e05a5a]'
  }
  return {
    className,
    label: lvl
  }
}
