export enum MessageType {
    changeTheme = "changeTheme",
    changeLocale = "changeLocale",
    changeAccentColor = "changeAccentColor",
    clickExtIcon = "clickExtIcon",
}

export enum MessageFrom {
    background = "background",
    popUp = "popUp",
    newTab = "newTab",
}

class ExtMessage {
    content?: string;
    from?: MessageFrom;

    constructor(messageType: MessageType) {
        this.messageType = messageType;
    }

    messageType: MessageType;
}

export default ExtMessage;
