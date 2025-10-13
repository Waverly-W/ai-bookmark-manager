// HomePage.js
import React, {useState} from "react";
import {Card} from "@/components/ui/card.tsx";
import {Button} from "@/components/ui/button.tsx";
import {useTranslation} from "react-i18next";
import {browser} from "wxt/browser";
import ExtMessage, {MessageType} from "@/entrypoints/types.ts";
import {sendMessageToContentScript} from "@/lib/messageUtils.ts";
import {MdOpenInNew} from "react-icons/md";
import {BiCodeBlock} from "react-icons/bi";

export function Home() {
    const {t} = useTranslation();
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<string>("");
    // 打开Content Script的函数
    async function openContentScript() {
        setIsLoading(true);
        setMessage("");

        try {
            // 获取当前活动标签页
            const tabs = await browser.tabs.query({active: true, currentWindow: true});
            if (!tabs || tabs.length === 0) {
                setMessage(t("contentScriptError"));
                return;
            }

            const currentTab = tabs[0];
            if (!currentTab.id) {
                setMessage(t("contentScriptError"));
                return;
            }

            // 检查是否是支持的页面
            if (currentTab.url?.startsWith('chrome://') ||
                currentTab.url?.startsWith('chrome-extension://') ||
                currentTab.url?.startsWith('edge://') ||
                currentTab.url?.startsWith('about:')) {
                setMessage(t("unsupportedPage"));
                return;
            }

            // 发送消息到Content Script
            const message = new ExtMessage(MessageType.clickExtIcon);
            await sendMessageToContentScript(currentTab.id, message);
            setMessage(t("contentScriptOpened"));

        } catch (error) {
            console.error('Error opening content script:', error);
            setMessage(t("contentScriptError"));
        } finally {
            setIsLoading(false);
        }
    }

    const references = [
        {
            name: "Wxt",
            url: "https://wxt.dev/"
        },
        {
            name: "React",
            url: "https://react.dev/"
        },
        {
            name: "Tailwind css",
            url: "https://tailwindcss.com/"
        },
        {
            name: "Shadcn Ui",
            url: "https://ui.shadcn.com/"
        }
    ]
    return (
        <div className="space-y-6">
            {/* 快捷操作区域 */}
            <Card className="text-left">
                <div className="flex flex-col space-y-1.5 p-6 pb-3">
                    <div className="flex items-center gap-2">
                        <BiCodeBlock className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold leading-none tracking-tight text-base">{t("contentScript")}</h3>
                    </div>
                    <p className="text-sm max-w-lg text-balance leading-relaxed">
                        {t("contentScriptDescription")}
                    </p>
                    <div className="pt-4">
                        <Button
                            onClick={openContentScript}
                            disabled={isLoading}
                            className="w-full flex items-center gap-2"
                        >
                            {isLoading ? (
                                <span className="animate-spin">⏳</span>
                            ) : (
                                <MdOpenInNew className="h-4 w-4" />
                            )}
                            {isLoading ? "..." : t("openContentScript")}
                        </Button>
                        {message && (
                            <p className={`text-xs mt-2 ${message.includes(t("contentScriptError")) || message.includes(t("unsupportedPage")) ? 'text-red-500' : 'text-green-500'}`}>
                                {message}
                            </p>
                        )}
                    </div>
                </div>
            </Card>

            {/* 信息卡片区域 */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="text-left">
                <div className="flex flex-col space-y-1.5 p-6 pb-3">
                    <h3 className="font-semibold leading-none tracking-tight text-base">{t("introduce")}</h3>
                    <p className="text-sm max-w-lg text-balance leading-relaxed">
                        {t("description")}
                    </p>
                </div>
            </Card>


            <Card className="text-left">
                <div className="flex flex-col space-y-1.5 p-6 pb-3">
                    <h3 className="font-semibold leading-none tracking-tight text-base">{t("reference")}</h3>
                    <div className="flex flex-col gap-4 pt-2">
                        {
                            references.map((reference, index, array) => {
                                return (
                                    <div className="grid gap-1">
                                        <p className="text-sm font-medium leading-none">
                                            {reference.name}
                                        </p>
                                        <a className="text-sm text-muted-foreground" href={reference.url}
                                           target="_blank">{reference.url}</a>
                                    </div>
                                )
                            })
                        }
                    </div>
                </div>
            </Card>
            </div>
        </div>

    )
}
