import { existsSync, mkdirSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { createServer as createHttpServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

import {
  json,
  notFound,
  methodNotAllowed,
} from './lib/http.js'
import { parseJsonBody, stripThinking } from './lib/request.js'
import {
  hashPassword,
  verifyPassword,
  getAuthenticatedUser,
} from './lib/auth.js'
import { createResourceHandlers } from './lib/resources.js'
import { createDb } from './db.js'
import { createRouter } from './routes/router.js'
import { getEffectiveUserSettings } from './routes/settings.js'

// ═══════════════════════════════════════════════════════════════════════════
// Region: 顶层配置
// ═══════════════════════════════════════════════════════════════════════════

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '../../..')
const resourceDir = path.join(rootDir, 'resource')
const dbPath = path.join(resourceDir, 'db.sqlite')
const dictDbPath = path.join(resourceDir, 'ecdict.db')
const webDistDir = path.join(rootDir, 'apps', 'web', 'dist')

// 1. Ensure resource folder exists
mkdirSync(resourceDir, { recursive: true })

// 2. Initialize Databases
const db = createDb(dbPath)

let dictDb = null
try {
  if (existsSync(dictDbPath)) {
    dictDb = new DatabaseSync(dictDbPath)
    console.log('Successfully connected to local dictionary database ecdict.db')
  }
} catch (err) {
  console.error('Failed to connect to local dictionary database ecdict.db:', err)
}

// 3. Static MIME Types mapping
const staticContentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.mjs', 'application/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
])

const resourceTypes = new Map([
  ['lesson.mp3', 'audio/mpeg'],
  ['subtitle.srt', 'text/plain; charset=utf-8'],
  ['subtitle.zh.srt', 'text/plain; charset=utf-8'],
  ['subtitle.bilingual.srt', 'text/plain; charset=utf-8'],
])

function isLessonId(id) {
  return /^\d{4}$/.test(id)
}

// 4. Instantiate Static / Resource Handlers
const { resourcePathFor, sendResource, sendStatic } = createResourceHandlers({
  resourceDir,
  webDistDir,
  resourceTypes,
  staticContentTypes,
  isLessonId,
  notFound,
})

// 5. Utility: SRT Parser
function parseTime(value) {
  const match = value.match(/^(\d{2}):(\d{2}):(\d{2}),(\d{3})$/)
  if (!match) return 0
  const [, hours, minutes, seconds, millis] = match
  return (
    Number(hours) * 3600 +
    Number(minutes) * 60 +
    Number(seconds) +
    Number(millis) / 1000
  )
}

export function parseSrt(content) {
  return content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split(/\r?\n/)
      const id = lines.shift() ?? ''
      const timing = lines.shift() ?? ''
      const [startRaw, endRaw] = timing.split(/\s+-->\s+/)

      return {
        id,
        start: parseTime(startRaw ?? ''),
        end: parseTime(endRaw ?? ''),
        text: lines.join('\n').trim(),
      }
    })
}

// 6. Setup Router Dispatcher
const dispatch = createRouter({
  db,
  dictDb,
  resourceDir,
  rootDir,
  getEffectiveUserSettings,
  getAuthenticatedUser,
  json,
  notFound,
  parseJsonBody,
  stripThinking,
  hashPassword,
  verifyPassword,
  resourcePathFor,
})

// 7. Router Resolver
async function route(req, res) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const parts = url.pathname.split('/').filter(Boolean)

  const origin = req.headers.origin || '*'
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // A. Hand off to domains router
  const handled = await dispatch(req, res, url)
  if (handled) return

  // B. Serve Subtitles parsed JSON
  // GET /api/courses/:courseId/lessons/:lessonId/subtitles?mode=bilingual
  if (
    req.method === 'GET' &&
    parts[0] === 'api' &&
    parts[1] === 'courses' &&
    parts[3] === 'lessons' &&
    parts[5] === 'subtitles' &&
    parts.length === 6
  ) {
    const lessonId = parts[4]
    const mode = url.searchParams.get('mode') ?? 'bilingual'
    const subtitleModeFiles = new Map([
      ['en', 'subtitle.srt'],
      ['zh', 'subtitle.zh.srt'],
      ['bilingual', 'subtitle.bilingual.srt'],
      ['off', 'subtitle.bilingual.srt'],
    ])
    const subtitleFile = subtitleModeFiles.get(mode) || 'subtitle.bilingual.srt'
    const fullPath = resourcePathFor(lessonId, subtitleFile)
    if (!fullPath || !existsSync(fullPath)) {
      notFound(res)
      return
    }

    try {
      const content = await readFile(fullPath, 'utf8')
      const cues = parseSrt(content)
      if (mode === 'off') {
        cues.forEach(cue => {
          cue.text = ''
        })
      }
      json(res, 200, cues)
    } catch (err) {
      console.error('Failed to read subtitles:', err)
      notFound(res)
    }
    return
  }

  // C. Serve Lesson details object
  // GET /api/courses/:courseId/lessons/:lessonId
  if (
    req.method === 'GET' &&
    parts[0] === 'api' &&
    parts[1] === 'courses' &&
    parts[3] === 'lessons' &&
    parts.length === 5
  ) {
    const lessonId = parts[4]
    try {
      const dbLesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(lessonId)
      if (dbLesson) {
        let subtitles = { en: 'subtitle.srt', zh: 'subtitle.zh.srt', bilingual: 'subtitle.bilingual.srt' }
        try {
          if (dbLesson.subtitlesJson) {
            subtitles = JSON.parse(dbLesson.subtitlesJson)
          }
        } catch {}

        json(res, 200, {
          id: dbLesson.id,
          number: dbLesson.id,
          seq: 9000 + Number(dbLesson.id.replace(/\D/g, '') || '0'),
          title: dbLesson.title,
          displayTitle: dbLesson.title,
          level: dbLesson.level,
          levelCode: 'C',
          category: '我的拍照课程',
          group: '我的拍照课程',
          section: 'category',
          resourceDir: dbLesson.id,
          resources: {
            dialog: null,
            lesson: 'lesson.mp3',
            review: null,
            worksheet: null,
            host: null,
            subtitle: subtitles.bilingual || 'subtitle.bilingual.srt',
            transcript: null
          },
          availability: {
            dialog: false,
            lesson: true,
            review: false,
            worksheet: false,
            host: false,
            subtitle: true,
            transcript: false
          },
          courseId: dbLesson.courseId
        })
      } else {
        notFound(res)
      }
    } catch (err) {
      console.error('Failed to get lesson details:', err)
      notFound(res)
    }
    return
  }

  // D. Serve Lesson raw resources (audios/subtitles)
  // GET /api/resources/:lessonId/:fileName
  if (
    req.method === 'GET' &&
    parts[0] === 'api' &&
    parts[1] === 'resources' &&
    parts.length === 4
  ) {
    await sendResource(req, res, parts[2], parts[3])
    return
  }

  // E. Serve static production web pages
  if (parts[0] !== 'api') {
    const served = await sendStatic(req, res, url.pathname)
    if (served) return
  }

  notFound(res)
}

// 8. Server Factory Bootloader
export function createServer() {
  return createHttpServer((req, res) => {
    route(req, res).catch((err) => {
      const status = err && Number.isFinite(err.status) ? err.status : 500
      if (!res.headersSent) {
        json(res, status, { error: status === 413 ? '请求体过大' : 'Internal server error' })
      }
    })
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 4173)
  createServer().listen(port, () => {
    console.log(`SnapLesson API listening on http://localhost:${port}`)
  })
}
