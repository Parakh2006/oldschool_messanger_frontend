import React, { useEffect, useState } from "react";
import axiosClient from "../api/axiosClient";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";

const API_URL = "https://oldschool-messanger-backend.onrender.com";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  if (!token) return {};

  // ✅ Fix: prevent "Bearer Bearer ..."
  const cleanToken = token.startsWith("Bearer ") ? token.slice(7) : token;

  return { Authorization: `Bearer ${cleanToken}` };
};

// ---------- 🔐 ENCRYPTION HELPERS (TEMP: one shared secret) ----------

const SECRET_PASSPHRASE = "galiyoon-local-secret-v1";
const SALT = "galiyoon-salt-v1";

let aesKeyPromise = null;

const getAesKey = () => {
  if (!aesKeyPromise) {
    aesKeyPromise = (async () => {
      const enc = new TextEncoder();
      const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        enc.encode(SECRET_PASSPHRASE),
        "PBKDF2",
        false,
        ["deriveKey"]
      );

      const key = await window.crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt: enc.encode(SALT),
          iterations: 100000,
          hash: "SHA-256",
        },
        keyMaterial,
        {
          name: "AES-GCM",
          length: 256,
        },
        false,
        ["encrypt", "decrypt"]
      );

      return key;
    })();
  }
  return aesKeyPromise;
};

const bufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

const base64ToBuffer = (base64) => {
  try {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (e) {
    return null;
  }
};

const encryptText = async (plaintext) => {
  const key = await getAesKey();
  const enc = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    enc.encode(plaintext)
  );

  return {
    ciphertext: bufferToBase64(ciphertextBuffer),
    iv: bufferToBase64(iv.buffer),
  };
};

const decryptText = async (ciphertextBase64, ivBase64) => {
  try {
    const key = await getAesKey();
    const dec = new TextDecoder();

    const ivBuffer = base64ToBuffer(ivBase64);
    const iv = new Uint8Array(ivBuffer);

    const ciphertextBuffer = base64ToBuffer(ciphertextBase64);

    const plainBuffer = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
      },
      key,
      ciphertextBuffer
    );

    return dec.decode(plainBuffer);
  } catch (err) {
    console.error("Decrypt error:", err);
    return "[unable to decrypt]";
  }
};

// ---------- OTHER HELPERS ----------

const formatLastSeen = (online, lastSeen) => {
  if (online) return "online";
  if (!lastSeen) return "offline";

  const d = new Date(lastSeen);
  if (Number.isNaN(d.getTime())) return "offline";

  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const timeStr = d.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  if (sameDay) return `last seen today at ${timeStr}`;
  if (isYesterday) return `last seen yesterday at ${timeStr}`;

  const dateStr = d.toLocaleDateString([], {
    day: "numeric",
    month: "short",
  });

  return `last seen on ${dateStr} at ${timeStr}`;
};

const getStatusIcon = (status) => {
  if (status === "sent") return "✓";
  if (status === "delivered") return "✓✓";
  if (status === "read") return "✓✓";
  return "";
};

// ---------- MOBILE HOOK ----------

const useIsMobile = (breakpoint = 768) => {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= breakpoint : false
  );

  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth <= breakpoint);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);

  return isMobile;
};

function Chat() {
  const navigate = useNavigate();

  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [socket, setSocket] = useState(null);
  const [presence, setPresence] = useState({});
  const [loadingConversations, setLoadingConversations] = useState(false);

  const [phoneInput, setPhoneInput] = useState("");
  const [phoneError, setPhoneError] = useState("");

  const [currentOtherId, setCurrentOtherId] = useState(null);
  const [currentOtherUsername, setCurrentOtherUsername] = useState("");

  const [isOtherTyping, setIsOtherTyping] = useState(false);

  const userId = localStorage.getItem("userId");
  const username = localStorage.getItem("username");

  const isMobile = useIsMobile(768);
  const showListOnly = isMobile && !selectedConversationId;
  const showMessagesOnly = isMobile && !!selectedConversationId;

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token || !userId || !username) {
      navigate("/");
    }
  }, [navigate, userId, username]);

  useEffect(() => {
    const s = io(API_URL);
    setSocket(s);

    if (userId) {
      s.on("connect", () => {
        s.emit("registerUser", userId);
      });
    }

    s.on("presenceUpdate", (data) => {
      setPresence((prev) => ({
        ...prev,
        [data.userId]: {
          online: data.online,
          lastSeen: data.lastSeen,
        },
      }));
    });

    s.on("newMessage", async (message) => {
      if (message.conversationId !== selectedConversationId) return;

      const already = messages.some((m) => m._id === message._id);
      if (already) return;

      const plaintext = await decryptText(message.ciphertext, message.iv);

      setMessages((prev) => [
        ...prev,
        {
          ...message,
          plaintext,
        },
      ]);
    });

    s.on("messageStatusUpdate", (update) => {
      setMessages((prev) =>
        prev.map((m) =>
          m._id === update.messageId ? { ...m, status: update.status } : m
        )
      );
    });

    s.on("typing", ({ conversationId, userId: typingUserId }) => {
      if (
        conversationId === selectedConversationId &&
        typingUserId !== userId &&
        (!currentOtherId || typingUserId === currentOtherId)
      ) {
        setIsOtherTyping(true);
      }
    });

    s.on("stopTyping", ({ conversationId, userId: typingUserId }) => {
      if (
        conversationId === selectedConversationId &&
        typingUserId !== userId &&
        (!currentOtherId || typingUserId === currentOtherId)
      ) {
        setIsOtherTyping(false);
      }
    });

    return () => {
      s.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, selectedConversationId, currentOtherId, messages]);

  const fetchConversations = async () => {
    if (!userId) return;
    setLoadingConversations(true);
    try {
      const res = await axiosClient.get(`/conversations/${userId}`, {
        headers: getAuthHeaders(),
      });
      setConversations(res.data.conversations || []);
    } catch (err) {
      console.error("Error fetching conversations:", err);
    } finally {
      setLoadingConversations(false);
    }
  };

  const fetchMessages = async (conversationId) => {
    try {
      const res = await axiosClient.get(`/messages`, {
        params: { conversationId },
        headers: getAuthHeaders(),
      });

      const encryptedMessages = res.data.messages || [];

      const withPlaintext = await Promise.all(
        encryptedMessages.map(async (m) => {
          const plaintext = await decryptText(m.ciphertext, m.iv);
          return { ...m, plaintext };
        })
      );

      setMessages(withPlaintext);
    } catch (err) {
      console.error("Error fetching messages:", err);
    }
  };

  const handleSelectConversation = async (
    conversationId,
    otherUsername,
    otherUserId
  ) => {
    setSelectedConversationId(conversationId);
    setCurrentOtherUsername(otherUsername || "User");
    setCurrentOtherId(otherUserId || null);
    setIsOtherTyping(false);

    await fetchMessages(conversationId);

    if (socket) {
      socket.emit("joinConversation", conversationId);
      socket.emit("conversationRead", { conversationId, userId });
    }
  };

  const handleBackToList = () => {
    setSelectedConversationId(null);
    setMessages([]);
    setCurrentOtherId(null);
    setCurrentOtherUsername("");
    setIsOtherTyping(false);
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !selectedConversationId) return;

    try {
      const plaintext = input.trim();
      const { ciphertext, iv } = await encryptText(plaintext);

      const res = await axiosClient.post(
        `/messages`,
        {
          conversationId: selectedConversationId,
          ciphertext,
          iv,
        },
        {
          headers: getAuthHeaders(),
        }
      );

      const serverMessage = res.data.data;

      setMessages((prev) => [...prev, { ...serverMessage, plaintext }]);
      setInput("");

      if (socket) {
        socket.emit("stopTyping", {
          conversationId: selectedConversationId,
          userId,
        });
      }
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInput(value);

    if (!socket || !selectedConversationId) return;

    if (value.trim().length > 0) {
      socket.emit("typing", {
        conversationId: selectedConversationId,
        userId,
      });
    } else {
      socket.emit("stopTyping", {
        conversationId: selectedConversationId,
        userId,
      });
    }
  };

  const handleStartChatByPhone = async () => {
    setPhoneError("");

    if (!phoneInput.trim()) {
      setPhoneError("Enter a phone number");
      return;
    }

    try {
      const res = await axiosClient.post(
        `/conversations/by-phone`,
        {
          myUserId: userId,
          otherPhone: phoneInput.trim(),
        },
        {
          headers: getAuthHeaders(),
        }
      );

      setPhoneInput("");
      await fetchConversations();

      if (res.data.conversationId) {
        handleSelectConversation(
          res.data.conversationId,
          res.data.otherUsername,
          res.data.otherUserId
        );
      }
    } catch (err) {
      setPhoneError(err.response?.data?.message || "Error starting chat");
    }
  };

  useEffect(() => {
    fetchConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentPresence = currentOtherId ? presence[currentOtherId] : undefined;
  const currentStatusText = currentPresence
    ? formatLastSeen(currentPresence.online, currentPresence.lastSeen)
    : "";

  return (
    <div
      className={
        "chat-page" +
        (isMobile ? " chat-page-mobile" : "") +
        (showListOnly ? " view-list" : "") +
        (showMessagesOnly ? " view-chat" : "")
      }
    >
      <div className="chat-sidebar">
        <div className="sidebar-header">
          <div className="app-title">Galiyoon</div>
          <div className="app-subtitle">simple, quiet chat</div>
        </div>

        <div className="current-user">
          <div className="avatar">
            {username ? username[0]?.toUpperCase() : "U"}
          </div>
          <div className="user-info">
            <div className="user-name">{username || "User"}</div>
            <div className="user-status">online</div>
          </div>
        </div>

        <div className="chats-label">START CHAT</div>

        <div className="new-chat-section">
          <input
            type="tel"
            placeholder="Enter phone number"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            className="new-chat-input"
          />
          <button onClick={handleStartChatByPhone} className="new-chat-btn">
            Start
          </button>
          {phoneError && <div className="new-chat-error">{phoneError}</div>}
        </div>

        <div className="chats-label">CHATS</div>

        {loadingConversations ? (
          <div className="empty-state">Loading conversations...</div>
        ) : conversations.length === 0 ? (
          <div className="empty-state">No conversations yet.</div>
        ) : (
          <div className="conversation-list">
            {conversations.map((conv) => {
              const p = presence[conv.otherUserId];
              const statusText = p ? formatLastSeen(p.online, p.lastSeen) : "";
              return (
                <div
                  key={conv._id}
                  className={
                    conv._id === selectedConversationId
                      ? "conversation-item active"
                      : "conversation-item"
                  }
                  onClick={() =>
                    handleSelectConversation(
                      conv._id,
                      conv.otherUsername,
                      conv.otherUserId
                    )
                  }
                >
                  <div className="avatar">
                    {conv.otherUsername
                      ? conv.otherUsername[0]?.toUpperCase()
                      : "U"}
                  </div>
                  <div className="conversation-text">
                    <div className="conversation-name">
                      {conv.otherUsername || "Unknown"}
                    </div>
                    <div className="conversation-status">
                      {statusText || "offline"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="chat-main">
        {!selectedConversationId ? (
          <div className="welcome-panel">
            <h1>Welcome to Galiyoon ☁️</h1>
            <p>Select a chat from the left, or start a new one by phone number.</p>
          </div>
        ) : (
          <div className="chat-panel">
            <div className="chat-header">
              {isMobile && selectedConversationId && (
                <button className="back-button" onClick={handleBackToList}>
                  ← Back
                </button>
              )}

              <div className="chat-header-text">
                <div className="chat-header-name">
                  {currentOtherUsername || "Chat"}
                </div>
                <div className="chat-header-status">{currentStatusText}</div>
              </div>
            </div>

            <div className="messages">
              {messages.map((m) => {
                const isOwn =
                  m.senderId === userId || m.senderId === String(userId);
                const displayName = isOwn ? "You" : currentOtherUsername;

                return (
                  <div
                    key={m._id}
                    className={isOwn ? "message message-own" : "message"}
                  >
                    <div className="message-text">{m.plaintext}</div>
                    <div className="message-meta">
                      <span>{displayName}</span>
                      {isOwn && (
                        <span
                          className={
                            m.status === "read"
                              ? "message-status read"
                              : "message-status"
                          }
                        >
                          {getStatusIcon(m.status || "sent")}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {isOtherTyping && (
              <div className="typing-indicator">
                {currentOtherUsername || "They"} are typing…
              </div>
            )}

            <div className="input-row">
              <input
                type="text"
                placeholder="Type a message..."
                value={input}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSendMessage();
                }}
              />
              <button onClick={handleSendMessage}>Send</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Chat;
