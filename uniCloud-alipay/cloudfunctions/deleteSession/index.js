// 云函数（uniCloud）：删除指定活动及其所有签到流水（教师专属）
// 如果是 active 活动，同时把 students.checkedIn 重置为 false，保持一致性
'use strict'
const db = uniCloud.database()

async function requireTeacher(openid) {
  if (!openid) return { ok: false, message: '未登录，请重新进入小程序' }
  const res = await db.collection('admins').where({ _openid: openid }).get()
  if (!res.data || res.data.length === 0) return { ok: false, message: '无权限' }
  return { ok: true, openid }
}

exports.main = async (event, context) => {
  const { _openid, sessionId } = event || {}

  const auth = await requireTeacher(_openid)
  if (!auth.ok) return { success: false, message: auth.message }

  if (!sessionId) return { success: false, message: '缺少 sessionId' }

  try {
    // 1. 先查活动，看它是不是 active 的
    let wasActive = false
    try {
      const sessRes = await db.collection('sessions').doc(sessionId).get()
      const sessData = sessRes.data
      const sess = Array.isArray(sessData) ? sessData[0] : sessData
      if (sess) {
        wasActive = sess.status === 'active'
      }
    } catch (e) {
      console.log('[deleteSession] 活动已不存在或查询失败：', e.message)
    }

    // 2. 删除 checkins 表里该 session 的所有流水
    let removedCheckins = 0
    try {
      const rmRes = await db.collection('checkins').where({ sessionId }).remove()
      removedCheckins = rmRes.deleted || 0
    } catch (e) {
      console.log('[deleteSession] 删除 checkins 失败（忽略）：', e.message)
    }

    // 3. 删除 session 本身
    try {
      await db.collection('sessions').doc(sessionId).remove()
    } catch (e) {
      return { success: false, message: '删除活动失败：' + e.message }
    }

    // 4. 如果原来是进行中的活动，重置 students.checkedIn
    let resetStudents = 0
    if (wasActive) {
      try {
        const rs = await db.collection('students').where({ checkedIn: true }).update({
          checkedIn: false,
          checkInTime: null,
          updateTime: Date.now()
        })
        resetStudents = rs.updated || 0
      } catch (e) {
        console.log('[deleteSession] 重置学生状态失败（忽略）：', e.message)
      }
    }

    return {
      success: true,
      message: wasActive
        ? `已删除活动并重置 ${resetStudents} 名学生的签到状态`
        : `已删除活动及 ${removedCheckins} 条签到记录`,
      removedCheckins,
      resetStudents,
      wasActive
    }
  } catch (err) {
    console.error('deleteSession 失败:', err)
    return { success: false, message: '删除失败：' + err.message }
  }
}
