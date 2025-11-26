import React, { useEffect, useState } from 'react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageType } from "@/entrypoints/types.ts";
import { useTranslation } from "react-i18next";
import { Trash2, Upload } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { BackgroundConfig, useBackground } from "@/components/background-provider.tsx";

// Removed local BackgroundConfig interface as it is now imported from provider

export function BackgroundSettings() {
    const { t } = useTranslation();
    const { backgroundConfig, setBackground } = useBackground();

    const saveConfig = async (newConfig: BackgroundConfig) => {
        await setBackground(newConfig);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 10 * 1024 * 1024) {
                alert("Image size too large. Please choose an image under 10MB.");
                return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                saveConfig({
                    type: 'image',
                    value: base64String,
                    blur: backgroundConfig.blur || 0,
                    maskOpacity: backgroundConfig.maskOpacity || 0
                });
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="space-y-4">
            <div className="space-y-1">
                <h4 className="font-medium text-sm">{t('backgroundSettings')}</h4>
                <p className="text-xs text-muted-foreground">{t('backgroundSettingsDescription')}</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
                {/* Default Option */}
                <div
                    className={`
                        cursor-pointer rounded-xl border-2 p-4 flex flex-col items-center gap-3 transition-all duration-200
                        hover:border-primary/50 hover:bg-accent/50
                        ${backgroundConfig.type === 'default' ? 'border-primary bg-accent/20' : 'border-transparent bg-muted/30'}
                    `}
                    onClick={() => saveConfig({ type: 'default', value: '' })}
                >
                    <div className="w-10 h-10 rounded-full bg-background border shadow-sm flex items-center justify-center">
                        <div className="w-4 h-4 rounded-full bg-foreground/20" />
                    </div>
                    <span className="text-xs font-medium">{t('default')}</span>
                </div>

                {/* Solid Color Option */}
                <div
                    className={`
                        cursor-pointer rounded-xl border-2 p-4 flex flex-col items-center gap-3 transition-all duration-200
                        hover:border-primary/50 hover:bg-accent/50
                        ${backgroundConfig.type === 'color' ? 'border-primary bg-accent/20' : 'border-transparent bg-muted/30'}
                    `}
                    onClick={() => saveConfig({ type: 'color', value: backgroundConfig.value || '#ffffff' })}
                >
                    <div className="w-10 h-10 rounded-full border shadow-sm overflow-hidden relative">
                        <div
                            className="absolute inset-0"
                            style={{ backgroundColor: backgroundConfig.type === 'color' ? backgroundConfig.value : '#ffffff' }}
                        />
                        {backgroundConfig.type === 'color' && (
                            <Input
                                type="color"
                                value={backgroundConfig.value || '#ffffff'}
                                onChange={(e) => saveConfig({ type: 'color', value: e.target.value })}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full p-0 border-0"
                            />
                        )}
                    </div>
                    <span className="text-xs font-medium">{t('solidColor')}</span>
                </div>

                {/* Custom Image Option */}
                <div
                    className={`
                        cursor-pointer rounded-xl border-2 p-4 flex flex-col items-center gap-3 transition-all duration-200
                        hover:border-primary/50 hover:bg-accent/50
                        ${backgroundConfig.type === 'image' ? 'border-primary bg-accent/20' : 'border-transparent bg-muted/30'}
                    `}
                    onClick={() => saveConfig({ type: 'image', value: backgroundConfig.value })}
                >
                    <div className="w-10 h-10 rounded-full bg-background border shadow-sm flex items-center justify-center">
                        <Upload className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <span className="text-xs font-medium">{t('customImage')}</span>
                </div>
            </div>

            {/* Expanded Settings Area */}
            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${backgroundConfig.type === 'image' ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="pt-2 space-y-4">
                    {/* Image Preview & Upload */}
                    <div
                        className="group relative aspect-video w-full rounded-xl overflow-hidden border-2 border-dashed border-muted-foreground/20 bg-muted/10 transition-colors hover:bg-muted/20 cursor-pointer"
                        onClick={() => document.getElementById('bg-upload')?.click()}
                    >
                        {backgroundConfig.value ? (
                            <>
                                <img src={backgroundConfig.value} alt="Background preview" className="object-cover w-full h-full" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <Button size="sm" variant="secondary" className="h-8">
                                        <Upload className="w-3 h-3 mr-2" />
                                        {t('change')}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        className="h-8"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            saveConfig({ type: 'image', value: '' });
                                        }}
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                                <Upload className="w-8 h-8 mb-2 opacity-50" />
                                <span className="text-xs font-medium">{t('uploadImage')}</span>
                            </div>
                        )}
                        <input
                            id="bg-upload"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleImageUpload}
                        />
                    </div>

                    {/* Sliders */}
                    {backgroundConfig.value && (
                        <div className="grid gap-6 p-4 rounded-xl bg-muted/30 border">
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <Label className="text-xs font-medium text-muted-foreground">{t('blur')}</Label>
                                    <span className="text-xs font-mono bg-background px-2 py-0.5 rounded border">{backgroundConfig.blur || 0}px</span>
                                </div>
                                <Slider
                                    defaultValue={[backgroundConfig.blur || 0]}
                                    max={20}
                                    step={1}
                                    onValueChange={(vals) => saveConfig({ ...backgroundConfig, blur: vals[0] })}
                                    className="py-1"
                                />
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <Label className="text-xs font-medium text-muted-foreground">{t('maskOpacity')}</Label>
                                    <span className="text-xs font-mono bg-background px-2 py-0.5 rounded border">{Math.round((backgroundConfig.maskOpacity || 0) * 100)}%</span>
                                </div>
                                <Slider
                                    defaultValue={[backgroundConfig.maskOpacity || 0]}
                                    max={0.8}
                                    step={0.05}
                                    onValueChange={(vals) => saveConfig({ ...backgroundConfig, maskOpacity: vals[0] })}
                                    className="py-1"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
