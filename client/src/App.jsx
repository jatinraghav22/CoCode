import { useEffect, useState } from "react";
import "./App.css";

const codeSamples = {
  Python: {
    file: "main.py",
    lines: [
      { text: "# Your next idea starts here", kind: "comment" },
      { text: "def greet(name):", kind: "keyword" },
      { text: '    return f"Hello, {name}!"', kind: "string" },
      { text: "" },
      { text: 'print(greet("Developer"))', kind: "function" },
    ],
    output: ["$ python main.py", "Hello, Developer!"],
  },
  JavaScript: {
    file: "main.js",
    lines: [
      { text: "// Build something amazing", kind: "comment" },
      { text: "const greet = (name) => {", kind: "keyword" },
      { text: '  return "Hello, " + name + "!";', kind: "string" },
      { text: "};" },
      { text: 'console.log(greet("Developer"));', kind: "function" },
    ],
    output: ["$ node main.js", "Hello, Developer!"],
  },
  "C++": {
    file: "main.cpp",
    lines: [
      { text: "#include <iostream>", kind: "keyword" },
      { text: "using namespace std;", kind: "keyword" },
      { text: "" },
      { text: "int main() {", kind: "function" },
      { text: '    cout << "Hello, Developer!";', kind: "string" },
      { text: "    return 0;", kind: "keyword" },
      { text: "}", kind: "function" },
    ],
    output: ["$ ./main", "Hello, Developer!"],
  },
};

const features = [
  {
    number: "01",
    symbol: "</>",
    title: "Instant coding",
    description:
      "Open your workspace, write code and start building without unnecessary friction.",
    tag: "DEVELOPER FIRST",
  },
  {
    number: "02",
    symbol: "⌘",
    title: "Collaborate together",
    description:
      "A shared space designed for pair programming, learning and building with your team.",
    tag: "TEAM READY",
  },
  {
    number: "03",
    symbol: "↗",
    title: "Your ideas, faster",
    description:
      "A focused developer experience with clear tools, helpful feedback and less clutter.",
    tag: "BUILT FOR FLOW",
  },
];

const steps = [
  { number: "01", title: "Open CoCode", text: "Jump straight into your workspace." },
  { number: "02", title: "Write your idea", text: "Turn a blank editor into something real." },
  { number: "03", title: "Run and build", text: "Test your work and keep improving." },
];

function App() {
  const [serverStatus, setServerStatus] = useState("checking");
  const [activeLanguage, setActiveLanguage] = useState("Python");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetch("http://localhost:5000/api/health", {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Backend health check failed");
        }
        return response.json();
      })
      .then((data) => {
        setServerStatus(data.status === "healthy" ? "healthy" : "offline");
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setServerStatus("offline");
        }
      });

    return () => controller.abort();
  }, []);

  const sample = codeSamples[activeLanguage];

  const closeMenu = () => setMenuOpen(false);

  return (
    <main className="site-shell" id="home">
      <header className="site-header">
        <a className="brand" href="#home" onClick={closeMenu} aria-label="CoCode home">
          <span className="brand-mark">C</span>
          <span>Co<span className="brand-light">Code</span></span>
          <span className="brand-beta">DEV</span>
        </a>

        <button
          className="menu-toggle"
          type="button"
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
        </button>

        <nav className={`site-nav ${menuOpen ? "is-open" : ""}`}>
          <a href="#features" onClick={closeMenu}>Features</a>
          <a href="#compiler-preview" onClick={closeMenu}>Compiler</a>
          <a href="#workflow" onClick={closeMenu}>How it works</a>
          <a href="#rooms" onClick={closeMenu}>Collaboration</a>
        </nav>

        <div className="header-actions">
          <span className={`backend-chip status-${serverStatus}`}>
            <span className="status-dot" />
            {serverStatus === "checking"
              ? "Connecting"
              : serverStatus === "healthy"
                ? "Systems online"
                : "API offline"}
          </span>
          <a className="button button-small button-primary" href="#compiler-preview">
            Start coding <span aria-hidden="true">↗</span>
          </a>
        </div>
      </header>

      <section className="hero-section">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="eyebrow-spark">✳</span>
            THE DEVELOPER SPACE
            <span className="eyebrow-divider" />
            BUILT FOR YOU
          </div>

          <h1 className="hero-title">
            Think it.
            <br />
            <span className="gradient-text">Code it.</span>
            <br />
            <span className="title-outline">Make it real.</span>
          </h1>

          <p className="hero-description">
            Meet your new favorite coding space. Write code, explore ideas,
            and collaborate — all in one beautifully designed developer platform.
          </p>

          <div className="hero-actions">
            <a className="button button-primary button-large" href="#compiler-preview">
              Explore compiler <span aria-hidden="true">↗</span>
            </a>
            <a className="button button-secondary button-large" href="#features">
              Discover CoCode <span aria-hidden="true">↓</span>
            </a>
          </div>

          <div className="hero-proof">
            <div className="avatar-stack" aria-hidden="true">
              <span>J</span>
              <span>C</span>
              <span>D</span>
              <span>+</span>
            </div>
            <div className="proof-copy">
              <span className="proof-title">Built for curious minds.</span>
              <span className="proof-subtitle">From first line to big idea.</span>
            </div>
            <span className="proof-sparkle" aria-hidden="true">✦</span>
          </div>

          <div className="hero-orbit orbit-one" />
          <div className="hero-orbit orbit-two" />
        </div>

        <div className="hero-visual" id="compiler-preview">
          <div className="visual-glow" />
          <div className="floating-label floating-label-top">
            <span className="floating-icon">✳</span>
            <span>
              <strong>Stay in flow</strong>
              <small>Your ideas, uninterrupted.</small>
            </span>
          </div>

          <div className="editor-window">
            <div className="window-topbar">
              <div className="window-controls" aria-hidden="true">
                <span className="control-red" />
                <span className="control-yellow" />
                <span className="control-green" />
              </div>
              <span className="window-title">CoCode <span>/ workspace</span></span>
              <span className="window-status"><i /> READY</span>
            </div>

            <div className="editor-toolbar">
              <div className="file-tab">
                <span className="file-icon">⌘</span>
                {sample.file}
                <span className="file-unsaved" />
              </div>
              <span className="editor-toolbar-right">UTF-8 <span>⌄</span></span>
            </div>

            <div className="language-tabs" aria-label="Code sample language">
              {Object.keys(codeSamples).map((language) => (
                <button
                  key={language}
                  type="button"
                  className={`language-tab ${activeLanguage === language ? "active" : ""}`}
                  onClick={() => setActiveLanguage(language)}
                  aria-pressed={activeLanguage === language}
                >
                  {language === "Python" ? "Py" : language === "JavaScript" ? "JS" : "C++"}
                  <span>{language}</span>
                </button>
              ))}
            </div>

            <div className="editor-body">
              <div className="code-lines">
                {sample.lines.map((line, index) => (
                  <div className="code-line" key={`${activeLanguage}-${index}`}>
                    <span className="line-number">{String(index + 1).padStart(2, "0")}</span>
                    <code className={line.kind || ""}>{line.text || "\u00A0"}</code>
                  </div>
                ))}
                <div className="editor-cursor-line">
                  <span className="line-number">↳</span>
                  <span className="cursor-block" />
                </div>
              </div>
            </div>

            <div className="output-header">
              <span><span className="terminal-symbol">›_</span> SAMPLE OUTPUT</span>
              <span className="output-example">EXAMPLE</span>
            </div>
            <div className="output-body">
              {sample.output.map((line, index) => (
                <p className={index === 0 ? "output-command" : "output-result"} key={line}>
                  {line}
                </p>
              ))}
              <p className="output-success"><span>✓</span> Example output preview</p>
            </div>

            <div className="editor-footer">
              <span><i className="footer-dot" /> CoCode workspace</span>
              <span>Made for makers <span className="footer-heart">♥</span></span>
            </div>
          </div>

          <div className="floating-label floating-label-bottom">
            <span className="success-orb">✓</span>
            <span>
              <strong>Ready for your next idea?</strong>
              <small>Start coding without an account.</small>
            </span>
          </div>
          <div className="visual-index"><span>01</span> / YOUR WORKSPACE</div>
        </div>
      </section>

      <section className="trust-strip" aria-label="CoCode highlights">
        <span className="trust-label">MADE FOR THE WAY YOU BUILD</span>
        <span className="trust-item"><i>✳</i> Fast to start</span>
        <span className="trust-item"><i>⌘</i> Designed to focus</span>
        <span className="trust-item"><i>↗</i> Room to grow</span>
        <span className="trust-item"><i>∞</i> Ideas welcome</span>
      </section>

      <section className="section features-section" id="features">
        <div className="section-heading">
          <div>
            <div className="section-kicker"><span /> THE COCODE DIFFERENCE</div>
            <h2>
              Less friction.
              <br />
              <span className="gradient-text">More creation.</span>
            </h2>
          </div>
          <p>
            Everything starts with a great experience. CoCode brings your
            developer workflow into one clear, focused space.
          </p>
        </div>

        <div className="feature-grid">
          {features.map((feature) => (
            <article className="feature-card" key={feature.number}>
              <div className="feature-card-top">
                <span className="feature-symbol">{feature.symbol}</span>
                <span className="feature-number">{feature.number}</span>
              </div>
              <span className="feature-tag">{feature.tag}</span>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
              <a href="#compiler-preview" className="feature-link" aria-label={`Explore ${feature.title}`}>
                Explore <span aria-hidden="true">↗</span>
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="workflow-section section" id="workflow">
        <div className="workflow-intro">
          <div className="section-kicker"><span /> YOUR FLOW, SIMPLIFIED</div>
          <h2>From blank page<br />to <span className="gradient-text">brilliant idea.</span></h2>
          <p>No complicated setup to explore the experience. Start with a small idea and build from there.</p>
          <a className="text-link" href="#compiler-preview">Explore the preview <span aria-hidden="true">→</span></a>
        </div>
        <div className="steps-list">
          {steps.map((step) => (
            <div className="step-row" key={step.number}>
              <span className="step-number">{step.number}</span>
              <span className="step-connector" />
              <div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
              <span className="step-arrow" aria-hidden="true">↗</span>
            </div>
          ))}
        </div>
      </section>

      <section className="collab-section section" id="rooms">
        <div className="collab-panel">
          <div className="collab-decoration decoration-one" />
          <div className="collab-decoration decoration-two" />
          <div className="collab-copy">
            <div className="section-kicker"><span /> BUILT FOR WHAT'S NEXT</div>
            <h2>Great code.<br /><span className="gradient-text">Better together.</span></h2>
            <p>
              A workspace designed to grow with your projects — from solo
              experiments to collaborative coding sessions.
            </p>
            <a href="#compiler-preview" className="button button-primary button-large">
              Start exploring <span aria-hidden="true">↗</span>
            </a>
          </div>
          <div className="collab-art" aria-hidden="true">
            <div className="art-ring ring-one" />
            <div className="art-ring ring-two" />
            <div className="art-core">&lt;/&gt;</div>
            <div className="art-node node-one">JS</div>
            <div className="art-node node-two">Py</div>
            <div className="art-node node-three">C+</div>
            <div className="art-node node-four">✦</div>
          </div>
        </div>
      </section>

      <section className="final-cta section" id="about">
        <div className="cta-glow" />
        <div className="section-kicker"><span /> YOUR NEXT LINE STARTS HERE</div>
        <h2>Have an idea?<br /><span className="gradient-text">Let's make it real.</span></h2>
        <p>Explore the CoCode experience and take the first step on your next project.</p>
        <a href="#compiler-preview" className="button button-primary button-large">
          Explore CoCode <span aria-hidden="true">↗</span>
        </a>
        <span className="cta-note"><i /> No account needed to explore the compiler preview</span>
      </section>

      <footer className="site-footer">
        <a className="brand footer-brand" href="#home">
          <span className="brand-mark">C</span>
          <span>Co<span className="brand-light">Code</span></span>
        </a>
        <span>Think clearly. Build boldly.</span>
        <a href="#home" className="back-to-top">Back to top ↑</a>
        <span className="copyright">© {new Date().getFullYear()} CoCode</span>
      </footer>
    </main>
  );
}

export default App;