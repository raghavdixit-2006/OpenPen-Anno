import type { OpenPenAnnoApi } from '../shared/ipc'

declare global {
  interface Window {
    api: OpenPenAnnoApi
  }
}

export {}
