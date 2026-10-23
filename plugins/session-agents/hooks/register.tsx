import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { findViolation, globMatches, parseTaskAdd, parseTasks, serializeTasks, taskFilePath, tasksOverlap } from './tasks.ts'
import type { AgentRow, ClaimRow, TaskRow, GitInfo, LimitRow, HistoryRow, MessageRow, Notify, NoteRow, PeerRow, PinRow, SelfRow, SubRow, UsageInfo, UsageRow, Tab, UiState, WorktreeRow } from '../types'

const PANE = 'session-agents'
// Shown in the pane footer so you can tell which version a session loaded. Keep equal to plugin.json.
const VERSION = '0.16.0'
// Everything under the user's Claude config folder is resolved at run time (ensurePaths), so the
// plugin carries no machine- or user-specific path. Data lives in <config>/session-agents/.
const P = {
  home: '', cfg: '', sessions: '', projects: '', data: '', bus: '',
  notes: '', history: '', pins: '', msgs: '', prefs: '', claims: '', claimsDir: '', msgsDir: '', usageDir: '',
}
const MAX_MSGS = 200
const MAX_HOPS = 4
const CLAIM_DEFAULT_MIN = 60
const CLAIM_MAX_MIN = 480
const TOOL_CLAIM = 'mcp__session-agents__claim_files'
const TOOL_RELEASE = 'mcp__session-agents__release_claims'
const SUB_RUNNING_MS = 60 * 1000
const SUB_RECENT_MS = 2 * 60 * 60 * 1000
const PRECHECK_WINDOW_MS = 10 * 60 * 1000
const WARN_MEMORY_MS = 5 * 60 * 1000
const HOP_WINDOW_MS = 10 * 60 * 1000
const RATE_MAX = 6
const RATE_WINDOW_MS = 10 * 60 * 1000
const MARKER = /\[session-agents msg=(\w+) hop=(\d+)\/(\d+) from="([^"]*)" fromId=([0-9a-f-]+)[^\]]*\]\s*/
const TOOL_SEND = 'mcp__session-agents__message_peer'
const TOOL_LIST = 'mcp__session-agents__list_peers'
const TOOL_TASKS = 'mcp__session-agents__list_tasks'
const MAX_HISTORY = 300
const BEAT_MS = 5000
const MAX_FILES = 25

const agents = atom({ plugin: 'session-agents', key: 'agents' } as const, [])
const peers = atom({ plugin: 'session-agents', key: 'peers' } as const, [])
const me = atom({ plugin: 'session-agents', key: 'me' } as const, null)
const usageAtom = atom({ plugin: 'session-agents', key: 'usage' } as const, null)
const claimsAtom = atom({ plugin: 'session-agents', key: 'claims' } as const, [])
const tasksAtom = atom({ plugin: 'session-agents', key: 'tasks' } as const, [])
const msgsAtom = atom({ plugin: 'session-agents', key: 'messages' } as const, [])
const pinsAtom = atom({ plugin: 'session-agents', key: 'pins' } as const, [])
const historyAtom = atom({ plugin: 'session-agents', key: 'history' } as const, [])
const notesAtom = atom({ plugin: 'session-agents', key: 'notes' } as const, [])
const gitAtom = atom({ plugin: 'session-agents', key: 'git' } as const, null)
const DEFAULT_UI: UiState = {
  tab: 'overview',
  busyOnly: false,
  hideBg: false,
  flash: '',
  detail: [],
  notify: { start: true, done: true, wait: true },
  precheck: true,
  sharePrompt: false,
  theme: 'light',
  jumpAuto: true,
}
const uiAtom = atom({ plugin: 'session-agents', key: 'ui' } as const, DEFAULT_UI)

// State outlives a hot reload, so a value saved by an older version may lack newer fields.
const fixUi = (u: Partial<UiState> | null | undefined): UiState => ({
  ...DEFAULT_UI,
  ...(u ?? {}),
  notify: { ...DEFAULT_UI.notify, ...(u?.notify ?? {}) },
  detail: u?.detail ?? [],
})

const ACTIONS: { key: string; label: string; argv: string[]; where: 'here' | 'any' }[] = [
  { key: 'log', label: 'Recent commits', argv: ['git', 'log', '--oneline', '--decorate', '-n', '12'], where: 'here' },
  { key: 'branches', label: 'Recent branches', argv: ['git', 'for-each-ref', '--sort=-committerdate', '--count=15', '--exclude=refs/remotes/origin/HEAD', '--format=%(committerdate:relative)  %(refname:short)', 'refs/heads', 'refs/remotes'], where: 'here' },
  { key: 'diff', label: 'Diff summary', argv: ['git', 'diff', '--stat'], where: 'here' },
  { key: 'stash', label: 'Stashes', argv: ['git', 'stash', 'list'], where: 'here' },
  { key: 'prune', label: 'Stale worktrees (dry run)', argv: ['git', 'worktree', 'prune', '--dry-run', '-v'], where: 'here' },
  { key: 'disk', label: 'Disk free', argv: ['df', '-h', '/'], where: 'any' },
  { key: 'procs', label: 'Claude processes', argv: ['pgrep', '-fl', 'claude'], where: 'any' },
  { key: 'prs', label: 'Open PRs (gh)', argv: ['gh', 'pr', 'list', '--limit', '10'], where: 'here' },
]

type Beat = { sessionId: string; files: string[]; editAt?: Record<string, number>; prompt: string; updatedAt: number }

const S = {
  sessionId: '',
  root: '',
  project: '',
  branch: '',
  prompt: '',
  note: 'starting',
  noteKey: '',
  overlapSeen: '',
  isTimerOn: false,
  files: [] as string[],
  projectOf: new Map<string, string>(),
  lastStatus: new Map<string, string>(),
  activityAt: new Map<string, number>(),
  activityOf: new Map<string, { task: string; activity: string }>(),
  busySince: new Map<string, number>(),
  branchOf: new Map<string, { at: number; branch: string }>(),
  seenClaims: new Set<string>(),
  taskAllowed: new Set<string>(),
  tasksSeen: '',
  myCwd: '',
  usageBusy: false,
  usageReady: false,
  usageCache: new Map<string, { off: number; inp: number; out: number; cc: number; cr: number; turns: number; last: number; model: string }>(),
  ctxWarned: new Map<string, number>(),
  limitWarned: new Set<string>(),
  seenMsgs: new Set<string>(),
  msgsReady: false,
  claimsReady: false,
  myName: '',
  hopCtx: null as { hop: number; at: number } | null,
  sent: [] as number[],
  editAt: new Map<string, number>(),
  subCache: new Map<string, { at: number; rows: SubRow[] }>(),
  subMeta: new Map<string, { label: string; type: string }>(),
  warned: new Map<string, number>(),
  tickNo: 0,
  baseRef: '',
  isMac: false,
  pyFailed: false,
}

const PALETTE: Record<string, string> = {
  me: 'cyan', usage: 'blue', plan: 'magenta', ctx: 'cyan', claim: 'yellow', pin: 'magenta', busy: 'green', sub: 'magenta', wt: 'blue', mg: 'cyan', open: 'yellow', done: 'gray', flt: 'gray',
}
const AGENT_COLOR: Record<string, string> = {
  running: 'green', completed: 'gray', failed: 'red', killed: 'red', idle: 'yellow', waiting: 'yellow', pending: 'blue',
}

const short = (id: string) => id.slice(0, 8)
const hhmm = (at: number) => {
  const d = new Date(at)

  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
const home = (path: string) => (P.home !== '' ? path.replace(P.home, '~') : path)
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

const ago = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000))
  return s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}m` : s < 86400 ? `${Math.round(s / 3600)}h` : `${Math.round(s / 86400)}d`
}

// The pane's own background is dark whatever the terminal theme, while plain text takes the
// terminal's foreground, so on a light terminal text vanishes. Every color is therefore set
// explicitly after the tree is built: a white page with dark ink in light mode, and the original
// look (light ink, no background override) in dark mode.
type Palette = { fg: string; bg: string; map: Record<string, string> }
const LIGHT: Palette = {
  fg: '#1f2937',
  bg: '#ffffff',
  map: {
    cyan: '#0e7490', green: '#15803d', yellow: '#a16207', red: '#b91c1c',
    magenta: '#a21caf', blue: '#1d4ed8', gray: '#6b7280', white: '#111827',
  },
}
const DARK: Palette = { fg: '#e5e7eb', bg: '', map: {} }

function paint(node: any, pal: Palette): any {
  if (Array.isArray(node)) return node.map(child => paint(child, pal))
  if (node === null || typeof node !== 'object' || typeof node.type !== 'string') return node

  const props: Record<string, unknown> = { ...(node.props ?? {}) }
  const pick = (c: unknown) => (typeof c === 'string' ? pal.map[c] ?? c : c)
  if (node.type === 'Text') {
    props.color = pick(props.color) ?? pal.fg
    if (pal.bg !== '' && props.backgroundColor === undefined) props.backgroundColor = pal.bg
  } else if (node.type === 'Box') {
    if (props.borderColor !== undefined) props.borderColor = pick(props.borderColor)
    if (pal.bg !== '' && props.backgroundColor === undefined) props.backgroundColor = pal.bg
  }

  return node.children === undefined ? { ...node, props } : { ...node, props, children: paint(node.children, pal) }
}

async function ensurePaths($: any) {
  if (P.home !== '') return
  const r = await $.process
    .run(['sh', '-c', 'printf "%s\n%s\n%s" "$HOME" "${CLAUDE_CONFIG_DIR:-$HOME/.claude}" "$(uname)"'])
    .catch(() => undefined)
  const [home = '', cfg = '', os = ''] = r && r.exitCode === 0 ? (r.stdout as string).split('\n') : []
  if (home === '') return
  P.home = home
  P.cfg = cfg || `${home}/.claude`
  P.sessions = `${P.cfg}/sessions`
  P.projects = `${P.cfg}/projects`
  P.data = `${P.cfg}/session-agents`
  P.bus = `${P.data}/bus`
  for (const name of ['notes', 'history', 'pins', 'prefs', 'claims'] as const) P[name] = `${P.data}/${name}.json`
  P.msgs = `${P.data}/messages.json`
  P.claimsDir = `${P.data}/claims`
  P.msgsDir = `${P.data}/messages`
  P.usageDir = `${P.cfg}/guardian/usage`
  S.isMac = os.trim() === 'Darwin'
  // One-time carry-over from the folder earlier versions kept their data in.
  await $.process
    .run(['sh', '-c', 'mkdir -p "$1" "$1/claims" "$1/messages" "$3"; for f in notes history pins messages prefs claims; do [ -f "$2/$f.json" ] && [ ! -f "$1/$f.json" ] && cp "$2/$f.json" "$1/$f.json"; done; true', 'sh', P.data, `${P.cfg}/lab-notes`, `${P.cfg}/guardian/usage`])
    .catch(() => undefined)
}

async function git($: any, cwd: string, ...args: string[]) {
  const r = await $.process.run(['git', ...args], { cwd }).catch(() => undefined)
  return r && r.exitCode === 0 ? (r.stdout as string).trim() : ''
}

async function init($: any) {
  await ensurePaths($)
  if (S.sessionId !== '') return
  S.sessionId = await $.session.id()
  S.root = await $.session.root()
  S.branch = (await git($, S.root, 'rev-parse', '--abbrev-ref', 'HEAD')) || '?'
  S.project = (await git($, S.root, 'rev-parse', '--path-format=absolute', '--git-common-dir')) || S.root
  S.projectOf.set(S.root, S.project)
  S.baseRef = await detectBase($)
}

// The branch "ahead / behind" and "merged" are measured against: the remote's default branch.
async function detectBase($: any): Promise<string> {
  const head = await git($, S.root, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD')
  if (head !== '') return head
  for (const ref of ['origin/main', 'origin/master']) {
    if ((await git($, S.root, 'rev-parse', '--verify', '--quiet', ref)) !== '') return ref
  }

  return ''
}

async function gatherGit($: any): Promise<GitInfo> {
  const dirtyOf = async (cwd: string) => {
    const out = await git($, cwd, 'status', '--porcelain')
    return out === '' ? 0 : out.split('\n').length
  }
  const base = S.baseRef
  const counts = base !== '' ? await git($, S.root, 'rev-list', '--left-right', '--count', `${base}...HEAD`) : ''
  const [behind = 0, ahead = 0] = counts === '' ? [] : counts.split(/\s+/).map(Number)
  const raw = await git($, S.root, 'worktree', 'list', '--porcelain')
  const worktrees: WorktreeRow[] = []
  for (const block of raw.split('\n\n')) {
    const path = /^worktree (.+)$/m.exec(block)?.[1]
    if (path === undefined) continue
    const ref = /^branch refs\/heads\/(.+)$/m.exec(block)?.[1]
    worktrees.push({
      path,
      branch: ref ?? (/^detached$/m.test(block) ? '(detached)' : '(bare)'),
      dirty: await dirtyOf(path),
      isHere: path === S.root,
    })
  }
  const merged = (base === '' ? '' : await git($, S.root, 'branch', '--merged', base, '--format=%(refname:short)'))
    .split('\n')
    .filter(b => b !== '' && b !== 'main' && b !== 'master' && b !== S.branch)

  return { branch: S.branch, dirty: await dirtyOf(S.root), ahead, behind, base, worktrees, merged }
}

function lastText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  const block = content.find((b: any) => b && b.type === 'text' && typeof b.text === 'string')

  return block ? block.text : ''
}

async function readActivity($: any, r: { sessionId: string; cwd: string }, now: number) {
  const cached = S.activityOf.get(r.sessionId)
  if (cached && now - (S.activityAt.get(r.sessionId) ?? 0) < 15000) return cached

  let task = ''
  let activity = ''
  const file = `${P.projects}/${r.cwd.replace(/[^a-zA-Z0-9]/g, '-')}/${r.sessionId}.jsonl`
  const out = await $.process.run(['tail', '-c', '120000', file]).catch(() => undefined)
  const lines = out && out.exitCode === 0 ? (out.stdout as string).split('\n').reverse() : []
  for (const line of lines) {
    if (task !== '' && activity !== '') break
    let row: any
    try {
      row = JSON.parse(line)
    } catch {
      continue
    }
    const content = row?.message?.content
    if (activity === '' && row?.type === 'assistant' && Array.isArray(content)) {
      const tool = [...content].reverse().find((b: any) => b?.type === 'tool_use')
      if (tool) {
        const input = tool.input ?? {}
        const arg = input.command ?? input.file_path ?? input.pattern ?? input.description ?? ''
        activity = `${tool.name} ${String(arg).replace(/\s+/g, ' ').slice(0, 70)}`.trim()
      } else {
        activity = lastText(content).replace(/\s+/g, ' ').slice(0, 80)
      }
    }
    if (task === '' && row?.type === 'user' && row?.isMeta !== true) {
      const text = lastText(content).replace(/\s+/g, ' ').trim()
      if (text !== '' && !text.startsWith('<') && !text.startsWith('[')) task = text.slice(0, 90)
    }
  }
  const found = { task, activity }
  S.activityOf.set(r.sessionId, found)
  S.activityAt.set(r.sessionId, now)

  return found
}

// Another session's subagents are not in $.agent.list() (that is this session only), but each
// one keeps a transcript under <session>/subagents/. One that wrote in the last minute is active.
async function readSubagents($: any, r: { sessionId: string; cwd: string }, now: number): Promise<SubRow[]> {
  const hit = S.subCache.get(r.sessionId)
  if (hit !== undefined && now - hit.at < 8000) return hit.rows

  const dir = `${P.projects}/${r.cwd.replace(/[^a-zA-Z0-9]/g, '-')}/${r.sessionId}/subagents`
  let entries: { name: string; mtimeMs: number }[] = []
  try {
    entries = await $.fs.list(dir)
  } catch {
    entries = []
  }
  const rows: SubRow[] = []
  const files = entries
    .filter(f => f.name.endsWith('.jsonl') && (now - f.mtimeMs < SUB_RECENT_MS))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, 6)
  for (const file of files) {
    const id = file.name.replace(/^agent-/, '').replace(/\.jsonl$/, '')
    let meta = S.subMeta.get(id)
    if (meta === undefined) {
      try {
        const m = JSON.parse(await $.fs.read(`${dir}/agent-${id}.meta.json`))
        meta = { label: String(m.description ?? m.name ?? m.agentType ?? id).replace(/\s+/g, ' ').slice(0, 80), type: String(m.agentType ?? '') }
      } catch {
        meta = { label: id, type: '' }
      }
      S.subMeta.set(id, meta)
    }
    rows.push({ id, label: meta.label, type: meta.type, isRunning: now - file.mtimeMs < SUB_RUNNING_MS, at: Math.floor(file.mtimeMs / 1000) * 1000 })
  }
  S.subCache.set(r.sessionId, { at: now, rows })

  return rows
}

async function tick($: any) {
  try {
    await init($)
    const now: number = await $.clock.now()
    // The prompt's first line is shared with other sessions only when the user opted in: prompts can hold secrets.
    const sharePrompt = fixUi(await read($, uiAtom)).sharePrompt
    const beat: Beat = { sessionId: S.sessionId, files: S.files, editAt: Object.fromEntries(S.editAt), prompt: sharePrompt ? S.prompt : '', updatedAt: now }
    await $.fs.write(`${P.bus}/${S.sessionId}.json`, JSON.stringify(beat))

    const regs: any[] = []
    for (const entry of await $.fs.list(P.sessions)) {
      if (!entry.name.endsWith('.json')) continue
      try {
        regs.push(JSON.parse(await $.fs.read(`${P.sessions}/${entry.name}`)))
      } catch {
        // being rewritten: next tick
      }
    }
    for (const r of regs.filter(x => x.spare !== true)) await observe($, r, now, r.sessionId === S.sessionId)
    const mine = regs.find(r => r.sessionId === S.sessionId)
    if (typeof mine?.name === 'string') S.myName = mine.name
    if (typeof mine?.cwd === 'string') S.myCwd = mine.cwd
    const candidates = regs.filter(r => r.sessionId !== S.sessionId && r.spare !== true && Number.isInteger(r.pid) && r.pid > 0)
    const ps = candidates.length
      ? await $.process.run(['ps', '-o', 'pid=,tty=', '-p', candidates.map(r => r.pid).join(',')]).catch(() => undefined)
      : undefined
    const ttyOf = new Map<number, string>()
    for (const line of ((ps?.stdout as string) ?? '').split('\n')) {
      const [pid, tty = ''] = line.trim().split(/\s+/)
      if (Number(pid)) ttyOf.set(Number(pid), tty === '??' ? '' : tty)
    }
    const alive = new Set<number>(ttyOf.keys())

    const rows: PeerRow[] = []
    for (const r of candidates.filter(c => alive.has(c.pid))) {
      let project = S.projectOf.get(r.cwd)
      if (project === undefined) {
        project = (await git($, r.cwd, 'rev-parse', '--path-format=absolute', '--git-common-dir')) || r.cwd
        S.projectOf.set(r.cwd, project)
      }
      const cachedBranch = S.branchOf.get(r.cwd)
      let branch = cachedBranch !== undefined && now - cachedBranch.at < 15000 ? cachedBranch.branch : ''
      if (branch === '') {
        branch = (await git($, r.cwd, 'rev-parse', '--abbrev-ref', 'HEAD')) || '?'
        S.branchOf.set(r.cwd, { at: now, branch })
      }
      let files: string[] = []
      let editAt: Record<string, number> = {}
      try {
        const b = JSON.parse(await $.fs.read(`${P.bus}/${r.sessionId}.json`)) as Beat
        if (now - b.updatedAt < 30000) {
          files = b.files
          editAt = b.editAt ?? {}
        }
      } catch {
        // peer does not run this mod
      }
      const { task, activity } = await readActivity($, r, now)
      const subs = await readSubagents($, r, now)
      const status = r.status ?? '?'
      rows.push({
        sessionId: r.sessionId,
        pid: r.pid,
        name: r.name ?? short(r.sessionId),
        kind: r.kind ?? '?',
        status,
        cwd: r.cwd,
        branch,
        isSameProject: project === S.project,
        updatedAt: r.updatedAt ?? 0,
        files,
        overlap: files.filter(f => S.files.includes(f)),
        task,
        activity,
        tty: ttyOf.get(r.pid) ?? '',
        jobId: typeof r.jobId === 'string' ? r.jobId : '',
        editAt,
        subs,
      })
    }
    rows.sort((a, b) => Number(b.status === 'busy') - Number(a.status === 'busy') || b.updatedAt - a.updatedAt)

    const list = await $.agent.list()
    const agentRows: AgentRow[] = list.map((a: any) => ({
      id: a.id,
      label: a.name ?? a.description ?? a.type ?? a.id,
      status: a.status,
      parentId: a.parentAgentId,
    }))

    if (S.tickNo++ % 3 === 0) {
      const info = await gatherGit($)
      await update($, gitAtom, old => (same(old, info) ? old : info))
    }
    await syncNotes($)
    await syncHistory($)
    await syncPins($)
    await syncMsgs($)
    await syncClaims($, now)
    await syncTasks($)
    await update($, peers, old => (same(old, rows) ? old : rows))
    await update($, agents, old => (same(old, agentRows) ? old : agentRows))
    S.note = `ok ${new Date(now).toISOString().slice(11, 19)}Z`
    await update($, me, () => ({ sessionId: S.sessionId, root: S.root, branch: S.branch, note: S.note }))

    const overlaps = rows.flatMap(r => r.overlap.map(f => `${short(r.sessionId)}:${f}`)).sort()
    const overlapKey = overlaps.join('|')
    if (overlapKey !== '' && overlapKey !== S.overlapSeen) {
      $.ui.toast(`Parallel session edits the same file: ${overlaps[0]}`, { timeoutMs: 8000 })
    }
    S.overlapSeen = overlapKey

    const busy = rows.filter(r => r.status === 'busy').length
    $.ui.status(rows.length ? `${rows.length} sessions${busy ? `, ${busy} busy` : ''}` : undefined)
  } catch (error) {
    S.note = `ERROR: ${String(error)}`
    await update($, me, () => ({ sessionId: S.sessionId, root: S.root, branch: S.branch, note: S.note })).catch(() => undefined)
  }
}

async function setFlash($: any, flash: string, detail: string[] = []) {
  await update($, uiAtom, (u: UiState) => ({ ...u, flash, detail }))
}

async function copyText($: any, text: string, label: string) {
  const r = await $.ui.copy({ text, surface: 'terminal' })
  await setFlash($, r.isCopied ? `Copied ${label}` : `Could not copy ${label}`)
}

async function fillTell($: any, name: string) {
  const r = await $.prompt.fill({ text: `/tell ${name.split(/\s+/)[0].toLowerCase()} `, mode: 'replace' })
  await setFlash($, r.isFilled ? `Type your message for "${name}" and press Enter` : 'Prompt box not available right now')
}

async function showStatus($: any, path: string) {
  const out = await git($, path, 'status', '--short', '--branch')
  await setFlash($, `git status in ${home(path)}`, out.split('\n').slice(0, 14))
}

async function doFetch($: any) {
  await setFlash($, 'Fetching origin…')
  const r = await $.process.run(['git', 'fetch', 'origin'], { cwd: S.root, timeoutMs: 60000 }).catch(() => undefined)
  await tick($)
  await setFlash($, r && r.exitCode === 0 ? 'Fetched origin' : 'Fetch failed')
}

async function toggle($: any, key: 'busyOnly' | 'hideBg') {
  await update($, uiAtom, (u: UiState) => ({ ...u, [key]: !u[key] }))
  await savePrefs($)
}

async function loadNotes($: any): Promise<NoteRow[]> {
  await ensurePaths($)
  try {
    const parsed = JSON.parse(await $.fs.read(P.notes))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function syncNotes($: any) {
  const list = await loadNotes($)
  await update($, notesAtom, (old: NoteRow[]) => (same(old, list) ? old : list))
}

async function saveNotes($: any, change: (list: NoteRow[]) => NoteRow[]) {
  const next = change(await loadNotes($))
  await $.fs.write(P.notes, JSON.stringify(next, null, 1))
  await update($, notesAtom, () => next)
}

async function addNote($: any, text: string) {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean === '') return false
  const now: number = await $.clock.now()
  await saveNotes($, list => [...list, { id: now.toString(36), text: clean.slice(0, 300), done: false, at: now }])

  return true
}

async function noteFromPrompt($: any) {
  const box = await $.prompt.read()
  if (!(await addNote($, box.text))) return setFlash($, 'Type something in the prompt box first, then press Save')
  await $.prompt.fill({ text: '', mode: 'replace' })
  await setFlash($, 'Saved prompt as a note')
}

async function toggleNote($: any, id: string) {
  await saveNotes($, list => list.map(n => (n.id === id ? { ...n, done: !n.done } : n)))
}

async function deleteNote($: any, id: string) {
  await saveNotes($, list => list.filter(n => n.id !== id))
}

async function clearDone($: any) {
  await saveNotes($, list => list.filter(n => !n.done))
}

async function loadHistory($: any): Promise<HistoryRow[]> {
  await ensurePaths($)
  try {
    const parsed = JSON.parse(await $.fs.read(P.history))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function syncHistory($: any) {
  const list = await loadHistory($)
  await update($, historyAtom, (old: HistoryRow[]) => (same(old, list) ? old : list))
}

async function recordFinish($: any, row: HistoryRow) {
  const list = await loadHistory($)
  if (list.some(ev => ev.id === row.id)) return
  const next = [...list, row].sort((a, b) => a.at - b.at).slice(-MAX_HISTORY)
  await $.fs.write(P.history, JSON.stringify(next))
  await update($, historyAtom, () => next)
}

async function clearHistory($: any) {
  await $.fs.write(P.history, '[]')
  await update($, historyAtom, () => [])
  await setFlash($, 'History cleared')
}

async function loadPins($: any): Promise<PinRow[]> {
  await ensurePaths($)
  try {
    const parsed = JSON.parse(await $.fs.read(P.pins))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function syncPins($: any) {
  const list = await loadPins($)
  await update($, pinsAtom, (old: PinRow[]) => (same(old, list) ? old : list))
}

async function togglePin($: any, sessionId: string, name: string) {
  const list = await loadPins($)
  const next = list.some(pin => pin.sessionId === sessionId)
    ? list.filter(pin => pin.sessionId !== sessionId)
    : [...list, { sessionId, name }]
  await $.fs.write(P.pins, JSON.stringify(next))
  await update($, pinsAtom, () => next)
  await setFlash($, next.length > list.length ? `Pinned "${name}"` : `Unpinned "${name}"`)
}

const myMsgsFile = () => `${P.data}/messages/${S.sessionId}.json`

async function readMsgFile($: any, path: string): Promise<MessageRow[]> {
  try {
    const parsed = JSON.parse(await $.fs.read(path))
    return Array.isArray(parsed) ? parsed.filter(m => m && typeof m.id === 'string') : []
  } catch {
    return []
  }
}

// Every session appends only to messages/<session>.json; all files plus the legacy messages.json are merged on read.
async function loadMsgs($: any): Promise<MessageRow[]> {
  await ensurePaths($)
  const seen = new Set<string>()
  const out: MessageRow[] = []
  const add = (rows: MessageRow[]) => {
    for (const m of rows) {
      if (seen.has(m.id)) continue
      seen.add(m.id)
      out.push(m)
    }
  }
  let names: string[] = []
  try {
    names = (await $.fs.list(P.msgsDir)).map((e: { name: string }) => e.name).filter((n: string) => n.endsWith('.json'))
  } catch {
    // no messages dir yet
  }
  for (const n of names) add(await readMsgFile($, `${P.msgsDir}/${n}`))
  add(await readMsgFile($, P.msgs))

  return out.sort((a, b) => a.at - b.at).slice(-MAX_MSGS)
}

async function syncMsgs($: any) {
  const list = await loadMsgs($)
  await update($, msgsAtom, (old: MessageRow[]) => (same(old, list) ? old : list))
  // Tell the session whose claim or recent edit paused another session.
  for (const m of list) {
    if (!S.seenMsgs.has(m.id) && S.msgsReady && m.via === 'pause' && m.toId === S.sessionId && m.fromId !== S.sessionId) {
      $.ui.toast(`⏸ ${m.fromName} was paused: ${m.text}`.slice(0, 160), { timeoutMs: 10000 })
    }
    S.seenMsgs.add(m.id)
  }
  S.msgsReady = true
}

// One line in the Messages tab each time the pre-edit check pauses a session.
async function recordPause($: any, now: number, rel: string, other: { sessionId: string; name: string }, why: string) {
  const myName = (S.myName || short(S.sessionId)).replace(/["\n]/g, '').slice(0, 60)
  await recordMsg($, {
    id: `p${now.toString(36)}${Math.random().toString(36).slice(2, 5)}`, at: now,
    fromId: S.sessionId, fromName: myName, toId: other.sessionId, toName: other.name,
    text: `edit of ${rel} paused (${why})`, hop: 0, via: 'pause', delivered: true,
  }).catch(() => undefined)
}

// The sender and the receiver both record a message under the same id, so it appears once.
async function recordMsg($: any, row: MessageRow) {
  const mine = await readMsgFile($, myMsgsFile())
  if (mine.some(m => m.id === row.id)) return
  await $.fs.write(myMsgsFile(), JSON.stringify([...mine, row].slice(-MAX_MSGS)))
  await update($, msgsAtom, (old: MessageRow[]) => (old.some(m => m.id === row.id) ? old : [...old, row].sort((a, b) => a.at - b.at).slice(-MAX_MSGS)))
}

async function clearMsgs($: any) {
  // Clears this session's own file and the legacy shared file; other sessions' files are theirs.
  await $.fs.write(myMsgsFile(), '[]')
  await $.fs.write(P.msgs, '[]').catch(() => undefined)
  await update($, msgsAtom, (old: MessageRow[]) => old.filter(m => m.fromId !== S.sessionId && m.toId !== S.sessionId))
  await setFlash($, 'Messages cleared')
}

async function loadPrefs($: any): Promise<Partial<UiState>> {
  await ensurePaths($)
  try {
    const parsed = JSON.parse(await $.fs.read(P.prefs))
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

async function savePrefs($: any) {
  const u = fixUi(await read($, uiAtom))
  await $.fs.write(P.prefs, JSON.stringify({ tab: u.tab, busyOnly: u.busyOnly, hideBg: u.hideBg, notify: u.notify, precheck: u.precheck, sharePrompt: u.sharePrompt, theme: u.theme, jumpAuto: u.jumpAuto }))
}

async function applyPrefs($: any) {
  const saved = await loadPrefs($)
  await update($, uiAtom, (raw: UiState) => {
    const u = fixUi(raw)

    return fixUi({ ...u, ...saved, notify: { ...u.notify, ...(saved.notify ?? {}) }, flash: u.flash, detail: u.detail })
  })
}

function peersText(rows: PeerRow[], claims: ClaimRow[] = []) {
  if (rows.length === 0) return 'No other live Claude sessions found.'
  const claimLine = (id: string) => {
    const mine = claims.filter(c => c.sessionId === id)

    return mine.length ? ` | claims: ${mine.map(c => `${c.paths.join(', ')} until ${hhmm(c.expiresAt)}${c.note ? ` (${c.note})` : ''}`).join('; ')}` : ''
  }

  return rows
    .map(r => `- ${r.name} | ${r.status} | branch ${r.branch} | ${r.cwd}${r.files.length ? ` | editing: ${r.files.join(', ')}` : ''}${r.isSameProject ? '' : ' | other project'}${claimLine(r.sessionId)}`)
    .join('\n')
}

// One door for /tell and the message_peer tool. The tool path is hop- and rate-limited so two
// sessions can never answer each other forever; a human's /tell starts a fresh exchange.
async function sendToPeer($: any, needle: string, text: string, via: 'tell' | 'tool'): Promise<{ ok: boolean; msg: string }> {
  const now: number = await $.clock.now()
  const q = needle.trim().toLowerCase()
  if (q === '' || text.trim() === '') return { ok: false, msg: 'Need both a target session and a message.' }
  const hits = (await read($, peers)).filter((p: PeerRow) => p.sessionId.startsWith(q) || p.name.toLowerCase().includes(q))
  if (hits.length !== 1) {
    return {
      ok: false,
      msg: hits.length === 0
        ? `No parallel session matches "${needle}".`
        : `"${needle}" matches ${hits.length} sessions (${hits.map((x: PeerRow) => x.name).join(', ')}); be more specific.`,
    }
  }
  const target: PeerRow = hits[0]

  let hop = 1
  if (via === 'tool') {
    const ctx = S.hopCtx
    hop = (ctx !== null && now - ctx.at < HOP_WINDOW_MS ? ctx.hop : 0) + 1
    if (hop > MAX_HOPS) return { ok: false, msg: `Hop limit (${MAX_HOPS}) reached for this exchange. Stop messaging and tell the user instead.` }
    S.sent = S.sent.filter(t => now - t < RATE_WINDOW_MS)
    if (S.sent.length >= RATE_MAX) return { ok: false, msg: `Rate limit: ${RATE_MAX} peer messages per 10 minutes. Tell the user instead.` }
    S.sent.push(now)
  }

  const id = now.toString(36) + Math.random().toString(36).slice(2, 5)
  const myName = (S.myName || short(S.sessionId)).replace(/["\]\n]/g, '').slice(0, 60)
  const body = `[session-agents msg=${id} hop=${hop}/${MAX_HOPS} from="${myName}" fromId=${S.sessionId} reply-only-if-needed-via-message_peer] ${text.trim().slice(0, 1500)}`
  const sent = await $.session.send({ to: { sessionId: target.sessionId }, text: body })
  await recordMsg($, {
    id, at: now, fromId: S.sessionId, fromName: myName, toId: target.sessionId, toName: target.name,
    text: text.trim().slice(0, 500), hop, via, delivered: sent.isDelivered === true,
  })

  return sent.isDelivered
    ? { ok: true, msg: `Sent to "${target.name}" (hop ${hop}/${MAX_HOPS}).` }
    : { ok: false, msg: `Not delivered: ${sent.reason}` }
}

// Each session writes only its own claims file, so no two sessions ever write the same file.
// The legacy shared claims.json is still read for sessions on older versions, minus our own rows.
const myClaimsFile = () => `${P.claimsDir}/${S.sessionId}.json`

async function readClaimFile($: any, path: string): Promise<ClaimRow[]> {
  try {
    const parsed = JSON.parse(await $.fs.read(path))
    return Array.isArray(parsed) ? parsed.filter(c => c && typeof c.id === 'string' && typeof c.sessionId === 'string' && Array.isArray(c.paths)) : []
  } catch {
    return []
  }
}

async function loadClaims($: any): Promise<ClaimRow[]> {
  await ensurePaths($)
  const seen = new Set<string>()
  const out: ClaimRow[] = []
  const add = (rows: ClaimRow[]) => {
    for (const c of rows) {
      if (seen.has(c.id)) continue
      seen.add(c.id)
      out.push(c)
    }
  }
  let names: string[] = []
  try {
    names = (await $.fs.list(P.claimsDir)).map((e: { name: string }) => e.name).filter((n: string) => n.endsWith('.json'))
  } catch {
    // no claims dir yet
  }
  for (const n of names) add(await readClaimFile($, `${P.claimsDir}/${n}`))
  add((await readClaimFile($, P.claims)).filter(c => c.sessionId !== S.sessionId))

  return out
}

async function syncClaims($: any, now: number) {
  const list = (await loadClaims($)).filter(c => c.expiresAt > now)
  await update($, claimsAtom, (old: ClaimRow[]) => (same(old, list) ? old : list))
  for (const c of list) {
    if (c.sessionId !== S.sessionId && !S.seenClaims.has(c.id) && S.claimsReady) {
      $.ui.toast(`🔒 ${c.name} claimed ${c.paths.slice(0, 2).join(', ')}${c.paths.length > 2 ? '…' : ''} until ${hhmm(c.expiresAt)}`, { timeoutMs: 10000 })
    }
    S.seenClaims.add(c.id)
  }
  S.claimsReady = true
}

async function saveClaims($: any, change: (list: ClaimRow[]) => ClaimRow[]) {
  const now: number = await $.clock.now()
  const all = change(await loadClaims($)).filter(c => c.expiresAt > now)
  await $.fs.write(myClaimsFile(), JSON.stringify(all.filter(c => c.sessionId === S.sessionId)))
  await update($, claimsAtom, () => all)
}

// Paths are kept relative to the repo root so a claim matches the same file in every worktree.
function normPath(raw: string) {
  let x = raw.trim()
  if (S.root !== '' && x.startsWith(S.root + '/')) x = x.slice(S.root.length + 1)

  return x.replace(/^\.\//, '').replace(/\/+$/, '')
}

const claimMatches = (pattern: string, rel: string) => globMatches(pattern, rel)

const claimsOverlap = (a: string, b: string) => claimMatches(a, b) || claimMatches(b, a)

async function addClaim($: any, rawPaths: string[], note: string, minutes: number): Promise<{ ok: boolean; msg: string }> {
  const paths = [...new Set(rawPaths.map(normPath).filter(Boolean))].slice(0, 12)
  if (paths.length === 0) return { ok: false, msg: 'Give at least one file or folder to claim.' }
  const now: number = await $.clock.now()
  const mins = Math.min(CLAIM_MAX_MIN, Math.max(1, Math.round(Number.isFinite(minutes) && minutes > 0 ? minutes : CLAIM_DEFAULT_MIN)))
  const alive = new Set((await read($, peers)).map((p: PeerRow) => p.sessionId))
  const clashes = (await loadClaims($)).filter(
    c => c.sessionId !== S.sessionId && c.expiresAt > now && alive.has(c.sessionId) && c.paths.some(q => paths.some(mine => claimsOverlap(q, mine))),
  )
  const myName = (S.myName || short(S.sessionId)).replace(/["\n]/g, '').slice(0, 60)
  const claim: ClaimRow = {
    id: now.toString(36) + Math.random().toString(36).slice(2, 5),
    sessionId: S.sessionId, name: myName, paths, note: note.replace(/\s+/g, ' ').trim().slice(0, 160),
    at: now, expiresAt: now + mins * 60000,
  }
  await saveClaims($, list => [...list, claim])
  S.seenClaims.add(claim.id)
  const warn = clashes.length
    ? ` Warning: overlaps a claim by ${clashes.map(c => `"${c.name}" (${c.paths.join(', ')})`).join('; ')}. Coordinate with them (message_peer) before editing.`
    : ''

  return { ok: true, msg: `Claimed ${paths.join(', ')} until ${hhmm(claim.expiresAt)} (${mins} min).${warn}` }
}

async function releaseClaims($: any, rawPaths: string[]): Promise<string> {
  const paths = rawPaths.map(normPath).filter(Boolean)
  const before = (await loadClaims($)).filter(c => c.sessionId === S.sessionId).length
  await saveClaims($, list =>
    list.filter(c => c.sessionId !== S.sessionId || (paths.length > 0 && !c.paths.some(q => paths.some(x => claimsOverlap(q, x))))),
  )
  const after = (await loadClaims($)).filter(c => c.sessionId === S.sessionId).length

  return before === 0 ? 'You have no active claims.' : `Released ${before - after} claim${before - after === 1 ? '' : 's'}.`
}

// --- Local usage counts (counts only, never a path; shared by the CLI's `guardian usage`) ---
type UsageEvent = 'session_start' | 'hold_asked' | 'task_add' | 'task_done'
async function recordUsage($: any, event: UsageEvent) {
  try {
    if (P.usageDir === '' || S.sessionId === '') return
    const file = `${P.usageDir}/mod-${S.sessionId}.json`
    const day = new Date(await $.clock.now()).toISOString().slice(0, 10)
    let cur: { v: 1; installId: string; firstSeen: string; days: Record<string, Record<string, number>> } | null = null
    try {
      const parsed = JSON.parse(await $.fs.read(file))
      if (parsed && parsed.v === 1 && parsed.days) cur = parsed
    } catch {
      // first write
    }
    if (cur === null) cur = { v: 1, installId: Math.random().toString(16).slice(2, 14).padEnd(12, '0'), firstSeen: day, days: {} }
    const d = (cur.days[day] ??= {})
    d[event] = (d[event] ?? 0) + 1
    await $.fs.write(file, JSON.stringify(cur))
  } catch {
    // best effort, never in the way
  }
}

// --- Task ownership (shared by every worktree of the repo) -----------------
const tasksFile = () => taskFilePath(S.project || `${S.root}/.git`)

async function loadTasks($: any): Promise<TaskRow[]> {
  try {
    return parseTasks(await $.fs.read(tasksFile()))
  } catch {
    return []
  }
}

async function saveTasks($: any, change: (list: TaskRow[]) => TaskRow[]) {
  const next = change(await loadTasks($))
  await $.fs.write(tasksFile(), serializeTasks(next))
  await update($, tasksAtom, () => next)

  return next
}

async function syncTasks($: any) {
  const list = await loadTasks($)
  await update($, tasksAtom, (old: TaskRow[]) => (same(old, list) ? old : list))
  const key = list.filter(t => t.status === 'active').map(t => `${t.id}@${t.branch}`).join('|')
  if (S.tasksSeen !== '' && key !== S.tasksSeen) {
    const added = list.filter(t => t.status === 'active' && !S.tasksSeen.includes(`${t.id}@${t.branch}`))
    if (added.length) $.ui.toast(`📌 task ${added[0].id} now owns ${added[0].paths.slice(0, 2).join(', ')} on ${added[0].branch || 'any branch'}`, { timeoutMs: 10000 })
  }
  S.tasksSeen = key
}

async function addTask($: any, args: string): Promise<string> {
  const r = parseTaskAdd(args, S.branch === '?' ? '' : S.branch)
  if (!r.ok) return r.msg
  const now: number = await $.clock.now()
  const myName = (S.myName || short(S.sessionId)).replace(/["\n]/g, '').slice(0, 60)
  const existing = await loadTasks($)
  if (existing.some(t => t.id === r.id && t.status === 'active')) return `Task ${r.id} already exists. /task done ${r.id} first, or pick another id.`
  const task: TaskRow = { id: r.id, paths: r.paths, branch: r.branch, owner: myName, note: r.note, createdAt: now, status: 'active' }
  const overlaps = tasksOverlap([...existing.filter(t => t.id !== r.id), task]).filter(o => o.a.id === r.id || o.b.id === r.id)
  await saveTasks($, list => [...list.filter(t => t.id !== r.id), task])
  void recordUsage($, 'task_add')
  const warn = overlaps.length
    ? ` Warning: overlaps ${overlaps.map(o => `${o.a.id === r.id ? o.b.id : o.a.id} on ${o.on}`).join('; ')}. Narrow the paths or sequence the work.`
    : ''

  return `Task ${r.id} owns ${r.paths.join(', ')} on ${r.branch || 'any branch'} (saved to ${home(tasksFile())}).${warn}`
}

async function finishTask($: any, id: string): Promise<string> {
  const list = await loadTasks($)
  if (!list.some(t => t.id === id && t.status === 'active')) return `No active task "${id}".`
  await saveTasks($, l => l.map(t => (t.id === id ? { ...t, status: 'done' as const } : t)))
  void recordUsage($, 'task_done')

  return `Task ${id} marked done; its paths are released.`
}

function tasksText(tasks: TaskRow[], branch: string) {
  const active = tasks.filter(t => t.status === 'active')
  if (active.length === 0) return 'No tasks declared. /task add <ID> <paths> [--branch <name>] [note]'
  const overlaps = tasksOverlap(active)

  return [
    ...active.map(t => `- ${t.id} | ${t.paths.join(', ')} | ${t.branch || 'any branch'}${t.branch !== '' && t.branch === branch ? ' (this branch)' : ''}${t.owner ? ` | ${t.owner}` : ''}${t.note ? ` | ${t.note}` : ''}`),
    ...overlaps.map(o => `! ${o.a.id} and ${o.b.id} both claim ${o.on}`),
  ].join('\n')
}

const fmtTok = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(Math.round(n)))

const bar = (pct: number, width = 20) => {
  const filled = Math.round((Math.min(100, Math.max(0, pct)) / 100) * width)

  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

const level = (pct: number) => (pct >= 85 ? 'red' : pct >= 60 ? 'yellow' : 'green')

const untilReset = (iso: string, now: number) => {
  const ms = Date.parse(iso) - now
  if (!Number.isFinite(ms) || ms <= 0) return 'now'
  const mins = Math.round(ms / 60000)

  return mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440) / 60)}h`
}

const LIMIT_LABEL: Record<string, string> = { five_hour: '5-hour window', seven_day: '7-day window', spend_limit: 'spend limit' }

// Reads only the bytes a transcript gained since the last look and sums the assistant messages'
// token usage. One message is written as several lines with the same id and the same usage, so
// the last line per id counts once. Output is one JSON line.
const USAGE_SCRIPT = [
  'import sys, json',
  'path, off = sys.argv[1], int(sys.argv[2])',
  'try:',
  '    f = open(path, "rb"); f.seek(0, 2); size = f.tell()',
  '    if off > size: off = 0',
  '    f.seek(off); data = f.read(); f.close()',
  'except Exception:',
  '    print(json.dumps({"ok": False})); sys.exit()',
  'end = data.rfind(b"\\n")',
  'used = data[: end + 1] if end >= 0 else b""',
  'by_id = {}',
  'for line in used.split(b"\\n"):',
  '    if b\'"usage"\' not in line: continue',
  '    try: d = json.loads(line)',
  '    except Exception: continue',
  '    m = d.get("message") or {}',
  '    u = m.get("usage")',
  '    if d.get("type") != "assistant" or not isinstance(u, dict): continue',
  '    by_id[m.get("id") or d.get("uuid")] = (u, m.get("model") or "")',
  'inp = out = cc = cr = last = 0; model = ""',
  'for u, mo in by_id.values():',
  '    i = u.get("input_tokens") or 0; o = u.get("output_tokens") or 0',
  '    a = u.get("cache_creation_input_tokens") or 0; b = u.get("cache_read_input_tokens") or 0',
  '    inp += i; out += o; cc += a; cr += b; last = i + a + b; model = mo or model',
  'print(json.dumps({"ok": True, "off": off + len(used), "inp": inp, "out": out, "cc": cc, "cr": cr, "turns": len(by_id), "last": last, "model": model}))',
].join('\n')

async function scanTranscript($: any, sessionId: string, cwd: string) {
  const prev = S.usageCache.get(sessionId) ?? { off: 0, inp: 0, out: 0, cc: 0, cr: 0, turns: 0, last: 0, model: '' }
  const file = `${P.projects}/${cwd.replace(/[^a-zA-Z0-9]/g, '-')}/${sessionId}.jsonl`
  const r = await $.process.run(['python3', '-c', USAGE_SCRIPT, file, String(prev.off)], { timeoutMs: 90000 }).catch(() => undefined)
  S.pyFailed = !r || r.exitCode !== 0
  if (!r || r.exitCode !== 0) return prev
  try {
    const d = JSON.parse((r.stdout as string).trim().split('\n').pop() ?? '{}')
    if (!d.ok) return prev
    // After a rewind to 0 the file is a different one: drop the old totals.
    const base = d.off - 0 < prev.off ? { ...prev, inp: 0, out: 0, cc: 0, cr: 0, turns: 0 } : prev
    const next = {
      off: d.off, inp: base.inp + d.inp, out: base.out + d.out, cc: base.cc + d.cc, cr: base.cr + d.cr,
      turns: base.turns + d.turns, last: d.turns > 0 ? d.last : base.last, model: d.model || base.model,
    }
    S.usageCache.set(sessionId, next)

    return next
  } catch {
    return prev
  }
}

async function usageTick($: any) {
  if (S.usageBusy || S.sessionId === '') return
  S.usageBusy = true
  try {
    const now: number = await $.clock.now()
    let limits: LimitRow[] = []
    let myWindow = 0
    let myCtx: number | undefined
    let myCost = 0
    try {
      const u = await $.session.usage()
      limits = (u.rateLimits ?? []).map((l: any) => ({ kind: String(l.kind), percentUsed: Number(l.percentUsed) || 0, resetsAt: String(l.resetsAt ?? '') }))
      myWindow = Number(u.context?.window) || 0
      myCtx = typeof u.context?.tokens === 'number' ? u.context.tokens : undefined
      myCost = Number(u.cost?.usd) || 0
    } catch {
      // not available in this host
    }

    const targets: { sessionId: string; name: string; cwd: string; isSelf: boolean }[] = [
      { sessionId: S.sessionId, name: S.myName || short(S.sessionId), cwd: S.myCwd || S.root, isSelf: true },
      ...(await read($, peers)).map((p: PeerRow) => ({ sessionId: p.sessionId, name: p.name, cwd: p.cwd, isSelf: false })),
    ]
    const rows: UsageRow[] = []
    for (const tg of targets) {
      const t = await scanTranscript($, tg.sessionId, tg.cwd)
      const ctx = tg.isSelf && myCtx !== undefined ? myCtx : t.last
      const window = tg.isSelf && myWindow > 0 ? myWindow : ctx > 200000 ? 1000000 : 200000
      rows.push({
        sessionId: tg.sessionId, name: tg.name, isSelf: tg.isSelf, ctx, window,
        isEstimate: !(tg.isSelf && myWindow > 0), turns: t.turns, output: t.out, input: t.inp,
        cacheCreate: t.cc, cacheRead: t.cr, model: t.model, costUsd: tg.isSelf ? myCost : 0,
      })
    }
    rows.sort((a, b) => Number(b.isSelf) - Number(a.isSelf) || b.ctx / b.window - a.ctx / a.window)

    const info: UsageInfo = { at: now, limits, rows }
    await update($, usageAtom, (old: UsageInfo | null) => (same(old, info) ? old : info))

    // Warn once when a session's context, or a plan window, crosses 80% / 95%.
    for (const r of rows) {
      const pct = r.window > 0 ? (r.ctx / r.window) * 100 : 0
      const step = pct >= 95 ? 95 : pct >= 80 ? 80 : 0
      const prev = S.ctxWarned.get(r.sessionId) ?? 0
      if (step > prev && S.usageReady) {
        $.ui.toast(`⚠ ${r.isSelf ? 'this session' : r.name}: context ${Math.round(pct)}% full (${fmtTok(r.window - r.ctx)} left)`, { timeoutMs: 12000 })
      }
      S.ctxWarned.set(r.sessionId, step)
    }
    for (const l of limits) {
      for (const step of [80, 95]) {
        const key = `${l.kind}:${step}:${l.resetsAt}`
        if (l.percentUsed >= step && !S.limitWarned.has(key)) {
          S.limitWarned.add(key)
          if (S.usageReady) $.ui.toast(`⚠ ${LIMIT_LABEL[l.kind] ?? l.kind} ${Math.round(l.percentUsed)}% used`, { timeoutMs: 12000 })
        }
      }
    }
    S.usageReady = true
  } finally {
    S.usageBusy = false
  }
}

async function observe($: any, r: any, now: number, isSelf: boolean) {
  const status: string = r.status ?? '?'
  const before = S.lastStatus.get(r.sessionId)
  S.lastStatus.set(r.sessionId, status)
  const at: number = r.statusUpdatedAt ?? now
  const name: string = r.name ?? short(r.sessionId)
  if (status === 'busy' && before !== 'busy') S.busySince.set(r.sessionId, at)
  if (before !== undefined && before !== status && !isSelf) await notifyChange($, r.sessionId, name, before, status)
  if (before !== 'busy' || status === 'busy') return

  const started = S.busySince.get(r.sessionId)
  const cached = S.activityOf.get(r.sessionId)
  S.busySince.delete(r.sessionId)
  await recordFinish($, {
    id: `${short(r.sessionId)}-${at}`,
    sessionId: r.sessionId,
    name,
    outcome: status,
    at,
    durationMs: started === undefined ? 0 : Math.max(0, at - started),
    branch: isSelf ? S.branch : (S.projectOf.get(r.cwd) !== undefined ? await git($, r.cwd, 'rev-parse', '--abbrev-ref', 'HEAD') : ''),
    task: isSelf ? S.prompt : cached?.task ?? '',
    activity: isSelf ? '' : cached?.activity ?? '',
  })
}

async function notifyChange($: any, sessionId: string, name: string, before: string, status: string) {
  const pref: Notify = fixUi(await read($, uiAtom)).notify
  const isPinned = (await read($, pinsAtom)).some((pin: PinRow) => pin.sessionId === sessionId)
  const star = isPinned ? '★ ' : ''
  const extra = isPinned ? 4000 : 0
  if (status === 'busy') {
    if (pref.start || isPinned) $.ui.toast(`${star}▶ ${name} started working`, { timeoutMs: 6000 + extra })
  } else if (status === 'idle') {
    if (pref.done || isPinned) $.ui.toast(`${star}✓ ${name} is idle, waiting for your next task`, { timeoutMs: 10000 + extra })
  } else if (status === 'shell') {
    if (pref.done || isPinned) $.ui.toast(`${star}✓ ${name} finished its turn (background shell still running)`, { timeoutMs: 8000 + extra })
  } else if (pref.wait || isPinned) {
    $.ui.toast(`${star}⏸ ${name} needs you (${status})`, { timeoutMs: 12000 + extra })
  }
}

async function toggleNotify($: any, key: keyof Notify) {
  await update($, uiAtom, (raw: UiState) => {
    const u = fixUi(raw)

    return { ...u, notify: { ...u.notify, [key]: !u.notify[key] } }
  })
  await savePrefs($)
}

async function runAction($: any, key: string) {
  const a = ACTIONS.find(x => x.key === key)
  if (a === undefined) return
  const r = await $.process.run(a.argv, { cwd: S.root, timeoutMs: 20000 }).catch(() => undefined)
  const text = r ? `${r.stdout}${r.exitCode === 0 ? '' : r.stderr}`.trim() : ''
  const lines = text === '' ? [r === undefined ? 'command could not start' : '(no output)'] : text.split('\n')
  await setFlash($, `${a.label}${r && r.exitCode !== 0 ? `  (exit ${r.exitCode})` : ''}`, lines.slice(0, 18))
}

async function copyGit($: any, what: 'branch' | 'commit' | 'root') {
  const text =
    what === 'branch' ? S.branch : what === 'root' ? S.root : await git($, S.root, 'rev-parse', '--short', 'HEAD')
  await copyText($, text, what)
}

async function appRunning($: any, name: string) {
  const r = await $.process.run(['pgrep', '-x', name]).catch(() => undefined)

  return r !== undefined && r.exitCode === 0
}

async function osa($: any, script: string): Promise<{ ok: boolean; out: string; err: string }> {
  const r = await $.process.run(['osascript', '-e', script], { timeoutMs: 8000 }).catch((e: unknown) => ({ exitCode: 1, stdout: '', stderr: String(e) }))

  return { ok: r.exitCode === 0, out: (r.stdout as string).trim(), err: (r.stderr as string).trim() }
}

const oneLine = (text: string) => text.replace(/\s+/g, ' ').slice(0, 200)

// Bring a session into view in the terminal you already have: iTerm2 shows a tab per session
// (interactive ones by their tty, background jobs by the session name in the tab title), so the
// tab is selected in place. Only when no tab exists is `claude attach` opened in a new tab.
// Everything put into AppleScript text is restricted to safe characters first, and every
// failure stays in the pane's yellow box.
async function jumpTo($: any, p: PeerRow) {
  // Switching terminal tabs scripts iTerm2 / Terminal.app, so it is macOS-only and can be switched off.
  const auto = S.isMac && fixUi(await read($, uiAtom)).jumpAuto
  const dev = /^ttys\d+$/.test(p.tty) ? `/dev/${p.tty}` : ''
  const needle = p.name.replace(/[^A-Za-z0-9 _.\-]/g, '').trim().slice(0, 40)
  const isJob = /^[A-Za-z0-9]+$/.test(p.jobId)
  const problems: string[] = []

  if (auto && (await appRunning($, 'iTerm2'))) {
    const conds = [dev !== '' ? `(tty of s is "${dev}")` : '', needle.length >= 4 ? `(name of s contains "${needle}")` : ''].filter(Boolean)
    if (conds.length > 0) {
      const r = await osa($, [
        'tell application "iTerm2"', 'activate',
        'repeat with w in windows', 'repeat with t in tabs of w', 'repeat with s in sessions of t',
        `if ${conds.join(' or ')} then`, 'select w', 'tell t to select', 'tell s to select', 'return "ok"',
        'end if', 'end repeat', 'end repeat', 'end repeat', 'return "none"', 'end tell',
      ].join('\n'))
      if (r.ok && r.out === 'ok') return setFlash($, `Jumped to "${p.name}" in iTerm2`)
      problems.push(`iTerm2: ${r.ok ? 'no open tab for this session' : oneLine(r.err)}`)
    }
  }

  if (p.kind === 'bg' && isJob) {
    const cmd = `claude attach ${p.jobId}`
    if (auto && (await appRunning($, 'iTerm2'))) {
      const r = await osa($, [
        'tell application "iTerm2"', 'activate',
        'if (count of windows) is 0 then', 'create window with default profile',
        'else', 'tell current window to create tab with default profile', 'end if',
        `tell current session of current window to write text "${cmd}"`,
        'end tell',
      ].join('\n'))
      if (r.ok) return setFlash($, `No open tab for "${p.name}": attached it in a new iTerm2 tab`, [cmd, ...problems])
      problems.push(`iTerm2 attach: ${oneLine(r.err || r.out || 'no output')}`)
    }
    await $.ui.copy({ text: cmd, surface: 'terminal' })
    return setFlash($, `Copied: ${cmd}`, ['Paste it into a terminal tab to open the job.', ...problems])
  }

  if (auto && dev !== '' && (await appRunning($, 'Terminal'))) {
    const r = await osa($, [
      'tell application "Terminal"', 'activate',
      'repeat with w in windows', 'repeat with t in tabs of w',
      `if tty of t is "${dev}" then`, 'set selected of t to true', 'set index of w to 1', 'return "ok"',
      'end if', 'end repeat', 'end repeat', 'return "none"', 'end tell',
    ].join('\n'))
    if (r.ok && r.out === 'ok') return setFlash($, `Jumped to "${p.name}" (${p.tty}) in Terminal`)
    problems.push(`Terminal: ${r.ok ? `no tab with ${p.tty}` : oneLine(r.err)}`)
  }

  await $.ui.copy({ text: `cd ${p.cwd}`, surface: 'terminal' })
  await setFlash($, `Could not switch automatically to "${p.name}"`, [
    p.tty ? `It runs on ${p.tty}. Switch to that terminal tab yourself.` : 'It has no terminal tab of its own.',
    `Copied: cd ${p.cwd}`,
    ...problems,
  ])
}

async function toggleTheme($: any) {
  await update($, uiAtom, (raw: UiState) => {
    const u = fixUi(raw)

    return { ...u, theme: u.theme === 'light' ? 'dark' : 'light' }
  })
  await savePrefs($)
}

async function toggleJump($: any) {
  await update($, uiAtom, (raw: UiState) => {
    const u = fixUi(raw)

    return { ...u, jumpAuto: !u.jumpAuto }
  })
  await savePrefs($)
}

async function toggleSharePrompt($: any) {
  await update($, uiAtom, (raw: UiState) => {
    const u = fixUi(raw)

    return { ...u, sharePrompt: !u.sharePrompt }
  })
  await savePrefs($)
}

async function togglePrecheck($: any) {
  await update($, uiAtom, (raw: UiState) => {
    const u = fixUi(raw)

    return { ...u, precheck: !u.precheck }
  })
  await savePrefs($)
}

async function setTab($: any, tab: Tab) {
  await update($, uiAtom, (u: UiState) => ({ ...u, tab }))
  await savePrefs($)
}

function composeNote(rows: PeerRow[], claims: ClaimRow[], tasks: TaskRow[] = [], branch = '') {
  const mates = rows.filter(r => r.isSameProject)
  const active = tasks.filter(t => t.status === 'active')
  const taskLines = active.length === 0 ? [] : [
    'Declared task ownership for this repository (shared by all worktrees):',
    ...active.map(t => `- ${t.id} owns ${t.paths.join(', ')} on ${t.branch || 'any branch'}${t.branch !== '' && t.branch === branch ? ' (your branch)' : ''}${t.note ? ` (${t.note})` : ''}`),
    'Editing a path owned by a task on another branch pauses the edit and asks the user. Stay inside your task; use /task add to declare new work.',
  ]
  if (mates.length === 0) return taskLines.join('\n')
  const claimLines = claims
    .filter(c => mates.some(m => m.sessionId === c.sessionId))
    .map(c => `- "${c.name}" has claimed ${c.paths.join(', ')} until ${hhmm(c.expiresAt)}${c.note ? ` (${c.note})` : ''}`)

  return [
    'Other Claude sessions are active on this same git project right now (do not touch their branches or worktrees):',
    ...mates.map(
      r =>
        `- "${r.name}" (session ${short(r.sessionId)}, ${r.status}) on ${r.branch} in ${r.cwd}` +
        (r.overlap.length ? `. OVERLAP, both of you edited: ${r.overlap.join(', ')}` : ''),
    ),
    ...(claimLines.length ? ['Claimed by other sessions (do not edit these without coordinating first):', ...claimLines] : []),
    'When you start a larger piece of work in specific files, announce it with the claim_files tool so others stay out; release_claims when done.',
    'Before editing a file one of them has touched, send that session a short message with the message_peer tool (list_peers shows who is around and what they are editing), then tell the user. Keep it to one message; do not start a long exchange.',
    ...taskLines,
  ].join('\n')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await init($)
    for (const spec of [
      { name: 'tell', description: 'Message a parallel session: /tell <name-or-id-prefix> <text>' },
      { name: 'note', description: 'Save a note: /note <text>' },
      { name: 'claim', description: 'Claim files for a while: /claim [minutes] <path[,path...]> [note]' },
      { name: 'release', description: 'Release your claims: /release [path|all]' },
      { name: 'sessions', description: 'Open the sessions + worktrees control pane' },
      { name: 'task', description: 'Declare task ownership: /task add <ID> <paths> [--branch <name>] [note] | /task done <ID> | /task list' },
    ]) {
      await $.command.register(spec).catch(() => undefined)
    }

    await applyPrefs($)
    await $.tool.register({
      name: 'message_peer',
      description:
        'Send a short plain-text message to another live Claude session on this machine (call list_peers first for names). Use sparingly, only to coordinate on shared files or hand off one fact. The user can see every message; exchanges are hop-limited and the receiver may not answer. Never include secrets.',
      inputSchema: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Session name fragment or session id prefix' },
          text: { type: 'string', description: 'The message' },
        },
        required: ['to', 'text'],
      },
    }).catch(() => undefined)
    await $.tool.register({
      name: 'claim_files',
      description:
        'Announce that you are working on specific files or folders so other Claude sessions stay out. Other sessions are paused on their first edit to a claimed path and told to message you. Paths are relative to the repo root; a folder claims everything under it and * / ** patterns work. Claims expire (default 60 minutes, max 480) or end when you call release_claims. Use it for real multi-edit work, not for a single small change.',
      inputSchema: {
        type: 'object',
        properties: {
          paths: { type: 'array', items: { type: 'string' }, description: 'Files, folders or patterns to claim' },
          note: { type: 'string', description: 'What you are doing, one short line' },
          minutes: { type: 'number', description: 'How long to hold the claim (default 60)' },
        },
        required: ['paths'],
      },
    }).catch(() => undefined)
    await $.tool.register({
      name: 'release_claims',
      description: 'Release claims you made with claim_files. Pass paths to release just those, or nothing to release all of yours.',
      inputSchema: { type: 'object', properties: { paths: { type: 'array', items: { type: 'string' } } } },
    }).catch(() => undefined)
    await $.tool.register({
      name: 'list_tasks',
      description: 'List declared task ownership for this repository: which task owns which paths on which branch, and any declared overlaps. Check it before editing outside your own task.',
      inputSchema: { type: 'object', properties: {} },
    }).catch(() => undefined)
    await $.tool.register({
      name: 'list_peers',
      description: 'List the other live Claude sessions on this machine: name, status, git branch, directory and files they are editing.',
      inputSchema: { type: 'object', properties: {} },
    }).catch(() => undefined)

    if (!S.isTimerOn) {
      S.isTimerOn = true
      $.clock.every(BEAT_MS, () => void tick($))
      $.clock.every(30000, () => void usageTick($))
    }
    void usageTick($)
    await tick($)
    void recordUsage($, 'session_start')

    return next(e)
  })

  on('prompt.submit', ($, e, next) => {
    if ((e as { origin?: { kind?: string } }).origin?.kind === 'composer') S.hopCtx = null
    S.prompt = e.text.replace(/\s+/g, ' ').slice(0, 100)

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const path = (e as { file_path?: unknown }).file_path
    const isEdit = e.tool === 'Edit' || e.tool === 'Write' || e.tool === 'MultiEdit' || e.tool === 'NotebookEdit'
    if (isEdit && typeof path === 'string') {
      const rel = path.startsWith(S.root + '/') ? path.slice(S.root.length + 1) : path
      const now: number = await $.clock.now()

      // Task ownership: a path owned by an active task on another branch is held while the user decides.
      const violated = findViolation(await loadTasks($), rel, S.branch, S.taskAllowed)
      if (violated !== undefined) {
        const q = `Task ${violated.id} owns ${violated.paths.join(', ')} on ${violated.branch}; this session is on ${S.branch}. Allow editing ${rel}?`
        let answer = 'Deny'
        void recordUsage($, 'hold_asked')
        try {
          answer = await $.ui.ask(q, { header: 'Ownership', options: ['Allow once', 'Allow this task for the session', 'Deny'] })
        } catch {
          answer = 'Deny'
        }
        await recordPause($, now, rel, { sessionId: '', name: `task ${violated.id}` }, `owned by task ${violated.id} on ${violated.branch}: ${answer}`).catch(() => undefined)
        if (answer === 'Allow this task for the session') S.taskAllowed.add(violated.id)
        else if (answer !== 'Allow once') {
          return { deny: `session-agents: ${rel} is owned by task ${violated.id} (${violated.paths.join(', ')}) on branch ${violated.branch}, and this session is on ${S.branch}. The user declined this edit. Work inside your own task's paths, switch to that branch, or ask the user to run /task done ${violated.id}.` }
        }
      }

      // Pre-edit check: another session on this project edited this file a moment ago. The first
      // attempt is refused with the reason; a retry within a few minutes goes through.
      if (fixUi(await read($, uiAtom)).precheck) {
        const clash = (await read($, peers)).find(
          (p: PeerRow) => p.isSameProject && now - (p.editAt[rel] ?? 0) < PRECHECK_WINDOW_MS,
        )
        if (clash !== undefined) {
          const key = `${clash.sessionId}:${rel}`
          if (now - (S.warned.get(key) ?? 0) > WARN_MEMORY_MS) {
            S.warned.set(key, now)
            const mins = Math.max(1, Math.round((now - clash.editAt[rel]) / 60000))
            await recordPause($, now, rel, clash, `${clash.name} edited it ${mins} min ago`)
            $.ui.toast(`⚠ "${clash.name}" also edits ${rel}; paused to coordinate`, { timeoutMs: 8000 })

            return {
              deny: `session-agents: the session "${clash.name}" (branch ${clash.branch}) edited ${rel} ${mins} minute${mins > 1 ? 's' : ''} ago. Send it a short message with the message_peer tool (or ask the user) before editing. If you have coordinated, or it does not matter, repeat the same edit and it will go through.`,
            }
          }
        }
      }

      // A claim is an explicit announcement, so it is checked the same way: first attempt paused.
      if (fixUi(await read($, uiAtom)).precheck) {
        const alive = new Set((await read($, peers)).map((p: PeerRow) => p.sessionId))
        const held = (await read($, claimsAtom)).find(
          (c: ClaimRow) => c.sessionId !== S.sessionId && c.expiresAt > now && alive.has(c.sessionId) && c.paths.some(pat => claimMatches(pat, rel)),
        )
        if (held !== undefined) {
          const key = `claim:${held.id}:${rel}`
          if (now - (S.warned.get(key) ?? 0) > WARN_MEMORY_MS) {
            S.warned.set(key, now)
            await recordPause($, now, rel, { sessionId: held.sessionId, name: held.name }, `claimed by ${held.name} until ${hhmm(held.expiresAt)}`)
            $.ui.toast(`🔒 ${rel} is claimed by "${held.name}"; paused to coordinate`, { timeoutMs: 8000 })

            return {
              deny: `session-agents: "${held.name}" has claimed ${held.paths.join(', ')} until ${hhmm(held.expiresAt)}${held.note ? ` (${held.note})` : ''}. Send it a short message with the message_peer tool (or ask the user) before editing ${rel}. If you have coordinated, or it does not matter, repeat the same edit and it will go through.`,
            }
          }
        }
      }

      // Record the edit only once it went through (a denied or failed edit must not pause other sessions).
      const ran = await next(e)
      if (ran.deny === undefined && ran.isError !== true) {
        S.files = [...S.files.filter(f => f !== rel), rel].slice(-MAX_FILES)
        S.editAt.set(rel, now)
        if (S.editAt.size > MAX_FILES) S.editAt.delete(S.editAt.keys().next().value as string)
      }

      return ran
    }

    return next(e)
  }).catch(($, e, next) => (next.called ? next(e) : next(e)))

  on('prompt.compose', async ($, e, next) => {
    const out = await next(e)
    const now: number = await $.clock.now()
    const note = composeNote(await read($, peers), (await read($, claimsAtom)).filter((c: ClaimRow) => c.expiresAt > now), await read($, tasksAtom), S.branch)
    if (note === '') return out

    return { sections: [...out.sections, { id: 'session-agents:peers', text: note, scope: 'session' as const }] }
  })

  on('command.run', { command: 'sessions' }, async $ => {
    await tick($)
    await $.ui.open({ id: PANE, title: 'Control tower' })

    return { text: 'Control tower opened.' }
  })

  on('command.run', { command: 'agents' }, async $ => {
    await tick($)
    await $.ui.open({ id: PANE, title: 'Control tower' })

    return { text: 'Control tower opened.' }
  })

  on('command.run', { command: 'note' }, async ($, e) => {
    if (!(await addNote($, e.args))) return { text: 'Usage: /note <text>' }
    const open = (await read($, notesAtom)).filter(n => !n.done).length

    return { text: `Saved. ${open} open note${open === 1 ? '' : 's'}.` }
  })

  on('command.run', { command: 'tell' }, async ($, e) => {
    const [needle = '', ...words] = e.args.trim().split(/\s+/)
    if (needle === '' || words.length === 0) return { text: 'Usage: /tell <name-or-session-id-prefix> <message>' }
    const r = await sendToPeer($, needle, words.join(' '), 'tell')

    return { text: r.msg }
  })

  on('session.receive', async ($, e, next) => {
    if (e.origin.kind === 'peer' || e.origin.kind === 'peer-send-message') {
      const now: number = await $.clock.now()
      const m = MARKER.exec(e.text)
      const hop = m ? Number(m[2]) : 1
      const body = m ? e.text.slice(m.index + m[0].length) : e.text
      const fromName = m ? m[4] : 'another session'
      S.hopCtx = { hop, at: now }
      await recordMsg($, {
        id: m ? m[1] : `r${now.toString(36)}`, at: now, fromId: m ? m[5] : '', fromName,
        toId: S.sessionId, toName: S.myName || short(S.sessionId),
        text: body.trim().slice(0, 500), hop, via: 'received', delivered: true,
      }).catch(() => undefined)
      $.ui.toast(`✉ ${fromName}: ${body.replace(/\s+/g, ' ').trim().slice(0, 70)}`, { timeoutMs: 10000 })
    }

    return next(e)
  })

  on('command.run', { command: 'claim' }, async ($, e) => {
    const tokens = e.args.trim().split(/\s+/).filter(Boolean)
    let minutes = CLAIM_DEFAULT_MIN
    if (tokens.length > 0 && /^\d+$/.test(tokens[0])) minutes = Number(tokens.shift())
    const pathToken = tokens.shift()
    if (pathToken === undefined) return { text: 'Usage: /claim [minutes] <path[,path...]> [note]' }
    const r = await addClaim($, pathToken.split(',').filter(Boolean), tokens.join(' '), minutes)

    return { text: r.msg }
  })

  on('command.run', { command: 'release' }, async ($, e) => {
    const arg = e.args.trim()

    return { text: await releaseClaims($, arg === '' || arg === 'all' ? [] : arg.split(/[\s,]+/)) }
  })

  on('tool.call', { tool: TOOL_CLAIM }, async ($, e) => {
    const args = e as unknown as { paths?: unknown; note?: unknown; minutes?: unknown }
    const paths = Array.isArray(args.paths) ? args.paths.map(String) : typeof args.paths === 'string' ? [args.paths] : []
    const r = await addClaim($, paths, String(args.note ?? ''), Number(args.minutes))

    return { result: r.msg }
  })

  on('tool.call', { tool: TOOL_RELEASE }, async ($, e) => {
    const args = e as unknown as { paths?: unknown }
    const paths = Array.isArray(args.paths) ? args.paths.map(String) : typeof args.paths === 'string' ? [args.paths] : []

    return { result: await releaseClaims($, paths) }
  })

  on('tool.call', { tool: TOOL_SEND }, async ($, e) => {
    const args = e as unknown as { to?: unknown; text?: unknown }
    const r = await sendToPeer($, String(args.to ?? ''), String(args.text ?? ''), 'tool')

    return { result: r.msg }
  })

  on('command.run', { command: 'task' }, async ($, e) => {
    const [sub = '', ...rest] = e.args.trim().split(/\s+/)
    const usage = 'Usage: /task add <ID> <path[,path...]> [--branch <name>] [note] | /task done <ID> | /task list'
    if (sub === 'add') return { text: await addTask($, rest.join(' ')) }
    if (sub === 'done') return { text: rest[0] ? await finishTask($, rest[0]) : usage }
    if (sub === 'list' || sub === '') return { text: tasksText(await loadTasks($), S.branch) }

    return { text: usage }
  })

  on('tool.call', { tool: TOOL_TASKS }, async $ => ({ result: tasksText(await loadTasks($), S.branch) }))

  on('tool.call', { tool: TOOL_LIST }, async $ => ({ result: peersText(await read($, peers), await read($, claimsAtom)) }))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const [info, others] = await Promise.all([read($, gitAtom), read($, peers)])
    if (e.props.hasSurvey || info === null) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const busy = others.filter(p => p.status === 'busy').length
    const sync = [info.ahead ? `↑${info.ahead}` : '', info.behind ? `↓${info.behind}` : ''].filter(Boolean).join('')

    return (
      <Box>
        <Text>
          <Text color="cyan" bold>⎇ {info.branch}</Text>
          {info.dirty ? <Text color="yellow"> ±{info.dirty}</Text> : <Text color="green"> ✓</Text>}
          {info.ahead ? <Text color="green"> ↑{info.ahead}</Text> : null}
          {info.behind ? <Text color="red"> ↓{info.behind}</Text> : null}
          <Text dimColor>  │  </Text>
          <Text color={busy ? 'green' : 'white'}>{others.length} session{others.length === 1 ? '' : 's'}{busy ? ` (${busy} busy)` : ''}</Text>
          <Text dimColor>  │  </Text>
          <Text color="blue">{info.worktrees.length} worktree{info.worktrees.length === 1 ? '' : 's'}</Text>
          <Text dimColor>  │  /sessions</Text>
        </Text>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const [list, allPeers, self, info, rawUi, notes, history, pins, msgs, claims, usage, tasks] = await Promise.all([
      read($, agents), read($, peers), read($, me), read($, gitAtom), read($, uiAtom), read($, notesAtom), read($, historyAtom), read($, pinsAtom), read($, msgsAtom), read($, claimsAtom), read($, usageAtom),
      read($, tasksAtom),
    ])
    const ui = fixUi(rawUi)
    const now = await $.clock.now()
    const wide = e.props.bodyColumns ?? e.viewport?.columns ?? 60
    const nameW = Math.max(16, Math.min(34, wide - 24))
    const isPinned = (id: string) => pins.some(pin => pin.sessionId === id)
    const others = allPeers
      .filter(p => isPinned(p.sessionId) || ((!ui.busyOnly || p.status === 'busy') && (!ui.hideBg || p.kind !== 'bg')))
      .sort((a, b) => Number(isPinned(b.sessionId)) - Number(isPinned(a.sessionId)))
    const dot = (status: string) =>
      status === 'busy' ? { glyph: '●', color: 'green' } : status === 'shell' ? { glyph: '●', color: 'cyan' } : { glyph: '○', color: 'gray' }

    const tone = (key: string) =>
      key === 'att'
        ? attention.some(a => a.color === 'red') ? 'red' : attention.length ? 'yellow' : 'green'
        : PALETTE[key] ?? 'gray'
    const card = (key: string, title: string, ...kids: unknown[]) => (
      <Box key={key} flexDirection="column" borderStyle="round" borderColor={tone(key)} paddingX={1}>
        <Text bold color={tone(key)}>{title}</Text>
        {kids}
      </Box>
    )

    const sessionCard = (p: PeerRow) => {
      const d = dot(p.status)
      return (
        <Box key={p.sessionId} flexDirection="column" borderStyle="round" borderColor={isPinned(p.sessionId) ? 'magenta' : p.status === 'busy' ? 'green' : 'gray'} paddingX={1}>
          <Box>
            <Text color={d.color}>{d.glyph} </Text>
            <Box width={nameW}><Text wrap="truncate-end" bold color={p.status === 'busy' ? 'green' : p.status === 'shell' ? 'cyan' : undefined}>{isPinned(p.sessionId) ? '★ ' : ''}{p.name}</Text></Box>
            <Text dimColor> {p.status} · {ago(now - p.updatedAt)}</Text>
          </Box>
          <Text wrap="truncate-end"><Text color="cyan">⎇ {p.branch}</Text><Text dimColor>{p.kind === 'bg' ? '  · background job' : ''}{p.isSameProject ? '' : '  · other project'}</Text></Text>
          {p.task !== '' && <Text wrap="truncate-end"><Text color="blue" bold>task </Text>{p.task}</Text>}
          {p.activity !== '' && <Text wrap="truncate-end"><Text color="magenta" bold>last </Text><Text dimColor>{p.activity}</Text></Text>}
          {p.overlap.length > 0 && <Text color="yellow">⚠ also editing: {p.overlap.join(', ')}</Text>}
          {liveClaims.some(c => c.sessionId === p.sessionId) && (
            <Text wrap="truncate-end">
              <Text color="yellow" bold>claims </Text>
              {liveClaims.filter(c => c.sessionId === p.sessionId).map(c => c.paths.join(', ')).join('; ')}
            </Text>
          )}
          {p.subs.length > 0 && (
            <Box flexDirection="column">
              <Text wrap="truncate-end">
                <Text color="magenta" bold>agents </Text>
                <Text color={p.subs.some(sub => sub.isRunning) ? 'green' : 'gray'}>{p.subs.filter(sub => sub.isRunning).length} active</Text>
                <Text dimColor> · {p.subs.filter(sub => !sub.isRunning).length} finished recently</Text>
              </Text>
              {p.subs.filter(sub => sub.isRunning).slice(0, 3).map(sub => (
                <Text key={sub.id} dimColor wrap="truncate-end">  ● {sub.label}</Text>
              ))}
            </Box>
          )}
          <Box gap={1}>
            <Button key={`jump-${p.sessionId}`} label="Jump" onPress={() => jumpTo($, p)} />
            <Button key={`pin-${p.sessionId}`} label={isPinned(p.sessionId) ? 'Unpin' : 'Pin'} onPress={() => togglePin($, p.sessionId, p.name)} />
            <Button key={`msg-${p.sessionId}`} label="Message" onPress={() => fillTell($, p.name)} />
            <Button key={`id-${p.sessionId}`} label="Copy id" onPress={() => copyText($, p.sessionId, 'session id')} />
            <Button key={`dir-${p.sessionId}`} label="Copy dir" onPress={() => copyText($, p.cwd, 'directory')} />
          </Box>
        </Box>
      )
    }

    const attention: { key: string; color: string; text: string }[] = []
    if (info?.behind) attention.push({ key: 'behind', color: 'red', text: `${info.branch} is ${info.behind} commit${info.behind > 1 ? 's' : ''} behind ${info.base || 'upstream'}` })
    for (const p of allPeers) {
      if (p.overlap.length) attention.push({ key: `ov-${p.sessionId}`, color: 'yellow', text: `${p.name} also edits ${p.overlap[0]}` })
    }
    for (const w of info?.worktrees ?? []) {
      if (w.dirty) attention.push({ key: `dirty-${w.path}`, color: 'yellow', text: `${w.branch}: ${w.dirty} uncommitted file${w.dirty > 1 ? 's' : ''}` })
    }
    if ((info?.merged.length ?? 0) > 0) attention.push({ key: 'merged', color: 'cyan', text: `${info?.merged.length} merged branch${(info?.merged.length ?? 0) > 1 ? 'es' : ''} can be deleted (Git tab)` })
    for (const r of (usage?.rows ?? []).filter(x => x.window > 0 && (x.ctx / x.window) * 100 >= 85)) {
      attention.push({ key: `ctx-${r.sessionId}`, color: 'red', text: `${r.isSelf ? 'this session' : r.name}: context ${Math.round((r.ctx / r.window) * 100)}% full` })
    }
    for (const l of usage?.limits ?? []) {
      if (l.percentUsed >= 80) attention.push({ key: `lim-${l.kind}`, color: l.percentUsed >= 95 ? 'red' : 'yellow', text: `${LIMIT_LABEL[l.kind] ?? l.kind}: ${Math.round(l.percentUsed)}% used` })
    }
    for (const o of tasksOverlap(tasks)) attention.push({ key: `tov-${o.a.id}-${o.b.id}`, color: 'yellow', text: `tasks ${o.a.id} and ${o.b.id} both claim ${o.on}` })
    const openNotes = notes.filter(n => !n.done)
    if (openNotes.length) attention.push({ key: 'notes', color: 'cyan', text: `${openNotes.length} open note${openNotes.length > 1 ? 's' : ''}: ${openNotes[0].text.slice(0, 50)}` })
    if (self?.note.startsWith('ERROR')) attention.push({ key: 'err', color: 'red', text: self.note })

    const busyCount = allPeers.filter(p => p.status === 'busy').length
    const tabBtn = (tab: Tab, label: string) => (
      <Button key={`tab-${tab}`} label={ui.tab === tab ? `● ${label}` : `○ ${label}`} onPress={() => setTab($, tab)} />
    )

    const liveClaims = claims.filter(
      c => c.expiresAt > now && (c.sessionId === self?.sessionId || allPeers.some(p => p.sessionId === c.sessionId)),
    )
    const claimsCard = card('claim', `Claims  ${liveClaims.length}`,
      liveClaims.length === 0 && <Text key="none" dimColor>none. /claim {'<paths>'} [note], or sessions can use claim_files</Text>,
      liveClaims.map(c => {
        const isMine = c.sessionId === self?.sessionId
        return (
          <Box key={c.id} flexDirection="column">
            <Text wrap="truncate-end">
              <Text bold color={isMine ? 'cyan' : 'yellow'}>{isMine ? 'you' : c.name}</Text>
              <Text dimColor>  until {hhmm(c.expiresAt)}</Text>
            </Text>
            <Text wrap="truncate-end">  {c.paths.join(', ')}</Text>
            {c.note !== '' && <Text dimColor wrap="truncate-end">  {c.note}</Text>}
            {isMine && <Box paddingLeft={2}><Button key={`rel-${c.id}`} label="Release" onPress={() => releaseClaims($, c.paths)} /></Box>}
          </Box>
        )
      }))

    const activeTasks = tasks.filter(t => t.status === 'active')
    const tasksCard = card('task', `Tasks  ${activeTasks.length}`,
      activeTasks.length === 0 && <Text key="none" dimColor>none. /task add {'<ID> <paths>'} [--branch {'<name>'}] [note]</Text>,
      activeTasks.map(t => {
        const mine = t.branch !== '' && t.branch === info?.branch
        return (
          <Box key={t.id} flexDirection="column">
            <Text wrap="truncate-end">
              <Text bold color={mine ? 'cyan' : 'magenta'}>{t.id}</Text>
              <Text dimColor>  {t.branch || 'any branch'}{mine ? ' (this branch)' : ''}{t.owner ? ` · ${t.owner}` : ''}</Text>
            </Text>
            <Text wrap="truncate-end">  {t.paths.join(', ')}</Text>
            {t.note !== '' && <Text dimColor wrap="truncate-end">  {t.note}</Text>}
            <Box paddingLeft={2}><Button key={`done-${t.id}`} label="Done" onPress={() => finishTask($, t.id)} /></Box>
          </Box>
        )
      }))

    const peerAgents = allPeers.flatMap(peer => peer.subs.filter(sub => sub.isRunning).map(sub => ({ peer, sub })))

    const pinnedCard = pins.length === 0 ? null : card('pin', `Pinned  ${pins.length}`,
      pins.map(pin => {
        const live = allPeers.find(p => p.sessionId === pin.sessionId)
        const d = dot(live?.status ?? 'idle')
        return (
          <Box key={pin.sessionId} flexDirection="column">
            <Box gap={1}>
              <Text color={live ? d.color : 'gray'}>{live ? d.glyph : '✕'}</Text>
              <Box width={nameW}><Text wrap="truncate-end" bold color={live ? 'magenta' : 'gray'}>{pin.name}</Text></Box>
              <Text dimColor>{live ? `${live.status} · ${ago(now - live.updatedAt)}` : 'offline'}</Text>
              {live && <Button key={`pj-${pin.sessionId}`} label="Jump" onPress={() => jumpTo($, live)} />}
              <Button key={`unpin-${pin.sessionId}`} label="Unpin" onPress={() => togglePin($, pin.sessionId, pin.name)} />
            </Box>
            {live && (live.activity || live.task) !== '' && <Text dimColor wrap="truncate-end">  {live.activity || live.task}</Text>}
          </Box>
        )
      }))

    const overview = [
      pinnedCard,
      tasksCard,
      claimsCard,
      card('me', 'This session',
        <Text key="me1">
          ⎇ <Text bold>{info?.branch ?? self?.branch ?? '…'}</Text>
          {info?.dirty ? <Text color="yellow">  ±{info.dirty} dirty</Text> : <Text color="green">  clean</Text>}
          {info?.behind ? <Text color="red">  ↓{info.behind}</Text> : null}
          {info?.ahead ? <Text color="green">  ↑{info.ahead}</Text> : null}
        </Text>,
        <Text key="me2" dimColor>{allPeers.length} other sessions · {busyCount} busy · {list.length} subagents · {info?.worktrees.length ?? 0} worktrees</Text>),
      card('att', `Needs attention  ${attention.length}`,
        attention.length === 0 && <Text key="ok" color="green">all quiet</Text>,
        attention.map(a => <Text key={a.key} color={a.color} wrap="truncate-end">• {a.text}</Text>)),
      card('busy', `Working now  ${busyCount}`,
        busyCount === 0 && <Text key="none" dimColor>nothing busy</Text>,
        allPeers.filter(p => p.status === 'busy').map(p => (
          <Box key={p.sessionId} flexDirection="column">
            <Text bold color="green" wrap="truncate-end">● {p.name}</Text>
            <Text dimColor wrap="truncate-end">  {p.activity || p.task || '…'}</Text>
          </Box>
        ))),
      card('sub', `Subagents  ${list.length + peerAgents.length}`,
        list.length + peerAgents.length === 0 && <Text key="none" dimColor>none running</Text>,
        list.length > 0 && <Text key="thisses" dimColor>this session</Text>,
        list.map(a => (
          <Text key={a.id} dimColor={a.status === 'completed'}>
            {a.parentId ? '  └ ' : ''}<Text bold color={AGENT_COLOR[a.status]}>{a.status}</Text>  {a.label}
          </Text>
        )),
        peerAgents.map(pa => (
          <Text key={`pa-${pa.sub.id}`} wrap="truncate-end">
            <Text bold color="green">active</Text>  {pa.sub.label}  <Text dimColor>· {pa.peer.name}</Text>
          </Text>
        ))),
    ]

    const activeFilters = [ui.busyOnly ? 'busy only' : '', ui.hideBg ? 'background jobs hidden' : ''].filter(Boolean)
    const sessions = [
      <Box key="flt" gap={1}>
        <Button key="busy" label={ui.busyOnly ? '✓ Busy only' : 'Busy only'} onPress={() => toggle($, 'busyOnly')} />
        <Button key="bg" label={ui.hideBg ? '✓ Hide jobs' : 'Hide jobs'} onPress={() => toggle($, 'hideBg')} />
      </Box>,
      activeFilters.length > 0 && (
        <Text key="fnote" color="yellow">
          filtered ({activeFilters.join(', ')}): showing {others.length} of {allPeers.length}. Pinned sessions always show.
        </Text>
      ),
      others.length === 0 && <Text key="none" dimColor>no sessions match</Text>,
      others.map(sessionCard),
    ]

    const gitTab = [
      card('wt', `Worktrees  ${info?.worktrees.length ?? 0}`,
        info?.worktrees.map(w => (
          <Box key={w.path} flexDirection="column">
            <Box>
              <Text color={w.isHere ? 'cyan' : undefined}>{w.isHere ? '▸ ' : '  '}</Text>
              <Box width={Math.max(14, Math.min(30, wide - 20))}><Text wrap="truncate-end" bold={w.isHere} color={w.isHere ? 'cyan' : 'blue'}>{w.branch}</Text></Box>
              <Text color={w.dirty ? 'yellow' : 'green'}> {w.dirty ? `±${w.dirty}` : 'clean'}</Text>
            </Box>
            <Text dimColor wrap="truncate-start">   {home(w.path)}</Text>
            <Box gap={1} paddingLeft={2}>
              <Button key={`cd-${w.path}`} label="cd" onPress={() => copyText($, `cd ${w.path}`, 'cd command')} />
              <Button key={`st-${w.path}`} label="status" onPress={() => showStatus($, w.path)} />
            </Box>
          </Box>
        ))),
      card('mg', `Merged into main  ${info?.merged.length ?? 0}`,
        (info?.merged.length ?? 0) === 0 && <Text key="none" dimColor>nothing to clean up</Text>,
        info?.merged.map(b => (
          <Box key={b} gap={1}>
            <Box width={Math.max(14, wide - 22)}><Text wrap="truncate-end">{b}</Text></Box>
            <Button key={`del-${b}`} label="Copy delete cmd" onPress={() => copyText($, `git branch -d ${b}`, 'delete command')} />
          </Box>
        ))),
    ]

    const clock = (at: number) => {
      const d = new Date(at)
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    }
    const dayKey = (at: number) => {
      const d = new Date(at)
      const t = new Date(now)
      const gap = Math.round((new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000)
      return gap === 0 ? 'Today' : gap === 1 ? 'Yesterday' : d.toDateString().slice(0, 10)
    }
    const span = (ms: number) => (ms <= 0 ? '' : ms < 60000 ? `${Math.round(ms / 1000)}s` : ms < 3600000 ? `${Math.round(ms / 60000)}m` : `${(ms / 3600000).toFixed(1)}h`)
    const recent = [...history].reverse().slice(0, Math.max(10, (e.viewport?.rows ?? 30) - 8))
    const todayRows = history.filter(ev => dayKey(ev.at) === 'Today')
    const todayBusy = todayRows.reduce((sum, ev) => sum + ev.durationMs, 0)
    const days: string[] = []
    for (const ev of recent) if (!days.includes(dayKey(ev.at))) days.push(dayKey(ev.at))

    const historyTab = [
      card('hsum', `Today  ${todayRows.length} finished`,
        <Text key="hs1" dimColor>{new Set(todayRows.map(ev => ev.sessionId)).size} sessions · {span(todayBusy) || '0s'} total busy time</Text>),
      ...days.map(day =>
        card(`day-${day}`, day,
          recent.filter(ev => dayKey(ev.at) === day).map(ev => (
            <Box key={ev.id} flexDirection="column">
              <Text wrap="truncate-end">
                <Text dimColor>{clock(ev.at)} </Text>
                <Text bold color={ev.outcome === 'shell' ? 'cyan' : 'green'}>{ev.name}</Text>
                <Text dimColor>  {ev.outcome}{ev.durationMs > 0 ? ` · ran ${span(ev.durationMs)}` : ''}</Text>
              </Text>
              {ev.task !== '' && <Text dimColor wrap="truncate-end">  {ev.task}</Text>}
              {ev.activity !== '' && <Text color="magenta" dimColor wrap="truncate-end">  ↳ {ev.activity}</Text>}
            </Box>
          )))),
      history.length === 0 && <Text key="hnone" dimColor>No finished sessions recorded yet. They appear when a busy session goes idle.</Text>,
      <Box key="hbar" gap={1}><Button key="hclr" label="Clear history" onPress={() => clearHistory($)} /></Box>,
    ]

    const recentMsgs = [...msgs].reverse().slice(0, Math.max(8, Math.floor(((e.viewport?.rows ?? 30) - 8) / 3)))
    const messagesTab = [
      <Box key="mbar" gap={1}>
        <Button key="mclr" label="Clear messages" onPress={() => clearMsgs($)} />
      </Box>,
      msgs.length === 0 && <Text key="mnone" dimColor>No messages yet. Use /tell {'<name>'} {'<text>'}, or sessions can use the message_peer tool.</Text>,
      ...recentMsgs.map(msg => {
        if (msg.via === 'pause') {
          return (
            <Box key={msg.id} flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1}>
              <Text wrap="truncate-end">
                <Text dimColor>{clock(msg.at)} </Text>
                <Text bold color="yellow">⏸ paused</Text>
                <Text dimColor>  {msg.fromName} · coordinating with {msg.toName}</Text>
              </Text>
              <Text wrap="wrap">{msg.text}</Text>
            </Box>
          )
        }
        const isMine = self !== null && msg.fromId === self.sessionId
        const other = isMine ? msg.toName : msg.fromName
        return (
          <Box key={msg.id} flexDirection="column" borderStyle="round" borderColor={isMine ? 'cyan' : 'green'} paddingX={1}>
            <Text wrap="truncate-end">
              <Text dimColor>{clock(msg.at)} </Text>
              <Text bold color={isMine ? 'cyan' : 'green'}>{isMine ? '→ ' : '← '}{other}</Text>
              <Text dimColor>  hop {msg.hop}/{MAX_HOPS} · {msg.via}{msg.delivered ? '' : ' · NOT delivered'}</Text>
            </Text>
            <Text wrap="wrap">{msg.text}</Text>
            {!isMine && <Box gap={1}><Button key={`rp-${msg.id}`} label="Reply" onPress={() => fillTell($, msg.fromName)} /></Box>}
          </Box>
        )
      }),
    ]

    const usageTab = [
      card('plan', 'Plan limits',
        !usage || usage.limits.length === 0
          ? <Text key="nolim" dimColor>not reported yet (only subscription plans report limits, after an API response)</Text>
          : usage.limits.map(l => (
              <Box key={l.kind} flexDirection="column">
                <Text wrap="truncate-end">
                  <Text bold>{LIMIT_LABEL[l.kind] ?? l.kind}</Text>
                  <Text dimColor>  resets in {l.resetsAt ? untilReset(l.resetsAt, now) : '?'}</Text>
                </Text>
                <Text color={level(l.percentUsed)}>{bar(l.percentUsed)} {Math.round(l.percentUsed)}% used · {Math.max(0, 100 - Math.round(l.percentUsed))}% left</Text>
              </Box>
            ))),
      card('ctx', `Context windows  ${usage?.rows.length ?? 0}`,
        !usage && <Text key="wait" dimColor>measuring… (the first scan of long sessions can take a moment)</Text>,
        (usage?.rows ?? []).map(r => {
          const pct = r.window > 0 ? (r.ctx / r.window) * 100 : 0
          return (
            <Box key={r.sessionId} flexDirection="column">
              <Text wrap="truncate-end">
                <Text bold color={r.isSelf ? 'cyan' : undefined}>{r.isSelf ? 'this session' : r.name}</Text>
                <Text dimColor>  {r.model.replace(/^claude-/, '')}{r.isSelf && r.costUsd > 0 ? `  · $${r.costUsd.toFixed(2)}` : ''}</Text>
              </Text>
              <Text color={level(pct)}>{bar(pct, 16)} {fmtTok(r.ctx)} / {fmtTok(r.window)}{r.isEstimate ? '~' : ''}  {Math.round(pct)}%  <Text dimColor>· {fmtTok(Math.max(0, r.window - r.ctx))} left</Text></Text>
            </Box>
          )
        })),
      card('usage', 'Tokens used (whole session)',
        (usage?.rows ?? []).map(r => (
          <Text key={`tk-${r.sessionId}`} wrap="truncate-end">
            <Text bold>{r.isSelf ? 'this session' : r.name}</Text>
            <Text dimColor>  out {fmtTok(r.output)} · in {fmtTok(r.input)} · cache write {fmtTok(r.cacheCreate)} · cache read {fmtTok(r.cacheRead)} · {r.turns} turns</Text>
          </Text>
        ))),
      S.pyFailed && <Text key="pyf" color="yellow">python3 was not found, so token totals for other sessions are unavailable. Plan limits and this session's context still work.</Text>,
      <Text key="uhint" dimColor>~ = window size estimated for other sessions. Totals count what each transcript recorded. Warnings pop up at 80% and 95%.</Text>,
    ]

    const actionsTab = [
      card('flt', 'Run (read-only)',
        <Box key="arow" flexWrap="wrap" gap={1}>
          {ACTIONS.map(a => (
            <Button key={`act-${a.key}`} label={a.label} onPress={() => runAction($, a.key)} />
          ))}
        </Box>),
      card('me', 'Copy',
        <Box key="crow" gap={1}>
          <Button key="cp-branch" label="Branch name" onPress={() => copyGit($, 'branch')} />
          <Button key="cp-commit" label="Commit hash" onPress={() => copyGit($, 'commit')} />
          <Button key="cp-root" label="Repo path" onPress={() => copyGit($, 'root')} />
        </Box>),
      card('me', 'Appearance',
        <Box key="trow" gap={1}>
          <Button key="theme" label={ui.theme === 'light' ? 'Pane theme: light (switch to dark)' : 'Pane theme: dark (switch to light)'} onPress={() => toggleTheme($)} />
          {S.isMac && <Button key="jumpauto" label={ui.jumpAuto ? '✓ Jump switches terminal tabs' : 'Jump switches terminal tabs'} onPress={() => toggleJump($)} />}
        </Box>),
      card('flt', 'Parallel-session safety',
        <Box key="prow" gap={1}>
          <Button key="pc" label={ui.precheck ? '✓ pause on files another session just edited' : 'pause on files another session just edited'} onPress={() => togglePrecheck($)} />
          <Button key="sp" label={ui.sharePrompt ? '✓ share my prompt text with other sessions' : 'share my prompt text with other sessions'} onPress={() => toggleSharePrompt($)} />
        </Box>),
      card('sub', 'Notify me when a session…',
        <Box key="nrow" gap={1}>
          <Button key="nt-start" label={ui.notify.start ? '✓ starts working' : 'starts working'} onPress={() => toggleNotify($, 'start')} />
          <Button key="nt-done" label={ui.notify.done ? '✓ finishes / goes idle' : 'finishes / goes idle'} onPress={() => toggleNotify($, 'done')} />
          <Button key="nt-wait" label={ui.notify.wait ? '✓ needs me' : 'needs me'} onPress={() => toggleNotify($, 'wait')} />
        </Box>),
    ]

    const notesTab = [
      <Box key="nbar" gap={1}>
        <Button key="nsave" label="Save prompt as note" onPress={() => noteFromPrompt($)} />
        <Button key="nclr" label="Clear done" onPress={() => clearDone($)} />
      </Box>,
      card('open', `Open  ${openNotes.length}`,
        openNotes.length === 0 && <Text key="none" dimColor>nothing open. /note &lt;text&gt; or type in the prompt and Save</Text>,
        openNotes.map(n => (
          <Box key={n.id} gap={1}>
            <Box width={Math.max(14, wide - 20)}><Text wrap="wrap"><Text color="yellow" bold>☐ </Text>{n.text}</Text></Box>
            <Button key={`nd-${n.id}`} label="Done" onPress={() => toggleNote($, n.id)} />
            <Button key={`nx-${n.id}`} label="✕" onPress={() => deleteNote($, n.id)} />
          </Box>
        ))),
      card('done', `Done  ${notes.length - openNotes.length}`,
        notes.filter(n => n.done).slice(-8).map(n => (
          <Box key={n.id} gap={1}>
            <Box width={Math.max(14, wide - 20)}><Text dimColor strikethrough wrap="truncate-end"><Text color="green">☑ </Text>{n.text}</Text></Box>
            <Button key={`nu-${n.id}`} label="Undo" onPress={() => toggleNote($, n.id)} />
          </Box>
        ))),
    ]

    const tree = (
      <Box flexDirection="column" gap={1}>
        <Box gap={1}>
          {tabBtn('overview', 'Overview')}
          {tabBtn('sessions', others.length === allPeers.length ? `Sessions ${allPeers.length}` : `Sessions ${others.length}/${allPeers.length}`)}
          {tabBtn('git', 'Git')}
          {tabBtn('history', `History ${history.length || ''}`.trim())}
          {tabBtn('messages', `Messages ${msgs.length || ''}`.trim())}
          {tabBtn('usage', 'Usage')}
          {tabBtn('actions', 'Actions')}
          {tabBtn('notes', `Notes ${openNotes.length || ''}`.trim())}
        </Box>

        {ui.tab === 'overview' && overview}
        {ui.tab === 'sessions' && sessions}
        {ui.tab === 'git' && gitTab}
        {ui.tab === 'notes' && notesTab}
        {ui.tab === 'history' && historyTab}
        {ui.tab === 'actions' && actionsTab}
        {ui.tab === 'usage' && usageTab}
        {ui.tab === 'messages' && messagesTab}

        {ui.flash !== '' && (
          <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1}>
            <Text color="yellow">{ui.flash}</Text>
            {ui.detail.map((line, i) => (
              <Text key={`d${i}`} dimColor wrap="truncate-end">{line}</Text>
            ))}
          </Box>
        )}

        <Box gap={1}>
          <Button key="refresh" label="Refresh" onPress={() => tick($)} />
          <Button key="fetch" label="Fetch origin" onPress={() => doFetch($)} />
        </Box>
        <Text dimColor>session-agents v{VERSION}  ·  {self ? short(self.sessionId) : '…'}</Text>
      </Box>
    )

    const pal = ui.theme === 'light' ? LIGHT : DARK
    const painted = paint(tree, pal)
    if (ui.theme !== 'light' || painted === null || typeof painted !== 'object') return painted

    // Fill the whole pane with the page color, not just the area under the content.
    return { ...painted, props: { ...(painted.props ?? {}), backgroundColor: pal.bg, width: wide, minHeight: Math.max(10, (e.viewport?.rows ?? 30) - 2), paddingX: 1 } }
  })
}
