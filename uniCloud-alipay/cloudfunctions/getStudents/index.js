// 云函数（uniCloud）：获取所有学生签到状态（教师专属）
'use strict'
const db = uniCloud.database()

async function requireTeacher(openid) {
  if (!openid) return { ok: false, message: '未登录，请重新进入小程序' }
  const res = await db.collection('admins').where({ _openid: openid }).get()
  if (!res.data || res.data.length === 0) {
    return { ok: false, message: '无权限，仅教师可查看学生列表' }
  }
  return { ok: true, openid }
}

exports.main = async (event, context) => {
  const { _openid, page = 1, pageSize = 50, filter = 'all' } = event || {}

  const auth = await requireTeacher(_openid)
  if (!auth.ok) return { success: false, message: auth.message }

  try {
    const collection = db.collection('students')
    let query = collection

    if (filter === 'checked') {
      query = query.where({ checkedIn: true })
    } else if (filter === 'unchecked') {
      query = query.where({ checkedIn: false })
    }

    const countResult = await query.count()
    const total = countResult.total

    const skip = (page - 1) * pageSize
    const result = await query
      .orderBy('name', 'asc')
      .skip(skip)
      .limit(pageSize)
      .get()

    const allStudents = await collection.count()
    const checkedCount = await collection.where({ checkedIn: true }).count()

    return {
      success: true,
      data: result.data,
      total,
      stats: {
        total: allStudents.total,
        checked: checkedCount.total,
        unchecked: allStudents.total - checkedCount.total
      }
    }
  } catch (err) {
    console.error('获取学生列表失败:', err)
    return { success: false, message: '获取失败：' + err.message }
  }
}
