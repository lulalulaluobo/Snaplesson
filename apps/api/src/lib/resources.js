// 静态资源服务函数。
// 采用工厂模式：调用方注入依赖，返回绑定了配置的函数集合。

import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'

/**
 * 创建资源服务函数集合。
 */
export function createResourceHandlers({
  resourceDir,
  webDistDir,
  resourceTypes,
  staticContentTypes,
  isLessonId,
  notFound,
}) {
  function resourcePathFor(lessonId, fileName) {
    if (!isLessonId(lessonId) || !resourceTypes.has(fileName)) return null
    const fullPath = path.join(resourceDir, lessonId, fileName)
    const resolved = path.resolve(fullPath)
    const expectedRoot = path.resolve(resourceDir, lessonId) + path.sep
    return resolved.startsWith(expectedRoot) ? resolved : null
  }

  async function sendResource(req, res, lessonId, fileName) {
    const fullPath = resourcePathFor(lessonId, fileName)
    if (!fullPath) {
      notFound(res)
      return
    }

    let fileStat
    try {
      fileStat = await stat(fullPath)
    } catch {
      notFound(res)
      return
    }

    const contentType = resourceTypes.get(fileName)
    const range = req.headers.range

    if (range) {
      const match = range.match(/^bytes=(\d*)-(\d*)$/)
      if (!match) {
        res.writeHead(416)
        res.end()
        return
      }

      const start = match[1] ? Number(match[1]) : 0
      const end = match[2] ? Number(match[2]) : fileStat.size - 1
      if (start >= fileStat.size || end >= fileStat.size || start > end) {
        res.writeHead(416, { 'content-range': `bytes */${fileStat.size}` })
        res.end()
        return
      }

      res.writeHead(206, {
        'accept-ranges': 'bytes',
        'content-type': contentType,
        'content-length': end - start + 1,
        'content-range': `bytes ${start}-${end}/${fileStat.size}`,
      })
      createReadStream(fullPath, { start, end }).pipe(res)
      return
    }

    res.writeHead(200, {
      'accept-ranges': 'bytes',
      'content-type': contentType,
      'content-length': fileStat.size,
    })
    createReadStream(fullPath).pipe(res)
  }

  async function sendStatic(req, res, pathname) {
    const relativePath = decodeURIComponent(pathname).replace(/^\/+/, '')
    const candidate = path.resolve(webDistDir, relativePath || 'index.html')
    const expectedRoot = path.resolve(webDistDir) + path.sep
    const filePath =
      candidate === path.resolve(webDistDir) || candidate.startsWith(expectedRoot)
        ? candidate
        : null

    let fileStat = null
    if (filePath) {
      try {
        fileStat = await stat(filePath)
      } catch {
        fileStat = null
      }
    }

    // SPA fallback: unknown non-asset routes return index.html
    const indexPath = path.join(webDistDir, 'index.html')
    const target = fileStat?.isFile() ? filePath : indexPath
    const contentType =
      staticContentTypes.get(path.extname(target).toLowerCase()) ??
      'application/octet-stream'

    let targetStat
    try {
      targetStat = await stat(target)
    } catch {
      return false
    }

    res.writeHead(200, {
      'content-type': contentType,
      'content-length': targetStat.size,
    })
    if (req.method === 'HEAD') {
      res.end()
      return true
    }
    createReadStream(target).pipe(res)
    return true
  }

  return { resourcePathFor, sendResource, sendStatic }
}
