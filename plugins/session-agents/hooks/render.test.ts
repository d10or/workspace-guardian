import { mock, test } from 'claude-code/testing'

// Smoke test: the default pane (overview tab, no data yet) must draw and validate on the terminal.
// The default theme is "auto": nothing is repainted, so the pane inherits the host's colours.
test('the pane draws on the terminal, risk-first, with the header and the ownership card', async ($, on) => {
  mock.clock(on, { now: 1_790_000_000_000 })
  const ui = await $.ui.mount({
    plugin: 'session-agents',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'session-agents',
    props: { bodyColumns: 80 },
  })
  const tree = JSON.stringify(await ui.drawn())
  if (tree.includes('#ffffff')) throw new Error('auto theme must not paint a white page')
  for (const [what, re] of [
    ['header status', /all clear/],
    ['header version', /v\d+\.\d+\.\d+/],
    ['attention card', /Nothing needs attention/],
    ['ownership card', /Ownership/],
    ['teaching empty state', /\/task add AUTH/],
    ['legend', /pinned/],
  ] as const) {
    const found = await ui.find({ type: 'Text', text: re })
    if (found === undefined) throw new Error(`overview did not draw its ${what}`)
  }
  await ui.unmount()
})
