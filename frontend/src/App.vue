<script lang="ts" setup>
import {darkTheme, dateZhCN, zhCN} from 'naive-ui';
import {computed, nextTick, onMounted, onUnmounted, ref, watch} from 'vue';
import {
  DockLayout,
  type DockData,
  type DockLayoutInterface,
} from '@imengyu/vue-dock-layout';
import {
  applyDocumentTheme,
  applyWailsWindowChrome,
  isWailsRuntime,
} from './theme/applyTheme';
import {resolveEffectiveTheme, type ThemePreference} from './theme/settings';
import {loadUserProfile} from './config/userProfile';
import {
  Quit,
  WindowIsMaximised,
  WindowMinimise,
  WindowToggleMaximise,
} from '../wailsjs/runtime/runtime.js';
import DebugView from './views/DebugView.vue';
import InspectorView from './views/InspectorView.vue';
import LogView from './views/LogView.vue';
import PreferencesView from './views/PreferencesView.vue';
import ProjectOutlineView from './views/ProjectOutlineView.vue';
import NodeListView from './views/NodeListView.vue';
import ProjectSettingsView from './views/ProjectSettingsView.vue';
import WorkspaceView from './views/WorkspaceView.vue';
import AppMenuBar from './components/AppMenuBar.vue';
import type {AppMenuGroup} from './components/AppMenuBar.vue';

const dockLayout = ref<DockLayoutInterface>();

/** DockLayout 实例上除 Interface 外的方法（用于折叠侧栏/底栏） */
type DockLayoutVm = DockLayoutInterface & {
  findGrid: (name: string) => DockData | null;
  forceFlushAllPanelPos: () => void;
};

function getDockVm(): DockLayoutVm | undefined {
  return dockLayout.value as DockLayoutVm | undefined;
}

/** 折叠时侧栏宽度不能为 0，否则库会按「均分」处理；用极小占比代替隐藏 */
const DOCK_HIDE_EPS = 0.01;

const panelLeftVisible = ref(true);
const panelRightVisible = ref(true);
const panelBottomVisible = ref(true);

/** 展开时恢复的占比（在每次收起前从当前布局读取） */
const savedDockSizes = {
  left: 18,
  right: 20,
  terminal: 28,
};

function flushDockLayout() {
  void nextTick(() => {
    requestAnimationFrame(() => {
      getDockVm()?.forceFlushAllPanelPos();
    });
  });
}

function toggleDockLeft() {
  const vm = getDockVm();
  const left = vm?.findGrid('left');
  const center = vm?.findGrid('center');
  if (!left || !center) {
    return;
  }
  const eps = DOCK_HIDE_EPS;
  if (panelLeftVisible.value) {
    savedDockSizes.left = left.size;
    center.size += left.size - eps;
    left.size = eps;
    panelLeftVisible.value = false;
  } else {
    center.size -= savedDockSizes.left - eps;
    left.size = savedDockSizes.left;
    panelLeftVisible.value = true;
  }
  flushDockLayout();
}

function toggleDockRight() {
  const vm = getDockVm();
  const right = vm?.findGrid('right');
  const center = vm?.findGrid('center');
  if (!right || !center) {
    return;
  }
  const eps = DOCK_HIDE_EPS;
  if (panelRightVisible.value) {
    savedDockSizes.right = right.size;
    center.size += right.size - eps;
    right.size = eps;
    panelRightVisible.value = false;
  } else {
    center.size -= savedDockSizes.right - eps;
    right.size = savedDockSizes.right;
    panelRightVisible.value = true;
  }
  flushDockLayout();
}

function toggleDockBottom() {
  const vm = getDockVm();
  const terminal = vm?.findGrid('terminal');
  const editor = vm?.findGrid('editor');
  if (!terminal || !editor) {
    return;
  }
  const eps = DOCK_HIDE_EPS;
  if (panelBottomVisible.value) {
    savedDockSizes.terminal = terminal.size;
    editor.size += terminal.size - eps;
    terminal.size = eps;
    panelBottomVisible.value = false;
  } else {
    editor.size -= savedDockSizes.terminal - eps;
    terminal.size = savedDockSizes.terminal;
    panelBottomVisible.value = true;
  }
  flushDockLayout();
}

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

const isDark = computed(() => effectiveDockTheme.value === 'dark');

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

let mediaQuery: MediaQueryList | null = null;

/** 无边框窗口时标题栏可拖拽；与 Wails --wails-draggable 配合 */
const useFramelessChrome = computed(() => isWailsRuntime());

const windowMaximized = ref(false);

async function syncWindowMaximized() {
  if (!isWailsRuntime()) {
    return;
  }
  try {
    windowMaximized.value = await WindowIsMaximised();
  } catch {
    /* devtools / 非宿主 */
  }
}

function onTitlebarMinimize() {
  if (isWailsRuntime()) {
    WindowMinimise();
  }
}

async function onTitlebarMaximizeToggle() {
  if (!isWailsRuntime()) {
    return;
  }
  WindowToggleMaximise();
  await syncWindowMaximized();
}

function onTitlebarClose() {
  if (isWailsRuntime()) {
    Quit();
  }
}

function onWindowFocusResyncMax() {
  void syncWindowMaximized();
}

/** 中间编辑区：可关闭面板（项目设置、首选项、节点列表）的 key */
const PANEL_PROJECT_SETTINGS = 'panel-project-settings';
const PANEL_PREFERENCES = 'panel-preferences';
const PANEL_NODE_LIST = 'panel-node-list';

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

function onGlobalKeydown(_ev: KeyboardEvent) {
  // AppMenuBar 组件内置了快捷键拦截，此处留空备扩展
}

function onDockActiveTabChange(
  current: {key?: string} | null,
  _last: unknown,
) {
  if (current && typeof current.key === 'string') {
    activeDockPanelKey.value = current.key;
  }
}

/** 菜单数据：顶层「文件 / 编辑」+ 子项（含快捷键 & Alt 助记键） */
const appMenus: AppMenuGroup[] = [
  {
    label: '文件(F)',
    altKey: 'F',
    key: 'menu-file',
    children: [
      {label: '新建', key: 'file-new', shortcut: 'Ctrl+N'},
      {type: 'divider', label: '', key: 'fd1'},
      {
        label: '项目设置',
        key: 'file-project-settings',
        action: () =>
          openOrFocusClosableEditorTab(PANEL_PROJECT_SETTINGS, '项目设置'),
      },
      {
        label: '首选项…',
        key: 'file-prefs',
        shortcut: 'Ctrl+,',
        action: () =>
          openOrFocusClosableEditorTab(PANEL_PREFERENCES, '首选项'),
      },
      {type: 'divider', label: '', key: 'fd2'},
      {
        label: '退出',
        key: 'file-quit',
        shortcut: 'Alt+F4',
        action: () => {
          if (isWailsRuntime()) Quit();
        },
      },
    ],
  },
  {
    label: '编辑(E)',
    altKey: 'E',
    key: 'menu-edit',
    children: [
      {label: '撤销', key: 'edit-undo', shortcut: 'Ctrl+Z'},
      {label: '重做', key: 'edit-redo', shortcut: 'Ctrl+Y'},
      {type: 'divider', label: '', key: 'ed1'},
      {label: '剪切', key: 'edit-cut', shortcut: 'Ctrl+X'},
      {label: '复制', key: 'edit-copy', shortcut: 'Ctrl+C'},
      {label: '粘贴', key: 'edit-paste', shortcut: 'Ctrl+V'},
    ],
  },
  {
    label: '文档(D)',
    altKey: 'D',
    key: 'menu-doc',
    children: [
      {
        label: '节点列表',
        key: 'doc-node-list',
        action: () =>
          openOrFocusClosableEditorTab(PANEL_NODE_LIST, '节点列表'),
      },
    ],
  },
];

function handleMenubarSelect(_key: string) {
  // action 已在菜单项定义中内联，此处留空备扩展
}

/**
 * 主界面：@imengyu/vue-dock-layout
 * 左：工程大纲 | 右：属性/检查器 | 中上：工作区（项目设置/首选项/节点列表等可关闭标签） | 中下：日志 + 调试
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
  window.addEventListener('focus', onWindowFocusResyncMax);

  void syncWindowMaximized();

  void loadUserProfile().then((p) => {
    themePreference.value = p.theme;
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
  window.removeEventListener('focus', onWindowFocusResyncMax);
});
</script>

<template>
  <n-config-provider
    :theme="naiveTheme"
    :locale="zhCN"
    :date-locale="dateZhCN"
  >
    <!-- Wails/WebView2 下 n-layout 中间区易塌缩；改用 Grid 与 dock-shell 的绝对定位配合 -->
    <div class="provider-surface">
      <div
        class="app-frame"
        :class="{'dock-palette--light': effectiveDockTheme === 'light'}"
      >
        <header
          class="app-menubar"
          :class="{
            'app-menubar--wails-drag': useFramelessChrome,
            'app-menubar--frameless': useFramelessChrome,
          }"
        >
          <div class="app-menubar-leading">
            <img
              src="/app-logo.svg"
              width="20"
              height="20"
              class="app-menubar-logo"
              alt=""
            />
          </div>
          <div class="app-menubar-no-drag app-menubar-menu-wrap">
            <AppMenuBar
              :menus="appMenus"
              :is-dark="isDark"
              @select="handleMenubarSelect"
            />
          </div>
          <!-- 可拖拽空白区：移动无边框窗体（与 Wails --wails-draggable 继承自标题栏） -->
          <div
            class="app-menubar-drag-spacer"
            aria-hidden="true"
          />
          <div class="app-menubar-no-drag app-menubar-actions">
            <n-tooltip placement="bottom" trigger="hover">
              <template #trigger>
                <button
                  type="button"
                  class="app-menubar-icon-btn"
                  :aria-pressed="panelRightVisible"
                  :aria-label="
                    panelRightVisible ? '收起右侧面板' : '展开右侧面板'
                  "
                  @click="toggleDockRight"
                >
                  <span
                    class="codicon"
                    :class="
                      panelRightVisible
                        ? 'codicon-layout-sidebar-right'
                        : 'codicon-layout-sidebar-right-off'
                    "
                    aria-hidden="true"
                  />
                </button>
              </template>
              {{ panelRightVisible ? '收起检查器' : '展开检查器' }}
            </n-tooltip>
            <n-tooltip placement="bottom" trigger="hover">
              <template #trigger>
                <button
                  type="button"
                  class="app-menubar-icon-btn"
                  :aria-pressed="panelLeftVisible"
                  :aria-label="
                    panelLeftVisible ? '收起左侧面板' : '展开左侧面板'
                  "
                  @click="toggleDockLeft"
                >
                  <span
                    class="codicon"
                    :class="
                      panelLeftVisible
                        ? 'codicon-layout-sidebar-left'
                        : 'codicon-layout-sidebar-left-off'
                    "
                    aria-hidden="true"
                  />
                </button>
              </template>
              {{ panelLeftVisible ? '收起工程大纲' : '展开工程大纲' }}
            </n-tooltip>
            <n-tooltip placement="bottom" trigger="hover">
              <template #trigger>
                <button
                  type="button"
                  class="app-menubar-icon-btn"
                  :aria-pressed="panelBottomVisible"
                  :aria-label="
                    panelBottomVisible ? '收起底部面板' : '展开底部面板'
                  "
                  @click="toggleDockBottom"
                >
                  <span
                    class="codicon"
                    :class="
                      panelBottomVisible
                        ? 'codicon-layout-panel'
                        : 'codicon-layout-panel-off'
                    "
                    aria-hidden="true"
                  />
                </button>
              </template>
              {{ panelBottomVisible ? '收起日志/调试' : '展开日志/调试' }}
            </n-tooltip>
          </div>
          <div
            v-if="useFramelessChrome"
            class="app-menubar-no-drag app-menubar-window-controls"
          >
            <n-tooltip placement="bottom" trigger="hover">
              <template #trigger>
                <button
                  type="button"
                  class="app-menubar-win-btn"
                  aria-label="最小化"
                  @click="onTitlebarMinimize"
                >
                  <span
                    class="codicon codicon-chrome-minimize"
                    aria-hidden="true"
                  />
                </button>
              </template>
              最小化
            </n-tooltip>
            <n-tooltip placement="bottom" trigger="hover">
              <template #trigger>
                <button
                  type="button"
                  class="app-menubar-win-btn"
                  :aria-label="windowMaximized ? '还原' : '最大化'"
                  @click="onTitlebarMaximizeToggle"
                >
                  <span
                    class="codicon"
                    :class="
                      windowMaximized
                        ? 'codicon-chrome-restore'
                        : 'codicon-chrome-maximize'
                    "
                    aria-hidden="true"
                  />
                </button>
              </template>
              {{ windowMaximized ? '还原' : '最大化' }}
            </n-tooltip>
            <n-tooltip placement="bottom" trigger="hover">
              <template #trigger>
                <button
                  type="button"
                  class="app-menubar-win-btn app-menubar-win-btn--close"
                  aria-label="关闭"
                  @click="onTitlebarClose"
                >
                  <span
                    class="codicon codicon-chrome-close"
                    aria-hidden="true"
                  />
                </button>
              </template>
              关闭
            </n-tooltip>
          </div>
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
              <NodeListView
                v-else-if="panel.key === PANEL_NODE_LIST"
                :visible="activeDockPanelKey === PANEL_NODE_LIST"
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
  height: 32px;
  padding: 0 8px 0 10px;
  display: flex;
  align-items: stretch;
  gap: 0;
  box-sizing: border-box;
  border-bottom: 1px solid var(--n-border-color);
  background: var(--n-color-embedded);
  font-family: 'Segoe UI', 'Microsoft YaHei UI', 'Microsoft YaHei', sans-serif;
}

.app-menubar--frameless {
  padding-right: 0;
}

/* 无边框窗口：整块标题栏可拖拽，子项用 .app-menubar-no-drag 排除 */
.app-menubar--wails-drag {
  --wails-draggable: drag;
}

.app-menubar-no-drag {
  --wails-draggable: no-drag;
}

.app-menubar-leading {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  padding-right: 6px;
}

.app-menubar-logo {
  display: block;
  flex-shrink: 0;
  border-radius: 4px;
  user-select: none;
}

.app-menubar-window-controls {
  display: flex;
  align-items: center;
  gap: 0;
}

.app-menubar-win-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 2px;
  background: transparent;
  color: var(--n-text-color);
  cursor: pointer;
}

.app-menubar-win-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.dock-palette--light .app-menubar-win-btn:hover {
  background: rgba(0, 0, 0, 0.06);
}

.app-menubar-win-btn--close:hover {
  background: #e81123;
  color: #fff;
}

.app-menubar-win-btn .codicon {
  font-size: 14px;
  line-height: 1;
}

.app-menubar-menu-wrap {
  flex: 0 0 auto;
  max-width: 100%;
  display: flex;
  align-items: stretch;
}

.app-menubar-drag-spacer {
  flex: 1 1 auto;
  min-width: 24px;
  align-self: stretch;
}

.app-menubar-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 2px;
  padding: 0 6px;
}

.app-menubar-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: var(--n-text-color);
  cursor: pointer;
}

.app-menubar-icon-btn:hover {
  background: rgba(255, 255, 255, 0.08);
}

.dock-palette--light .app-menubar-icon-btn:hover {
  background: rgba(0, 0, 0, 0.06);
}

.app-menubar-icon-btn .codicon {
  font-size: 15px;
  line-height: 1;
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
