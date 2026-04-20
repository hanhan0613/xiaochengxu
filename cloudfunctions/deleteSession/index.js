// 云函数：删除指定活动及其所有签到流水（教师专属）
// 如果是 active 活动，同时把 students.checkedIn 重置为 false，保持一致性
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

  const { sessionId } = event
  if (!sessionId) return { success: false, message: '缺少 sessionId' }

  try {
    // 1. 先查活动，看它是不是 active 的（需要特殊处理）
    let wasActive = false
    try {
      const sessRes = await db.collection('sessions').doc(sessionId).get()
      if (sessRes.data) {
        wasActive = sessRes.data.status === 'active'
      }
    } catch (e) {
      console.log('[deleteSession] 活动已不存在或查询失败：', e.message)
    }

    // 2. 删除 checkins 表里该 session 的所有流水
    let removedCheckins = 0
    try {
      const rmRes = await db.collection('checkins').where({ sessionId }).remove()
      removedCheckins = rmRes.stats.removed
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
          data: {
            checkedIn: false,
            checkInTime: null,
            updateTime: db.serverDate()
          }
        })
        resetStudents = rs.stats.updated
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
