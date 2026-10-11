import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import {
  Play,
  RotateCcw,
  Save,
  FolderPlus,
  FilePlus,
  Folder,
  FileCode,
  Trash2,
  Settings,
  Terminal,
  History,
  ChevronRight,
  ChevronDown,
  Check,
  AlertCircle,
  Clock,
  Sparkles,
  Maximize2,
  Copy,
} from 'lucide-react';

const SUPPORTED_LANGUAGES = [
  { id: 'javascript', name: 'JavaScript (Node.js)', ext: 'js' },
  { id: 'typescript', name: 'TypeScript', ext: 'ts' },
  { id: 'python', name: 'Python 3', ext: 'py' },
  { id: 'cpp', name: 'C++ (GCC)', ext: 'cpp' },
  { id: 'c', name: 'C (GCC)', ext: 'c' },
  { id: 'java', name: 'Java (OpenJDK)', ext: 'java' },
  { id: 'csharp', name: 'C# (Mono)', ext: 'cs' },
  { id: 'go', name: 'Go', ext: 'go' },
  { id: 'rust', name: 'Rust', ext: 'rs' },
  { id: 'php', name: 'PHP', ext: 'php' },
  { id: 'ruby', name: 'Ruby', ext: 'rb' },
  { id: 'swift', name: 'Swift', ext: 'swift' },
  { id: 'kotlin', name: 'Kotlin', ext: 'kt' },
  { id: 'bash', name: 'Bash / Shell', ext: 'sh' },
  { id: 'html', name: 'HTML / Web', ext: 'html' },
  { id: 'css', name: 'CSS', ext: 'css' },
  { id: 'sql', name: 'SQL', ext: 'sql' },
  { id: 'json', name: 'JSON', ext: 'json' },
  { id: 'markdown', name: 'Markdown', ext: 'md' },
  { id: 'lua', name: 'Lua', ext: 'lua' },
  { id: 'perl', name: 'Perl', ext: 'pl' },
  { id: 'r', name: 'R', ext: 'r' },
  { id: 'dart', name: 'Dart', ext: 'dart' },
];

const DEFAULT_SNIPPETS = {
  javascript: `// JavaScript Playground in CoCode
function calculateFibonacci(n) {
  if (n <= 1) return n;
  return calculateFibonacci(n - 1) + calculateFibonacci(n - 2);
}

console.log("Fibonacci(10) =", calculateFibonacci(10));
`,
  python: `# Python Playground in CoCode
def fibonacci(n):
    a, b = 0, 1
    for _ in range(n):
        yield a
        a, b = b, a + b

print("First 10 Fibonacci numbers:")
print(list(fibonacci(10)))
`,
  cpp: `// C++ Playground in CoCode
#include <iostream>
#include <vector>

int main() {
    std::cout << "Hello from C++ sandbox in CoCode!" << std::endl;
    std::vector<int> numbers = {1, 2, 3, 4, 5};
    int sum = 0;
    for (int n : numbers) sum += n;
    std::cout << "Sum: " << sum << std::endl;
    return 0;
}
`,
  java: `// Java Playground in CoCode
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello from Java runtime in CoCode!");
    }
}
`,
};

const EditorPage = () => {
  const { projectId } = useParams();
  const { user, isAuthenticated } = useAuth();
  const { success, error: toastError, info } = useToast();
  const navigate = useNavigate();

  // Project state
  const [project, setProject] = useState(null);
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [editorContent, setEditorContent] = useState('');
  const [currentLanguage, setCurrentLanguage] = useState('javascript');

  // Editor Settings
  const [theme, setTheme] = useState('vs-dark');
  const [fontSize, setFontSize] = useState(14);
  const [wordWrap, setWordWrap] = useState('on');

  // Execution state
  const [stdin, setStdin] = useState('');
  const [output, setOutput] = useState('');
  const [executionPhase, setExecutionPhase] = useState(null);
  const [executionTime, setExecutionTime] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeOutputTab, setActiveOutputTab] = useState('output'); // 'output' | 'stdin'

  // Version history state
  const [versions, setVersions] = useState([]);
  const [showVersionDrawer, setShowVersionDrawer] = useState(false);
  const [versionName, setVersionName] = useState('');

  // Modals & form state
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  const editorRef = useRef(null);

  // Initialize standalone or loaded project
  useEffect(() => {
    if (projectId) {
      loadProject(projectId);
    } else {
      // Standalone Compiler Mode
      const standaloneFile = {
        id: 'standalone-main',
        name: 'index.js',
        path: '/index.js',
        language: 'javascript',
        content: DEFAULT_SNIPPETS.javascript,
        isFolder: false,
      };
      setFiles([standaloneFile]);
      setActiveFile(standaloneFile);
      setEditorContent(standaloneFile.content);
      setCurrentLanguage('javascript');
    }
  }, [projectId]);

  const loadProject = async (id) => {
    try {
      const res = await api.get(`/projects/${id}`);
      if (res.data.success) {
        const projData = res.data.data.project;
        setProject(projData);
        setFiles(projData.files || []);
        setVersions(projData.versions || []);

        const firstCodeFile = projData.files?.find((f) => !f.isFolder) || projData.files?.[0];
        if (firstCodeFile) {
          setActiveFile(firstCodeFile);
          setEditorContent(firstCodeFile.content);
          setCurrentLanguage(firstCodeFile.language || 'javascript');
        }
      }
    } catch (err) {
      console.error('Error loading project:', err);
      toastError('Failed to load project files.');
    }
  };

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
  };

  const handleEditorChange = (value) => {
    setEditorContent(value || '');
    if (activeFile) {
      // Keep local state in sync
      setFiles((prev) =>
        prev.map((f) => (f.id === activeFile.id ? { ...f, content: value || '' } : f))
      );
    }
  };

  // Run Code through remote execution sandbox
  const handleRunCode = async () => {
    setIsRunning(true);
    setActiveOutputTab('output');
    setOutput('🚀 Compiling and running code...\n');

    try {
      const res = await api.post('/execute', {
        language: currentLanguage,
        code: editorContent,
        stdin,
      });

      if (res.data.success) {
        const { output: resOutput, phase, executionTime: execTime, exitCode } = res.data.data;
        setOutput(resOutput || '(Program exited with 0 output)');
        setExecutionPhase(phase);
        setExecutionTime(execTime);
        if (exitCode === 0) {
          success('Execution completed successfully!');
        } else {
          toastError(`Execution exited with code ${exitCode}`);
        }
      } else {
        setOutput(res.data.data?.output || 'Execution failed.');
      }
    } catch (err) {
      setOutput(`Error connecting to runner: ${err.message}`);
      toastError('Execution request failed.');
    } finally {
      setIsRunning(false);
    }
  };

  // Save current active file to MySQL
  const handleSaveFile = async () => {
    if (!projectId || !activeFile) {
      info('In standalone mode. Code runs immediately in memory.');
      return;
    }

    try {
      const res = await api.post(`/projects/${projectId}/files`, {
        fileId: activeFile.id,
        content: editorContent,
        language: currentLanguage,
      });

      if (res.data.success) {
        success('File saved successfully!');
        setActiveFile((prev) => ({ ...prev, content: editorContent }));
      }
    } catch (err) {
      toastError('Failed to save file changes.');
    }
  };

  // Format Code in Monaco
  const handleFormatCode = () => {
    if (editorRef.current) {
      const action = editorRef.current.getAction('editor.action.formatDocument');
      if (action) {
        action.run();
        success('Code formatted');
      } else {
        info('Formatting not supported for this language.');
      }
    }
  };

  // Language switch
  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setCurrentLanguage(newLang);
    if (!projectId && !editorContent.trim()) {
      setEditorContent(DEFAULT_SNIPPETS[newLang] || '');
    }
  };

  // Select File in Explorer
  const handleSelectFile = (file) => {
    if (file.isFolder) return;
    setActiveFile(file);
    setEditorContent(file.content || '');
    setCurrentLanguage(file.language || 'javascript');
  };

  // Create new file or folder in project
  const handleCreateFileOrFolder = async (e) => {
    e.preventDefault();
    if (!newFileName.trim()) return;

    if (!projectId) {
      // Standalone mode local file
      const newFile = {
        id: `standalone-${Date.now()}`,
        name: newFileName.trim(),
        path: `/${newFileName.trim()}`,
        content: '// New file\n',
        language: currentLanguage,
        isFolder: isCreatingFolder,
      };
      setFiles((prev) => [...prev, newFile]);
      if (!isCreatingFolder) {
        setActiveFile(newFile);
        setEditorContent(newFile.content);
      }
      setShowNewFileModal(false);
      setNewFileName('');
      success(`${isCreatingFolder ? 'Folder' : 'File'} created!`);
      return;
    }

    try {
      const res = await api.post(`/projects/${projectId}/files`, {
        name: newFileName.trim(),
        path: `/${newFileName.trim()}`,
        content: isCreatingFolder ? '' : '// New File in CoCode\n',
        language: currentLanguage,
        isFolder: isCreatingFolder,
      });

      if (res.data.success) {
        const created = res.data.data.file;
        setFiles((prev) => [...prev, created]);
        if (!isCreatingFolder) {
          setActiveFile(created);
          setEditorContent(created.content);
        }
        setShowNewFileModal(false);
        setNewFileName('');
        success(`${isCreatingFolder ? 'Folder' : 'File'} created!`);
      }
    } catch (err) {
      toastError(err.response?.data?.message || 'Failed to create file.');
    }
  };

  // Delete file
  const handleDeleteFile = async (fileId, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this file?')) return;

    if (!projectId) {
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      if (activeFile?.id === fileId) {
        const remaining = files.filter((f) => f.id !== fileId);
        setActiveFile(remaining[0] || null);
        setEditorContent(remaining[0]?.content || '');
      }
      return;
    }

    try {
      const res = await api.delete(`/projects/${projectId}/files/${fileId}`);
      if (res.data.success) {
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
        if (activeFile?.id === fileId) {
          const remaining = files.filter((f) => f.id !== fileId && !f.isFolder);
          setActiveFile(remaining[0] || null);
          setEditorContent(remaining[0]?.content || '');
        }
        success('File deleted.');
      }
    } catch (err) {
      toastError('Failed to delete file.');
    }
  };

  // Version snapshot creation
  const handleCreateSnapshot = async (e) => {
    e.preventDefault();
    if (!projectId) {
      info('Save project to dashboard first to track version history.');
      return;
    }

    try {
      const res = await api.post(`/projects/${projectId}/versions`, {
        name: versionName || `Version ${versions.length + 1}`,
      });
      if (res.data.success) {
        success('Version snapshot saved!');
        setVersions((prev) => [res.data.data.version, ...prev]);
        setVersionName('');
      }
    } catch (err) {
      toastError('Failed to save snapshot.');
    }
  };

  // Restore snapshot
  const handleRestoreVersion = async (versionId) => {
    if (!window.confirm('Restore project to this version snapshot? Current unsaved work will be replaced.')) {
      return;
    }

    try {
      const res = await api.post(`/projects/${projectId}/versions/${versionId}/restore`);
      if (res.data.success) {
        success('Version restored!');
        setFiles(res.data.data.files);
        const first = res.data.data.files.find((f) => !f.isFolder);
        if (first) {
          setActiveFile(first);
          setEditorContent(first.content);
        }
        setShowVersionDrawer(false);
      }
    } catch (err) {
      toastError('Failed to restore version snapshot.');
    }
  };

  return (
    <div style={{ height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      {/* Editor Top Control Bar */}
      <div
        style={{
          height: '48px',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          gap: '12px',
        }}
      >
        {/* Left: Project title & Language selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
            {project?.title || 'Standalone Compiler'}
          </span>

          <select
            className="form-select"
            value={currentLanguage}
            onChange={handleLanguageChange}
            style={{ width: '180px', padding: '5px 8px', height: '32px', fontSize: '0.8rem' }}
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        {/* Center: Run & Save actions */}
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

          {projectId && (
            <button onClick={handleSaveFile} className="btn btn-secondary btn-sm" title="Save file to MySQL">
              <Save size={14} />
              <span>Save</span>
            </button>
          )}

          <button onClick={handleFormatCode} className="btn btn-ghost btn-sm" title="Format code">
            <Sparkles size={14} />
            <span>Format</span>
          </button>

          <button
            onClick={() => setOutput('')}
            className="btn btn-ghost btn-sm"
            title="Clear Output"
          >
            <RotateCcw size={14} />
            <span>Clear</span>
          </button>
        </div>

        {/* Right: Themes & Version drawer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            className="form-select"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            style={{ width: '110px', padding: '4px 8px', height: '30px', fontSize: '0.78rem' }}
          >
            <option value="vs-dark">Dark Theme</option>
            <option value="light">Light Theme</option>
            <option value="hc-black">High Contrast</option>
          </select>

          {projectId && (
            <button
              onClick={() => setShowVersionDrawer(!showVersionDrawer)}
              className="btn btn-secondary btn-sm"
              title="Version snapshots"
            >
              <History size={14} />
              <span>Versions</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* File Explorer Sidebar */}
        <div
          style={{
            width: '240px',
            background: 'var(--bg-secondary)',
            borderRight: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '10px 14px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.8rem',
              fontWeight: 700,
              color: 'var(--text-secondary)',
              letterSpacing: '0.05em',
            }}
          >
            <span>FILES</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => {
                  setIsCreatingFolder(false);
                  setShowNewFileModal(true);
                }}
                className="btn btn-ghost btn-sm"
                style={{ padding: '2px 4px' }}
                title="New File"
              >
                <FilePlus size={15} />
              </button>
              <button
                onClick={() => {
                  setIsCreatingFolder(true);
                  setShowNewFileModal(true);
                }}
                className="btn btn-ghost btn-sm"
                style={{ padding: '2px 4px' }}
                title="New Folder"
              >
                <FolderPlus size={15} />
              </button>
            </div>
          </div>

          {/* Files List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {files.map((file) => {
              const isSelected = activeFile?.id === file.id;
              return (
                <div
                  key={file.id}
                  onClick={() => handleSelectFile(file)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 14px',
                    cursor: file.isFolder ? 'default' : 'pointer',
                    backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                    borderLeft: isSelected ? '3px solid var(--accent-primary)' : '3px solid transparent',
                    color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    fontSize: '0.85rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    {file.isFolder ? (
                      <Folder size={15} className="text-amber-400" />
                    ) : (
                      <FileCode size={15} className="text-sky-400" />
                    )}
                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {file.name}
                    </span>
                  </div>

                  {!file.isFolder && files.length > 1 && (
                    <button
                      onClick={(e) => handleDeleteFile(file.id, e)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Monaco Editor Center */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Editor
            height="100%"
            language={currentLanguage === 'cpp' || currentLanguage === 'c' ? 'cpp' : currentLanguage}
            value={editorContent}
            theme={theme}
            onChange={handleEditorChange}
            onMount={handleEditorDidMount}
            options={{
              fontSize,
              fontFamily: "'Fira Code', Consolas, monospace",
              minimap: { enabled: false },
              wordWrap,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              lineNumbers: 'on',
            }}
          />
        </div>

        {/* Output & Stdin Console Panel */}
        <div
          style={{
            width: '380px',
            background: 'var(--bg-secondary)',
            borderLeft: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Console Header Tabs */}
          <div
            style={{
              height: '40px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 12px',
            }}
          >
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setActiveOutputTab('output')}
                className="btn btn-ghost btn-sm"
                style={{
                  fontSize: '0.8rem',
                  padding: '4px 8px',
                  color: activeOutputTab === 'output' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  borderBottom: activeOutputTab === 'output' ? '2px solid var(--accent-primary)' : 'none',
                  borderRadius: 0,
                }}
              >
                Output Console
              </button>
              <button
                onClick={() => setActiveOutputTab('stdin')}
                className="btn btn-ghost btn-sm"
                style={{
                  fontSize: '0.8rem',
                  padding: '4px 8px',
                  color: activeOutputTab === 'stdin' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  borderBottom: activeOutputTab === 'stdin' ? '2px solid var(--accent-primary)' : 'none',
                  borderRadius: 0,
                }}
              >
                Standard Input (stdin)
              </button>
            </div>

            {executionTime && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {executionTime}ms
              </span>
            )}
          </div>

          {/* Console Content */}
          <div style={{ flex: 1, padding: '14px', overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
            {activeOutputTab === 'output' ? (
              <pre
                style={{
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: output.includes('Error') || output.includes('failed') ? '#f87171' : 'var(--text-primary)',
                }}
              >
                {output || 'Click "Run Code" to compile and execute program.'}
              </pre>
            ) : (
              <div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Provide standard input values (e.g. for cin, input(), Scanner):
                </p>
                <textarea
                  className="form-textarea"
                  rows={8}
                  placeholder="Enter inputs here..."
                  value={stdin}
                  onChange={(e) => setStdin(e.target.value)}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Version History Drawer */}
      {showVersionDrawer && (
        <div
          style={{
            position: 'fixed',
            right: 0,
            top: '60px',
            bottom: 0,
            width: '340px',
            background: 'var(--bg-card)',
            borderLeft: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Version History</h3>
            <button
              onClick={() => setShowVersionDrawer(false)}
              className="btn btn-ghost btn-sm"
              style={{ padding: '4px' }}
            >
              &times;
            </button>
          </div>

          <form onSubmit={handleCreateSnapshot} style={{ marginBottom: '20px' }}>
            <div className="form-group" style={{ marginBottom: '8px' }}>
              <input
                type="text"
                placeholder="Snapshot label (e.g. Added BFS)"
                value={versionName}
                onChange={(e) => setVersionName(e.target.value)}
                className="form-input"
                style={{ fontSize: '0.85rem' }}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-sm" style={{ width: '100%' }}>
              <Save size={13} />
              <span>Save Version Snapshot</span>
            </button>
          </form>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px' }}>SAVED SNAPSHOTS</h4>
            {versions.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No snapshots captured yet.</p>
            ) : (
              versions.map((ver) => (
                <div
                  key={ver.id}
                  className="card"
                  style={{ padding: '12px', marginBottom: '10px' }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>{ver.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    {new Date(ver.createdAt).toLocaleString()}
                  </div>
                  <button
                    onClick={() => handleRestoreVersion(ver.id)}
                    className="btn btn-secondary btn-sm"
                    style={{ width: '100%', fontSize: '0.75rem', padding: '4px 8px' }}
                  >
                    Restore This Version
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal: New File or Folder */}
      {showNewFileModal && (
        <div className="modal-overlay" onClick={() => setShowNewFileModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>
              Create New {isCreatingFolder ? 'Folder' : 'File'}
            </h3>
            <form onSubmit={handleCreateFileOrFolder}>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder={isCreatingFolder ? 'e.g. utils' : 'e.g. helper.js or script.py'}
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowNewFileModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditorPage;
