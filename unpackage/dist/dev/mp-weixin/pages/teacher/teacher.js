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
      scanResult: null,
      currentSession: null,
      showNewSessionModal: false,
      newSessionTitle: "",
      clearStudentsOption: false,
      newSessionLoading: false
    };
  },
  computed: {
    progressPercent() {
      if (this.stats.total === 0)
        return 0;
      return Math.round(this.stats.checked / this.stats.total * 100);
    }
  },
  async onShow() {
    const ok = await this.ensureTeacher();
    if (!ok)
      return;
    this.loadCurrentSession();
    this.loadStudents(true);
  },
  onPullDownRefresh() {
    this.loadStudents(true).then(() => {
      common_vendor.index.stopPullDownRefresh();
    });
  },
  methods: {
    async ensureTeacher() {
      let role = common_vendor.index.getStorageSync("role");
      if (role !== "teacher") {
        try {
          const res = await common_vendor.wx$1.cloud.callFunction({ name: "getRole" });
          const r = res && res.result ? res.result : {};
          role = r.role;
          if (role === "teacher")
            common_vendor.index.setStorageSync("role", "teacher");
        } catch (err) {
          common_vendor.index.__f__("error", "at pages/teacher/teacher.vue:215", err);
        }
      }
      if (role !== "teacher") {
        common_vendor.index.showModal({
          title: "无权限",
          content: "教师端仅限授权教师访问",
          showCancel: false,
          success: () => {
            common_vendor.index.reLaunch({ url: "/pages/index/index" });
          }
        });
        return false;
      }
      return true;
    },
    goAdmin() {
      common_vendor.index.navigateTo({ url: "/pages/admin/admin" });
    },
    goHistory() {
      common_vendor.index.navigateTo({ url: "/pages/sessions/sessions" });
    },
    endCurrentSession() {
      if (!this.currentSession)
        return;
      common_vendor.index.showModal({
        title: "结束当前活动",
        content: `确定要结束"${this.currentSession.title}"吗？结束后学生将无法继续签到，本次签到数据会保留在历史记录中。`,
        confirmColor: "#F59E0B",
        confirmText: "结束",
        success: async (res) => {
          if (!res.confirm)
            return;
          common_vendor.index.showLoading({ title: "结束中...", mask: true });
          try {
            const cloudRes = await common_vendor.wx$1.cloud.callFunction({ name: "endSession" });
            common_vendor.index.hideLoading();
            const r = cloudRes && cloudRes.result ? cloudRes.result : {};
            if (r.success) {
              common_vendor.index.showToast({ title: "活动已结束", icon: "success" });
              this.loadCurrentSession();
            } else {
              common_vendor.index.showToast({ title: r.message || "结束失败", icon: "none" });
            }
          } catch (err) {
            common_vendor.index.hideLoading();
            common_vendor.index.__f__("error", "at pages/teacher/teacher.vue:262", err);
            common_vendor.index.showToast({ title: "网络错误", icon: "none" });
          }
        }
      });
    },
    async loadCurrentSession() {
      try {
        const res = await common_vendor.wx$1.cloud.callFunction({ name: "getCurrentSession" });
        const r = res && res.result ? res.result : {};
        if (r.success) {
          this.currentSession = r.session;
        }
      } catch (err) {
        common_vendor.index.__f__("error", "at pages/teacher/teacher.vue:277", "获取当前活动失败:", err);
      }
    },
    startNewSession() {
      this.newSessionTitle = "";
      this.clearStudentsOption = false;
      this.showNewSessionModal = true;
    },
    closeNewSessionModal() {
      if (this.newSessionLoading)
        return;
      this.showNewSessionModal = false;
    },
    toggleClearStudents() {
      this.clearStudentsOption = !this.clearStudentsOption;
    },
    async submitNewSession() {
      if (this.clearStudentsOption) {
        const confirmed = await new Promise((resolve) => {
          common_vendor.index.showModal({
            title: "再次确认",
            content: "开启后将删除所有学生数据，此操作不可恢复！确定继续？",
            confirmColor: "#EF4444",
            success: (r) => resolve(r.confirm)
          });
        });
        if (!confirmed)
          return;
      }
      this.newSessionLoading = true;
      try {
        const cloudRes = await common_vendor.wx$1.cloud.callFunction({
          name: "startSession",
          data: {
            title: this.newSessionTitle.trim(),
            clearStudents: this.clearStudentsOption
          }
        });
        const r = cloudRes && cloudRes.result ? cloudRes.result : {};
        if (r.success) {
          common_vendor.index.showToast({ title: "已开启新活动", icon: "success" });
          this.showNewSessionModal = false;
          this.newSessionLoading = false;
          this.loadCurrentSession();
          this.loadStudents(true);
        } else {
          this.newSessionLoading = false;
          common_vendor.index.showToast({ title: r.message || "开启失败", icon: "none" });
        }
      } catch (err) {
        this.newSessionLoading = false;
        common_vendor.index.__f__("error", "at pages/teacher/teacher.vue:333", err);
        common_vendor.index.showToast({ title: "网络错误", icon: "none" });
      }
    },
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
        common_vendor.index.__f__("error", "at pages/teacher/teacher.vue:368", "加载学生列表失败:", err);
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
    parseQRContent(raw) {
      if (typeof raw !== "string")
        return null;
      if (raw.startsWith("CKIN|")) {
        const parts = raw.split("|");
        if (parts.length < 3)
          return null;
        return { studentId: parts[1], timestamp: Number(parts[2]) };
      }
      try {
        const obj = JSON.parse(raw);
        if (obj && obj.type === "checkin" && obj.studentId) {
          return { studentId: obj.studentId, timestamp: Number(obj.timestamp) || 0 };
        }
      } catch (e) {
      }
      return null;
    },
    scanQRCode() {
      common_vendor.index.scanCode({
        onlyFromCamera: true,
        scanType: ["qrCode"],
        success: async (res) => {
          try {
            common_vendor.index.__f__("log", "at pages/teacher/teacher.vue:417", "[scan] raw:", res.result);
            const qrData = this.parseQRContent(res.result);
            if (!qrData || !qrData.studentId) {
              this.scanResult = { success: false, message: "无效的签到二维码" };
              setTimeout(() => {
                this.scanResult = null;
              }, 3e3);
              return;
            }
            const now = Date.now();
            if (qrData.timestamp && now - qrData.timestamp > 5 * 60 * 1e3) {
              this.scanResult = { success: false, message: "二维码已过期，请让学生重新生成" };
              setTimeout(() => {
                this.scanResult = null;
              }, 3e3);
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
              this.loadCurrentSession();
              this.loadStudents(true);
            }
            setTimeout(() => {
              this.scanResult = null;
            }, 3e3);
          } catch (err) {
            common_vendor.index.__f__("error", "at pages/teacher/teacher.vue:450", "扫码处理失败:", err);
            this.scanResult = { success: false, message: "扫码处理失败" };
            setTimeout(() => {
              this.scanResult = null;
            }, 3e3);
          }
        },
        fail: (err) => {
          if (err.errMsg && err.errMsg.indexOf("cancel") === -1) {
            common_vendor.index.showToast({ title: "扫码失败", icon: "none" });
          }
        }
      });
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: $data.currentSession
  }, $data.currentSession ? {
    b: common_vendor.t($data.currentSession.title),
    c: common_vendor.o((...args) => $options.endCurrentSession && $options.endCurrentSession(...args), "18")
  } : {}, {
    d: common_vendor.t($data.stats.total),
    e: common_vendor.t($data.stats.checked),
    f: common_vendor.t($data.stats.unchecked),
    g: $data.stats.total > 0
  }, $data.stats.total > 0 ? {
    h: $options.progressPercent + "%",
    i: common_vendor.t($options.progressPercent)
  } : {}, {
    j: common_vendor.o((...args) => $options.scanQRCode && $options.scanQRCode(...args), "9a"),
    k: common_vendor.o((...args) => $options.startNewSession && $options.startNewSession(...args), "ec"),
    l: common_vendor.o((...args) => $options.goHistory && $options.goHistory(...args), "a7"),
    m: common_vendor.o((...args) => $options.goAdmin && $options.goAdmin(...args), "d2"),
    n: $data.scanResult
  }, $data.scanResult ? common_vendor.e({
    o: common_vendor.t($data.scanResult.success ? "✅" : "❌"),
    p: common_vendor.t($data.scanResult.message),
    q: $data.scanResult.student
  }, $data.scanResult.student ? {
    r: common_vendor.t($data.scanResult.student.name)
  } : {}, {
    s: common_vendor.n($data.scanResult.success ? "result-ok" : "result-err")
  }) : {}, {
    t: common_vendor.n($data.filter === "all" ? "pill-active" : ""),
    v: common_vendor.o(($event) => $options.setFilter("all"), "bc"),
    w: common_vendor.n($data.filter === "checked" ? "pill-active" : ""),
    x: common_vendor.o(($event) => $options.setFilter("checked"), "46"),
    y: common_vendor.n($data.filter === "unchecked" ? "pill-active" : ""),
    z: common_vendor.o(($event) => $options.setFilter("unchecked"), "69"),
    A: common_vendor.f($data.students, (item, k0, i0) => {
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
    B: $data.students.length === 0 && !$data.isLoading
  }, $data.students.length === 0 && !$data.isLoading ? {} : {}, {
    C: $data.hasMore
  }, $data.hasMore ? {
    D: common_vendor.t($data.isLoading ? "加载中..." : "加载更多"),
    E: common_vendor.o((...args) => $options.loadMore && $options.loadMore(...args), "d2")
  } : {}, {
    F: $data.showNewSessionModal
  }, $data.showNewSessionModal ? common_vendor.e({
    G: $data.newSessionTitle,
    H: common_vendor.o(($event) => $data.newSessionTitle = $event.detail.value, "5f"),
    I: $data.clearStudentsOption
  }, $data.clearStudentsOption ? {} : {}, {
    J: common_vendor.n($data.clearStudentsOption ? "ns-checkbox-on" : ""),
    K: common_vendor.o((...args) => $options.toggleClearStudents && $options.toggleClearStudents(...args), "86"),
    L: common_vendor.t($data.newSessionLoading ? "开启中..." : "确认开启"),
    M: common_vendor.o((...args) => $options.submitNewSession && $options.submitNewSession(...args), "66"),
    N: $data.newSessionLoading,
    O: common_vendor.o((...args) => $options.closeNewSessionModal && $options.closeNewSessionModal(...args), "bf"),
    P: common_vendor.o(() => {
    }, "da"),
    Q: common_vendor.o((...args) => $options.closeNewSessionModal && $options.closeNewSessionModal(...args), "44")
  }) : {});
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-c604c94d"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/teacher/teacher.js.map
