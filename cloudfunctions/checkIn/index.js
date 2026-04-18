// 云函数：扫码签到
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { studentId } = event

  if (!studentId) {
    return { success: false, message: '无效的学生信息' }
  }

  try {
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

    await db.collection('students').doc(studentId).update({
      data: {
        checkedIn: true,
        checkInTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })

    return {
      success: true,
      message: `${student.name} 签到成功！`,
      student: {
        name: student.name,
        phone: student.phone,
        checkedIn: true
      }
    }
  } catch (err) {
    console.error('签到失败:', err)
    return { success: false, message: '签到失败：' + err.message }
  }
}
