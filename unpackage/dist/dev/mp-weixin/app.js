"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const common_vendor = require("./common/vendor.js");
const utils_cloud = require("./utils/cloud.js");
if (!Math) {
  "./pages/index/index.js";
  "./pages/student/student.js";
  "./pages/teacher/teacher.js";
  "./pages/admin/admin.js";
  "./pages/sessions/sessions.js";
}
const _sfc_main = {
  async onLaunch() {
    try {
      const r = await utils_cloud.fetchRole();
      if (r && r.success) {
        this.globalData.role = r.role;
        this.globalData.openid = r.openid;
        common_vendor.index.__f__("log", "at App.vue:12", "[role]", r.role, "[openid]", r.openid);
      } else {
        common_vendor.index.__f__("warn", "at App.vue:14", "[getRole] result not success:", r);
      }
    } catch (err) {
      common_vendor.index.__f__("error", "at App.vue:17", "获取角色失败:", err);
    }
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
