// 云函数（uniCloud）：扫码签到（教师扫学生二维码时调用，教师专属）
// 除了更新 students.checkedIn，还会在 checkins 集合写一条流水，关联当前活动
'use strict'
const db = uniCloud.database()
const _ = db.command

async function requireTeacher(openid) {
  if (!openid) return { ok: false, message: '未登录，请重新进入小程序' }
  const res = await db.collection('admins').where({ _openid: openid }).get()
  if (!res.data || res.data.length === 0) {
    return { ok: false, message: '无权限，仅教师可扫码签到' }
  }
  return { ok: true, openid }
}

// 获取或自动创建当前活动
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

  // 云函数运行在 UTC 时区，转成北京时间 (UTC+8) 用于自动创建的活动标题
  const now = new Date()
  const bj = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  const title = `${bj.getUTCFullYear()}-${String(bj.getUTCMonth() + 1).padStart(2, '0')}-${String(bj.getUTCDate()).padStart(2, '0')} ${String(bj.getUTCHours()).padStart(2, '0')}:${String(bj.getUTCMinutes()).padStart(2, '0')} 签到`

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
    title,
    status: 'active',
    createdAt: Date.now(),
    endedAt: null,
    totalStudents: snapshot.length,
    checkedCount: 0,
    createdBy: openid,
    studentSnapshot: snapshot
  })

  return {
    _id: addRes.id || addRes._id,
    title,
    status: 'active',
    totalStudents: snapshot.length,
    checkedCount: 0,
    studentSnapshot: snapshot
  }
}

exports.main = async (event, context) => {
  const { _openid, studentId, qrToken } = event || {}

  const auth = await requireTeacher(_openid)
  if (!auth.ok) return { success: false, message: auth.message }

  if (!studentId || !qrToken) {
    return { success: false, message: '无效的签到二维码，请让学生刷新后重试' }
  }

  try {
    // 1. 查学生
    const studentResult = await db.collection('students').doc(studentId).get()
    if (!studentResult.data || studentResult.data.length === 0) {
      return { success: false, message: '未找到该学生' }
    }
    const student = Array.isArray(studentResult.data) ? studentResult.data[0] : studentResult.data

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

    const now = Date.now()
    if (!student.qrToken || student.qrToken !== qrToken) {
      return { success: false, message: '二维码已失效，请让学生刷新后重试' }
    }
    if (!student.qrTokenExpiresAt || now > student.qrTokenExpiresAt) {
      return { success: false, message: '二维码已过期，请让学生刷新后重试' }
    }

    // 2. 获取（或自动创建）当前活动
    const session = await getOrCreateSession(auth.openid)
    if (student.qrSessionId && student.qrSessionId !== session._id) {
      return { success: false, message: '二维码不属于当前签到活动，请让学生刷新后重试' }
    }

    // 3. 更新学生状态
    const updateResult = await db.collection('students').where({
      _id: studentId,
      checkedIn: false,
      qrToken
    }).update({
      checkedIn: true,
      checkInTime: now,
      updateTime: now,
      lastSessionId: session._id,
      qrToken: null,
      qrTokenExpiresAt: null,
      qrSessionId: null
    })
    if (!updateResult.updated) {
      return { success: false, message: '二维码已使用或已失效，请刷新后重试' }
    }

    // 4. 写签到流水（非致命：失败不阻塞签到）
    try {
      await db.collection('checkins').add({
        sessionId: session._id,
        studentId,
        studentName: student.name,
        studentPhone: student.phone,
        checkInTime: now,
        operatorOpenid: auth.openid
      })
    } catch (e) {
      console.error('[checkIn] 写流水失败（忽略）：', e.message)
    }

    // 5. 更新活动 checkedCount（非致命）
    try {
      await db.collection('sessions').doc(session._id).update({
        checkedCount: _.inc(1),
        updateTime: now
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
    return { success: false, message: '签到失败：' + (err.message || '未知错误') }
  }
}
