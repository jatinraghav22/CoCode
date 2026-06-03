import { useViews } from "@/context/ViewContext"
import useLocalStorage from "@/hooks/useLocalStorage"
import useWindowDimensions from "@/hooks/useWindowDimensions"
import { ReactNode } from "react"
import Split from "react-split"

function SplitterComponent({ children }: { children: ReactNode }) {
    const { isSidebarOpen, setIsSidebarOpen } = useViews()
    const { isMobile, width } = useWindowDimensions()
    const { setItem, getItem } = useLocalStorage()
    const defaultSizes = [24, 76]
    const activityRailWidth = 58
    const collapseThreshold = activityRailWidth + 14
    const collapsedSidebarPercent =
        (activityRailWidth / Math.max(width, 1)) * 100

    const getSavedExpandedSizes = () => {
        const savedSizes = getItem("editorSizesExpanded")
        if (savedSizes) {
            return JSON.parse(savedSizes)
        }
        return defaultSizes
    }

    const getGutter = () => {
        const gutter = document.createElement("div")
        gutter.className =
            "hidden h-full cursor-col-resize transition-colors md:block"
        gutter.style.backgroundColor = "#244468"
        gutter.addEventListener("mouseenter", () => {
            gutter.style.backgroundColor = "#4ea6ff"
        })
        gutter.addEventListener("mouseleave", () => {
            gutter.style.backgroundColor = "#244468"
        })
        return gutter
    }

    const getSizes = () => {
        if (isMobile) return [0, 100]
        if (!isSidebarOpen) {
            return [collapsedSidebarPercent, 100 - collapsedSidebarPercent]
        }

        return getSavedExpandedSizes()
    }

    const getMinSizes = () => {
        if (isMobile) return [0, width]
        return [activityRailWidth, 300]
    }

    const getMaxSizes = () => {
        if (isMobile) return [0, Infinity]
        return [520, Infinity]
    }

    const handleGutterDrag = (sizes: number[]) => {
        if (isMobile) return

        const sidebarWidthPx = (sizes[0] / 100) * width

        if (sidebarWidthPx > collapseThreshold) {
            if (!isSidebarOpen) {
                setIsSidebarOpen(true)
            }
            setItem("editorSizesExpanded", JSON.stringify(sizes))
        }
    }

    const handleGutterDragEnd = (sizes: number[]) => {
        if (isMobile) return

        const sidebarWidthPx = (sizes[0] / 100) * width

        if (sidebarWidthPx <= collapseThreshold) {
            setIsSidebarOpen(false)
            setItem(
                "editorSizes",
                JSON.stringify([
                    collapsedSidebarPercent,
                    100 - collapsedSidebarPercent,
                ]),
            )
            return
        }

        setIsSidebarOpen(true)
        setItem("editorSizesExpanded", JSON.stringify(sizes))
        setItem("editorSizes", JSON.stringify(sizes))
    }

    const getGutterStyle = () => ({
        width: "8px",
        boxShadow: "0 0 0 1px rgba(60, 131, 203, 0.35)",
        display: !isMobile ? "block" : "none",
    })

    return (
        <Split
            sizes={getSizes()}
            minSize={getMinSizes()}
            gutter={getGutter}
            maxSize={getMaxSizes()}
            dragInterval={1}
            direction="horizontal"
            gutterAlign="center"
            cursor="e-resize"
            snapOffset={30}
            gutterStyle={getGutterStyle}
            onDrag={handleGutterDrag}
            onDragEnd={handleGutterDragEnd}
            className="flex h-screen min-h-screen max-w-full overflow-hidden bg-transparent"
        >
            {children}
        </Split>
    )
}

export default SplitterComponent
