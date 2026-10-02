// 云函数（uniCloud）：申请成为教师
// 凭预设的 setup 密码，把当前用户 openid 写入 admins 集合
'use strict'

// ====== 微信小程序配置（部署前请改成你自己的）======
const APPID = 'wxc977b49ec4a99643'
const APPSECRET = 'ac208e4b183a56489364eceb617afaaf'
// ===================================================

// ==========================================================
//  部署前请修改下面的 SETUP_PASSWORD 为你自己的密码
//  建议至少 8 位且包含字母和数字，只给教师本人知道
// ==========================================================
const SETUP_PASSWORD = 'teacher2026'

const db = uniCloud.database()

async function code2openid(code) {
  if (!code) return { ok: false, message: '缺少微信登录 code' }
  if (!APPSECRET || APPSECRET === 'PUT_YOUR_WX_APP_SECRET_HERE') {
    return { ok: false, message: '请先在云函数 claimTeacher/index.js 配置 APPSECRET' }
  }

  const url = 'https://api.weixin.qq.com/sns/jscode2session'
    + `?appid=${APPID}`
    + `&secret=${APPSECRET}`
    + `&js_code=${code}`
    + '&grant_type=authorization_code'

  try {
    const res = await uniCloud.httpclient.request(url, {
      method: 'GET',
      dataType: 'json',
      timeout: 8000
    })
    const data = (res && res.data) || {}
    if (data.openid) {
      return { ok: true, openid: data.openid, unionid: data.unionid }
    }
    return {
      ok: false,
      message: `code2session 失败：errcode=${data.errcode}, errmsg=${data.errmsg}`
    }
  } catch (err) {
    return { ok: false, message: '调用微信接口异常：' + err.message }
  }
}

exports.main = async (event, context) => {
  const { password, code } = event || {}

  if (!password || password !== SETUP_PASSWORD) {
    return { success: false, message: '密码错误' }
  }

  const login = await code2openid(code)
  if (!login.ok) {
    return { success: false, message: login.message }
  }
  const openid = login.openid

  try {
    // 检查是否已经是教师
    const existed = await db.collection('admins').where({ _openid: openid }).get()
    if (existed.data && existed.data.length > 0) {
      return { success: true, message: '你已经是教师', openid }
    }

    await db.collection('admins').add({
      _openid: openid,
      createdAt: Date.now()
    })

    return { success: true, message: '已设置为教师', openid }
  } catch (err) {
    console.error('claimTeacher 失败:', err)
    return { success: false, message: '操作失败：' + err.message }
  }
}
