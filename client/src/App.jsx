import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Play,
  ArrowRight,
  Terminal,
  Users,
  Cpu,
  Share2,
  CheckCircle2,
  Copy,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Monitor,
  X,
} from "lucide-react";
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import Button from "./components/Button.jsx";
import "./App.css";

const CODE_PREVIEWS = {
  Python: {
    filename: "algorithm.py",
    languageId: "python",
    code: `# Real-Time Prime Sieve Algorithm
def sieve_primes(limit: int) -> list:
    is_prime = [True] * (limit + 1)
    is_prime[0] = is_prime[1] = False
    
    for i in range(2, int(limit**0.5) + 1):
        if is_prime[i]:
            for j in range(i*i, limit + 1, i):
                is_prime[j] = False
                
    return [x for x in range(limit + 1) if is_prime[x]]

result = sieve_primes(30)
print(f"Discovered {len(result)} primes:", result)`,
    output: [
      { type: "meta", text: "$ python3 algorithm.py" },
      { type: "stdout", text: "Discovered 10 primes: [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]" },
      { type: "success", text: "✓ Process completed in 0.041s • Memory: 11.2 MB" },
    ],
  },
  JavaScript: {
    filename: "collaborator.js",
    languageId: "javascript",
    code: `// CoCode Realtime Session Handler
class PeerSession {
  constructor(roomCode, developer) {
    this.room = roomCode;
    this.user = developer;
    this.latency = "12ms";
  }

  syncBuffer(changeSet) {
    return {
      status: "SYNCED",
      version: 42,
      collaborators: ["Alice", "Bob", this.user],
      timestamp: Date.now()
    };
  }
}

const session = new PeerSession("ROOM-9042", "You");
console.log(session.syncBuffer({ line: 12, char: "const x = 10;" }));`,
    output: [
      { type: "meta", text: "$ node collaborator.js" },
      {
        type: "stdout",
        text: '{ status: "SYNCED", version: 42, collaborators: [ "Alice", "Bob", "You" ] }',
      },
      { type: "success", text: "✓ Process completed in 0.029s • Memory: 18.4 MB" },
    ],
  },
  "C++": {
    filename: "factorial.cpp",
    languageId: "cpp",
    code: `#include <iostream>
#include <vector>

// Ultra-fast recursive memoized factorial
long long factorial(int n) {
    static std::vector<long long> memo(30, 0);
    if (n <= 1) return 1;
    if (memo[n] != 0) return memo[n];
    return memo[n] = n * factorial(n - 1);
}

int main() {
    int target = 15;
    std::cout << "Factorial of " << target << " = " 
              << factorial(target) << std::endl;
    return 0;
}`,
    output: [
      { type: "meta", text: "$ g++ -O3 factorial.cpp -o main && ./main" },
      { type: "stdout", text: "Factorial of 15 = 1307674368000" },
      { type: "success", text: "✓ Process completed in 0.012s • Memory: 4.8 MB" },
    ],
  },
};

const FEATURE_CARDS = [
  {
    icon: Terminal,
    title: "Online Compiler",
    badge: "INSTANT RUNTIME",
    description:
      "Execute Python 3, Node.js, and C++ code with zero configuration, lightning-fast compilation, and immediate terminal output.",
    linkText: "Try Compiler",
    to: "/compiler",
  },
  {
    icon: Users,
    title: "Real-time Collaboration",
    badge: "PAIR PROGRAMMING",
    description:
      "Code concurrently with peers in shared virtual rooms. View live cursor movements, sync changes instantly, and debug together.",
    linkText: "Start Room",
    to: "/rooms/create",
  },
  {
    icon: Cpu,
    title: "Modern IDE",
    badge: "MONACO POWERED",
    description:
      "Powered by the industry-standard Monaco editor engine with full syntax highlighting, intelligent autocompletion, and keyboard shortcuts.",
    linkText: "Explore Editor",
    to: "/compiler",
  },
  {
    icon: Share2,
    title: "Create & Join Rooms",
    badge: "SEAMLESS SHARING",
    description:
      "Spin up private or public collaboration rooms in seconds with a unique 6-character room code. No complex server setup required.",
    linkText: "Join Room",
    to: "/rooms/join",
  },
];

export default function App() {
  const [activeLanguage, setActiveLanguage] = useState("Python");
  const [isRunning, setIsRunning] = useState(false);
  const [showOutput, setShowOutput] = useState(true);
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const currentPreview = CODE_PREVIEWS[activeLanguage];

  const handleSimulateRun = () => {
    setIsRunning(true);
    setShowOutput(false);
    setTimeout(() => {
      setIsRunning(false);
      setShowOutput(true);
    }, 450);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentPreview.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="home-page">
      <Navbar />

      {/* Hero Section */}
      <section className="hero-section">
        {/* Ambient Glows */}
        <div className="ambient-glow-orb glow-violet" />
        <div className="ambient-glow-orb glow-cyan" />

        <div className="hero-content">
          {/* Hero Badge */}
          <div className="hero-badge-wrap">
            <div className="badge-pill">
              <span className="badge-dot" />
              <span>Code Together • Build Faster</span>
            </div>
          </div>

          {/* Main Heading */}
          <h1 className="hero-heading">
            The Ultimate <br />
            <span className="gradient-text">Developer Platform</span>
          </h1>

          {/* Supporting Text */}
          <p className="hero-subtitle">
            Write code, compile instantly, and collaborate with developers in real time.
            A sleek, distraction-free environment built for modern engineering.
          </p>

          {/* CTA Buttons */}
          <div className="hero-cta-group">
            <Button
              variant="primary"
              size="lg"
              to="/compiler"
              iconRight={ArrowRight}
            >
              Start Coding Free
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => setDemoModalOpen(true)}
              icon={Play}
            >
              Watch Demo
            </Button>
          </div>

          {/* Trust Highlights */}
          <div className="hero-trust-row">
            <div className="trust-item">
              <CheckCircle2 size={16} className="trust-icon" />
              <span>Zero setup required</span>
            </div>
            <div className="trust-dot">•</div>
            <div className="trust-item">
              <CheckCircle2 size={16} className="trust-icon" />
              <span>3+ High-performance runtimes</span>
            </div>
            <div className="trust-dot">•</div>
            <div className="trust-item">
              <CheckCircle2 size={16} className="trust-icon" />
              <span>Free & open to everyone</span>
            </div>
          </div>
        </div>

        {/* Code Editor Preview Window */}
        <div className="editor-preview-container" id="compiler-preview">
          <div className="editor-preview-frame">
            {/* Window Header */}
            <div className="preview-window-header">
              <div className="window-dots">
                <span className="dot dot-red" />
                <span className="dot dot-yellow" />
                <span className="dot dot-green" />
              </div>

              {/* Language Selector */}
              <div className="language-selector-pills">
                {Object.keys(CODE_PREVIEWS).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    className={`lang-pill ${activeLanguage === lang ? "active" : ""}`}
                    onClick={() => {
                      setActiveLanguage(lang);
                      setShowOutput(true);
                    }}
                  >
                    {lang}
                  </button>
                ))}
              </div>

              {/* Run Action */}
              <div className="window-actions">
                <button
                  type="button"
                  className="copy-btn"
                  onClick={handleCopyCode}
                  title="Copy Code"
                >
                  {copiedCode ? <CheckCircle2 size={15} /> : <Copy size={15} />}
                  <span>{copiedCode ? "Copied" : "Copy"}</span>
                </button>
                <button
                  type="button"
                  className={`run-code-btn ${isRunning ? "running" : ""}`}
                  onClick={handleSimulateRun}
                  disabled={isRunning}
                >
                  {isRunning ? (
                    <span className="btn-spinner" />
                  ) : (
                    <Play size={14} fill="currentColor" />
                  )}
                  <span>{isRunning ? "Compiling..." : "Run Code"}</span>
                </button>
              </div>
            </div>

            {/* Editor Workspace Split */}
            <div className="preview-split">
              {/* Code Panel */}
              <div className="preview-code-panel">
                <div className="code-panel-tab">
                  <Terminal size={14} />
                  <span>{currentPreview.filename}</span>
                  <span className="file-status-indicator" />
                </div>
                <div className="code-lines-scroll">
                  <pre className="code-block">
                    <code>
                      {currentPreview.code.split("\n").map((line, idx) => (
                        <div className="code-row" key={idx}>
                          <span className="row-number">{idx + 1}</span>
                          <span className="row-content">{line || " "}</span>
                        </div>
                      ))}
                    </code>
                  </pre>
                </div>
              </div>

              {/* Terminal Output Panel */}
              <div className="preview-terminal-panel">
                <div className="terminal-header">
                  <div className="terminal-title">
                    <span className="term-symbol">›_</span>
                    <span>TERMINAL OUTPUT</span>
                  </div>
                  <span className="term-badge">Live Preview</span>
                </div>

                <div className="terminal-body">
                  {isRunning ? (
                    <div className="terminal-executing">
                      <span className="btn-spinner" />
                      <span>Executing in sandbox environment...</span>
                    </div>
                  ) : showOutput ? (
                    <div className="terminal-lines">
                      {currentPreview.output.map((line, idx) => (
                        <div
                          key={idx}
                          className={`terminal-line line-${line.type}`}
                        >
                          {line.text}
                        </div>
                      ))}
                      <div className="terminal-prompt">
                        <span className="prompt-cursor">▋</span>
                      </div>
                    </div>
                  ) : (
                    <div className="terminal-empty">Output will appear here.</div>
                  )}
                </div>

                <div className="terminal-footer">
                  <Link to="/compiler" className="term-cta-link">
                    Open Full Compiler Workspace <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Cards Section */}
      <section className="features-section" id="features">
        <div className="section-container">
          <div className="section-header">
            <div className="badge-pill">
              <Sparkles size={14} />
              <span>POWERFUL CAPABILITIES</span>
            </div>
            <h2 className="section-title">
              Engineered for Speed, Clarity, <br />
              <span className="gradient-text">and Seamless Teamwork</span>
            </h2>
            <p className="section-description">
              Whether you are testing an algorithm in seconds or building a prototype with a peer,
              CoCode equips you with everything needed in one streamlined tab.
            </p>
          </div>

          <div className="features-grid">
            {FEATURE_CARDS.map((feat) => {
              const Icon = feat.icon;
              return (
                <div className="feature-card glass-panel" key={feat.title}>
                  <div className="feature-card-top">
                    <div className="feature-icon-box">
                      <Icon size={24} />
                    </div>
                    <span className="feature-badge">{feat.badge}</span>
                  </div>
                  <h3 className="feature-title">{feat.title}</h3>
                  <p className="feature-desc">{feat.description}</p>
                  <Link to={feat.to} className="feature-link">
                    <span>{feat.linkText}</span>
                    <ArrowRight size={16} />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Collaboration Callout Section */}
      <section className="rooms-callout-section" id="rooms">
        <div className="section-container">
          <div className="rooms-banner glass-panel">
            <div className="rooms-banner-content">
              <span className="rooms-badge">PAIR PROGRAMMING</span>
              <h2 className="rooms-banner-title">
                Code With Anyone, Anywhere. <br />
                <span className="gradient-text">Zero Latency Sync.</span>
              </h2>
              <p className="rooms-banner-p">
                Share a simple 6-character room code with your teammate or student.
                Jump directly into a joint coding session with synced code, instant runs, and team focus.
              </p>
              <div className="rooms-banner-actions">
                <Button variant="primary" size="md" to="/rooms/create" iconRight={ArrowRight}>
                  Create Collaboration Room
                </Button>
                <Button variant="outline" size="md" to="/rooms/join">
                  Join Existing Room
                </Button>
              </div>
            </div>

            <div className="rooms-banner-graphic" aria-hidden="true">
              <div className="room-graphic-card user-one">
                <div className="user-indicator">
                  <span className="user-dot dot-violet" />
                  <span>Developer (You)</span>
                </div>
                <code>function optimize() &#123;</code>
              </div>
              <div className="room-graphic-card user-two">
                <div className="user-indicator">
                  <span className="user-dot dot-cyan" />
                  <span>Peer (Connected)</span>
                </div>
                <code>return computeFast();</code>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="about-section" id="about">
        <div className="section-container">
          <div className="about-card glass-panel">
            <div className="about-grid">
              <div>
                <div className="badge-pill">
                  <ShieldCheck size={14} />
                  <span>DEVELOPER FIRST</span>
                </div>
                <h2 className="about-heading">
                  Why We Built <span className="gradient-text">CoCode</span>
                </h2>
                <p className="about-text">
                  Setting up local compilers, managing SDK versions, and configuring screen sharing
                  for simple code reviews wastes valuable engineering momentum.
                </p>
                <p className="about-text">
                  CoCode provides a pure, zero-overhead browser workspace that brings modern syntax,
                  verified remote compilation, and instant rooms straight to your browser.
                </p>
              </div>

              <div className="about-stats-grid">
                <div className="stat-box">
                  <div className="stat-number">3+</div>
                  <div className="stat-label">Core Runtimes</div>
                </div>
                <div className="stat-box">
                  <div className="stat-number">&lt; 50ms</div>
                  <div className="stat-label">Editor Response</div>
                </div>
                <div className="stat-box">
                  <div className="stat-number">100%</div>
                  <div className="stat-label">Browser Accessible</div>
                </div>
                <div className="stat-box">
                  <div className="stat-number">0</div>
                  <div className="stat-label">Setup Configs Needed</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Watch Demo Modal */}
      {demoModalOpen && (
        <div className="modal-backdrop" onClick={() => setDemoModalOpen(false)}>
          <div
            className="modal-content glass-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title-wrap">
                <Sparkles size={18} className="text-violet" />
                <h3>CoCode Platform Walkthrough</h3>
              </div>
              <button
                className="modal-close-btn"
                type="button"
                onClick={() => setDemoModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="demo-player-box">
                <div className="demo-live-preview">
                  <Monitor size={48} className="demo-icon" />
                  <h4>Interactive Code & Room Demonstration</h4>
                  <p>
                    Experience real-time code execution with Judge0 backend and multi-room
                    collaboration right from your browser.
                  </p>
                  <div className="demo-actions">
                    <Button
                      variant="primary"
                      size="md"
                      to="/compiler"
                      onClick={() => setDemoModalOpen(false)}
                      iconRight={ArrowRight}
                    >
                      Open Live Compiler
                    </Button>
                    <Button
                      variant="secondary"
                      size="md"
                      to="/rooms/create"
                      onClick={() => setDemoModalOpen(false)}
                    >
                      Create Collaboration Room
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}