import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react"
import { v4 as uuidv4 } from "uuid"
import { toast } from "react-hot-toast"
import JSZip from "jszip"
import { saveAs } from "file-saver"
import { useAuth } from "./AuthContext"
import { LANGUAGE_STARTERS, DEFAULT_LANGUAGES } from "@/api/executeApi"

const PersonalWorkspaceContext = createContext(null)

const DEFAULT_MAIN_CPP = `#include <iostream>
using namespace std;

int main() {
    cout << "Hello, CoCodee!";
    return 0;
}
`

const createInitialPersonalStructure = () => ({
    id: "root",
    name: "workspace",
    type: "directory",
    isOpen: true,
    children: [
        {
            id: uuidv4(),
            name: "main.cpp",
            type: "file",
            content: DEFAULT_MAIN_CPP,
        },
    ],
})

export const usePersonalWorkspace = () => {
    const context = useContext(PersonalWorkspaceContext)
    if (!context) {
        throw new Error("usePersonalWorkspace must be used within PersonalWorkspaceProvider")
    }
    return context
}

export const PersonalWorkspaceProvider = ({ children }) => {
    const { user } = useAuth()
    const storageKey = useMemo(() => {
        return user?.id
            ? `cocodee_personal_workspace_${user.id}`
            : user?.username
            ? `cocodee_personal_workspace_${user.username}`
            : "cocodee_personal_workspace_guest"
    }, [user?.id, user?.username])

    const [fileStructure, setFileStructure] = useState(() => {
        try {
            const saved = localStorage.getItem(storageKey)
            if (saved) {
                const parsed = JSON.parse(saved)
                if (parsed?.fileStructure) {
                    return parsed.fileStructure
                }
            }
        } catch (e) {
            console.warn("Failed to read initial personal files from localStorage:", e)
        }
        return createInitialPersonalStructure()
    })

    const [openFiles, setOpenFiles] = useState(() => {
        try {
            const saved = localStorage.getItem(storageKey)
            if (saved) {
                const parsed = JSON.parse(saved)
                if (parsed?.openFiles && parsed.openFiles.length > 0) {
                    return parsed.openFiles
                }
            }
        } catch {
            // fallback
        }
        const initial = createInitialPersonalStructure()
        return [initial.children[0]]
    })

    const [activeFile, setActiveFile] = useState(() => {
        try {
            const saved = localStorage.getItem(storageKey)
            if (saved) {
                const parsed = JSON.parse(saved)
                if (parsed?.activeFile) {
                    return parsed.activeFile
                }
            }
        } catch {
            // fallback
        }
        const initial = createInitialPersonalStructure()
        return initial.children[0]
    })

    // Reload when user changes (e.g. login as a different user)
    useEffect(() => {
        try {
            const saved = localStorage.getItem(storageKey)
            if (saved) {
                const parsed = JSON.parse(saved)
                if (parsed?.fileStructure) {
                    setFileStructure(parsed.fileStructure)
                    setOpenFiles(parsed.openFiles || [])
                    setActiveFile(parsed.activeFile || parsed.openFiles?.[0] || null)
                    return
                }
            }
        } catch (err) {
            console.error("Error reading personal workspace:", err)
        }

        const fresh = createInitialPersonalStructure()
        setFileStructure(fresh)
        setOpenFiles([fresh.children[0]])
        setActiveFile(fresh.children[0])
    }, [storageKey])

    // Save to localStorage whenever state changes
    useEffect(() => {
        try {
            const payload = {
                fileStructure,
                openFiles,
                activeFile,
                updatedAt: new Date().toISOString(),
            }
            localStorage.setItem(storageKey, JSON.stringify(payload))
        } catch (err) {
            console.error("Error saving personal workspace:", err)
        }
    }, [fileStructure, openFiles, activeFile, storageKey])

    const getFileById = useCallback((directory, fileId) => {
        if (!directory) return null
        if (directory.type === "file" && directory.id === fileId) return directory
        if (directory.children) {
            for (const child of directory.children) {
                const found = getFileById(child, fileId)
                if (found) return found
            }
        }
        return null
    }, [])

    const openFile = useCallback(
        (fileId) => {
            const file = getFileById(fileStructure, fileId)
            if (!file) return

            if (!openFiles.some((f) => f.id === fileId)) {
                setOpenFiles((prev) => [...prev, file])
            }
            setActiveFile(file)
        },
        [fileStructure, getFileById, openFiles],
    )

    const closeFile = useCallback(
        (fileId) => {
            const nextOpen = openFiles.filter((f) => f.id !== fileId)
            setOpenFiles(nextOpen)
            if (activeFile?.id === fileId) {
                setActiveFile(nextOpen.length > 0 ? nextOpen[nextOpen.length - 1] : null)
            }
        },
        [activeFile?.id, openFiles],
    )

    const updateFileContent = useCallback((fileId, newContent) => {
        const updateRecursive = (node) => {
            if (node.type === "file" && node.id === fileId) {
                return { ...node, content: newContent }
            }
            if (node.children) {
                return {
                    ...node,
                    children: node.children.map(updateRecursive),
                }
            }
            return node
        }

        setFileStructure((prev) => updateRecursive(prev))

        setOpenFiles((prev) =>
            prev.map((f) => (f.id === fileId ? { ...f, content: newContent } : f)),
        )

        setActiveFile((prev) => (prev?.id === fileId ? { ...prev, content: newContent } : prev))
    }, [])

    const createFile = useCallback(
        (fileName, parentDirId, initialContent = "") => {
            const cleanName = (fileName || "").trim()
            if (!cleanName) {
                toast.error("File name cannot be empty")
                return null
            }

            // Determine default starter code from extension if content not supplied
            let content = initialContent
            if (!content) {
                const ext = cleanName.split(".").pop()?.toLowerCase()
                const starter = LANGUAGE_STARTERS[ext]
                if (starter) {
                    content = starter
                }
            }

            const newFileNode = {
                id: uuidv4(),
                name: cleanName,
                type: "file",
                content,
            }

            const targetParentId = parentDirId || fileStructure.id || "root"

            const addToParent = (node) => {
                if (node.id === targetParentId) {
                    return {
                        ...node,
                        isOpen: true,
                        children: [...(node.children || []), newFileNode],
                    }
                }
                if (node.children) {
                    return {
                        ...node,
                        children: node.children.map(addToParent),
                    }
                }
                return node
            }

            setFileStructure((prev) => addToParent(prev))
            setOpenFiles((prev) => [...prev, newFileNode])
            setActiveFile(newFileNode)
            toast.success(`Created file ${cleanName}`)
            return newFileNode
        },
        [fileStructure.id],
    )

    const createDirectory = useCallback(
        (dirName, parentDirId) => {
            const cleanName = (dirName || "").trim()
            if (!cleanName) {
                toast.error("Folder name cannot be empty")
                return null
            }

            const newDirNode = {
                id: uuidv4(),
                name: cleanName,
                type: "directory",
                isOpen: true,
                children: [],
            }

            const targetParentId = parentDirId || fileStructure.id || "root"

            const addToParent = (node) => {
                if (node.id === targetParentId) {
                    return {
                        ...node,
                        isOpen: true,
                        children: [...(node.children || []), newDirNode],
                    }
                }
                if (node.children) {
                    return {
                        ...node,
                        children: node.children.map(addToParent),
                    }
                }
                return node
            }

            setFileStructure((prev) => addToParent(prev))
            toast.success(`Created folder ${cleanName}`)
            return newDirNode
        },
        [fileStructure.id],
    )

    const renameFile = useCallback((fileId, newName) => {
        const cleanName = (newName || "").trim()
        if (!cleanName) {
            toast.error("File name cannot be empty")
            return
        }

        const renameRecursive = (node) => {
            if (node.id === fileId) {
                return { ...node, name: cleanName }
            }
            if (node.children) {
                return {
                    ...node,
                    children: node.children.map(renameRecursive),
                }
            }
            return node
        }

        setFileStructure((prev) => renameRecursive(prev))
        setOpenFiles((prev) =>
            prev.map((f) => (f.id === fileId ? { ...f, name: cleanName } : f)),
        )
        setActiveFile((prev) => (prev?.id === fileId ? { ...prev, name: cleanName } : prev))
        toast.success(`Renamed to ${cleanName}`)
    }, [])

    const renameDirectory = useCallback((dirId, newName) => {
        const cleanName = (newName || "").trim()
        if (!cleanName) {
            toast.error("Folder name cannot be empty")
            return
        }

        const renameRecursive = (node) => {
            if (node.id === dirId) {
                return { ...node, name: cleanName }
            }
            if (node.children) {
                return {
                    ...node,
                    children: node.children.map(renameRecursive),
                }
            }
            return node
        }

        setFileStructure((prev) => renameRecursive(prev))
        toast.success(`Renamed folder to ${cleanName}`)
    }, [])

    const deleteFile = useCallback(
        (fileId) => {
            const deleteRecursive = (node) => {
                if (node.children) {
                    return {
                        ...node,
                        children: node.children
                            .filter((child) => child.id !== fileId)
                            .map(deleteRecursive),
                    }
                }
                return node
            }

            setFileStructure((prev) => deleteRecursive(prev))
            closeFile(fileId)
            toast.success("File deleted")
        },
        [closeFile],
    )

    const deleteDirectory = useCallback((dirId) => {
        const deleteRecursive = (node) => {
            if (node.children) {
                return {
                    ...node,
                    children: node.children
                        .filter((child) => child.id !== dirId)
                        .map(deleteRecursive),
                }
            }
            return node
        }

        setFileStructure((prev) => deleteRecursive(prev))
        toast.success("Folder deleted")
    }, [])

    const toggleDirectory = useCallback((dirId) => {
        const toggleRecursive = (node) => {
            if (node.id === dirId) {
                return { ...node, isOpen: !node.isOpen }
            }
            if (node.children) {
                return {
                    ...node,
                    children: node.children.map(toggleRecursive),
                }
            }
            return node
        }

        setFileStructure((prev) => toggleRecursive(prev))
    }, [])

    const resetToStarter = useCallback(
        (languageKey = "cpp") => {
            const matchedLang = DEFAULT_LANGUAGES.find(
                (l) => l.language === languageKey || l.extension === languageKey,
            ) || DEFAULT_LANGUAGES[0]

            const ext = matchedLang.extension || "cpp"
            const fileName = `main.${ext}`
            const content = LANGUAGE_STARTERS[matchedLang.language] || DEFAULT_MAIN_CPP

            const newFile = {
                id: uuidv4(),
                name: fileName,
                type: "file",
                content,
            }

            const newStructure = {
                id: "root",
                name: "workspace",
                type: "directory",
                isOpen: true,
                children: [newFile],
            }

            setFileStructure(newStructure)
            setOpenFiles([newFile])
            setActiveFile(newFile)
            toast.success(`Reset workspace to default ${matchedLang.name}`)
        },
        [],
    )

    const resetCurrentFileCode = useCallback(() => {
        if (!activeFile) return
        const ext = activeFile.name.split(".").pop()?.toLowerCase()
        const starter = LANGUAGE_STARTERS[ext] || DEFAULT_MAIN_CPP
        updateFileContent(activeFile.id, starter)
        toast.success(`Reset ${activeFile.name} to template`)
    }, [activeFile, updateFileContent])

    const downloadZip = useCallback(() => {
        const zip = new JSZip()
        const processNode = (node, currentPath = "") => {
            const nodePath = currentPath ? `${currentPath}/${node.name}` : node.name
            if (node.type === "file") {
                zip.file(nodePath, node.content || "")
            } else if (node.children) {
                node.children.forEach((child) => {
                    const childPath = currentPath ? `${currentPath}/${node.name}` : ""
                    processNode(child, childPath)
                })
            }
        }

        if (fileStructure.children) {
            fileStructure.children.forEach((child) => processNode(child, ""))
        }

        zip.generateAsync({ type: "blob" }).then((blob) => {
            saveAs(blob, "cocode-personal-workspace.zip")
            toast.success("Workspace downloaded as ZIP")
        })
    }, [fileStructure])

    return (
        <PersonalWorkspaceContext.Provider
            value={{
                fileStructure,
                openFiles,
                activeFile,
                setActiveFile,
                openFile,
                closeFile,
                createFile,
                createDirectory,
                renameFile,
                renameDirectory,
                deleteFile,
                deleteDirectory,
                toggleDirectory,
                updateFileContent,
                resetToStarter,
                resetCurrentFileCode,
                downloadZip,
            }}
        >
            {children}
        </PersonalWorkspaceContext.Provider>
    )
}

export default PersonalWorkspaceContext
