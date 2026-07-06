import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { lessonLevelBadge } from '@/lib/courseUtils'

interface Folder {
  id: string
  name: string
  type: string
  count: number
}

interface CourseLesson {
  id: string
  number: string
  title: string
  level: string
  courseId: string
  resources: {
    lesson: string
    subtitle: string
  }
}

export function CoursesPage() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [lessons, setLessons] = useState<CourseLesson[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string>('custom')
  const [loading, setLoading] = useState(true)

  // Creation modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newLevel, setNewLevel] = useState('简单')
  const [newText, setNewText] = useState('')
  const [ocrLoading, setOcrLoading] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Folder creation state
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [folderError, setFolderError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<{ role: string } | null>(null)

  const fetchData = async () => {
    try {
      // Check role
      const meRes = await fetch('/api/auth/me')
      if (meRes.ok) {
        const meData = await meRes.json()
        setCurrentUser(meData.user)
      }

      // Fetch folders
      const foldersRes = await fetch('/api/course-folders')
      if (foldersRes.ok) {
        const foldersData = await foldersRes.json()
        setFolders(foldersData)
        // Select custom if it exists
        if (foldersData.length > 0 && !selectedFolderId) {
          setSelectedFolderId(foldersData[0].id)
        }
      }

      // Fetch lessons
      const lessonsRes = await fetch('/api/courses')
      if (lessonsRes.ok) {
        const lessonsData = await lessonsRes.json()
        setLessons(lessonsData.lessons || [])
      }
    } catch (err) {
      console.error('Failed to fetch data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleOcrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setOcrLoading(true)
    setError(null)

    try {
      const reader = new FileReader()
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = (err) => reject(err)
      })
      reader.readAsDataURL(file)
      const imageBase64 = await base64Promise

      const res = await fetch('/api/custom-lessons/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || '图片识别失败，请检查管理员的 AI 接口配置。')
      }

      const recognizedText = String(data.text || '').trim()
      if (!recognizedText) {
        throw new Error('未识别出任何文字，请确保图片中的英文文本清晰。')
      }

      setNewText((prev) => (prev ? `${prev}\n${recognizedText}` : recognizedText))
    } catch (err: any) {
      setError(err.message || '识别失败，请重试')
    } finally {
      setOcrLoading(false)
    }
  }

  const handleCreateLesson = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim() || !newText.trim()) {
      setError('标题和课文内容不能为空')
      return
    }

    setCreateLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/courses/${selectedFolderId}/lessons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          text: newText.trim(),
          level: newLevel
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || '课程生成失败')
      }

      // Success
      setShowCreateModal(false)
      setNewTitle('')
      setNewText('')
      setNewLevel('简单')
      fetchData()
    } catch (err: any) {
      setError(err.message || '生成失败，请稍后重试')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!folderName.trim()) {
      setFolderError('名称不能为空')
      return
    }

    setFolderError(null)
    try {
      const res = await fetch('/api/course-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: folderName.trim() })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || '创建文件夹失败')
      }

      setFolderName('')
      setShowFolderModal(false)
      setSelectedFolderId(data.id)
      fetchData()
    } catch (err: any) {
      setFolderError(err.message || '创建文件夹失败')
    }
  }

  const handleDeleteFolder = async (folderId: string) => {
    if (folderId === 'custom') return
    if (!window.confirm('您确定要删除该分类及其下的所有拍照课时吗？此操作不可恢复。')) return

    try {
      const res = await fetch(`/api/course-folders/${folderId}`, {
        method: 'DELETE'
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '删除失败')
      }
      setSelectedFolderId('custom')
      fetchData()
    } catch (err: any) {
      alert(err.message || '删除文件夹失败')
    }
  }

  // Filter lessons belonging to the selected folder
  const currentLessons = lessons.filter(l => l.courseId === selectedFolderId)

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-[var(--muted)]">
        <p className="font-[var(--font-mono)] text-xs uppercase tracking-widest">数据加载中...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Heading & Creation Trigger */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--border-soft)] pb-4">
        <div>
          <h1 className="font-[var(--font-display)] text-2xl font-bold">我的英语点读课</h1>
          <p className="text-xs text-[var(--muted)] mt-1">拍摄英语教材或文本资料，一键转为有声跟读课程</p>
        </div>
        <div className="flex gap-2">
          {currentUser?.role === 'admin' && (
            <button
              onClick={() => setShowFolderModal(true)}
              className="px-4 py-2 text-xs font-bold rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] hover:bg-[var(--border-soft)] transition cursor-pointer"
              type="button"
            >
              新建分类
            </button>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 text-xs font-bold rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--accent-on)] hover:opacity-90 transition cursor-pointer"
            type="button"
          >
            📸 拍照成课
          </button>
        </div>
      </div>

      {/* Folders/Categories list (tabs) */}
      <div className="flex flex-wrap gap-2 items-center">
        {folders.map(folder => (
          <div key={folder.id} className="flex items-center gap-1">
            <button
              onClick={() => setSelectedFolderId(folder.id)}
              className={cn(
                "px-4 py-2 text-xs font-bold rounded-[var(--radius-pill)] border transition cursor-pointer",
                selectedFolderId === folder.id
                  ? "bg-[var(--accent)] text-[var(--accent-on)] border-[var(--accent)]"
                  : "bg-[var(--surface-warm)] text-[var(--muted)] border-[var(--border-soft)] hover:text-[var(--fg)]"
              )}
            >
              {folder.name} ({folder.count})
            </button>
            {currentUser?.role === 'admin' && folder.id !== 'custom' && selectedFolderId === folder.id && (
              <button
                onClick={() => handleDeleteFolder(folder.id)}
                className="p-2 text-xs text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] rounded-full transition cursor-pointer"
                title="删除分类及课程"
              >
                🗑️
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Custom Lessons card stack */}
      {currentLessons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-[var(--border)] rounded-[var(--radius-lg)] bg-[var(--surface-warm)]">
          <p className="text-[var(--muted)] text-sm">当前分类下尚无拍照课时</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 px-4 py-2 text-xs font-bold rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--accent-on)] hover:opacity-90 transition cursor-pointer"
          >
            马上创建第一个点读课时
          </button>
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {currentLessons.map((item) => {
            const levelBadge = lessonLevelBadge(item.level)
            return (
              <Link
                key={item.id}
                to={`/courses/${item.id}`}
                className="flex flex-col justify-between p-5 rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--surface-warm)] shadow-sm hover:border-[var(--accent)] transition duration-200"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-[var(--font-mono)] text-[10px] font-semibold text-[var(--meta)]">
                      #{item.id}
                    </span>
                    {levelBadge && (
                      <span className={levelBadge.className}>
                        {levelBadge.label}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-3 font-semibold text-[var(--fg)] text-base line-clamp-2">
                    {item.title}
                  </h3>
                </div>
                <div className="mt-5 flex items-center gap-1 text-xs font-bold text-[var(--accent)]">
                  进入点读学习
                  <svg className="w-3.5 h-3.5 transform translate-x-0 group-hover:translate-x-1 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Folder Creation Modal */}
      {showFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--fg)_50%,transparent)] p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--bg)] p-6 shadow-lg">
            <h3 className="font-[var(--font-display)] text-lg font-bold">新建课程分类</h3>
            <form onSubmit={handleCreateFolder} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                  分类名称
                </label>
                <input
                  type="text"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[var(--surface-warm)] px-4 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
                  placeholder="例如：三年级上册"
                />
              </div>
              {folderError && (
                <p className="text-xs text-[var(--danger)] font-semibold">{folderError}</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFolderModal(false)}
                  className="px-4 py-2 text-xs font-bold rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--surface)] transition cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--accent-on)] hover:opacity-90 transition cursor-pointer"
                >
                  确定
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lesson Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--fg)_50%,transparent)] p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--bg)] p-6 shadow-lg">
            <div className="flex items-center justify-between border-b border-[var(--border-soft)] pb-3">
              <h3 className="font-[var(--font-display)] text-lg font-bold">📸 拍照/上传图片成课</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-[var(--muted)] hover:text-[var(--fg)] text-lg font-bold cursor-pointer"
                disabled={ocrLoading || createLoading}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLesson} className="mt-4 space-y-4">
              {/* Image OCR Trigger */}
              <div className="p-4 rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--surface-warm)] text-center">
                <p className="text-xs text-[var(--muted)]">上传课本/打印资料的英文图片，AI 将自动进行 OCR 提取</p>
                <label className={cn(
                  "mt-3 inline-block px-4 py-2 text-xs font-bold rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--border)] text-[var(--fg)] cursor-pointer hover:bg-[var(--border-soft)] transition",
                  ocrLoading && "opacity-50 pointer-events-none"
                )}>
                  {ocrLoading ? '图片文字提取中...' : '选择图片/拍照'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleOcrUpload}
                    className="hidden"
                    disabled={ocrLoading || createLoading}
                  />
                </label>
              </div>

              {/* Title & Level */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                    课程标题
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[var(--surface-warm)] px-4 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
                    placeholder="例如：三年级 Unit 1 课文"
                    disabled={createLoading}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                    难度级别
                  </label>
                  <select
                    value={newLevel}
                    onChange={(e) => setNewLevel(e.target.value)}
                    className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[var(--surface-warm)] px-4 py-2.5 text-sm outline-none focus:border-[var(--accent)] appearance-none cursor-pointer"
                    disabled={createLoading}
                  >
                    <option value="简单">简单 (Junior)</option>
                    <option value="中等">中等 (Medium)</option>
                    <option value="困难">困难 (Senior)</option>
                  </select>
                </div>
              </div>

              {/* Editable Text Area */}
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                  英文课文文本 (OCR 结果可在此手动清洗与编辑)
                </label>
                <textarea
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  className="mt-2 w-full h-32 rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[var(--surface-warm)] px-4 py-2.5 text-sm outline-none focus:border-[var(--accent)] resize-none"
                  placeholder="识别出的英文内容将显示在这里，您可以手动删减、清洗格式，确保英文标点正确..."
                  disabled={createLoading}
                />
              </div>

              {error && (
                <div className="rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] p-3 text-xs font-semibold text-[var(--danger)]">
                  {error}
                </div>
              )}

              {/* Form Action buttons */}
              <div className="flex justify-end gap-2 border-t border-[var(--border-soft)] pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-bold rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--surface)] transition cursor-pointer"
                  disabled={createLoading}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className={cn(
                    "px-4 py-2 text-xs font-bold rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--accent-on)] hover:opacity-90 transition cursor-pointer",
                    createLoading && "opacity-50 pointer-events-none"
                  )}
                  disabled={createLoading}
                >
                  {createLoading ? 'AI 正在翻译并合成课程音频(约20秒)...' : '确定生成课程'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
