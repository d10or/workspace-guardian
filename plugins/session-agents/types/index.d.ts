export type AgentRow = { id: string; label: string; status: string; parentId?: string }

export type SubRow = { id: string; label: string; type: string; isRunning: boolean; at: number }

export type PeerRow = {
  sessionId: string
  pid: number
  name: string
  kind: string
  status: string
  cwd: string
  branch: string
  isSameProject: boolean
  updatedAt: number
  files: string[]
  overlap: string[]
  task: string
  activity: string
  tty: string
  jobId: string
  editAt: Record<string, number>
  subs: SubRow[]
}

export type WorktreeRow = { path: string; branch: string; dirty: number; isHere: boolean }

export type GitInfo = {
  branch: string
  dirty: number
  ahead: number
  behind: number
  base: string
  worktrees: WorktreeRow[]
  merged: string[]
}

export type NoteRow = { id: string; text: string; done: boolean; at: number }

export type HistoryRow = {
  id: string
  sessionId: string
  name: string
  outcome: string
  at: number
  durationMs: number
  branch: string
  task: string
  activity: string
}

export type PinRow = { sessionId: string; name: string }

export type MessageRow = {
  id: string
  at: number
  fromId: string
  fromName: string
  toId: string
  toName: string
  text: string
  hop: number
  via: string
  delivered: boolean
}

export type ClaimRow = {
  id: string
  sessionId: string
  name: string
  paths: string[]
  note: string
  at: number
  expiresAt: number
}

export type TaskRow = {
  id: string
  paths: string[]
  branch: string
  owner: string
  note: string
  createdAt: number
  status: 'active' | 'done'
}

export type LimitRow = { kind: string; percentUsed: number; resetsAt: string }

export type UsageRow = {
  sessionId: string
  name: string
  isSelf: boolean
  ctx: number
  window: number
  isEstimate: boolean
  turns: number
  output: number
  input: number
  cacheCreate: number
  cacheRead: number
  model: string
  costUsd: number
}

export type UsageInfo = { at: number; limits: LimitRow[]; rows: UsageRow[] }

export type Tab = 'overview' | 'sessions' | 'git' | 'notes' | 'history' | 'messages' | 'usage' | 'actions'

export type Notify = { start: boolean; done: boolean; wait: boolean }

export type UiState = {
  tab: Tab
  busyOnly: boolean
  hideBg: boolean
  flash: string
  detail: string[]
  notify: Notify
  precheck: boolean
  sharePrompt: boolean
  theme: 'light' | 'dark'
  jumpAuto: boolean
}

export type SelfRow = { sessionId: string; root: string; branch: string; note: string }

declare module 'claude-code' {
  interface PluginState {
    'session-agents': {
      agents: AgentRow[]
      peers: PeerRow[]
      me: SelfRow | null
      git: GitInfo | null
      ui: UiState
      notes: NoteRow[]
      history: HistoryRow[]
      pins: PinRow[]
      messages: MessageRow[]
      claims: ClaimRow[]
      tasks: TaskRow[]
      usage: UsageInfo | null
    }
  }
}
