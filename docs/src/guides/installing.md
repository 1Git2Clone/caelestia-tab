# Installing

There are two parts: the helper, which reads caelestia's files, and the
extension, which the browser runs. The extension works without the helper, but
then it has no scheme or wallpaper and falls back to a fixed dark red.

## The helper

With Nix:

```sh
nix profile install git+https://git.hu-tao.dev/hutao/caelestia-tab
caelestia-tab install
```

With Cargo:

```sh
cargo install --git https://git.hu-tao.dev/hutao/caelestia-tab
caelestia-tab install
```

`caelestia-tab install` writes the native messaging manifest,
`caelestia_tab.json`, to `~/.mozilla/native-messaging-hosts/`. It also writes
it to the matching directory of every fork whose home directory exists
(`~/.zen`, `~/.librewolf`, `~/.floorp`, `~/.waterfox`). The manifest holds the
helper's absolute path, so run `install` again if the binary moves.
`caelestia-tab uninstall` removes the manifests.

### On NixOS or Home Manager

A path in the Nix store changes on every update, so it's better to let the
browser wrapper link the manifest than to run `install`. The package ships the
manifest in `lib/mozilla/native-messaging-hosts/`, the shape nixpkgs' Firefox
wrapper expects:

```nix
home.packages = [
  (pkgs.floorp-bin.override {
    nativeMessagingHosts = [ inputs.caelestia-tab.packages.${pkgs.system}.default ];
  })
];
```

The same `override` works on `firefox`, `firefox-bin`, `librewolf` and the
other wrapped Firefox packages.

## The extension

It isn't on addons.mozilla.org yet. Until it is:

- **To try it**, open `about:debugging`, choose *This Firefox* (or *This
  Floorp*, and so on), then *Load Temporary Add-on…*, and pick
  `extension/manifest.json`. It stays until the browser restarts.
- **To keep it**, build an `.xpi` with `web-ext build --source-dir extension`
  and install it from `about:addons` (the gear, then *Install Add-on From
  File…*). Release Firefox refuses unsigned add-ons. Developer Edition,
  Nightly, ESR and unbranded builds accept them once
  `xpinstall.signatures.required` is `false` in `about:config`. Whether a fork
  honours that preference depends on how it was built; see
  [Browsers](browsers.md).

## Site themes

Firefox asks for "Access your data for all websites" separately in Manifest V3.
Grant it in the new tab under *Settings*, *Websites*, *Allow*, or in
`about:addons`, caelestia-tab, *Permissions*. Without it the new tab still
works, but no page gets themed.
