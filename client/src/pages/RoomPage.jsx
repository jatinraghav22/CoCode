import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getSocket, connectSocket } from '../services/socket';
import api from '../services/api';
import {
  Users,
  MessageSquare,
  PenTool,
  Play,
  Copy,
  Check,
  Send,
  RotateCcw,
  Sparkles,
  ChevronRight,
  Shield,
  FileCode,
  Folder,
  Circle,
  X,
  Palette,
  Eraser,
} from 'lucide-react';

const SUPPORTED_LANGUAGES = [
  { id: 'javascript', name: 'JavaScript (Node.js)' },
  { id: 'typescript', name: 'TypeScript' },
  { id: 'python', name: 'Python 3' },
  { id: 'cpp', name: 'C++ (GCC)' },
  { id: 'java', name: 'Java (OpenJDK)' },
  { id: 'go', name: 'Go' },
  { id: 'rust', name: 'Rust' },
];

const RoomPage = () => {
  const { roomCode } = useParams();
  const { user } = useAuth();
  const { success, error: toastError, info } = useToast();
  const navigate = useNavigate();

  // Room metadata
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeUsers, setActiveUsers] = useState([]);
  const [copiedCode, setCopiedCode] = useState(false);

  // Editor state
  const [currentLanguage, setCurrentLanguage] = useState('javascript');
  const [editorContent, setEditorContent] = useState('');
  const [isRemoteUpdate, setIsRemoteUpdate] = useState(false);

  // Execution state
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState('');
  const [stdin, setStdin] = useState('');
  const [activeRightPanel, setActiveRightPanel] = useState('chat'); // 'chat' | 'whiteboard' | 'output'

  // Chat state
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const chatBottomRef = useRef(null);

  // Whiteboard canvas state
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokeColor, setStrokeColor] = useState('#38bdf8');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [isEraser, setIsEraser] = useState(false);

  const socketRef = useRef(null);
  const editorRef = useRef(null);

  // 1. Fetch Room Details & Initialize Socket
  useEffect(() => {
    let socket = null;

    const fetchRoomAndConnect = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/rooms/${roomCode}`);
        if (!res.data.success) {
          toastError('Could not join room.');
          navigate('/dashboard');
          return;
        }

        const roomData = res.data.data.room;
        setRoom(roomData);
        setMessages(roomData.messages || []);

        // Load project files if linked
        if (roomData.project?.files?.length > 0) {
          const first = roomData.project.files.find((f) => !f.isFolder) || roomData.project.files[0];
          setEditorContent(first.content || '');
          setCurrentLanguage(first.language || 'javascript');
        } else {
          setEditorContent(`// Welcome to Collaboration Room: ${roomData.name}\n// Room Code: ${roomData.roomCode}\n// Start coding together in real time!\n\nconsole.log("Hello from collaborative room!");\n`);
        }

        // Initialize Socket
        socket = connectSocket(user);
        socketRef.current = socket;

        // Join room channel
        socket.emit('join-room', {
          roomId: roomData.id,
          user: user || { id: `anon-${Date.now()}`, name: 'Guest Dev', username: 'guest' },
        });

        // Listen for active users presence
        socket.on('room-users', (usersList) => {
          setActiveUsers(usersList);
        });

        socket.on('user-joined', ({ user: joinedUser, message }) => {
          info(message);
        });

        socket.on('user-left', ({ user: leftUser, message }) => {
          info(message);
        });

        // Listen for remote editor updates
        socket.on('code-update', ({ content, sender }) => {
          if (sender !== socket.id) {
            setIsRemoteUpdate(true);
            setEditorContent(content);
          }
        });

        // Listen for new chat messages
        socket.on('new-message', (msg) => {
          setMessages((prev) => [...prev, msg]);
        });

        // Listen for whiteboard strokes
        socket.on('stroke-drawn', (data) => {
          drawRemoteStroke(data);
        });

        socket.on('board-cleared', () => {
          clearLocalCanvas();
        });
      } catch (err) {
        console.error('Room connection error:', err);
        toastError('Failed to connect to collaboration room.');
      } finally {
        setLoading(false);
      }
    };

    fetchRoomAndConnect();

    return () => {
      if (socket) {
        socket.off('room-users');
        socket.off('code-update');
        socket.off('new-message');
        socket.off('stroke-drawn');
        socket.off('board-cleared');
      }
    };
  }, [roomCode]);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeRightPanel]);

  // Monaco Editor mount
  const handleEditorDidMount = (editor) => {
    editorRef.current = editor;
  };

  // Editor content change - broadcast to peers
  const handleEditorChange = (value) => {
    if (isRemoteUpdate) {
      setIsRemoteUpdate(false);
      return;
    }

    setEditorContent(value || '');

    if (socketRef.current && room) {
      socketRef.current.emit('code-change', {
        roomId: room.id,
        content: value || '',
        sender: socketRef.current.id,
      });
    }
  };

  // Run Code in Room
  const handleRunCode = async () => {
    setIsRunning(true);
    setActiveRightPanel('output');
    setOutput('🚀 Compiling and running collaborative code...\n');

    try {
      const res = await api.post('/execute', {
        language: currentLanguage,
        code: editorContent,
        stdin,
      });

      if (res.data.success) {
        const { output: resOutput, exitCode, executionTime } = res.data.data;
        setOutput(resOutput || '(Program finished with 0 output)');
        if (exitCode === 0) {
          success(`Executed in ${executionTime || 0}ms`);
        } else {
          toastError(`Exit code ${exitCode}`);
        }
      }
    } catch (err) {
      setOutput(`Execution error: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Chat submit
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !socketRef.current || !room) return;

    socketRef.current.emit('send-message', {
      roomId: room.id,
      content: chatInput.trim(),
      user,
    });

    setChatInput('');
  };

  // Copy Room Code / Invite Link
  const handleCopyInvite = () => {
    const inviteUrl = window.location.href;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedCode(true);
    success('Room invite link copied to clipboard!');
    setTimeout(() => setCopiedCode(false), 3000);
  };

  // Shared Whiteboard functions
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    const color = isEraser ? '#0f1422' : strokeColor;
    const width = isEraser ? strokeWidth * 3 : strokeWidth;

    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineTo(x, y);
    ctx.stroke();

    // Broadcast stroke
    if (socketRef.current && room) {
      socketRef.current.emit('draw-stroke', {
        roomId: room.id,
        strokeData: { x, y, color, width, type: 'draw' },
      });
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const drawRemoteStroke = ({ x, y, color, width, type }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const clearLocalCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleClearBoard = () => {
    clearLocalCanvas();
    if (socketRef.current && room) {
      socketRef.current.emit('clear-board', { roomId: room.id });
    }
  };

  if (loading) {
    return (
      <div style={{ height: 'calc(100vh - 60px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Entering collaboration room...</p>
      </div>
    );
  }

  return (
    <div style={{ height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      {/* Room Header Bar */}
      <div
        style={{
          height: '52px',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
        }}
      >
        {/* Left: Room Title & Code Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>{room?.name}</h2>
          <button
            onClick={handleCopyInvite}
            className="badge badge-blue"
            style={{ cursor: 'pointer', border: '1px solid rgba(56, 189, 248, 0.3)', gap: '6px' }}
            title="Click to copy invite link"
          >
            <span>Code: {room?.roomCode}</span>
            {copiedCode ? <Check size={12} /> : <Copy size={12} />}
          </button>

          <select
            className="form-select"
            value={currentLanguage}
            onChange={(e) => setCurrentLanguage(e.target.value)}
            style={{ width: '150px', padding: '4px 8px', height: '30px', fontSize: '0.8rem' }}
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        {/* Center: Collaborative Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handleRunCode}
            disabled={isRunning}
            className="btn btn-primary btn-sm"
            style={{ background: '#0284c7' }}
          >
            <Play size={14} fill="#fff" />
            <span>{isRunning ? 'Running...' : 'Run Code'}</span>
          </button>
        </div>

        {/* Right: Active Participants & Panel Switchers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Active Participants Avatars */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {activeUsers.map((u, i) => (
              <div
                key={u.socketId || i}
                title={`${u.name} (Online)`}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  border: '2px solid #10b981',
                  overflow: 'hidden',
                  background: 'var(--bg-tertiary)',
                }}
              >
                <img
                  src={u.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${u.name}`}
                  alt={u.name}
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
            ))}
            <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 600, marginLeft: '4px' }}>
              ● {activeUsers.length} Online
            </span>
          </div>

          {/* Panel Toggle Buttons */}
          <div style={{ display: 'flex', gap: '4px', borderLeft: '1px solid var(--border-color)', paddingLeft: '12px' }}>
            <button
              onClick={() => setActiveRightPanel('chat')}
              className="btn btn-ghost btn-sm"
              style={{
                color: activeRightPanel === 'chat' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                background: activeRightPanel === 'chat' ? 'var(--bg-tertiary)' : 'transparent',
              }}
              title="Chat"
            >
              <MessageSquare size={16} />
            </button>

            <button
              onClick={() => setActiveRightPanel('whiteboard')}
              className="btn btn-ghost btn-sm"
              style={{
                color: activeRightPanel === 'whiteboard' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                background: activeRightPanel === 'whiteboard' ? 'var(--bg-tertiary)' : 'transparent',
              }}
              title="Shared Whiteboard"
            >
              <PenTool size={16} />
            </button>

            <button
              onClick={() => setActiveRightPanel('output')}
              className="btn btn-ghost btn-sm"
              style={{
                color: activeRightPanel === 'output' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                background: activeRightPanel === 'output' ? 'var(--bg-tertiary)' : 'transparent',
              }}
              title="Output Console"
            >
              <Play size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Split: Collaborative Monaco Editor + Right Drawer */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Editor Area */}
        <div style={{ flex: 1, height: '100%' }}>
          <Editor
            height="100%"
            language={currentLanguage === 'cpp' ? 'cpp' : currentLanguage}
            value={editorContent}
            theme="vs-dark"
            onChange={handleEditorChange}
            onMount={handleEditorDidMount}
            options={{
              fontSize: 14,
              fontFamily: "'Fira Code', Consolas, monospace",
              minimap: { enabled: false },
              wordWrap: 'on',
              automaticLayout: true,
              tabSize: 2,
            }}
          />
        </div>

        {/* Right Collapsible Interactive Panel (Chat / Whiteboard / Output) */}
        <div
          style={{
            width: '380px',
            background: 'var(--bg-secondary)',
            borderLeft: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* TAB 1: Real-Time Chat */}
          {activeRightPanel === 'chat' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border-color)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <MessageSquare size={16} className="text-sky-400" />
                <span>Room Discussion</span>
              </div>

              {/* Messages Scroll Area */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {messages.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '30px' }}>
                    No messages yet. Say hello to your room members!
                  </p>
                ) : (
                  messages.map((m) => {
                    const isSelf = m.userId === user?.id || m.user?.id === user?.id;
                    return (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isSelf ? 'flex-end' : 'flex-start',
                        }}
                      >
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                          {isSelf ? 'You' : m.user?.name || 'Member'}
                        </span>
                        <div
                          style={{
                            maxWidth: '85%',
                            padding: '8px 12px',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: isSelf ? 'var(--accent-hover)' : 'var(--bg-tertiary)',
                            color: '#fff',
                            fontSize: '0.875rem',
                            wordBreak: 'break-word',
                          }}
                        >
                          {m.content}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input */}
              <form
                onSubmit={handleSendMessage}
                style={{
                  padding: '12px',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  gap: '8px',
                }}
              >
                <input
                  type="text"
                  placeholder="Type a message..."
                  className="form-input"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  style={{ height: '38px', fontSize: '0.85rem' }}
                />
                <button type="submit" className="btn btn-primary btn-sm" style={{ padding: '0 12px' }}>
                  <Send size={15} />
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: Shared Whiteboard */}
          {activeRightPanel === 'whiteboard' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div
                style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600 }}>
                  <PenTool size={16} className="text-amber-400" />
                  <span>Shared Whiteboard</span>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => setIsEraser(!isEraser)}
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '4px', color: isEraser ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
                    title={isEraser ? 'Switch to Pen' : 'Eraser'}
                  >
                    <Eraser size={15} />
                  </button>
                  <button
                    onClick={handleClearBoard}
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '4px' }}
                    title="Clear Canvas"
                  >
                    <RotateCcw size={15} />
                  </button>
                </div>
              </div>

              {/* Whiteboard Color Tools */}
              <div
                style={{
                  padding: '6px 14px',
                  background: 'var(--bg-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                {['#38bdf8', '#10b981', '#f59e0b', '#ef4444', '#ffffff'].map((color) => (
                  <div
                    key={color}
                    onClick={() => {
                      setStrokeColor(color);
                      setIsEraser(false);
                    }}
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: color,
                      cursor: 'pointer',
                      border: strokeColor === color && !isEraser ? '2px solid #fff' : 'none',
                    }}
                  />
                ))}
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  Live Canvas Sync
                </span>
              </div>

              {/* Canvas Area */}
              <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                <canvas
                  ref={canvasRef}
                  width={380}
                  height={500}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  style={{
                    width: '100%',
                    height: '100%',
                    background: '#0f1422',
                    cursor: isEraser ? 'crosshair' : 'crosshair',
                  }}
                />
              </div>
            </div>
          )}

          {/* TAB 3: Execution Output Console */}
          {activeRightPanel === 'output' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                }}
              >
                <span>Program Output</span>
                <button
                  onClick={() => setOutput('')}
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                >
                  Clear
                </button>
              </div>

              <div style={{ flex: 1, padding: '16px', overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: output.includes('Error') ? '#f87171' : 'var(--text-primary)' }}>
                  {output || 'Click "Run Code" to execute.'}
                </pre>
              </div>

              <div style={{ padding: '12px', borderTop: '1px solid var(--border-color)' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Input (stdin):</label>
                <input
                  type="text"
                  placeholder="Console input values..."
                  className="form-input"
                  value={stdin}
                  onChange={(e) => setStdin(e.target.value)}
                  style={{ height: '32px', fontSize: '0.8rem', marginTop: '4px' }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoomPage;
