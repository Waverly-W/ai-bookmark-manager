export enum MessageType {
    changeTheme = "changeTheme",
    changeLocale = "changeLocale",
    changeAccentColor = "changeAccentColor",
    clickExtIcon = "clickExtIcon",
    changeBackground = "changeBackground",
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

export interface BookmarkNode {
    id: string;
    title: string;
    url?: string;
    children?: BookmarkNode[];
    parentId?: string;
    index?: number;
    dateAdded?: number;
    dateGroupModified?: number;
}
