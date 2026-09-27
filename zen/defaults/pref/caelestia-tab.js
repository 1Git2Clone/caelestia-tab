// caelestia-tab: runs caelestia-tab.cfg (next to Zen's binary) at startup.
// Goes in Zen's install directory, defaults/pref/. See the handbook's Zen chapter.
pref("general.config.filename", "caelestia-tab.cfg");
pref("general.config.obscure_value", 0);
// Unsandboxed, or the script gets prefs only: no Services, no timers.
pref("general.config.sandbox_enabled", false);
