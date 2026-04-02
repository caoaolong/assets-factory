<script lang="ts" setup>
import {ref, onMounted, onUnmounted, nextTick, computed} from 'vue';

/* ------------------------------------------------------------------ */
/*  类型定义                                                           */
/* ------------------------------------------------------------------ */

export interface AppMenuItem {
  label: string;
  /** Alt 快捷键：下划线字母（如 'F' 对应 Alt+F） */
  altKey?: string;
  key: string;
  shortcut?: string;
  disabled?: boolean;
  action?: () => void;
  children?: AppMenuItem[];
  type?: 'item' | 'divider';
}

export interface AppMenuGroup {
  label: string;
  altKey?: string;
  key: string;
  children: AppMenuItem[];
}

/* ------------------------------------------------------------------ */
/*  Props / Emits                                                      */
/* ------------------------------------------------------------------ */

const props = defineProps<{
  menus: AppMenuGroup[];
  isDark?: boolean;
}>();

const emit = defineEmits<{
  (e: 'select', key: string): void;
}>();

/* ------------------------------------------------------------------ */
/*  状态                                                               */
/* ------------------------------------------------------------------ */

const openMenuKey = ref<string | null>(null);
const hoverItemKey = ref<string | null>(null);
const altActive = ref(false);
const menubarEl = ref<HTMLElement | null>(null);
const topItemEls = ref<Record<string, HTMLElement | null>>({});

function setTopItemRef(key: string) {
  return (el: unknown) => {
    topItemEls.value[key] = el as HTMLElement | null;
  };
}

const isAnyOpen = computed(() => openMenuKey.value !== null);

/** 下拉面板定位：直接用对应顶栏按钮的 DOM 坐标 */
function getDropdownStyle(groupKey: string): Record<string, string | number> {
  const el = topItemEls.value[groupKey];
  if (!el) return {};
  const rect = el.getBoundingClientRect();
  return {
    position: 'fixed',
    top: `${rect.bottom}px`,
    left: `${rect.left}px`,
    zIndex: 9999,
  };
}

/* ------------------------------------------------------------------ */
/*  顶栏按钮交互                                                       */
/* ------------------------------------------------------------------ */

function onTopItemMouseEnter(groupKey: string) {
  if (isAnyOpen.value) {
    openMenuKey.value = groupKey;
  }
}

function onTopItemClick(groupKey: string) {
  if (openMenuKey.value === groupKey) {
    closeAll();
  } else {
    openMenuKey.value = groupKey;
  }
}

function closeAll() {
  openMenuKey.value = null;
  hoverItemKey.value = null;
  altActive.value = false;
}

/* ------------------------------------------------------------------ */
/*  下拉项交互                                                         */
/* ------------------------------------------------------------------ */

function onDropdownItemClick(item: AppMenuItem) {
  if (item.disabled || item.type === 'divider') return;
  closeAll();
  if (item.action) {
    item.action();
  }
  emit('select', item.key);
}

function onDropdownItemEnter(item: AppMenuItem) {
  if (item.type !== 'divider') {
    hoverItemKey.value = item.key;
  }
}

function onDropdownItemLeave() {
  hoverItemKey.value = null;
}

/* ------------------------------------------------------------------ */
/*  全局点击关闭                                                       */
/* ------------------------------------------------------------------ */

function onDocumentClick(e: MouseEvent) {
  if (!menubarEl.value) return;
  if (!menubarEl.value.contains(e.target as Node)) {
    closeAll();
  }
}

/* ------------------------------------------------------------------ */
/*  Alt 键支持                                                         */
/* ------------------------------------------------------------------ */

/** Alt+字母 → 直接打开对应菜单 */
function findGroupByAltKey(letter: string): AppMenuGroup | undefined {
  return props.menus.find(
    (g) => g.altKey && g.altKey.toLowerCase() === letter.toLowerCase(),
  );
}

/** 焦点在可编辑区域时不劫持系统编辑快捷键（复制/粘贴/全选等） */
function isEditableKeyboardTarget(ev: KeyboardEvent): boolean {
  const t = ev.target;
  if (t instanceof HTMLTextAreaElement && !t.disabled) {
    return true;
  }
  if (t instanceof HTMLSelectElement && !t.disabled) {
    return true;
  }
  if (t instanceof HTMLInputElement && !t.disabled) {
    const type = (t.type || '').toLowerCase();
    if (
      type === 'button' ||
      type === 'submit' ||
      type === 'reset' ||
      type === 'checkbox' ||
      type === 'radio' ||
      type === 'file' ||
      type === 'range' ||
      type === 'color'
    ) {
      return false;
    }
    return true;
  }
  if (t instanceof HTMLElement && t.isContentEditable) {
    return true;
  }
  return false;
}

/** Ctrl/Alt+字母 → 执行菜单项 action */
function findItemByShortcut(e: KeyboardEvent): AppMenuItem | undefined {
  const key = e.key.toUpperCase();
  const ctrl = e.ctrlKey || e.metaKey;
  const alt = e.altKey;
  const shift = e.shiftKey;

  for (const g of props.menus) {
    for (const item of g.children) {
      if (!item.shortcut || item.disabled) continue;
      const parts = item.shortcut.toUpperCase().split('+').map((s) => s.trim());
      const sKey = parts[parts.length - 1];
      const needCtrl = parts.includes('CTRL');
      const needAlt = parts.includes('ALT');
      const needShift = parts.includes('SHIFT');
      if (
        sKey === key &&
        ctrl === needCtrl &&
        alt === needAlt &&
        shift === needShift
      ) {
        return item;
      }
    }
  }
  return undefined;
}

function onKeyDown(e: KeyboardEvent) {
  /* 已打开菜单时 Escape 优先关闭（焦点可能在输入框内） */
  if (e.key === 'Escape' && isAnyOpen.value) {
    closeAll();
    return;
  }

  /* 输入框/文本区内不拦截 Alt 菜单、Ctrl 菜单快捷键，避免吃掉 Ctrl+A/C/V/X/Z… */
  if (isEditableKeyboardTarget(e)) {
    return;
  }

  /* Alt+字母打开菜单组 */
  if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.length === 1) {
    const group = findGroupByAltKey(e.key);
    if (group) {
      e.preventDefault();
      openMenuKey.value = group.key;
      altActive.value = true;
      return;
    }
  }

  /* 单独 Alt 键 toggle menubar 激活态 */
  if (e.key === 'Alt' && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
    return; // 在 keyup 处理
  }

  /* Ctrl/Alt 组合快捷键 */
  if (e.ctrlKey || e.metaKey || e.altKey) {
    const item = findItemByShortcut(e);
    if (item) {
      e.preventDefault();
      closeAll();
      if (item.action) item.action();
      emit('select', item.key);
      return;
    }
  }

  /* 菜单打开时的方向键导航 */
  if (isAnyOpen.value) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const idx = props.menus.findIndex((g) => g.key === openMenuKey.value);
      if (idx < 0) return;
      const next =
        e.key === 'ArrowRight'
          ? (idx + 1) % props.menus.length
          : (idx - 1 + props.menus.length) % props.menus.length;
      openMenuKey.value = props.menus[next].key;
      hoverItemKey.value = null;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const group = props.menus.find((g) => g.key === openMenuKey.value);
      if (!group) return;
      const items = group.children.filter((c) => c.type !== 'divider' && !c.disabled);
      if (items.length === 0) return;
      const curIdx = items.findIndex((i) => i.key === hoverItemKey.value);
      const next =
        e.key === 'ArrowDown'
          ? curIdx < 0
            ? 0
            : (curIdx + 1) % items.length
          : curIdx <= 0
            ? items.length - 1
            : curIdx - 1;
      hoverItemKey.value = items[next].key;
    }
    if (e.key === 'Enter') {
      if (hoverItemKey.value) {
        const group = props.menus.find((g) => g.key === openMenuKey.value);
        const item = group?.children.find((c) => c.key === hoverItemKey.value);
        if (item) onDropdownItemClick(item);
      }
    }
  }
}

let lastAltDown = 0;
function onKeyUp(e: KeyboardEvent) {
  if (e.key === 'Alt' && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
    const now = Date.now();
    if (now - lastAltDown < 400) {
      if (isAnyOpen.value || altActive.value) {
        closeAll();
      } else {
        altActive.value = true;
        void nextTick(() => {
          if (props.menus.length > 0) {
            openMenuKey.value = props.menus[0].key;
          }
        });
      }
    }
    lastAltDown = now;
  }
}

/* ------------------------------------------------------------------ */
/*  生命周期                                                           */
/* ------------------------------------------------------------------ */

onMounted(() => {
  document.addEventListener('click', onDocumentClick, true);
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);
});

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick, true);
  window.removeEventListener('keydown', onKeyDown, true);
  window.removeEventListener('keyup', onKeyUp, true);
});

/* ------------------------------------------------------------------ */
/*  下划线渲染                                                         */
/* ------------------------------------------------------------------ */

type LabelParts = {before: string; char: string; after: string};

function renderLabel(label: string, altKey?: string): string | LabelParts {
  if (!altKey) return label;
  const idx = label.indexOf(altKey);
  if (idx < 0) return label;
  return {
    before: label.slice(0, idx),
    char: label[idx],
    after: label.slice(idx + 1),
  };
}

function isLabelParts(v: string | LabelParts): v is LabelParts {
  return typeof v !== 'string';
}
</script>

<template>
  <div
    ref="menubarEl"
    class="app-native-menubar"
    :class="{ 'app-native-menubar--dark': isDark }"
    role="menubar"
  >
    <div
      v-for="group in menus"
      :key="group.key"
      :ref="setTopItemRef(group.key)"
      class="menubar-top-item"
      :class="{ 'menubar-top-item--open': openMenuKey === group.key }"
      role="menuitem"
      :aria-haspopup="true"
      :aria-expanded="openMenuKey === group.key"
      tabindex="0"
      @mouseenter="onTopItemMouseEnter(group.key)"
      @click.stop="onTopItemClick(group.key)"
    >
      <span class="menubar-top-label">
        <template v-if="!isLabelParts(renderLabel(group.label, group.altKey))">
          {{ renderLabel(group.label, group.altKey) }}
        </template>
        <template v-else>
          {{ (renderLabel(group.label, group.altKey) as LabelParts).before }}<span
            class="menubar-alt-underline"
            :class="{ 'menubar-alt-underline--visible': altActive }"
          >{{ (renderLabel(group.label, group.altKey) as LabelParts).char }}</span>{{ (renderLabel(group.label, group.altKey) as LabelParts).after }}
        </template>
      </span>

      <!-- 下拉面板 -->
      <Teleport to="body">
        <div
          v-if="openMenuKey === group.key"
          class="menubar-dropdown"
          :class="{ 'menubar-dropdown--dark': isDark }"
          role="menu"
          :style="getDropdownStyle(group.key)"
        >
          <template v-for="item in group.children" :key="item.key">
            <div v-if="item.type === 'divider'" class="menubar-dropdown-divider" />
            <div
              v-else
              class="menubar-dropdown-item"
              :class="{
                'menubar-dropdown-item--hover': hoverItemKey === item.key,
                'menubar-dropdown-item--disabled': item.disabled,
              }"
              role="menuitem"
              :aria-disabled="item.disabled"
              @mouseenter="onDropdownItemEnter(item)"
              @mouseleave="onDropdownItemLeave()"
              @click.stop="onDropdownItemClick(item)"
            >
              <span class="menubar-dropdown-label">{{ item.label }}</span>
              <span v-if="item.shortcut" class="menubar-dropdown-shortcut">
                {{ item.shortcut }}
              </span>
            </div>
          </template>
        </div>
      </Teleport>
    </div>
  </div>
</template>

<style scoped>
/* ================================================================== */
/*  顶栏                                                              */
/* ================================================================== */

.app-native-menubar {
  display: flex;
  align-items: stretch;
  height: 100%;
  user-select: none;
  font-size: 13px;
  -webkit-font-smoothing: antialiased;
}

/* ================================================================== */
/*  顶层按钮                                                          */
/* ================================================================== */

.menubar-top-item {
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: 0 8px;
  cursor: default;
  border-radius: 3px;
  color: var(--menubar-fg, rgba(255, 255, 255, 0.9));
  transition: background-color 60ms ease;
}

.menubar-top-item:hover,
.menubar-top-item--open {
  background-color: var(--menubar-item-hover-bg, rgba(255, 255, 255, 0.1));
}

/* 亮色 */
.app-native-menubar:not(.app-native-menubar--dark) .menubar-top-item {
  --menubar-fg: #1b1b1f;
  --menubar-item-hover-bg: rgba(0, 0, 0, 0.06);
}

/* 暗色 */
.app-native-menubar--dark .menubar-top-item {
  --menubar-fg: rgba(255, 255, 255, 0.9);
  --menubar-item-hover-bg: rgba(255, 255, 255, 0.1);
}

.menubar-top-label {
  white-space: nowrap;
  line-height: 1;
}

/* Alt 下划线 */
.menubar-alt-underline {
  text-decoration: none;
}
.menubar-alt-underline--visible {
  text-decoration: underline;
}

/* ================================================================== */
/*  下拉面板                                                          */
/* ================================================================== */

.menubar-dropdown {
  min-width: 200px;
  padding: 4px 0;
  border-radius: 6px;
  background: #2b2d30;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    0 6px 20px rgba(0, 0, 0, 0.36),
    0 0 0 1px rgba(0, 0, 0, 0.12);
  font-size: 13px;
  color: rgba(255, 255, 255, 0.88);
  user-select: none;
  -webkit-font-smoothing: antialiased;
}

/* 亮色 */
.menubar-dropdown:not(.menubar-dropdown--dark) {
  background: #f8f8f8;
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow:
    0 4px 14px rgba(0, 0, 0, 0.1),
    0 0 0 1px rgba(0, 0, 0, 0.06);
  color: #1b1b1f;
}

/* 项 */
.menubar-dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px 0 10px;
  height: 28px;
  cursor: default;
  margin: 0 4px;
  border-radius: 4px;
  gap: 28px;
}

.menubar-dropdown-item--hover:not(.menubar-dropdown-item--disabled) {
  background: #094771;
  color: #fff;
}

.menubar-dropdown:not(.menubar-dropdown--dark)
  .menubar-dropdown-item--hover:not(.menubar-dropdown-item--disabled) {
  background: #0078d4;
  color: #fff;
}

.menubar-dropdown-item--disabled {
  opacity: 0.4;
  cursor: default;
}

.menubar-dropdown-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.menubar-dropdown-shortcut {
  flex-shrink: 0;
  font-size: 12px;
  opacity: 0.64;
  margin-left: auto;
  padding-left: 28px;
}

.menubar-dropdown-item--hover:not(.menubar-dropdown-item--disabled)
  .menubar-dropdown-shortcut {
  opacity: 0.8;
}

/* 分隔线 */
.menubar-dropdown-divider {
  height: 1px;
  margin: 4px 10px;
  background: rgba(255, 255, 255, 0.1);
}

.menubar-dropdown:not(.menubar-dropdown--dark) .menubar-dropdown-divider {
  background: rgba(0, 0, 0, 0.1);
}
</style>
