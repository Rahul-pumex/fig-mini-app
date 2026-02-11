import { type UploadedFile } from "../../molecules/ChatInputActions";
import { CustomChatInputProps, MetricOption } from "../../../types";
import { useEffect, useRef, useState, useCallback } from "react";
import CustomAttachmentUI from "../../molecules/CustomAttachmentUI";
import { ArrowUp, FileSpreadsheet } from 'lucide-react';
import { ContextBubble } from "../../molecules/contextBubble";
import { useSelectedContexts } from "../../SelectedContextsContext";
import StopIcon from "../../atoms/icons/stopIcon";
import Swal from "sweetalert2";

// Placeholder for suggestion bubbles (disabled in mini app)
const SuggestionBubbles = () => null;

const CustomChatInput = (props: CustomChatInputProps) => {
    const [message, setMessage] = useState("");
    const [showCustomUI, setShowCustomUI] = useState(false);
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

    // Request sheet data from Google Sheets parent window (copy to clipboard for Excel)
    const requestSheetData = useCallback(() => {
        if (typeof window !== "undefined" && window.parent !== window) {
            // We're in an iframe, send message to parent
            console.log('[Google Sheets] Requesting sheet data from parent window');
            window.parent.postMessage({ type: 'REQUEST_SHEET_DATA' }, '*');
        } else {
            console.warn('[Google Sheets] Not in an iframe, cannot request sheet data');
            // Just log warning, don't show alert
        }
    }, []);

    // Listen for sheet data from parent window
    useEffect(() => {
        if (typeof window === "undefined") return;

        const handleSheetData = async (event: MessageEvent) => {
            
            // Accept messages from any origin when in iframe (you may want to restrict this in production)
            if (event.data && event.data.type === 'SHEET_DATA' && event.data.source === 'google-sheets') {
                console.log('[Google Sheets] Processing SHEET_DATA message');
                const payload = event.data.payload;
                console.log('[Google Sheets] Payload:', payload);
                
                // Check if request was successful
                if (!payload) {
                    console.warn('[Google Sheets] No payload received');
                    // Just log warning, don't show alert
                    return;
                } else if (payload.success === false) {
                    console.error('[Google Sheets] Request failed:', payload.error || payload.message);
                    // Just log error, don't show alert
                    return;
                } else {
                    // Format the sheet data for Excel (tab-separated format for clipboard)
                    try {
                        // Handle the actual payload structure: { headers, rows, sheetName, rowCount, columnCount }
                        const headers = payload.headers || [];
                        const rows = payload.rows || [];
                        
                        let excelData = "";
                        
                        // Add headers if they exist (tab-separated)
                        if (headers.length > 0) {
                            excelData += headers.join("\t") + "\n";
                        }
                        
                        // Add data rows (tab-separated for Excel compatibility)
                        if (rows.length > 0) {
                            rows.forEach((row: any) => {
                                if (Array.isArray(row)) {
                                    // Convert array to tab-separated string
                                    excelData += row.map(cell => String(cell || "")).join("\t") + "\n";
                                } else if (typeof row === 'object' && row !== null) {
                                    // If row is an object, match with headers
                                    if (headers.length > 0) {
                                        const rowValues = headers.map((header: string) => {
                                            return String(row[header] !== undefined ? row[header] : '');
                                        });
                                        excelData += rowValues.join("\t") + "\n";
                                    } else {
                                        // No headers, just join object values
                                        excelData += Object.values(row).map(v => String(v || "")).join("\t") + "\n";
                                    }
                                } else {
                                    excelData += String(row) + "\n";
                                }
                            });
                        }
                        
                        // Copy to clipboard in Excel-compatible format (tab-separated)
                        if (excelData.trim()) {
                            try {
                                await navigator.clipboard.writeText(excelData.trim());
                                console.log('[Google Sheets] Data copied to clipboard in Excel format');
                                
                                // Show success toast notification
                                Swal.fire({
                                    title: 'Copied to Clipboard!',
                                    icon: 'success',
                                    toast: true,
                                    position: 'top-end',
                                    showConfirmButton: false,
                                    timer: 2000,
                                    timerProgressBar: true,
                                    width: 'auto'
                                });
                            } catch (clipboardError) {
                                console.error('[Google Sheets] Failed to copy to clipboard:', clipboardError);
                                // Just log error, don't show alert
                            }
                        } else {
                            console.warn('[Google Sheets] No data available in the spreadsheet to copy.');
                            // Just log warning, don't show alert
                        }
                    } catch (error) {
                        console.error('[Google Sheets] Error processing sheet data:', error);
                        // Just log error, don't show alert
                    }
                }
            }
        };

        window.addEventListener('message', handleSheetData);

        return () => {
            window.removeEventListener('message', handleSheetData);
        };
    }, []);

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
                            className="flex h-8 w-8 items-center justify-center rounded-lg transition-all hover:bg-gray-100 text-gray-600"
                            title="Copy spreadsheet data to Excel"
                            disabled={disabled}
                            onClick={requestSheetData}
                        >
                            <FileSpreadsheet size={18} />
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

            <CustomAttachmentUI isOpen={showCustomUI} onClose={() => setShowCustomUI(false)} onSelect={handleCustomUISelect} />
        </div>
    );
};

export default CustomChatInput;
