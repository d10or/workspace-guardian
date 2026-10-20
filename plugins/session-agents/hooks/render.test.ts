import { mock, test } from 'claude-code/testing'

// Smoke test: the default pane (overview tab, no data yet) must draw and validate.
// It catches structural render errors (a missing global, a prop the surface refuses).
// It does NOT cover the data-driven tabs: seeding the pane's state through the test
// kit did not reach the render, so those are checked by opening /sessions.
test('the pane draws on the terminal', async ($, on) => {
  mock.clock(on, { now: 1_790_000_000_000 })
  const ui = await $.ui.mount({
    plugin: 'session-agents',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'session-agents',
    props: { bodyColumns: 80 },
  })

  const tree = JSON.stringify(await ui.drawn())
  // Default theme is light: a white page and no text left on the terminal's own foreground.
  if (!tree.includes('#ffffff')) throw new Error('light theme did not set a white background')
  if (/"type":"Text","props":\{\}/.test(tree)) throw new Error('a Text was left without an explicit color')
  const found = await ui.find({ type: 'Text', text: /Needs attention/ })
  if (found === undefined) throw new Error('overview did not draw its "Needs attention" card')
  await ui.unmount()
})
