/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_JUDGE0_BASE_URL?: string
	readonly VITE_JUDGE0_API_KEY?: string
	readonly VITE_JUDGE0_API_HOST?: string
	readonly VITE_JUDGE0_AUTH_TOKEN?: string
	readonly VITE_JUDGE0_AUTH_USER?: string
	readonly VITE_POLLINATIONS_BASE_URL?: string
	readonly VITE_POLLINATIONS_API_KEY?: string
	readonly VITE_POLLINATIONS_MODEL?: string
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}