// HTTP 响应辅助函数。
// 全部为纯函数，只依赖参数，无外部副作用。

/** 发送 JSON 响应 */
export function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

/** 404 响应 */
export function notFound(res) {
  json(res, 404, { error: 'Not found' })
}

/** 405 响应 */
export function methodNotAllowed(res) {
  json(res, 405, { error: 'Method not allowed' })
}

/** 503 响应 */
export function serviceUnavailable(res, message) {
  json(res, 503, { error: message })
}
