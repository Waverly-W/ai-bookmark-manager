import './App.css';
import {Button} from "@/components/ui/button.tsx";
import {MessageType} from "@/entrypoints/types.ts";
import ExtMessage from "@/entrypoints/types.ts";
import {sendMessageToBackground} from "@/lib/messageUtils.ts";

function App() {

    async function handleSendMessage() {
        try {
            const message = new ExtMessage(MessageType.clickExtIcon);
            const response = await sendMessageToBackground(message);
            console.log('Response from background:', response);
        } catch (error) {
            console.error('Error sending message to background:', error);
        }
    }

    return (
        <div className="grid grid-cols-1 gap-3">
            <Button onClick={handleSendMessage}>send message</Button>
        </div>
    );
}

export default App;
