mod host;
mod install;
mod plugins;

use std::process::ExitCode;

const USAGE: &str = "\
usage: caelestia-tab [install | uninstall | manifest]

  install    register the helper with Firefox-based browsers
  uninstall  remove what install wrote
  manifest   print the native messaging manifest

With no command (or the arguments a browser passes), it runs as the native
messaging host the extension talks to.";

fn main() -> ExitCode {
    let result = match std::env::args().nth(1).as_deref() {
        Some("install") => install::install(),
        Some("uninstall") => install::uninstall(),
        Some("manifest") => install::manifest().map(|m| println!("{m:#}")),
        Some("-h" | "--help" | "help") => {
            println!("{USAGE}");
            Ok(())
        }
        // Firefox passes the manifest path and the extension id.
        _ => host::run(plugins::all()),
    };
    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("caelestia-tab: {e}");
            ExitCode::FAILURE
        }
    }
}
