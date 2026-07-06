// 路由分发器。
import { handleAuthRoutes } from './auth.js'
import { handleAdminRoutes } from './admin.js'
import { handleCoursesRoutes } from './courses.js'
import { handleCustomLessonsRoutes } from './customLessons.js'
import { handleVocabRoutes } from './vocab.js'
import { handleSettingsRoutes } from './settings.js'

/**
 * 创建主路由分发器。
 * @param {object} deps - 由 server.js 注入的共享依赖
 * @returns {(req, res, url) => Promise<boolean>}
 */
export function createRouter(deps) {
  const handlers = [
    handleAuthRoutes,
    handleAdminRoutes,
    handleCoursesRoutes,
    handleCustomLessonsRoutes,
    handleVocabRoutes,
    handleSettingsRoutes,
  ]

  return async function dispatch(req, res, url) {
    for (const handler of handlers) {
      const handled = await handler(req, res, url, deps)
      if (handled) return true
    }
    return false
  }
}
