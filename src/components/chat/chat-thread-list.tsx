import * as React from "react";
import { Plus, MessageSquare, Trash2, Edit2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ChatThread } from "@/lib/db/schema";

interface ChatThreadListProps {
  threads: ChatThread[];
  activeThreadId?: string;
  onSelectThread: (threadId: string) => void;
  onNewThread: () => void;
  onRenameThread: (threadId: string, newTitle: string) => Promise<void>;
  onDeleteThread: (threadId: string) => Promise<void>;
  className?: string;
}

export function ChatThreadList({
  threads,
  activeThreadId,
  onSelectThread,
  onNewThread,
  onRenameThread,
  onDeleteThread,
  className,
}: ChatThreadListProps) {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editTitle, setEditTitle] = React.useState("");

  const handleStartRename = (thread: ChatThread, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(thread.id);
    setEditTitle(thread.title);
  };

  const handleSaveRename = async (threadId: string, e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation();
    if (!editTitle.trim()) {
      setEditingId(null);
      return;
    }
    await onRenameThread(threadId, editTitle.trim());
    setEditingId(null);
  };

  const handleCancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleDelete = async (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Delete this conversation thread?")) {
      await onDeleteThread(threadId);
    }
  };

  return (
    <div className={cn("flex flex-col h-full bg-muted/20 border-r border-border", className)}>
      {/* Top Header */}
      <div className="p-3 border-b border-border/80 flex items-center justify-between gap-2 shrink-0">
        <h3 className="font-semibold text-xs tracking-wider uppercase text-muted-foreground">
          Conversations
        </h3>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs font-medium bg-card hover:bg-card/80"
          onClick={onNewThread}
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </Button>
      </div>

      {/* Threads List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {threads.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No past conversations yet.
          </div>
        ) : (
          threads.map((thread) => {
            const isActive = thread.id === activeThreadId;

            if (editingId === thread.id) {
              return (
                <div
                  key={thread.id}
                  className="flex items-center gap-1 p-1 rounded-md bg-card border border-primary/40"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Input
                    size={1}
                    className="h-7 text-xs px-2 flex-1 min-w-0"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveRename(thread.id, e);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-emerald-500"
                    onClick={(e) => handleSaveRename(thread.id, e)}
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground"
                    onClick={handleCancelRename}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              );
            }

            return (
              <div
                key={thread.id}
                onClick={() => onSelectThread(thread.id)}
                className={cn(
                  "group flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer transition-all",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  <span className="truncate">{thread.title}</span>
                </div>

                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={(e) => handleStartRename(thread, e)}
                    title="Rename conversation"
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={(e) => handleDelete(thread.id, e)}
                    title="Delete conversation"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
