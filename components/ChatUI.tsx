"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import TabBar, { Tab } from "./TabBar";

const MODELS = [
  { id: "mistral-large-2512", label: "Mistral Large", color: "#ff7043" },
  { id: "codestral-latest", label: "Codestral", color: "#c084fc" },
  { id: "openai/gpt-oss-120b", label: "GPT OSS 120B", color: "#00ff9d" },
  { id: "openai/gpt-oss-20b", label: "GPT OSS 20B", color: "#00d4ff" },
  { id: "groq/compound", label: "Compound", color: "#ff6b35" },
  { id: "groq/compound-mini", label: "Compound Mini", color: "#ff6b35" },
  { id: "moonshotai/kimi-k2-instruct", label: "Kimi K2", color: "#a78bfa" },
  { id: "qwen/qwen3-32b", label: "Qwen3 32B", color: "#fbbf24" },
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", color: "#34d399" },
];

const MAX_TABS = 8;

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  model: string;
  createdAt: string;
  imagePreview?: string;
  generatedImages?: string[];
  isStreaming?: boolean;
};

type Session = {
  id: string;
  name: string;
  model: string;
  pinned: boolean;
  createdAt: string;
  messages: Message[];
  hasMore?: boolean;
  totalMessages?: number;
  messagesLoaded?: boolean;
  isEmpty?: boolean;
};

function splitIntoSentences(text: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inCodeBlock = false;
  let inTable = false;
  const lines = text.split('\n');

  for (const line of lines) {
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      current += line + '\n';
      if (!inCodeBlock) { parts.push(current.trim()); current = ''; }
      continue;
    }
    if (inCodeBlock) { current += line + '\n'; continue; }

    if (line.startsWith('|')) {
      inTable = true;
      current += line + '\n';
      continue;
    }

    if (inTable) {
      inTable = false;
      if (current.trim()) { parts.push(current.trim()); current = ''; }
    }

    current += line + '\n';
    if (/[.!?]\s*$/.test(line.trim()) || line.trim() === '') {
      if (current.trim()) { parts.push(current.trim()); current = ''; }
    }
  }

  if (current.trim()) parts.push(current.trim());
  return parts.filter(Boolean);
}

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      style={{ background: copied ? "#00ff9d18" : "transparent", border: `1px solid ${copied ? "#00ff9d44" : "#333"}`, borderRadius: "5px", padding: "3px 10px", color: copied ? "#00ff9d" : "#94a3b8", fontSize: "11px", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", transition: "all 0.2s ease" }}>
      {copied ? "✓ copied" : "copy"}
    </button>
  );
}

function StreamingMessage({ content, model, generatedImages, isStreaming }: {
  content: string; model: string; generatedImages?: string[]; isStreaming?: boolean;
}) {
  const modelInfo = MODELS.find(m => m.id === model);
  const [visibleSentences, setVisibleSentences] = useState<string[]>([]);
  const prevContentRef = useRef('');

  useEffect(() => {
    if (!isStreaming) { setVisibleSentences(splitIntoSentences(content)); return; }
    if (content === prevContentRef.current) return;
    prevContentRef.current = content;
    setVisibleSentences(splitIntoSentences(content));
  }, [content, isStreaming]);

  const markdownComponents = {
    a: ({ node, ...props }: any) => (
      <a style={{ color: "#00d4ff", textDecoration: "none", borderBottom: "1px solid #00d4ff44", transition: "all 0.2s ease", fontWeight: 500 }}
        onMouseEnter={e => { e.currentTarget.style.color = "#00e8ff"; e.currentTarget.style.borderBottom = "1px solid #00e8ff"; }}
        onMouseLeave={e => { e.currentTarget.style.color = "#00d4ff"; e.currentTarget.style.borderBottom = "1px solid #00d4ff44"; }}
        {...props} />
    ),
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || "");
      const codeString = String(children).replace(/\n$/, "");
      return !inline && match ? (
        <div style={{ margin: "8px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 12px", background: "#1a1a1a", borderRadius: "8px 8px 0 0", border: "1px solid #333", borderBottom: "none" }}>
            <span style={{ fontSize: "11px", color: "#94a3b8", fontFamily: "'JetBrains Mono', monospace" }}>{match[1]}</span>
            <CopyButton code={codeString} />
          </div>
          <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div"
            customStyle={{ borderRadius: "0 0 8px 8px", fontSize: "12.5px", margin: "0", border: "1px solid #333", borderTop: "none", background: "#1a1a1a" }} {...props}>
            {codeString}
          </SyntaxHighlighter>
        </div>
      ) : (
        <code style={{ background: "#333", padding: "2px 6px", borderRadius: "4px", fontSize: "12px", fontFamily: "'JetBrains Mono', monospace", color: "#00ff9d" }} {...props}>{children}</code>
      );
    },
    p: ({ children }: any) => <p style={{ margin: "4px 0", lineHeight: "1.65" }}>{children}</p>,
    ul: ({ children }: any) => <ul style={{ paddingLeft: "18px", margin: "6px 0" }}>{children}</ul>,
    ol: ({ children }: any) => <ol style={{ paddingLeft: "18px", margin: "6px 0" }}>{children}</ol>,
    li: ({ children }: any) => <li style={{ margin: "3px 0", lineHeight: "1.6" }}>{children}</li>,
    h1: ({ children }: any) => <h1 style={{ fontSize: "18px", fontWeight: 700, color: "#f1f5f9", margin: "12px 0 6px" }}>{children}</h1>,
    h2: ({ children }: any) => <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#f1f5f9", margin: "10px 0 5px" }}>{children}</h2>,
    h3: ({ children }: any) => <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#e2e8f0", margin: "8px 0 4px" }}>{children}</h3>,
    strong: ({ children }: any) => <strong style={{ color: "#f1f5f9", fontWeight: 600 }}>{children}</strong>,
    blockquote: ({ children }: any) => <blockquote style={{ borderLeft: "3px solid #00ff9d44", paddingLeft: "12px", margin: "8px 0", color: "#64748b", fontStyle: "italic" }}>{children}</blockquote>,
    table: ({ children }: any) => (
      <div style={{ overflowX: "auto", margin: "10px 0", borderRadius: "8px", border: "1px solid #333" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "12.5px" }}>{children}</table>
      </div>
    ),
    thead: ({ children }: any) => <thead style={{ background: "#1a1a1a" }}>{children}</thead>,
    tbody: ({ children }: any) => <tbody>{children}</tbody>,
    tr: ({ children }: any) => (
      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.15)", transition: "background 0.1s" }}
        onMouseEnter={e => (e.currentTarget.style.background = "#333")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
        {children}
      </tr>
    ),
    th: ({ children }: any) => <th style={{ padding: "8px 14px", textAlign: "left", color: "#94a3b8", fontWeight: 600, fontSize: "11px", letterSpacing: "0.5px", whiteSpace: "nowrap", borderBottom: "2px solid rgba(255,255,255,0.3)", borderRight: "1px solid rgba(255,255,255,0.15)" }}>{children}</th>,
    td: ({ children }: any) => <td style={{ padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.15)", borderRight: "1px solid rgba(255,255,255,0.15)", color: "#cbd5e1", verticalAlign: "top" }}>{children}</td>,
  };

  return (
    <div>
      {isStreaming ? (
        <div>
          {visibleSentences.map((sentence, i) => (
            <div key={i} style={{ animation: `cgSentenceFade 0.4s ease forwards`, opacity: 0, animationDelay: `${Math.min(i * 0.05, 0.3)}s` }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{sentence}</ReactMarkdown>
            </div>
          ))}
          <span style={{ display: 'inline-block', width: '2px', height: '14px', background: modelInfo?.color ?? '#00ff9d', marginLeft: '2px', verticalAlign: 'text-bottom', animation: 'cgCursorBlink 0.8s ease infinite' }} />
        </div>
      ) : (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{content}</ReactMarkdown>
      )}
      {generatedImages && generatedImages.length > 0 && (
        <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {generatedImages.map((imgUrl, i) => (
            <div key={i} style={{ animation: 'cgSentenceFade 0.5s ease forwards' }}>
              <img src={imgUrl} alt={`Generated ${i + 1}`} style={{ maxWidth: "100%", borderRadius: "10px", border: "1px solid #ff704344", display: "block" }} />
              <div style={{ marginTop: "4px", fontSize: "9px", color: "#ff7043", fontFamily: "'JetBrains Mono', monospace" }}>🎨 generated by Mistral</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  const model = MODELS.find(m => m.id === msg.model);
  return (
    <div style={{ display: "flex", flexDirection: isUser ? "row-reverse" : "row", gap: "8px", padding: "4px 16px", alignItems: "flex-start" }}>
      <div style={{ width: "28px", height: "28px", borderRadius: "8px", flexShrink: 0, background: isUser ? "#6366f122" : "#333", border: isUser ? "1px solid #6366f133" : "1px solid #333", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", marginTop: "2px" }}>
        {isUser ? "Y" : "⚡"}
      </div>
      <div style={{ maxWidth: "75%", display: "flex", flexDirection: "column", gap: "4px", alignItems: isUser ? "flex-end" : "flex-start" }}>
        <div style={{ padding: "10px 14px", borderRadius: isUser ? "14px 4px 14px 14px" : "4px 14px 14px 14px", background: isUser ? "#424242" : "#2a2a2a", border: isUser ? "1px solid #555" : "1px solid #333", color: "#e2e8f0", fontSize: "13.5px", lineHeight: "1.65", fontFamily: "'Inter', sans-serif", wordBreak: "break-word" }}>
          {isUser && msg.imagePreview && (
            <img src={msg.imagePreview} alt="attached" style={{ maxWidth: "200px", maxHeight: "200px", borderRadius: "8px", marginBottom: "6px", display: "block", border: "1px solid #333" }} />
          )}
          {isUser ? (
            <span style={{ whiteSpace: "pre-wrap" }}>{msg.content.replace("📎 [Image attached]\n", "")}</span>
          ) : (
            <StreamingMessage content={msg.content} model={msg.model} generatedImages={msg.generatedImages} isStreaming={msg.isStreaming} />
          )}
        </div>
        {!isUser && model && (
          <span style={{ fontSize: "10px", color: model.color, fontFamily: "'JetBrains Mono', monospace", opacity: 0.7 }}>
            {msg.isStreaming ? `${model.label} · generating...` : model.label}
          </span>
        )}
      </div>
    </div>
  );
}

function TypingDots({ modelLabel, modelColor }: { modelLabel: string; modelColor: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "14px 16px" }}>
      <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: "#333", border: "1px solid #333", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", flexShrink: 0 }}>⚡</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <div style={{ display: "flex", gap: "3px", alignItems: "center" }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ width: "5px", height: "5px", borderRadius: "50%", background: modelColor, animation: `cgBounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
          ))}
        </div>
        <span style={{ fontSize: "9px", color: modelColor, fontFamily: "'JetBrains Mono', monospace", opacity: 0.6 }}>{modelLabel} · thinking...</span>
      </div>
    </div>
  );
}

export default function CodingGuru() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [inputHasText, setInputHasText] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageMime, setSelectedImageMime] = useState<string>("image/png");
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [sidebarDragOver, setSidebarDragOver] = useState(false);
  const [isDraggingSession, setIsDraggingSession] = useState(false);

  const draggingSessionIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesTopRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const activeSession = sessions.find(s => s.id === activeSessionId) ?? null;
  const activeMessages = activeSession?.messages ?? [];
  const activeModel = MODELS.find(m => m.id === activeSession?.model);
  const streamingSessionId = streamingMsgId ? activeSessionId : null;

  useEffect(() => { fetchSessions(); }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollButton(false);
  }, [isTyping, streamingMsgId]);

  useEffect(() => {
    if (activeSession?.messagesLoaded) {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      setShowScrollButton(false);
    }
  }, [activeSession?.messagesLoaded]);

  useEffect(() => {
    if (activeSessionId) setTimeout(() => inputRef.current?.focus(), 100);
  }, [activeSessionId]);

  useEffect(() => {
    if (!activeSessionId) return;
    const session = sessions.find(s => s.id === activeSessionId);
    if (!session || session.messagesLoaded) return;
    loadMessages(activeSessionId);
  }, [activeSessionId]);

  // Keep tab labels in sync with session names (e.g. after autonaming)
  useEffect(() => {
    setTabs(prev => prev.map(tab => {
      const session = sessions.find(s => s.id === tab.sessionId);
      if (!session) return tab;
      return {
        ...tab,
        label: session.name,
        model: session.model,
        modelColor: MODELS.find(m => m.id === session.model)?.color ?? "#00ff9d",
      };
    }));
  }, [sessions]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!activeSession) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (!file) return;
          setSelectedImageMime(file.type);
          const preview = URL.createObjectURL(file);
          setSelectedImagePreview(preview);
          const reader = new FileReader();
          reader.onload = () => { const base64 = (reader.result as string).split(",")[1]; setSelectedImage(base64); };
          reader.readAsDataURL(file);
          break;
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [activeSession]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      const emptySessions = sessions.filter(s => s.messagesLoaded === true && s.messages.length === 0);
      if (emptySessions.length === 0) return;
      emptySessions.forEach(s => {
        const blob = new Blob([JSON.stringify({ sessionId: s.id })], { type: "application/json" });
        navigator.sendBeacon("/api/sessions/cleanup", blob);
      });
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [sessions]);

  // ─── KEYBOARD SHORTCUTS ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const ctrl = isMac ? e.metaKey : e.ctrlKey;
      if (!ctrl) return;

      // Ctrl+W — close active tab
      if (e.key === "w" && tabs.length > 0 && activeSessionId) {
        e.preventDefault();
        closeTab(activeSessionId);
        return;
      }

      // Ctrl+Tab — next tab, Ctrl+Shift+Tab — previous tab
      if (e.key === "Tab" && tabs.length > 1) {
        e.preventDefault();
        const currentIndex = tabs.findIndex(t => t.sessionId === activeSessionId);
        if (e.shiftKey) {
          // Go left
          const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
          setActiveSessionId(tabs[prevIndex].sessionId);
        } else {
          // Go right
          const nextIndex = (currentIndex + 1) % tabs.length;
          setActiveSessionId(tabs[nextIndex].sessionId);
        }
        return;
      }

      // Ctrl+1 through Ctrl+8 — jump to tab by number
      const num = parseInt(e.key);
      if (!isNaN(num) && num >= 1 && num <= 8 && tabs[num - 1]) {
        e.preventDefault();
        setActiveSessionId(tabs[num - 1].sessionId);
        return;
      }

      // Ctrl+T — new chat
      if (e.key === "t") {
        e.preventDefault();
        handleCreateSession();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tabs, activeSessionId, sessions]);

  // ─── TAB DRAG & DROP ─────────────────────────────────────────────────────────

  function handleSidebarDragStart(e: React.DragEvent, sessionId: string) {
    setIsDraggingSession(true);
    draggingSessionIdRef.current = sessionId;
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("text/plain", sessionId);
  }

  function handleTabBarDropZoneDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setSidebarDragOver(true);
  }

  function handleTabBarDropZoneDragLeave(e: React.DragEvent) {
    // Only hide if leaving the drop zone entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setSidebarDragOver(false);
    }
  }

  function handleTabBarDropZoneDrop(e: React.DragEvent) {
    e.preventDefault();
    setSidebarDragOver(false);
    setIsDraggingSession(false);
    const sessionId = draggingSessionIdRef.current ?? e.dataTransfer.getData("text/plain");
    if (!sessionId) return;
    openAsTab(sessionId);
    draggingSessionIdRef.current = null;
  }

  function openAsTab(sessionId: string) {
    if (tabs.find(t => t.sessionId === sessionId)) {
      setActiveSessionId(sessionId);
      return;
    }
    if (tabs.length >= MAX_TABS) {
      setError(`Max ${MAX_TABS} tabs open at once`);
      return;
    }
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    const newTab: Tab = {
      sessionId,
      label: session.name,
      model: session.model,
      modelColor: MODELS.find(m => m.id === session.model)?.color ?? "#00ff9d",
    };
    setTabs(prev => [...prev, newTab]);
    setActiveSessionId(sessionId);
  }

  function closeTab(sessionId: string) {
    setTabs(prev => {
      const updated = prev.filter(t => t.sessionId !== sessionId);
      if (activeSessionId === sessionId) {
        const fallback = updated[updated.length - 1];
        setActiveSessionId(fallback?.sessionId ?? sessions.find(s => s.id !== sessionId)?.id ?? null);
      }
      return updated;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────

  async function fetchSessions() {
    try {
      setLoading(true);
      const newRes = await fetch("/api/sessions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Chat", model: localStorage.getItem('cg-default-model') ?? 'mistral-large-2512' })
      });
      const newSession = await newRes.json();
      const res = await fetch("/api/sessions");
      const data = await res.json();
      setSessions(data.map((s: any) => ({ ...s, messages: [], messagesLoaded: s.id === newSession.id ? true : false, hasMore: false })));
      setActiveSessionId(newSession.id);
    } catch { setError("Failed to load sessions"); }
    finally { setLoading(false); }
  }

  async function loadMessages(sessionId: string) {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/messages?sessionId=${sessionId}`);
      const data = await res.json();
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, messages: data.messages, hasMore: data.hasMore, totalMessages: data.total, messagesLoaded: true } : s
      ));
    } catch { setError("Failed to load messages"); }
    finally { setLoadingMessages(false); }
  }

  async function loadOlderMessages(sessionId: string) {
    const session = sessions.find(s => s.id === sessionId);
    if (!session || !session.hasMore || loadingOlder) return;
    const oldestMsg = session.messages[0];
    if (!oldestMsg) return;
    setLoadingOlder(true);
    const container = messagesContainerRef.current;
    const scrollHeightBefore = container?.scrollHeight ?? 0;
    try {
      const res = await fetch(`/api/messages?sessionId=${sessionId}&cursor=${oldestMsg.id}`);
      const data = await res.json();
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, messages: [...data.messages, ...s.messages], hasMore: data.hasMore } : s
      ));
      requestAnimationFrame(() => {
        if (container) container.scrollTop = container.scrollHeight - scrollHeightBefore;
      });
    } catch { setError("Failed to load older messages"); }
    finally { setLoadingOlder(false); }
  }

  function handleMessagesScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    setShowScrollButton(el.scrollTop < el.scrollHeight - el.clientHeight - 100);
    if (el.scrollTop < 80 && activeSessionId && activeSession?.hasMore && !loadingOlder) {
      loadOlderMessages(activeSessionId);
    }
  }

  async function handleCreateSession() {
    setSessions(prev => prev.filter(s => !s.isEmpty));
    const savedModel = localStorage.getItem('cg-default-model') ?? 'mistral-large-2512';
    try {
      const res = await fetch("/api/sessions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Chat", model: savedModel })
      });
      const session = await res.json();
      setSessions(prev => [{ ...session, messages: [], pinned: false, messagesLoaded: true, hasMore: false, isEmpty: true }, ...prev]);
      setActiveSessionId(session.id);
    } catch { setError("Failed to create session"); }
  }

  async function handleDeleteSession(sessionId: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await fetch("/api/sessions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId }) });
      setTabs(prev => prev.filter(t => t.sessionId !== sessionId));
      setSessions(prev => {
        const updated = prev.filter(s => s.id !== sessionId);
        if (activeSessionId === sessionId) setActiveSessionId(updated[0]?.id ?? null);
        return updated;
      });
    } catch { setError("Failed to delete session"); }
  }

  async function handlePinSession(sessionId: string, e: React.MouseEvent) {
    e.stopPropagation();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    const newPinned = !session.pinned;
    try {
      await fetch("/api/sessions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, pinned: newPinned }) });
      setSessions(prev => {
        const updated = prev.map(s => s.id === sessionId ? { ...s, pinned: newPinned } : s);
        return [...updated.filter(s => s.pinned), ...updated.filter(s => !s.pinned)];
      });
    } catch { setError("Failed to pin session"); }
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedImageMime(file.type);
    const preview = URL.createObjectURL(file);
    setSelectedImagePreview(preview);
    const reader = new FileReader();
    reader.onload = () => { const base64 = (reader.result as string).split(",")[1]; setSelectedImage(base64); };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function handleStop() {
    abortControllerRef.current?.abort();
    setIsTyping(false);
    if (streamingMsgId) {
      setSessions(prev => prev.map(s =>
        s.id === activeSessionId ? {
          ...s, messages: s.messages.map(m =>
            m.id === streamingMsgId ? { ...m, isStreaming: false, content: m.content || '_(stopped)_' } : m
          )
        } : s
      ));
      setStreamingMsgId(null);
    }
    inputRef.current?.focus();
  }

  async function handleSend() {
    const content = inputRef.current?.value.trim() ?? "";
    if (!content && !selectedImage || !activeSessionId || isTyping) return;

    if (inputRef.current) { inputRef.current.value = ""; inputRef.current.style.height = "auto"; }
    setInputHasText(false);
    setIsTyping(true);
    setError(null);

    const imageToSend = selectedImage;
    const mimeToSend = selectedImageMime;
    const previewToSend = selectedImagePreview;
    setSelectedImage(null);
    setSelectedImagePreview(null);

    const currentSessionId = activeSessionId;
    const tempUserMsg: Message = {
      id: `temp-user-${Date.now()}`, role: "user",
      content: imageToSend ? `📎 [Image attached]\n${content}` : content,
      model: activeSession!.model, createdAt: new Date().toISOString(),
      imagePreview: previewToSend ?? undefined,
    };

    setSessions(prev => prev.map(s =>
      s.id === currentSessionId ? { ...s, messages: [...s.messages, tempUserMsg], isEmpty: false } : s
    ));

    const streamingId = `streaming-${Date.now()}`;
    setStreamingMsgId(streamingId);
    const streamingMsg: Message = {
      id: streamingId, role: "assistant", content: "",
      model: activeSession!.model, createdAt: new Date().toISOString(), isStreaming: true,
    };
    setSessions(prev => prev.map(s =>
      s.id === currentSessionId ? { ...s, messages: [...s.messages, streamingMsg] } : s
    ));

    try {
      abortControllerRef.current = new AbortController();
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({ sessionId: currentSessionId, content: content || "What do you see in this image?", imageBase64: imageToSend, imageMimeType: mimeToSend })
      });

      if (!res.ok) throw new Error((await res.json()).error ?? "API error");
      if (!res.body) throw new Error("No stream body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedContent = '';
      let finalImages: string[] | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'chunk') {
              accumulatedContent += event.content;
              setSessions(prev => prev.map(s =>
                s.id === currentSessionId ? { ...s, messages: s.messages.map(m => m.id === streamingId ? { ...m, content: accumulatedContent } : m) } : s
              ));
              messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }
            if (event.type === 'images') { finalImages = event.images; }
            if (event.type === 'done') {
              setSessions(prev => prev.map(s =>
                s.id === currentSessionId ? {
                  ...s, messages: s.messages.map(m =>
                    m.id === streamingId ? { ...m, id: event.messageId, content: accumulatedContent, model: event.model, isStreaming: false, generatedImages: finalImages ?? undefined } : m
                  )
                } : s
              ));
              setStreamingMsgId(null);
            }
            if (event.type === 'error') throw new Error(event.error);
          } catch { /* skip malformed */ }
        }
      }

      const currentSession = sessions.find(s => s.id === currentSessionId);
      if (currentSession && currentSession.messages.filter(m => m.role === 'user').length === 0) {
        fetch("/api/sessions/autonaming", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: content || "Image attached" }) })
          .then(r => r.json())
          .then(({ name }) => {
            fetch("/api/sessions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: currentSessionId, name }) })
              .then(() => setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, name } : s)));
          }).catch(() => {});
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setSessions(prev => prev.map(s =>
          s.id === currentSessionId ? { ...s, messages: s.messages.map(m => m.id === streamingId ? { ...m, isStreaming: false, content: m.content || '_(stopped)_' } : m) } : s
        ));
        setStreamingMsgId(null);
        return;
      }
      setError(err.message ?? "Something went wrong");
      setSessions(prev => prev.map(s =>
        s.id === currentSessionId ? { ...s, messages: s.messages.filter(m => m.id !== streamingId) } : s
      ));
      setStreamingMsgId(null);
    } finally {
      setIsTyping(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  async function handleSwitchModel(modelId: string) {
    if (!activeSessionId) return;
    setShowModelPicker(false);
    localStorage.setItem('cg-default-model', modelId);
    try {
      await fetch("/api/chat", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: activeSessionId, model: modelId }) });
      setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, model: modelId } : s));
    } catch { setError("Failed to switch model"); }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; overflow: hidden; background: #212121; }
        @keyframes cgBounce { 0%, 80%, 100% { transform: translateY(0); opacity: 0.3; } 40% { transform: translateY(-5px); opacity: 1; } }
        @keyframes cgFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes cgSentenceFade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes cgCursorBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes cgPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes cgStopPulse { 0%, 100% { box-shadow: 0 0 0 0 #ef444433; } 50% { box-shadow: 0 0 0 4px #ef444411; } }
        @keyframes cgSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .cg-session:hover .cg-del { opacity: 1 !important; }
        .cg-session:hover .cg-pin { opacity: 1 !important; }
        .cg-session:hover .cg-drag-hint { opacity: 1 !important; }
        .cg-session:hover { background: #2f2f2f !important; }
        .cg-session.active { background: #1a2e22 !important; border-color: #00ff9d44 !important; border-left: 2px solid #00ff9d !important; }
        .cg-session.pinned { border-left: 2px solid #fbbf24 !important; border-color: #fbbf2433 !important; }
        .cg-session.as-tab { border-left: 2px solid #6366f1 !important; }
        .cg-model-opt:hover { background: #333 !important; }
        .cg-send:hover:not(:disabled) { background: #00e88d !important; }
        .cg-stop:hover { background: #ef444430 !important; border-color: #ef4444 !important; }
        .cg-new:hover { border-color: #00ff9d66 !important; color: #00ff9d !important; }
        .cg-attach:hover { border-color: #00ff9d66 !important; color: #00ff9d !important; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: #444; border-radius: 2px; }
      `}</style>

      <div style={{ display: "flex", height: "100vh", width: "100%", background: "#212121", fontFamily: "'Inter', sans-serif", overflow: "hidden" }}>

        {/* SIDEBAR */}
        <div style={{ width: "240px", minWidth: "240px", height: "100vh", background: "#2a2a2a", borderRight: "1px solid #333", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "18px 16px 14px", borderBottom: "1px solid #333", display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: "linear-gradient(135deg, #00ff9d, #00c4f0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", boxShadow: "0 0 16px #00ff9d33", flexShrink: 0 }}>⚡</div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "#f1f5f9", letterSpacing: "-0.2px" }}>CodingGuru</div>
              <div style={{ fontSize: "9px", color: "#00ff9d", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "1px", opacity: 0.8 }}>AI ASSISTANT</div>
            </div>
          </div>

          <div style={{ padding: "12px 10px 6px" }}>
            <button className="cg-new" onClick={handleCreateSession}
              style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px dashed #333", background: "transparent", color: "#94a3b8", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", transition: "all 0.15s ease", fontFamily: "'Inter', sans-serif" }}>
              <span>+</span> New Chat
            </button>
          </div>

          {/* Drag hint */}
          <div style={{ padding: "2px 12px 4px", fontSize: "9px", color: "#6366f155", fontFamily: "'JetBrains Mono', monospace", display: "flex", alignItems: "center", gap: "4px" }}>
            <span>⊞</span> drag a chat up to open as tab
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "4px 8px" }}>
            {loading ? (
              <div style={{ padding: "20px", textAlign: "center", color: "#64748b", fontSize: "12px" }}>Loading...</div>
            ) : sessions.length === 0 ? (
              <div style={{ padding: "20px 12px", textAlign: "center", color: "#64748b", fontSize: "12px" }}>No sessions yet</div>
            ) : (
              <>
                {sessions.some(s => s.pinned) && <div style={{ padding: "4px 10px 2px", fontSize: "9px", color: "#64748b", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "1px" }}>PINNED</div>}
                {sessions.map((session, index) => {
                  const isActive = session.id === activeSessionId;
                  const isTab = tabs.some(t => t.sessionId === session.id);
                  const prevSession = sessions[index - 1];
                  const showChatsLabel = !session.pinned && prevSession?.pinned;
                  return (
                    <div key={session.id}>
                      {showChatsLabel && sessions.some(s => s.pinned) && (
                        <div style={{ padding: "8px 10px 2px", fontSize: "9px", color: "#64748b", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "1px" }}>CHATS</div>
                      )}
                      <div
                        className={`cg-session ${isActive ? "active" : ""} ${session.pinned ? "pinned" : ""} ${isTab ? "as-tab" : ""}`}
                        draggable
                        onDragStart={e => handleSidebarDragStart(e, session.id)}
                        onDragEnd={() => { setIsDraggingSession(false); setSidebarDragOver(false); draggingSessionIdRef.current = null; }}
                        onClick={() => setActiveSessionId(session.id)}
                        style={{ padding: "9px 10px 9px 12px", borderRadius: "8px", border: "1px solid #2a2a2a", borderLeft: "2px solid #333", cursor: "grab", marginBottom: "3px", transition: "all 0.15s ease", position: "relative", background: "#242424" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "12.5px", fontWeight: 500, color: isActive ? "#00ff9d" : "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "110px", display: "flex", alignItems: "center", gap: "4px" }}>
                            {session.pinned && <span style={{ fontSize: "10px", flexShrink: 0 }}>📌</span>}
                            {isTab && <span style={{ fontSize: "9px", color: "#6366f1", flexShrink: 0 }} title="Open as tab">⊞</span>}
                            {session.name}
                          </span>
                          <div style={{ display: "flex", gap: "2px", alignItems: "center" }}>
                            <button className="cg-pin" onClick={(e) => handlePinSession(session.id, e)} title={session.pinned ? "Unpin" : "Pin"}
                              style={{ opacity: session.pinned ? 0.6 : 0, background: "none", border: "none", color: session.pinned ? "#00ff9d" : "#94a3b8", cursor: "pointer", fontSize: "10px", padding: "2px 4px", borderRadius: "4px", transition: "opacity 0.15s ease", flexShrink: 0 }}>
                              {session.pinned ? "📍" : "📌"}
                            </button>
                            <button className="cg-del" onClick={(e) => handleDeleteSession(session.id, e)}
                              style={{ opacity: 0, background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "12px", padding: "2px 4px", borderRadius: "4px", transition: "opacity 0.15s ease", flexShrink: 0 }}>✕</button>
                          </div>
                        </div>
                        <div style={{ marginTop: "3px", fontSize: "10px", color: "#4ade80", opacity: 0.7, fontFamily: "'JetBrains Mono', monospace" }}>
                          {new Date(session.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          <div style={{ padding: "10px 14px", borderTop: "1px solid #333", display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#00ff9d", animation: "cgPulse 2s infinite", boxShadow: "0 0 5px #00ff9d", flexShrink: 0 }} />
              <span style={{ fontSize: "9px", color: "#1e3a2e", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "1px" }}>GROQCLOUD · MISTRAL CONNECTED</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {[
                { key: "Ctrl+Q", desc: "New chat" },
                { key: "Ctrl+W", desc: "Close tab" },
                { key: "Ctrl+Tab", desc: "Next tab" },
                { key: "Ctrl+1-8", desc: "Jump to tab" },
              ].map(s => (
                <span key={s.key} title={s.desc} style={{ fontSize: "9px", color: "#64748b", fontFamily: "'JetBrains Mono', monospace", background: "#333", padding: "2px 5px", borderRadius: "4px", cursor: "default" }}>{s.key}</span>
              ))}
            </div>
          </div>
        </div>

        {/* MAIN AREA */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", minWidth: 0 }}>

          {/* TAB BAR DROP ZONE */}
          <div
            onDragOver={handleTabBarDropZoneDragOver}
            onDragLeave={handleTabBarDropZoneDragLeave}
            onDrop={handleTabBarDropZoneDrop}
            style={{ flexShrink: 0 }}
          >
            {tabs.length > 0 ? (
              <TabBar
                tabs={tabs}
                activeTabSessionId={activeSessionId}
                onTabClick={id => setActiveSessionId(id)}
                onTabClose={closeTab}
                onTabReorder={setTabs}
                isTyping={isTyping}
                streamingSessionId={streamingSessionId}
              />
            ) : null}

            {/* Always-visible drop zone during drag, even when tabs exist */}
            {isDraggingSession && (
              <div style={{
                height: "48px",
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: "8px",
                background: sidebarDragOver ? "#6366f122" : "#1a1a1a",
                border: `2px dashed ${sidebarDragOver ? "#6366f1" : "#6366f144"}`,
                borderRadius: "8px",
                margin: tabs.length > 0 ? "4px 12px" : "4px 12px",
                transition: "all 0.15s ease",
                fontSize: "11px",
                color: sidebarDragOver ? "#6366f1" : "#6366f166",
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: sidebarDragOver ? 600 : 400,
                letterSpacing: "0.5px",
              }}>
                <span style={{ fontSize: "16px" }}>⊞</span>
                {sidebarDragOver ? "Release to open as tab!" : "Drop here to open as tab"}
              </div>
            )}
          </div>

          {/* HEADER */}
          <div style={{ padding: "12px 18px", borderBottom: "1px solid #333", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, background: "#212121" }}>
            {activeSession ? (
              <div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#e2e8f0", display: "flex", alignItems: "center", gap: "6px" }}>
                  {activeSession.pinned && <span style={{ fontSize: "12px" }}>📌</span>}
                  {tabs.some(t => t.sessionId === activeSessionId) && <span style={{ fontSize: "10px", color: "#6366f1" }}>⊞</span>}
                  {activeSession.name}
                </div>
                <div style={{ fontSize: "10px", color: "#64748b", fontFamily: "'JetBrains Mono', monospace" }}>
                  {activeSession.totalMessages ?? activeMessages.length} messages · 👁 vision via Llama-4-Maverick
                  {tabs.length > 0 && <span style={{ marginLeft: "8px", color: "#6366f155" }}>· {tabs.length} tab{tabs.length > 1 ? "s" : ""} open</span>}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: "14px", color: "#64748b" }}>Select a session</div>
            )}

            {activeSession && (
              <div style={{ position: "relative" }}>
                <button onClick={() => setShowModelPicker(p => !p)}
                  style={{ display: "flex", alignItems: "center", gap: "7px", padding: "7px 12px", borderRadius: "8px", background: "#333", border: "1px solid #444", color: activeModel?.color ?? "#94a3b8", cursor: "pointer", fontSize: "11px", fontWeight: 500, fontFamily: "'JetBrains Mono', monospace", transition: "all 0.15s ease" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: activeModel?.color ?? "#94a3b8", flexShrink: 0, boxShadow: `0 0 6px ${activeModel?.color ?? "#94a3b8"}` }} />
                  {activeModel?.label ?? "Select Model"}
                  <span style={{ opacity: 0.5, fontSize: "9px" }}>▼</span>
                </button>
                {showModelPicker && (
                  <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "#2a2a2a", border: "1px solid #333", borderRadius: "10px", overflow: "hidden", boxShadow: "0 16px 48px #00000088", zIndex: 100, minWidth: "220px", animation: "cgFade 0.15s ease" }}>
                    <div style={{ padding: "8px 12px 6px", fontSize: "9px", color: "#64748b", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "1.2px", borderBottom: "1px solid #333" }}>SWITCH MODEL</div>
                    {MODELS.map(model => (
                      <button key={model.id} className="cg-model-opt" onClick={() => handleSwitchModel(model.id)}
                        style={{ width: "100%", padding: "9px 12px", background: model.id === activeSession.model ? "#333" : "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "9px", transition: "all 0.1s ease" }}>
                        <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: model.color, flexShrink: 0, boxShadow: model.id === activeSession.model ? `0 0 7px ${model.color}` : "none" }} />
                        <span style={{ fontSize: "12px", color: "#cbd5e1", fontFamily: "'Inter', sans-serif" }}>{model.label}</span>
                        {model.id === activeSession.model && <span style={{ marginLeft: "auto", fontSize: "9px", color: model.color, fontFamily: "'JetBrains Mono', monospace" }}>active</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* MESSAGES */}
          <div ref={messagesContainerRef} onScroll={handleMessagesScroll}
            style={{ flex: 1, overflowY: "auto", padding: "12px 0", display: "flex", flexDirection: "column" }}
            onClick={() => showModelPicker && setShowModelPicker(false)}>
            {!activeSession ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: "13px" }}>Create or select a session to start</div>
            ) : loadingMessages ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                <div style={{ width: "20px", height: "20px", border: "2px solid #333", borderTop: "2px solid #00ff9d", borderRadius: "50%", animation: "cgSpin 0.8s linear infinite" }} />
                <span style={{ fontSize: "11px", color: "#64748b", fontFamily: "'JetBrains Mono', monospace" }}>loading messages...</span>
              </div>
            ) : activeMessages.length === 0 && !isTyping ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px", padding: "40px 20px", animation: "cgFade 0.4s ease" }}>
                <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "#00ff9d0a", border: "1px solid #00ff9d18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>⚡</div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#94a3b8", marginBottom: "4px" }}>Start chatting</div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>{activeModel?.label} is ready · attach images via 📎 or Ctrl+V</div>
                </div>
              </div>
            ) : (
              <>
                {activeSession.hasMore && (
                  <div style={{ display: "flex", justifyContent: "center", padding: "8px", flexShrink: 0 }}>
                    {loadingOlder ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#64748b", fontFamily: "'JetBrains Mono', monospace" }}>
                        <div style={{ width: "12px", height: "12px", border: "1.5px solid #333", borderTop: "1.5px solid #00ff9d", borderRadius: "50%", animation: "cgSpin 0.8s linear infinite" }} />
                        loading older...
                      </div>
                    ) : (
                      <button onClick={() => activeSessionId && loadOlderMessages(activeSessionId)}
                        style={{ fontSize: "11px", color: "#64748b", background: "#2a2a2a", border: "1px solid #333", borderRadius: "6px", padding: "4px 12px", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", transition: "all 0.15s ease" }}>
                        ↑ load older messages
                      </button>
                    )}
                  </div>
                )}
                <div ref={messagesTopRef} />
                {activeMessages.map(msg => <div key={msg.id}><MessageBubble msg={msg} /></div>)}
                {isTyping && !streamingMsgId && activeModel && (
                  <TypingDots modelLabel={activeModel.label} modelColor={activeModel.color} />
                )}
              </>
            )}
            <div ref={messagesEndRef} />
            {showScrollButton && (
              <button
                onClick={() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); setShowScrollButton(false); inputRef.current?.focus(); }}
                style={{ position: "fixed", bottom: "100px", right: "30px", width: "40px", height: "40px", borderRadius: "50%", background: "#00ff9d", border: "none", color: "#080c14", fontSize: "16px", cursor: "pointer", boxShadow: "0 4px 12px #00000044", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, transition: "all 0.2s ease" }}>
                ↓
              </button>
            )}
          </div>

          {/* ERROR */}
          {error && (
            <div style={{ margin: "0 16px 8px", padding: "8px 12px", background: "#ff000010", border: "1px solid #ff000030", borderRadius: "8px", color: "#ef4444", fontSize: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              {error}
              <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "14px" }}>✕</button>
            </div>
          )}

          {/* INPUT */}
          <div style={{ padding: "10px 14px 14px", flexShrink: 0, background: "#212121", borderTop: "1px solid #333" }}>
            {selectedImagePreview && (
              <div style={{ marginBottom: "10px", position: "relative", display: "inline-block" }}>
                <img src={selectedImagePreview} alt="preview" style={{ height: "60px", borderRadius: "8px", border: "1px solid #00ff9d44", display: "block" }} />
                <button onClick={() => { setSelectedImage(null); setSelectedImagePreview(null); }}
                  style={{ position: "absolute", top: "-6px", right: "-6px", width: "18px", height: "18px", borderRadius: "50%", background: "#ef4444", border: "none", color: "white", fontSize: "10px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                <div style={{ marginTop: "4px", fontSize: "9px", color: "#00ff9d", fontFamily: "'JetBrains Mono', monospace" }}>👁 will use Llama-4-Maverick</div>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", background: "#2a2a2a", border: `1px solid ${isTyping ? "#ef444433" : "#333"}`, borderRadius: "12px", padding: "8px 8px 8px 14px", transition: "border-color 0.3s ease" }}>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} style={{ display: "none" }} />
              <button className="cg-attach" onClick={() => fileInputRef.current?.click()} disabled={!activeSession}
                style={{ width: "30px", height: "30px", borderRadius: "7px", flexShrink: 0, background: selectedImage ? "#00ff9d18" : "transparent", border: `1px solid ${selectedImage ? "#00ff9d44" : "#333"}`, color: selectedImage ? "#00ff9d" : "#94a3b8", cursor: activeSession ? "pointer" : "default", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s ease", marginBottom: "2px" }}>
                📎
              </button>
              <textarea ref={inputRef} disabled={!activeSession || isTyping}
                onChange={e => setInputHasText(e.target.value.trim().length > 0)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                onInput={(e: any) => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
                placeholder={activeSession ? (isTyping ? `${activeModel?.label} is generating...` : "Ask anything... or paste image with Ctrl+V") : "Select a session first"}
                rows={1}
                style={{ flex: 1, background: "transparent", border: "none", color: "#e2e8f0", fontSize: "13.5px", resize: "none", fontFamily: "'Inter', sans-serif", lineHeight: "1.6", maxHeight: "120px", caretColor: "#00ff9d", outline: "none", overflowY: "auto" }}
              />
              {isTyping ? (
                <button className="cg-stop" onClick={handleStop}
                  style={{ width: "34px", height: "34px", borderRadius: "8px", flexShrink: 0, background: "#ef444418", border: "1px solid #ef444444", color: "#ef4444", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s ease", animation: "cgStopPulse 2s ease infinite" }}>
                  ■
                </button>
              ) : (
                <button className="cg-send" onClick={handleSend} disabled={(!inputHasText && !selectedImage) || !activeSession}
                  style={{ width: "34px", height: "34px", borderRadius: "8px", flexShrink: 0, background: (inputHasText || selectedImage) && activeSession ? "#00ff9d" : "#333", border: "none", cursor: (inputHasText || selectedImage) && activeSession ? "pointer" : "default", color: (inputHasText || selectedImage) ? "#080c14" : "#94a3b8", fontSize: "15px", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s ease", boxShadow: (inputHasText || selectedImage) && activeSession ? "0 0 14px #00ff9d33" : "none" }}>↑</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}