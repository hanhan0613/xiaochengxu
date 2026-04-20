// 云函数：开启新一轮签到活动（教师专属）
// 参数：
//   title          活动名称，可选
//   clearStudents  是否清空学生名单（true 时会 remove 所有 students）
//
// 完整快照策略：
//   活动创建时，把当前所有学生的 _id/name/phone 存进 session.studentSnapshot 数组
//   这样无论后续 students 表怎么变，历史活动的名单都不受影响
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

async function requireTeacher() {
  const { OPENID } = cloud.getWXContext()
  const res = await db.collection('admins').where({ _openid: OPENID }).get()
  if (res.data.length === 0) return { ok: false, message: '无权限' }
  return { ok: true, openid: OPENID }
}

// 拉当前所有学生，简化字段后返回数组
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
  const auth = await requireTeacher()
  if (!auth.ok) return { success: false, message: auth.message }

  const { title, clearStudents } = event

  try {
    const now = new Date()
    const defaultTitle = title && title.trim()
      ? title.trim()
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} 签到`

    // 1. 结束所有仍为 active 的活动
    try {
      await db.collection('sessions').where({ status: 'active' }).update({
        data: { status: 'ended', endedAt: db.serverDate() }
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
        clearedCount = rmRes.stats.removed
      } catch (e) {
        console.error('[startSession] 清空学生失败：', e.message)
      }
      // 清空后新活动的快照应该是空（表示"准备重新导入"）
      snapshot = []
    } else {
      // 不清空：只把现有学生的 checkedIn 清零
      try {
        await db.collection('students').where({ checkedIn: true }).update({
          data: {
            checkedIn: false,
            checkInTime: null,
            updateTime: db.serverDate()
          }
        })
      } catch (e) {
        console.log('[startSession] 重置学生状态失败（忽略）：', e.message)
      }
    }

    // 4. 创建新活动
    const addRes = await db.collection('sessions').add({
      data: {
        title: defaultTitle,
        status: 'active',
        createdAt: db.serverDate(),
        endedAt: null,
        totalStudents: snapshot.length,
        checkedCount: 0,
        createdBy: auth.openid,
        studentSnapshot: snapshot
      }
    })

    return {
      success: true,
      message: clearStudents
        ? `已清空 ${clearedCount} 名学生并开启新活动：${defaultTitle}`
        : `已开启新活动：${defaultTitle}（${snapshot.length} 人）`,
      sessionId: addRes._id,
      title: defaultTitle,
      totalStudents: snapshot.length,
      clearedStudents: clearedCount
    }
  } catch (err) {
    console.error('startSession 失败:', err)
    return { success: false, message: '开启失败：' + err.message }
  }
}
