"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const common_vendor = require("./common/vendor.js");
if (!Math) {
  "./pages/index/index.js";
  "./pages/student/student.js";
  "./pages/teacher/teacher.js";
  "./pages/admin/admin.js";
  "./pages/sessions/sessions.js";
}
async function fetchRole(globalData) {
  try {
    const res = await common_vendor.wx$1.cloud.callFunction({ name: "getRole" });
    const r = res && res.result ? res.result : {};
    if (r.success) {
      globalData.role = r.role;
      globalData.openid = r.openid;
      common_vendor.index.setStorageSync("role", r.role);
      common_vendor.index.setStorageSync("openid", r.openid);
      common_vendor.index.__f__("log", "at App.vue:12", "[role]", r.role, "[openid]", r.openid);
    } else {
      common_vendor.index.__f__("warn", "at App.vue:14", "[getRole] result not success:", r);
    }
  } catch (err) {
    common_vendor.index.__f__("error", "at App.vue:17", "获取角色失败:", err);
  }
}
const _sfc_main = {
  onLaunch() {
    if (!common_vendor.wx$1.cloud) {
      common_vendor.index.__f__("error", "at App.vue:24", "请使用 2.2.3 或以上的基础库以使用云能力");
      return;
    }
    try {
      common_vendor.wx$1.cloud.init({
        env: "cloud1-7gl718wp38e9e33c",
        traceUser: true
      });
      common_vendor.index.__f__("log", "at App.vue:32", "[cloud] init ok");
    } catch (e) {
      common_vendor.index.__f__("error", "at App.vue:34", "[cloud] init failed:", e);
      return;
    }
    fetchRole(this.globalData);
  },
  globalData: {
    userInfo: null,
    role: null,
    openid: null
  }
};
function createApp() {
  const app = common_vendor.createSSRApp(_sfc_main);
  return {
    app
  };
}
createApp().app.mount("#app");
exports.createApp = createApp;
//# sourceMappingURL=../.sourcemap/mp-weixin/app.js.map
