import { useEffect } from "react"
import { motion } from "framer-motion"
import { useAppContext } from "@/context/AppContext"
import { useSocket } from "@/context/SocketContext"
import useResponsive from "@/hooks/useResponsive"
import { SocketEvent } from "@/types/socket"
import { formatDate } from "@/utils/formateDate"

function ActivityView() {
    const { viewHeight } = useResponsive()
    const { roomActivity } = useAppContext()
    const { socket } = useSocket()

    useEffect(() => {
        socket.emit(SocketEvent.REQUEST_ROOM_ACTIVITY)
    }, [socket])

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex max-h-full min-h-[400px] w-full flex-col gap-2 p-4"
            style={{ height: viewHeight }}
        >
            <h1 className="view-title">Activity Timeline</h1>

            <div className="flex-1 overflow-y-auto rounded-xl border border-blue-300/20 bg-slate-900/65 p-2">
                {roomActivity.length === 0 && (
                    <p className="p-3 text-sm text-slate-400">
                        No activity yet in this room.
                    </p>
                )}

                {roomActivity
                    .slice()
                    .reverse()
                    .map((activity) => (
                        <div
                            key={activity.id}
                            className="mb-2 rounded-lg border border-blue-300/15 bg-slate-950/75 p-2.5"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-xs text-cyan-200">
                                    {activity.username}
                                </p>
                                <p className="text-[11px] text-slate-400">
                                    {formatDate(activity.timestamp)}
                                </p>
                            </div>
                            <p className="mt-1 text-sm text-slate-100">
                                {activity.message}
                            </p>
                        </div>
                    ))}
            </div>
        </motion.div>
    )
}

export default ActivityView
