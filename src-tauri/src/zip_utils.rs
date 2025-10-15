pub fn is_zip_like(name: &str) -> bool {
    let trimmed = name.trim();
    let lower = trimmed.to_ascii_lowercase();
    lower.ends_with(".zip") || lower.ends_with(".zipx")
}

#[cfg(test)]
mod tests {
    use super::is_zip_like;

    #[test]
    fn detects_zip_extensions() {
        assert!(is_zip_like("archive.zip"));
        assert!(is_zip_like("archive.ZIP"));
        assert!(is_zip_like("nested.zipx"));
    }

    #[test]
    fn rejects_non_zip_extensions() {
        assert!(!is_zip_like("archive.tar"));
        assert!(!is_zip_like("document.txt"));
        assert!(!is_zip_like(""));
    }
}
