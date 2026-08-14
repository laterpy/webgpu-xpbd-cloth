import { App } from './app/App';
import './style.css';

let appInstance: App | null = null;

async function bootstrap() {
  appInstance = new App('#app');
  await appInstance.init();
  appInstance.start();
}

bootstrap().catch((err) => {
  console.error('Spatial Memory Gallery startup failed:', err);
  const appEl = document.querySelector('#app');
  if (appEl) {
    const errorBox = document.createElement('div');
    errorBox.className = 'hud-error';
    errorBox.textContent = `启动失败：${err instanceof Error ? err.message : String(err)}`;
    appEl.appendChild(errorBox);
  }
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    appInstance?.dispose();
    appInstance = null;
  });
}
