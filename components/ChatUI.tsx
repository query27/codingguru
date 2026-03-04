"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

const MODELS = [
  { id: "openai/gpt-oss-120b", label: "GPT OSS 120B", color: "#00ff9d" },
  { id: "openai/gpt-oss-20b", label: "GPT OSS 20B", color: "#00d4ff" },
  { id: "groq/compound", label: "Compound", color: "#ff6b35" },
  { id: "groq/compound-mini", label: "Compound Mini", color: "#ff6b35" },
  { id: "moonshotai/kimi-k2-instruct", label: "Kimi K2", color: "#a78bfa" },
  { id: "qwen/qwen3-32b", label: "Qwen3 32B", color: "#fbbf24" },
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", color: "#34d399" },
];

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  model: string;
  createdAt: string;
  imagePreview?: string;
};

type Session = {
  id: string;
  name: string;
  model: string;
  pinned: boolean;
  createdAt: string;
  messages: Message[];
};

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      style={{
        background: copied ? "#00ff9d18" : "transparent",
        border: `1px solid ${copied ? "#00ff9d44" : "#ffffff14"}`,
        borderRadius: "5px", padding: "3px 10px",
        color: copied ? "#00ff9d" : "#475569",
        fontSize: "11px", cursor: "pointer",
        fontFamily: "'JetBrains Mono', monospace",
        transition: "all 0.2s ease",
      }}
    >
      {copied ? "✓ copied" : "copy"}
    </button>
  );
}

function Message({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  const model = MODELS.find(m => m.id === msg.model);

  return (
    <div style={{
      display: "flex", flexDirection: isUser ? "row-reverse" : "row",
      gap: "8px", padding: "4px 16px", alignItems: "flex-start",
    }}>
      <div style={{
        width: "28px", height: "28px", borderRadius: "8px", flexShrink: 0,
        background: isUser ? "#6366f122" : "#ffffff08",
        border: isUser ? "1px solid #6366f133" : "1px solid #ffffff0e",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "12px", marginTop: "2px"
      }}>
        {isUser ? "Y" : "⚡"}
      </div>
      <div style={{
        maxWidth: "75%", display: "flex", flexDirection: "column",
        gap: "4px", alignItems: isUser ? "flex-end" : "flex-start"
      }}>
        <div style={{
          padding: "10px 14px",
          borderRadius: isUser ? "14px 4px 14px 14px" : "4px 14px 14px 14px",
          background: isUser ? "#6366f118" : "#ffffff07",
          border: isUser ? "1px solid #6366f122" : "1px solid #ffffff0e",
          color: "#cbd5e1", fontSize: "13.5px", lineHeight: "1.65",
          fontFamily: "'Inter', sans-serif", wordBreak: "break-word",
        }}>
          {isUser && msg.imagePreview && (
            <img src={msg.imagePreview} alt="attached" style={{
              maxWidth: "200px", maxHeight: "200px", borderRadius: "8px",
              marginBottom: "6px", display: "block", border: "1px solid #ffffff14"
            }} />
          )}
          {isUser ? (
            <span style={{ whiteSpace: "pre-wrap" }}>
              {msg.content.replace("📎 [Image attached]\n", "")}
            </span>
          ) : (
            <ReactMarkdown
              components={{
                code({ node, inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || "");
                  const codeString = String(children).replace(/\n$/, "");
                  return !inline && match ? (
                    <div style={{ margin: "8px 0" }}>
                      <div style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "6px 12px", background: "#0d1117",
                        borderRadius: "8px 8px 0 0", border: "1px solid #ffffff0e", borderBottom: "none",
                      }}>
                        <span style={{ fontSize: "11px", color: "#475569", fontFamily: "'JetBrains Mono', monospace" }}>{match[1]}</span>
                        <CopyButton code={codeString} />
                      </div>
                      <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div"
                        customStyle={{ borderRadius: "0 0 8px 8px", fontSize: "12.5px", margin: "0", border: "1px solid #ffffff0e", borderTop: "none", background: "#0a0f1a" }}
                        {...props}
                      >
                        {codeString}
                      </SyntaxHighlighter>
                    </div>
                  ) : (
                    <code style={{ background: "#ffffff10", padding: "2px 6px", borderRadius: "4px", fontSize: "12px", fontFamily: "'JetBrains Mono', monospace", color: "#00ff9d" }} {...props}>{children}</code>
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
                blockquote: ({ children }: any) => (
                  <blockquote style={{ borderLeft: "3px solid #00ff9d44", paddingLeft: "12px", margin: "8px 0", color: "#64748b", fontStyle: "italic" }}>{children}</blockquote>
                ),
                table: ({ children }: any) => (
                  <div style={{ overflowX: "auto", margin: "8px 0" }}>
                    <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "12.5px" }}>{children}</table>
                  </div>
                ),
                th: ({ children }: any) => <th style={{ padding: "6px 12px", textAlign: "left", borderBottom: "1px solid #ffffff14", color: "#94a3b8", fontWeight: 600, background: "#ffffff05" }}>{children}</th>,
                td: ({ children }: any) => <td style={{ padding: "6px 12px", borderBottom: "1px solid #ffffff08", color: "#cbd5e1" }}>{children}</td>,
              }}
            >
              {msg.content}
            </ReactMarkdown>
          )}
        </div>
        {!isUser && model && (
          <span style={{ fontSize: "10px", color: model.color, fontFamily: "'JetBrains Mono', monospace", opacity: 0.7 }}>
            {model.label}
          </span>
        )}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "14px 16px" }}>
      <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: "#ffffff08", border: "1px solid #ffffff0e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", flexShrink: 0 }}>⚡</div>
      <div style={{ display: "flex", gap: "3px" }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#00ff9d", animation: `cgBounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

export default function CodingGuru() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [inputHasText, setInputHasText] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageMime, setSelectedImageMime] = useState<string>("image/png");
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeSession = sessions.find(s => s.id === activeSessionId) ?? null;
  const activeMessages = activeSession?.messages ?? [];
  const activeModel = MODELS.find(m => m.id === activeSession?.model);

  useEffect(() => { fetchSessions(); }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages, isTyping]);

  useEffect(() => {
    if (activeSessionId) setTimeout(() => inputRef.current?.focus(), 100);
  }, [activeSessionId]);

  // Ctrl+V paste image
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
          reader.onload = () => {
            const base64 = (reader.result as string).split(",")[1];
            setSelectedImage(base64);
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [activeSession]);

  async function fetchSessions() {
    try {
      setLoading(true);
      const res = await fetch("/api/sessions");
      const data = await res.json();
      setSessions(data);
      if (data.length > 0) setActiveSessionId(data[0].id);
    } catch {
      setError("Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSession() {
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Chat", model: "openai/gpt-oss-120b" })
      });
      const session = await res.json();
      setSessions(prev => [{ ...session, messages: [], pinned: false }, ...prev]);
      setActiveSessionId(session.id);
    } catch {
      setError("Failed to create session");
    }
  }

  async function handleDeleteSession(sessionId: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await fetch("/api/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
      });
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        const remaining = sessions.filter(s => s.id !== sessionId);
        setActiveSessionId(remaining[0]?.id ?? null);
      }
    } catch {
      setError("Failed to delete session");
    }
  }

  async function handlePinSession(sessionId: string, e: React.MouseEvent) {
    e.stopPropagation();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    const newPinned = !session.pinned;
    try {
      await fetch("/api/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, pinned: newPinned })
      });
      setSessions(prev => {
        const updated = prev.map(s => s.id === sessionId ? { ...s, pinned: newPinned } : s);
        return [
          ...updated.filter(s => s.pinned),
          ...updated.filter(s => !s.pinned)
        ];
      });
    } catch {
      setError("Failed to pin session");
    }
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedImageMime(file.type);
    const preview = URL.createObjectURL(file);
    setSelectedImagePreview(preview);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      setSelectedImage(base64);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function autoNameSession(sessionId: string, firstMessage: string) {
    try {
      const res = await fetch("/api/sessions/autonaming", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: firstMessage })
      });
      const { name } = await res.json();
      await fetch("/api/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, name })
      });
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, name } : s));
    } catch {
      // Silently fail
    }
  }

  async function handleSend() {
    const content = inputRef.current?.value.trim() ?? "";
    if (!content && !selectedImage || !activeSessionId || isTyping) return;

    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.style.height = "auto";
    }
    setInputHasText(false);
    setIsTyping(true);
    setError(null);

    const imageToSend = selectedImage;
    const mimeToSend = selectedImageMime;
    const previewToSend = selectedImagePreview;
    setSelectedImage(null);
    setSelectedImagePreview(null);

    // Auto name if first message
    if (activeMessages.length === 0) {
      autoNameSession(activeSessionId, content || "Image attached");
    }

    const tempId = `temp-${Date.now()}`;
    const userMsg: Message = {
      id: tempId,
      role: "user",
      content: imageToSend ? `📎 [Image attached]\n${content}` : content,
      model: activeSession!.model,
      createdAt: new Date().toISOString(),
      imagePreview: previewToSend ?? undefined,
    };

    setSessions(prev => prev.map(s =>
      s.id === activeSessionId ? { ...s, messages: [...s.messages, userMsg] } : s
    ));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSessionId,
          content: content || "What do you see in this image?",
          imageBase64: imageToSend,
          imageMimeType: mimeToSend,
        })
      });

      if (!res.ok) throw new Error((await res.json()).error ?? "API error");
      const data = await res.json();

      const assistantMsg: Message = {
        id: data.messageId,
        role: "assistant",
        content: data.message,
        model: data.model,
        createdAt: new Date().toISOString(),
      };

      setSessions(prev => prev.map(s =>
        s.id === activeSessionId ? { ...s, messages: [...s.messages, assistantMsg] } : s
      ));
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");
      setSessions(prev => prev.map(s =>
        s.id === activeSessionId
          ? { ...s, messages: s.messages.filter(m => m.id !== tempId) } : s
      ));
    } finally {
      setIsTyping(false);
      inputRef.current?.focus();
    }
  }

  async function handleSwitchModel(modelId: string) {
    if (!activeSessionId) return;
    setShowModelPicker(false);
    try {
      await fetch("/api/chat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: activeSessionId, model: modelId })
      });
      setSessions(prev => prev.map(s =>
        s.id === activeSessionId ? { ...s, model: modelId } : s
      ));
    } catch {
      setError("Failed to switch model");
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; overflow: hidden; background: #080c14; }
        @keyframes cgBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.3; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes cgFade {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes cgPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .cg-session:hover .cg-del { opacity: 1 !important; }
        .cg-session:hover .cg-pin { opacity: 1 !important; }
        .cg-session:hover { background: #ffffff07 !important; }
        .cg-session.active { background: #00ff9d08 !important; border-color: #00ff9d22 !important; }
        .cg-session.pinned { border-color: #00ff9d18 !important; }
        .cg-model-opt:hover { background: #ffffff08 !important; }
        .cg-send:hover:not(:disabled) { background: #00e88d !important; }
        .cg-new:hover { border-color: #00ff9d66 !important; color: #00ff9d !important; }
        .cg-attach:hover { border-color: #00ff9d66 !important; color: #00ff9d !important; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: #ffffff12; border-radius: 2px; }
      `}</style>

      <div style={{ display: "flex", height: "100vh", width: "100%", background: "#080c14", fontFamily: "'Inter', sans-serif", overflow: "hidden" }}>

        {/* SIDEBAR */}
        <div style={{ width: "240px", minWidth: "240px", height: "100vh", background: "#0b1120", borderRight: "1px solid #ffffff0a", display: "flex", flexDirection: "column" }}>

          {/* Logo */}
          <div style={{ padding: "18px 16px 14px", borderBottom: "1px solid #ffffff0a", display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: "linear-gradient(135deg, #00ff9d, #00c4f0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", boxShadow: "0 0 16px #00ff9d33", flexShrink: 0 }}>⚡</div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "#f1f5f9", letterSpacing: "-0.2px" }}>CodingGuru</div>
              <div style={{ fontSize: "9px", color: "#00ff9d", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "1px", opacity: 0.8 }}>AI ASSISTANT</div>
            </div>
          </div>

          {/* New Chat button */}
          <div style={{ padding: "12px 10px 6px" }}>
            <button className="cg-new" onClick={handleCreateSession} style={{
              width: "100%", padding: "8px", borderRadius: "8px", border: "1px dashed #ffffff18",
              background: "transparent", color: "#475569", fontSize: "12px", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
              transition: "all 0.15s ease", fontFamily: "'Inter', sans-serif"
            }}>
              <span>+</span> New Chat
            </button>
          </div>

          {/* Sessions list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "4px 8px" }}>
            {loading ? (
              <div style={{ padding: "20px", textAlign: "center", color: "#334155", fontSize: "12px" }}>Loading...</div>
            ) : sessions.length === 0 ? (
              <div style={{ padding: "20px 12px", textAlign: "center", color: "#334155", fontSize: "12px" }}>No sessions yet</div>
            ) : (
              <>
                {/* Pinned label */}
                {sessions.some(s => s.pinned) && (
                  <div style={{ padding: "4px 10px 2px", fontSize: "9px", color: "#334155", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "1px" }}>PINNED</div>
                )}
                {sessions.map((session, index) => {
                  const model = MODELS.find(m => m.id === session.model);
                  const isActive = session.id === activeSessionId;
                  const prevSession = sessions[index - 1];
                  const showOthersLabel = !session.pinned && prevSession?.pinned;

                  return (
                    <div key={session.id}>
                      {/* Others label */}
                      {showOthersLabel && sessions.some(s => s.pinned) && (
                        <div style={{ padding: "8px 10px 2px", fontSize: "9px", color: "#334155", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "1px" }}>CHATS</div>
                      )}
                      <div
                        className={`cg-session ${isActive ? "active" : ""} ${session.pinned ? "pinned" : ""}`}
                        onClick={() => setActiveSessionId(session.id)}
                        style={{ padding: "9px 10px", borderRadius: "8px", border: "1px solid transparent", cursor: "pointer", marginBottom: "2px", transition: "all 0.15s ease", position: "relative", animation: "cgFade 0.3s ease" }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "12.5px", fontWeight: 500, color: isActive ? "#e2e8f0" : "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "120px", display: "flex", alignItems: "center", gap: "4px" }}>
                            {session.pinned && <span style={{ fontSize: "10px", flexShrink: 0 }}>📌</span>}
                            {session.name}
                          </span>
                          <div style={{ display: "flex", gap: "2px", alignItems: "center" }}>
                            <button
                              className="cg-pin"
                              onClick={(e) => handlePinSession(session.id, e)}
                              title={session.pinned ? "Unpin" : "Pin"}
                              style={{ opacity: session.pinned ? 0.6 : 0, background: "none", border: "none", color: session.pinned ? "#00ff9d" : "#475569", cursor: "pointer", fontSize: "10px", padding: "2px 4px", borderRadius: "4px", transition: "opacity 0.15s ease", flexShrink: 0 }}
                            >
                              {session.pinned ? "⏬" : "📌"}
                            </button>
                            <button
                              className="cg-del"
                              onClick={(e) => handleDeleteSession(session.id, e)}
                              style={{ opacity: 0, background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: "12px", padding: "2px 4px", borderRadius: "4px", transition: "opacity 0.15s ease", flexShrink: 0 }}
                            >✕</button>
                          </div>
                        </div>
                        {model && <div style={{ marginTop: "3px", fontSize: "10px", color: model.color, opacity: 0.7, fontFamily: "'JetBrains Mono', monospace" }}>{model.label}</div>}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: "10px 14px", borderTop: "1px solid #ffffff0a", display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#00ff9d", animation: "cgPulse 2s infinite", boxShadow: "0 0 5px #00ff9d", flexShrink: 0 }} />
            <span style={{ fontSize: "9px", color: "#1e3a2e", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "1px" }}>GROQCLOUD CONNECTED</span>
          </div>
        </div>

        {/* MAIN AREA */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", minWidth: 0 }}>

          {/* Header */}
          <div style={{ padding: "12px 18px", borderBottom: "1px solid #ffffff0a", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, background: "#080c14" }}>
            {activeSession ? (
              <div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#e2e8f0", display: "flex", alignItems: "center", gap: "6px" }}>
                  {activeSession.pinned && <span style={{ fontSize: "12px" }}>📌</span>}
                  {activeSession.name}
                </div>
                <div style={{ fontSize: "10px", color: "#334155", fontFamily: "'JetBrains Mono', monospace" }}>
                  {activeMessages.length} messages · 👁 vision via Llama-4-Scout
                </div>
              </div>
            ) : (
              <div style={{ fontSize: "14px", color: "#334155" }}>Select a session</div>
            )}

            {/* Model switcher */}
            {activeSession && (
              <div style={{ position: "relative" }}>
                <button onClick={() => setShowModelPicker(p => !p)} style={{ display: "flex", alignItems: "center", gap: "7px", padding: "7px 12px", borderRadius: "8px", background: "#ffffff07", border: "1px solid #ffffff0e", color: activeModel?.color ?? "#64748b", cursor: "pointer", fontSize: "11px", fontWeight: 500, fontFamily: "'JetBrains Mono', monospace", transition: "all 0.15s ease" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: activeModel?.color ?? "#64748b", flexShrink: 0, boxShadow: `0 0 6px ${activeModel?.color ?? "#64748b"}` }} />
                  {activeModel?.label ?? "Select Model"}
                  <span style={{ opacity: 0.5, fontSize: "9px" }}>▼</span>
                </button>

                {showModelPicker && (
                  <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "#0f1829", border: "1px solid #ffffff0e", borderRadius: "10px", overflow: "hidden", boxShadow: "0 16px 48px #00000088", zIndex: 100, minWidth: "220px", animation: "cgFade 0.15s ease" }}>
                    <div style={{ padding: "8px 12px 6px", fontSize: "9px", color: "#334155", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "1.2px", borderBottom: "1px solid #ffffff08" }}>SWITCH MODEL</div>
                    {MODELS.map(model => (
                      <button key={model.id} className="cg-model-opt" onClick={() => handleSwitchModel(model.id)}
                        style={{ width: "100%", padding: "9px 12px", background: model.id === activeSession.model ? "#ffffff08" : "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "9px", transition: "all 0.1s ease" }}>
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

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 0", display: "flex", flexDirection: "column" }}
            onClick={() => showModelPicker && setShowModelPicker(false)}>
            {!activeSession ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#1e293b", fontSize: "13px" }}>
                Create or select a session to start
              </div>
            ) : activeMessages.length === 0 && !isTyping ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px", padding: "40px 20px", animation: "cgFade 0.4s ease" }}>
                <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "#00ff9d0a", border: "1px solid #00ff9d18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>⚡</div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>Start chatting</div>
                  <div style={{ fontSize: "12px", color: "#1e293b" }}>{activeModel?.label} is ready · attach images via 📎 or Ctrl+V</div>
                </div>
              </div>
            ) : (
              <>
                {activeMessages.map(msg => (
                  <div key={msg.id} style={{ animation: "cgFade 0.2s ease" }}>
                    <Message msg={msg} />
                  </div>
                ))}
                {isTyping && <TypingDots />}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Error */}
          {error && (
            <div style={{ margin: "0 16px 8px", padding: "8px 12px", background: "#ff000010", border: "1px solid #ff000030", borderRadius: "8px", color: "#ef4444", fontSize: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              {error}
              <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "14px" }}>✕</button>
            </div>
          )}

          {/* Input */}
          <div style={{ padding: "10px 14px 14px", flexShrink: 0, background: "#080c14", borderTop: "1px solid #ffffff0a" }}>
            {selectedImagePreview && (
              <div style={{ marginBottom: "10px", position: "relative", display: "inline-block" }}>
                <img src={selectedImagePreview} alt="preview" style={{ height: "60px", borderRadius: "8px", border: "1px solid #00ff9d44", display: "block" }} />
                <button onClick={() => { setSelectedImage(null); setSelectedImagePreview(null); }} style={{ position: "absolute", top: "-6px", right: "-6px", width: "18px", height: "18px", borderRadius: "50%", background: "#ef4444", border: "none", color: "white", fontSize: "10px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                <div style={{ marginTop: "4px", fontSize: "9px", color: "#00ff9d", fontFamily: "'JetBrains Mono', monospace" }}>👁 will use Llama-4-Scout</div>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", background: "#0f1829", border: "1px solid #ffffff0e", borderRadius: "12px", padding: "8px 8px 8px 14px" }}>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} style={{ display: "none" }} />

              <button className="cg-attach" onClick={() => fileInputRef.current?.click()} disabled={!activeSession}
                style={{ width: "30px", height: "30px", borderRadius: "7px", flexShrink: 0, background: selectedImage ? "#00ff9d18" : "transparent", border: `1px solid ${selectedImage ? "#00ff9d44" : "#ffffff12"}`, color: selectedImage ? "#00ff9d" : "#334155", cursor: activeSession ? "pointer" : "default", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s ease", marginBottom: "2px" }}>
                📎
              </button>

              <textarea
                ref={inputRef}
                disabled={!activeSession}
                onChange={e => setInputHasText(e.target.value.trim().length > 0)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                onInput={(e: any) => {
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                }}
                placeholder={activeSession ? "Ask anything... or paste image with Ctrl+V" : "Select a session first"}
                rows={1}
                style={{ flex: 1, background: "transparent", border: "none", color: "#e2e8f0", fontSize: "13.5px", resize: "none", fontFamily: "'Inter', sans-serif", lineHeight: "1.6", maxHeight: "120px", caretColor: "#00ff9d", outline: "none", overflowY: "auto" }}
              />

              <button className="cg-send" onClick={handleSend}
                disabled={(!inputHasText && !selectedImage) || isTyping || !activeSession}
                style={{ width: "34px", height: "34px", borderRadius: "8px", flexShrink: 0, background: (inputHasText || selectedImage) && !isTyping && activeSession ? "#00ff9d" : "#ffffff08", border: "none", cursor: (inputHasText || selectedImage) && !isTyping && activeSession ? "pointer" : "default", color: (inputHasText || selectedImage) && !isTyping ? "#080c14" : "#334155", fontSize: "15px", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s ease", boxShadow: (inputHasText || selectedImage) && !isTyping && activeSession ? "0 0 14px #00ff9d33" : "none" }}>↑</button>
            </div>

            <div style={{ textAlign: "center", marginTop: "6px", fontSize: "10px", color: "#0f1c2e", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.3px" }}>
              ENTER to send · SHIFT+ENTER new line · Ctrl+V paste image · 📎 attach
            </div>
          </div>
        </div>
      </div>
    </>
  );
}