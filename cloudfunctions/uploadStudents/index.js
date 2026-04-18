// 云函数：批量上传学生名单
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { students } = event

  if (!students || !Array.isArray(students) || students.length === 0) {
    return { success: false, message: '学生数据为空' }
  }

  try {
    const MAX_BATCH = 20
    let successCount = 0
    let skipCount = 0

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
          await db.collection('students').doc(existing.data[0]._id).update({
            data: {
              checkedIn: false,
              checkInTime: null,
              updateTime: db.serverDate()
            }
          })
          successCount++
        } else {
          await db.collection('students').add({
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
        }
      }
    }

    return {
      success: true,
      message: `成功处理 ${successCount} 名学生，跳过 ${skipCount} 条无效数据`,
      successCount,
      skipCount
    }
  } catch (err) {
    console.error('上传学生数据失败:', err)
    return { success: false, message: '上传失败：' + err.message }
  }
}
