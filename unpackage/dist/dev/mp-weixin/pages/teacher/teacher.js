"use strict";
const common_vendor = require("../../common/vendor.js");
const _sfc_main = {
  data() {
    return {
      students: [],
      stats: { total: 0, checked: 0, unchecked: 0 },
      filter: "all",
      page: 1,
      pageSize: 50,
      hasMore: false,
      isLoading: false,
      scanResult: null
    };
  },
  computed: {
    progressPercent() {
      if (this.stats.total === 0)
        return 0;
      return Math.round(this.stats.checked / this.stats.total * 100);
    }
  },
  onShow() {
    this.loadStudents(true);
  },
  onPullDownRefresh() {
    this.loadStudents(true).then(() => {
      common_vendor.index.stopPullDownRefresh();
    });
  },
  methods: {
    async loadStudents(refresh = false) {
      if (this.isLoading)
        return;
      const page = refresh ? 1 : this.page;
      this.isLoading = true;
      try {
        const res = await common_vendor.wx$1.cloud.callFunction({
          name: "getStudents",
          data: { page, pageSize: this.pageSize, filter: this.filter }
        });
        if (res.result.success) {
          let students = res.result.data.map((s) => {
            if (s.checkInTime) {
              const d = new Date(s.checkInTime);
              s.checkInTimeStr = this.formatTime(d);
            }
            return s;
          });
          if (!refresh && page > 1) {
            students = [...this.students, ...students];
          }
          this.students = students;
          this.stats = res.result.stats;
          this.page = page;
          this.hasMore = students.length < res.result.total;
        }
      } catch (err) {
        common_vendor.index.__f__("error", "at pages/teacher/teacher.vue:160", "加载学生列表失败:", err);
        common_vendor.index.showToast({ title: "加载失败", icon: "none" });
      }
      this.isLoading = false;
    },
    formatTime(date) {
      const h = date.getHours().toString().padStart(2, "0");
      const m = date.getMinutes().toString().padStart(2, "0");
      return `${h}:${m}`;
    },
    setFilter(filter) {
      this.filter = filter;
      this.page = 1;
      this.loadStudents(true);
    },
    loadMore() {
      this.page++;
      this.loadStudents(false);
    },
    scanQRCode() {
      common_vendor.index.scanCode({
        onlyFromCamera: true,
        scanType: ["qrCode"],
        success: async (res) => {
          try {
            const qrData = JSON.parse(res.result);
            if (qrData.type !== "checkin" || !qrData.studentId) {
              this.scanResult = { success: false, message: "无效的签到二维码" };
              return;
            }
            const now = Date.now();
            if (now - qrData.timestamp > 5 * 60 * 1e3) {
              this.scanResult = { success: false, message: "二维码已过期，请让学生重新生成" };
              return;
            }
            common_vendor.index.showLoading({ title: "签到中..." });
            const checkInRes = await common_vendor.wx$1.cloud.callFunction({
              name: "checkIn",
              data: { studentId: qrData.studentId }
            });
            common_vendor.index.hideLoading();
            this.scanResult = checkInRes.result;
            if (checkInRes.result.success) {
              common_vendor.index.showToast({ title: "签到成功！", icon: "success" });
              this.loadStudents(true);
            }
            setTimeout(() => {
              this.scanResult = null;
            }, 3e3);
          } catch (err) {
            common_vendor.index.__f__("error", "at pages/teacher/teacher.vue:222", "扫码处理失败:", err);
            this.scanResult = { success: false, message: "二维码解析失败" };
          }
        },
        fail: (err) => {
          if (err.errMsg.indexOf("cancel") === -1) {
            common_vendor.index.showToast({ title: "扫码失败", icon: "none" });
          }
        }
      });
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.t($data.stats.total),
    b: common_vendor.t($data.stats.checked),
    c: common_vendor.t($data.stats.unchecked),
    d: $data.stats.total > 0
  }, $data.stats.total > 0 ? {
    e: $options.progressPercent + "%",
    f: common_vendor.t($options.progressPercent)
  } : {}, {
    g: common_vendor.o((...args) => $options.scanQRCode && $options.scanQRCode(...args), "4d"),
    h: $data.scanResult
  }, $data.scanResult ? common_vendor.e({
    i: common_vendor.t($data.scanResult.success ? "✅" : "❌"),
    j: common_vendor.t($data.scanResult.message),
    k: $data.scanResult.student
  }, $data.scanResult.student ? {
    l: common_vendor.t($data.scanResult.student.name)
  } : {}, {
    m: common_vendor.n($data.scanResult.success ? "result-ok" : "result-err")
  }) : {}, {
    n: common_vendor.n($data.filter === "all" ? "pill-active" : ""),
    o: common_vendor.o(($event) => $options.setFilter("all"), "9c"),
    p: common_vendor.n($data.filter === "checked" ? "pill-active" : ""),
    q: common_vendor.o(($event) => $options.setFilter("checked"), "22"),
    r: common_vendor.n($data.filter === "unchecked" ? "pill-active" : ""),
    s: common_vendor.o(($event) => $options.setFilter("unchecked"), "0e"),
    t: common_vendor.f($data.students, (item, k0, i0) => {
      return common_vendor.e({
        a: common_vendor.t(item.name.charAt(0)),
        b: common_vendor.n(item.checkedIn ? "avatar-ok" : "avatar-wait"),
        c: common_vendor.t(item.name),
        d: common_vendor.t(item.phone),
        e: common_vendor.t(item.checkedIn ? "已签到" : "未签到"),
        f: common_vendor.n(item.checkedIn ? "tag-checked" : "tag-unchecked"),
        g: item.checkedIn && item.checkInTimeStr
      }, item.checkedIn && item.checkInTimeStr ? {
        h: common_vendor.t(item.checkInTimeStr)
      } : {}, {
        i: item._id
      });
    }),
    v: $data.students.length === 0 && !$data.isLoading
  }, $data.students.length === 0 && !$data.isLoading ? {} : {}, {
    w: $data.hasMore
  }, $data.hasMore ? {
    x: common_vendor.t($data.isLoading ? "加载中..." : "加载更多"),
    y: common_vendor.o((...args) => $options.loadMore && $options.loadMore(...args), "5b")
  } : {});
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-c604c94d"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/teacher/teacher.js.map
