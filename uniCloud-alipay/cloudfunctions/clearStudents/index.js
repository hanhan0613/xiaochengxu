// 云函数（uniCloud）：清空所有学生数据（教师专属，危险操作）
'use strict'
const db = uniCloud.database()
const _ = db.command

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
    // uniCloud where + remove 批量删除
    const res = await db.collection('students').where({
      _id: _.exists(true)
    }).remove()

    return {
      success: true,
      message: `已清空 ${res.deleted} 条学生数据`,
      removed: res.deleted
    }
  } catch (err) {
    console.error('清空失败:', err)
    return { success: false, message: '清空失败：' + err.message }
  }
}
