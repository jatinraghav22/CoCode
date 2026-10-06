import { useState, useRef, useEffect } from "react"
import { usePersonalWorkspace } from "@/context/PersonalWorkspaceContext"
import {
    HiOutlineFolder,
    HiOutlineFolderOpen,
    HiOutlineDocumentText,
    HiOutlinePlus,
    HiOutlinePencilAlt,
    HiOutlineTrash,
    HiOutlineDownload,
    HiOutlineRefresh,
    HiOutlineChevronRight,
    HiOutlineChevronDown,
    HiOutlineCheck,
    HiOutlineX,
} from "react-icons/hi"
import {
    SiCplusplus,
    SiPython,
    SiJavascript,
    SiTypescript,
    SiRust,
    SiGo,
    SiPhp,
    SiHtml5,
    SiCss3,
    SiMarkdown,
} from "react-icons/si"
import { FaJava } from "react-icons/fa"
import { TbBrandCSharp } from "react-icons/tb"

const getFileIcon = (fileName) => {
    const ext = (fileName || "").split(".").pop()?.toLowerCase()
    switch (ext) {
        case "cpp":
        case "cc":
        case "cxx":
        case "hpp":
            return <SiCplusplus className="text-blue-400" />
        case "c":
        case "h":
            return <SiCplusplus className="text-cyan-400" />
        case "py":
            return <SiPython className="text-amber-400" />
        case "js":
        case "jsx":
        case "mjs":
            return <SiJavascript className="text-yellow-400" />
        case "ts":
        case "tsx":
            return <SiTypescript className="text-blue-400" />
        case "java":
            return <FaJava className="text-orange-400" />
        case "rs":
            return <SiRust className="text-orange-300" />
        case "go":
            return <SiGo className="text-cyan-300" />
        case "cs":
            return <TbBrandCSharp className="text-purple-400" />
        case "php":
            return <SiPhp className="text-indigo-300" />
        case "html":
            return <SiHtml5 className="text-orange-500" />
        case "css":
            return <SiCss3 className="text-blue-500" />
        case "md":
            return <SiMarkdown className="text-slate-300" />
        default:
            return <HiOutlineDocumentText className="text-slate-400" />
    }
}

const PersonalFilesPanel = ({ className = "" }) => {
    const {
        fileStructure,
        activeFile,
        openFile,
        createFile,
        createDirectory,
        renameFile,
        renameDirectory,
        deleteFile,
        deleteDirectory,
        toggleDirectory,
        downloadZip,
        resetToStarter,
    } = usePersonalWorkspace()

    const [isCreatingFile, setIsCreatingFile] = useState(false)
    const [isCreatingFolder, setIsCreatingFolder] = useState(false)
    const [newItemName, setNewItemName] = useState("")
    const [editingNodeId, setEditingNodeId] = useState(null)
    const [editName, setEditName] = useState("")
    const [targetParentId, setTargetParentId] = useState(null)

    const inputRef = useRef(null)
    const editInputRef = useRef(null)

    useEffect(() => {
        if (isCreatingFile || isCreatingFolder) {
            inputRef.current?.focus()
        }
    }, [isCreatingFile, isCreatingFolder])

    useEffect(() => {
        if (editingNodeId) {
            editInputRef.current?.focus()
        }
    }, [editingNodeId])

    const handleCreateSubmit = (e) => {
        e?.preventDefault()
        const trimmed = newItemName.trim()
        if (!trimmed) {
            setIsCreatingFile(false)
            setIsCreatingFolder(false)
            return
        }

        if (isCreatingFile) {
            createFile(trimmed, targetParentId)
        } else if (isCreatingFolder) {
            createDirectory(trimmed, targetParentId)
        }

        setNewItemName("")
        setIsCreatingFile(false)
        setIsCreatingFolder(false)
        setTargetParentId(null)
    }

    const handleRenameSubmit = (node, e) => {
        e?.preventDefault()
        const trimmed = editName.trim()
        if (!trimmed) {
            setEditingNodeId(null)
            return
        }

        if (node.type === "file") {
            renameFile(node.id, trimmed)
        } else {
            renameDirectory(node.id, trimmed)
        }
        setEditingNodeId(null)
    }

    const startRename = (node, e) => {
        e.stopPropagation()
        setEditingNodeId(node.id)
        setEditName(node.name)
    }

    const handleDelete = (node, e) => {
        e.stopPropagation()
        if (window.confirm(`Delete ${node.name}?`)) {
            if (node.type === "file") {
                deleteFile(node.id)
            } else {
                deleteDirectory(node.id)
            }
        }
    }

    const renderTree = (node, depth = 0) => {
        if (!node) return null

        if (node.type === "directory") {
            const isRoot = node.id === "root" || depth === 0

            return (
                <div key={node.id} className="flex flex-col">
                    {!isRoot && (
                        <div
                            onClick={() => toggleDirectory(node.id)}
                            style={{ paddingLeft: `${depth * 14}px` }}
                            className="group flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-800/80 hover:text-white"
                        >
                            <div className="flex min-w-0 items-center gap-1.5">
                                {node.isOpen ? (
                                    <HiOutlineChevronDown className="h-3.5 w-3.5 text-slate-400" />
                                ) : (
                                    <HiOutlineChevronRight className="h-3.5 w-3.5 text-slate-400" />
                                )}
                                {node.isOpen ? (
                                    <HiOutlineFolderOpen className="h-4 w-4 text-cyan-400" />
                                ) : (
                                    <HiOutlineFolder className="h-4 w-4 text-cyan-400" />
                                )}
                                {editingNodeId === node.id ? (
                                    <form
                                        onSubmit={(e) => handleRenameSubmit(node, e)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="flex items-center gap-1"
                                    >
                                        <input
                                            ref={editInputRef}
                                            type="text"
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            className="rounded border border-cyan-400 bg-slate-900 px-1 py-0.5 text-xs text-white outline-none"
                                        />
                                        <button
                                            type="submit"
                                            className="text-emerald-400 hover:text-emerald-300"
                                        >
                                            <HiOutlineCheck />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEditingNodeId(null)}
                                            className="text-red-400 hover:text-red-300"
                                        >
                                            <HiOutlineX />
                                        </button>
                                    </form>
                                ) : (
                                    <span className="truncate">{node.name}</span>
                                )}
                            </div>

                            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setTargetParentId(node.id)
                                        setIsCreatingFile(true)
                                    }}
                                    title="Add file inside"
                                    className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white"
                                >
                                    <HiOutlinePlus className="h-3 w-3" />
                                </button>
                                <button
                                    onClick={(e) => startRename(node, e)}
                                    title="Rename"
                                    className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white"
                                >
                                    <HiOutlinePencilAlt className="h-3 w-3" />
                                </button>
                                <button
                                    onClick={(e) => handleDelete(node, e)}
                                    title="Delete"
                                    className="rounded p-1 text-slate-400 hover:bg-red-500/20 hover:text-red-400"
                                >
                                    <HiOutlineTrash className="h-3 w-3" />
                                </button>
                            </div>
                        </div>
                    )}

                    {(isRoot || node.isOpen) && (
                        <div className="flex flex-col">
                            {node.children?.map((child) => renderTree(child, isRoot ? depth : depth + 1))}
                        </div>
                    )}
                </div>
            )
        }

        const isActive = activeFile?.id === node.id

        return (
            <div
                key={node.id}
                onClick={() => openFile(node.id)}
                style={{ paddingLeft: `${(depth + 1) * 14}px` }}
                className={`group flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 text-xs transition ${
                    isActive
                        ? "border border-cyan-400/30 bg-blue-500/20 text-cyan-200 font-semibold shadow-[0_0_12px_rgba(56,131,255,0.15)]"
                        : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                }`}
            >
                <div className="flex min-w-0 items-center gap-2">
                    <span className="text-sm">{getFileIcon(node.name)}</span>
                    {editingNodeId === node.id ? (
                        <form
                            onSubmit={(e) => handleRenameSubmit(node, e)}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1"
                        >
                            <input
                                ref={editInputRef}
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="rounded border border-cyan-400 bg-slate-900 px-1 py-0.5 text-xs text-white outline-none"
                            />
                            <button
                                type="submit"
                                className="text-emerald-400 hover:text-emerald-300"
                            >
                                <HiOutlineCheck />
                            </button>
                            <button
                                type="button"
                                onClick={() => setEditingNodeId(null)}
                                className="text-red-400 hover:text-red-300"
                            >
                                <HiOutlineX />
                            </button>
                        </form>
                    ) : (
                        <span className="truncate">{node.name}</span>
                    )}
                </div>

                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                        onClick={(e) => startRename(node, e)}
                        title="Rename file"
                        className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white"
                    >
                        <HiOutlinePencilAlt className="h-3 w-3" />
                    </button>
                    <button
                        onClick={(e) => handleDelete(node, e)}
                        title="Delete file"
                        className="rounded p-1 text-slate-400 hover:bg-red-500/20 hover:text-red-400"
                    >
                        <HiOutlineTrash className="h-3 w-3" />
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className={`flex h-full flex-col bg-slate-950/80 border-r border-slate-800/70 ${className}`}>
            {/* Header / Actions */}
            <div className="flex items-center justify-between border-b border-slate-800/80 px-3 py-2.5">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Files
                    </span>
                    <span className="rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-cyan-400 border border-blue-500/20">
                        Personal
                    </span>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={() => {
                            setTargetParentId(null)
                            setIsCreatingFolder(false)
                            setIsCreatingFile(true)
                            setNewItemName("")
                        }}
                        title="New File"
                        className="rounded-lg p-1 text-slate-300 transition hover:bg-slate-800 hover:text-white"
                    >
                        <HiOutlinePlus className="h-4 w-4" />
                    </button>

                    <button
                        onClick={() => {
                            setTargetParentId(null)
                            setIsCreatingFile(false)
                            setIsCreatingFolder(true)
                            setNewItemName("")
                        }}
                        title="New Folder"
                        className="rounded-lg p-1 text-slate-300 transition hover:bg-slate-800 hover:text-white"
                    >
                        <HiOutlineFolder className="h-4 w-4" />
                    </button>

                    <button
                        onClick={downloadZip}
                        title="Download Workspace (ZIP)"
                        className="rounded-lg p-1 text-slate-300 transition hover:bg-slate-800 hover:text-cyan-300"
                    >
                        <HiOutlineDownload className="h-4 w-4" />
                    </button>

                    <button
                        onClick={() => {
                            if (window.confirm("Reset workspace to starter C++ code?")) {
                                resetToStarter("cpp")
                            }
                        }}
                        title="Reset to default template"
                        className="rounded-lg p-1 text-slate-300 transition hover:bg-slate-800 hover:text-amber-300"
                    >
                        <HiOutlineRefresh className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Inline Creation Input */}
            {(isCreatingFile || isCreatingFolder) && (
                <div className="border-b border-slate-800 bg-slate-900/90 p-2">
                    <form onSubmit={handleCreateSubmit} className="flex items-center gap-1.5">
                        {isCreatingFile ? (
                            <HiOutlineDocumentText className="text-cyan-400" />
                        ) : (
                            <HiOutlineFolder className="text-amber-400" />
                        )}
                        <input
                            ref={inputRef}
                            type="text"
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            placeholder={isCreatingFile ? "filename.cpp" : "folder-name"}
                            className="flex-1 rounded border border-blue-500/40 bg-slate-950 px-2 py-1 text-xs text-white outline-none focus:border-cyan-400"
                        />
                        <button
                            type="submit"
                            className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-500"
                        >
                            Add
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setIsCreatingFile(false)
                                setIsCreatingFolder(false)
                            }}
                            className="rounded p-1 text-slate-400 hover:text-white"
                        >
                            <HiOutlineX />
                        </button>
                    </form>
                </div>
            )}

            {/* Tree View */}
            <div className="flex-1 overflow-y-auto p-2">
                {renderTree(fileStructure, 0)}
            </div>
        </div>
    )
}

export default PersonalFilesPanel
