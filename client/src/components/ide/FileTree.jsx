import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FileJson,
  Plus,
  FilePlus,
  FolderPlus,
  Edit2,
  Trash2,
  Copy,
  ExternalLink,
} from "lucide-react";

/**
 * Builds a nested tree structure from a flat list of files/folders.
 */
function buildTree(files) {
  const root = { name: "", path: "", isFolder: true, children: [] };
  const folderMap = new Map();
  folderMap.set("", root);

  // First pass: register all folders
  files.forEach((f) => {
    if (f.isFolder) {
      const cleanPath = f.path.startsWith("/") ? f.path : `/${f.path}`;
      if (!folderMap.has(cleanPath)) {
        folderMap.set(cleanPath, {
          name: f.name || cleanPath.split("/").pop(),
          path: cleanPath,
          isFolder: true,
          children: [],
        });
      }
    } else {
      // Derive intermediate folders from file path
      const parts = f.path.split("/").filter(Boolean);
      let currentPath = "";
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath += `/${parts[i]}`;
        if (!folderMap.has(currentPath)) {
          folderMap.set(currentPath, {
            name: parts[i],
            path: currentPath,
            isFolder: true,
            children: [],
          });
        }
      }
    }
  });

  // Second pass: link folders into hierarchy
  folderMap.forEach((folder, folderPath) => {
    if (folderPath === "") return;
    const parentPath = folderPath.substring(0, folderPath.lastIndexOf("/"));
    const parent = folderMap.get(parentPath) || root;
    if (!parent.children.some((c) => c.path === folder.path)) {
      parent.children.push(folder);
    }
  });

  // Third pass: place files into their parent folders (ignoring internal marker files)
  files.forEach((f) => {
    if (f.isFolder || f.name === ".cocode-keep") return;
    const cleanPath = f.path.startsWith("/") ? f.path : `/${f.path}`;
    const parentPath = cleanPath.substring(0, cleanPath.lastIndexOf("/"));
    const parent = folderMap.get(parentPath) || root;

    parent.children.push({
      id: f.id,
      name: f.name,
      path: cleanPath,
      language: f.language,
      content: f.content,
      isFolder: false,
      file: f,
    });
  });

  // Recursive sort: folders first, then files alphabetically
  function sortNode(node) {
    node.children.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
    node.children.forEach((child) => {
      if (child.isFolder) sortNode(child);
    });
  }

  sortNode(root);
  return root.children;
}

function getFileIcon(filename = "", language = "") {
  const lower = filename.toLowerCase();
  const lang = (language || "").toLowerCase();

  if (lower.endsWith(".json")) {
    return <FileJson size={14} className="ide-file-icon text-amber" />;
  }
  if (lower.endsWith(".md") || lower.endsWith(".txt")) {
    return <FileText size={14} className="ide-file-icon text-slate" />;
  }
  if (
    lower.endsWith(".js") ||
    lower.endsWith(".jsx") ||
    lower.endsWith(".mjs") ||
    lower.endsWith(".cjs") ||
    lang === "javascript"
  ) {
    return <FileCode size={14} className="ide-file-icon text-yellow" />;
  }
  if (lower.endsWith(".ts") || lower.endsWith(".tsx") || lang === "typescript") {
    return <FileCode size={14} className="ide-file-icon text-blue" />;
  }
  if (lower.endsWith(".py") || lang === "python") {
    return <FileCode size={14} className="ide-file-icon text-cyan" />;
  }
  if (lower.endsWith(".cpp") || lower.endsWith(".cc") || lower.endsWith(".h") || lang === "cpp") {
    return <FileCode size={14} className="ide-file-icon text-indigo" />;
  }
  if (lower.endsWith(".c") || lang === "c") {
    return <FileCode size={14} className="ide-file-icon text-indigo" />;
  }
  if (lower.endsWith(".html") || lower.endsWith(".htm") || lang === "html") {
    return <FileCode size={14} className="ide-file-icon text-orange" />;
  }
  if (lower.endsWith(".css") || lang === "css") {
    return <FileCode size={14} className="ide-file-icon text-pink" />;
  }
  if (lower.endsWith(".java") || lang === "java") {
    return <FileCode size={14} className="ide-file-icon text-purple" />;
  }
  return <FileCode size={14} className="ide-file-icon text-slate" />;
}

export default function FileTree({
  files,
  activeFileId,
  dirtyFiles = {},
  expandedFolders = {},
  onToggleFolder,
  onOpenFile,
  onCreateFile,
  onCreateFolder,
  onRenameItem,
  onDeleteItem,
  onRefresh,
}) {
  const [contextMenu, setContextMenu] = useState(null); // { x, y, item, isFolder }
  const [renamingPath, setRenamingPath] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [creatingIn, setCreatingIn] = useState(null); // { parentPath, isFolder }
  const [newChildName, setNewChildName] = useState("");

  const menuRef = useRef(null);
  const treeContainerRef = useRef(null);

  // Close context menu on external click
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setContextMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const treeData = useMemo(() => buildTree(files), [files]);

  function handleContextMenu(e, item) {
    e.preventDefault();
    e.stopPropagation();

    const rect = treeContainerRef.current?.getBoundingClientRect();
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 220);

    setContextMenu({
      x,
      y,
      item,
      isFolder: Boolean(item?.isFolder),
    });
  }

  function handleBackgroundContextMenu(e) {
    e.preventDefault();
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 220);
    setContextMenu({
      x,
      y,
      item: null,
      isFolder: true,
      isRoot: true,
    });
  }

  function startRename(item) {
    setRenamingPath(item.path);
    setRenameValue(item.name);
    setContextMenu(null);
  }

  function submitRename(item) {
    if (renameValue.trim() && renameValue.trim() !== item.name) {
      onRenameItem(item, renameValue.trim());
    }
    setRenamingPath(null);
    setRenameValue("");
  }

  function submitCreate() {
    if (!newChildName.trim() || !creatingIn) {
      setCreatingIn(null);
      setNewChildName("");
      return;
    }
    const cleanName = newChildName.trim();
    if (creatingIn.isFolder) {
      onCreateFolder(creatingIn.parentPath, cleanName);
    } else {
      onCreateFile(creatingIn.parentPath, cleanName);
    }
    setCreatingIn(null);
    setNewChildName("");
  }

  function copyPath(path) {
    navigator.clipboard.writeText(path);
    setContextMenu(null);
  }

  function renderInlineCreateInput(depth = 0) {
    if (!creatingIn) return null;
    return (
      <div
        className="ide-tree-row inline-create"
        style={{ paddingLeft: `${16 + depth * 14}px` }}
        onClick={(e) => e.stopPropagation()}
      >
        {creatingIn.isFolder ? (
          <Folder size={14} className="ide-folder-icon" />
        ) : (
          <FileCode size={14} className="ide-file-icon" />
        )}
        <input
          autoFocus
          className="ide-tree-input"
          placeholder={creatingIn.isFolder ? "folder-name..." : "file-name.js..."}
          value={newChildName}
          onChange={(e) => setNewChildName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitCreate();
            if (e.key === "Escape") {
              setCreatingIn(null);
              setNewChildName("");
            }
          }}
          onBlur={submitCreate}
        />
      </div>
    );
  }

  function renderNode(node, depth = 0) {
    if (node.isFolder) {
      const isExpanded = Boolean(expandedFolders[node.path]);
      const isRenaming = renamingPath === node.path;
      const isCreatingHere = creatingIn && creatingIn.parentPath === node.path;

      return (
        <div key={node.path} className="ide-tree-folder-group">
          <div
            className="ide-tree-row folder-row"
            style={{ paddingLeft: `${12 + depth * 14}px` }}
            onClick={() => onToggleFolder(node.path)}
            onContextMenu={(e) => handleContextMenu(e, node)}
            title={node.path}
          >
            <span className="ide-tree-chevron">
              {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </span>
            {isExpanded ? (
              <FolderOpen size={14} className="ide-folder-icon text-sky" />
            ) : (
              <Folder size={14} className="ide-folder-icon text-sky" />
            )}

            {isRenaming ? (
              <input
                autoFocus
                className="ide-tree-input"
                value={renameValue}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitRename(node);
                  if (e.key === "Escape") setRenamingPath(null);
                }}
                onBlur={() => submitRename(node)}
              />
            ) : (
              <span className="ide-tree-label">{node.name}</span>
            )}

            <div className="ide-tree-row-actions">
              <button
                type="button"
                className="ide-tree-quick-btn"
                title="New File Inside"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFolder(node.path, true);
                  setCreatingIn({ parentPath: node.path, isFolder: false });
                }}
              >
                <FilePlus size={12} />
              </button>
              <button
                type="button"
                className="ide-tree-quick-btn"
                title="New Folder Inside"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFolder(node.path, true);
                  setCreatingIn({ parentPath: node.path, isFolder: true });
                }}
              >
                <FolderPlus size={12} />
              </button>
            </div>
          </div>

          {/* Children nodes if expanded */}
          {isExpanded && (
            <div className="ide-tree-children">
              {isCreatingHere && renderInlineCreateInput(depth + 1)}
              {node.children.length === 0 && !isCreatingHere ? (
                <div
                  className="ide-tree-empty-folder"
                  style={{ paddingLeft: `${28 + depth * 14}px` }}
                >
                  (empty folder)
                </div>
              ) : (
                node.children.map((child) => renderNode(child, depth + 1))
              )}
            </div>
          )}
        </div>
      );
    }

    // File Node
    const isActive = activeFileId === node.id;
    const isDirty = Boolean(dirtyFiles[node.id]);
    const isRenaming = renamingPath === node.path;

    return (
      <div
        key={node.path || node.id}
        className={`ide-tree-row file-row ${isActive ? "active" : ""}`}
        style={{ paddingLeft: `${24 + depth * 14}px` }}
        onClick={() => onOpenFile(node.file || node)}
        onContextMenu={(e) => handleContextMenu(e, node)}
        title={node.path}
      >
        {getFileIcon(node.name, node.language)}

        {isRenaming ? (
          <input
            autoFocus
            className="ide-tree-input"
            value={renameValue}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRename(node);
              if (e.key === "Escape") setRenamingPath(null);
            }}
            onBlur={() => submitRename(node)}
          />
        ) : (
          <span className="ide-tree-label">{node.name}</span>
        )}

        {isDirty && <span className="ide-tree-dirty-dot" title="Unsaved changes" />}

        <div className="ide-tree-row-actions">
          <button
            type="button"
            className="ide-tree-quick-btn"
            title="Rename"
            onClick={(e) => {
              e.stopPropagation();
              startRename(node);
            }}
          >
            <Edit2 size={11} />
          </button>
          <button
            type="button"
            className="ide-tree-quick-btn danger"
            title="Delete"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteItem(node);
            }}
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="ide-filetree-container"
      ref={treeContainerRef}
      onContextMenu={handleBackgroundContextMenu}
    >
      {/* Root inline creation if active at top-level */}
      {creatingIn && creatingIn.parentPath === "" && renderInlineCreateInput(0)}

      {/* Render tree */}
      {treeData.length === 0 && !creatingIn ? (
        <div className="ide-tree-empty-state">
          <p>No files in project yet.</p>
          <button
            type="button"
            className="ide-btn-create-sample"
            onClick={() => setCreatingIn({ parentPath: "", isFolder: false })}
          >
            <Plus size={14} />
            <span>Create First File</span>
          </button>
        </div>
      ) : (
        treeData.map((node) => renderNode(node, 0))
      )}

      {/* Floating Right-Click Context Menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="ide-context-menu glass-panel"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.isFolder ? (
            <>
              <button
                type="button"
                className="ide-menu-item"
                onClick={() => {
                  const targetPath = contextMenu.item ? contextMenu.item.path : "";
                  if (targetPath) onToggleFolder(targetPath, true);
                  setCreatingIn({ parentPath: targetPath, isFolder: false });
                  setContextMenu(null);
                }}
              >
                <FilePlus size={13} />
                <span>New File</span>
              </button>
              <button
                type="button"
                className="ide-menu-item"
                onClick={() => {
                  const targetPath = contextMenu.item ? contextMenu.item.path : "";
                  if (targetPath) onToggleFolder(targetPath, true);
                  setCreatingIn({ parentPath: targetPath, isFolder: true });
                  setContextMenu(null);
                }}
              >
                <FolderPlus size={13} />
                <span>New Folder</span>
              </button>
              {contextMenu.item && (
                <>
                  <div className="ide-menu-separator" />
                  <button
                    type="button"
                    className="ide-menu-item"
                    onClick={() => startRename(contextMenu.item)}
                  >
                    <Edit2 size={13} />
                    <span>Rename Folder</span>
                  </button>
                  <button
                    type="button"
                    className="ide-menu-item"
                    onClick={() => copyPath(contextMenu.item.path)}
                  >
                    <Copy size={13} />
                    <span>Copy Relative Path</span>
                  </button>
                  <div className="ide-menu-separator" />
                  <button
                    type="button"
                    className="ide-menu-item danger"
                    onClick={() => {
                      onDeleteItem(contextMenu.item);
                      setContextMenu(null);
                    }}
                  >
                    <Trash2 size={13} />
                    <span>Delete Folder</span>
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                className="ide-menu-item"
                onClick={() => {
                  onOpenFile(contextMenu.item.file || contextMenu.item);
                  setContextMenu(null);
                }}
              >
                <ExternalLink size={13} />
                <span>Open in Tab</span>
              </button>
              <button
                type="button"
                className="ide-menu-item"
                onClick={() => startRename(contextMenu.item)}
              >
                <Edit2 size={13} />
                <span>Rename File</span>
              </button>
              <button
                type="button"
                className="ide-menu-item"
                onClick={() => copyPath(contextMenu.item.path)}
              >
                <Copy size={13} />
                <span>Copy Relative Path</span>
              </button>
              <div className="ide-menu-separator" />
              <button
                type="button"
                className="ide-menu-item danger"
                onClick={() => {
                  onDeleteItem(contextMenu.item);
                  setContextMenu(null);
                }}
              >
                <Trash2 size={13} />
                <span>Delete File</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
