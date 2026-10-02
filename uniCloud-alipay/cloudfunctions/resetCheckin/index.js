// 云函数（uniCloud）：重置所有学生签到状态（教师专属）
'use strict'
const db = uniCloud.database()

async function requireTeacher(openid) {
  if (!openid) return { ok: false, message: '未登录，请重新进入小程序' }
  const res = await db.collection('admins').where({ _openid: openid }).get()
  if (!res.data || res.data.length === 0) {
    return { ok: false, message: '无权限' }
  }
  return { ok: true, openid }
}

exports.main = async (event, context) => {
  const { _openid } = event || {}

  const auth = await requireTeacher(_openid)
  if (!auth.ok) return { success: false, message: auth.message }

  try {
    const res = await db.collection('students').where({
      checkedIn: true
    }).update({
      checkedIn: false,
      checkInTime: null,
      qrToken: null,
      qrTokenExpiresAt: null,
      qrSessionId: null,
      updateTime: Date.now()
    })

    return {
      success: true,
      message: `已重置 ${res.updated} 名学生的签到状态`,
      updated: res.updated
    }
  } catch (err) {
    console.error('重置失败:', err)
    return { success: false, message: '重置失败：' + err.message }
  }
}
