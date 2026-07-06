import { useEffect, useState } from 'react'

export function SettingsPage() {
  // LLM settings
  const [openaiApiKey, setOpenaiApiKey] = useState('')
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState('')
  const [openaiModel, setOpenaiModel] = useState('')

  // OCR settings
  const [ocrProvider, setOcrProvider] = useState('mimo')
  const [ocrApiKey, setOcrApiKey] = useState('')
  const [ocrBaseUrl, setOcrBaseUrl] = useState('')
  const [ocrModel, setOcrModel] = useState('')

  // TTS settings
  const [ttsVoice, setTtsVoice] = useState('en-US-AndrewMultilingualNeural')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/settings')
        if (res.ok) {
          const data = await res.json()
          setOpenaiApiKey(data.openai_api_key || '')
          setOpenaiBaseUrl(data.openai_base_url || 'https://api.openai.com/v1')
          setOpenaiModel(data.openai_model || 'gpt-4o-mini')

          setOcrProvider(data.ocr_provider || 'mimo')
          setOcrApiKey(data.ocr_api_key || '')
          setOcrBaseUrl(data.ocr_base_url || 'https://api.xiaomimimo.com')
          setOcrModel(data.ocr_model || 'mimo-v2.5')

          setTtsVoice(data.tts_voice || 'en-US-AndrewMultilingualNeural')
        }
      } catch (e) {
        console.error('Failed to load settings:', e)
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openai_api_key: openaiApiKey.trim(),
          openai_base_url: openaiBaseUrl.trim(),
          openai_model: openaiModel.trim(),

          ocr_provider: ocrProvider,
          ocr_api_key: ocrApiKey.trim(),
          ocr_base_url: ocrBaseUrl.trim(),
          ocr_model: ocrModel.trim(),

          tts_voice: ttsVoice
        })
      })

      if (res.ok) {
        setSuccess('AI 接口配置保存成功！')
      } else {
        const data = await res.json()
        setError(data.error || '保存配置失败')
      }
    } catch {
      setError('网络连接错误，保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-[var(--muted)]">
        <p className="font-[var(--font-mono)] text-xs uppercase tracking-widest">加载系统配置中...</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Title */}
      <div className="border-b border-[var(--border-soft)] pb-4">
        <h1 className="font-[var(--font-display)] text-2xl font-bold font-semibold">AI 模型接口配置</h1>
        <p className="text-xs text-[var(--muted)] mt-1">管理员专属配置。设置好大模型、OCR 秘钥及 TTS 后，全站普通用户即可直接共享使用。</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* LLM Section */}
        <div className="p-5 rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--surface-warm)] space-y-4">
          <h2 className="font-bold text-base text-[var(--accent)] border-b border-[var(--border-soft)] pb-2">
            1. 大语言模型配置 (课文断句与双语翻译)
          </h2>

          <div className="grid gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                API Base URL (接口地址)
              </label>
              <input
                type="text"
                value={openaiBaseUrl}
                onChange={(e) => setOpenaiBaseUrl(e.target.value)}
                className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
                placeholder="例如：https://api.openai.com/v1 或中转接口"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                API Key (密钥)
              </label>
              <input
                type="password"
                value={openaiApiKey}
                onChange={(e) => setOpenaiApiKey(e.target.value)}
                className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
                placeholder="请输入 OpenAI 规范 API Key"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                Model Name (模型名称)
              </label>
              <input
                type="text"
                value={openaiModel}
                onChange={(e) => setOpenaiModel(e.target.value)}
                className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
                placeholder="例如：gpt-4o-mini, deepseek-chat"
                required
              />
            </div>
          </div>
        </div>

        {/* OCR Section */}
        <div className="p-5 rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--surface-warm)] space-y-4">
          <h2 className="font-bold text-base text-[var(--accent)] border-b border-[var(--border-soft)] pb-2">
            2. OCR 文字识别配置 (拍照课件识别)
          </h2>

          <div className="grid gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                OCR 识别服务商 (OCR Provider)
              </label>
              <select
                value={ocrProvider}
                onChange={(e) => {
                  const p = e.target.value
                  setOcrProvider(p)
                  // Pre-fill defaults
                  if (p === 'mimo') {
                    setOpenaiBaseUrl(prev => prev || 'https://api.xiaomimimo.com')
                    setOcrBaseUrl('https://api.xiaomimimo.com')
                    setOcrModel('mimo-v2.5')
                  } else if (p === 'zhipu') {
                    setOcrBaseUrl('https://open.bigmodel.cn/api/paas/v4')
                    setOcrModel('glm-5v-turbo')
                  } else if (p === 'unisound') {
                    setOcrBaseUrl('https://maas-api.unisound.com/v1')
                    setOcrModel('u1-ocr')
                  }
                }}
                className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-2.5 text-sm outline-none focus:border-[var(--accent)] appearance-none cursor-pointer"
              >
                <option value="mimo">小米 MIMO (支持 glm-5v-turbo)</option>
                <option value="zhipu">智谱清言 GLM (多模态识图)</option>
                <option value="unisound">云知声 Maas (专用 OCR 接口)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                OCR Base URL (接口地址)
              </label>
              <input
                type="text"
                value={ocrBaseUrl}
                onChange={(e) => setOcrBaseUrl(e.target.value)}
                className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
                placeholder="接口端点"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                OCR API Key (密钥)
              </label>
              <input
                type="password"
                value={ocrApiKey}
                onChange={(e) => setOcrApiKey(e.target.value)}
                className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
                placeholder="填写对应 OCR 平台的 API Key"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                OCR Model (所用模型名称)
              </label>
              <input
                type="text"
                value={ocrModel}
                onChange={(e) => setOcrModel(e.target.value)}
                className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
                placeholder="模型或接口参数"
                required
              />
            </div>
          </div>
        </div>

        {/* TTS Section */}
        <div className="p-5 rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--surface-warm)] space-y-4">
          <h2 className="font-bold text-base text-[var(--accent)] border-b border-[var(--border-soft)] pb-2">
            3. TTS 语音合成发音人设置
          </h2>

          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
              系统合成默认英文配音 (Voice Speaker)
            </label>
            <select
              value={ttsVoice}
              onChange={(e) => setTtsVoice(e.target.value)}
              className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-2.5 text-sm outline-none focus:border-[var(--accent)] appearance-none cursor-pointer"
            >
              <option value="en-US-AndrewMultilingualNeural">微软 Edge TTS - Andrew (男声 Multilingual)</option>
              <option value="en-US-BrianNeural">微软 Edge TTS - Brian (英音男声)</option>
              <option value="en-US-EmmaNeural">微软 Edge TTS - Emma (美音女声)</option>
              <option value="en-US-AvaNeural">微软 Edge TTS - Ava (美音女声)</option>
              <option value="mimo-en-US-male">小米 MIMO TTS - 美式男声</option>
              <option value="mimo-en-US-female">小米 MIMO TTS - 美式女声</option>
              <option value="unisound-en-US">云知声 TTS - 美式发音</option>
            </select>
          </div>
        </div>

        {/* Status notification */}
        {error && (
          <div className="rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] p-4 text-xs font-semibold text-[var(--danger)]">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_8%,transparent)] p-4 text-xs font-semibold text-[var(--success)]">
            {success}
          </div>
        )}

        {/* Save button */}
        <div className="flex justify-end pt-3">
          <button
            type="submit"
            className="px-6 py-3 rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--accent-on)] text-sm font-bold hover:opacity-90 transition cursor-pointer"
            disabled={saving}
          >
            {saving ? '正在保存...' : '💾 保存 AI 接口配置'}
          </button>
        </div>
      </form>
    </div>
  )
}
