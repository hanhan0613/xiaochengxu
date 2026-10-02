// 云函数（uniCloud）：获取单个活动的详情 + 完整名单（教师专属）
// 数据策略：
//   1. 优先用 session.studentSnapshot（活动创建时快照的完整学生列表）
//   2. 老数据没有快照时，回退用当前 students 表
//   3. checkins 里存在但快照里没有的人（活动中途新增的学生），也会加进名单
'use strict'
const db = uniCloud.database()

async function requireTeacher(openid) {
  if (!openid) return { ok: false, message: '未登录，请重新进入小程序' }
  const res = await db.collection('admins').where({ _openid: openid }).get()
  if (!res.data || res.data.length === 0) return { ok: false, message: '无权限' }
  return { ok: true, openid }
}

exports.main = async (event, context) => {
  const { _openid, sessionId } = event || {}

  const auth = await requireTeacher(_openid)
  if (!auth.ok) return { success: false, message: auth.message }

  if (!sessionId) return { success: false, message: '缺少 sessionId' }

  try {
    // 1. 活动信息
    const sessRes = await db.collection('sessions').doc(sessionId).get()
    if (!sessRes.data || sessRes.data.length === 0) return { success: false, message: '活动不存在' }
    const session = Array.isArray(sessRes.data) ? sessRes.data[0] : sessRes.data

    // 2. 签到流水
    const checkinsRes = await db.collection('checkins')
      .where({ sessionId })
      .orderBy('checkInTime', 'asc')
      .limit(1000)
      .get()

    const checkinMap = {}
    for (const c of checkinsRes.data) {
      checkinMap[c.studentId] = c
    }

    // 3. 选取名单来源：优先快照，否则回退当前 students
    let baseStudents = []
    let fromSnapshot = false
    if (Array.isArray(session.studentSnapshot) && session.studentSnapshot.length > 0) {
      baseStudents = session.studentSnapshot
      fromSnapshot = true
    } else {
      try {
        const stuRes = await db.collection('students')
          .orderBy('name', 'asc')
          .limit(1000)
          .get()
        baseStudents = stuRes.data
      } catch (e) {
        baseStudents = []
      }
    }

    // 4. 构造 roster
    const roster = []
    const seenIds = {}

    for (const s of baseStudents) {
      const c = checkinMap[s._id]
      roster.push({
        _id: s._id,
        name: s.name,
        phone: s.phone,
        checkedIn: !!c,
        checkInTime: c ? c.checkInTime : null
      })
      seenIds[s._id] = true
    }

    for (const c of checkinsRes.data) {
      if (!seenIds[c.studentId]) {
        roster.push({
          _id: c.studentId,
          name: c.studentName,
          phone: c.studentPhone,
          checkedIn: true,
          checkInTime: c.checkInTime
        })
      }
    }

    const checkedCount = checkinsRes.data.length
    let totalStudents = roster.length
    if (session.totalStudents && session.totalStudents > totalStudents) {
      totalStudents = session.totalStudents
    }

    return {
      success: true,
      session: {
        _id: session._id,
        title: session.title,
        status: session.status,
        createdAt: session.createdAt,
        endedAt: session.endedAt,
        totalStudents,
        checkedCount,
        attendanceRate: totalStudents ? Math.round((checkedCount / totalStudents) * 100) : 0,
        fromSnapshot
      },
      roster
    }
  } catch (err) {
    console.error('getSessionDetail 失败:', err)
    return { success: false, message: '获取失败：' + err.message }
  }
}
