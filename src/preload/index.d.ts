import type { InkspaceApi } from '../shared/ipc'

declare global {
  interface Window {
    api: InkspaceApi
  }
}

export {}
