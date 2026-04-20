// 云函数：学生登录验证
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { name, phone, code } = event

  if (!name || !phone) {
    return { success: false, message: '请输入姓名和手机号' }
  }
  if (!code) {
    return { success: false, message: '请输入核验码' }
  }

  try {
    const result = await db.collection('students').where({
      name: name.trim(),
      phone: phone.trim()
    }).get()

    if (result.data.length === 0) {
      return { success: false, message: '未找到该学生信息，请确认姓名和手机号是否正确' }
    }

    const student = result.data[0]
    if ((student.code || '').toString().trim() !== code.toString().trim()) {
      return { success: false, message: '核验码不正确' }
    }
    return {
      success: true,
      message: '验证成功',
      student: {
        _id: student._id,
        name: student.name,
        phone: student.phone,
        checkedIn: student.checkedIn,
        checkInTime: student.checkInTime
      }
    }
  } catch (err) {
    console.error('登录验证失败:', err)
    return { success: false, message: '验证失败：' + err.message }
  }
}
