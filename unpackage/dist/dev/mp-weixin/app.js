"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const common_vendor = require("./common/vendor.js");
if (!Math) {
  "./pages/index/index.js";
  "./pages/student/student.js";
  "./pages/teacher/teacher.js";
  "./pages/admin/admin.js";
}
const _sfc_main = {
  onLaunch() {
    if (!common_vendor.wx$1.cloud) {
      common_vendor.index.__f__("error", "at App.vue:5", "请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      common_vendor.wx$1.cloud.init({
        env: "cloud1-7gl718wp38e9e33c",
        traceUser: true
      });
    }
  },
  globalData: {
    userInfo: null,
    role: null
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
