import { mock, test } from 'claude-code/testing'

// The pane must draw on every surface Claude Code offers, not only the
// terminal: the desktop app's Code tab, the VS Code extension, and mobile. The kit validates each tree
// against that surface's own element table, so a prop one surface refuses fails here.
// (The band above the prompt yields to the engine until git info exists, which the kit cannot seed; it is
// checked live instead.)
for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
  test(`the pane draws on ${surface}`, async ($, on) => {
    mock.clock(on, { now: 1_790_000_000_000 })
    const ui = await $.ui.mount({ plugin: 'session-agents', surface, component: 'Pane', requestId: 'session-agents', props: { bodyColumns: 80 } })
    const found = await ui.find({ type: 'Text', text: /needs attention/i })
    if (found === undefined) throw new Error(`${surface}: overview did not draw its attention card`)
    await ui.unmount()
  })

}

// Narrow panes (desktop / VS Code side panels) must still show every tab: the tab row wraps.
for (const surface of ['desktop', 'vscode'] as const) {
  test(`all eight tabs are present on a narrow ${surface} pane`, async ($, on) => {
    mock.clock(on, { now: 1_790_000_000_000 })
    const ui = await $.ui.mount({ plugin: 'session-agents', surface, component: 'Pane', requestId: 'session-agents', props: { bodyColumns: 40 } })
    const hdr = await ui.find({ type: 'Text', text: /all clear/ })
    if (hdr === undefined) throw new Error(`${surface}: header missing at 40 columns`)
    for (const label of [/Overview/, /Sessions/, /^○ Git$/, /History/, /Messages/, /Usage/, /Actions/, /Notes/]) {
      const found = await ui.find({ type: 'Button', label })
      if (found === undefined) throw new Error(`${surface}: tab ${label} missing at 40 columns`)
    }
    await ui.unmount()
  })
}
