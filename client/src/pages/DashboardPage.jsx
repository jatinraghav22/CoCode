import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import {
  FolderPlus,
  Users,
  Terminal,
  Plus,
  Play,
  FileCode,
  Clock,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  Search,
  Sparkles,
  Layers,
  Calendar,
} from 'lucide-react';

const DashboardPage = () => {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showNewRoomModal, setShowNewRoomModal] = useState(false);
  const [showJoinRoomModal, setShowJoinRoomModal] = useState(false);

  // Form states
  const [projectForm, setProjectForm] = useState({ title: '', description: '', language: 'javascript' });
  const [roomForm, setRoomForm] = useState({ name: '', description: '', projectId: '' });
  const [joinCode, setJoinCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [projRes, roomRes] = await Promise.all([
        api.get('/projects'),
        api.get('/rooms'),
      ]);
      if (projRes.data.success) setProjects(projRes.data.data.projects);
      if (roomRes.data.success) setRooms(roomRes.data.data.rooms);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      toastError('Could not load workspace data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!projectForm.title.trim()) {
      toastError('Project title is required.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/projects', projectForm);
      if (res.data.success) {
        success('Project created successfully!');
        setShowNewProjectModal(false);
        setProjectForm({ title: '', description: '', language: 'javascript' });
        navigate(`/editor/${res.data.data.project.id}`);
      }
    } catch (err) {
      toastError(err.response?.data?.message || 'Failed to create project.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProject = async (projectId, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this project? All files will be permanently removed.')) {
      return;
    }

    try {
      const res = await api.delete(`/projects/${projectId}`);
      if (res.data.success) {
        success('Project deleted.');
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
      }
    } catch (err) {
      toastError(err.response?.data?.message || 'Failed to delete project.');
    }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!roomForm.name.trim()) {
      toastError('Room name is required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: roomForm.name,
        description: roomForm.description,
        ...(roomForm.projectId && { projectId: roomForm.projectId }),
      };
      const res = await api.post('/rooms', payload);
      if (res.data.success) {
        success(`Room "${res.data.data.room.name}" created!`);
        setShowNewRoomModal(false);
        setRoomForm({ name: '', description: '', projectId: '' });
        navigate(`/room/${res.data.data.room.roomCode}`);
      }
    } catch (err) {
      toastError(err.response?.data?.message || 'Failed to create room.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) {
      toastError('Please enter a room code.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/rooms/join', { roomCode: joinCode.trim() });
      if (res.data.success) {
        success('Joined room!');
        setShowJoinRoomModal(false);
        navigate(`/room/${res.data.data.room.roomCode}`);
      }
    } catch (err) {
      toastError(err.response?.data?.message || 'Room code not found or invalid.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCode = (code, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    success(`Copied room code: ${code}`);
    setTimeout(() => setCopiedCode(''), 3000);
  };

  const filteredProjects = projects.filter(
    (p) =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '32px 24px', minHeight: 'calc(100vh - 60px)' }}>
      {/* Welcome Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '20px',
          marginBottom: '36px',
          paddingBottom: '24px',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div>
          <h1 style={{ fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span>Welcome back, {user?.name || 'Developer'}!</span>
            <span className="badge badge-blue">Online</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
            Ready to build? Open the compiler immediately or create a real-time room to collaborate.
          </p>
        </div>

        {/* Primary Quick Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {/* Quick Compiler */}
          <Link to="/editor" className="btn btn-secondary">
            <Terminal size={17} className="text-sky-400" />
            <span>Open Standalone Compiler</span>
          </Link>

          {/* New Project */}
          <button onClick={() => setShowNewProjectModal(true)} className="btn btn-secondary">
            <FolderPlus size={17} />
            <span>New Project</span>
          </button>

          {/* Create Room */}
          <button onClick={() => setShowNewRoomModal(true)} className="btn btn-primary">
            <Users size={17} />
            <span>Create Collab Room</span>
          </button>

          {/* Join with Code */}
          <button onClick={() => setShowJoinRoomModal(true)} className="btn btn-secondary">
            <span>Join with Code</span>
          </button>
        </div>
      </div>

      {/* Stats Counter Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '20px',
          marginBottom: '36px',
        }}
      >
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>SAVED PROJECTS</span>
            <FileCode size={20} className="text-sky-400" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px' }}>{projects.length}</div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>COLLABORATION ROOMS</span>
            <Users size={20} className="text-emerald-400" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px' }}>{rooms.length}</div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>RUNTIMES AVAILABLE</span>
            <Play size={20} className="text-amber-400" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px' }}>50+</div>
        </div>
      </div>

      {/* Projects Section */}
      <div style={{ marginBottom: '48px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.4rem' }}>Your Projects</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Persistent multi-file workspaces stored in your MySQL database
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: '220px' }}>
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '32px', height: '36px', fontSize: '0.85rem' }}
              />
              <Search
                size={14}
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
              />
            </div>
            <button onClick={() => setShowNewProjectModal(true)} className="btn btn-secondary btn-sm">
              <Plus size={15} />
              <span>New</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
            Loading your projects...
          </div>
        ) : filteredProjects.length === 0 ? (
          <div
            className="card"
            style={{
              textAlign: 'center',
              padding: '48px 24px',
              borderStyle: 'dashed',
            }}
          >
            <Layers size={36} style={{ margin: '0 auto 12px auto', color: 'var(--text-muted)' }} />
            <h3 style={{ fontSize: '1.1rem', marginBottom: '6px' }}>No projects found</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
              {searchQuery ? 'Try matching another search term.' : 'Create your first multi-file project to get started.'}
            </p>
            <button onClick={() => setShowNewProjectModal(true)} className="btn btn-primary btn-sm">
              <FolderPlus size={15} />
              <span>Create Project</span>
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '20px',
            }}
          >
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                className="card"
                onClick={() => navigate(`/editor/${project.id}`)}
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '20px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileCode size={18} className="text-sky-400" />
                      <h3 style={{ fontSize: '1.05rem', margin: 0 }}>{project.title}</h3>
                    </div>
                    <button
                      onClick={(e) => handleDeleteProject(project.id, e)}
                      className="btn btn-ghost btn-sm"
                      title="Delete Project"
                      style={{ padding: '4px', color: 'var(--text-muted)' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <p
                    style={{
                      color: 'var(--text-secondary)',
                      fontSize: '0.85rem',
                      marginBottom: '16px',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {project.description || 'No description provided.'}
                  </p>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '12px',
                    borderTop: '1px solid var(--border-color)',
                    fontSize: '0.78rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  <span>{project._count?.files || 0} files</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} />
                    {new Date(project.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Collaboration Rooms Section */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.4rem' }}>Collaboration Rooms</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Real-time multi-user coding spaces with synchronized editor, chat & whiteboard
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setShowJoinRoomModal(true)} className="btn btn-secondary btn-sm">
              <span>Join with Code</span>
            </button>
            <button onClick={() => setShowNewRoomModal(true)} className="btn btn-primary btn-sm">
              <Users size={15} />
              <span>New Room</span>
            </button>
          </div>
        </div>

        {rooms.length === 0 ? (
          <div
            className="card"
            style={{
              textAlign: 'center',
              padding: '40px 24px',
              borderStyle: 'dashed',
            }}
          >
            <Users size={36} style={{ margin: '0 auto 12px auto', color: 'var(--text-muted)' }} />
            <h3 style={{ fontSize: '1.1rem', marginBottom: '6px' }}>No active rooms</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '18px' }}>
              Create a collaboration room to invite friends or teammates with a unique room code.
            </p>
            <button onClick={() => setShowNewRoomModal(true)} className="btn btn-primary btn-sm">
              <Users size={15} />
              <span>Create Collaboration Room</span>
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '20px',
            }}
          >
            {rooms.map((room) => (
              <div
                key={room.id}
                className="card"
                onClick={() => navigate(`/room/${room.roomCode}`)}
                style={{
                  cursor: 'pointer',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{room.name}</h3>
                    <div
                      className="badge badge-blue"
                      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={(e) => handleCopyCode(room.roomCode, e)}
                      title="Click to copy room code"
                    >
                      <span>{room.roomCode}</span>
                      {copiedCode === room.roomCode ? <Check size={11} /> : <Copy size={11} />}
                    </div>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
                    {room.description || 'Live collaborative workspace'}
                  </p>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '12px',
                    borderTop: '1px solid var(--border-color)',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Users size={13} />
                    {room._count?.members || 1} participants
                  </span>
                  <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Enter Room &rarr;</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: New Project */}
      {showNewProjectModal && (
        <div className="modal-overlay" onClick={() => setShowNewProjectModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '1.3rem', marginBottom: '8px' }}>Create New Project</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>
              Start a new workspace with files and directory structure
            </p>

            <form onSubmit={handleCreateProject}>
              <div className="form-group">
                <label className="form-label">Project Title</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Binary Search Tree or REST API"
                  value={projectForm.title}
                  onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description (optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Brief summary of your project"
                  value={projectForm.description}
                  onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Default Starter Language</label>
                <select
                  className="form-select"
                  value={projectForm.language}
                  onChange={(e) => setProjectForm({ ...projectForm, language: e.target.value })}
                >
                  <option value="javascript">JavaScript (Node.js)</option>
                  <option value="python">Python 3</option>
                  <option value="cpp">C++ (GCC 10.2)</option>
                  <option value="java">Java (OpenJDK 15)</option>
                  <option value="c">C (GCC)</option>
                  <option value="html">HTML / CSS / Web</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowNewProjectModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Room */}
      {showNewRoomModal && (
        <div className="modal-overlay" onClick={() => setShowNewRoomModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '1.3rem', marginBottom: '8px' }}>Create Collaboration Room</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>
              Create a shared room code to code with teammates in real time
            </p>

            <form onSubmit={handleCreateRoom}>
              <div className="form-group">
                <label className="form-label">Room Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Algo Pair Programming"
                  value={roomForm.name}
                  onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description (optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Tackling LeetCode Hard problems"
                  value={roomForm.description}
                  onChange={(e) => setRoomForm({ ...roomForm, description: e.target.value })}
                />
              </div>

              {projects.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Link Existing Project (optional)</label>
                  <select
                    className="form-select"
                    value={roomForm.projectId}
                    onChange={(e) => setRoomForm({ ...roomForm, projectId: e.target.value })}
                  >
                    <option value="">-- Create Fresh Empty Room --</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowNewRoomModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Join Room with Code */}
      {showJoinRoomModal && (
        <div className="modal-overlay" onClick={() => setShowJoinRoomModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '1.3rem', marginBottom: '8px' }}>Join Collaboration Room</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>
              Enter the unique room code shared by your teammate
            </p>

            <form onSubmit={handleJoinRoom}>
              <div className="form-group">
                <label className="form-label">Room Code</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. CO-8924"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  required
                  autoFocus
                  style={{
                    letterSpacing: '0.15em',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowJoinRoomModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                  {submitting ? 'Joining...' : 'Enter Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
