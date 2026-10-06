import { useFileSystem } from "@/context/FileContext"
import useResponsive from "@/hooks/useResponsive"
import cn from "classnames"
import Editor from "./Editor"
import FileTab from "./FileTab"

function EditorComponent() {
    const { openFiles } = useFileSystem()
    const { minHeightReached } = useResponsive()

    if (openFiles.length <= 0) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <div className="glass-panel max-w-xl px-8 py-10 text-center">
                    <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">
                        Workspace Ready
                    </p>
                    <h1 className="mt-3 text-2xl font-bold text-slate-100">
                        No file is open yet
                    </h1>
                    <p className="mt-3 text-slate-300">
                        Create a new file from the Files panel to start coding.
                        Syntax highlighting is applied automatically from file
                        extension.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <main
            className={cn("flex w-full flex-col overflow-x-auto md:h-screen", {
                "h-[calc(100vh-50px)]": !minHeightReached,
                "h-full": minHeightReached,
            })}
        >
            <FileTab />
            <Editor />
        </main>
    )
}

export default EditorComponent
