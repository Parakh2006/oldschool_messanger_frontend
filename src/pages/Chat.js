import "./Chat.css";

import React, { useEffect, useRef, useState } from "react";
import axiosClient from "../api/axiosClient";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";

const API_URL = "https://oldschool-messanger-backend.onrender.com";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  if (!token) return {};
  const clean = token.startsWith("Bearer ") ? token.slice(7) : token;
  return { Authorization: `Bearer ${clean}` };
};

function Chat() {
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [currentOtherUsername, setCurrentOtherUsername] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState(null);

  const socketRef = useRef(null);

  /* 🔑 iOS KEYBOARD FIX */
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const keyboardHeight = Math.max(
        0,
        window.innerHeight - vv.height - vv.offsetTop
      );
      document.documentElement.style.setProperty(
        "--kb",
        `${keyboardHeight}px`
      );
      document.documentElement.style.setProperty("--vvh", `${vv.height}px`);
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  /* SOCKET */
  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      navigate("/login");
      return;
    }

    const socket = io(API_URL, {
      auth: { token: localStorage.getItem("token") },
    });

    socketRef.current = socket;

    socket.emit("registerUser", userId);

    socket.on("newMessage", (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
    });

    socket.on("messageStatusUpdate", ({ messageId, readAt, deliveredAt }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m._id === messageId ? { ...m, readAt, deliveredAt } : m
        )
      );
    });

    return () => socket.disconnect();
  }, [navigate]);

  const handleSend = async () => {
    if (!input.trim() || !selectedConversationId) return;

    const res = await axiosClient.post(
      "/messages",
      {
        conversationId: selectedConversationId,
        ciphertext: input,
        iv: "demo",
      },
      { headers: getAuthHeaders() }
    );

    setInput("");
    setMessages((prev) => [...prev, res.data.data]);
  };

  return (
    <div className="chat-page">
      <div className="chat-main">
        <div className="chat-panel">
          <div className="chat-header">
            <div className="chat-header-name">
              {currentOtherUsername || "Chat"}
            </div>
          </div>

          <div className="messages">
            {messages.map((m) => {
              const isOwn = m.senderId === localStorage.getItem("userId");
              const read = !!m.readAt;

              return (
                <div
                  key={m._id}
                  className={
                    isOwn
                      ? `message message-own ${
                          read ? "message-read" : "message-unread"
                        }`
                      : "message"
                  }
                >
                  <div className="message-text">{m.ciphertext}</div>
                  <div className="message-meta">
                    <span>{isOwn ? "You" : currentOtherUsername}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="input-row">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message…"
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
            />
            <button onClick={handleSend}>Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Chat;
