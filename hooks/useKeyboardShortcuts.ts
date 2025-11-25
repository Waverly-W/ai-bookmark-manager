import { useEffect } from 'react';

/**
 * 快捷键配置接口
 */
export interface ShortcutConfig {
    /** 按键，例如 'k', 'Enter', 'Escape' */
    key: string;
    /** 是否需要按住 Ctrl 键 (Windows/Linux) */
    ctrl?: boolean;
    /** 是否需要按住 Meta/Command 键 (Mac) */
    meta?: boolean;
    /** 是否需要按住 Shift 键 */
    shift?: boolean;
    /** 是否需要按住 Alt 键 */
    alt?: boolean;
    /** 快捷键触发时的处理函数 */
    handler: (event: KeyboardEvent) => void;
    /** 快捷键描述（用于帮助界面） */
    description?: string;
    /** 是否阻止默认事件 */
    preventDefault?: boolean;
}

/**
 * 检查元素是否为输入元素
 */
const isInputElement = (element: EventTarget | null): boolean => {
    if (!element || !(element instanceof Element)) {
        return false;
    }

    const tagName = element.tagName.toUpperCase();
    return (
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        tagName === 'SELECT' ||
        element.hasAttribute('contenteditable')
    );
};

/**
 * 检测操作系统是否为 Mac
 */
const isMac = (): boolean => {
    return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
};

/**
 * 检查按键事件是否匹配快捷键配置
 */
const matchesShortcut = (event: KeyboardEvent, config: ShortcutConfig): boolean => {
    // 检查基本按键
    if (event.key.toLowerCase() !== config.key.toLowerCase()) {
        return false;
    }

    // 检查修饰键
    const ctrlRequired = config.ctrl || false;
    const metaRequired = config.meta || false;
    const shiftRequired = config.shift || false;
    const altRequired = config.alt || false;

    // Mac 系统使用 Meta 键（Command），其他系统使用 Ctrl 键
    const isMetaPlatform = isMac();
    const modifierPressed = isMetaPlatform ? event.metaKey : event.ctrlKey;
    const modifierRequired = isMetaPlatform ? metaRequired : ctrlRequired;

    return (
        modifierPressed === modifierRequired &&
        event.shiftKey === shiftRequired &&
        event.altKey === altRequired
    );
};

/**
 * 键盘快捷键 Hook
 * 
 * @param shortcuts - 快捷键配置数组
 * @param enabled - 是否启用快捷键，默认为 true
 * @param ignoreInputs - 是否忽略输入元素内的快捷键，默认为 true
 * 
 * @example
 * ```tsx
 * useKeyboardShortcuts([
 *   {
 *     key: 'k',
 *     ctrl: true,
 *     handler: () => openSearch(),
 *     description: 'Open search'
 *   },
 *   {
 *     key: '/',
 *     handler: () => focusSearchInput(),
 *     description: 'Focus search input'
 *   }
 * ]);
 * ```
 */
export const useKeyboardShortcuts = (
    shortcuts: ShortcutConfig[],
    enabled: boolean = true,
    ignoreInputs: boolean = true
): void => {
    useEffect(() => {
        if (!enabled || shortcuts.length === 0) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            // 如果设置了忽略输入元素，且当前焦点在输入元素上，则不触发快捷键
            // 但 Escape 键除外，因为它通常用于退出输入状态
            if (ignoreInputs && isInputElement(event.target) && event.key !== 'Escape') {
                return;
            }

            // 遍历所有快捷键配置，找到匹配的快捷键
            for (const config of shortcuts) {
                if (matchesShortcut(event, config)) {
                    // 阻止默认行为（如果需要）
                    if (config.preventDefault !== false) {
                        event.preventDefault();
                    }

                    // 执行处理函数
                    config.handler(event);

                    // 找到匹配的快捷键后停止查找
                    break;
                }
            }
        };

        // 添加事件监听器
        document.addEventListener('keydown', handleKeyDown);

        // 清理函数
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [shortcuts, enabled, ignoreInputs]);
};

/**
 * 获取快捷键的显示文本
 * 
 * @param config - 快捷键配置
 * @returns 快捷键的显示文本，例如 "Cmd+K" 或 "Ctrl+K"
 */
export const getShortcutDisplay = (config: ShortcutConfig): string => {
    const keys: string[] = [];
    const isMetaPlatform = isMac();

    if (config.ctrl || config.meta) {
        keys.push(isMetaPlatform ? '⌘' : 'Ctrl');
    }

    if (config.shift) {
        keys.push(isMetaPlatform ? '⇧' : 'Shift');
    }

    if (config.alt) {
        keys.push(isMetaPlatform ? '⌥' : 'Alt');
    }

    // 处理特殊按键显示
    let keyDisplay = config.key;
    if (config.key === ' ') {
        keyDisplay = 'Space';
    } else if (config.key.length === 1) {
        keyDisplay = config.key.toUpperCase();
    }

    keys.push(keyDisplay);

    return keys.join('+');
};
