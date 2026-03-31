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
import {
  loadThemePreference,
  resolveEffectiveTheme,
  saveThemePreference,
  type ThemePreference,
} from './theme/settings';
import {Quit} from '../wailsjs/runtime/runtime.js';
import DebugView from './views/DebugView.vue';
import InspectorView from './views/InspectorView.vue';
import LogView from './views/LogView.vue';
import ProjectOutlineView from './views/ProjectOutlineView.vue';
import WorkspaceView from './views/WorkspaceView.vue';

const dockLayout = ref<DockLayoutInterface>();

const preferencesOpen = ref(false);
const themePreference = ref<ThemePreference>(loadThemePreference());
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
    saveThemePreference(themePreference.value);
    applyDocumentTheme(
      resolveEffectiveTheme(themePreference.value, systemIsDark.value),
    );
    applyWailsWindowChrome(themePreference.value);
  },
  {immediate: true},
);

let mediaQuery: MediaQueryList | null = null;

function onSystemSchemeChange(ev: MediaQueryListEvent) {
  systemIsDark.value = ev.matches;
}

function onGlobalKeydown(ev: KeyboardEvent) {
  if ((ev.ctrlKey || ev.metaKey) && ev.key === ',') {
    ev.preventDefault();
    preferencesOpen.value = true;
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
    preferencesOpen.value = true;
  } else if (k === 'file-quit' && isWailsRuntime()) {
    Quit();
  }
  // file-new、edit-*：占位
}

/**
 * 主界面：@imengyu/vue-dock-layout
 * 左：工程大纲 | 右：属性/检查器 | 中上：工作区 | 中下：日志 + 调试（各 1 个面板）
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
          >
            <template #emptyPanel>
              <div class="dock-empty" />
            </template>
            <template #panelRender="{ panel }">
              <ProjectOutlineView v-if="panel.key === 'project-outline'" />
              <WorkspaceView v-else-if="panel.key === 'workspace'" />
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

    <n-modal
      v-model:show="preferencesOpen"
      preset="card"
      title="设置"
      :bordered="false"
      style="width: min(440px, calc(100vw - 24px))"
    >
      <n-form label-placement="left" label-align="right" label-width="72">
        <n-form-item label="主题">
          <n-radio-group v-model:value="themePreference">
            <n-space vertical :size="10">
              <n-radio value="system">跟随系统</n-radio>
              <n-radio value="light">亮色</n-radio>
              <n-radio value="dark">暗色</n-radio>
            </n-space>
          </n-radio-group>
        </n-form-item>
      </n-form>
    </n-modal>
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
</style>
