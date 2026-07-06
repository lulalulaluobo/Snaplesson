import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { formatTime } from '@/lib/courseUtils'

interface SavedWord {
  id: string
  word: string
  phonetic: string
  translation: string
}

interface SavedSentence {
  id: string
  text: string
  translation: string
  lessonId: string
  audioStart: number
  audioEnd: number
}

export function VocabPage() {
  const [activeTab, setActiveTab] = useState<'word' | 'sentence'>('word')
  const [words, setWords] = useState<SavedWord[]>([])
  const [sentences, setSentences] = useState<SavedSentence[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      setLoading(true)
      const vocabRes = await fetch('/api/user/vocab')
      if (vocabRes.ok) setWords(await vocabRes.json())

      const reviewsRes = await fetch('/api/user/reviews')
      if (reviewsRes.ok) setSentences(await reviewsRes.json())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const deleteWord = async (id: string) => {
    if (!window.confirm('确定要将该生词移出生词本吗？')) return
    try {
      const res = await fetch(`/api/user/vocab/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setWords(prev => prev.filter(w => w.id !== id))
      }
    } catch (e) {
      console.error(e)
    }
  }

  const deleteSentence = async (id: string) => {
    if (!window.confirm('确定要将该例句移出收藏夹吗？')) return
    try {
      const res = await fetch(`/api/user/reviews/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setSentences(prev => prev.filter(s => s.id !== id))
      }
    } catch (e) {
      console.error(e)
    }
  }

  const pronounceWord = (word: string) => {
    const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=2`
    const audio = new Audio(url)
    audio.play().catch((err) => console.error('播放发音失败:', err))
  }

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-[var(--muted)]">
        <p className="font-[var(--font-mono)] text-xs uppercase tracking-widest">加载中...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="border-b border-[var(--border-soft)] pb-4">
        <h1 className="font-[var(--font-display)] text-2xl font-bold font-semibold">我的收藏本</h1>
        <p className="text-xs text-[var(--muted)] mt-1">分类管理您在阅读中随手收藏的生词与经典句子</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border-soft)]">
        <button
          onClick={() => setActiveTab('word')}
          className={cn(
            "pb-3 flex-1 text-center font-semibold text-sm transition cursor-pointer",
            activeTab === 'word'
              ? "border-b-2 border-[var(--accent)] text-[var(--accent)]"
              : "text-[var(--muted)] hover:text-[var(--fg)]"
          )}
          type="button"
        >
          生词本 ({words.length})
        </button>
        <button
          onClick={() => setActiveTab('sentence')}
          className={cn(
            "pb-3 flex-1 text-center font-semibold text-sm transition cursor-pointer",
            activeTab === 'sentence'
              ? "border-b-2 border-[var(--accent)] text-[var(--accent)]"
              : "text-[var(--muted)] hover:text-[var(--fg)]"
          )}
          type="button"
        >
          例句本 ({sentences.length})
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'word' ? (
        words.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-[var(--border)] rounded-[var(--radius-lg)] bg-[var(--surface-warm)] text-[var(--muted)] text-sm">
            生词本空空如也。在课时详情页点击生词卡片即可收藏单词。
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            {words.map(w => (
              <div
                key={w.id}
                className="p-4 rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[var(--surface-warm)] flex items-start justify-between gap-4 shadow-sm hover:border-[var(--border)] transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-[var(--fg)] text-lg">{w.word}</h3>
                    {w.phonetic && (
                      <span className="text-xs font-[var(--font-mono)] text-[var(--muted)]">
                        /{w.phonetic}/
                      </span>
                    )}
                    <button
                      onClick={() => pronounceWord(w.word)}
                      className="p-1 rounded hover:bg-[var(--surface)] text-xs text-[var(--muted)] hover:text-[var(--fg)] transition cursor-pointer"
                      title="发音"
                    >
                      🔊
                    </button>
                  </div>
                  <p className="text-sm text-[var(--muted)] whitespace-pre-wrap">{w.translation}</p>
                </div>
                <button
                  onClick={() => deleteWord(w.id)}
                  className="p-1.5 rounded hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] text-[var(--danger)] text-xs transition cursor-pointer"
                  title="删除"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )
      ) : (
        sentences.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-[var(--border)] rounded-[var(--radius-lg)] bg-[var(--surface-warm)] text-[var(--muted)] text-sm">
            例句本空空如也。在学习过程中点击“存例句”按钮即可收藏。
          </div>
        ) : (
          <div className="space-y-3">
            {sentences.map(s => (
              <div
                key={s.id}
                className="p-4 rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[var(--surface-warm)] flex flex-col sm:flex-row justify-between gap-4 shadow-sm hover:border-[var(--border)] transition"
              >
                <div className="space-y-2 flex-1">
                  <p className="font-semibold text-[var(--fg)] text-base font-[var(--font-display)] leading-relaxed">
                    {s.text}
                  </p>
                  <p className="text-sm text-[var(--muted)] leading-relaxed">
                    {s.translation}
                  </p>
                  {s.lessonId && (
                    <div className="text-[10px] text-[var(--meta)] font-[var(--font-mono)]">
                      来自课时 #{s.lessonId} · 定位到 {formatTime(s.audioStart)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {s.lessonId && (
                    <Link
                      to={`/courses/${s.lessonId}?t=${Math.floor(s.audioStart)}`}
                      className="px-3 py-1.5 rounded-[var(--radius-pill)] bg-[var(--accent)] text-[var(--accent-on)] text-xs font-bold hover:opacity-90 transition cursor-pointer"
                    >
                      🔗 定位点读
                    </Link>
                  )}
                  <button
                    onClick={() => deleteSentence(s.id)}
                    className="p-2 rounded hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] text-[var(--danger)] text-sm transition cursor-pointer"
                    title="删除例句"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
