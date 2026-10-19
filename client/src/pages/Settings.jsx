import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  User,
  Shield,
  Bell,
  Palette,
  Lock,
  Camera,
  Check,
  AlertCircle,
  Loader2,
  RotateCcw,
  Sparkles,
  X,
  Upload,
} from "lucide-react";
import Navbar from "../components/Navbar.jsx";
import { useAuth } from "../AuthContext.jsx";
import { DEFAULT_THEME, useTheme } from "../ThemeContext.jsx";
import "./Settings.css";

const PRESET_AVATARS = [
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80",
];

export default function Settings({ defaultTab = "profile" }) {
  const { user, updateProfile } = useAuth();
  const { theme, themes, changeTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Determine initial active tab from props, route path (/settings/profile), or URL query (?tab=...)
  const initialTab = location.pathname.includes("/profile")
    ? "profile"
    : searchParams.get("tab") || defaultTab || "profile";

  const [activeTab, setActiveTab] = useState(initialTab);

  // Form State
  const [name, setName] = useState(user?.name || "Jatin Raghav");
  const [username, setUsername] = useState(user?.username || "jatin-raghav");
  const [phone, setPhone] = useState(user?.phone || "+91 9876543210");
  const [locationField, setLocationField] = useState(user?.location || "Ghaziabad, India");
  const [bio, setBio] = useState(
    user?.bio || "Full Stack Developer • Cloud Computing Enthusiast • DSA in C++"
  );
  const [skillsText, setSkillsText] = useState(
    Array.isArray(user?.skills) && user.skills.length > 0
      ? user.skills.join(", ")
      : "C++, Python, JavaScript, HTML, CSS, React.js, Node.js, MongoDB, Git/GitHub"
  );
  const [github, setGithub] = useState(user?.socialLinks?.github || "jatinraghav22");
  const [linkedin, setLinkedin] = useState(user?.socialLinks?.linkedin || "jatin-raghav-a9a060357");
  const [portfolio, setPortfolio] = useState(user?.socialLinks?.portfolio || "https://jatinraghav.vercel.app/");
  const [avatarUrl, setAvatarUrl] = useState(
    user?.avatarUrl ||
      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80"
  );

  // Status & Feedback
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [tempPhotoUrl, setTempPhotoUrl] = useState("");

  const fileInputRef = useRef(null);
  const successTimeoutRef = useRef(null);

  // Sync state if user context updates from backend
  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setUsername(user.username || "");
      setPhone(user.phone || "");
      setLocationField(user.location || "");
      setBio(user.bio || "");
      if (Array.isArray(user.skills)) {
        setSkillsText(user.skills.join(", "));
      }
      if (user.socialLinks) {
        setGithub(user.socialLinks.github || "");
        setLinkedin(user.socialLinks.linkedin || "");
        setPortfolio(user.socialLinks.portfolio || "");
      }
      if (user.avatarUrl) {
        setAvatarUrl(user.avatarUrl);
      }
    }
  }, [user]);

  // Clean up timer
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
  }, []);

  // Validation
  function validateForm() {
    const errors = {};
    if (!name.trim()) {
      errors.name = "Full name cannot be blank.";
    } else if (name.trim().length < 2) {
      errors.name = "Full name must be at least 2 characters.";
    }

    if (!username.trim()) {
      errors.username = "Username cannot be blank.";
    } else if (!/^[a-zA-Z0-9_-]+$/.test(username.trim().replace(/^@/, ""))) {
      errors.username = "Username can only contain letters, numbers, hyphens, and underscores.";
    }

    if (bio.length > 200) {
      errors.bio = "Bio cannot exceed 200 characters.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // Handle Save
  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!validateForm()) {
      setErrorMessage("Please resolve the validation errors before saving.");
      return;
    }

    setIsSaving(true);

    const parsedSkills = skillsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      name: name.trim(),
      username: username.trim().replace(/^@/, ""),
      phone: phone.trim(),
      location: locationField.trim(),
      bio: bio.trim(),
      skills: parsedSkills,
      socialLinks: {
        github: github.trim(),
        linkedin: linkedin.trim(),
        portfolio: portfolio.trim(),
      },
      avatarUrl: avatarUrl.trim(),
    };

    const result = await updateProfile(payload);

    setIsSaving(false);

    if (result.success) {
      setSuccessMessage("Profile updated successfully!");
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = setTimeout(() => setSuccessMessage(""), 4000);
    } else {
      setErrorMessage(result.error || "Failed to update profile. Please try again.");
    }
  }

  function handleCancel() {
    navigate("/profile");
  }

  // File upload for avatar
  function handleAvatarFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please upload a valid image file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAvatarUrl(reader.result);
      setPhotoModalOpen(false);
    };
    reader.readAsDataURL(file);
  }

  function handleSelectPreset(preset) {
    setAvatarUrl(preset);
    setPhotoModalOpen(false);
  }

  function handleApplyCustomPhotoUrl() {
    if (tempPhotoUrl.trim()) {
      setAvatarUrl(tempPhotoUrl.trim());
      setTempPhotoUrl("");
      setPhotoModalOpen(false);
    }
  }

  return (
    <div className="settings-page-wrapper">
      {/* Consistent Top Navbar across Dashboard, Profile, Settings */}
      <Navbar />

      <main className="settings-page-content">
        <div className="settings-container">
          {/* Back Navigation Button */}
          <div className="settings-breadcrumbs">
            <Link to="/dashboard" className="back-to-dashboard-btn">
              <ArrowLeft size={16} />
              <span>Back to Dashboard</span>
            </Link>
          </div>

          {/* Page Heading */}
          <header className="settings-heading-section">
            <h1 className="settings-title">Settings</h1>
            <p className="settings-subtitle">Manage your account settings and preferences.</p>
          </header>

          {/* Settings Grid Layout: Tabs Sidebar + Main Form */}
          <div className="settings-layout-grid">
            {/* Left Vertical Tabs Sidebar */}
            <aside className="settings-tabs-sidebar glass-panel">
              <nav className="settings-nav-list" aria-label="Settings categories">
                <button
                  type="button"
                  className={`settings-tab-btn ${activeTab === "profile" ? "active" : ""}`}
                  onClick={() => setActiveTab("profile")}
                >
                  <User size={18} />
                  <span>Profile</span>
                </button>

                <button
                  type="button"
                  className={`settings-tab-btn ${activeTab === "security" ? "active" : ""}`}
                  onClick={() => setActiveTab("security")}
                >
                  <Shield size={18} />
                  <span>Security</span>
                </button>

                <button
                  type="button"
                  className={`settings-tab-btn ${activeTab === "notifications" ? "active" : ""}`}
                  onClick={() => setActiveTab("notifications")}
                >
                  <Bell size={18} />
                  <span>Notifications</span>
                </button>

                <button
                  type="button"
                  className={`settings-tab-btn ${activeTab === "appearance" ? "active" : ""}`}
                  onClick={() => setActiveTab("appearance")}
                >
                  <Palette size={18} />
                  <span>Appearance</span>
                </button>

                <button
                  type="button"
                  className={`settings-tab-btn ${activeTab === "privacy" ? "active" : ""}`}
                  onClick={() => setActiveTab("privacy")}
                >
                  <Lock size={18} />
                  <span>Privacy</span>
                </button>
              </nav>

              <div className="settings-sidebar-tip">
                <Sparkles size={16} className="tip-sparkle-icon" />
                <strong>Need Help?</strong>
                <p>Have questions about account security or configuration? Visit our support portal.</p>
              </div>
            </aside>

            {/* Right Tab Content Panel */}
            <section className="settings-content-panel glass-panel">
              {/* TAB 1: PROFILE SETTINGS */}
              {activeTab === "profile" && (
                <div className="tab-pane-profile">
                  <div className="panel-header-row">
                    <div>
                      <h2 className="panel-title">Profile Settings</h2>
                      <p className="panel-desc">Update your personal information.</p>
                    </div>

                    {/* Change Photo Component */}
                    <div className="change-photo-box">
                      <div className="avatar-preview-circle">
                        <img
                          src={avatarUrl}
                          alt="Avatar preview"
                          className="preview-img"
                          onError={(e) => {
                            e.target.style.display = "none";
                          }}
                        />
                        <span className="preview-fallback">{name.slice(0, 1)}</span>
                      </div>
                      <button
                        type="button"
                        className="btn-change-photo"
                        onClick={() => setPhotoModalOpen(true)}
                      >
                        <Camera size={14} />
                        <span>Change Photo</span>
                      </button>
                    </div>
                  </div>

                  {/* Feedback Banners */}
                  {successMessage && (
                    <div className="feedback-banner success-banner" role="status">
                      <Check size={18} />
                      <span>{successMessage}</span>
                    </div>
                  )}

                  {errorMessage && (
                    <div className="feedback-banner error-banner" role="alert">
                      <AlertCircle size={18} />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Profile Edit Form */}
                  <form className="profile-edit-form" onSubmit={handleSubmit}>
                    <div className="form-grid-two-col">
                      {/* Full Name */}
                      <div className="form-group">
                        <label htmlFor="input-fullname" className="form-label">
                          Full Name <span className="required-star">*</span>
                        </label>
                        <input
                          id="input-fullname"
                          type="text"
                          className={`form-input ${fieldErrors.name ? "input-error" : ""}`}
                          value={name}
                          onChange={(e) => {
                            setName(e.target.value);
                            if (fieldErrors.name) setFieldErrors({ ...fieldErrors, name: null });
                          }}
                          placeholder="Your full name"
                          disabled={isSaving}
                        />
                        {fieldErrors.name && (
                          <span className="field-error-text">{fieldErrors.name}</span>
                        )}
                      </div>

                      {/* Username */}
                      <div className="form-group">
                        <label htmlFor="input-username" className="form-label">
                          Username <span className="required-star">*</span>
                        </label>
                        <input
                          id="input-username"
                          type="text"
                          className={`form-input ${fieldErrors.username ? "input-error" : ""}`}
                          value={username}
                          onChange={(e) => {
                            setUsername(e.target.value);
                            if (fieldErrors.username)
                              setFieldErrors({ ...fieldErrors, username: null });
                          }}
                          placeholder="username"
                          disabled={isSaving}
                        />
                        {fieldErrors.username && (
                          <span className="field-error-text">{fieldErrors.username}</span>
                        )}
                      </div>

                      {/* Email Address (Read-only for security) */}
                      <div className="form-group">
                        <label htmlFor="input-email" className="form-label">
                          Email Address
                        </label>
                        <input
                          id="input-email"
                          type="email"
                          className="form-input input-disabled"
                          value={user?.email || "jatinraghav22@gmail.com"}
                          disabled
                          title="Contact support to update your registered email address"
                        />
                        <span className="field-hint-text">
                          Email address is verified and tied to authentication.
                        </span>
                      </div>

                      {/* Phone Number */}
                      <div className="form-group">
                        <label htmlFor="input-phone" className="form-label">
                          Phone Number
                        </label>
                        <input
                          id="input-phone"
                          type="text"
                          className="form-input"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+91 9876543210"
                          disabled={isSaving}
                        />
                      </div>
                    </div>

                    {/* Location */}
                    <div className="form-group form-group-full">
                      <label htmlFor="input-location" className="form-label">
                        Location
                      </label>
                      <input
                        id="input-location"
                        type="text"
                        className="form-input"
                        value={locationField}
                        onChange={(e) => setLocationField(e.target.value)}
                        placeholder="City, Country"
                        disabled={isSaving}
                      />
                    </div>

                    {/* Bio with Character Count */}
                    <div className="form-group form-group-full">
                      <div className="label-with-counter">
                        <label htmlFor="input-bio" className="form-label">
                          Bio
                        </label>
                        <span
                          className={`char-counter ${bio.length > 200 ? "counter-over" : ""}`}
                        >
                          {bio.length}/200
                        </span>
                      </div>
                      <textarea
                        id="input-bio"
                        rows={3}
                        className={`form-textarea ${fieldErrors.bio ? "input-error" : ""}`}
                        value={bio}
                        onChange={(e) => {
                          setBio(e.target.value);
                          if (fieldErrors.bio) setFieldErrors({ ...fieldErrors, bio: null });
                        }}
                        placeholder="Brief description about yourself and your tech stack..."
                        disabled={isSaving}
                      />
                      {fieldErrors.bio && (
                        <span className="field-error-text">{fieldErrors.bio}</span>
                      )}
                    </div>

                    {/* Skills & Technologies */}
                    <div className="form-group form-group-full">
                      <label htmlFor="input-skills" className="form-label">
                        Skills & Technologies <span className="field-hint-inline">(comma-separated)</span>
                      </label>
                      <input
                        id="input-skills"
                        type="text"
                        className="form-input"
                        value={skillsText}
                        onChange={(e) => setSkillsText(e.target.value)}
                        placeholder="C++, Python, JavaScript, React.js, Node.js"
                        disabled={isSaving}
                      />
                      {/* Live Skills Preview */}
                      <div className="skills-live-preview">
                        {skillsText
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean)
                          .map((skill) => (
                            <span key={skill} className="preview-pill">
                              {skill}
                            </span>
                          ))}
                      </div>
                    </div>

                    {/* Social Links Section */}
                    <div className="form-section-divider">
                      <h3 className="section-divider-title">Social Links</h3>
                    </div>

                    <div className="form-grid-three-col">
                      <div className="form-group">
                        <label htmlFor="input-github" className="form-label">
                          GitHub Username
                        </label>
                        <input
                          id="input-github"
                          type="text"
                          className="form-input"
                          value={github}
                          onChange={(e) => setGithub(e.target.value)}
                          placeholder="jatinraghav22"
                          disabled={isSaving}
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="input-linkedin" className="form-label">
                          LinkedIn Username / Handle
                        </label>
                        <input
                          id="input-linkedin"
                          type="text"
                          className="form-input"
                          value={linkedin}
                          onChange={(e) => setLinkedin(e.target.value)}
                          placeholder="jatin-raghav-a9a060357"
                          disabled={isSaving}
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="input-portfolio" className="form-label">
                          Portfolio Website URL
                        </label>
                        <input
                          id="input-portfolio"
                          type="text"
                          className="form-input"
                          value={portfolio}
                          onChange={(e) => setPortfolio(e.target.value)}
                          placeholder="https://jatinraghav.vercel.app/"
                          disabled={isSaving}
                        />
                      </div>
                    </div>

                    {/* Action Buttons: Save Changes & Cancel */}
                    <div className="form-actions-row">
                      <button
                        type="submit"
                        className="btn-save-changes"
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <>
                            <Loader2 size={16} className="btn-spinner-icon" />
                            <span>Saving Changes...</span>
                          </>
                        ) : (
                          <span>Save Changes</span>
                        )}
                      </button>

                      <button
                        type="button"
                        className="btn-cancel-changes"
                        onClick={handleCancel}
                        disabled={isSaving}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* TAB 2: SECURITY */}
              {activeTab === "security" && (
                <div className="tab-pane-general">
                  <h2 className="panel-title">Security Settings</h2>
                  <p className="panel-desc">Manage your authentication and password.</p>

                  <div className="security-notice-card">
                    <Shield size={20} className="security-icon" />
                    <div>
                      <strong>Session Protected</strong>
                      <p>Your session is active with encrypted scrypt password verification.</p>
                    </div>
                  </div>

                  <div className="form-group form-group-spaced">
                    <label className="form-label">Current Password</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="••••••••••••"
                      disabled
                    />
                  </div>

                  <div className="form-group form-group-spaced">
                    <label className="form-label">Two-Factor Authentication</label>
                    <p className="field-hint-text">Two-factor auth is enabled for this environment.</p>
                  </div>
                </div>
              )}

              {/* TAB 3: NOTIFICATIONS */}
              {activeTab === "notifications" && (
                <div className="tab-pane-general">
                  <h2 className="panel-title">Notification Preferences</h2>
                  <p className="panel-desc">Configure in-app alerts and email notifications.</p>

                  <div className="toggle-list">
                    <div className="toggle-row">
                      <div>
                        <strong>Collaboration Invitations</strong>
                        <p>Receive notifications when peers invite you to a room.</p>
                      </div>
                      <input type="checkbox" defaultChecked className="toggle-checkbox" />
                    </div>

                    <div className="toggle-row">
                      <div>
                        <strong>Compiler Runtime Updates</strong>
                        <p>Alerts when new programming language SDKs are deployed.</p>
                      </div>
                      <input type="checkbox" defaultChecked className="toggle-checkbox" />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: APPEARANCE (5 Themes Switcher) */}
              {activeTab === "appearance" && (
                <div className="tab-pane-appearance">
                  <div className="panel-header-row">
                    <div>
                      <h2 className="panel-title">Color Themes</h2>
                      <p className="panel-desc">Choose one of the 5 curated CoCode themes.</p>
                    </div>
                    <button
                      className="settings-reset-btn"
                      type="button"
                      onClick={() => changeTheme(DEFAULT_THEME)}
                    >
                      <RotateCcw size={14} />
                      <span>Reset Default</span>
                    </button>
                  </div>

                  <div className="theme-card-grid">
                    {themes.map((item) => {
                      const isSelected = theme === item.id;
                      return (
                        <button
                          type="button"
                          key={item.id}
                          className={`theme-choice-box ${isSelected ? "selected" : ""}`}
                          aria-pressed={isSelected}
                          onClick={() => changeTheme(item.id)}
                          style={{
                            "--preview-bg": item.tokens.bg,
                            "--preview-surface": item.tokens.surface,
                            "--preview-primary": item.tokens.primary,
                            "--preview-accent": item.tokens.accent,
                          }}
                        >
                          <div className="theme-mini-viewport" aria-hidden="true">
                            <div className="mini-viewport-top">
                              <span />
                              <span />
                              <span />
                            </div>
                            <div className="mini-viewport-body">
                              <div className="mini-viewport-sidebar" />
                              <div className="mini-viewport-content">
                                <div className="mini-line heading" />
                                <div className="mini-line text" />
                                <div className="mini-line text short" />
                              </div>
                            </div>
                          </div>

                          <div className="theme-choice-label">
                            <strong>{item.name}</strong>
                            {isSelected && <Check size={14} className="theme-check-icon" />}
                          </div>
                          <span className="theme-choice-desc">{item.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 5: PRIVACY */}
              {activeTab === "privacy" && (
                <div className="tab-pane-general">
                  <h2 className="panel-title">Privacy Controls</h2>
                  <p className="panel-desc">Control what profile details are visible to collaborators.</p>

                  <div className="toggle-list">
                    <div className="toggle-row">
                      <div>
                        <strong>Show Profile in Public Rooms</strong>
                        <p>Allow other developers in shared rooms to see your avatar and skills.</p>
                      </div>
                      <input type="checkbox" defaultChecked className="toggle-checkbox" />
                    </div>

                    <div className="toggle-row">
                      <div>
                        <strong>Display Coding Statistics</strong>
                        <p>Share language breakdown and activity stats on your public profile.</p>
                      </div>
                      <input type="checkbox" defaultChecked className="toggle-checkbox" />
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      {/* Change Photo Modal */}
      {photoModalOpen && (
        <div className="modal-backdrop" onClick={() => setPhotoModalOpen(false)}>
          <div
            className="photo-modal-card glass-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header-row">
              <h3>Change Profile Photo</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setPhotoModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body-content">
              {/* Option A: Pick Preset */}
              <div className="modal-section-label">Choose an Avatar</div>
              <div className="preset-avatars-grid">
                {PRESET_AVATARS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`preset-btn ${avatarUrl === preset ? "selected" : ""}`}
                    onClick={() => handleSelectPreset(preset)}
                  >
                    <img src={preset} alt={`Preset ${idx + 1}`} />
                  </button>
                ))}
              </div>

              {/* Option B: Upload File */}
              <div className="modal-section-label">Or Upload an Image</div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden-file-input"
                onChange={handleAvatarFileUpload}
                style={{ display: "none" }}
              />
              <button
                type="button"
                className="btn-upload-file"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={16} />
                <span>Upload From Device</span>
              </button>

              {/* Option C: Image URL */}
              <div className="modal-section-label">Or Enter Image URL</div>
              <div className="photo-url-input-group">
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://example.com/avatar.jpg"
                  value={tempPhotoUrl}
                  onChange={(e) => setTempPhotoUrl(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-apply-url"
                  onClick={handleApplyCustomPhotoUrl}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
