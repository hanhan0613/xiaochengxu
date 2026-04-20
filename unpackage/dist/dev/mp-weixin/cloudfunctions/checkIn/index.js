// 云函数：扫码签到（教师扫学生二维码时调用，教师专属）
// 除了更新 students.checkedIn，还会在 checkins 集合写一条流水，关联当前活动
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

async function requireTeacher() {
  const { OPENID } = cloud.getWXContext()
  const res = await db.collection('admins').where({ _openid: OPENID }).get()
  if (res.data.length === 0) {
    return { ok: false, message: '无权限，仅教师可扫码签到' }
  }
  return { ok: true, openid: OPENID }
}

// 获取或自动创建当前活动（集合不存在时会在首次 .add 调用时自动创建）
// 自动创建时同样会快照当前全部学生到 session.studentSnapshot
async function getOrCreateSession(openid) {
  try {
    const res = await db.collection('sessions')
      .where({ status: 'active' })
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get()
    if (res.data.length > 0) return res.data[0]
  } catch (e) {
    console.log('[checkIn] sessions 查询异常，尝试创建：', e.message)
  }

  const now = new Date()
  const title = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} 签到`

  // 快照当前全部学生
  let snapshot = []
  try {
    const stu = await db.collection('students')
      .field({ name: true, phone: true })
      .orderBy('name', 'asc')
      .limit(1000)
      .get()
    snapshot = stu.data.map(s => ({ _id: s._id, name: s.name, phone: s.phone }))
  } catch (e) {
    console.log('[checkIn] 快照学生失败（忽略）：', e.message)
  }

  const addRes = await db.collection('sessions').add({
    data: {
      title,
      status: 'active',
      createdAt: db.serverDate(),
      endedAt: null,
      totalStudents: snapshot.length,
      checkedCount: 0,
      createdBy: openid,
      studentSnapshot: snapshot
    }
  })

  return {
    _id: addRes._id,
    title,
    status: 'active',
    totalStudents: snapshot.length,
    checkedCount: 0,
    studentSnapshot: snapshot
  }
}

exports.main = async (event, context) => {
  const auth = await requireTeacher()
  if (!auth.ok) return { success: false, message: auth.message }

  const { studentId } = event
  if (!studentId) {
    return { success: false, message: '无效的学生信息' }
  }

  try {
    // 1. 查学生
    const studentResult = await db.collection('students').doc(studentId).get()
    if (!studentResult.data) {
      return { success: false, message: '未找到该学生' }
    }
    const student = studentResult.data

    if (student.checkedIn) {
      return {
        success: false,
        message: `${student.name} 已经签到过了`,
        student: {
          name: student.name,
          phone: student.phone,
          checkedIn: true,
          checkInTime: student.checkInTime
        }
      }
    }

    // 2. 获取（或自动创建）当前活动
    const session = await getOrCreateSession(auth.openid)

    const now = db.serverDate()

    // 3. 更新学生状态
    await db.collection('students').doc(studentId).update({
      data: {
        checkedIn: true,
        checkInTime: now,
        updateTime: now,
        lastSessionId: session._id
      }
    })

    // 4. 写签到流水（非致命：失败不阻塞签到）
    try {
      await db.collection('checkins').add({
        data: {
          sessionId: session._id,
          studentId: studentId,
          studentName: student.name,
          studentPhone: student.phone,
          checkInTime: now,
          operatorOpenid: auth.openid
        }
      })
    } catch (e) {
      console.error('[checkIn] 写流水失败（忽略）：', e.message)
    }

    // 5. 更新活动 checkedCount（非致命）
    try {
      await db.collection('sessions').doc(session._id).update({
        data: {
          checkedCount: _.inc(1),
          updateTime: now
        }
      })
    } catch (e) {
      console.error('[checkIn] 更新活动计数失败（忽略）：', e.message)
    }

    return {
      success: true,
      message: `${student.name} 签到成功！`,
      student: {
        name: student.name,
        phone: student.phone,
        checkedIn: true
      },
      session: {
        _id: session._id,
        title: session.title
      }
    }
  } catch (err) {
    console.error('签到失败:', err, err.stack)
    return { success: false, message: '签到失败：' + (err.message || err.errMsg || '未知错误') }
  }
}
