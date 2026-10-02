// 云函数（uniCloud）：获取当前用户角色
// 前端传入 wx.login 拿到的 code，这里换出 openid 后查 admins 集合判断角色
'use strict'

// ====== 微信小程序配置（部署前请改成你自己的）======
const APPID = 'wxc977b49ec4a99643'
const APPSECRET = 'ac208e4b183a56489364eceb617afaaf'
// ===================================================

const db = uniCloud.database()

async function code2openid(code) {
  if (!code) return { ok: false, message: '缺少微信登录 code' }
  if (!APPSECRET || APPSECRET === 'PUT_YOUR_WX_APP_SECRET_HERE') {
    return { ok: false, message: '请先在云函数 getRole/index.js 配置 APPSECRET' }
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
  const { code } = event || {}

  const login = await code2openid(code)
  if (!login.ok) {
    return { success: false, message: login.message }
  }
  const openid = login.openid

  try {
    const res = await db.collection('admins').where({ _openid: openid }).get()
    const isTeacher = res.data && res.data.length > 0

    return {
      success: true,
      openid,
      role: isTeacher ? 'teacher' : 'student'
    }
  } catch (err) {
    // 集合不存在时也返回 student（首次部署友好）
    console.error('getRole 查询失败:', err)
    return {
      success: true,
      openid,
      role: 'student',
      warning: err.message
    }
  }
}
