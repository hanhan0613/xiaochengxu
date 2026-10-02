// 云函数（uniCloud）：列出所有签到活动（教师专属）
'use strict'
const db = uniCloud.database()

async function requireTeacher(openid) {
  if (!openid) return { ok: false, message: '未登录，请重新进入小程序' }
  const res = await db.collection('admins').where({ _openid: openid }).get()
  if (!res.data || res.data.length === 0) return { ok: false, message: '无权限' }
  return { ok: true, openid }
}

exports.main = async (event, context) => {
  const { _openid, page = 1, pageSize = 20 } = event || {}

  const auth = await requireTeacher(_openid)
  if (!auth.ok) return { success: false, message: auth.message }

  try {
    const skip = (page - 1) * pageSize

    const res = await db.collection('sessions')
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()

    const countRes = await db.collection('sessions').count()

    // 对每个 session 动态查 checkins 实际人数
    const sessions = await Promise.all(res.data.map(async (s) => {
      let checkedCount = 0
      try {
        const c = await db.collection('checkins').where({ sessionId: s._id }).count()
        checkedCount = c.total
      } catch (e) {
        checkedCount = s.checkedCount || 0
      }

      let totalStudents = s.totalStudents || 0
      if (totalStudents < checkedCount) totalStudents = checkedCount

      return {
        _id: s._id,
        title: s.title,
        status: s.status,
        createdAt: s.createdAt,
        endedAt: s.endedAt,
        totalStudents,
        checkedCount,
        attendanceRate: totalStudents
          ? Math.round((checkedCount / totalStudents) * 100)
          : 0
      }
    }))

    return {
      success: true,
      data: sessions,
      total: countRes.total,
      page,
      pageSize
    }
  } catch (err) {
    console.error('listSessions 失败:', err)
    return { success: false, message: '获取失败：' + err.message }
  }
}
