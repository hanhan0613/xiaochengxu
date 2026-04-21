import App from './App'
import { createSSRApp } from 'vue'
import PrivacyPopup from './components/privacy-popup/privacy-popup.vue'

export function createApp() {
  const app = createSSRApp(App)
  app.component('privacy-popup', PrivacyPopup)
  return {
    app
  }
}
