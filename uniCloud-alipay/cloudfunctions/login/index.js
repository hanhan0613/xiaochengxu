// 云函数（uniCloud）：学生登录验证
'use strict'
const crypto = require('crypto')
const db = uniCloud.database()

const QR_TOKEN_TTL = 5 * 60 * 1000

exports.main = async (event, context) => {
  const { name, phone, code } = event || {}

  if (!name || !phone) {
    return { success: false, message: '请输入姓名和手机号' }
  }
  const codeText = String(code).trim()
  if (!/^\d{4}$/.test(codeText)) {
    return { success: false, message: '请输入4位数字密码' }
  }

  try {
    const result = await db.collection('students').where({
      name: name.trim(),
      phone: phone.replace(/\s+/g, '')
    }).get()

    if (result.data.length === 0) {
      return { success: false, message: '未找到该学生信息，请确认姓名和手机号是否正确' }
    }

    const student = result.data[0]
    if (Number(student.code) !== Number(codeText)) {
      return { success: false, message: '密码不正确' }
    }

    let qrToken = null
    let qrTokenExpiresAt = null
    if (!student.checkedIn) {
      const sessionResult = await db.collection('sessions')
        .where({ status: 'active' })
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get()
      const activeSession = sessionResult.data && sessionResult.data[0]
      qrToken = crypto.randomBytes(24).toString('hex')
      qrTokenExpiresAt = Date.now() + QR_TOKEN_TTL
      await db.collection('students').doc(student._id).update({
        qrToken,
        qrTokenExpiresAt,
        qrSessionId: activeSession ? activeSession._id : null
      })
    }

    return {
      success: true,
      message: '验证成功',
      student: {
        _id: student._id,
        name: student.name,
        phone: student.phone,
        checkedIn: student.checkedIn,
        checkInTime: student.checkInTime,
        qrToken,
        qrTokenExpiresAt
      }
    }
  } catch (err) {
    console.error('登录验证失败:', err)
    return { success: false, message: '验证失败：' + err.message }
  }
}
