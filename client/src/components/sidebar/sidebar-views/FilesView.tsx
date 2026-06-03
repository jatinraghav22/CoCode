import { useState } from "react"
import FileStructureView from "@/components/files/FileStructureView"
import { useFileSystem } from "@/context/FileContext"
import useResponsive from "@/hooks/useResponsive"
import { FileSystemItem } from "@/types/file"
import cn from "classnames"
import { BiArchiveIn } from "react-icons/bi"
import { LuFileUp, LuFolderUp } from "react-icons/lu"
import { v4 as uuidV4 } from "uuid"
import { toast } from "react-hot-toast"
import { motion } from "framer-motion"

function FilesView() {
    const { fileStructure, downloadFilesAndFolders, updateDirectory } =
        useFileSystem()
    const { viewHeight, minHeightReached } = useResponsive()
    const [isFolderLoading, setIsFolderLoading] = useState(false)
    const [isFilesLoading, setIsFilesLoading] = useState(false)

    const blackList = new Set(["node_modules", ".git", ".vscode", ".next"])

    const readFileContent = async (file: File): Promise<string> => {
        const MAX_FILE_SIZE = 1024 * 1024 // 1MB limit

        if (file.size > MAX_FILE_SIZE) {
            return `File too large: ${file.name} (${Math.round(file.size / 1024)}KB)`
        }

        try {
            return await file.text()
        } catch (error) {
            console.error(`Error reading file ${file.name}:`, error)
            return `Error reading file: ${file.name}`
        }
    }

    const createDirectoryNode = (name: string): FileSystemItem => ({
        id: uuidV4(),
        name,
        type: "directory",
        children: [],
        isOpen: false,
    })

    const mergeChildren = (
        existingChildren: FileSystemItem[],
        incomingChildren: FileSystemItem[],
    ): FileSystemItem[] => {
        const mergedChildren = [...existingChildren]

        for (const incomingItem of incomingChildren) {
            const existingIndex = mergedChildren.findIndex(
                (existingItem) =>
                    existingItem.type === incomingItem.type &&
                    existingItem.name === incomingItem.name,
            )

            if (existingIndex === -1) {
                mergedChildren.push(incomingItem)
                continue
            }

            const existingItem = mergedChildren[existingIndex]

            if (
                existingItem.type === "directory" &&
                incomingItem.type === "directory"
            ) {
                mergedChildren[existingIndex] = {
                    ...existingItem,
                    children: mergeChildren(
                        existingItem.children || [],
                        incomingItem.children || [],
                    ),
                    isOpen: existingItem.isOpen ?? false,
                }
                continue
            }

            // For duplicate file names in same folder, keep existing id and overwrite content.
            if (existingItem.type === "file" && incomingItem.type === "file") {
                mergedChildren[existingIndex] = {
                    ...existingItem,
                    content: incomingItem.content,
                }
            }
        }

        return mergedChildren
    }

    const mergeAndPersistDirectory = (incomingChildren: FileSystemItem[]) => {
        const existingChildren = fileStructure.children || []
        const mergedChildren = mergeChildren(existingChildren, incomingChildren)
        updateDirectory("", mergedChildren)
    }

    const readNestedTreeFromFileList = async (
        files: FileList,
    ): Promise<FileSystemItem[]> => {
        const root: FileSystemItem = createDirectoryNode("root")

        for (const file of Array.from(files)) {
            const relativePath = file.webkitRelativePath || file.name
            const pathParts = relativePath.split("/").filter(Boolean)
            if (pathParts.length === 0) continue

            if (pathParts.some((part) => blackList.has(part))) {
                continue
            }

            let currentNode = root

            for (let i = 0; i < pathParts.length - 1; i += 1) {
                const folderName = pathParts[i]
                if (!currentNode.children) currentNode.children = []

                let nextNode = currentNode.children.find(
                    (item) =>
                        item.type === "directory" && item.name === folderName,
                )

                if (!nextNode) {
                    nextNode = createDirectoryNode(folderName)
                    currentNode.children.push(nextNode)
                }

                currentNode = nextNode
            }

            const fileName = pathParts[pathParts.length - 1]
            if (!currentNode.children) currentNode.children = []

            currentNode.children.push({
                id: uuidV4(),
                name: fileName,
                type: "file",
                content: await readFileContent(file),
            })
        }

        return root.children || []
    }

    const readDirectory = async (
        directoryHandle: FileSystemDirectoryHandle,
    ): Promise<FileSystemItem[]> => {
        const children: FileSystemItem[] = []

        for await (const entry of directoryHandle.values()) {
            if (entry.kind === "file") {
                const file = await entry.getFile()
                children.push({
                    id: uuidV4(),
                    name: entry.name,
                    type: "file",
                    content: await readFileContent(file),
                })
            } else if (entry.kind === "directory") {
                if (blackList.has(entry.name)) continue

                children.push({
                    id: uuidV4(),
                    name: entry.name,
                    type: "directory",
                    children: await readDirectory(entry),
                    isOpen: false,
                })
            }
        }

        return children
    }

    const processDirectoryHandle = async (
        directoryHandle: FileSystemDirectoryHandle,
    ) => {
        try {
            toast.loading("Getting files and folders...")
            const children = await readDirectory(directoryHandle)

            // Preserve selected folder name as top-level directory (VS Code-like tree).
            const selectedRootFolder: FileSystemItem = {
                id: uuidV4(),
                name: directoryHandle.name,
                type: "directory",
                children,
                isOpen: false,
            }

            mergeAndPersistDirectory([selectedRootFolder])
            toast.dismiss()
            toast.success("Directory loaded successfully")
        } catch (error) {
            console.error("Error processing directory:", error)
            toast.error("Failed to process directory")
        }
    }

    const handleUploadFolder = async () => {
        try {
            setIsFolderLoading(true)

            if ("showDirectoryPicker" in window) {
                const directoryHandle = await window.showDirectoryPicker()
                await processDirectoryHandle(directoryHandle)
                return
            }

            if ("webkitdirectory" in HTMLInputElement.prototype) {
                const fileInput = document.createElement("input")
                fileInput.type = "file"
                fileInput.webkitdirectory = true
                fileInput.multiple = true

                fileInput.onchange = async (e) => {
                    const files = (e.target as HTMLInputElement).files
                    if (!files || files.length === 0) {
                        setIsFolderLoading(false)
                        return
                    }

                    const structure = await readNestedTreeFromFileList(files)
                    mergeAndPersistDirectory(structure)
                    toast.success("Folder uploaded successfully")
                    setIsFolderLoading(false)
                }

                fileInput.click()
                return
            }

            toast.error("Your browser does not support folder selection.")
        } catch (error) {
            console.error("Error uploading folder:", error)
            toast.error("Failed to upload folder")
        } finally {
            setIsFolderLoading(false)
        }
    }

    const handleUploadFiles = async () => {
        try {
            setIsFilesLoading(true)

            const fileInput = document.createElement("input")
            fileInput.type = "file"
            fileInput.multiple = true

            fileInput.onchange = async (e) => {
                const files = (e.target as HTMLInputElement).files
                if (!files || files.length === 0) {
                    setIsFilesLoading(false)
                    return
                }

                const fileItems: FileSystemItem[] = await Promise.all(
                    Array.from(files).map(async (file) => ({
                        id: uuidV4(),
                        name: file.name,
                        type: "file",
                        content: await readFileContent(file),
                    })),
                )

                mergeAndPersistDirectory(fileItems)
                toast.success("Files uploaded successfully")
                setIsFilesLoading(false)
            }

            fileInput.click()
        } catch (error) {
            console.error("Error uploading files:", error)
            toast.error("Failed to upload files")
            setIsFilesLoading(false)
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="relative flex select-none flex-col gap-1 px-4 py-2"
            style={{ height: viewHeight, maxHeight: viewHeight }}
        >
            <FileStructureView />
            <div
                className={cn("flex min-h-fit flex-col justify-end pt-2", {
                    hidden: minHeightReached,
                })}
            >
                <div className="mb-2 border-t border-blue-800/50" />
                <button
                    className="mt-1 flex w-full items-center justify-start rounded-xl border border-blue-400/25 bg-slate-900/65 p-2.5 text-slate-100 transition hover:bg-blue-500/25"
                    onClick={handleUploadFolder}
                    disabled={isFolderLoading}
                >
                    <LuFolderUp className="mr-2" size={22} />
                    {isFolderLoading ? "Uploading Folder..." : "Upload Folder"}
                </button>
                <button
                    className="mt-2 flex w-full items-center justify-start rounded-xl border border-blue-400/25 bg-slate-900/65 p-2.5 text-slate-100 transition hover:bg-blue-500/25"
                    onClick={handleUploadFiles}
                    disabled={isFilesLoading}
                >
                    <LuFileUp className="mr-2" size={22} />
                    {isFilesLoading ? "Uploading Files..." : "Upload Files"}
                </button>
                <button
                    className="mt-2 flex w-full items-center justify-start rounded-xl border border-blue-400/25 bg-slate-900/65 p-2.5 text-slate-100 transition hover:bg-blue-500/25"
                    onClick={downloadFilesAndFolders}
                >
                    <BiArchiveIn className="mr-2" size={22} /> Download Code
                </button>
            </div>

            {(isFolderLoading || isFilesLoading) && (
                <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-slate-950/80 backdrop-blur-sm">
                    <div className="glass-panel flex items-center gap-3 px-5 py-4">
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-200/40 border-t-blue-400" />
                        <p className="text-sm text-slate-100">
                            {isFolderLoading
                                ? "Uploading folder..."
                                : "Uploading files..."}
                        </p>
                    </div>
                </div>
            )}
        </motion.div>
    )
}

export default FilesView
