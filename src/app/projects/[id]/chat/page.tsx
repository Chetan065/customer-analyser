"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
  Bot,
  Sparkles,
  ArrowRight,
  Menu,
  X,
  Loader2,
  RefreshCw,
  HelpCircle,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatThreadList } from "@/components/chat/chat-thread-list";
import { ChatMessageItem } from "@/components/chat/chat-message-item";
import { ChatInput } from "@/components/chat/chat-input";
import type { ChatThread, ChatMessage } from "@/lib/db/schema";
import type { ChatStructuredPayload } from "@/lib/graph/chat/state";
import { toast } from "sonner";

interface StreamingStage {
  stage: string;
  count?: number;
}

const STARTER_PROMPTS = [
  {
    title: "Repeat Customer Negative Sentiment",
    question: "What are the biggest reasons for negative sentiment among repeat customers?",
    desc: "Examines price hikes, seat minimums, export bugs, and contract issues.",
  },
  {
    title: "New Customer Onboarding Friction",
    question: "What are new customers struggling with the most during onboarding?",
    desc: "Analyzes invite link expirations, wizard confusion, and setup hurdles.",
  },
  {
    title: "Top Requested Features",
    question: "What are the most requested features and tools across all feedback?",
    desc: "Highlights Slack bot integrations, calendar two-way sync, and recurring tasks.",
  },
  {
    title: "High Churn Risk Drivers",
    question: "Which issues have the highest churn risk and why are customers threatening to cancel?",
    desc: "Identifies severe bugs and policies directly driving team migrations to competitors.",
  },
];

export default function ProjectChatPage() {
  const params = useParams();
  const projectId = params?.id as string;

  const [threads, setThreads] = React.useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = React.useState<string | undefined>();
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [isLoadingThreads, setIsLoadingThreads] = React.useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = React.useState(false);
  const [isSending, setIsSending] = React.useState(false);
  const [currentStage, setCurrentStage] = React.useState<StreamingStage | null>(null);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages, currentStage]);

  // Load threads on mount
  const loadThreads = React.useCallback(async () => {
    try {
      setIsLoadingThreads(true);
      const res = await fetch(`/api/projects/${projectId}/chat/threads`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setThreads(data.data);
        if (data.data.length > 0 && !activeThreadId) {
          setActiveThreadId(data.data[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load threads:", err);
    } finally {
      setIsLoadingThreads(false);
    }
  }, [projectId, activeThreadId]);

  React.useEffect(() => {
    if (projectId) {
      loadThreads();
    }
  }, [projectId, loadThreads]);

  // Load messages when activeThreadId changes
  React.useEffect(() => {
    if (!activeThreadId) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      try {
        setIsLoadingMessages(true);
        const res = await fetch(`/api/projects/${projectId}/chat/threads/${activeThreadId}`);
        const data = await res.json();
        if (data.success && data.data?.messages) {
          setMessages(data.data.messages);
        }
      } catch (err) {
        console.error("Failed to load messages:", err);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    loadMessages();
  }, [projectId, activeThreadId]);

  // New Thread
  const handleNewThread = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/chat/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Conversation" }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setThreads((prev) => [data.data, ...prev]);
        setActiveThreadId(data.data.id);
        setMessages([]);
        setIsMobileDrawerOpen(false);
      }
    } catch (err) {
      toast.error("Failed to create new conversation.");
    }
  };

  // Rename Thread
  const handleRenameThread = async (threadId: string, newTitle: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/chat/threads/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
      const data = await res.json();
      if (data.success) {
        setThreads((prev) =>
          prev.map((t) => (t.id === threadId ? { ...t, title: newTitle } : t))
        );
        toast.success("Conversation renamed.");
      }
    } catch (err) {
      toast.error("Failed to rename conversation.");
    }
  };

  // Delete Thread
  const handleDeleteThread = async (threadId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/chat/threads/${threadId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setThreads((prev) => prev.filter((t) => t.id !== threadId));
        if (activeThreadId === threadId) {
          const remaining = threads.filter((t) => t.id !== threadId);
          setActiveThreadId(remaining[0]?.id);
        }
        toast.success("Conversation deleted.");
      }
    } catch (err) {
      toast.error("Failed to delete conversation.");
    }
  };

  // Send Message with SSE streaming
  const handleSendMessage = async (
    text: string,
    filters: {
      customerSegment?: string | null;
      isRepeatCustomer?: boolean | null;
      sentiment?: "positive" | "neutral" | "negative" | null;
    }
  ) => {
    if (!text.trim() || isSending) return;

    // Optimistically add user message
    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      threadId: activeThreadId || "",
      role: "user",
      content: text,
      filters,
      structuredPayload: null,
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setIsSending(true);
    setCurrentStage({ stage: "understanding" });

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`/api/projects/${projectId}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          message: text,
          threadId: activeThreadId,
          filters,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body available");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const block of lines) {
          const match = block.match(/^data:\s*(.+)$/m);
          if (!match) continue;

          try {
            const eventData = JSON.parse(match[1]);

            if (eventData.type === "stage") {
              setCurrentStage({
                stage: eventData.stage,
                count: eventData.count,
              });
            } else if (eventData.type === "done") {
              const finalPayload: ChatStructuredPayload = eventData.payload;
              const newMsg: ChatMessage = {
                id: eventData.messageId || `msg-${Date.now()}`,
                threadId: eventData.threadId || activeThreadId || "",
                role: "assistant",
                content: finalPayload.headline || "Feedback analysis summary",
                structuredPayload: finalPayload,
                filters,
                createdAt: new Date(),
              };

              setMessages((prev) => [...prev, newMsg]);

              // Update active thread if newly created
              if (eventData.threadId && eventData.threadId !== activeThreadId) {
                setActiveThreadId(eventData.threadId);
                loadThreads();
              }
            } else if (eventData.type === "error") {
              toast.error(eventData.error || "Analysis pipeline error");
            }
          } catch (jsonErr) {
            console.warn("Error parsing SSE block:", jsonErr);
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Chat error:", err);
        toast.error("Failed to generate response. Please try again.");
      }
    } finally {
      setIsSending(false);
      setCurrentStage(null);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsSending(false);
      setCurrentStage(null);
      toast.info("Generation cancelled.");
    }
  };

  const getStageDescription = (stage: StreamingStage) => {
    switch (stage.stage) {
      case "understanding":
        return "Parsing question intent & customer segment filters...";
      case "planning":
        return "Constructing retrieval queries & segment index bounds...";
      case "retrieving":
        return stage.count != null
          ? `Retrieved ${stage.count} matching customer reviews...`
          : "Retrieving relevant feedback & themes...";
      case "analyzing":
        return "Computing deterministic sentiment counts & ranking pain points...";
      case "synthesizing":
        return "Synthesizing executive insights & product recommendations...";
      case "verifying":
        return "Auditing quotes against verbatim customer feedback...";
      default:
        return "Processing feedback intelligence...";
    }
  };

  return (
    <div className="flex h-[calc(100dvh-4rem)] w-full overflow-hidden bg-background">
      {/* Desktop Threads Sidebar */}
      <div className="hidden md:block w-64 shrink-0 h-full">
        <ChatThreadList
          threads={threads}
          activeThreadId={activeThreadId}
          onSelectThread={(id) => setActiveThreadId(id)}
          onNewThread={handleNewThread}
          onRenameThread={handleRenameThread}
          onDeleteThread={handleDeleteThread}
        />
      </div>

      {/* Mobile Drawer Backdrop */}
      {isMobileDrawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-xs"
          onClick={() => setIsMobileDrawerOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <div
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-72 bg-card shadow-2xl transform transition-transform duration-200 ease-in-out ${
          isMobileDrawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-3 border-b flex items-center justify-between">
          <span className="font-semibold text-sm">Conversations</span>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => setIsMobileDrawerOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="h-[calc(100%-3.5rem)]">
          <ChatThreadList
            threads={threads}
            activeThreadId={activeThreadId}
            onSelectThread={(id) => {
              setActiveThreadId(id);
              setIsMobileDrawerOpen(false);
            }}
            onNewThread={handleNewThread}
            onRenameThread={handleRenameThread}
            onDeleteThread={handleDeleteThread}
          />
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Top Chat Bar */}
        <div className="h-12 border-b border-border/80 px-4 flex items-center justify-between shrink-0 bg-background/50">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-8 w-8 -ml-1 text-muted-foreground"
              onClick={() => setIsMobileDrawerOpen(true)}
              aria-label="Open conversation list"
            >
              <Menu className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-2 truncate">
              <span className="font-semibold text-sm truncate">
                {threads.find((t) => t.id === activeThreadId)?.title || "Ask PulseIQ"}
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                <ShieldCheck className="h-3 w-3" />
                Grounded Verification Active
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1 bg-card hover:bg-muted"
              onClick={handleNewThread}
            >
              <Sparkles className="h-3 w-3 text-primary" />
              <span>New Query</span>
            </Button>
          </div>
        </div>

        {/* Messages Stream Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {isLoadingMessages ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground py-20">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs">Loading conversation history...</p>
            </div>
          ) : messages.length === 0 ? (
            /* Empty State with Starter Prompts */
            <div className="max-w-3xl mx-auto py-8 sm:py-12 space-y-8">
              <div className="text-center space-y-2">
                <div className="inline-flex h-12 w-12 rounded-2xl bg-primary/10 text-primary items-center justify-center mb-2 shadow-xs border border-primary/20">
                  <Bot className="h-6 w-6" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  Ask PulseIQ Conversational Intelligence
                </h2>
                <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
                  Query feedback by customer segment (repeat vs new), discover why users churn, and extract verifiable evidence quotes in seconds.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {STARTER_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(prompt.question, {})}
                    className="group rounded-xl border border-border/80 bg-card p-4 text-left shadow-xs hover:border-primary/50 hover:bg-primary/5 transition-all space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                        {prompt.title}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      &ldquo;{prompt.question}&rdquo;
                    </p>
                    <p className="text-[11px] text-muted-foreground/80 italic pt-1">
                      {prompt.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Message List */
            <div className="max-w-4xl mx-auto">
              {messages.map((msg) => (
                <ChatMessageItem
                  key={msg.id}
                  role={msg.role as "user" | "assistant"}
                  content={msg.content}
                  structuredPayload={msg.structuredPayload}
                  filters={msg.filters}
                  createdAt={msg.createdAt}
                  onSelectFollowUp={(q) => handleSendMessage(q, {})}
                />
              ))}

              {/* Streaming In-Flight Progress Indicator */}
              {isSending && currentStage && (
                <div className="flex items-start gap-3 mb-6 w-full animate-fade-in">
                  <div className="h-8 w-8 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  </div>
                  <div className="rounded-xl border border-primary/20 bg-card p-4 shadow-xs flex-1 max-w-xl space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                      <span className="font-medium text-xs text-foreground">
                        {getStageDescription(currentStage)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300 rounded-full"
                        style={{
                          width:
                            currentStage.stage === "understanding"
                              ? "20%"
                              : currentStage.stage === "planning"
                              ? "35%"
                              : currentStage.stage === "retrieving"
                              ? "55%"
                              : currentStage.stage === "analyzing"
                              ? "75%"
                              : currentStage.stage === "synthesizing"
                              ? "90%"
                              : "95%",
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Chat Input Bar */}
        <ChatInput
          onSendMessage={handleSendMessage}
          isLoading={isSending}
          onStop={handleStop}
        />
      </div>
    </div>
  );
}
