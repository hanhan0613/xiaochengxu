// 云函数：清空所有学生数据（教师专属，危险操作）
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
    // 云函数端批量删除
    const res = await db.collection('students').where({
      _id: _.exists(true)
    }).remove()

    return {
      success: true,
      message: `已清空 ${res.stats.removed} 条学生数据`,
      removed: res.stats.removed
    }
  } catch (err) {
    console.error('清空失败:', err)
    return { success: false, message: '清空失败：' + err.message }
  }
}
