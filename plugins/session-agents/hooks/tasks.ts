// Task-level ownership: a task owns path patterns on a branch and outlives any one session.
// Stored at <main worktree>/.guardian/tasks.json so every worktree of the repo shares it.
// Pure logic lives here so it can be unit-tested without the engine.

import type { TaskRow } from '../types'

export const TASKS_VERSION = 1

/** Glob match with the usual semantics: `*` within one segment, `**` across segments
 *  (including zero), `?` one char. A pattern without wildcards matches itself or anything under it. */
export function globMatches(pattern: string, rel: string): boolean {
  const p = pattern.trim().replace(/^\.\//, '').replace(/\/+$/, '')
  if (p === '' || rel === '') return false
  if (!/[*?]/.test(p)) return rel === p || rel.startsWith(p + '/')
  let re = ''
  for (let i = 0; i < p.length; i++) {
    const c = p[i]
    if (c === '*') {
      if (p[i + 1] === '*') {
        i++
        if (p[i + 1] === '/') {
          i++
          re += '(?:.*/)?'
        } else re += '.*'
      } else re += '[^/]*'
    } else if (c === '?') re += '[^/]'
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  }

  return new RegExp(`^${re}$`).test(rel)
}

export const patternsOverlap = (a: string, b: string) => globMatches(a, b) || globMatches(b, a) || a === b

/** Where the shared task file lives for a repo whose git common dir is `gitCommonDir`
 *  (`.git` of the main worktree). */
export function taskFilePath(gitCommonDir: string): string {
  const clean = gitCommonDir.replace(/\/+$/, '')
  const parent = clean.endsWith('/.git') ? clean.slice(0, -'/.git'.length) : clean

  return `${parent}/.guardian/tasks.json`
}

export function parseTasks(text: string): TaskRow[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return []
  }
  const list = Array.isArray(parsed) ? parsed : parsed && typeof parsed === 'object' && Array.isArray((parsed as { tasks?: unknown }).tasks) ? (parsed as { tasks: unknown[] }).tasks : []

  return list.flatMap((row: unknown) => {
    if (!row || typeof row !== 'object') return []
    const r = row as Record<string, unknown>
    if (typeof r.id !== 'string' || r.id === '' || !Array.isArray(r.paths)) return []
    const paths = r.paths.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map(x => x.trim())
    if (paths.length === 0) return []
    const task: TaskRow = {
      id: r.id,
      paths,
      branch: typeof r.branch === 'string' ? r.branch : '',
      owner: typeof r.owner === 'string' ? r.owner : '',
      note: typeof r.note === 'string' ? r.note : '',
      createdAt: typeof r.createdAt === 'number' ? r.createdAt : 0,
      status: r.status === 'done' ? 'done' : 'active',
    }

    return [task]
  })
}

export function serializeTasks(tasks: readonly TaskRow[]): string {
  return JSON.stringify({ version: TASKS_VERSION, tasks }, null, 2) + '\n'
}

/** The active task whose declared paths cover `rel` while `branch` is not the task's branch.
 *  Tasks without a branch are informational and never block. */
export function findViolation(tasks: readonly TaskRow[], rel: string, branch: string, allowed: ReadonlySet<string> = new Set()): TaskRow | undefined {
  return tasks.find(t => t.status === 'active' && t.branch !== '' && t.branch !== branch && !allowed.has(t.id) && t.paths.some(p => globMatches(p, rel)))
}

/** Pairs of active tasks whose declared patterns overlap: the preflight check. */
export function tasksOverlap(tasks: readonly TaskRow[]): { a: TaskRow; b: TaskRow; on: string }[] {
  const active = tasks.filter(t => t.status === 'active')
  const out: { a: TaskRow; b: TaskRow; on: string }[] = []
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]
      const b = active[j]
      const hit = a.paths.find(pa => b.paths.some(pb => patternsOverlap(pa, pb)))
      if (hit !== undefined) out.push({ a, b, on: hit })
    }
  }

  return out
}

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/

/** `/task add <ID> <path[,path]> [--branch <name>] [note…]` */
export function parseTaskAdd(args: string, defaultBranch: string): { ok: true; id: string; paths: string[]; branch: string; note: string } | { ok: false; msg: string } {
  const tokens = args.trim().split(/\s+/).filter(Boolean)
  const usage = 'Usage: /task add <ID> <path[,path...]> [--branch <name>] [note]'
  const id = tokens.shift()
  const pathToken = tokens.shift()
  if (id === undefined || pathToken === undefined) return { ok: false, msg: usage }
  if (!ID_RE.test(id)) return { ok: false, msg: `Task id "${id}" must be 1-40 letters, digits, dot, dash or underscore.` }
  const paths = [...new Set(pathToken.split(',').map(p => p.trim().replace(/^\.\//, '').replace(/\/+$/, '')).filter(Boolean))].slice(0, 20)
  if (paths.length === 0) return { ok: false, msg: usage }
  let branch = defaultBranch
  const at = tokens.indexOf('--branch')
  if (at !== -1) {
    const b = tokens[at + 1]
    if (b === undefined || b.startsWith('--')) return { ok: false, msg: '--branch needs a branch name.' }
    branch = b
    tokens.splice(at, 2)
  }

  return { ok: true, id, paths, branch, note: tokens.join(' ').slice(0, 200) }
}
