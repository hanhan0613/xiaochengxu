// 云函数：批量上传学生名单（教师专属）
// 如果当前有进行中的活动，会自动把新增/更新的学生同步到 active session.studentSnapshot
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

async function requireTeacher() {
  const { OPENID } = cloud.getWXContext()
  const res = await db.collection('admins').where({ _openid: OPENID }).get()
  if (res.data.length === 0) {
    return { ok: false, message: '无权限，仅教师可操作' }
  }
  return { ok: true, openid: OPENID }
}

exports.main = async (event, context) => {
  const auth = await requireTeacher()
  if (!auth.ok) return { success: false, message: auth.message }

  const { students } = event

  if (!students || !Array.isArray(students) || students.length === 0) {
    return { success: false, message: '学生数据为空' }
  }

  try {
    const MAX_BATCH = 20
    let successCount = 0
    let skipCount = 0
    // 本次真正新增（而非更新）的学生，要追加到 active session 快照
    const newStudents = []

    for (let i = 0; i < students.length; i += MAX_BATCH) {
      const batch = students.slice(i, i + MAX_BATCH)

      for (const student of batch) {
        const name = (student.name || '').toString().trim()
        const phone = (student.phone || '').toString().trim()

        if (!name || !phone) {
          skipCount++
          continue
        }

        const existing = await db.collection('students').where({
          name: name,
          phone: phone
        }).get()

        if (existing.data.length > 0) {
          // 已存在：重置签到状态即可
          await db.collection('students').doc(existing.data[0]._id).update({
            data: {
              checkedIn: false,
              checkInTime: null,
              updateTime: db.serverDate()
            }
          })
          successCount++
        } else {
          const addRes = await db.collection('students').add({
            data: {
              name: name,
              phone: phone,
              checkedIn: false,
              checkInTime: null,
              createTime: db.serverDate(),
              updateTime: db.serverDate()
            }
          })
          successCount++
          newStudents.push({ _id: addRes._id, name, phone })
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
          // 合并（避免重复：按 _id 去重）
          const existingIds = new Set(currentSnapshot.map(s => s._id))
          const toAppend = newStudents.filter(s => !existingIds.has(s._id))

          if (toAppend.length > 0) {
            await db.collection('sessions').doc(activeSession._id).update({
              data: {
                studentSnapshot: _.push(toAppend),
                totalStudents: _.inc(toAppend.length)
              }
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
      appendedToSession
    }
  } catch (err) {
    console.error('上传学生数据失败:', err)
    return { success: false, message: '上传失败：' + err.message }
  }
}
