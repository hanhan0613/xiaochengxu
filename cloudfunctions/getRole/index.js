// 云函数：获取当前用户角色
// 根据 openid 查询 admins 集合，判断是否为教师
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  try {
    const res = await db.collection('admins').where({ _openid: OPENID }).get()
    const isTeacher = res.data.length > 0

    return {
      success: true,
      openid: OPENID,
      role: isTeacher ? 'teacher' : 'student'
    }
  } catch (err) {
    // 集合不存在时也返回 student（而不是报错），方便首次部署
    console.error('getRole 查询失败:', err)
    return {
      success: true,
      openid: OPENID,
      role: 'student',
      warning: err.message
    }
  }
}
