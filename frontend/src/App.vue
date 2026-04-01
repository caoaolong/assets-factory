<script lang="ts" setup>
import {darkTheme, dateZhCN, zhCN} from 'naive-ui';
import type {MenuOption} from 'naive-ui';
import {computed, nextTick, onMounted, onUnmounted, ref, watch} from 'vue';
import {DockLayout, type DockLayoutInterface} from '@imengyu/vue-dock-layout';
import {
  applyDocumentTheme,
  applyWailsWindowChrome,
  isWailsRuntime,
} from './theme/applyTheme';
import {resolveEffectiveTheme, type ThemePreference} from './theme/settings';
import {loadUserProfile, scheduleSaveUserProfile} from './config/userProfile';
import {Quit} from '../wailsjs/runtime/runtime.js';
import DebugView from './views/DebugView.vue';
import InspectorView from './views/InspectorView.vue';
import LogView from './views/LogView.vue';
import PreferencesView from './views/PreferencesView.vue';
import ProjectOutlineView from './views/ProjectOutlineView.vue';
import ProjectSettingsView from './views/ProjectSettingsView.vue';
import WorkspaceView from './views/WorkspaceView.vue';

const dockLayout = ref<DockLayoutInterface>();

const profileReady = ref(false);
/** 当前激活的 dock 面板 key（用于判断编辑区内「项目设置」等标签是否在前台） */
const activeDockPanelKey = ref('workspace');
const themePreference = ref<ThemePreference>('system');
const systemIsDark = ref(
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : true,
);

const effectiveDockTheme = computed(() =>
  resolveEffectiveTheme(themePreference.value, systemIsDark.value),
);

const naiveTheme = computed(() =>
  effectiveDockTheme.value === 'dark' ? darkTheme : null,
);

watch(
  [themePreference, systemIsDark],
  () => {
    applyDocumentTheme(
      resolveEffectiveTheme(themePreference.value, systemIsDark.value),
    );
    applyWailsWindowChrome(themePreference.value);
  },
  {immediate: true},
);

watch(themePreference, () => {
  if (!profileReady.value) {
    return;
  }
  scheduleSaveUserProfile({theme: themePreference.value});
});

let mediaQuery: MediaQueryList | null = null;

/** 中间编辑区：可关闭面板（项目设置、首选项）的 key */
const PANEL_PROJECT_SETTINGS = 'panel-project-settings';
const PANEL_PREFERENCES = 'panel-preferences';

/**
 * 与官方示例一致：addPanel 时声明 closeable；已存在同 key 时库会移回目标网格，再 activePanel 即可聚焦。
 */
function openOrFocusClosableEditorTab(key: string, title: string) {
  void nextTick(() => {
    requestAnimationFrame(() => {
      const api = dockLayout.value;
      if (!api) {
        return;
      }
      api.addPanel({key, title, closeable: true}, 'editor');
      api.activePanel(key);
    });
  });
}

function onSystemSchemeChange(ev: MediaQueryListEvent) {
  systemIsDark.value = ev.matches;
}

function onGlobalKeydown(ev: KeyboardEvent) {
  if ((ev.ctrlKey || ev.metaKey) && ev.key === ',') {
    ev.preventDefault();
    openOrFocusClosableEditorTab(PANEL_PREFERENCES, '首选项');
  }
}

function onDockActiveTabChange(
  current: {key?: string} | null,
  _last: unknown,
) {
  if (current && typeof current.key === 'string') {
    activeDockPanelKey.value = current.key;
  }
}

/** 水平菜单栏：顶层「文件 / 编辑」+ 子项，与桌面应用习惯一致 */
const menubarOptions: MenuOption[] = [
  {
    label: '文件',
    key: 'menu-file',
    children: [
      {label: '新建', key: 'file-new'},
      {type: 'divider', key: 'fd1'},
      {label: '项目设置', key: 'file-project-settings'},
      {label: '首选项…', key: 'file-prefs'},
      {type: 'divider', key: 'fd2'},
      {label: '退出', key: 'file-quit'},
    ],
  },
  {
    label: '编辑',
    key: 'menu-edit',
    children: [
      {label: '撤销', key: 'edit-undo'},
      {label: '重做', key: 'edit-redo'},
      {type: 'divider', key: 'ed1'},
      {label: '剪切', key: 'edit-cut'},
      {label: '复制', key: 'edit-copy'},
      {label: '粘贴', key: 'edit-paste'},
    ],
  },
];

function handleMenubarSelect(key: string | number) {
  const k = String(key);
  if (k === 'file-prefs') {
    openOrFocusClosableEditorTab(PANEL_PREFERENCES, '首选项');
  } else if (k === 'file-project-settings') {
    openOrFocusClosableEditorTab(PANEL_PROJECT_SETTINGS, '项目设置');
  } else if (k === 'file-quit' && isWailsRuntime()) {
    Quit();
  }
  // file-new、edit-*：占位
}

/**
 * 主界面：@imengyu/vue-dock-layout
 * 左：工程大纲 | 右：属性/检查器 | 中上：工作区（项目设置/首选项由菜单动态打开并可关闭） | 中下：日志 + 调试
 */
function initWorkbenchDock(api: DockLayoutInterface | undefined) {
  if (!api) {
    return;
  }
  api.setData({
    name: 'root',
    size: 0,
    grids: [
      {size: 18, name: 'left', alwaysVisible: true},
      {
        size: 62,
        name: 'center',
        alwaysVisible: true,
        grids: [
          {size: 72, name: 'editor', alwaysVisible: true},
          {size: 28, name: 'terminal', alwaysVisible: true},
        ],
      },
      {size: 20, name: 'right', alwaysVisible: true},
    ],
  });
  api.addPanels([{key: 'project-outline', title: '工程大纲'}], 'left');
  api.addPanels([{key: 'workspace', title: '工作区'}], 'editor');
  api.addPanels(
    [
      {key: 'panel-log', title: '日志'},
      {key: 'panel-debug', title: '调试'},
    ],
    'terminal',
  );
  api.addPanels([{key: 'inspector', title: '属性'}], 'right');
}

onMounted(() => {
  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', onSystemSchemeChange);
  window.addEventListener('keydown', onGlobalKeydown);

  void loadUserProfile().then((p) => {
    themePreference.value = p.theme;
    profileReady.value = true;
  });

  nextTick(() => {
    requestAnimationFrame(() => {
      initWorkbenchDock(dockLayout.value);
    });
  });
});

onUnmounted(() => {
  mediaQuery?.removeEventListener('change', onSystemSchemeChange);
  window.removeEventListener('keydown', onGlobalKeydown);
});
</script>

<template>
  <n-config-provider :theme="naiveTheme" :locale="zhCN" :date-locale="dateZhCN">
    <!-- Wails/WebView2 下 n-layout 中间区易塌缩；改用 Grid 与 dock-shell 的绝对定位配合 -->
    <div class="provider-surface">
      <div
        class="app-frame"
        :class="{'dock-palette--light': effectiveDockTheme === 'light'}"
      >
        <header class="app-menubar">
          <n-menu
            mode="horizontal"
            :options="menubarOptions"
            class="app-menubar-menu"
            @update:value="handleMenubarSelect"
          />
        </header>

        <div class="dock-wrap">
          <main class="dock-shell">
          <!-- vue-dock-layout：左工程大纲 · 中上工作区 · 中下日志|调试 · 右检查器 -->
          <DockLayout
            ref="dockLayout"
            class="dock-fill"
            :theme="effectiveDockTheme"
            :allow-float-window="false"
            @active-tab-change="onDockActiveTabChange"
          >
            <!-- 库内默认用 webpack require 加载 svg，在 Vite 下会失效；用插槽提供关闭图标 -->
            <template #tabCloseIconRender>
              <svg
                class="dock-tab-close-icon"
                viewBox="0 0 12 12"
                width="14"
                height="14"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  d="M2.5 2.5 L9.5 9.5 M9.5 2.5 L2.5 9.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.4"
                  stroke-linecap="round"
                />
              </svg>
            </template>
            <template #emptyPanel>
              <div class="dock-empty" />
            </template>
            <template #panelRender="{ panel }">
              <ProjectOutlineView v-if="panel.key === 'project-outline'" />
              <WorkspaceView v-else-if="panel.key === 'workspace'" />
              <ProjectSettingsView
                v-else-if="panel.key === PANEL_PROJECT_SETTINGS"
                :visible="activeDockPanelKey === PANEL_PROJECT_SETTINGS"
              />
              <PreferencesView
                v-else-if="panel.key === PANEL_PREFERENCES"
                :theme="themePreference"
                @update:theme="themePreference = $event"
              />
              <LogView v-else-if="panel.key === 'panel-log'" />
              <DebugView v-else-if="panel.key === 'panel-debug'" />
              <InspectorView v-else-if="panel.key === 'inspector'" />
              <div v-else class="workbench-dock-panel">
                <h3>{{ panel.title }}</h3>
                <p class="muted">未知面板：{{ panel.key }}</p>
              </div>
            </template>
          </DockLayout>
          </main>
        </div>

        <footer class="app-status">
          <n-space :size="16">
            <span>main</span>
            <span>TypeScript</span>
            <span>UTF-8</span>
            <span>Ln 18, Col 5</span>
          </n-space>
        </footer>
      </div>
    </div>

  </n-config-provider>
</template>

<style scoped>
.provider-surface {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-frame {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: grid;
  grid-template-rows: auto 1fr auto;
  grid-template-columns: minmax(0, 1fr);
  overflow: hidden;
}

.app-menubar {
  grid-row: 1;
  height: 28px;
  padding: 0 4px 0 8px;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  border-bottom: 1px solid var(--n-border-color);
  background: var(--n-color-embedded);
}

.app-menubar-menu {
  flex: 1;
  min-width: 0;
}

.app-menubar-menu :deep(.n-menu-item-content) {
  padding: 0 12px;
}

.app-menubar-menu :deep(.n-menu-item-content__icon) {
  margin-right: 6px;
}

.dock-wrap {
  grid-row: 2;
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.dock-shell {
  position: relative;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  height: 100%;
}

.dock-fill {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}

.app-status {
  grid-row: 3;
  height: 26px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  font-size: 12px;
  background: var(--n-primary-color);
  color: #fff;
  box-sizing: border-box;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
}

:deep(.dock-host) {
  width: 100%;
  height: 100%;
}

:deep(.dock-split) {
  width: 100%;
  height: 100%;
}

:deep(.dock-split-host) {
  box-sizing: border-box;
}

:deep(.dock-panel-tab),
:deep(.dock-panel-tab-list) {
  background-color: #252a35;
}

.dock-palette--light :deep(.dock-panel-tab),
.dock-palette--light :deep(.dock-panel-tab-list) {
  background-color: #eceff2;
}

:deep(.dock-panel-tab.active) {
  background-color: #1f6feb;
}

.dock-palette--light :deep(.dock-panel-tab.active) {
  background-color: #0078d4;
}

:deep(.dock-empty) {
  min-height: 100%;
}

/* tab 关闭按钮：与库 .close-icon 尺寸一致，随标签文字色 */
:deep(.dock-tab-close-icon) {
  display: block;
  color: inherit;
  opacity: 0.9;
}

.dock-palette--light :deep(.dock-tab-close-icon) {
  opacity: 0.75;
}
</style>
