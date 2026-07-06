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
  username?: string
  shared?: boolean
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
  const [currentUser, setCurrentUser] = useState<{ username: string; role: string } | null>(null)

  const [publicSettings, setPublicSettings] = useState<{
    tts_provider: string
    ocr_provider: string
    openai_model: string
    llm_models_json?: string
    tts_models_json?: string
    ocr_models_json?: string
  } | null>(null)

  interface ApiProfile {
    id: string
    name: string
    provider?: string
    baseUrl: string
    model: string
    voice?: string
  }

  const [llmPresets, setLlmPresets] = useState<ApiProfile[]>([])
  const [ocrPresets, setOcrPresets] = useState<ApiProfile[]>([])
  const [ttsPresets, setTtsPresets] = useState<ApiProfile[]>([])

  const [selectedLlmPresetId, setSelectedLlmPresetId] = useState<string>('')
  const [selectedOcrPresetId, setSelectedOcrPresetId] = useState<string>('')
  const [selectedTtsPresetId, setSelectedTtsPresetId] = useState<string>('edge')

  const [selectedTtsProvider, setSelectedTtsProvider] = useState('edge')
  const [selectedTtsVoice, setSelectedTtsVoice] = useState('en-US-EmmaNeural')
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([])

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

      // Fetch public settings
      const settingsRes = await fetch('/api/settings/public')
      if (settingsRes.ok) {
        const data = await settingsRes.json()
        setPublicSettings(data)
        
        try {
          const llmList = JSON.parse(data.llm_models_json || '[]')
          setLlmPresets(llmList)
          if (llmList.length > 0) {
            setSelectedLlmPresetId(llmList[0].id)
          }
        } catch {}

        try {
          const ocrList = JSON.parse(data.ocr_models_json || '[]')
          setOcrPresets(ocrList)
          if (ocrList.length > 0) {
            setSelectedOcrPresetId(ocrList[0].id)
          }
        } catch {}

        try {
          const ttsList = JSON.parse(data.tts_models_json || '[]')
          setTtsPresets(ttsList)
          setSelectedTtsPresetId('edge')
        } catch {}
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

  const handleDeleteLesson = async (lessonId: string) => {
    if (!window.confirm('确定要删除这节课时吗？删除后相关音频和配音将无法找回。')) return
    try {
      const res = await fetch(`/api/courses/lessons/${lessonId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setLessons(prev => prev.filter(l => l.id !== lessonId))
      } else {
        const errData = await res.json()
        alert(errData.error || '删除课时失败')
      }
    } catch (e) {
      console.error(e)
      alert('删除失败，网络异常')
    }
  }

  const handleToggleShare = async (lessonId: string, currentShared: boolean) => {
    try {
      const res = await fetch(`/api/courses/lessons/${lessonId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shared: !currentShared })
      })
      if (res.ok) {
        setLessons(prev => prev.map(l => l.id === lessonId ? { ...l, shared: !currentShared } : l))
      } else {
        const errData = await res.json()
        alert(errData.error || '修改共享状态失败')
      }
    } catch (e) {
      console.error(e)
      alert('网络连接异常')
    }
  }

  const handleToggleSelect = (lessonId: string) => {
    setSelectedLessonIds(prev =>
      prev.includes(lessonId)
        ? prev.filter(id => id !== lessonId)
        : [...prev, lessonId]
    )
  }

  const handleSelectAll = (deletableIds: string[]) => {
    setSelectedLessonIds(deletableIds)
  }

  const handleInvertSelect = (deletableIds: string[]) => {
    setSelectedLessonIds(prev => deletableIds.filter(id => !prev.includes(id)))
  }

  const handleClearSelect = () => {
    setSelectedLessonIds([])
  }

  const handleBatchDelete = async () => {
    if (selectedLessonIds.length === 0) return
    if (!window.confirm(`确定要批量删除选中的 ${selectedLessonIds.length} 个课时吗？删除后相关配置将不可恢复。`)) return

    setLoading(true)
    try {
      const res = await fetch('/api/courses/lessons/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedLessonIds })
      })

      if (res.ok) {
        setLessons(prev => prev.filter(l => !selectedLessonIds.includes(l.id)))
        setSelectedLessonIds([])
      } else {
        const err = await res.json()
        alert(err.error || '批量删除失败')
      }
    } catch (e) {
      console.error(e)
      alert('批量删除失败，网络异常')
    } finally {
      setLoading(false)
    }
  }

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
        body: JSON.stringify({ imageBase64, ocrPresetId: selectedOcrPresetId })
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
          level: newLevel,
          ttsPresetId: selectedTtsPresetId,
          llmPresetId: selectedLlmPresetId,
          ttsVoice: selectedTtsVoice
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
      {(() => {
        const myLessons = currentLessons.filter(l => l.username === currentUser?.username || (!l.username && currentUser?.username === 'admin'))
        const sharedLessons = currentLessons.filter(l => l.username !== currentUser?.username && !(!l.username && currentUser?.username === 'admin'))
        
        const deletableIds = currentLessons
          .filter(l => currentUser?.role === 'admin' || l.username === currentUser?.username)
          .map(l => l.id)

        if (currentLessons.length === 0) {
          return (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-[var(--border)] rounded-[var(--radius-lg)] bg-[var(--surface-warm)]">
              <p className="text-[var(--muted)] text-sm">当前分类下尚无拍照课时</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 px-4 py-2 text-xs font-bold rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--accent-on)] hover:opacity-90 transition cursor-pointer"
              >
                马上创建第一个点读课时
              </button>
            </div>
          )
        }

        return (
          <div className="space-y-6">
            {/* Batch Action Toolbar */}
            {deletableIds.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--surface-warm)] text-xs font-semibold shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--muted)]">已选择 {selectedLessonIds.length} / {deletableIds.length} 个课时</span>
                  <button
                    onClick={() => handleSelectAll(deletableIds)}
                    className="px-2.5 py-1.5 rounded bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--border-soft)] hover:text-[var(--accent)] transition cursor-pointer"
                    type="button"
                  >
                    全选
                  </button>
                  <button
                    onClick={() => handleInvertSelect(deletableIds)}
                    className="px-2.5 py-1.5 rounded bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--border-soft)] hover:text-[var(--accent)] transition cursor-pointer"
                    type="button"
                  >
                    反选
                  </button>
                  <button
                    onClick={handleClearSelect}
                    className="px-2.5 py-1.5 rounded bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--border-soft)] transition cursor-pointer text-[var(--muted)]"
                    type="button"
                  >
                    清除
                  </button>
                </div>
                {selectedLessonIds.length > 0 && (
                  <button
                    onClick={handleBatchDelete}
                    className="px-3 py-1.5 rounded bg-[var(--danger)] text-white hover:opacity-90 transition cursor-pointer font-bold shadow-sm"
                    type="button"
                  >
                    🗑️ 批量删除 ({selectedLessonIds.length})
                  </button>
                )}
              </div>
            )}

            <div className="space-y-8">
              {/* 1. Self Created */}
              <div>
                <h2 className="text-xs font-extrabold text-[var(--muted)] uppercase tracking-wider mb-4 border-l-2 border-[var(--accent)] pl-2">
                  自建课时 ({myLessons.length})
                </h2>
                {myLessons.length === 0 ? (
                  <p className="text-xs text-[var(--muted)] italic p-4 border border-dashed border-[var(--border-soft)] rounded-[var(--radius-md)] bg-[var(--surface-warm)]">
                    暂无自建点读课件。
                  </p>
                ) : (
                  <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {myLessons.map((item) => {
                      const levelBadge = lessonLevelBadge(item.level)
                      const canDelete = currentUser?.role === 'admin' || item.username === currentUser?.username
                      return (
                        <div key={item.id} className="relative group">
                          {canDelete && (
                            <div className="absolute top-4 left-4 z-20">
                              <input
                                type="checkbox"
                                checked={selectedLessonIds.includes(item.id)}
                                onChange={(e) => {
                                  e.stopPropagation()
                                  handleToggleSelect(item.id)
                                }}
                                className="size-4 rounded border-[var(--border)] accent-[var(--accent)] cursor-pointer"
                              />
                            </div>
                          )}
                          <Link
                            to={`/courses/${item.id}`}
                            className="flex flex-col justify-between p-5 rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--surface-warm)] shadow-sm hover:border-[var(--accent)] transition duration-200 h-full min-h-[140px]"
                          >
                            <div>
                              <div className={cn("flex items-center justify-between gap-2 pr-20", canDelete ? "pl-5" : "")}>
                                <span className="font-[var(--font-mono)] text-[10px] font-semibold text-[var(--meta)]">
                                  #{item.id}
                                </span>
                                {levelBadge && (
                                  <span className={levelBadge.className}>
                                    {levelBadge.label}
                                  </span>
                                )}
                              </div>
                              <h3 className={cn("mt-3 font-semibold text-[var(--fg)] text-base line-clamp-2 pr-20", canDelete ? "pl-5" : "")}>
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
                          {canDelete && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  handleToggleShare(item.id, !!item.shared)
                                }}
                                className={cn(
                                  "absolute top-3.5 right-[42px] px-2 py-1 rounded-[var(--radius-pill)] border text-[10px] font-extrabold transition cursor-pointer z-10 shadow-sm leading-none h-[26px] flex items-center justify-center",
                                  item.shared
                                    ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] border-[var(--accent)] text-[var(--accent)]"
                                    : "bg-[var(--surface)] border-[var(--border-soft)] text-[var(--muted)] hover:text-[var(--fg)] hover:border-[var(--border)]"
                                )}
                                title={item.shared ? "点击取消共享" : "点击共享给其他用户"}
                              >
                                {item.shared ? "🌐 共享" : "🔒 私有"}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  handleDeleteLesson(item.id)
                                }}
                                className="absolute top-3.5 right-3.5 p-1.5 rounded-full bg-[var(--surface)] border border-[var(--border-soft)] text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] transition cursor-pointer text-xs leading-none shadow-sm z-10 h-[26px] w-[26px] flex items-center justify-center"
                                title="删除课程"
                              >
                                🗑️
                              </button>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* 2. Shared by Others */}
              <div>
                <h2 className="text-xs font-extrabold text-[var(--muted)] uppercase tracking-wider mb-4 border-l-2 border-[color-mix(in_srgb,var(--accent)_50%,var(--muted))] pl-2">
                  他人共享的课时 ({sharedLessons.length})
                </h2>
                {sharedLessons.length === 0 ? (
                  <p className="text-xs text-[var(--muted)] italic p-4 border border-dashed border-[var(--border-soft)] rounded-[var(--radius-md)] bg-[var(--surface-warm)]">
                    暂无他人共享的点读课时。
                  </p>
                ) : (
                  <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {sharedLessons.map((item) => {
                      const levelBadge = lessonLevelBadge(item.level)
                      const canDelete = currentUser?.role === 'admin' || item.username === currentUser?.username
                      return (
                        <div key={item.id} className="relative group">
                          {canDelete && (
                            <div className="absolute top-4 left-4 z-20">
                              <input
                                type="checkbox"
                                checked={selectedLessonIds.includes(item.id)}
                                onChange={(e) => {
                                  e.stopPropagation()
                                  handleToggleSelect(item.id)
                                }}
                                className="size-4 rounded border-[var(--border)] accent-[var(--accent)] cursor-pointer"
                              />
                            </div>
                          )}
                          <Link
                            to={`/courses/${item.id}`}
                            className="flex flex-col justify-between p-5 rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--surface-warm)] shadow-sm hover:border-[var(--accent)] transition duration-200 h-full min-h-[140px]"
                          >
                            <div>
                              <div className={cn("flex items-center justify-between gap-2 pr-20", canDelete ? "pl-5" : "")}>
                                <span className="font-[var(--font-mono)] text-[10px] font-semibold text-[var(--meta)]">
                                  #{item.id}
                                </span>
                                {levelBadge && (
                                  <span className={levelBadge.className}>
                                    {levelBadge.label}
                                  </span>
                                )}
                              </div>
                              <h3 className={cn("mt-3 font-semibold text-[var(--fg)] text-base line-clamp-2 pr-20", canDelete ? "pl-5" : "")}>
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
                          {canDelete && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  handleToggleShare(item.id, !!item.shared)
                                }}
                                className={cn(
                                  "absolute top-3.5 right-[42px] px-2 py-1 rounded-[var(--radius-pill)] border text-[10px] font-extrabold transition cursor-pointer z-10 shadow-sm leading-none h-[26px] flex items-center justify-center",
                                  item.shared
                                    ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] border-[var(--accent)] text-[var(--accent)]"
                                    : "bg-[var(--surface)] border-[var(--border-soft)] text-[var(--muted)] hover:text-[var(--fg)] hover:border-[var(--border)]"
                                )}
                                title={item.shared ? "点击取消共享" : "点击共享给其他用户"}
                              >
                                {item.shared ? "🌐 共享" : "🔒 私有"}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  handleDeleteLesson(item.id)
                                }}
                                className="absolute top-3.5 right-3.5 p-1.5 rounded-full bg-[var(--surface)] border border-[var(--border-soft)] text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] transition cursor-pointer text-xs leading-none shadow-sm z-10 h-[26px] w-[26px] flex items-center justify-center"
                                title="删除课程"
                              >
                                🗑️
                              </button>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

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
          <form
            onSubmit={handleCreateLesson}
            className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--bg)] shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-soft)] p-4 shrink-0">
              <h3 className="font-[var(--font-display)] text-base font-bold flex items-center gap-1.5 text-[var(--fg)]">
                <span>📸</span> 拍照/上传图片成课
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-[var(--muted)] hover:text-[var(--fg)] text-base font-bold cursor-pointer w-6 h-6 flex items-center justify-center rounded-full hover:bg-[var(--surface)] transition"
                disabled={ocrLoading || createLoading}
              >
                ✕
              </button>
            </div>

            {/* Scrollable Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                    className="mt-1.5 w-full rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[var(--surface-warm)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
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
                    className="mt-1.5 w-full rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[var(--surface-warm)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)] appearance-none cursor-pointer"
                    disabled={createLoading}
                  >
                    <option value="简单">简单 (Junior)</option>
                    <option value="中等">中等 (Medium)</option>
                    <option value="困难">困难 (Senior)</option>
                  </select>
                </div>
              </div>

              {/* AI Service Configuration Panels */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[var(--surface-warm)]">
                {/* 1. OCR Provider */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                    OCR 识别通道
                  </label>
                  <select
                    value={selectedOcrPresetId}
                    onChange={(e) => setSelectedOcrPresetId(e.target.value)}
                    className="mt-1.5 w-full rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)] appearance-none cursor-pointer"
                    disabled={createLoading || ocrLoading}
                  >
                    {ocrPresets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name} ({preset.provider === 'unisound' ? '云知声' : preset.provider === 'mimo' ? '小米 MIMO' : preset.provider === 'zhipu' ? '智谱' : preset.provider === 'agnes' ? 'Agnes' : preset.provider})
                      </option>
                    ))}
                    {ocrPresets.length === 0 && (
                      <option value="">默认 OCR ({publicSettings?.ocr_provider === 'mimo' ? '小米 MIMO' : publicSettings?.ocr_provider === 'zhipu' ? '智谱' : '云知声 Maas'})</option>
                    )}
                  </select>
                </div>

                {/* 2. LLM Model */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                    AI 翻译模型
                  </label>
                  <select
                    value={selectedLlmPresetId}
                    onChange={(e) => setSelectedLlmPresetId(e.target.value)}
                    className="mt-1.5 w-full rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)] appearance-none cursor-pointer"
                    disabled={createLoading}
                  >
                    {llmPresets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name} ({preset.model})
                      </option>
                    ))}
                    {llmPresets.length === 0 && (
                      <option value="">默认大模型 ({publicSettings?.openai_model || 'gpt-4o-mini'})</option>
                    )}
                  </select>
                </div>

                {/* 3. TTS Provider */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                    TTS 语音服务商
                  </label>
                  <select
                    value={selectedTtsPresetId}
                    onChange={(e) => {
                      const id = e.target.value
                      setSelectedTtsPresetId(id)
                      
                      if (id === 'edge') {
                        setSelectedTtsProvider('edge')
                        setSelectedTtsVoice('en-US-EmmaNeural')
                      } else {
                        const found = ttsPresets.find(p => p.id === id)
                        if (found) {
                          const prov = found.provider || 'edge'
                          setSelectedTtsProvider(prov)
                          if (found.voice) {
                            setSelectedTtsVoice(found.voice)
                          } else if (prov === 'unisound') {
                            setSelectedTtsVoice('cn_female_shasha')
                          } else if (prov === 'mimo') {
                            setSelectedTtsVoice('冰糖')
                          }
                        }
                      }
                    }}
                    className="mt-1.5 w-full rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)] appearance-none cursor-pointer"
                    disabled={createLoading}
                  >
                    <option value="edge">微软 Edge TTS (系统默认)</option>
                    {ttsPresets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name} ({preset.provider === 'unisound' ? '云知声' : preset.provider === 'mimo' ? '小米 MIMO' : preset.provider})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. TTS Voice */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                    发音人/音色
                  </label>
                  <select
                    value={selectedTtsVoice}
                    onChange={(e) => setSelectedTtsVoice(e.target.value)}
                    className="mt-1.5 w-full rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)] appearance-none cursor-pointer"
                    disabled={createLoading}
                  >
                    {selectedTtsProvider === 'edge' && (
                      <>
                        <option value="en-US-EmmaNeural">Emma (美音女声 - 推荐)</option>
                        <option value="en-US-GuyNeural">Guy (美音男声)</option>
                        <option value="en-US-AndrewMultilingualNeural">Andrew (男声 Multilingual)</option>
                        <option value="en-US-BrianNeural">Brian (英音男声)</option>
                        <option value="en-US-AvaNeural">Ava (美音女声)</option>
                      </>
                    )}
                    {selectedTtsProvider === 'unisound' && (
                      <>
                        <option value="cn_female_shasha">沙沙 (精品女声 - 推荐)</option>
                        <option value="cn_female_ruolin">若琳 (精品女声)</option>
                        <option value="cn_male_chenyu">陈羽 (精品男声)</option>
                      </>
                    )}
                    {selectedTtsProvider === 'mimo' && (
                      <>
                        <option value="冰糖">冰糖 (甜美女声 - 推荐)</option>
                        <option value="茉莉">茉莉 (温柔女声)</option>
                        <option value="苏打">苏打 (磁性男声)</option>
                        <option value="白桦">白桦 (稳重男声)</option>
                        <option value="Mia">Mia (英文女声)</option>
                        <option value="Chloe">Chloe (英文女声)</option>
                        <option value="Milo">Milo (英文男声)</option>
                        <option value="Dean">Dean (英文男声)</option>
                      </>
                    )}
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
                  className="mt-1.5 w-full h-24 rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[var(--surface-warm)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)] resize-none"
                  placeholder="识别出的英文内容将显示在这里，您可以手动删减、清洗格式，确保英文标点正确..."
                  disabled={createLoading}
                />
              </div>

              {error && (
                <div className="rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] p-3 text-xs font-semibold text-[var(--danger)]">
                  {error}
                </div>
              )}
            </div>

            {/* Modal Footer (Sticky/Docked at bottom) */}
            <div className="flex justify-end gap-2 border-t border-[var(--border-soft)] p-4 shrink-0 bg-[var(--bg)]">
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
                {createLoading ? 'AI 正在生成课程...' : '确定生成课程'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
