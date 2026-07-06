import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { formatTime, lessonLevelBadge } from '@/lib/courseUtils'

interface Cue {
  id: string
  start: number
  end: number
  text: string
  english: string
  chinese: string
}

interface LessonDetails {
  id: string
  title: string
  level: string
  courseId: string
  resources: {
    lesson: string
    subtitle: string
  }
}

interface SavedVocab {
  id: string
  word: string
  phonetic: string
  translation: string
}

interface SavedReview {
  id: string
  text: string
}

interface LessonPageProps {
  theme: string
  onCycleTheme: () => void
  currentUser: { username: string; role: string }
  onLogout: () => void
}

export function LessonPage({ theme, onCycleTheme, currentUser, onLogout }: LessonPageProps) {
  const { lessonId } = useParams<{ lessonId: string }>()
  const [lesson, setLesson] = useState<LessonDetails | null>(null)
  const [cues, setCues] = useState<Cue[]>([])
  const [loading, setLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackRate, setPlaybackRate] = useState<number>(1.0)
  const [subtitleMode, setSubtitleMode] = useState<'bilingual' | 'en' | 'zh' | 'off'>('bilingual')
  const [loopSentence, setLoopSentence] = useState(false)
  const [activeCueId, setActiveCueId] = useState<string | null>(null)

  // Voice recording (shadowing) states
  const [recordingCueId, setRecordingCueId] = useState<string | null>(null)
  const [recordedUrls, setRecordedUrls] = useState<Record<string, string>>({})
  const [playingRecordId, setPlayingRecordId] = useState<string | null>(null)

  // Dictionary modal states
  const [selectedWord, setSelectedWord] = useState<string | null>(null)
  const [wordTranslation, setWordTranslation] = useState<{
    phonetic?: string
    translation?: string
    found: boolean
  } | null>(null)
  const [dictLoading, setDictLoading] = useState(false)

  // Bookmarks cache
  const [savedVocabs, setSavedVocabs] = useState<SavedVocab[]>([])
  const [savedReviews, setSavedReviews] = useState<SavedReview[]>([])

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const rafIdRef = useRef<number | null>(null)
  const recordingAudioRef = useRef<HTMLAudioElement | null>(null)

  // 1. Fetch lesson information & subtitles
  useEffect(() => {
    if (!lessonId) return

    const loadLessonData = async () => {
      try {
        setLoading(true)
        // A. Fetch details
        const detailsRes = await fetch(`/api/courses/custom/lessons/${lessonId}`)
        if (!detailsRes.ok) throw new Error('Lesson not found')
        const detailsData = await detailsRes.json()
        setLesson(detailsData)

        // B. Fetch subtitles
        const subsRes = await fetch(`/api/courses/custom/lessons/${lessonId}/subtitles?mode=bilingual`)
        if (subsRes.ok) {
          const cuesData = await subsRes.json()
          const processed = cuesData.map((c: any) => {
            const lines = c.text.split('\n')
            return {
              ...c,
              english: lines[0] || '',
              chinese: lines[1] || ''
            }
          })
          setCues(processed)
        }

        // C. Fetch bookmarks
        fetchBookmarks()

        // D. Load saved progress
        const savedProgress = window.localStorage.getItem(`progress_${lessonId}`)
        if (savedProgress) {
          const parsed = JSON.parse(savedProgress)
          if (parsed && parsed.time) {
            setCurrentTime(parsed.time)
          }
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadLessonData()
  }, [lessonId])

  const fetchBookmarks = async () => {
    try {
      const vocabRes = await fetch('/api/user/vocab')
      if (vocabRes.ok) setSavedVocabs(await vocabRes.json())

      const reviewsRes = await fetch('/api/user/reviews')
      if (reviewsRes.ok) setSavedReviews(await reviewsRes.json())
    } catch (e) {
      console.error('Failed to fetch bookmarks:', e)
    }
  }

  // 2. High-precision animation frame loop for player progress and single-sentence loop checking
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !isPlaying) {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      return
    }

    const checkTime = () => {
      const time = audio.currentTime
      setCurrentTime(time)

      // Find active cue
      const active = cues.find(c => time >= c.start && time < c.end)
      if (active) {
        setActiveCueId(active.id)

        // Loop checking with 30ms safety margin
        if (loopSentence) {
          const safetyMargin = 0.03
          if (time >= active.end - safetyMargin) {
            audio.currentTime = active.start
            setCurrentTime(active.start)
          }
        }
      } else {
        setActiveCueId(null)
      }

      // Save progress periodically (throttled implicitly by window.localStorage write)
      if (Math.abs(audio.currentTime - time) > 0.5) {
        window.localStorage.setItem(`progress_${lessonId}`, JSON.stringify({
          time: audio.currentTime,
          progress: Math.floor((audio.currentTime / (audio.duration || 1)) * 100)
        }))
      }

      rafIdRef.current = requestAnimationFrame(checkTime)
    }

    rafIdRef.current = requestAnimationFrame(checkTime)
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
      }
    }
  }, [isPlaying, cues, loopSentence, lessonId])

  // Set initial seek position when audio elements are loaded
  const onAudioLoadedMetadata = () => {
    const audio = audioRef.current
    if (!audio) return
    setDuration(audio.duration)
    // Seek to saved progress position
    const savedProgress = window.localStorage.getItem(`progress_${lessonId}`)
    if (savedProgress) {
      const parsed = JSON.parse(savedProgress)
      if (parsed && parsed.time && parsed.time < audio.duration) {
        audio.currentTime = parsed.time
        setCurrentTime(parsed.time)
      }
    }
  }

  const handlePlayPause = () => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      audio.playbackRate = playbackRate
      audio.play().catch(() => {})
      setIsPlaying(true)
    }
  }

  const handleSeek = (time: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = time
    setCurrentTime(time)
  }

  const handleSeekCue = (cue: Cue) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = cue.start
    setCurrentTime(cue.start)
    setActiveCueId(cue.id)
    if (!isPlaying) {
      audio.playbackRate = playbackRate
      audio.play().catch(() => {})
      setIsPlaying(true)
    }
  }

  // Word Clicking
  const handleWordClick = async (word: string) => {
    // Pause lesson audio first
    if (audioRef.current && isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    }

    const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, '').trim()
    if (!cleanWord) return

    setSelectedWord(cleanWord)
    setWordTranslation(null)
    setDictLoading(true)

    try {
      const res = await fetch(`/api/dict/lookup?word=${encodeURIComponent(cleanWord)}`)
      if (res.ok) {
        const data = await res.json()
        setWordTranslation(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setDictLoading(false)
    }
  }

  // Pronounce word using browser speech synthesis
  const pronounceWord = (word: string) => {
    if (!window.speechSynthesis) return
    // Cancel any current speech
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(word)
    utter.lang = 'en-US'
    window.speechSynthesis.speak(utter)
  }

  // Bookmarking a Word
  const toggleBookmarkWord = async (word: string, isSaved: boolean) => {
    try {
      if (isSaved) {
        const target = savedVocabs.find(v => v.word.toLowerCase() === word.toLowerCase())
        if (target) {
          const res = await fetch(`/api/user/vocab/${target.id}`, { method: 'DELETE' })
          if (res.ok) fetchBookmarks()
        }
      } else {
        const translation = wordTranslation?.translation || ''
        const phonetic = wordTranslation?.phonetic || ''
        const res = await fetch('/api/user/vocab', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ word, phonetic, translation })
        })
        if (res.ok) fetchBookmarks()
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Bookmarking a Sentence
  const toggleBookmarkSentence = async (cue: Cue, isSaved: boolean) => {
    try {
      if (isSaved) {
        const target = savedReviews.find(r => r.text === cue.english)
        if (target) {
          const res = await fetch(`/api/user/reviews/${target.id}`, { method: 'DELETE' })
          if (res.ok) fetchBookmarks()
        }
      } else {
        const res = await fetch('/api/user/reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: cue.english,
            translation: cue.chinese,
            lessonId,
            audioStart: cue.start,
            audioEnd: cue.end
          })
        })
        if (res.ok) fetchBookmarks()
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Mic recording for shadowing
  const startRecording = async (cueId: string) => {
    // Pause main player
    if (audioRef.current && isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const audioUrl = URL.createObjectURL(audioBlob)
        setRecordedUrls(prev => ({
          ...prev,
          [cueId]: audioUrl
        }))
        setRecordingCueId(null)
      }

      setRecordingCueId(cueId)
      mediaRecorder.start()
    } catch (err) {
      console.error('Failed to get media devices:', err)
      alert('无法录音。在非 HTTPS/localhost 环境中，浏览器可能隐藏了录音权限，请配置安全上下文。')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      // Stop mic tracks
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
    }
  }

  const playRecord = (cueId: string) => {
    const url = recordedUrls[cueId]
    if (!url) return

    if (playingRecordId === cueId) {
      if (recordingAudioRef.current) {
        recordingAudioRef.current.pause()
      }
      setPlayingRecordId(null)
      return
    }

    // Stop current play if any
    if (recordingAudioRef.current) {
      recordingAudioRef.current.pause()
    }

    const audio = new Audio(url)
    recordingAudioRef.current = audio
    setPlayingRecordId(cueId)
    audio.play().catch(() => setPlayingRecordId(null))
    audio.onended = () => {
      setPlayingRecordId(null)
    }
  }

  const deleteRecord = (cueId: string) => {
    if (recordedUrls[cueId]) {
      URL.revokeObjectURL(recordedUrls[cueId])
      setRecordedUrls(prev => {
        const copy = { ...prev }
        delete copy[cueId]
        return copy
      })
    }
  }

  // Word splitting for clicking
  const renderSentenceWords = (english: string) => {
    const words = english.split(/(\s+)/)
    return words.map((chunk, idx) => {
      const isWord = /[a-zA-Z]/.test(chunk)
      if (isWord) {
        return (
          <span
            key={idx}
            onClick={(e) => {
              e.stopPropagation()
              handleWordClick(chunk)
            }}
            className="cursor-pointer hover:text-[var(--accent)] hover:underline rounded px-0.5"
          >
            {chunk}
          </span>
        )
      }
      return <span key={idx}>{chunk}</span>
    })
  }

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[var(--bg)] text-[var(--muted)]">
        <p className="font-[var(--font-mono)] text-xs uppercase tracking-widest">加载课程数据中...</p>
      </div>
    )
  }

  if (!lesson) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[var(--bg)] text-[var(--danger)]">
        <p>课程不存在或已被删除</p>
      </div>
    )
  }

  const isWordSaved = (word: string) => savedVocabs.some(v => v.word.toLowerCase() === word.toLowerCase())
  const isSentenceSaved = (text: string) => savedReviews.some(r => r.text === text)

  return (
    <div className="flex flex-col min-h-dvh bg-[var(--bg)] text-[var(--fg)] pb-[calc(var(--player-h)+30px)]">
      {/* Top sticky header */}
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-[var(--border-soft)] bg-[color-mix(in_srgb,var(--bg)_85%,transparent)] px-4 backdrop-blur-md">
        <Link
          to="/courses"
          className="flex items-center gap-1.5 text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] transition cursor-pointer"
        >
          &larr; 返回列表
        </Link>
        <h2 className="text-sm font-semibold truncate max-w-[40%]">{lesson.title}</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--muted)] max-sm:hidden">{currentUser.username}</span>
          <span className={lessonLevelBadge(lesson.level).className}>
            {lessonLevelBadge(lesson.level).label}
          </span>
          <button
            onClick={onCycleTheme}
            className="p-1.5 rounded-full hover:bg-[var(--surface)] text-[var(--muted)] text-sm cursor-pointer"
            type="button"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <button
            onClick={onLogout}
            className="text-xs font-semibold text-[var(--muted)] hover:text-[var(--danger)] transition cursor-pointer ml-1"
            type="button"
          >
            退出
          </button>
        </div>
      </header>

      {/* Main card subtitles stream */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-4">
        {cues.map((cue) => {
          const isActive = activeCueId === cue.id
          const hasRecord = !!recordedUrls[cue.id]
          const isRec = recordingCueId === cue.id
          const isPlayRec = playingRecordId === cue.id
          const isSavedSent = isSentenceSaved(cue.english)

          return (
            <div
              key={cue.id}
              onClick={() => handleSeekCue(cue)}
              className={cn(
                "p-4 rounded-[var(--radius-lg)] border bg-[var(--surface-warm)] transition duration-200 cursor-pointer shadow-sm relative",
                isActive
                  ? "border-[var(--accent)] ring-2 ring-[color-mix(in_srgb,var(--accent)_15%,transparent)]"
                  : "border-[var(--border-soft)] hover:border-[var(--border)]"
              )}
            >
              {/* Timing code (hidden or small top right) */}
              <div className="absolute top-2 right-2 text-[10px] text-[var(--meta)] font-[var(--font-mono)]">
                {formatTime(cue.start)}
              </div>

              {/* Subtitle bilingual content */}
              <div className="space-y-2 pr-12">
                {/* English text (word clickable) */}
                {subtitleMode !== 'zh' && (
                  <p className="font-semibold text-lg leading-relaxed tracking-wide font-[var(--font-display)] text-[var(--fg)]">
                    {renderSentenceWords(cue.english)}
                  </p>
                )}
                {/* Chinese text */}
                {subtitleMode !== 'en' && subtitleMode !== 'off' && (
                  <p className="text-sm text-[var(--muted)] leading-relaxed">
                    {cue.chinese}
                  </p>
                )}
              </div>

              {/* Action buttons (record, bookmark, play record) */}
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[color-mix(in_srgb,var(--border-soft)_50%,transparent)] pt-3">
                {/* Mic Record Button */}
                {!hasRecord ? (
                  <button
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      startRecording(cue.id)
                    }}
                    onMouseUp={(e) => {
                      e.stopPropagation()
                      stopRecording()
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      startRecording(cue.id)
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      stopRecording()
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-[var(--radius-pill)] text-xs font-bold border transition cursor-pointer flex items-center gap-1.5",
                      isRec
                        ? "bg-[var(--danger)] text-white border-[var(--danger)] animate-pulse"
                        : "bg-[var(--surface)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)]"
                    )}
                    type="button"
                  >
                    🎤 {isRec ? '松开停止' : '按住跟读'}
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        playRecord(cue.id)
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-[var(--radius-pill)] text-xs font-bold transition cursor-pointer flex items-center gap-1",
                        isPlayRec
                          ? "bg-[var(--accent)] text-white"
                          : "bg-[var(--surface)] border border-[var(--border)] text-[var(--fg)]"
                      )}
                      type="button"
                    >
                      🗣️ {isPlayRec ? '停止播放' : '听我跟读'}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteRecord(cue.id)
                      }}
                      className="p-1.5 rounded-full hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] text-[var(--danger)] text-xs transition cursor-pointer"
                      type="button"
                      title="删除跟读录音"
                    >
                      🗑️
                    </button>
                  </div>
                )}

                {/* Bookmark Sentence button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleBookmarkSentence(cue, isSavedSent)
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-[var(--radius-pill)] text-xs font-bold border transition cursor-pointer flex items-center gap-1",
                    isSavedSent
                      ? "bg-[color-mix(in_srgb,var(--warn)_15%,transparent)] text-[#d4a000] border-[color-mix(in_srgb,var(--warn)_50%,transparent)]"
                      : "bg-[var(--surface)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)]"
                  )}
                  type="button"
                >
                  ⭐ {isSavedSent ? '已存句' : '存例句'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Hidden Audio Player Tag */}
      <audio
        ref={audioRef}
        src={`/api/resources/${lessonId}/lesson.mp3`}
        onLoadedMetadata={onAudioLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        preload="auto"
      />

      {/* Sticky Bottom Control Panel */}
      <div className="fixed bottom-0 left-0 right-0 z-30 h-[var(--player-h)] border-t border-[var(--border-soft)] bg-[color-mix(in_srgb,var(--bg)_95%,transparent)] px-4 py-2 backdrop-blur-lg flex flex-col justify-center gap-1 shadow-md">
        {/* Progress bar */}
        <div className="flex items-center gap-2 max-w-xl mx-auto w-full">
          <span className="text-[10px] font-[var(--font-mono)] text-[var(--muted)] shrink-0">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={(e) => handleSeek(Number(e.target.value))}
            className="flex-1 h-1.5 rounded-full bg-[var(--surface)] outline-none accent-[var(--accent)] cursor-pointer"
          />
          <span className="text-[10px] font-[var(--font-mono)] text-[var(--muted)] shrink-0">
            {formatTime(duration)}
          </span>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between max-w-xl mx-auto w-full px-2">
          {/* Loop Mode */}
          <button
            onClick={() => setLoopSentence(!loopSentence)}
            className={cn(
              "px-3 py-1.5 rounded-[var(--radius-pill)] text-xs font-bold border transition cursor-pointer",
              loopSentence
                ? "bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] border-[var(--accent)] text-[var(--accent)]"
                : "bg-[var(--surface)] border-[var(--border)] text-[var(--muted)]"
            )}
            type="button"
            title="单句循环模式"
          >
            🔁 {loopSentence ? '单句循环: 开' : '单句循环: 关'}
          </button>

          {/* Play/Pause */}
          <button
            onClick={handlePlayPause}
            className="size-11 rounded-full bg-[var(--accent)] text-[var(--accent-on)] text-xl font-bold flex items-center justify-center shadow hover:scale-105 active:scale-95 transition cursor-pointer"
            type="button"
          >
            {isPlaying ? '⏸' : '▶'}
          </button>

          {/* Speed & Subtitle options */}
          <div className="flex items-center gap-1.5">
            {/* Speed Rate */}
            <button
              onClick={() => {
                const nextRate = playbackRate === 1.0 ? 0.75 : 1.0
                setPlaybackRate(nextRate)
                if (audioRef.current) {
                  audioRef.current.playbackRate = nextRate
                }
              }}
              className="px-2.5 py-1.5 rounded-[var(--radius-pill)] border border-[var(--border)] bg-[var(--surface)] text-xs font-bold text-[var(--fg)] cursor-pointer"
              type="button"
            >
              🚀 {playbackRate.toFixed(2)}x
            </button>

            {/* Subtitle toggler */}
            <button
              onClick={() => {
                const list: Array<'bilingual' | 'en' | 'zh' | 'off'> = ['bilingual', 'en', 'zh', 'off']
                const next = list[(list.indexOf(subtitleMode) + 1) % list.length]
                setSubtitleMode(next)
              }}
              className="px-2.5 py-1.5 rounded-[var(--radius-pill)] border border-[var(--border)] bg-[var(--surface)] text-xs font-bold text-[var(--fg)] cursor-pointer"
              type="button"
            >
              💬 {subtitleMode === 'bilingual' ? '双语' : subtitleMode === 'en' ? '英文' : subtitleMode === 'zh' ? '中文' : '无字'}
            </button>
          </div>
        </div>
      </div>

      {/* Dictionary Translation Bottom-Sheet Modal */}
      {selectedWord && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[color-mix(in_srgb,var(--fg)_50%,transparent)] p-0 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-t-[var(--radius-lg)] border-t border-[var(--border-soft)] bg-[var(--bg)] p-6 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between border-b border-[var(--border-soft)] pb-3">
              <h3 className="font-[var(--font-display)] text-xl font-bold tracking-wide flex items-center gap-2">
                📖 {selectedWord}
                <button
                  onClick={() => pronounceWord(selectedWord)}
                  className="p-1 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-full hover:bg-[var(--border-soft)] transition cursor-pointer"
                  title="发音"
                >
                  🔊
                </button>
              </h3>
              <button
                onClick={() => setSelectedWord(null)}
                className="text-[var(--muted)] hover:text-[var(--fg)] text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="py-4 min-h-24">
              {dictLoading ? (
                <div className="flex items-center justify-center h-24 text-xs text-[var(--muted)] font-[var(--font-mono)]">
                  正在查询词典中...
                </div>
              ) : wordTranslation && wordTranslation.found ? (
                <div className="space-y-3">
                  {wordTranslation.phonetic && (
                    <p className="text-xs font-[var(--font-mono)] text-[var(--muted)] font-semibold bg-[var(--surface-warm)] px-2 py-1 rounded inline-block">
                      /{wordTranslation.phonetic}/
                    </p>
                  )}
                  <p className="text-sm leading-relaxed text-[var(--fg)] whitespace-pre-wrap">
                    {wordTranslation.translation}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-[var(--muted)]">未找到本地与在线释义。</p>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-[var(--border-soft)] pt-3">
              {/* Word Bookmark toggle */}
              <button
                onClick={() => toggleBookmarkWord(selectedWord, isWordSaved(selectedWord))}
                className={cn(
                  "px-4 py-2 text-xs font-bold rounded-[var(--radius-md)] border transition cursor-pointer flex items-center gap-1",
                  isWordSaved(selectedWord)
                    ? "bg-[color-mix(in_srgb,var(--warn)_15%,transparent)] text-[#d4a000] border-[color-mix(in_srgb,var(--warn)_50%,transparent)]"
                    : "bg-[var(--accent)] text-[var(--accent-on)] border-[var(--accent)] hover:opacity-90"
                )}
              >
                ⭐ {isWordSaved(selectedWord) ? '已收藏生词' : '加入生词本'}
              </button>
              <button
                onClick={() => setSelectedWord(null)}
                className="px-4 py-2 text-xs font-bold rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--surface)] transition cursor-pointer"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
