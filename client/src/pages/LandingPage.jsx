import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Code2,
  Users,
  Zap,
  Play,
  Layers,
  PenTool,
  History,
  ShieldCheck,
  ChevronRight,
  Terminal,
  Globe,
  Sparkles,
} from 'lucide-react';

const LandingPage = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', background: 'var(--bg-primary)' }}>
      {/* Hero Section */}
      <section
        style={{
          position: 'relative',
          padding: '80px 24px 60px 24px',
          maxWidth: '1200px',
          margin: '0 auto',
          textAlign: 'center',
        }}
      >
        {/* Glow ambient background */}
        <div
          style={{
            position: 'absolute',
            top: '20%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '600px',
            height: '350px',
            background: 'radial-gradient(circle, rgba(56, 189, 248, 0.12) 0%, rgba(10, 13, 20, 0) 70%)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div
            className="badge badge-blue"
            style={{ marginBottom: '20px', padding: '6px 16px', fontSize: '0.825rem' }}
          >
            <Sparkles size={14} />
            <span>Next-Gen Real-Time Collaborative Workspace</span>
          </div>

          <h1
            style={{
              fontSize: 'clamp(2.5rem, 5vw, 4rem)',
              lineHeight: 1.15,
              marginBottom: '24px',
              maxWidth: '900px',
              margin: '0 auto 24px auto',
              fontWeight: 800,
            }}
          >
            Write, Run & Collaborate on Code{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              in Real Time
            </span>
          </h1>

          <p
            style={{
              fontSize: '1.2rem',
              color: 'var(--text-secondary)',
              maxWidth: '680px',
              margin: '0 auto 36px auto',
            }}
          >
            CoCode brings pair programming to life with synchronized Monaco Editor,
            multi-file folder hierarchy, instant remote code execution for 50+ languages,
            collaborative drawing board, and git-like version snapshots.
          </p>

          <div
            style={{
              display: 'flex',
              gap: '16px',
              justifyContent: 'center',
              flexWrap: 'wrap',
              marginBottom: '48px',
            }}
          >
            <Link to={isAuthenticated ? '/dashboard' : '/register'} className="btn btn-primary" style={{ padding: '12px 28px', fontSize: '1rem' }}>
              <span>{isAuthenticated ? 'Go to Dashboard' : 'Start Coding Free'}</span>
              <ChevronRight size={18} />
            </Link>

            <Link to="/editor" className="btn btn-secondary" style={{ padding: '12px 28px', fontSize: '1rem' }}>
              <Terminal size={18} className="text-sky-400" />
              <span>Launch Quick Compiler</span>
            </Link>
          </div>

          {/* Quick Metrics */}
          <div
            style={{
              display: 'flex',
              gap: '32px',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.875rem',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={15} color="var(--accent-primary)" /> Sub-15ms Socket Sync
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Globe size={15} color="var(--success)" /> 50+ Programming Languages
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={15} color="#818cf8" /> Secure Isolated Sandbox
            </span>
          </div>
        </div>

        {/* Code Editor Hero Preview Card */}
        <div
          style={{
            marginTop: '60px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-lg)',
            textAlign: 'left',
          }}
        >
          {/* Mock Window Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 18px',
              background: 'var(--bg-tertiary)',
              borderBottom: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444' }} />
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f59e0b' }} />
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10b981' }} />
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              cocode-session / room-live-collab.js
            </div>
            <div className="badge badge-green">
              <span>● 3 Online</span>
            </div>
          </div>

          {/* Mock Code Block */}
          <div style={{ padding: '24px', fontFamily: 'var(--font-mono)', fontSize: '0.95rem', lineHeight: '1.7', overflowX: 'auto' }}>
            <div style={{ color: '#818cf8' }}>// Real-time Collaborative Coding with CoCode</div>
            <div>
              <span style={{ color: '#f43f5e' }}>import</span> {'{'} createRoom, syncStream {'}'} <span style={{ color: '#f43f5e' }}>from</span> <span style={{ color: '#10b981' }}>'@cocode/engine'</span>;
            </div>
            <br />
            <div>
              <span style={{ color: '#38bdf8' }}>const</span> room = <span style={{ color: '#f43f5e' }}>await</span> createRoom({'{'} code: <span style={{ color: '#10b981' }}>"CO-8821"</span> {'}'});
            </div>
            <div>
              room.onParticipantJoin((user) =&gt; {'{'}
            </div>
            <div style={{ paddingLeft: '24px' }}>
              console.log(<span style={{ color: '#10b981' }}>{`⚡ \${user.name} joined the workspace!`}</span>);
            </div>
            <div style={{ paddingLeft: '24px', color: '#10b981' }}>
              // Monaco multi-cursor changes synchronize automatically over Socket.IO
            </div>
            <div>{'}'});</div>
            <br />
            <div>
              <span style={{ color: '#f59e0b' }}>// Output: Program compiled in 142ms with 0 errors</span>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section style={{ maxWidth: '1200px', margin: '40px auto 80px auto', padding: '0 24px' }}>
        <h2 style={{ textAlign: 'center', fontSize: '2rem', marginBottom: '12px' }}>
          Engineered for Modern Developers
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '48px' }}>
          Everything you need for remote pair programming, coding interviews, and classroom assignments.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '24px',
          }}
        >
          {/* Feature 1 */}
          <div className="card">
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(56, 189, 248, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                color: 'var(--accent-primary)',
              }}
            >
              <Users size={22} />
            </div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Real-Time Pair Programming</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Seamless Socket.IO synchronization. Type code with peers simultaneously, see active participants, and exchange thoughts via live chat.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="card">
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(16, 185, 129, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                color: 'var(--success)',
              }}
            >
              <Play size={22} />
            </div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Multi-Language Sandbox</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Compile and run code instantly in Python, C++, Java, JS, Rust, Go, and 40+ more languages using secure remote runner sandboxes.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="card">
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(129, 140, 248, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                color: '#818cf8',
              }}
            >
              <Layers size={22} />
            </div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Multi-File Project Explorer</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Organize code in folders and multiple files. Create, rename, delete files with auto-save to MySQL and restore previous work anytime.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="card">
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(245, 158, 11, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                color: 'var(--warning)',
              }}
            >
              <PenTool size={22} />
            </div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Shared Whiteboard</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Sketch system architectures, draw flowcharts, and explain algorithms interactively on a shared real-time drawing canvas.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="card">
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(236, 72, 153, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                color: '#ec4899',
              }}
            >
              <History size={22} />
            </div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Version History & Rollbacks</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Capture milestone snapshots of your codebase with custom tags and roll back your files to previous working versions with one click.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="card">
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(56, 189, 248, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                color: 'var(--accent-primary)',
              }}
            >
              <Terminal size={22} />
            </div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Instant Offline Compiler</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Don't need a room? Jump straight into the Monaco editor with syntax highlighting, code formatting, and fast terminal output.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--border-color)',
          padding: '30px 24px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
        }}
      >
        <p>CoCode &copy; {new Date().getFullYear()} — B.Tech Computer Science Engineering Project</p>
      </footer>
    </div>
  );
};

export default LandingPage;
