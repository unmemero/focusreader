use focusreader_backend::services::llm::{
    build_endpoint_url, calculate_composite_score, clean_extracted_prose,
    get_heuristic_focus_question, parse_mediawiki_sections, slice_mediawiki_section_paragraphs,
    validate_llm_url,
};

#[test]
fn test_validate_llm_url_valid() {
    assert_eq!(
        validate_llm_url("http://localhost:8080").unwrap(),
        "http://localhost:8080"
    );
    assert_eq!(
        validate_llm_url("http://localhost:8080/v1").unwrap(),
        "http://localhost:8080"
    );
    assert_eq!(
        validate_llm_url("http://localhost:8080/v1/chat/completions").unwrap(),
        "http://localhost:8080"
    );
    assert_eq!(
        validate_llm_url("http://127.0.0.1:8080/").unwrap(),
        "http://127.0.0.1:8080"
    );
    assert_eq!(
        validate_llm_url("http://host.docker.internal:8080/").unwrap(),
        "http://host.docker.internal:8080"
    );
    assert_eq!(
        validate_llm_url("https://192.168.1.50:11434").unwrap(),
        "https://192.168.1.50:11434"
    );
    assert_eq!(
        build_endpoint_url("http://localhost:8080/v1/chat/completions", "v1/chat/completions"),
        "http://localhost:8080/v1/chat/completions"
    );
    assert_eq!(
        build_endpoint_url("http://localhost:8080/v1", "v1/models"),
        "http://localhost:8080/v1/models"
    );
}

#[test]
fn test_validate_llm_url_ssrf_rejections() {
    // Malicious schemes must be blocked
    assert!(validate_llm_url("file:///etc/passwd").is_err());
    assert!(validate_llm_url("ftp://example.com").is_err());
    assert!(validate_llm_url("gopher://evil.com").is_err());
    assert!(validate_llm_url("javascript:alert(1)").is_err());
    assert!(validate_llm_url("").is_err());
    assert!(validate_llm_url("not a url").is_err());
}

#[test]
fn test_calculate_composite_score() {
    // 0.40 * 0.80 + 0.30 * 0.90 + 0.30 * 0.70 = 0.32 + 0.27 + 0.21 = 0.80
    let score = calculate_composite_score(0.80, 0.90, 0.70);
    assert_eq!(score, 0.80);

    // Perfect score
    let perfect = calculate_composite_score(1.0, 1.0, 1.0);
    assert_eq!(perfect, 1.0);

    // Zero score
    let zero = calculate_composite_score(0.0, 0.0, 0.0);
    assert_eq!(zero, 0.0);

    // Clamping bounds
    let clamped_high = calculate_composite_score(1.5, 2.0, 1.1);
    assert_eq!(clamped_high, 1.0);

    let clamped_low = calculate_composite_score(-0.5, -1.0, 0.0);
    assert_eq!(clamped_low, 0.0);
}

#[test]
fn test_heuristic_focus_questions() {
    let cs_q = get_heuristic_focus_question("computer_science", "bottleneck_tradeoff");
    assert!(!cs_q.is_empty());
    assert!(cs_q.contains("trade-off") || cs_q.contains("bottleneck"));

    let phys_q = get_heuristic_focus_question("physics", "mechanism_invariant");
    assert!(!phys_q.is_empty());
    assert!(phys_q.contains("invariant") || phys_q.contains("law"));

    let claim_q = get_heuristic_focus_question("general_humanities", "core_claim");
    assert!(!claim_q.is_empty());
    assert!(claim_q.contains("assertion") || claim_q.contains("claim"));
}

#[test]
fn test_deterministic_mediawiki_section_parsing_and_slicing() {
    let sample_extract = "Entropy ( ) is a scientific concept, as well as a measurable physical property, that is most commonly associated with a state of disorder, randomness, or uncertainty.[1][2]\n\n\
The term and the concept are used in diverse fields, from classical thermodynamics, where it was first recognized, to the microscopic description of nature in statistical physics, and to the principles of information theory.[citation needed]\n\n\
== Classical thermodynamics ==\n\
In 1850, the Scottish physicist William Rankine used the term thermodynamic function to describe the quantity that would later be named entropy by Rudolf Clausius during his research into heat engines and irreversible processes.[14]\n\n\
Clausius stated that in any spontaneous thermodynamic process taking place inside an isolated system, the total entropy either increases or remains constant in the ideal limit of a reversible cycle, establishing the directional arrow of time for macroscopic phenomena.\n\n\
== See also ==\n\
Some short link list that should be ignored even if it has twenty words in the line so that references never leak.";

    let cleaned = clean_extracted_prose("Entropy ( ) is a property[1][12] verified by experiment.[citation needed]");
    assert_eq!(cleaned, "Entropy is a property verified by experiment.");

    let sections = parse_mediawiki_sections(sample_extract);
    assert_eq!(sections.len(), 2);
    assert_eq!(sections[0].0, "Lead");
    assert_eq!(sections[1].0, "Classical thermodynamics");

    let (text, label, start, end, _total) =
        slice_mediawiki_section_paragraphs(&sections, Some("Classical thermodynamics"), 1, 2)
            .expect("Expected section slice");
    assert!(label.contains("Classical thermodynamics"));
    assert_eq!(start, 1);
    assert!(end >= 2);
    assert!(text.contains("William Rankine"));
    assert!(!text.contains("[14]"));
}
