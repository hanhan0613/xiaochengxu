// 云函数（uniCloud）：获取当前进行中的活动（教师专属）
'use strict'
const db = uniCloud.database()

async function requireTeacher(openid) {
  if (!openid) return { ok: false, message: '未登录，请重新进入小程序' }
  const res = await db.collection('admins').where({ _openid: openid }).get()
  if (!res.data || res.data.length === 0) return { ok: false, message: '无权限' }
  return { ok: true, openid }
}

exports.main = async (event, context) => {
  const { _openid } = event || {}

  const auth = await requireTeacher(_openid)
  if (!auth.ok) return { success: false, message: auth.message }

  try {
    const res = await db.collection('sessions')
      .where({ status: 'active' })
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get()

    if (res.data.length === 0) {
      return { success: true, session: null }
    }

    const s = res.data[0]
    return {
      success: true,
      session: {
        _id: s._id,
        title: s.title,
        status: s.status,
        createdAt: s.createdAt,
        totalStudents: s.totalStudents || 0,
        checkedCount: s.checkedCount || 0
      }
    }
  } catch (err) {
    console.error('getCurrentSession 失败:', err)
    return { success: false, message: '获取失败：' + err.message }
  }
}
