// 云函数（uniCloud）：批量上传学生名单（教师专属）
// 如果当前有进行中的活动，会自动把新增/更新的学生同步到 active session.studentSnapshot
'use strict'
const db = uniCloud.database()
const _ = db.command

async function requireTeacher(openid) {
  if (!openid) return { ok: false, message: '未登录，请重新进入小程序' }
  const res = await db.collection('admins').where({ _openid: openid }).get()
  if (!res.data || res.data.length === 0) {
    return { ok: false, message: '无权限，仅教师可操作' }
  }
  return { ok: true, openid }
}

exports.main = async (event, context) => {
  const { _openid, students } = event || {}

  const auth = await requireTeacher(_openid)
  if (!auth.ok) return { success: false, message: auth.message }

  if (!students || !Array.isArray(students) || students.length === 0) {
    return { success: false, message: '学生数据为空' }
  }

  try {
    const MAX_BATCH = 20
    let successCount = 0
    let skipCount = 0
    let updateCount = 0
    // 本次真正新增（而非更新）的学生，要追加到 active session 快照
    const newStudents = []

    for (let i = 0; i < students.length; i += MAX_BATCH) {
      const batch = students.slice(i, i + MAX_BATCH)

      for (const student of batch) {
        const name = (student.name || '').toString().trim()
        const phone = (student.phone || '').toString().replace(/\s+/g, '')
        const codeText = (student.code || '').toString().trim()

        if (!name || !phone || !/^\d{4}$/.test(codeText)) {
          skipCount++
          continue
        }
        const code = Number(codeText)

        const existing = await db.collection('students').where({
          name,
          phone
        }).get()

        if (existing.data.length > 0) {
          // 已存在：更新密码并重置签到状态，同时使旧二维码失效
          await db.collection('students').doc(existing.data[0]._id).update({
            code,
            checkedIn: false,
            checkInTime: null,
            qrToken: null,
            qrTokenExpiresAt: null,
            qrSessionId: null,
            updateTime: Date.now()
          })
          successCount++
          updateCount++
        } else {
          const addRes = await db.collection('students').add({
            name,
            phone,
            code,
            checkedIn: false,
            checkInTime: null,
            createTime: Date.now(),
            updateTime: Date.now()
          })
          successCount++
          newStudents.push({ _id: addRes.id || addRes._id, name, phone })
        }
      }
    }

    // 如果有进行中的活动 + 确实有新增的人，追加到活动快照
    let appendedToSession = 0
    if (newStudents.length > 0) {
      try {
        const activeRes = await db.collection('sessions')
          .where({ status: 'active' })
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get()

        if (activeRes.data.length > 0) {
          const activeSession = activeRes.data[0]
          const currentSnapshot = Array.isArray(activeSession.studentSnapshot)
            ? activeSession.studentSnapshot
            : []
          const existingIds = new Set(currentSnapshot.map(s => s._id))
          const toAppend = newStudents.filter(s => !existingIds.has(s._id))

          if (toAppend.length > 0) {
            await db.collection('sessions').doc(activeSession._id).update({
              studentSnapshot: _.push(toAppend),
              totalStudents: _.inc(toAppend.length)
            })
            appendedToSession = toAppend.length
          }
        }
      } catch (e) {
        console.error('[uploadStudents] 追加快照失败（忽略）：', e.message)
      }
    }

    let msg = `成功处理 ${successCount} 名学生，跳过 ${skipCount} 条无效数据`
    if (appendedToSession > 0) {
      msg += `；其中 ${appendedToSession} 名新学生已同步到当前活动`
    }

    return {
      success: true,
      message: msg,
      successCount,
      skipCount,
      updateCount,
      appendedToSession
    }
  } catch (err) {
    console.error('上传学生数据失败:', err)
    return { success: false, message: '上传失败：' + err.message }
  }
}
