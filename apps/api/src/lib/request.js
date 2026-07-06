// HTTP 请求解析辅助函数。
// 全部为纯函数（仅依赖入参 req / content），无外部副作用。

/**
 * JSON 请求体大小上限（25 MiB）。
 */
const MAX_JSON_BODY_BYTES = 25 * 1024 * 1024

/**
 * 读取并解析请求体的 JSON，空体返回 {}。
 */
export function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    let tooLarge = false
    req.on('data', chunk => {
      if (tooLarge) return
      body += chunk.toString()
      if (Buffer.byteLength(body) > MAX_JSON_BODY_BYTES) {
        tooLarge = true
        body = ''
      }
    })
    req.on('end', () => {
      if (tooLarge) {
        const err = new Error(`请求体超过 ${MAX_JSON_BODY_BYTES} 字节上限`)
        err.status = 413
        err.code = 'PAYLOAD_TOO_LARGE'
        reject(err)
        return
      }
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', (err) => {
      if (tooLarge) return
      reject(err)
    })
  })
}

/** 剥离 LLM 输出中的 <think>...</think> 段（兼容 DeepSeek/Ollama 等） */
export function stripThinking(content) {
  if (typeof content !== 'string') return ''
  return content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
}
