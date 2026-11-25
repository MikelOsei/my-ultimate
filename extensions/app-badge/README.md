The installed app's icon shows how many questions wait on your answer, and clears once you have answered or dismissed them all.

An `overlay` slot component counts the open questions to the user in the Messages document of conversation 1 (the
same ones the To-dos tab lists) and sets the count with the Badging API (`navigator.setAppBadge`), or clears it at
zero. Chrome and Edge show it on an installed app's Dock or taskbar icon; in a plain browser tab, or a browser without
the API, nothing changes.

macOS shows an app's badge only once the app may send notifications. While that permission is undecided, ⌘K "Show
waiting questions on the app icon" asks for it.
