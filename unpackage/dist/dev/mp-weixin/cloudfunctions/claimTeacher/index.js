// 云函数：申请成为教师
// 凭预设的 setup 密码，把当前用户 openid 写入 admins 集合
// ==========================================================
//  部署前请修改下面的 SETUP_PASSWORD 为你自己的密码
//  建议至少 8 位且包含字母和数字，只给教师本人知道
// ==========================================================
const SETUP_PASSWORD = 'teacher2026'

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { password } = event
  const { OPENID } = cloud.getWXContext()

  if (!password || password !== SETUP_PASSWORD) {
    return { success: false, message: '密码错误' }
  }

  try {
    // 检查是否已经是教师
    const existed = await db.collection('admins').where({ _openid: OPENID }).get()
    if (existed.data.length > 0) {
      return { success: true, message: '你已经是教师', openid: OPENID }
    }

    await db.collection('admins').add({
      data: {
        _openid: OPENID,
        createdAt: db.serverDate()
      }
    })

    return { success: true, message: '已设置为教师', openid: OPENID }
  } catch (err) {
    console.error('claimTeacher 失败:', err)
    // 如果集合不存在，提示手动创建
    if (err.errCode === -502005 || (err.message && err.message.includes('not exists'))) {
      return {
        success: false,
        message: '请先在云开发控制台创建 admins 集合'
      }
    }
    return { success: false, message: '操作失败：' + err.message }
  }
}
