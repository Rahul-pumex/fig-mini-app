import ChatInputActions, { type UploadedFile } from "../../molecules/ChatInputActions";
import { CustomChatInputProps, MetricOption } from "../../../types";
import { useEffect, useRef, useState, useCallback } from "react";
import CustomAttachmentUI from "../../molecules/CustomAttachmentUI";
import { ArrowUp } from 'lucide-react';
import { ContextBubble } from "../../molecules/contextBubble";
import { useSelectedContexts } from "../../SelectedContextsContext";
import ImageUploadIcon from "../../atoms/icons/imageUploadIcon";
import StopIcon from "../../atoms/icons/stopIcon";

// Placeholder for suggestion bubbles (disabled in mini app)
const SuggestionBubbles = () => null;

const CustomChatInput = (props: CustomChatInputProps) => {
    const [message, setMessage] = useState("");
    const [showCustomUI, setShowCustomUI] = useState(false);
    const [showActions, setShowActions] = useState(false);
    const [isScrollable, setIsScrollable] = useState(false);
    const [internalIsGenerating, setInternalIsGenerating] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    const { onSubmitMessage, onSend, placeholder, disabled, isGenerating, onStop } = props;
    const { selectedContexts } = useSelectedContexts();
    const { clearContexts } = useSelectedContexts();

    const currentlyGenerating = isGenerating !== undefined ? isGenerating : internalIsGenerating;
    const submitFunction = onSubmitMessage || onSend || props.onSubmit;
    const adjustTextareaHeight = useCallback(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        const maxHeight = 120;
        const sh = el.scrollHeight;
        if (sh > maxHeight) {
            el.style.height = `${maxHeight}px`;
            setIsScrollable(true);
        } else {
            el.style.height = `${Math.max(sh, 32)}px`;
            setIsScrollable(false);
        }
    }, []);
    const getDraftKey = useCallback(() => {
        if (typeof window !== "undefined") {
            return `custom_chat_input_draft:${window.location.pathname}`;
        }
        return "custom_chat_input_draft";
    }, []);

    const saveDraft = useCallback(
        (value: string) => {
            try {
                if (typeof window !== "undefined") {
                    const key = getDraftKey();
                    if (value.trim()) {
                        sessionStorage.setItem(key, value);
                    } else {
                        sessionStorage.removeItem(key);
                    }
                }
            } catch (error) {
                console.warn("Failed to save draft:", error);
            }
        },
        [getDraftKey]
    );

    const loadDraft = useCallback(() => {
        try {
            if (typeof window !== "undefined") {
                const key = getDraftKey();
                return sessionStorage.getItem(key) || "";
            }
        } catch (error) {
            console.warn("Failed to load draft:", error);
        }
        return "";
    }, [getDraftKey]);

    useEffect(() => {
        if (!isInitialized) {
            const saved = loadDraft();
            if (saved) {
                setMessage(saved);
            }
            setIsInitialized(true);
            setTimeout(adjustTextareaHeight, 0);
        }
    }, [loadDraft, isInitialized, adjustTextareaHeight]);

    useEffect(() => {
        if (isInitialized) {
            saveDraft(message);
            adjustTextareaHeight();
        }
    }, [message, saveDraft, isInitialized, adjustTextareaHeight]);

    useEffect(() => {
        const handler = () => adjustTextareaHeight();
        window.addEventListener("resize", handler);
        const t = setTimeout(handler, 50);
        return () => {
            clearTimeout(t);
            window.removeEventListener("resize", handler);
        };
    }, [adjustTextareaHeight]);

    // Request sheet data from Google Sheets parent window
    const requestSheetData = useCallback(() => {
        if (typeof window !== "undefined" && window.parent !== window) {
            // We're in an iframe, send message to parent
            console.log('[Google Sheets] Requesting sheet data from parent window');
            window.parent.postMessage({ type: 'REQUEST_SHEET_DATA' }, '*');
        } else {
            console.warn('[Google Sheets] Not in an iframe, cannot request sheet data');
        }
    }, []);

    // Listen for sheet data from parent window
    useEffect(() => {
        if (typeof window === "undefined") return;

        const handleSheetData = (event: MessageEvent) => {
            
            // Accept messages from any origin when in iframe (you may want to restrict this in production)
            if (event.data && event.data.type === 'SHEET_DATA' && event.data.source === 'google-sheets') {
                console.log('[Google Sheets] Processing SHEET_DATA message');
                const payload = event.data.payload;
                console.log('[Google Sheets] Payload:', payload);
                
                let formattedData = "";
                
                // Check if request was successful
                if (!payload) {
                    console.warn('[Google Sheets] No payload received');
                    formattedData = "No data available in the sheet.\n\n(No payload received from Google Sheets)";
                } else if (payload.success === false) {
                    console.warn('[Google Sheets] Request failed:', payload.error || payload.message);
                    formattedData = "No data available in the sheet.\n\n";
                    formattedData += `Error: ${payload.error || payload.message || 'Failed to retrieve sheet data'}`;
                } else {
                    // Format the sheet data for the input field
                    formattedData = "Google Sheets Data\n";
                    formattedData += "==================\n\n";
                    
                    try {
                        // Handle the actual payload structure: { headers, rows, sheetName, rowCount, columnCount }
                        const sheetName = payload.sheetName || 'Sheet';
                        const headers = payload.headers || [];
                        const rows = payload.rows || [];
                        const rowCount = payload.rowCount || 0;
                        const columnCount = payload.columnCount || 0;
                        
                        // Add sheet name
                        formattedData += `Sheet: ${sheetName}\n`;
                        formattedData += `Rows: ${rowCount}, Columns: ${columnCount}\n\n`;
                        
                        // Add headers if they exist
                        if (headers.length > 0) {
                            formattedData += "Headers:\n";
                            formattedData += headers.join(", ") + "\n\n";
                        }
                        
                        // Add data rows if they exist
                        if (rows.length > 0) {
                            formattedData += "Data:\n";
                            rows.forEach((row: any, index: number) => {
                                if (Array.isArray(row)) {
                                    formattedData += `Row ${index + 1}: ${row.join(", ")}\n`;
                                } else if (typeof row === 'object' && row !== null) {
                                    // If row is an object, try to match with headers
                                    if (headers.length > 0) {
                                        const rowValues = headers.map((header: string) => {
                                            return row[header] !== undefined ? row[header] : '';
                                        });
                                        formattedData += `Row ${index + 1}: ${rowValues.join(", ")}\n`;
                                    } else {
                                        formattedData += `Row ${index + 1}: ${JSON.stringify(row)}\n`;
                                    }
                                } else {
                                    formattedData += `Row ${index + 1}: ${row}\n`;
                                }
                            });
                        } else if (headers.length > 0) {
                            // Headers exist but no data rows
                            formattedData += "No data rows available (only headers found)\n";
                        } else {
                            // No headers and no rows
                            formattedData += "No data available in the sheet.\n\n(Sheet is empty)";
                        }
                    } catch (error) {
                        console.error('[Google Sheets] Error formatting sheet data:', error);
                        formattedData = "No data available in the sheet.\n\n";
                        formattedData += `Error formatting data: ${error instanceof Error ? error.message : String(error)}`;
                    }
                }

                // Set the formatted data in the input field instead of sending directly
                setMessage(formattedData);
                
                // Focus the textarea to show the data
                setTimeout(() => {
                    textareaRef.current?.focus();
                    adjustTextareaHeight();
                }, 100);
            }
        };

        window.addEventListener('message', handleSheetData);

        return () => {
            window.removeEventListener('message', handleSheetData);
        };
    }, [adjustTextareaHeight]);

    useEffect(() => {
        if (submitFunction && typeof window !== "undefined") {
            (window as any).__chatSubmitFunction = submitFunction;
        }

        const handleCustomSubmit = (event: CustomEvent<{ message: string }>) => {
            if (event.detail?.message && submitFunction) {
                submitFunction(event.detail.message);
            }
        };

        const handleKGSaveMessage = (event: CustomEvent<{ message: string }>) => {
            if (event.detail?.message && submitFunction) {
                submitFunction(event.detail.message);
            }
        };

        document.addEventListener("copilot-submit-message", handleCustomSubmit as EventListener);
        window.addEventListener("kg-send-chat-message", handleKGSaveMessage as EventListener);

        return () => {
            document.removeEventListener("copilot-submit-message", handleCustomSubmit as EventListener);
            window.removeEventListener("kg-send-chat-message", handleKGSaveMessage as EventListener);
        };
    }, [submitFunction]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const parts: string[] = [];

        // Separate contexts and prompts
        const contexts = selectedContexts.filter(c => c.type === 'context');
        const prompts = selectedContexts.filter(c => c.type === 'prompt');

        // Add contexts with heading
        if (contexts.length > 0) {
            parts.push("Business Context");
            parts.push("---------");
            contexts.forEach((context) => {
                if (context.body) {
                    parts.push(context.body);
                }
            });
        }

        // Add prompts with heading
        if (prompts.length > 0) {
            parts.push("Prompt");
            parts.push("-------");
            prompts.forEach((prompt) => {
                if (prompt.body) {
                    parts.push(prompt.body);
                }
            });
        }

        // Add separator before user message if there are contexts or prompts
        if (contexts.length > 0 || prompts.length > 0) {
            parts.push("---------");
        }

        // Add user message
        if (message.trim()) {
            parts.push(message.trim());
        }

        // Add files
        if (uploadedFiles.length > 0) {
            uploadedFiles.forEach((f) => {
                if (f.kind === "txt") {
                    const content = f.content || "";
                    const maxLen = 5000;
                    const payload = content.length > maxLen ? content.slice(0, maxLen) + "\n\n[...truncated...]" : content;
                    parts.push(`FILE [txt]: ${f.file.name}\n\n${payload}`);
                } else {
                    const sizeKB = Math.max(1, Math.round(f.file.size / 1024));
                    parts.push(`FILE [pdf]: ${f.file.name} (${sizeKB} KB) attached.`);
                }
            });
        }

        const finalMessage = parts.join("\n\n");

        if (finalMessage && submitFunction) {
            if (isGenerating === undefined) {
                setInternalIsGenerating(true);
                const checkForCompletion = () => {
                    setTimeout(() => {
                        const lastMessage = document.querySelector(".copilot-kit-messages > div:last-child");
                        if (lastMessage && !lastMessage.textContent?.includes("...")) {
                            setInternalIsGenerating(false);
                        } else {
                            checkForCompletion();
                        }
                    }, 1000);
                };
                checkForCompletion();
            }
            submitFunction(finalMessage);
            setMessage("");
            try {
                if (typeof window !== "undefined") {
                    const key = getDraftKey();
                    sessionStorage.removeItem(key);
                }
            } catch {}
            setUploadedFiles([]);
            clearContexts();
        }
    };

    const handleCustomButtonClick = () => {
        setShowCustomUI((prev) => !prev);

        setTimeout(() => {
            const scrollableElement =
                document.querySelector('[data-testid="copilot-chat-container"]') ||
                document.querySelector(".copilot-kit-chat-container") ||
                document.querySelector('[class*="overflow-y-auto"]');

            if (scrollableElement) {
                scrollableElement.scrollTop = scrollableElement.scrollHeight;
            }

            let element = document.activeElement;
            while (element && element.parentElement) {
                element = element.parentElement;
                if (element.scrollHeight > element.clientHeight) {
                    element.scrollTop = element.scrollHeight;
                    break;
                }
            }
        }, 100);
    };

    const handleCustomUISelect = (option: MetricOption) => {
        setShowCustomUI(false);

        if (submitFunction) {
            submitFunction(option.id);
        } else {
            setMessage(option.id);
        }
    };

    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const target = e.target;
        setMessage(target.value);
        target.style.height = "auto";
        const maxHeight = 120;
        const scrollHeight = target.scrollHeight;

        if (scrollHeight > maxHeight) {
            target.style.height = maxHeight + "px";
            setIsScrollable(true);
        } else {
            target.style.height = scrollHeight + "px";
            setIsScrollable(false);
        }
    };
    const handleTextareaWheel = (e: React.WheelEvent<HTMLTextAreaElement>) => {
        const el = e.currentTarget;
        const canScroll = el.scrollHeight > el.clientHeight;
        if (!canScroll) return;
        e.stopPropagation();
    };

    const handleSuggestionClick = (suggestion: { action?: string; text?: string }) => {
        if (submitFunction) {
            submitFunction(suggestion.action || suggestion.text || "");
        } else {
            setMessage(suggestion.action || suggestion.text || "");
        }
    };

    const handleStopGeneration = () => {
        setInternalIsGenerating(false);

        if (onStop) {
            onStop();
        }

        const stopButtons = document.querySelectorAll(
            'button[title*="stop" i]:not([data-stop-button="custom"]), button[aria-label*="stop" i]:not([data-stop-button="custom"])'
        );
        stopButtons.forEach((button) => (button as HTMLButtonElement).click());
    };

    return (
        <div 
            className="sticky right-0 bottom-0 left-0 z-30 w-full bg-white border-t border-gray-200 shadow-lg" 
            style={{ willChange: 'transform', transform: 'translateZ(0)' }}
        >
            {/* Suggestions disabled in mini app */}

            <ContextBubble />

            <form onSubmit={handleSubmit} className="flex items-start gap-1 px-4 py-2">
                <div className="flex flex-1 items-stretch rounded-xl border border-gray-300 bg-white px-2 py-1.5 shadow-sm hover:border-gray-400 focus-within:border-[#745263] focus-within:ring-2 focus-within:ring-[#745263]/20 transition-all">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all hover:bg-gray-100 ${showActions ? "bg-[#745263] text-white" : "text-gray-600"}`}
                            title="Add attachments"
                            disabled={disabled}
                            onClick={() => setShowActions((prev) => !prev)}
                        >
                            <span
                                className="cursor-pointer"
                                style={{
                                    display: "inline-block",
                                    transition: "transform 0.3s",
                                    transform: showActions ? "rotate(45deg)" : "rotate(0deg)"
                                }}
                            >
                                <ImageUploadIcon size={18} />
                            </span>
                        </button>
                    </div>
                    <div className="relative flex min-w-0 flex-1 flex-col justify-center">
                        <textarea
                            id="kg-chat-textarea"
                            name="message"
                            autoComplete="off"
                            ref={textareaRef}
                            value={message}
                            onChange={handleTextareaChange}
                            placeholder={placeholder || "Type your message..."}
                            disabled={disabled}
                            rows={1}
                            className={`relative z-0 w-full min-w-0 resize-none border-none px-2 pr-12 text-sm focus:ring-0 focus:outline-none sm:px-3 sm:pr-12 ${isScrollable ? "scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent overflow-y-auto" : "overflow-hidden"} `}
                            style={{
                                minHeight: "1.75rem",
                                maxHeight: "7.5rem",
                                color: "#000000",
                                lineHeight: "1.25rem",
                                paddingTop: "0.375rem",
                                paddingBottom: "0.375rem"
                            }}
                            onWheel={handleTextareaWheel}
                            onFocus={() => {
                                // Only scroll into view if not currently generating to prevent layout shifts
                                if (!currentlyGenerating) {
                                    try {
                                        textareaRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
                                    } catch {}
                                }
                                setTimeout(() => {
                                    const el = textareaRef.current;
                                    if (!el) return;
                                    el.style.height = "auto";
                                    const maxHeight = 120;
                                    const sh = el.scrollHeight;
                                    if (sh > maxHeight) {
                                        el.style.height = `${maxHeight}px`;
                                        setIsScrollable(true);
                                    } else {
                                        el.style.height = `${Math.max(sh, 32)}px`;
                                        setIsScrollable(false);
                                    }
                                }, 0);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmit(e);
                                }
                            }}
                        />
                        <button
                            type={currentlyGenerating ? "button" : "submit"}
                            disabled={disabled || (!message.trim() && uploadedFiles.length === 0 && selectedContexts.length === 0 && !currentlyGenerating)}
                            onClick={currentlyGenerating ? handleStopGeneration : undefined}
                            className={`absolute right-1 ${isScrollable ? "bottom-1" : "top-1/2 -translate-y-1/2"} pointer-events-auto z-20 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-[#745263] text-white transition-all duration-200 hover:bg-[#9B7080] hover:scale-105 active:scale-95 disabled:cursor-default disabled:opacity-50 disabled:hover:scale-100 shadow-sm`}
                            title={currentlyGenerating ? "Stop generation" : "Send message"}
                            data-stop-button="custom"
                        >
                            {currentlyGenerating ? <StopIcon width={16} height={16} className="text-white" /> : <ArrowUp size={16} color="white" />}
                        </button>
                    </div>
                </div>
            </form>

            {showActions && (
                <ChatInputActions
                    disabled={disabled}
                    onAttachmentClick={handleCustomButtonClick}
                    files={uploadedFiles}
                    onFilesChange={setUploadedFiles}
                    onRequestSheetData={requestSheetData}
                />
            )}
            <CustomAttachmentUI isOpen={showCustomUI} onClose={() => setShowCustomUI(false)} onSelect={handleCustomUISelect} />
        </div>
    );
};

export default CustomChatInput;
