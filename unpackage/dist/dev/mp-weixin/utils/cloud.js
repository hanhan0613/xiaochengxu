"use strict";
const common_vendor = require("../common/vendor.js");
function callFunction(name, data = {}, options = {}) {
  const { withOpenid = true } = options;
  const finalData = Object.assign({}, data);
  if (withOpenid) {
    const cached = common_vendor.index.getStorageSync("openid");
    if (cached && finalData._openid === void 0) {
      finalData._openid = cached;
    }
  }
  return common_vendor._r.callFunction({
    name,
    data: finalData
  });
}
function wxLoginCode() {
  return new Promise((resolve, reject) => {
    common_vendor.index.login({
      provider: "weixin",
      success: (res) => {
        if (res && res.code)
          resolve(res.code);
        else
          reject(new Error("未取到 code"));
      },
      fail: (err) => reject(err)
    });
  });
}
async function fetchRole() {
  try {
    const code = await wxLoginCode();
    const res = await callFunction("getRole", { code }, { withOpenid: false });
    const r = res && res.result || {};
    if (r.success && r.openid) {
      common_vendor.index.setStorageSync("openid", r.openid);
      common_vendor.index.setStorageSync("role", r.role || "student");
    }
    return r;
  } catch (err) {
    common_vendor.index.__f__("error", "at utils/cloud.js:60", "[fetchRole]", err);
    return { success: false, message: err.message || "获取角色失败" };
  }
}
async function claimTeacher(password) {
  try {
    const code = await wxLoginCode();
    const res = await callFunction("claimTeacher", { code, password }, { withOpenid: false });
    const r = res && res.result || {};
    if (r.success && r.openid) {
      common_vendor.index.setStorageSync("openid", r.openid);
      common_vendor.index.setStorageSync("role", "teacher");
    }
    return r;
  } catch (err) {
    common_vendor.index.__f__("error", "at utils/cloud.js:80", "[claimTeacher]", err);
    return { success: false, message: err.message || "验证失败" };
  }
}
exports.callFunction = callFunction;
exports.claimTeacher = claimTeacher;
exports.fetchRole = fetchRole;
//# sourceMappingURL=../../.sourcemap/mp-weixin/utils/cloud.js.map
