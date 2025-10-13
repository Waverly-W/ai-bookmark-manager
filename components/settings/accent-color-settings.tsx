import React, { useState, useEffect } from 'react';
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { browser } from "wxt/browser";
import { MessageType } from "@/entrypoints/types.ts";
import { useTranslation } from "react-i18next";
import {
    accentColors,
    getCurrentAccentColorId,
    changeAccentColor,
    getAccentColorById
} from "@/lib/accentColorUtils";

export function AccentColorSettings() {
    const { t } = useTranslation();
    const [currentColor, setCurrentColor] = useState<string>('purple');
    const [loading, setLoading] = useState(true);

    // 加载当前强调色设置
    useEffect(() => {
        const loadCurrentColor = async () => {
            try {
                const colorId = await getCurrentAccentColorId();
                setCurrentColor(colorId);

                // 应用当前颜色
                const color = getAccentColorById(colorId);
                if (color) {
                    const root = document.documentElement;
                    root.style.setProperty('--primary', color.primary);
                    root.style.setProperty('--ring', color.ring);
                }
            } catch (error) {
                console.error('Failed to load accent color:', error);
            } finally {
                setLoading(false);
            }
        };

        loadCurrentColor();
    }, []);

    // 处理颜色变更
    const handleColorChange = async (colorId: string) => {
        try {
            setCurrentColor(colorId);

            // 使用工具函数更改颜色
            await changeAccentColor(colorId);

            // 发送消息通知其他页面更新
            await browser.runtime.sendMessage({
                messageType: MessageType.changeAccentColor,
                content: colorId
            });
        } catch (error) {
            console.error('Failed to change accent color:', error);
        }
    };

    if (loading) {
        return (
            <div className="space-y-3">
                <div className="space-y-1">
                    <h4 className="font-medium text-sm">{t('accentColorSettings')}</h4>
                    <p className="text-xs text-muted-foreground">
                        {t('accentColorDescription')}
                    </p>
                </div>
                <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    <span className="ml-2 text-xs">{t('loading')}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="space-y-1">
                <h4 className="font-medium text-sm">{t('accentColorSettings')}</h4>
                <p className="text-xs text-muted-foreground">
                    {t('accentColorDescription')}
                </p>
            </div>
            <RadioGroup
                value={currentColor}
                onValueChange={handleColorChange}
                className="space-y-2"
            >
                {accentColors.map((color) => (
                    <div
                        key={color.id}
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => handleColorChange(color.id)}
                    >
                        <div className="flex items-center gap-2">
                            {/* 颜色预览圆点 */}
                            <div
                                className="w-3 h-3 rounded-full border border-border flex-shrink-0"
                                style={{ backgroundColor: color.preview }}
                            />
                            <Label
                                htmlFor={`accent-${color.id}`}
                                className="cursor-pointer text-sm"
                            >
                                {t(color.name)}
                            </Label>
                        </div>
                        <RadioGroupItem
                            value={color.id}
                            id={`accent-${color.id}`}
                        />
                    </div>
                ))}
            </RadioGroup>
        </div>
    );
}
