{
  description = "caelestia-tab: a new tab and site themes that follow the caelestia colour scheme";
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { self, nixpkgs }:
    let
      # caelestia is Linux-only, so the helper is too.
      systems = [
        "x86_64-linux"
        "aarch64-linux"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in
    {
      # Adds the live-colours watcher (zen/caelestia-tab.cfg) to a wrapped Zen,
      # for example zen-browser-flake's packages:
      #
      #   caelestia-tab.lib.wrapZen (zen-browser.packages.${system}.beta.override { ... })
      #
      # The same script `caelestia-tab install-zen` puts in a non-Nix install.
      lib.wrapZen =
        zen:
        (zen.override (old: {
          extraPrefs = (old.extraPrefs or "") + "\n" + builtins.readFile ./zen/caelestia-tab.cfg;
        })).overrideAttrs
          (old: {
            buildCommand = old.buildCommand + ''
              # The wrapper symlinks Zen's binaries into its own lib dir, and a
              # symlinked binary runs from the unwrapped package's directory,
              # which has none of the wrapper's autoconfig. nixpkgs' Firefox
              # wrapper copies its binary for the same reason.
              for bin in "$out"/lib/*/zen "$out"/lib/*/zen-bin; do
                if [ -L "$bin" ]; then cp --remove-destination "$(readlink -f "$bin")" "$bin"; fi
              done
              # Unsandboxed, or the script gets prefs only: no Services, no timers.
              echo 'pref("general.config.sandbox_enabled", false);' >> "$(echo "$out"/lib/*/defaults/pref/autoconfig.js)"
            '';
          });

      packages = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          manifest = (pkgs.lib.importTOML ./Cargo.toml).package;
        in
        {
          default = pkgs.rustPlatform.buildRustPackage {
            pname = manifest.name;
            inherit (manifest) version;
            src = self;
            cargoLock.lockFile = ./Cargo.lock;

            # The shape nixpkgs' Firefox wrapper expects from `nativeMessagingHosts`,
            # so `firefox.override { nativeMessagingHosts = [ caelestia-tab ]; }` works.
            postInstall = ''
              mkdir -p $out/lib/mozilla/native-messaging-hosts
              $out/bin/caelestia-tab manifest > $out/lib/mozilla/native-messaging-hosts/caelestia_tab.json
            '';

            meta = {
              description = manifest.description;
              license = pkgs.lib.licenses.mit;
              mainProgram = "caelestia-tab";
              platforms = pkgs.lib.platforms.linux;
            };
          };
        }
      );

      devShells = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        {
          default = pkgs.mkShell {
            packages = with pkgs; [
              rustc
              cargo
              clippy
              rustfmt
              rust-analyzer

              # The handbook in docs/.
              mdbook

              # The extension: `web-ext lint` and `web-ext run`, and node for
              # scripts/vendor-userstyles.mjs.
              web-ext
              nodejs

              # scripts/vendor-nerd-fonts.sh
              woff2
              jq
            ];

            RUST_SRC_PATH = "${pkgs.rustPlatform.rustLibSrc}";
          };
        }
      );
    };
}
