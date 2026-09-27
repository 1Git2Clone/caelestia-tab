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
            ];

            RUST_SRC_PATH = "${pkgs.rustPlatform.rustLibSrc}";
          };
        }
      );
    };
}
