// 云函数：手动结束当前活动（教师专属）
// 结束后学生列表保留、数据保留，但不再允许签到
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

  try {
    const res = await db.collection('sessions').where({ status: 'active' }).update({
      data: {
        status: 'ended',
        endedAt: db.serverDate()
      }
    })

    if (res.stats.updated === 0) {
      return { success: false, message: '当前没有进行中的活动' }
    }

    return {
      success: true,
      message: '活动已结束',
      updated: res.stats.updated
    }
  } catch (err) {
    console.error('endSession 失败:', err)
    return { success: false, message: '结束失败：' + err.message }
  }
}
