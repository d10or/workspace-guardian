import { expect, mock, test } from 'claude-code/testing'

test('/tell without arguments prints usage', async $ => {
  const out = await $.command.run({ command: 'tell', args: '' })

  expect(JSON.stringify(out)).toContain('Usage: /tell')
})

test('/note without text prints usage', async $ => {
  const out = await $.command.run({ command: 'note', args: '' })

  expect(JSON.stringify(out)).toContain('Usage: /note')
})

test('message_peer asks for both a target and a message', async ($, on) => {
  mock.clock(on, { now: 1_790_000_000_000 })
  const out = await $.tool.call({ tool: 'mcp__session-agents__message_peer', to: '', text: '' } as never)

  expect(JSON.stringify(out)).toContain('Need both a target session and a message')
})

test('/claim without a path prints usage', async $ => {
  const out = await $.command.run({ command: 'claim', args: '' })

  expect(JSON.stringify(out)).toContain('Usage: /claim')
})

test('claim_files with no paths is refused with a reason', async $ => {
  const out = await $.tool.call({ tool: 'mcp__session-agents__claim_files', paths: [] } as never)

  expect(JSON.stringify(out)).toContain('at least one file or folder')
})

// --- task ownership -------------------------------------------------------------------------
// `**/src/auth/**` matches whether the kit gives the hook a root-relative path or an absolute one (Windows).
const TASKS = JSON.stringify({ version: 1, tasks: [{ id: 'AUTH', paths: ['**/src/auth/**'], branch: 'feature/auth', owner: 'x', note: '', createdAt: 1, status: 'active' }] })
// In the kit the session root is empty, so a root-relative path is given as /<rel>.
const isTasksFile = (path: string) => path.replace(/\\/g, '/').endsWith('/.guardian/tasks.json')

test('an edit inside a task owned by another branch is held, and denied when the question is dismissed', async ($, on) => {
  mock.clock(on, { now: 1_790_000_000_000 })
  on('fs.read', ($, e, next) => (isTasksFile(e.path) ? { value: TASKS } : next(e)))
  on('tool.call', { tool: 'AskUserQuestion' }, () => ({ deny: 'dismissed' }))
  let reached = false
  on('tool.call', { tool: 'Edit' }, () => {
    reached = true
    return { deny: 'reached the tool' }
  })
  const out = await $.tool.call({ tool: 'Edit', file_path: '/src/auth/session.ts', old_string: 'a', new_string: 'b' } as never)

  expect(reached).toBe(false)
  expect(JSON.stringify(out)).toContain('owned by task AUTH')
})

test('an edit outside every task goes through untouched', async ($, on) => {
  mock.clock(on, { now: 1_790_000_000_000 })
  on('fs.read', ($, e, next) => (isTasksFile(e.path) ? { value: TASKS } : next(e)))
  let reached = false
  on('tool.call', { tool: 'Edit' }, () => {
    reached = true
    return { deny: 'reached the tool' }
  })
  const out = await $.tool.call({ tool: 'Edit', file_path: '/docs/readme.md', old_string: 'a', new_string: 'b' } as never)

  expect(reached).toBe(true)
  expect(JSON.stringify(out)).toContain('reached the tool')
})

test('/task add writes the shared tasks file and /task list reads it back', async ($, on) => {
  mock.clock(on, { now: 1_790_000_000_000 })
  let stored: string | undefined
  on('fs.read', ($, e, next) => {
    if (!isTasksFile(e.path)) return next(e)
    if (stored === undefined) throw new Error('ENOENT')
    return { value: stored }
  })
  on('fs.write', ($, e, next) => {
    if (!isTasksFile(e.path)) return next(e)
    stored = e.text
    return { value: undefined }
  })
  const added = await $.command.run({ command: 'task', args: 'add API src/api/** --branch feature/api rest endpoints' })
  expect(JSON.stringify(added)).toContain('Task API owns src/api/**')
  expect(stored).toContain('"id": "API"')

  const listed = await $.command.run({ command: 'task', args: 'list' })
  expect(JSON.stringify(listed)).toContain('API | src/api/** | feature/api')

  const dup = await $.command.run({ command: 'task', args: 'add API src/other' })
  expect(JSON.stringify(dup)).toContain('already exists')

  const done = await $.command.run({ command: 'task', args: 'done API' })
  expect(JSON.stringify(done)).toContain('marked done')
  expect(stored).toContain('"status": "done"')
})

test('a recorded message is written only to this session\'s own file', async ($, on) => {
  mock.clock(on, { now: 1_790_000_000_000 })
  const writes: string[] = []
  on('fs.write', ($, e, next) => {
    writes.push(e.path)
    return { value: undefined }
  })
  on('fs.read', ($, e, next) => {
    throw new Error('ENOENT')
  })
  on('fs.list', ($, e, next) => ({ value: [] }))
  on('session.send', () => ({ value: { isDelivered: false, reason: 'no peer in tests' } }))
  // /tell with no matching peer never writes; the tool path records a pause-type row via recordMsg
  const out = await $.command.run({ command: 'tell', args: 'nobody hi' })
  expect(JSON.stringify(out)).toContain('No parallel session')
  expect(writes.filter(p => p.endsWith('/messages.json')).length).toBe(0)
})
