mod host;
mod install;
mod plugins;
mod secrets;
mod zen;

use std::process::ExitCode;

const USAGE: &str = "\
usage: caelestia-tab [install | uninstall | manifest | install-zen [DIR]]

  install      register the helper with Firefox-based browsers
  uninstall    remove what install wrote
  manifest     print the native messaging manifest
  install-zen  add the live-colours script to Zen's install directory
               (found in /opt or /usr/lib, or DIR); usually needs root

With no command (or the arguments a browser passes), it runs as the native
messaging host the extension talks to.";

fn main() -> ExitCode {
    let result = match std::env::args().nth(1).as_deref() {
        Some("install") => install::install(),
        Some("uninstall") => install::uninstall(),
        Some("manifest") => install::manifest().map(|m| println!("{m:#}")),
        Some("install-zen") => zen::install(std::env::args().nth(2).as_deref()),
        Some("-h" | "--help" | "help") => {
            println!("{USAGE}");
            Ok(())
        }
        // Firefox passes the manifest path and the extension id.
        _ => tokio::runtime::Runtime::new().and_then(|rt| rt.block_on(host::run(plugins::all()))),
    };
    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("caelestia-tab: {e}");
            ExitCode::FAILURE
        }
    }
}
