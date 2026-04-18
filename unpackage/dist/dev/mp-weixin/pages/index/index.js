"use strict";
const common_vendor = require("../../common/vendor.js");
const _sfc_main = {
  data() {
    return {};
  },
  onLoad(options) {
    common_vendor.index.__f__("log", "at pages/index/index.vue:54", "index onLoad", options);
  },
  methods: {
    goStudent() {
      common_vendor.index.switchTab({ url: "/pages/student/student" });
    },
    goTeacher() {
      common_vendor.index.switchTab({ url: "/pages/teacher/teacher" });
    },
    goAdmin() {
      common_vendor.index.switchTab({ url: "/pages/admin/admin" });
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: common_vendor.o((...args) => $options.goStudent && $options.goStudent(...args), "bb"),
    b: common_vendor.o((...args) => $options.goTeacher && $options.goTeacher(...args), "c7"),
    c: common_vendor.o((...args) => $options.goAdmin && $options.goAdmin(...args), "6d")
  };
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-1cf27b2a"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/index/index.js.map
