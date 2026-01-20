import { UserMessageProps } from "@copilotkit/react-ui";
import { useEffect } from "react";
import { useMessageMapping } from "@/components/MessageMappingContext";
import { useResponsiveChatPadding } from "@/hooks";

const CustomUserMessage: React.FC<UserMessageProps> = (props) => {
    const { message } = props;
    // useMessageMapping now returns safe defaults if provider isn't available
    const { setLastUserMessageId } = useMessageMapping();
    // Get responsive padding based on chat container width
    const horizontalPadding = useResponsiveChatPadding();
    
    // Get user message ID from props
    const rawData = (props as any)?.rawData;
    const userId = rawData?.id;
    
    // Register this user message as the last one
    useEffect(() => {
        if (userId) {
            setLastUserMessageId(userId);
        }
    }, [userId, setLastUserMessageId]);

    // Hide the special __DISCOVER__ trigger message
    if (typeof message === "string" && message.trim() === "__DISCOVER__") {
        return null;
    }
    
    return (
        <div className={`flex justify-end py-2 ${horizontalPadding}`}>
            <div className="w-auto max-w-[70%] min-w-[20%] overflow-x-auto rounded bg-[#745263] px-2 py-2 break-words whitespace-pre-line text-white">
                {message}
            </div>
        </div>
    );
};

export default CustomUserMessage;
