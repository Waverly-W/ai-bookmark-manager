import { browser } from "wxt/browser";

// 强调色配置接口
export interface AccentColor {
    id: string;
    name: string;
    primary: string;      // HSL格式的主色调
    ring: string;         // HSL格式的焦点环颜色
    preview: string;      // 用于预览的CSS颜色值
}

// 预设强调色配置
export const accentColors: AccentColor[] = [
    {
        id: 'purple',
        name: 'purple',
        primary: '262.1 83.3% 57.8%',
        ring: '262.1 83.3% 57.8%',
        preview: 'hsl(262.1, 83.3%, 57.8%)'
    },
    {
        id: 'blue',
        name: 'blue',
        primary: '221.2 83.2% 53.3%',
        ring: '221.2 83.2% 53.3%',
        preview: 'hsl(221.2, 83.2%, 53.3%)'
    },
    {
        id: 'green',
        name: 'green',
        primary: '142.1 76.2% 36.3%',
        ring: '142.1 76.2% 36.3%',
        preview: 'hsl(142.1, 76.2%, 36.3%)'
    },
    {
        id: 'orange',
        name: 'orange',
        primary: '24.6 95% 53.1%',
        ring: '24.6 95% 53.1%',
        preview: 'hsl(24.6, 95%, 53.1%)'
    },
    {
        id: 'red',
        name: 'red',
        primary: '0 84.2% 60.2%',
        ring: '0 84.2% 60.2%',
        preview: 'hsl(0, 84.2%, 60.2%)'
    },
    {
        id: 'pink',
        name: 'pink',
        primary: '330 81% 60%',
        ring: '330 81% 60%',
        preview: 'hsl(330, 81%, 60%)'
    },
    {
        id: 'cyan',
        name: 'cyan',
        primary: '198 93% 60%',
        ring: '198 93% 60%',
        preview: 'hsl(198, 93%, 60%)'
    }
];

/**
 * 应用强调色到CSS变量
 * @param color 强调色配置
 */
export const applyAccentColor = (color: AccentColor): void => {
    const root = document.documentElement;
    root.style.setProperty('--primary', color.primary);
    root.style.setProperty('--ring', color.ring);
};

/**
 * 根据ID获取强调色配置
 * @param colorId 强调色ID
 * @returns 强调色配置或null
 */
export const getAccentColorById = (colorId: string): AccentColor | null => {
    return accentColors.find(color => color.id === colorId) || null;
};

/**
 * 获取当前保存的强调色ID
 * @returns 强调色ID，默认为'purple'
 */
export const getCurrentAccentColorId = async (): Promise<string> => {
    try {
        const result = await browser.storage.local.get('accentColor');
        return result.accentColor || 'purple';
    } catch (error) {
        console.error('Failed to get accent color from storage:', error);
        return 'purple';
    }
};

/**
 * 保存强调色设置到本地存储
 * @param colorId 强调色ID
 */
export const saveAccentColorId = async (colorId: string): Promise<void> => {
    try {
        await browser.storage.local.set({ accentColor: colorId });
    } catch (error) {
        console.error('Failed to save accent color to storage:', error);
        throw error;
    }
};

/**
 * 初始化强调色 - 在应用启动时调用
 * 从本地存储加载保存的强调色并应用
 */
export const initializeAccentColor = async (): Promise<void> => {
    try {
        const colorId = await getCurrentAccentColorId();
        const color = getAccentColorById(colorId);
        
        if (color) {
            applyAccentColor(color);
        } else {
            // 如果找不到对应的颜色，使用默认紫色
            const defaultColor = getAccentColorById('purple');
            if (defaultColor) {
                applyAccentColor(defaultColor);
            }
        }
    } catch (error) {
        console.error('Failed to initialize accent color:', error);
        // 出错时使用默认紫色
        const defaultColor = getAccentColorById('purple');
        if (defaultColor) {
            applyAccentColor(defaultColor);
        }
    }
};

/**
 * 更改强调色并保存
 * @param colorId 新的强调色ID
 */
export const changeAccentColor = async (colorId: string): Promise<void> => {
    const color = getAccentColorById(colorId);
    if (!color) {
        throw new Error(`Accent color with id '${colorId}' not found`);
    }
    
    // 应用颜色
    applyAccentColor(color);
    
    // 保存到本地存储
    await saveAccentColorId(colorId);
};
