// 统一封装 uniCloud.callFunction
// - 默认会从本地存储读取 openid 并注入到 event._openid
// - 登录类的函数（getRole / claimTeacher）需要带 wx.login 取到的 code

/**
 * 调用 uniCloud 云函数
 * @param {string} name 云函数名
 * @param {object} data 业务参数
 * @param {object} options
 *   - withOpenid: 是否注入缓存的 openid（默认 true）
 * @returns {Promise<{result: any}>} 返回与原 wx.cloud.callFunction 一致的结构
 */
export function callFunction(name, data = {}, options = {}) {
  const { withOpenid = true } = options
  const finalData = Object.assign({}, data)
  if (withOpenid) {
    const cached = uni.getStorageSync('openid')
    if (cached && finalData._openid === undefined) {
      finalData._openid = cached
    }
  }
  return uniCloud.callFunction({
    name,
    data: finalData
  })
}

/**
 * 调用微信登录接口拿 code（仅 mp-weixin 平台）
 * @returns {Promise<string>}
 */
export function wxLoginCode() {
  return new Promise((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success: (res) => {
        if (res && res.code) resolve(res.code)
        else reject(new Error('未取到 code'))
      },
      fail: (err) => reject(err)
    })
  })
}

/**
 * 获取并缓存当前用户角色（每次进入需要 fresh code）
 * @returns {Promise<{success:boolean, openid?:string, role?:string, message?:string}>}
 */
export async function fetchRole() {
  try {
    const code = await wxLoginCode()
    const res = await callFunction('getRole', { code }, { withOpenid: false })
    const r = (res && res.result) || {}
    if (r.success && r.openid) {
      uni.setStorageSync('openid', r.openid)
      uni.setStorageSync('role', r.role || 'student')
    }
    return r
  } catch (err) {
    console.error('[fetchRole]', err)
    return { success: false, message: err.message || '获取角色失败' }
  }
}

/**
 * 凭密码绑定教师身份（claimTeacher）
 * @param {string} password
 */
export async function claimTeacher(password) {
  try {
    const code = await wxLoginCode()
    const res = await callFunction('claimTeacher', { code, password }, { withOpenid: false })
    const r = (res && res.result) || {}
    if (r.success && r.openid) {
      uni.setStorageSync('openid', r.openid)
      uni.setStorageSync('role', 'teacher')
    }
    return r
  } catch (err) {
    console.error('[claimTeacher]', err)
    return { success: false, message: err.message || '验证失败' }
  }
}
