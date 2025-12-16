import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";

type MessageMapping = { [assistantId: string]: string };

interface MessageMappingContextType {
  messageMapping: MessageMapping;
  addMapping: (assistantId: string, userId: string) => void;
  getUserIdForAssistant: (assistantId: string) => string | null;
  setLastUserMessageId: (userId: string) => void;
  getLastUserMessageId: () => string | null;
}

const MessageMappingContext = createContext<MessageMappingContextType | undefined>(undefined);

export const MessageMappingProvider = ({ children }: { children: ReactNode }) => {
  const [messageMapping, setMessageMapping] = useState<MessageMapping>({});
  const lastUserMessageIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    return () => {
      lastUserMessageIdRef.current = null;
    };
  }, []);

  const addMapping = useCallback((assistantId: string, userId: string) => {
    setMessageMapping(prev => {
      if (prev[assistantId] === userId) {
        return prev;
      }
      return {
        ...prev,
        [assistantId]: userId
      };
    });
  }, []);

  const getUserIdForAssistant = useCallback((assistantId: string) => {
    return messageMapping[assistantId] || null;
  }, [messageMapping]);

  const setLastUserMessageId = useCallback((userId: string) => {
    lastUserMessageIdRef.current = userId;
  }, []);

  const getLastUserMessageId = useCallback(() => {
    return lastUserMessageIdRef.current;
  }, []);

  return (
    <MessageMappingContext.Provider value={{ 
      messageMapping, 
      addMapping, 
      getUserIdForAssistant,
      setLastUserMessageId,
      getLastUserMessageId
    }}>
      {children}
    </MessageMappingContext.Provider>
  );
};

export const useMessageMapping = () => {
  const context = useContext(MessageMappingContext);
  if (!context) {
    console.warn('useMessageMapping called outside MessageMappingProvider, returning default values');
    return {
      messageMapping: {},
      addMapping: () => {},
      getUserIdForAssistant: () => null,
      setLastUserMessageId: () => {},
      getLastUserMessageId: () => null
    };
  }
  return context;
};
