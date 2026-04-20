// 云函数：重置所有学生签到状态（教师专属）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

async function requireTeacher() {
  const { OPENID } = cloud.getWXContext()
  const res = await db.collection('admins').where({ _openid: OPENID }).get()
  if (res.data.length === 0) {
    return { ok: false, message: '无权限' }
  }
  return { ok: true, openid: OPENID }
}

exports.main = async (event, context) => {
  const auth = await requireTeacher()
  if (!auth.ok) return { success: false, message: auth.message }

  try {
    // 云函数环境下 .update() 可以批量更新，不再受小程序端 1 条的限制
    const res = await db.collection('students').where({
      checkedIn: true
    }).update({
      data: {
        checkedIn: false,
        checkInTime: null,
        updateTime: db.serverDate()
      }
    })

    return {
      success: true,
      message: `已重置 ${res.stats.updated} 名学生的签到状态`,
      updated: res.stats.updated
    }
  } catch (err) {
    console.error('重置失败:', err)
    return { success: false, message: '重置失败：' + err.message }
  }
}
