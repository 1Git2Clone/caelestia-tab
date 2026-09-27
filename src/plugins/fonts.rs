use std::io;

use async_trait::async_trait;
use tokio::process::Command;

use serde_json::Value;

use super::Plugin;

/// The installed font families, from fontconfig, for the new tab's font
/// fields: a web page can't list the machine's fonts itself. Read once when
/// the helper starts; a font installed later shows up after a browser restart.
pub struct Fonts;

#[async_trait]
impl Plugin for Fonts {
    fn topic(&self) -> &'static str {
        "fonts"
    }

    async fn read(&self) -> io::Result<Value> {
        let out = Command::new("fc-list")
            .args([":", "family"])
            .output()
            .await?;
        Ok(families(&String::from_utf8_lossy(&out.stdout)).into())
    }
}

/// fc-list prints one font per line, its family names comma-separated (a
/// family can have localised names); the first is the one CSS knows it by.
fn families(list: &str) -> Vec<String> {
    let mut out: Vec<String> = list
        .lines()
        .filter_map(|l| l.split(',').next())
        .map(|f| f.trim().replace('\\', ""))
        .filter(|f| !f.is_empty())
        .collect();
    out.sort_by_cached_key(|f| (f.to_lowercase(), f.clone()));
    out.dedup();
    out
}

#[cfg(test)]
mod tests {
    #[test]
    fn first_family_of_each_font_sorted_once() {
        let list = "Rubik\nNoto Sans,Noto Sans Display\nrubik\nRubik\nFira\\-Code\n\n";
        assert_eq!(
            super::families(list),
            ["Fira-Code", "Noto Sans", "Rubik", "rubik"]
        );
    }
}
