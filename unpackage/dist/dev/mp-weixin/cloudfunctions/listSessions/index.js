// 云函数：列出所有签到活动（教师专属）
// 数据策略：
//   - checkedCount 从 checkins 集合实时 count（流水永远准确）
//   - totalStudents 严格使用 session 创建时的快照，不与当前 students 表关联
//   - 数据异常兜底：快照 < 签到人数时，用签到人数做下限（语义上更合理）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function requireTeacher() {
  const { OPENID } = cloud.getWXContext()
  const res = await db.collection('admins').where({ _openid: OPENID }).get()
  if (res.data.length === 0) return { ok: false, message: '无权限' }
  return { ok: true, openid: OPENID }
}

exports.main = async (event, context) => {
  const auth = await requireTeacher()
  if (!auth.ok) return { success: false, message: auth.message }

  const { page = 1, pageSize = 20 } = event

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

      // 严格用快照。快照为 0（老数据）时至少保证 ≥ checkedCount
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
