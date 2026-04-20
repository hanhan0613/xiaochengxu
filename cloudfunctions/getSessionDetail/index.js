// 云函数：获取单个活动的详情 + 完整名单（教师专属）
// 数据策略：
//   1. 优先用 session.studentSnapshot（活动创建时快照的完整学生列表）
//   2. 老数据没有快照时，回退用当前 students 表（不完美但有数据）
//   3. checkins 里存在但快照里没有的人（活动中途新增的学生），也会加进名单
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

  const { sessionId } = event
  if (!sessionId) return { success: false, message: '缺少 sessionId' }

  try {
    // 1. 活动信息
    const sessRes = await db.collection('sessions').doc(sessionId).get()
    if (!sessRes.data) return { success: false, message: '活动不存在' }
    const session = sessRes.data

    // 2. 签到流水（永久准确）
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
      // 老数据或清空后的活动：拉当前 students 做近似
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

    //   4a. 先加 baseStudents 里每个人（标记签到状态）
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

    //   4b. checkins 里有但 baseStudents 里没有的人（活动中途新加的学生）
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

    // 5. 统计
    const checkedCount = checkinsRes.data.length
    let totalStudents = roster.length
    // 如果 session 有快照数字，优先用（保证前后一致）
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
