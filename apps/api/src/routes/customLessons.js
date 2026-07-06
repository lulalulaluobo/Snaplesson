import { existsSync, mkdirSync, unlinkSync, rmSync } from 'node:fs'
import { writeFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { getEffectiveUserSettings } from './settings.js'
import { synthesizeText } from '../engines/tts.js'

// 云知声 OCR 仅支持 JPG/JPEG/PNG/BMP
function ensureUnisoundImage(buffer) {
  const b = buffer
  const isPNG  = b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47
  const isJPEG = b.length >= 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF
  const isBMP  = b.length >= 2 && b[0] === 0x42 && b[1] === 0x4D
  if (isPNG)  return { buffer, mime: 'image/png' }
  if (isJPEG) return { buffer, mime: 'image/jpeg' }
  if (isBMP)  return { buffer, mime: 'image/bmp' }

  // 其它格式用 ffmpeg 转 PNG
  const ffmpegPath = existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg'
  const result = spawnSync(ffmpegPath, [
    '-i', 'pipe:0',
    '-f', 'image2',
    '-vcodec', 'png',
    'pipe:1'
  ], { input: buffer, maxBuffer: 20 * 1024 * 1024 })

  if (result.status !== 0 || !result.stdout?.length) {
    const stderr = result.stderr?.toString() || ''
    throw new Error(`图片格式不支持且转换失败。${stderr.slice(0, 200)}`)
  }
  return { buffer: result.stdout, mime: 'image/png' }
}

function getAudioDuration(filepath) {
  const ffprobePath = existsSync('/opt/homebrew/bin/ffprobe') ? '/opt/homebrew/bin/ffprobe' : 'ffprobe'
  const result = spawnSync(ffprobePath, [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filepath
  ], { encoding: 'utf8' })
  
  if (result.status === 0) {
    const dur = parseFloat(result.stdout.trim())
    if (!isNaN(dur)) return dur
  }
  console.error('ffprobe failed for file:', filepath, result.stderr)
  return 0
}

function formatSrtTime(seconds) {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  
  const pad = (num, len) => String(num).padStart(len, '0')
  return `${pad(hrs, 2)}:${pad(mins, 2)}:${pad(secs, 2)},${pad(ms, 3)}`
}

function generateSrtContent(cues, type) {
  return cues.map((cue, idx) => {
    let text = ''
    if (type === 'en') {
      text = cue.english
    } else if (type === 'zh') {
      text = cue.chinese
    } else {
      text = `${cue.english}\n${cue.chinese}`
    }
    
    return `${idx + 1}\n${formatSrtTime(cue.start)} --> ${formatSrtTime(cue.end)}\n${text}\n`
  }).join('\n')
}

export async function handleCustomLessonsRoutes(req, res, url, ctx) {
  const { method } = req
  const pathname = url.pathname
  const { db, getAuthenticatedUser, parseJsonBody, json, stripThinking, resourceDir } = ctx

  // 1. POST /api/custom-lessons/ocr
  if (pathname === '/api/custom-lessons/ocr' && method === 'POST') {
    const user = await getAuthenticatedUser(req, db)
    if (!user) {
      json(res, 401, { error: '未登录' })
      return true
    }

    try {
      const { imageBase64 } = await parseJsonBody(req)
      if (!imageBase64) {
        json(res, 400, { error: '未上传图片数据' })
        return true
      }

      const setting = getEffectiveUserSettings(db)
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '')
      const ocrProvider = setting.ocr_provider || 'mimo'
      const activeBaseUrl = setting.ocr_base_url || ''
      const activeApiKey = setting.ocr_api_key || ''
      const activeModel = setting.ocr_model || ''

      let recognizedText = ''

      if (ocrProvider === 'unisound') {
        if (!activeApiKey) {
          json(res, 400, { error: '管理员未配置云知声 OCR API Key' })
          return true
        }

        const base = activeBaseUrl.trim().replace(/\/+$/, '') || 'https://maas-api.unisound.com/v1'
        const endpoint = `${base}/ocr/image/extract`

        const formData = new FormData()
        formData.append('model', activeModel || 'u1-ocr')
        formData.append('prompt', '请仔细提取并识别这张图片中的所有英文文字。只输出识别出的英文文本，不要带有多余的解释、Markdown 代码块标记或寒暄，也不要加入前后标点符号。')

        const rawBuffer = Buffer.from(cleanBase64, 'base64')
        const { buffer: imageBuffer, mime } = ensureUnisoundImage(rawBuffer)
        const ext = mime === 'image/png' ? 'png' : mime === 'image/bmp' ? 'bmp' : 'jpg'
        const blob = new Blob([imageBuffer], { type: mime })
        formData.append('image', blob, `image.${ext}`)

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${activeApiKey}`
          },
          body: formData
        })

        if (!response.ok) {
          const errText = await response.text()
          throw new Error(`云知声 OCR 识别失败: ${response.status} - ${errText}`)
        }

        const resData = await response.json()
        recognizedText = resData.content?.trim() || ''
      } else if (ocrProvider === 'zhipu') {
        if (!activeApiKey) {
          json(res, 400, { error: '管理员未配置智谱 API Key' })
          return true
        }

        let rawUrl = activeBaseUrl || 'https://open.bigmodel.cn/api/paas/v4'
        const base = rawUrl.trim().replace(/\/+$/, '')
        const endpoint = base.includes('/chat/completions') ? base : `${base}/chat/completions`

        const payload = {
          model: activeModel || 'glm-5v-turbo',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: '请仔细提取并识别这张图片中的所有英文文字。只输出识别出的英文文本，不要带有多余的解释、Markdown 代码块标记或翻译。'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/png;base64,${cleanBase64}`
                  }
                }
              ]
            }
          ]
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${activeApiKey}`
          },
          body: JSON.stringify(payload)
        })

        if (!response.ok) {
          const errText = await response.text()
          throw new Error(`智谱 GLM OCR 识别失败: ${response.status} - ${errText}`)
        }

        const resData = await response.json()
        recognizedText = resData.choices?.[0]?.message?.content?.trim() || ''
      } else {
        // default to mimo
        if (!activeApiKey) {
          json(res, 400, { error: '管理员未配置小米 MIMO API Key' })
          return true
        }

        const mimoUrl = activeBaseUrl.trim().replace(/\/+$/, '') || 'https://api.xiaomimimo.com'
        const endpoint = mimoUrl.includes('/chat/completions') ? mimoUrl : `${mimoUrl}/v1/chat/completions`

        const payload = {
          model: activeModel || 'mimo-v2.5',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: '请仔细提取并识别这张图片中的所有英文文字。只输出识别出的英文文本，不要带有多余的解释、Markdown 代码块标记或翻译。'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/png;base64,${cleanBase64}`
                  }
                }
              ]
            }
          ]
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${activeApiKey}`
          },
          body: JSON.stringify(payload)
        })

        if (!response.ok) {
          const errText = await response.text()
          throw new Error(`MIMO OCR 识别失败: ${response.status} - ${errText}`)
        }

        const resData = await response.json()
        recognizedText = resData.choices?.[0]?.message?.content?.trim() || ''
      }

      recognizedText = stripThinking(recognizedText)
        .replace(/^```(?:text|json)?\n?/, '')
        .replace(/\n?```$/, '')
        .trim()

      json(res, 200, { text: recognizedText })
    } catch (err) {
      console.error('OCR failed:', err)
      json(res, 500, { error: err instanceof Error ? err.message : '图片文字识别失败' })
    }
    return true
  }

  // 2. POST /api/courses/:courseId/lessons
  const parts = pathname.split('/')
  if (parts[1] === 'api' && parts[2] === 'courses' && parts[4] === 'lessons' && parts.length === 5 && method === 'POST') {
    const user = await getAuthenticatedUser(req, db)
    if (!user) {
      json(res, 401, { error: '未登录' })
      return true
    }

    const courseId = parts[3]
    let newLessonDir = undefined
    let lessonPersisted = false

    try {
      const { title, text, level } = await parseJsonBody(req)
      if (!title || !title.trim() || !text || !text.trim()) {
        json(res, 400, { error: '标题与课文内容不能为空' })
        return true
      }

      const setting = getEffectiveUserSettings(db)
      if (!setting || !setting.openai_api_key) {
        json(res, 400, { error: '管理员尚未配置 AI 大模型密钥，请联系管理员配置。' })
        return true
      }

      // Generate a unique numeric ID for the lesson
      const lastLesson = db.prepare("SELECT id FROM lessons WHERE id >= '9000' AND id <= '9999' ORDER BY id DESC LIMIT 1").get()
      let nextId = '9001'
      if (lastLesson) {
        const numeric = parseInt(lastLesson.id, 10)
        nextId = String(numeric + 1)
      }

      newLessonDir = path.join(resourceDir, nextId)
      mkdirSync(newLessonDir, { recursive: true })

      const prompt = `你是一个翻译助手。请将以下英文文本翻译为中文，并将其划分为独立的句子。
必须输出为一个合法的 JSON 数组，数组中的每一项代表一个独立的句子。
每一项的 JSON 结构如下，包含 "english" 和 "chinese" 字段：
{
  "english": "Sentence in English",
  "chinese": "对应的中文翻译"
}

请不要添加任何多余的代码块标记（如 \`\`\`json）、任何前导/后置说明文字，只需返回最外层为 JSON 数组的原始 JSON 文本。

待翻译英文文本：
"${text.replace(/"/g, '\\"')}"`

      const baseUrl = setting.openai_base_url.trim().replace(/\/+$/, '')
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${setting.openai_api_key}`
        },
        body: JSON.stringify({
          model: setting.openai_model,
          messages: [
            { role: 'system', content: 'You are a strict JSON generator. Only return a raw JSON array.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2
        })
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`LLM translation failed: ${errText}`)
      }

      const resData = await response.json()
      let content = resData.choices?.[0]?.message?.content?.trim() || ''
      content = stripThinking(content)
      if (content.startsWith('```')) {
        content = content.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '')
      }

      const sentencePairs = JSON.parse(content)
      if (!Array.isArray(sentencePairs) || sentencePairs.length === 0) {
        throw new Error('LLM did not return a valid sentence array')
      }

      const tempFiles = []
      const cues = []
      let currentOffset = 0.0

      // Step A: Sequential TTS audio generation with automatic retries
      for (let i = 0; i < sentencePairs.length; i++) {
        const pair = sentencePairs[i]
        const eng = pair.english.trim()
        const chi = pair.chinese.trim()
        if (!eng) continue

        let audioBuffer = null
        let attempts = 3
        while (attempts > 0) {
          try {
            audioBuffer = await synthesizeText(eng, setting.tts_voice, setting)
            if (audioBuffer && audioBuffer.length > 0) {
              break // Success!
            }
          } catch (ttsErr) {
            console.warn(`TTS attempt failed for "${eng}". Attempts remaining: ${attempts - 1}`, ttsErr)
          }
          attempts--
          if (attempts > 0) {
            await new Promise(resolve => setTimeout(resolve, 200))
          }
        }

        if (!audioBuffer || audioBuffer.length === 0) {
          throw new Error(`语音合成服务不可用，合成第 ${i + 1} 句英文失败: "${eng}"`)
        }

        const partFileName = `part_${i}.mp3`
        const partPath = path.join(newLessonDir, partFileName)
        await writeFile(partPath, audioBuffer)
        tempFiles.push(partPath)
      }

      // Step B: Post-Synthesis Validation & Verification Check
      for (let i = 0; i < tempFiles.length; i++) {
        const filePath = tempFiles[i]
        const pair = sentencePairs[i]
        const eng = pair.english.trim()
        const chi = pair.chinese.trim()

        let isOk = false
        try {
          const fileStat = await stat(filePath)
          if (fileStat.size > 0 && getAudioDuration(filePath) > 0) {
            isOk = true
          }
        } catch {}

        if (!isOk) {
          console.warn(`Segment validation failed for file: ${filePath}. Re-attempting synthesis...`)
          let audioBuffer = null
          let attempts = 3
          while (attempts > 0) {
            try {
              audioBuffer = await synthesizeText(eng, setting.tts_voice, setting)
              if (audioBuffer && audioBuffer.length > 0) {
                await writeFile(filePath, audioBuffer)
                break
              }
            } catch {}
            attempts--
            if (attempts > 0) {
              await new Promise(resolve => setTimeout(resolve, 200))
            }
          }

          try {
            const fileStat = await stat(filePath)
            if (fileStat.size === 0 || getAudioDuration(filePath) <= 0) {
              throw new Error(`无法重新生成损坏的音频片段: ${filePath}`)
            }
          } catch {
            throw new Error(`片段静态校验失败: 片段 ${i + 1} (${eng}) 音频损坏且无法重新生成。`)
          }
        }

        const duration = getAudioDuration(filePath)
        cues.push({
          id: String(cues.length + 1),
          start: currentOffset,
          end: currentOffset + duration,
          english: eng,
          chinese: chi
        })
        currentOffset += duration
      }

      // Step C: Concat clips with FFmpeg
      const listContent = tempFiles.map(file => `file '${path.basename(file)}'`).join('\n')
      const listPath = path.join(newLessonDir, 'list.txt')
      await writeFile(listPath, listContent, 'utf8')

      const finalAudioPath = path.join(newLessonDir, 'lesson.mp3')
      const ffmpegPath = existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg'
      const concatResult = spawnSync(ffmpegPath, [
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', listPath,
        finalAudioPath
      ])

      if (concatResult.status !== 0) {
        throw new Error(`FFmpeg concatenation failed: ${concatResult.stderr?.toString()}`)
      }

      // Clean segment audio files
      for (const file of tempFiles) {
        try { unlinkSync(file) } catch {}
      }
      try { unlinkSync(listPath) } catch {}

      // Step D: Verify final lesson.mp3 exists and compiles properly
      try {
        const finalStat = await stat(finalAudioPath)
        if (finalStat.size === 0 || getAudioDuration(finalAudioPath) <= 0) {
          throw new Error('生成的课时音频 lesson.mp3 文件为空或损坏！')
        }
      } catch (err) {
        throw new Error(`课时合成后校验失败: ${err.message}`)
      }

      const srtContentEn = generateSrtContent(cues, 'en')
      const srtContentZh = generateSrtContent(cues, 'zh')
      const srtContentBilingual = generateSrtContent(cues, 'bilingual')

      await writeFile(path.join(newLessonDir, 'subtitle.srt'), srtContentEn, 'utf8')
      await writeFile(path.join(newLessonDir, 'subtitle.zh.srt'), srtContentZh, 'utf8')
      await writeFile(path.join(newLessonDir, 'subtitle.bilingual.srt'), srtContentBilingual, 'utf8')

      const subsMap = {
        en: 'subtitle.srt',
        zh: 'subtitle.zh.srt',
        bilingual: 'subtitle.bilingual.srt'
      }

      db.prepare(`
        INSERT INTO lessons (id, courseId, title, level, audioFile, subtitlesJson, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        nextId,
        courseId,
        title.trim(),
        level || '简单',
        'lesson.mp3',
        JSON.stringify(subsMap),
        Date.now()
      )
      lessonPersisted = true

      json(res, 200, {
        id: nextId,
        title: title.trim(),
        level: level || '简单',
        courseId,
        sentenceCount: cues.length,
        totalDuration: currentOffset
      })
    } catch (err) {
      console.error('Dynamic lesson creation failed:', err)
      if (newLessonDir && !lessonPersisted) {
        try {
          rmSync(newLessonDir, { recursive: true, force: true })
        } catch (cleanupErr) {
          console.error('Failed to cleanup half-built lesson dir:', newLessonDir, cleanupErr)
        }
      }
      const status = err && err.status ? err.status : 500
      json(res, status, { error: status === 413 ? '请求体过大' : `新课程课时生成失败: ${err.message}` })
    }
    return true
  }

  return false
}
