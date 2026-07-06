// settings 域路由：全局 AI 设置（仅 admin 角色可读写，普通用户由后端自动共享）。

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
    ocr_model: 'u1-ocr'
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

  // Handle public route first (for any authenticated user)
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
        openai_model: setting.openai_model || 'gpt-4o-mini'
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
      }

      const ocr_provider = payload.ocr_provider !== undefined ? payload.ocr_provider : existing.ocr_provider
      const ocr_base_url = payload.ocr_base_url !== undefined ? payload.ocr_base_url : existing.ocr_base_url
      const ocr_model = payload.ocr_model !== undefined ? payload.ocr_model : existing.ocr_model

      let ocr_api_key = existing.ocr_api_key
      if (payload.ocr_api_key === '__CLEAR__') {
        ocr_api_key = ''
      } else if (payload.ocr_api_key && payload.ocr_api_key !== '******') {
        ocr_api_key = payload.ocr_api_key
      }

      db.prepare(`
        UPDATE user_settings
        SET openai_base_url = ?, openai_model = ?, openai_api_key = ?,
            tts_provider = ?, tts_voice = ?, tts_base_url = ?, tts_model = ?, tts_api_key = ?,
            ocr_provider = ?, ocr_base_url = ?, ocr_model = ?, ocr_api_key = ?
        WHERE username = ?
      `).run(
        openai_base_url, openai_model, openai_api_key,
        tts_provider, tts_voice, tts_base_url, tts_model, tts_api_key,
        ocr_provider, ocr_base_url, ocr_model, ocr_api_key,
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
