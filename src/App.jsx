import { useEffect, useRef, useState } from "react";
import Groq from "groq-sdk";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);
  // Groq client
  const groq = new Groq({
    apiKey: import.meta.env.VITE_GROQ_API_KEY,
    dangerouslyAllowBrowser: true,
  });
  // =========================
  // SEND MESSAGE
  // =========================
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userInput = input.trim();
    const userMessage = {
      role: "user",
      content: userInput,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: "Thinking...",
      },
    ]);
    const thinkingTimer = setTimeout(() => {
      setMessages((prev) => {
        const updated = [...prev];
        const lastMessage = updated[updated.length - 1];
        if (
          lastMessage?.role === "assistant" &&
          lastMessage?.content === "Thinking..."
        ) {
          updated[updated.length - 1] = {
            role: "assistant",
            content:
              "Still working on your response. This may take a few seconds...",
          };
        }
        return updated;
      });
    }, 5000);
    try {
      // =========================
      // REAL TOKEN STREAMING
      // =========================
      const stream = await groq.chat.completions.create({
        model: "openai/gpt-oss-120b",
        messages: [...messages, userMessage].map((message) => ({
          role: message.role,
          content: message.content,
        })),
        stream: true,
      });
      let aiResponse = "";
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || "";
        aiResponse += text;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: aiResponse,
          };
          return updated;
        });
      }
    } catch (error) {
      console.error("Groq API Error:", error);
      // Default error
      let errorMessage = "Something went wrong. Please try again.";
      // =========================
      // RATE LIMIT ERROR
      // =========================
      if (
        error?.status === 429 ||
        error?.code === "rate_limit_exceeded" ||
        error?.error?.code === "rate_limit_exceeded"
      ) {
        errorMessage =
          "Too many requests. Please wait for a few seconds and try again.";
      }
      // =========================
      // INVALID API KEY
      // =========================
      else if (error?.status === 401) {
        errorMessage =
          "The API key is invalid or missing. Please check your API configuration.";
      }
      // =========================
      // MODEL / PERMISSION ERROR
      // =========================
      else if (error?.status === 403) {
        errorMessage = "This AI model is not available for your account.";
      }
      // =========================
      // SERVER ERROR
      // =========================
      else if (
        error?.status === 500 ||
        error?.status === 502 ||
        error?.status === 503
      ) {
        errorMessage =
          "The AI service is temporarily unavailable. Please try again in a moment.";
      }
      // =========================
      // INTERNET ERROR
      // =========================
      else if (!navigator.onLine) {
        errorMessage =
          "You appear to be offline. Please check your internet connection.";
      }
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: errorMessage,
        };
        return updated;
      });
    } finally {
      clearTimeout(thinkingTimer);
      setIsLoading(false);
    }
  };
  // =========================
  // ENTER KEY
  // =========================
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSend();
    }
  };
  const isChatStarted = messages.length > 0;
  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50 text-slate-900 flex flex-col overflow-hidden">
      {/* =========================
          HEADER
      ========================= */}
      <header className="shrink-0 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <h1 className="text-xl font-semibold text-slate-800">
            AI Chat Assistant
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Ask anything and get AI-powered answers
          </p>
        </div>
      </header>
      {/* =========================
          MAIN AREA
      ========================= */}
      <main className="flex-1 min-h-0">
        {/* =========================
            BEFORE CHAT STARTS
        ========================= */}
        {!isChatStarted ? (
          <div className="h-full flex items-center justify-center px-4">
            <div className="w-full max-w-3xl">
              {/* TITLE */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-200 mb-5">
                  ✦
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-slate-800">
                  How can I help you?
                </h2>
                <p className="text-slate-500 mt-3">
                  Ask a question and start a conversation with AI.
                </p>
              </div>
              {/* CENTER INPUT */}
              <div className="bg-white/90 backdrop-blur-sm border border-slate-200 rounded-2xl p-2 shadow-xl shadow-slate-200/60 flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message..."
                  className="flex-1 bg-transparent px-4 py-3 outline-none text-slate-700 placeholder:text-slate-400"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-6 py-3 rounded-xl transition-all duration-200 shadow-md"
                >
                  {isLoading ? "Thinking..." : "Send"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* =========================
            CHAT AREA
          ========================= */
          <div className="h-full overflow-y-auto">
            <div className="max-w-4xl mx-auto px-4 py-8">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex mb-6 ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={
                      message.role === "user"
                        ? "max-w-[75%] min-w-0"
                        : "max-w-full min-w-0"
                    }
                  >
                    {/* =========================
                          AI ICON
                      ========================= */}
                    {message.role === "assistant" && (
                      <div className="text-cyan-500 text-lg mb-2">✦</div>
                    )}
                    {/* =========================
                          MESSAGE BOX
                      ========================= */}
                    <div
                      className={
                        message.role === "user"
                          ? "w-fit max-w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-2xl rounded-tr-md px-5 py-4 shadow-md leading-relaxed break-words"
                          : "w-fit max-w-full bg-white border border-slate-200 text-slate-700 rounded-2xl rounded-tl-md px-5 py-4 shadow-sm leading-relaxed break-words min-w-0 overflow-hidden"
                      }
                    >
                      {/* =========================
                            MARKDOWN
                        ========================= */}
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          // Normal paragraphs
                          p: ({ children }) => (
                            <p className="mb-3 last:mb-0 break-words">
                              {children}
                            </p>
                          ),
                          // Code blocks
                          pre: ({ children }) => (
                            <pre className="max-w-full overflow-x-auto rounded-lg my-3 p-3 bg-slate-100">
                              {children}
                            </pre>
                          ),
                          // Tables
                          table: ({ children }) => (
                            <div className="max-w-full overflow-x-auto my-3">
                              <table className="min-w-full">{children}</table>
                            </div>
                          ),
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
              {/* Auto scroll target */}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}
      </main>
      {/* =========================
          BOTTOM INPUT
      ========================= */}
      {isChatStarted && (
        <div className="shrink-0 border-t border-slate-200 bg-white/80 backdrop-blur-md p-4">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white border border-slate-200 rounded-2xl p-2 shadow-lg flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                className="flex-1 px-4 py-3 outline-none text-slate-700 placeholder:text-slate-400"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-6 py-3 rounded-xl transition-all duration-200"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                  </span>
                ) : (
                  "Send"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default App;
