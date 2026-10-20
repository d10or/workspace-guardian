import { expect, test } from 'claude-code/testing'

import { findViolation, globMatches, parseTaskAdd, parseTasks, serializeTasks, taskFilePath, tasksOverlap } from './tasks'
import type { TaskRow } from '../types'

const row = (over: Partial<TaskRow>): TaskRow => ({ id: 'T', paths: ['src/**'], branch: 'feat', owner: '', note: '', createdAt: 0, status: 'active', ...over })

test('globMatches follows glob semantics, ** matches zero directories', async () => {
  expect(globMatches('src/**/x.ts', 'src/x.ts')).toBe(true)
  expect(globMatches('src/**/x.ts', 'src/a/b/x.ts')).toBe(true)
  expect(globMatches('src/**', 'src/a/b.ts')).toBe(true)
  expect(globMatches('src/*', 'src/a/b.ts')).toBe(false)
  expect(globMatches('src/*', 'src/b.ts')).toBe(true)
  expect(globMatches('*.ts', 'a/b.ts')).toBe(false)
  expect(globMatches('**/*.ts', 'a/b.ts')).toBe(true)
  expect(globMatches('src/auth', 'src/auth/session.ts')).toBe(true)
  expect(globMatches('src/auth', 'src/authz/x.ts')).toBe(false)
  expect(globMatches('src/a.b', 'src/a.b')).toBe(true)
  expect(globMatches('src/a.b', 'src/aXb')).toBe(false)
  expect(globMatches('', 'x')).toBe(false)
})

test('taskFilePath sits beside the main worktree, shared by all worktrees', async () => {
  expect(taskFilePath('/repo/.git')).toBe('/repo/.guardian/tasks.json')
  expect(taskFilePath('/repo/.git/')).toBe('/repo/.guardian/tasks.json')
  expect(taskFilePath('/bare.git')).toBe('/bare.git/.guardian/tasks.json')
})

test('parseTasks tolerates bad input and round-trips', async () => {
  expect(parseTasks('nope')).toEqual([])
  expect(parseTasks('{"tasks": [{"id": "", "paths": ["a"]}, {"id": "ok", "paths": ["a", 3, " "]}]}')).toEqual([row({ id: 'ok', paths: ['a'], branch: '' })])
  const list = [row({ id: 'A', createdAt: 5, note: 'n' }), row({ id: 'B', status: 'done' })]
  expect(parseTasks(serializeTasks(list))).toEqual(list)
})

test('findViolation blocks only another branch editing an active task with a branch', async () => {
  const tasks = [row({ id: 'AUTH', paths: ['src/auth/**'], branch: 'feature/auth' }), row({ id: 'FREE', paths: ['docs/**'], branch: '' }), row({ id: 'OLD', paths: ['src/old/**'], branch: 'x', status: 'done' })]
  expect(findViolation(tasks, 'src/auth/session.ts', 'main')?.id).toBe('AUTH')
  expect(findViolation(tasks, 'src/auth/session.ts', 'feature/auth')).toBe(undefined)
  expect(findViolation(tasks, 'docs/a.md', 'main')).toBe(undefined)
  expect(findViolation(tasks, 'src/old/a.ts', 'main')).toBe(undefined)
  expect(findViolation(tasks, 'src/auth/session.ts', 'main', new Set(['AUTH']))).toBe(undefined)
})

test('tasksOverlap reports declared overlaps between active tasks', async () => {
  const tasks = [row({ id: 'A', paths: ['src/auth/**'] }), row({ id: 'B', paths: ['src/auth/session.ts'] }), row({ id: 'C', paths: ['docs/**'] }), row({ id: 'D', paths: ['src/**'], status: 'done' })]
  const hits = tasksOverlap(tasks)
  expect(hits.length).toBe(1)
  expect(hits[0].a.id).toBe('A')
  expect(hits[0].b.id).toBe('B')
})

test('parseTaskAdd reads id, paths, optional branch and note', async () => {
  const r = parseTaskAdd('TASK-01 src/auth/**,./src/db/ --branch feature/auth wire up login', 'main')
  expect(r.ok).toBe(true)
  if (r.ok) {
    expect(r.id).toBe('TASK-01')
    expect(r.paths).toEqual(['src/auth/**', 'src/db'])
    expect(r.branch).toBe('feature/auth')
    expect(r.note).toBe('wire up login')
  }
  const d = parseTaskAdd('T2 docs/**', 'main')
  expect(d.ok && d.branch).toBe('main')
  expect(parseTaskAdd('', 'main').ok).toBe(false)
  expect(parseTaskAdd('bad!id x', 'main').ok).toBe(false)
  expect(parseTaskAdd('T3 x --branch', 'main').ok).toBe(false)
})
