import { ChangeEvent } from "react"
import { PiCaretDownBold } from "react-icons/pi"

interface SelectProps {
    onChange: (e: ChangeEvent<HTMLSelectElement>) => void
    value: string
    options: string[]
    title: string
}

function Select({ onChange, value, options, title }: SelectProps) {
    return (
        <div className="relative w-full">
            <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400">
                {title}
            </label>
            <select
                className="w-full rounded-xl border border-blue-300/30 bg-slate-900/80 px-4 py-2.5 text-slate-100 outline-none transition focus:border-blue-400 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.22)]"
                value={value}
                onChange={onChange}
            >
                {options.sort().map((option) => {
                    const value = option
                    const name =
                        option.charAt(0).toUpperCase() + option.slice(1)

                    return (
                        <option key={name} value={value}>
                            {name}
                        </option>
                    )
                })}
            </select>
            <PiCaretDownBold
                size={16}
                className="absolute bottom-3.5 right-4 z-10 text-slate-300"
            />
        </div>
    )
}

export default Select
