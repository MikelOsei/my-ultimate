import { defineWebExtension } from '@/sdk'
import { TodoCall } from './call.tsx'
import { Todos, TodosIcon } from './panel.tsx'
import { WaitingStrip } from './strip.tsx'

export default defineWebExtension({
  tools: { todo: TodoCall },
  slots: { 'composer.above': [WaitingStrip] },
  // @ultimate's changed-list reminder is model context, not something to read in the transcript.
  entries: { 'todos.note': () => null },
  panels: [{ id: 'todos', title: 'To-dos', icon: TodosIcon, component: Todos, order: 0 }],
  commands: [
    {
      id: 'todos.open',
      title: 'Show to-dos',
      run: (context) => context.openPanel('todos'),
    },
  ],
})
