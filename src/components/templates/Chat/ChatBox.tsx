import { CopilotKit } from "@copilotkit/react-core";
import ChatBoxContent from "./ChatBoxContent";
import { ADMIN_AGENT_NAME } from "@/constants";
import { inter } from "@/assets/fonts/inter";
import isEmpty from "lodash/isEmpty";
import { useState } from "react";

interface ChatBoxProps {
    threadId?: string;
    onCollapseChange?: (isCollapsed: boolean) => void;
}

export const ChatBox: React.FC<ChatBoxProps> = ({ threadId, onCollapseChange }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);

    const handleCollapseChange = (collapsed: boolean) => {
        setIsCollapsed(collapsed);
        onCollapseChange?.(collapsed);
    };

    return (
        <div className={`${inter.className} ${isCollapsed ? "w-10" : "w-full"} h-full transition-all duration-300 ease-in-out`}>
            <CopilotKit
                runtimeUrl="/api/copilotkit"
                agent={ADMIN_AGENT_NAME}
                threadId={isEmpty(threadId) || threadId === "new" ? undefined : threadId}
                key={threadId ?? "__new__"}
                showDevConsole={false}
                credentials="include"
                properties={{
                    clientType: process.env.NEXT_PUBLIC_CLIENT_TYPE || "spreadsheet"
                }}
            >
                <ChatBoxContent isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} onCollapseChange={handleCollapseChange} />
            </CopilotKit>
        </div>
    );
};

export default ChatBox;
