import crypto from 'node:crypto'
import WebSocket from 'ws'

const DEFAULT_UNISOUND_BASE_URL = 'https://maas-api.unisound.com/v1'
const LEGACY_UNISOUND_BASE_URL = 'https://maas-api.hivoice.cn/v1'

function normalizeUnisoundBaseUrl(baseUrl = DEFAULT_UNISOUND_BASE_URL) {
  const normalized = String(baseUrl || DEFAULT_UNISOUND_BASE_URL).trim().replace(/\/+$/, '')
  return normalized === LEGACY_UNISOUND_BASE_URL ? DEFAULT_UNISOUND_BASE_URL : normalized
}

function unisoundApiUrl(baseUrl, apiPath) {
  const base = normalizeUnisoundBaseUrl(baseUrl)
  return `${base.endsWith('/v1') ? base : `${base}/v1`}${apiPath}`
}

function generateSecMsGec() {
  const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
  let ticks = Date.now() / 1000
  ticks += 11644473600
  ticks -= ticks % 300
  ticks *= 1e9 / 100
  const strToHash = `${ticks.toFixed(0)}${TRUSTED_CLIENT_TOKEN}`
  return crypto.createHash('sha256').update(strToHash, 'ascii').digest('hex').toUpperCase()
}

function escapeXml(unsafe) {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  })
}

/** Microsoft Edge WebSocket reverse-engineered TTS */
export async function generateEdgeTTS(text, voice = 'en-US-GuyNeural') {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID().replace(/-/g, '')
    const gecToken = generateSecMsGec()
    const CHROMIUM_FULL_VERSION = '143.0.3650.75'
    const CHROMIUM_MAJOR = CHROMIUM_FULL_VERSION.split('.')[0]
    const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`

    const wsUrl =
      `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1` +
      `?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4` +
      `&Sec-MS-GEC=${gecToken}` +
      `&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`

    const ws = new WebSocket(wsUrl, {
      headers: {
        'User-Agent':
          `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36` +
          ` (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR}.0.0.0 Safari/537.36` +
          ` Edg/${CHROMIUM_MAJOR}.0.0.0`,
        'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache',
      }
    })

    const audioChunks = []

    ws.on('open', () => {
      const timestamp = new Date().toUTCString().replace('GMT', 'GMT+0000 (Coordinated Universal Time)')
      const configMsg =
        `X-Timestamp:${timestamp}\r\n` +
        `Content-Type:application/json; charset=utf-8\r\n` +
        `Path:speech.config\r\n\r\n` +
        JSON.stringify({
          context: {
            synthesis: {
              audio: {
                metadataoptions: {
                  sentenceBoundaryEnabled: "false",
                  wordBoundaryEnabled: "false"
                },
                outputFormat: "audio-24khz-48kbitrate-mono-mp3"
              }
            }
          }
        })
      ws.send(configMsg)

      const escapedText = escapeXml(text)
      const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${voice}'><prosody pitch='+0Hz' rate='+0%' volume='+0%'>${escapedText}</prosody></voice></speak>`

      const ssmlMsg =
        `X-RequestId:${requestId}\r\n` +
        `Content-Type:application/ssml+xml\r\n` +
        `X-Timestamp:${timestamp}Z\r\n` +
        `Path:ssml\r\n\r\n` +
        ssml
      ws.send(ssmlMsg)
    })

    ws.on('message', (data, isBinary) => {
      if (!isBinary) {
        const msgStr = data.toString()
        if (msgStr.includes('Path:turn.end')) {
          ws.close()
          resolve(Buffer.concat(audioChunks))
        }
      } else {
        const buffer = data
        if (buffer.length > 12) {
          const headerLength = buffer.readUInt16BE(0)
          audioChunks.push(buffer.subarray(2 + headerLength))
        }
      }
    })

    ws.on('error', (err) => {
      console.error('Edge TTS websocket error:', err)
      reject(err)
    })

    ws.on('close', (code, reason) => {
      if (audioChunks.length === 0) {
        reject(new Error(`Edge TTS connection closed without audio data. Code: ${code}, Reason: ${reason}`))
      }
    })
  })
}

/** Xiaomi MIMO OpenAI-compatible audio TTS */
export async function generateMimoTTS(text, voice, apiKey, baseUrl = 'https://api.xiaomimimo.com', model = 'mimo-v2.5-tts') {
  if (!text || !text.trim()) return Buffer.alloc(0)
  if (!apiKey) throw new Error('小米 MIMO API Key 未配置')

  let url = baseUrl.trim()
  if (!url.endsWith('/chat/completions')) {
    url = url.endsWith('/v1') ? `${url}/chat/completions` : `${url}/v1/chat/completions`
  }

  const mimoVoice = voice || '冰糖'
  const payload = {
    model: model || 'mimo-v2.5-tts',
    messages: [
      { role: 'user', content: '请朗读以下文本。保持发音清晰流畅，自然平和。' },
      { role: 'assistant', content: text }
    ],
    audio: { format: 'mp3', voice: mimoVoice },
    stream: false
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Xiaomi MiMo API returned error ${response.status}: ${errText}`)
  }

  const respData = await response.json()
  try {
    const audioB64 = respData.choices[0].message.audio.data
    return Buffer.from(audioB64, 'base64')
  } catch (e) {
    throw new Error(`Failed to parse Xiaomi MiMo response audio: ${e.message}`)
  }
}

/** Unisound TTS */
export async function generateUnisoundTTS(text, voice, apiKey, baseUrl = DEFAULT_UNISOUND_BASE_URL, model = 'u2-tts') {
  if (!text || !text.trim()) return Buffer.alloc(0)
  if (!apiKey) throw new Error('云知声 API Key 未配置')

  const unisoundVoice = voice || 'cn_female_shasha'
  const taskUrl = unisoundApiUrl(baseUrl, '/audio/speech/tasks')
  const payload = {
    model: model || 'u2-tts',
    text: text,
    voice_setting: {
      voice_id: unisoundVoice,
      speed: 50,
      volume: 50,
      pitch: 50,
      bright: 50,
      language: 'zh'
    },
    audio_setting: {
      audio_sample_rate: 16000,
      format: 'mp3'
    }
  }

  let taskId = ''
  const maxCreateAttempts = 5
  for (let attempt = 0; attempt < maxCreateAttempts; attempt++) {
    const response = await fetch(taskUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errText = await response.text()
      if (response.status === 429) {
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)))
        continue
      }
      throw new Error(`Unisound task creation failed: HTTP ${response.status} - ${errText}`)
    }

    const data = await response.json()
    if (data?.base_resp?.status_code !== 0) {
      throw new Error(`Unisound task creation returned error: ${JSON.stringify(data)}`)
    }
    taskId = data.task_id
    break
  }

  if (!taskId) throw new Error('Failed to create Unisound task')

  const statusUrl = unisoundApiUrl(baseUrl, `/audio/speech/tasks?task_id=${encodeURIComponent(taskId)}`)
  let fileId = ''
  for (let poll = 0; poll < 30; poll++) {
    await new Promise(r => setTimeout(r, 800))
    const response = await fetch(statusUrl, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    })
    if (!response.ok) continue
    const statusJson = await response.json()
    if (statusJson.status === 'Success') {
      fileId = statusJson.file_id
      break
    } else if (statusJson.status === 'Failed') {
      throw new Error('Unisound TTS task failed')
    }
  }

  if (!fileId) throw new Error('Unisound TTS task timed out')

  const downloadUrl = unisoundApiUrl(baseUrl, `/files/retrieve_content?file_id=${encodeURIComponent(fileId)}`)
  const response = await fetch(downloadUrl, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  })
  if (!response.ok) throw new Error('Failed to download Unisound audio')
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function synthesizeText(text, voice, settings) {
  const provider = settings.tts_provider || 'edge'
  const activeVoice = voice || settings.tts_voice || 'en-US-GuyNeural'

  if (provider === 'mimo') {
    return generateMimoTTS(text, activeVoice, settings.tts_api_key, settings.tts_base_url, settings.tts_model)
  } else if (provider === 'unisound') {
    return generateUnisoundTTS(text, activeVoice, settings.tts_api_key, settings.tts_base_url, settings.tts_model)
  } else {
    // Default to Edge TTS
    return generateEdgeTTS(text, activeVoice)
  }
}
