import { useEffect } from 'react'
import { defineWebExtension, useDocOf } from '@/sdk'
import { MessagesDoc, emptyMessages, waitingOnUser } from '../messages/ui.tsx'

/** The count last put on the icon, so granting the permission can show it at once. */
let shown = 0

function show(count: number) {
  shown = count
  if (!('setAppBadge' in navigator)) return
  // The badge is a hint: a browser that refuses it (not installed, no permission) leaves the icon as it is.
  void (count ? navigator.setAppBadge(count) : navigator.clearAppBadge()).catch(() => undefined)
}

/** Puts the number of questions waiting on the user on the installed app's icon. */
function Badge() {
  const count = waitingOnUser(useDocOf(1, MessagesDoc) ?? emptyMessages)
  useEffect(() => show(count), [count])
  return null
}

export default defineWebExtension({
  slots: { overlay: [Badge] },
  commands: [
    {
      // macOS shows an app's badge only once it may send notifications.
      id: 'app-badge.allow',
      title: 'Show waiting questions on the app icon',
      when: () =>
        'setAppBadge' in navigator &&
        'Notification' in window &&
        Notification.permission === 'default',
      run: async () => {
        await Notification.requestPermission()
        show(shown)
      },
    },
  ],
})
