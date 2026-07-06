// vocab 域路由：生词收藏、例句收藏与有道词典在线查询

const disableOnlineDict = process.env.ENGLISHPOD_DISABLE_ONLINE_DICT === '1'

function stripWord(w) {
  if (typeof w !== 'string') return ''
  return w.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, '').trim()
}

async function lookupDictionary(inputWord, dictDb) {
  const word = decodeURIComponent(inputWord).trim()
  if (!word) return { found: false, word: '' }

  const normalizedWord = word.toLowerCase()
  const strippedWord = stripWord(word)

  // 1. Fetch online Youdao to get detailed translations and pronunciation
  if (!disableOnlineDict) {
    try {
      const response = await fetch(`https://dict.youdao.com/jsonapi?q=${encodeURIComponent(word)}`)
      if (response.ok) {
        const data = await response.json()
        
        const simpleWord = data?.simple?.word?.[0]
        const ecWord = data?.ec?.word?.[0]
        
        let translation = ecWord?.trs?.map(tr => tr?.tr?.[0]?.l?.i?.[0]).filter(Boolean).join('\n') || ''
        if (!translation && data?.web_trans?.web_translation?.[0]?.trans?.[0]?.value) {
          translation = data.web_trans.web_translation[0].trans[0].value
        }
        
        if (translation || simpleWord) {
          return {
            found: true,
            query: word,
            matched: simpleWord?.word || word,
            word: simpleWord?.word || word,
            phonetic: simpleWord?.usphone || simpleWord?.ukphone || '',
            usphone: simpleWord?.usphone || '',
            ukphone: simpleWord?.ukphone || '',
            pos: ecWord?.trs?.[0]?.pos || '',
            translation: translation.replace(/\\n/g, '\n'),
          }
        }
      }
    } catch (error) {
      console.error('Online dictionary lookup failed:', error)
    }
  }

  // 2. Fallback to local SQLite database ecdict.db (if available)
  if (dictDb) {
    try {
      const candidates = [normalizedWord, strippedWord].filter(Boolean)
      for (const candidate of candidates) {
        const row = dictDb.prepare('SELECT word, phonetic, translation, pos FROM stardict WHERE sw = ? OR word = ? LIMIT 1')
          .get(candidate, candidate)
        
        if (row) {
          return {
            found: true,
            query: word,
            matched: row.word,
            word: row.word,
            phonetic: row.phonetic || '',
            pos: row.pos || '',
            translation: row.translation || '',
          }
        }
      }
    } catch (err) {
      console.error('Local dictDb lookup failed:', err)
    }
  }

  return { found: false, word }
}

export async function handleVocabRoutes(req, res, url, ctx) {
  const { method } = req
  const pathname = url.pathname
  const { db, dictDb, getAuthenticatedUser, parseJsonBody, json } = ctx

  if (
    pathname !== '/api/dict/lookup' &&
    !pathname.startsWith('/api/user/vocab') &&
    !pathname.startsWith('/api/user/reviews')
  ) {
    return false
  }

  // 1. GET /api/dict/lookup?word=:word
  if (pathname === '/api/dict/lookup' && method === 'GET') {
    const wordParam = url.searchParams.get('word')
    if (!wordParam) {
      json(res, 400, { error: '缺少查询单词参数 word' })
      return true
    }

    try {
      const result = await lookupDictionary(wordParam, dictDb)
      json(res, 200, result)
    } catch (err) {
      json(res, 500, { error: '查询单词失败' })
    }
    return true
  }

  // Ensure logged in for subsequent vocab/reviews endpoints
  const user = await getAuthenticatedUser(req, db)
  if (!user) {
    json(res, 401, { error: '未登录' })
    return true
  }

  // 2. GET /api/user/vocab - list bookmarked words
  if (pathname === '/api/user/vocab' && method === 'GET') {
    try {
      const rows = db.prepare('SELECT * FROM vocab WHERE username = ? ORDER BY createdAt DESC').all(user.username)
      json(res, 200, rows)
    } catch (err) {
      json(res, 500, { error: '获取生词表失败' })
    }
    return true
  }

  // 3. POST /api/user/vocab - add word bookmark
  if (pathname === '/api/user/vocab' && method === 'POST') {
    try {
      const { word, phonetic, translation } = await parseJsonBody(req)
      if (!word || !word.trim()) {
        json(res, 400, { error: '单词不能为空' })
        return true
      }

      const cleanWord = word.trim()
      // Check if already bookmarked
      const existing = db.prepare('SELECT id FROM vocab WHERE username = ? AND word = ?').get(user.username, cleanWord)
      if (existing) {
        json(res, 200, { ok: true, id: existing.id })
        return true
      }

      const id = crypto.randomUUID()
      db.prepare(`
        INSERT INTO vocab (username, id, word, phonetic, translation, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(user.username, id, cleanWord, phonetic || '', translation || '', Date.now())

      json(res, 200, { ok: true, id })
    } catch (err) {
      json(res, 500, { error: '添加生词失败' })
    }
    return true
  }

  // 4. DELETE /api/user/vocab/:id - remove word bookmark (or POST with delete method)
  if (pathname.startsWith('/api/user/vocab/') && (method === 'DELETE' || method === 'POST')) {
    const id = pathname.substring('/api/user/vocab/'.length)
    if (!id) {
      json(res, 400, { error: '未提供生词 ID' })
      return true
    }

    try {
      db.prepare('DELETE FROM vocab WHERE username = ? AND id = ?').run(user.username, id)
      json(res, 200, { ok: true })
    } catch (err) {
      json(res, 500, { error: '删除生词失败' })
    }
    return true
  }

  // 5. GET /api/user/reviews - list bookmarked sentences
  if (pathname === '/api/user/reviews' && method === 'GET') {
    try {
      const rows = db.prepare('SELECT * FROM reviews WHERE username = ? ORDER BY createdAt DESC').all(user.username)
      json(res, 200, rows)
    } catch (err) {
      json(res, 500, { error: '获取例句失败' })
    }
    return true
  }

  // 6. POST /api/user/reviews - add sentence bookmark
  if (pathname === '/api/user/reviews' && method === 'POST') {
    try {
      const { text, translation, lessonId, audioStart, audioEnd } = await parseJsonBody(req)
      if (!text || !text.trim()) {
        json(res, 400, { error: '例句内容不能为空' })
        return true
      }

      const cleanText = text.trim()
      // Check if already bookmarked
      const existing = db.prepare('SELECT id FROM reviews WHERE username = ? AND text = ?').get(user.username, cleanText)
      if (existing) {
        json(res, 200, { ok: true, id: existing.id })
        return true
      }

      const id = crypto.randomUUID()
      db.prepare(`
        INSERT INTO reviews (username, id, text, translation, lessonId, audioStart, audioEnd, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(user.username, id, cleanText, translation || '', lessonId || '', audioStart || 0, audioEnd || 0, Date.now())

      json(res, 200, { ok: true, id })
    } catch (err) {
      json(res, 500, { error: '添加例句失败' })
    }
    return true
  }

  // 7. DELETE /api/user/reviews/:id - remove sentence bookmark (or POST with delete method)
  if (pathname.startsWith('/api/user/reviews/') && (method === 'DELETE' || method === 'POST')) {
    const id = pathname.substring('/api/user/reviews/'.length)
    if (!id) {
      json(res, 400, { error: '未提供例句 ID' })
      return true
    }

    try {
      db.prepare('DELETE FROM reviews WHERE username = ? AND id = ?').run(user.username, id)
      json(res, 200, { ok: true })
    } catch (err) {
      json(res, 500, { error: '删除例句失败' })
    }
    return true
  }

  return false
}
