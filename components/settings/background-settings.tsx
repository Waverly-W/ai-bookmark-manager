import React, { useEffect, useState } from 'react';
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageType } from "@/entrypoints/types.ts";
import { useTranslation } from "react-i18next";
import { Trash2, Upload } from "lucide-react";
import { useBackground } from "@/components/background-provider.tsx";

export interface BackgroundConfig {
    type: 'default' | 'color' | 'image';
    value: string;
}

export function BackgroundSettings() {
    const { t } = useTranslation();
    const { backgroundConfig, setBackground } = useBackground();

    const saveConfig = async (newConfig: BackgroundConfig) => {
        await setBackground(newConfig);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Check file size (e.g. limit to 2MB to avoid storage issues)
            if (file.size > 2 * 1024 * 1024) {
                alert("Image size too large. Please choose an image under 2MB.");
                return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                saveConfig({ type: 'image', value: base64String });
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="space-y-3">
            <div className="space-y-1">
                <h4 className="font-medium text-sm">{t('backgroundSettings')}</h4>
                <p className="text-xs text-muted-foreground">{t('backgroundSettingsDescription')}</p>
            </div>

            <RadioGroup
                value={backgroundConfig.type}
                onValueChange={(value) => saveConfig({ type: value as any, value: backgroundConfig.value })}
                className="space-y-2"
            >
                <div className="flex items-center space-y-1.5 justify-between"
                    onClick={() => saveConfig({ type: 'default', value: '' })}>
                    <Label htmlFor="bg-default" className="text-sm cursor-pointer">{t('default')}</Label>
                    <RadioGroupItem value="default" id="bg-default" />
                </div>

                <div className="flex items-center space-y-1.5 justify-between"
                    onClick={() => saveConfig({ type: 'color', value: backgroundConfig.value || '#ffffff' })}>
                    <Label htmlFor="bg-color" className="text-sm cursor-pointer">{t('solidColor')}</Label>
                    <RadioGroupItem value="color" id="bg-color" />
                </div>

                {backgroundConfig.type === 'color' && (
                    <div className="pl-4 pb-2">
                        <div className="flex items-center gap-2">
                            <Input
                                type="color"
                                value={backgroundConfig.value || '#ffffff'}
                                onChange={(e) => saveConfig({ type: 'color', value: e.target.value })}
                                className="w-12 h-8 p-0 cursor-pointer border-0"
                            />
                            <span className="text-sm text-muted-foreground">{backgroundConfig.value || '#ffffff'}</span>
                        </div>
                    </div>
                )}

                <div className="flex items-center space-y-1.5 justify-between"
                    onClick={() => saveConfig({ type: 'image', value: backgroundConfig.value })}>
                    <Label htmlFor="bg-image" className="text-sm cursor-pointer">{t('customImage')}</Label>
                    <RadioGroupItem value="image" id="bg-image" />
                </div>

                {backgroundConfig.type === 'image' && (
                    <div className="pl-4 pb-2 space-y-2">
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full relative overflow-hidden"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    document.getElementById('bg-upload')?.click();
                                }}
                            >
                                <Upload className="w-4 h-4 mr-2" />
                                {t('uploadImage')}
                                <input
                                    id="bg-upload"
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleImageUpload}
                                />
                            </Button>
                            {backgroundConfig.value && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        saveConfig({ type: 'image', value: '' });
                                    }}
                                >
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                            )}
                        </div>
                        {backgroundConfig.value && (
                            <div className="relative aspect-video w-full rounded-md overflow-hidden border bg-muted/50">
                                <img src={backgroundConfig.value} alt="Background preview" className="object-cover w-full h-full" />
                            </div>
                        )}
                    </div>
                )}
            </RadioGroup>
        </div>
    );
}
