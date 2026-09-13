/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NEON_AUTH_URL: string
}

declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}
