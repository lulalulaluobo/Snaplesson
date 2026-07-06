import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

export interface CourseLesson {
  id: string
  title: string
  level: string
  courseId: string
  username?: string
  shared?: boolean
}

type CourseSidebarProps = {
  lessons: CourseLesson[]
  activeLesson: { id: string; title: string }
  activeProgress: number
  onSelectLesson: (lessonId: string) => void
  sidebarWidth: number
  setSidebarWidth: (width: number) => void
}

type LessonStatus = 'todo' | 'doing' | 'done'
type LessonStatusFilter = LessonStatus | 'all'

const FILTERS: Array<{ value: LessonStatusFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'todo', label: '未开始' },
  { value: 'doing', label: '学习中' },
  { value: 'done', label: '已完成' },
]

const STATUS_LABELS: Record<LessonStatus, string> = {
  todo: '未开始',
  doing: '学习中',
  done: '已完成',
}

function getLessonStatus(progress: number): LessonStatus {
  if (progress >= 100) return 'done'
  return progress > 0 ? 'doing' : 'todo'
}

function getLevelInfo(level: string | null) {
  const lvl = level || '简单'
  if (lvl === '简单') {
    return { code: 'A1', className: 'level-b', label: '简单' }
  } else if (lvl === '困难') {
    return { code: 'C1', className: 'level-d', label: '困难' }
  } else {
    return { code: 'B1', className: 'level-c', label: '中等' }
  }
}

export function CourseSidebar({
  lessons,
  activeLesson,
  activeProgress,
  onSelectLesson,
  sidebarWidth,
  setSidebarWidth,
}: CourseSidebarProps) {
  const [statusFilter, setStatusFilter] = useState<LessonStatusFilter>('all')
  const [progressMap, setProgressMap] = useState<Record<string, number>>({})

  // Load all progress maps from localStorage
  useEffect(() => {
    const map: Record<string, number> = {}
    lessons.forEach((l) => {
      try {
        const data = localStorage.getItem(`progress_${l.id}`)
        if (data) {
          const parsed = JSON.parse(data)
          map[l.id] = parsed.progress ?? 0
        } else {
          map[l.id] = 0
        }
      } catch {
        map[l.id] = 0
      }
    })
    setProgressMap(map)
  }, [lessons])

  const lessonRows = lessons
    .map((lesson) => {
      const isActive = lesson.id === activeLesson.id
      const savedProgress = progressMap[lesson.id] ?? 0
      const progress = isActive
        ? Math.max(savedProgress, Math.max(0, Math.min(100, activeProgress)))
        : savedProgress
      const status = getLessonStatus(progress)

      return { lesson, isActive, progress, status }
    })
    .filter(({ status }) => statusFilter === 'all' || statusFilter === status)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = sidebarWidth

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(200, Math.min(600, startWidth + (moveEvent.clientX - startX)))
      setSidebarWidth(newWidth)
      localStorage.setItem('sidebar_width', String(newWidth))
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <nav className="course-list relative select-none" id="courseList" aria-label="课程列表">
      <div className="list-head">
        <span className="list-title">全部课程 · {lessons.length}</span>
      </div>

      <div className="filters" aria-label="课程状态筛选">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            className={`chip${filter.value === statusFilter ? ' active' : ''}`}
            type="button"
            aria-pressed={filter.value === statusFilter}
            onClick={() => setStatusFilter(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="course-scroll">
        {lessonRows.map(({ lesson, isActive, progress, status }) => {
          const levelInfo = getLevelInfo(lesson.level)

          return (
            <Link
              key={lesson.id}
              to={`/courses/${lesson.id}`}
              className={`course-item${isActive ? ' active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onSelectLesson(lesson.id)}
            >
              <span
                className={`level-badge ${levelInfo.className}`}
                aria-label={`等级 ${levelInfo.label}`}
              >
                {levelInfo.code}
              </span>
              <span className="ci-num">{lesson.id}</span>
              <span className="ci-body">
                <span className="ci-title">{lesson.title}</span>
                <span className="ci-prog">
                  <span
                    className="ci-bar"
                    role="progressbar"
                    aria-label={`${lesson.title} 学习进度`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress}
                  >
                    <i style={{ width: `${progress}%` }} />
                  </span>
                  <span className="ci-pct">{progress}%</span>
                </span>
              </span>
              <span className={`ci-dot ${status}`} aria-label={STATUS_LABELS[status]} />
            </Link>
          )
        })}
      </div>

      {/* Resize Handle for Desktop */}
      <div
        className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-transparent transition-colors z-20 hidden md:block"
        onMouseDown={handleMouseDown}
        title="拖动调整侧边栏宽度"
      />
    </nav>
  )
}
