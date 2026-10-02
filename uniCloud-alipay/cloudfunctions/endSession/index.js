// 云函数（uniCloud）：手动结束当前活动（教师专属）
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
    const res = await db.collection('sessions').where({ status: 'active' }).update({
      status: 'ended',
      endedAt: Date.now()
    })

    if (!res.updated) {
      return { success: false, message: '当前没有进行中的活动' }
    }

    return {
      success: true,
      message: '活动已结束',
      updated: res.updated
    }
  } catch (err) {
    console.error('endSession 失败:', err)
    return { success: false, message: '结束失败：' + err.message }
  }
}
