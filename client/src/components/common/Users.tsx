import { useAppContext } from "@/context/AppContext"
import { RemoteUser, USER_CONNECTION_STATUS } from "@/types/user"
import Avatar from "react-avatar"

function Users() {
    const { users } = useAppContext()

    return (
        <div className="flex min-h-[200px] flex-grow justify-center overflow-y-auto py-2">
            <div className="flex h-full w-full flex-wrap items-start gap-x-2 gap-y-6">
                {users.map((user) => {
                    return <User key={user.socketId} user={user} />
                })}
            </div>
        </div>
    )
}

const User = ({ user }: { user: RemoteUser }) => {
    const { username, status, currentFile, typing } = user
    const title = `${username} - ${status === USER_CONNECTION_STATUS.ONLINE ? "online" : "offline"}${currentFile ? ` - editing ${currentFile}` : ""}`

    return (
        <div
            className="relative flex w-[104px] flex-col items-center gap-2 rounded-xl border border-blue-300/20 bg-slate-900/65 px-2 py-3"
            title={title}
        >
            <Avatar name={username} size="50" round={"12px"} title={title} />
            <p className="line-clamp-2 max-w-full text-ellipsis break-words text-center text-sm text-slate-200">
                {username}
            </p>
            <div
                className={`absolute right-5 top-0 h-3 w-3 rounded-full ${
                    status === USER_CONNECTION_STATUS.ONLINE
                        ? "bg-green-500"
                        : "bg-danger"
                }`}
            ></div>
            {typing && (
                <div className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-200">
                    typing
                </div>
            )}
            {currentFile && (
                <p className="max-w-full truncate text-center text-[11px] text-slate-400">
                    {currentFile}
                </p>
            )}
        </div>
    )
}

export default Users
