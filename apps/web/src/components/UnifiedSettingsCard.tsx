import { useState } from 'react'

export interface ApiProfile {
  id: string
  name: string
  provider?: string
  baseUrl: string
  apiKey?: string
  model: string
  voice?: string // Only for TTS
}

interface UnifiedSettingsCardProps {
  title: string
  description: string
  profiles: ApiProfile[]
  setProfiles: React.Dispatch<React.SetStateAction<ApiProfile[]>>
  
  // Active fields
  baseUrl: string
  setBaseUrl: (val: string) => void
  apiKey: string
  setApiKey: (val: string) => void
  model: string
  setModel: (val: string) => void
  hasApiKey: boolean
  setHasApiKey: (val: boolean) => void
  apiKeyLast4: string
  setApiKeyLast4: (val: string) => void
  onClearApiKey: () => void

  saving: boolean
  
  // Dynamic fields
  provider?: string
  setProvider?: (val: string) => void
  providerOptions?: { value: string; label: string }[]
  providerLabel?: string
  showApiFields: boolean
  helperText?: string

  customFields?: React.ReactNode
  
  // Support custom fields in profile saving
  extraFieldsForProfile?: {
    voice?: string
    setVoice?: (val: string) => void
  }
  onProfilesChange?: (newProfiles: ApiProfile[]) => void
}

export function UnifiedSettingsCard({
  title,
  description,
  profiles,
  setProfiles,
  baseUrl,
  setBaseUrl,
  apiKey,
  setApiKey,
  model,
  setModel,
  hasApiKey,
  setHasApiKey,
  apiKeyLast4,
  setApiKeyLast4,
  onClearApiKey,
  saving,
  provider,
  setProvider,
  providerOptions,
  providerLabel = '配置类型',
  showApiFields,
  helperText,
  customFields,
  extraFieldsForProfile,
  onProfilesChange
}: UnifiedSettingsCardProps) {
  const [newProfileName, setNewProfileName] = useState('')

  const handleAddProfile = () => {
    if (!newProfileName.trim()) {
      alert('请先输入配置别名！')
      return
    }
    const newProfile: ApiProfile = {
      id: String(Date.now()),
      name: newProfileName.trim(),
      baseUrl: showApiFields ? baseUrl : '',
      apiKey: showApiFields ? apiKey : '',
      model: showApiFields ? model : '',
      provider: provider,
      voice: extraFieldsForProfile?.voice
    }
    const updated = [...profiles, newProfile]
    setProfiles(updated)
    setNewProfileName('')
    if (onProfilesChange) {
      onProfilesChange(updated)
    }
  }

  const handleDeleteProfile = (id: string) => {
    const updated = profiles.filter(p => p.id !== id)
    setProfiles(updated)
    if (onProfilesChange) {
      onProfilesChange(updated)
    }
  }

  const handleApplyProfile = (profile: ApiProfile) => {
    if (setProvider && profile.provider) {
      setProvider(profile.provider)
    }
    setBaseUrl(profile.baseUrl || '')
    setModel(profile.model || '')
    setApiKey(profile.apiKey || '')
    if (profile.apiKey) {
      setHasApiKey(true)
      setApiKeyLast4(profile.apiKey.slice(-4))
    } else {
      setHasApiKey(false)
      setApiKeyLast4('')
    }
    if (extraFieldsForProfile?.setVoice && profile.voice) {
      extraFieldsForProfile.setVoice(profile.voice)
    }
  }

  const selectClassName = "mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-2.5 text-sm outline-none focus:border-[var(--accent)] cursor-pointer disabled:opacity-50"
  const inputClassName = "mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-2.5 text-sm outline-none focus:border-[var(--accent)] disabled:opacity-50"
  const cardClassName = "border border-[var(--border-soft)] bg-[var(--surface)] rounded-[var(--radius-lg)] p-4 space-y-3 mt-2 mb-4"

  return (
    <div className="p-5 rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--surface-warm)] space-y-4">
      <div>
        <h2 className="font-bold text-base text-[var(--accent)] border-b border-[var(--border-soft)] pb-2">
          {title}
        </h2>
        <p className="text-xs text-[var(--muted)] mt-1">{description}</p>
      </div>

      {/* Shortcut profiles list */}
      <div className={cardClassName}>
        <p className="font-bold text-xs text-[var(--muted)] uppercase tracking-wider flex items-center gap-1">
          <span>💾</span>
          <span>模型快捷切换列表</span>
        </p>

        {profiles.length === 0 ? (
          <p className="text-xs text-[var(--muted)] italic">暂无快捷模型配置，您可以在下方配置编辑区填写并保存。</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 max-h-52 overflow-y-auto pr-1">
            {profiles.map((profile) => {
              const isActive = (!provider || provider === profile.provider) &&
                (!showApiFields || (baseUrl === profile.baseUrl && model === profile.model))

              return (
                <div key={profile.id} className={`flex items-center justify-between border rounded-[var(--radius-md)] p-2.5 bg-[var(--surface-warm)] text-xs transition ${
                  isActive ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]' : 'border-[var(--border-soft)]'
                }`}>
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-bold truncate text-[var(--fg)]">{profile.name}</span>
                      {isActive && <span className="px-1.5 py-0.2 bg-[var(--accent)] text-[var(--accent-on)] text-[9px] font-extrabold rounded-full scale-90">当前</span>}
                    </div>
                    {profile.provider && (
                      <p className="text-[10px] text-[var(--muted)] truncate">
                        类型: {providerOptions?.find(o => o.value === profile.provider)?.label || profile.provider}
                      </p>
                    )}
                    {profile.model && <p className="text-[10px] text-[var(--muted)] truncate">Model: {profile.model}</p>}
                    {profile.baseUrl && <p className="text-[10px] text-[var(--muted)] truncate">URL: {profile.baseUrl}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <button
                      type="button"
                      onClick={() => handleApplyProfile(profile)}
                      className="px-2 py-1 rounded bg-[var(--accent)] text-[var(--accent-on)] font-semibold hover:opacity-90 active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                      disabled={saving}
                      title="载入此配置"
                    >
                      ⚡️ 载入
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteProfile(profile.id)}
                      className="px-2 py-1 rounded bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 font-semibold active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                      disabled={saving}
                      title="删除配置"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Active configuration inputs */}
      <div className="border border-[var(--border-soft)] bg-[var(--surface)] rounded-[var(--radius-lg)] p-4 space-y-3">
        <p className="font-bold text-xs text-[var(--muted)] uppercase tracking-wider">🛠️ 配置编辑区</p>
        
        {providerOptions && setProvider && (
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">{providerLabel}</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className={selectClassName}
              disabled={saving}
            >
              {providerOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        )}

        {customFields}

        {showApiFields ? (
          <div className="space-y-3 pt-2 border-t border-[var(--border-soft)] border-dashed">
            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">API Base URL (接口地址)</label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className={inputClassName}
                placeholder="例如: https://api.openai.com/v1"
                disabled={saving}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">API Key (密钥)</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className={inputClassName}
                placeholder={hasApiKey ? `已绑定 (以 ${apiKeyLast4} 结尾)` : "输入您的 API 密钥"}
                disabled={saving}
              />
              {hasApiKey && (
                <button
                  type="button"
                  onClick={onClearApiKey}
                  className="text-xs text-red-600 hover:underline mt-1 block border-none bg-transparent cursor-pointer font-semibold"
                  disabled={saving}
                >
                  清除已保存的 API Key
                </button>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Model Name (模型名称)</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className={inputClassName}
                placeholder="例如: gpt-4o-mini, deepseek-chat"
                disabled={saving}
              />
            </div>
          </div>
        ) : (
          helperText && (
            <div className="text-xs text-[var(--muted)] bg-[var(--surface-warm)] p-3 rounded-[var(--radius-md)] border border-[var(--border-soft)] mt-2">
              ℹ️ {helperText}
            </div>
          )
        )}

        {/* Save current config preset */}
        <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-[var(--border-soft)] border-dashed">
          <input
            type="text"
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            placeholder="将编辑好的配置命名别名 (如: My-Preset)"
            disabled={saving}
            className="flex-1 rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--fg)] outline-none focus:border-[var(--accent)] disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleAddProfile}
            disabled={saving}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[var(--radius-md)] font-bold text-xs active:scale-95 transition shadow-sm disabled:opacity-50 cursor-pointer"
          >
            ➕ 保存预设
          </button>
        </div>
      </div>
    </div>
  )
}
