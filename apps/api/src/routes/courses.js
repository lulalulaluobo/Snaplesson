// courses 域路由：课程列表 + 自建课程文件夹 CRUD。
import path from 'node:path'
import { existsSync, rmSync } from 'node:fs'

const FOLDER_PREFIX = '/api/course-folders/'

export async function handleCoursesRoutes(req, res, url, ctx) {
  const { db, resourceDir, getAuthenticatedUser, parseJsonBody, json } = ctx
  const { pathname, method } = { pathname: url.pathname, method: req.method }

  // 1. GET /api/courses
  if (pathname === '/api/courses' && method === 'GET') {
    try {
      const dbLessons = db.prepare('SELECT * FROM lessons ORDER BY createdAt DESC').all()
      const customLessons = dbLessons.map(dbLesson => {
        let subtitles = { en: 'subtitle.srt', zh: 'subtitle.zh.srt', bilingual: 'subtitle.bilingual.srt' }
        try {
          if (dbLesson.subtitlesJson) {
            subtitles = JSON.parse(dbLesson.subtitlesJson)
          }
        } catch {}

        return {
          id: dbLesson.id,
          number: dbLesson.id,
          seq: 9000 + Number(dbLesson.id.replace(/\D/g, '') || '0'),
          title: dbLesson.title,
          displayTitle: dbLesson.title,
          level: dbLesson.level || '简单',
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
          courseId: dbLesson.courseId,
          username: dbLesson.username
        }
      })

      json(res, 200, {
        lessons: customLessons,
        count: customLessons.length
      })
    } catch (err) {
      console.error('Fetch courses catalog failed:', err)
      json(res, 500, { error: '服务内部错误' })
    }
    return true
  }

  // 2. GET /api/course-folders
  if (pathname === '/api/course-folders' && method === 'GET') {
    const user = await getAuthenticatedUser(req, db)
    if (!user) {
      json(res, 401, { error: '未登录' })
      return true
    }
    try {
      const list = []
      const dbCourses = db.prepare('SELECT * FROM courses ORDER BY createdAt DESC').all()
      for (const course of dbCourses) {
        const countRow = db.prepare('SELECT COUNT(*) as cnt FROM lessons WHERE courseId = ?').get(course.id)
        list.push({
          id: course.id,
          name: course.name,
          type: 'custom',
          count: countRow ? countRow.cnt : 0
        })
      }
      json(res, 200, list)
    } catch (err) {
      console.error('Fetch course-folders failed:', err)
      json(res, 500, { error: '服务内部错误' })
    }
    return true
  }

  // 3. POST /api/course-folders
  if (pathname === '/api/course-folders' && method === 'POST') {
    const user = await getAuthenticatedUser(req, db)
    if (!user) {
      json(res, 401, { error: '未登录' })
      return true
    }
    try {
      const { name } = await parseJsonBody(req)
      if (!name || !name.trim()) {
        json(res, 400, { error: '课程文件夹名称不能为空' })
        return true
      }
      const id = `custom_${Date.now()}`
      db.prepare(`
        INSERT INTO courses (id, name, type, createdAt)
        VALUES (?, ?, ?, ?)
      `).run(id, name.trim(), 'custom', Date.now())

      json(res, 200, { id, name: name.trim(), type: 'custom', count: 0 })
    } catch (err) {
      console.error('Create course-folder failed:', err)
      json(res, 500, { error: '服务内部错误' })
    }
    return true
  }

  // 4. DELETE /api/course-folders/:id
  if (pathname.startsWith(FOLDER_PREFIX) && method === 'DELETE') {
    const user = await getAuthenticatedUser(req, db)
    if (!user) {
      json(res, 401, { error: '未登录' })
      return true
    }
    // Only admin can delete courses folders
    if (user.role !== 'admin') {
      json(res, 403, { error: '权限不足，仅管理员可删除课程文件夹' })
      return true
    }
    const folderId = decodeURIComponent(pathname.slice(FOLDER_PREFIX.length))
    if (folderId === 'custom') {
      json(res, 400, { error: '默认课程文件夹禁止删除' })
      return true
    }
    try {
      const lessons = db.prepare('SELECT id FROM lessons WHERE courseId = ?').all(folderId)
      for (const lesson of lessons) {
        const lessonDir = path.join(resourceDir, lesson.id)
        try {
          if (existsSync(lessonDir)) {
            rmSync(lessonDir, { recursive: true, force: true })
          }
        } catch (fsErr) {
          console.error('Failed to delete lesson folder:', lessonDir, fsErr)
        }
        db.prepare('DELETE FROM lessons WHERE id = ?').run(lesson.id)
        db.prepare('DELETE FROM reviews WHERE lessonId = ?').run(lesson.id)
      }

      db.prepare('DELETE FROM courses WHERE id = ?').run(folderId)
      json(res, 200, { success: true })
    } catch (err) {
      console.error('Delete course-folder failed:', err)
      json(res, 500, { error: '服务内部错误' })
    }
    return true
  }

  // 5. DELETE /api/courses/lessons/:id
  if (pathname.startsWith('/api/courses/lessons/') && method === 'DELETE') {
    const user = await getAuthenticatedUser(req, db)
    if (!user) {
      json(res, 401, { error: '未登录' })
      return true
    }
    const lessonId = decodeURIComponent(pathname.slice('/api/courses/lessons/'.length))
    try {
      const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(lessonId)
      if (!lesson) {
        json(res, 404, { error: '课程不存在' })
        return true
      }
      // Check permission: must be creator or admin
      if (user.role !== 'admin' && lesson.username !== user.username) {
        json(res, 403, { error: '权限不足，只能删除自己创建的课程' })
        return true
      }

      // Delete files
      const lessonDir = path.join(resourceDir, lesson.id)
      try {
        if (existsSync(lessonDir)) {
          rmSync(lessonDir, { recursive: true, force: true })
        }
      } catch (fsErr) {
        console.error('Failed to delete lesson folder:', lessonDir, fsErr)
      }

      db.prepare('DELETE FROM lessons WHERE id = ?').run(lessonId)
      db.prepare('DELETE FROM reviews WHERE lessonId = ?').run(lessonId)

      json(res, 200, { success: true })
    } catch (err) {
      console.error('Delete lesson failed:', err)
      json(res, 500, { error: '服务内部错误' })
    }
    return true
  }

  // 6. POST /api/courses/lessons/batch-delete
  if (pathname === '/api/courses/lessons/batch-delete' && method === 'POST') {
    const user = await getAuthenticatedUser(req, db)
    if (!user) {
      json(res, 401, { error: '未登录' })
      return true
    }
    try {
      const { ids } = await parseJsonBody(req)
      if (!Array.isArray(ids) || ids.length === 0) {
        json(res, 400, { error: '未选择任何课时' })
        return true
      }

      for (const lessonId of ids) {
        const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(lessonId)
        if (!lesson) continue
        
        // Check permission: must be creator or admin
        if (user.role !== 'admin' && lesson.username !== user.username) {
          continue
        }

        // Delete files
        const lessonDir = path.join(resourceDir, lesson.id)
        try {
          if (existsSync(lessonDir)) {
            rmSync(lessonDir, { recursive: true, force: true })
          }
        } catch (fsErr) {
          console.error('Failed to delete lesson folder in batch delete:', lessonDir, fsErr)
        }

        db.prepare('DELETE FROM lessons WHERE id = ?').run(lessonId)
        db.prepare('DELETE FROM reviews WHERE lessonId = ?').run(lessonId)
      }

      json(res, 200, { success: true })
    } catch (err) {
      console.error('Batch delete lessons failed:', err)
      json(res, 500, { error: '服务内部错误' })
    }
    return true
  }

  return false
}
