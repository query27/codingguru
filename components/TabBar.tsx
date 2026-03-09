"use client";

import { useState, useRef } from "react";

export type Tab = {
  sessionId: string;
  label: string;
  model: string;
  modelColor: string;
};

type Props = {
  tabs: Tab[];
  activeTabSessionId: string | null;
  onTabClick: (sessionId: string) => void;
  onTabClose: (sessionId: string) => void;
  onTabReorder: (tabs: Tab[]) => void;
  isTyping: boolean;
  streamingSessionId: string | null;
};

export default function TabBar({
  tabs,
  activeTabSessionId,
  onTabClick,
  onTabClose,
  onTabReorder,
  isTyping,
  streamingSessionId,
}: Props) {
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  function handleDragStart(e: React.DragEvent, index: number) {
    dragIndexRef.current = index;
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  }

  function handleDrop(e: React.DragEvent, index: number) {
    e.preventDefault();
    const from = dragIndexRef.current;
    if (from === null || from === index) { setDragOverIndex(null); return; }
    const reordered = [...tabs];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(index, 0, moved);
    onTabReorder(reordered);
    dragIndexRef.current = null;
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    dragIndexRef.current = null;
    setDragOverIndex(null);
  }

  if (tabs.length === 0) return null;

  return (
    <div style={{
      display: "flex",
      alignItems: "flex-end",
      gap: "2px",
      padding: "6px 12px 0",
      background: "#1a1a1a",
      borderBottom: "1px solid #333",
      overflowX: "auto",
      flexShrink: 0,
    }}>
      <style>{`
        .cg-tab { transition: all 0.15s ease; }
        .cg-tab:hover .cg-tab-close { opacity: 1 !important; }
        .cg-tab-close:hover { background: #ef444433 !important; color: #ef4444 !important; }
        .cg-tab-bar::-webkit-scrollbar { height: 2px; }
        .cg-tab-bar::-webkit-scrollbar-thumb { background: #444; border-radius: 2px; }
      `}</style>

      {tabs.map((tab, index) => {
        const isActive = tab.sessionId === activeTabSessionId;
        const isStreaming = tab.sessionId === streamingSessionId;
        const isDragOver = dragOverIndex === index;

        return (
          <div
            key={tab.sessionId}
            className="cg-tab"
            draggable
            onDragStart={e => handleDragStart(e, index)}
            onDragOver={e => handleDragOver(e, index)}
            onDrop={e => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            onClick={() => onTabClick(tab.sessionId)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "7px",
              padding: "6px 10px 7px",
              borderRadius: "8px 8px 0 0",
              background: isActive ? "#212121" : isDragOver ? "#2a2a2a" : "#1e1e1e",
              border: "1px solid",
              borderColor: isActive ? "#333" : isDragOver ? "#444" : "#2a2a2a",
              borderBottom: isActive ? "1px solid #212121" : "1px solid #2a2a2a",
              cursor: "pointer",
              minWidth: "120px",
              maxWidth: "180px",
              position: "relative",
              userSelect: "none",
              opacity: isDragOver && dragIndexRef.current !== index ? 0.6 : 1,
              transform: isDragOver ? "scale(1.02)" : "scale(1)",
            }}
          >
            {/* Model color dot */}
            <div style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: tab.modelColor,
              flexShrink: 0,
              boxShadow: isActive ? `0 0 5px ${tab.modelColor}` : "none",
              animation: isStreaming ? "cgTabPulse 1s ease infinite" : "none",
            }} />

            {/* Tab label */}
            <span style={{
              fontSize: "11px",
              color: isActive ? "#e2e8f0" : "#64748b",
              fontFamily: "'Inter', sans-serif",
              fontWeight: isActive ? 500 : 400,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}>
              {isStreaming ? (
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ animation: "cgTabPulse 1s ease infinite", opacity: 0.8 }}>⚡</span>
                  {tab.label}
                </span>
              ) : tab.label}
            </span>

            {/* Close button */}
            <button
              className="cg-tab-close"
              onClick={e => { e.stopPropagation(); onTabClose(tab.sessionId); }}
              style={{
                opacity: 0,
                width: "16px",
                height: "16px",
                borderRadius: "4px",
                background: "transparent",
                border: "none",
                color: "#64748b",
                fontSize: "10px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "all 0.15s ease",
                padding: 0,
              }}
            >
              ✕
            </button>
          </div>
        );
      })}

      <style>{`
        @keyframes cgTabPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}