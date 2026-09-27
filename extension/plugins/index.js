// Every widget the new tab can show. A plugin is a module whose default export
// is { id, name, defaults, settings, actions?, mount }; see the handbook's
// "Writing a plugin" chapter. Add one by importing it here.
import bookmarks from "./bookmarks.js";
import clock from "./clock.js";

export default [clock, bookmarks];
