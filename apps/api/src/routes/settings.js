// settings 域路由：全局 AI 设置（仅 admin 角色可读写，普通用户由后端自动共享）。

function maskModelsJson(modelsJson) {
  try {
    const parsed = JSON.parse(modelsJson || '[]')
    if (!Array.isArray(parsed)) return '[]'
    return JSON.stringify(parsed.map(profile => {
      if (!profile || typeof profile !== 'object') return null
      return {
        ...profile,
        apiKey: profile.apiKey ? '******' : ''
      }
    }).filter(Boolean))
  } catch {
    return '[]'
  }
}

export function getEffectiveUserSettings(db) {
  // Find the first admin user
  const adminRow = db.prepare("SELECT username FROM users WHERE role = 'admin' LIMIT 1").get()
  const adminUsername = adminRow ? adminRow.username : null

  let setting = null
  if (adminUsername) {
    setting = db.prepare('SELECT * FROM user_settings WHERE username = ?').get(adminUsername)
  }

  // Fallback default settings
  const defaults = {
    openai_base_url: 'https://api.openai.com/v1',
    openai_model: 'gpt-4o-mini',
    openai_api_key: '',
    tts_provider: 'edge',
    tts_voice: 'en-US-EmmaNeural',
    tts_base_url: 'https://maas-api.unisound.com/v1',
    tts_api_key: '',
    tts_model: 'u2-tts',
    ocr_provider: 'unisound',
    ocr_base_url: 'https://maas-api.unisound.com/v1',
    ocr_api_key: '',
    ocr_model: 'u1-ocr',
    llm_models_json: '[]',
    tts_models_json: '[]',
    ocr_models_json: '[]'
  }

  if (!setting) {
    return defaults
  }

  return {
    ...defaults,
    ...setting
  }
}

export async function handleSettingsRoutes(req, res, url, ctx) {
  if (url.pathname !== '/api/settings' && url.pathname !== '/api/settings/public' && url.pathname !== '/api/user/settings') return false

  const { db, getAuthenticatedUser, parseJsonBody, json } = ctx

  if (url.pathname === '/api/settings/public' && req.method === 'GET') {
    const user = await getAuthenticatedUser(req, db)
    if (!user) {
      json(res, 401, { error: '未登录' })
      return true
    }
    try {
      const setting = getEffectiveUserSettings(db)
      json(res, 200, {
        tts_provider: setting.tts_provider || 'edge',
        ocr_provider: setting.ocr_provider || 'unisound',
        openai_model: setting.openai_model || 'gpt-4o-mini',
        llm_models_json: maskModelsJson(setting.llm_models_json),
        tts_models_json: maskModelsJson(setting.tts_models_json),
        ocr_models_json: maskModelsJson(setting.ocr_models_json)
      })
    } catch (err) {
      json(res, 500, { error: '获取公共配置失败' })
    }
    return true
  }

  const user = await getAuthenticatedUser(req, db)
  if (!user) {
    json(res, 401, { error: '未登录' })
    return true
  }

  // Only admin can read/write Settings page configuration
  if (user.role !== 'admin') {
    json(res, 403, { error: '只有管理员能读写配置' })
    return true
  }

  // GET: 读取管理员自己的配置并脱敏
  if (req.method === 'GET') {
    try {
      let setting = db.prepare('SELECT * FROM user_settings WHERE username = ?').get(user.username)
      if (!setting) {
        // Pre-create row for admin
        db.prepare('INSERT OR IGNORE INTO user_settings (username) VALUES (?)').run(user.username)
        setting = db.prepare('SELECT * FROM user_settings WHERE username = ?').get(user.username) || {}
      }

      json(res, 200, {
        openai_base_url: setting.openai_base_url || '',
        openai_model: setting.openai_model || '',
        hasApiKey: !!setting.openai_api_key,
        apiKeyLast4: setting.openai_api_key ? setting.openai_api_key.slice(-4) : '',
        tts_provider: setting.tts_provider || 'edge',
        tts_voice: setting.tts_voice || 'en-US-EmmaNeural',
        tts_base_url: setting.tts_base_url || '',
        tts_model: setting.tts_model || '',
        hasTtsApiKey: !!setting.tts_api_key,
        ttsApiKeyLast4: setting.tts_api_key ? setting.tts_api_key.slice(-4) : '',
        ocr_provider: setting.ocr_provider || 'mimo',
        ocr_base_url: setting.ocr_base_url || '',
        ocr_model: setting.ocr_model || '',
        hasOcrApiKey: !!setting.ocr_api_key,
        ocrApiKeyLast4: setting.ocr_api_key ? setting.ocr_api_key.slice(-4) : '',
        llm_models_json: maskModelsJson(setting.llm_models_json),
        tts_models_json: maskModelsJson(setting.tts_models_json),
        ocr_models_json: maskModelsJson(setting.ocr_models_json)
      })
    } catch (err) {
      console.error(err)
      json(res, 500, { error: '获取 AI 设置失败' })
    }
    return true
  }

  // POST: 部分更新配置
  if (req.method === 'POST') {
    try {
      const payload = await parseJsonBody(req)

      let existing = db.prepare('SELECT * FROM user_settings WHERE username = ?').get(user.username)
      if (!existing) {
        db.prepare('INSERT OR IGNORE INTO user_settings (username) VALUES (?)').run(user.username)
        existing = db.prepare('SELECT * FROM user_settings WHERE username = ?').get(user.username) || {}
      }

      const openai_base_url = payload.openai_base_url !== undefined ? payload.openai_base_url : existing.openai_base_url
      const openai_model = payload.openai_model !== undefined ? payload.openai_model : existing.openai_model
      
      let openai_api_key = existing.openai_api_key
      if (payload.openai_api_key === '__CLEAR__') {
        openai_api_key = ''
      } else if (payload.openai_api_key && payload.openai_api_key !== '******') {
        openai_api_key = payload.openai_api_key
      } else if (payload.openai_api_key === '******') {
        try {
          const presets = JSON.parse(existing.llm_models_json || '[]')
          const matched = presets.find(p => p.baseUrl === openai_base_url && p.model === openai_model)
          if (matched && matched.apiKey && matched.apiKey !== '******') {
            openai_api_key = matched.apiKey
          }
        } catch (e) {
          console.error('Failed to resolve active LLM API key from presets:', e)
        }
      }

      const tts_provider = payload.tts_provider !== undefined ? payload.tts_provider : existing.tts_provider
      const tts_voice = payload.tts_voice !== undefined ? payload.tts_voice : existing.tts_voice
      const tts_base_url = payload.tts_base_url !== undefined ? payload.tts_base_url : existing.tts_base_url
      const tts_model = payload.tts_model !== undefined ? payload.tts_model : existing.tts_model

      let tts_api_key = existing.tts_api_key
      if (payload.tts_api_key === '__CLEAR__') {
        tts_api_key = ''
      } else if (payload.tts_api_key && payload.tts_api_key !== '******') {
        tts_api_key = payload.tts_api_key
      } else if (payload.tts_api_key === '******') {
        try {
          const presets = JSON.parse(existing.tts_models_json || '[]')
          const matched = presets.find(p => p.provider === tts_provider && p.baseUrl === tts_base_url && p.model === tts_model)
          if (matched && matched.apiKey && matched.apiKey !== '******') {
            tts_api_key = matched.apiKey
          }
        } catch (e) {
          console.error('Failed to resolve active TTS API key from presets:', e)
        }
      }

      const ocr_provider = payload.ocr_provider !== undefined ? payload.ocr_provider : existing.ocr_provider
      const ocr_base_url = payload.ocr_base_url !== undefined ? payload.ocr_base_url : existing.ocr_base_url
      const ocr_model = payload.ocr_model !== undefined ? payload.ocr_model : existing.ocr_model

      let ocr_api_key = existing.ocr_api_key
      if (payload.ocr_api_key === '__CLEAR__') {
        ocr_api_key = ''
      } else if (payload.ocr_api_key && payload.ocr_api_key !== '******') {
        ocr_api_key = payload.ocr_api_key
      } else if (payload.ocr_api_key === '******') {
        try {
          const presets = JSON.parse(existing.ocr_models_json || '[]')
          const matched = presets.find(p => p.provider === ocr_provider && p.baseUrl === ocr_base_url && p.model === ocr_model)
          if (matched && matched.apiKey && matched.apiKey !== '******') {
            ocr_api_key = matched.apiKey
          }
        } catch (e) {
          console.error('Failed to resolve active OCR API key from presets:', e)
        }
      }

      const llmModelsJson = payload.llm_models_json !== undefined ? payload.llm_models_json : null
      let updatedLlmModels = existing.llm_models_json || '[]'
      if (llmModelsJson !== null) {
        try {
          const parsed = JSON.parse(llmModelsJson)
          if (Array.isArray(parsed)) {
            const resolved = parsed.map(p => {
              if (p && typeof p === 'object') {
                let pKey = p.apiKey
                if (pKey === '******') {
                  try {
                    const oldList = JSON.parse(existing.llm_models_json || '[]')
                    const found = oldList.find(x => x.id === p.id)
                    if (found) pKey = found.apiKey
                  } catch {}
                  if (pKey === '******' || !pKey) pKey = openai_api_key
                }
                return {
                  id: p.id || String(Date.now() + Math.random()),
                  name: p.name || 'Unnamed',
                  baseUrl: p.baseUrl || '',
                  apiKey: pKey || '',
                  model: p.model || ''
                }
              }
              return null
            }).filter(Boolean)
            updatedLlmModels = JSON.stringify(resolved)
          }
        } catch (e) {
          console.error('Failed to parse llm_models_json:', e)
        }
      }

      const ttsModelsJson = payload.tts_models_json !== undefined ? payload.tts_models_json : null
      let updatedTtsModels = existing.tts_models_json || '[]'
      if (ttsModelsJson !== null) {
        try {
          const parsed = JSON.parse(ttsModelsJson)
          if (Array.isArray(parsed)) {
            const resolved = parsed.map(p => {
              if (p && typeof p === 'object') {
                let pKey = p.apiKey
                if (pKey === '******') {
                  try {
                    const oldList = JSON.parse(existing.tts_models_json || '[]')
                    const found = oldList.find(x => x.id === p.id)
                    if (found) pKey = found.apiKey
                  } catch {}
                  if (pKey === '******' || !pKey) pKey = tts_api_key
                }
                return {
                  id: p.id || String(Date.now() + Math.random()),
                  name: p.name || 'Unnamed',
                  provider: p.provider || 'edge',
                  baseUrl: p.baseUrl || '',
                  apiKey: pKey || '',
                  model: p.model || '',
                  voice: p.voice || ''
                }
              }
              return null
            }).filter(Boolean)
            updatedTtsModels = JSON.stringify(resolved)
          }
        } catch (e) {
          console.error('Failed to parse tts_models_json:', e)
        }
      }

      const ocrModelsJson = payload.ocr_models_json !== undefined ? payload.ocr_models_json : null
      let updatedOcrModels = existing.ocr_models_json || '[]'
      if (ocrModelsJson !== null) {
        try {
          const parsed = JSON.parse(ocrModelsJson)
          if (Array.isArray(parsed)) {
            const resolved = parsed.map(p => {
              if (p && typeof p === 'object') {
                let pKey = p.apiKey
                if (pKey === '******') {
                  try {
                    const oldList = JSON.parse(existing.ocr_models_json || '[]')
                    const found = oldList.find(x => x.id === p.id)
                    if (found) pKey = found.apiKey
                  } catch {}
                  if (pKey === '******' || !pKey) pKey = ocr_api_key
                }
                return {
                  id: p.id || String(Date.now() + Math.random()),
                  name: p.name || 'Unnamed',
                  provider: p.provider || 'unisound',
                  baseUrl: p.baseUrl || '',
                  apiKey: pKey || '',
                  model: p.model || ''
                }
              }
              return null
            }).filter(Boolean)
            updatedOcrModels = JSON.stringify(resolved)
          }
        } catch (e) {
          console.error('Failed to parse ocr_models_json:', e)
        }
      }

      db.prepare(`
        UPDATE user_settings
        SET openai_base_url = ?, openai_model = ?, openai_api_key = ?,
            tts_provider = ?, tts_voice = ?, tts_base_url = ?, tts_model = ?, tts_api_key = ?,
            ocr_provider = ?, ocr_base_url = ?, ocr_model = ?, ocr_api_key = ?,
            llm_models_json = ?, tts_models_json = ?, ocr_models_json = ?
        WHERE username = ?
      `).run(
        openai_base_url, openai_model, openai_api_key,
        tts_provider, tts_voice, tts_base_url, tts_model, tts_api_key,
        ocr_provider, ocr_base_url, ocr_model, ocr_api_key,
        updatedLlmModels, updatedTtsModels, updatedOcrModels,
        user.username
      )

      json(res, 200, { ok: true })
    } catch (err) {
      console.error(err)
      json(res, 500, { error: '更新设置失败' })
    }
    return true
  }

  return false
}
