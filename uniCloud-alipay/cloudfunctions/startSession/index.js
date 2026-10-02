// 云函数（uniCloud）：开启新一轮签到活动（教师专属）
// 参数：
//   title          活动名称，可选
//   clearStudents  是否清空学生名单（true 时会 remove 所有 students）
'use strict'
const db = uniCloud.database()
const _ = db.command

async function requireTeacher(openid) {
  if (!openid) return { ok: false, message: '未登录，请重新进入小程序' }
  const res = await db.collection('admins').where({ _openid: openid }).get()
  if (!res.data || res.data.length === 0) return { ok: false, message: '无权限' }
  return { ok: true, openid }
}

async function snapshotStudents() {
  try {
    const res = await db.collection('students')
      .field({ name: true, phone: true })
      .orderBy('name', 'asc')
      .limit(1000)
      .get()
    return res.data.map(s => ({
      _id: s._id,
      name: s.name,
      phone: s.phone
    }))
  } catch (e) {
    console.log('[startSession] snapshotStudents 失败：', e.message)
    return []
  }
}

exports.main = async (event, context) => {
  const { _openid, title, clearStudents } = event || {}

  const auth = await requireTeacher(_openid)
  if (!auth.ok) return { success: false, message: auth.message }

  try {
    const now = new Date()
    const bj = new Date(now.getTime() + 8 * 60 * 60 * 1000)
    const defaultTitle = title && title.trim()
      ? title.trim()
      : `${bj.getUTCFullYear()}-${String(bj.getUTCMonth() + 1).padStart(2, '0')}-${String(bj.getUTCDate()).padStart(2, '0')} ${String(bj.getUTCHours()).padStart(2, '0')}:${String(bj.getUTCMinutes()).padStart(2, '0')} 签到`

    // 1. 结束所有仍为 active 的活动
    try {
      await db.collection('sessions').where({ status: 'active' }).update({
        status: 'ended',
        endedAt: Date.now()
      })
    } catch (e) {
      console.log('[startSession] 结束旧活动失败（忽略）：', e.message)
    }

    // 2. 先快照当前学生（在清空前！）
    let snapshot = await snapshotStudents()

    // 3. 如果勾选了清空学生名单：删除所有 students
    let clearedCount = 0
    if (clearStudents === true) {
      try {
        const rmRes = await db.collection('students').where({
          _id: _.exists(true)
        }).remove()
        clearedCount = rmRes.deleted || 0
      } catch (e) {
        console.error('[startSession] 清空学生失败：', e.message)
      }
      snapshot = []
    } else {
      try {
        await db.collection('students').where({ checkedIn: true }).update({
          checkedIn: false,
          checkInTime: null,
          qrToken: null,
          qrTokenExpiresAt: null,
          qrSessionId: null,
          updateTime: Date.now()
        })
      } catch (e) {
        console.log('[startSession] 重置学生状态失败（忽略）：', e.message)
      }
    }

    // 4. 创建新活动
    const addRes = await db.collection('sessions').add({
      title: defaultTitle,
      status: 'active',
      createdAt: Date.now(),
      endedAt: null,
      totalStudents: snapshot.length,
      checkedCount: 0,
      createdBy: auth.openid,
      studentSnapshot: snapshot
    })

    return {
      success: true,
      message: clearStudents
        ? `已清空 ${clearedCount} 名学生并开启新活动：${defaultTitle}`
        : `已开启新活动：${defaultTitle}（${snapshot.length} 人）`,
      sessionId: addRes.id || addRes._id,
      title: defaultTitle,
      totalStudents: snapshot.length,
      clearedStudents: clearedCount
    }
  } catch (err) {
    console.error('startSession 失败:', err)
    return { success: false, message: '开启失败：' + err.message }
  }
}
