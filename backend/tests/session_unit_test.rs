use focusreader_backend::services::session::{
    calculate_mtbd, calculate_wpm, get_default_next_stage, is_valid_drill_type, is_valid_stage,
    is_valid_transition,
};

#[test]
fn test_calculate_wpm() {
    assert_eq!(calculate_wpm(0, 60), 0.0);
    assert_eq!(calculate_wpm(300, 0), 0.0);
    assert_eq!(calculate_wpm(300, -10), 0.0);
    assert_eq!(calculate_wpm(300, 60), 300.0);
    assert_eq!(calculate_wpm(250, 120), 125.0);
    assert_eq!(calculate_wpm(175, 45), 233.3);
}

#[test]
fn test_calculate_mtbd() {
    assert_eq!(calculate_mtbd(0, 0), 0.0);
    assert_eq!(calculate_mtbd(60, 0), 60.0);
    assert_eq!(calculate_mtbd(60, 2), 30.0);
    assert_eq!(calculate_mtbd(100, 4), 25.0);
    assert_eq!(calculate_mtbd(75, 3), 25.0);
}

#[test]
fn test_valid_drill_types_and_stages() {
    assert!(is_valid_drill_type("sequential_pipeline"));
    assert!(is_valid_drill_type("index_card_pacer"));
    assert!(is_valid_drill_type("one_breath_recall"));
    assert!(!is_valid_drill_type("speed_reading_hypnosis"));

    assert!(is_valid_stage("preflight_intent"));
    assert!(is_valid_stage("active_reading"));
    assert!(is_valid_stage("intent_recall"));
    assert!(is_valid_stage("debrief"));
    assert!(is_valid_stage("completed"));
    assert!(!is_valid_stage("invalid_stage"));
}

#[test]
fn test_stage_transitions() {
    // Valid standard pipeline progressions
    assert!(is_valid_transition("preflight_intent", "active_reading"));
    assert!(is_valid_transition("active_reading", "intent_recall"));
    assert!(is_valid_transition("intent_recall", "debrief"));
    assert!(is_valid_transition("debrief", "completed"));

    // Valid abort from any active state
    assert!(is_valid_transition("preflight_intent", "aborted"));
    assert!(is_valid_transition("active_reading", "aborted"));
    assert!(is_valid_transition("debrief", "aborted"));

    // Invalid backwards or terminal transitions
    assert!(!is_valid_transition("completed", "active_reading"));
    assert!(!is_valid_transition("aborted", "active_reading"));
    assert!(!is_valid_transition("debrief", "preflight_intent"));
}

#[test]
fn test_default_pipeline_progressions() {
    assert_eq!(
        get_default_next_stage("preflight_intent", "sequential_pipeline"),
        Some("active_reading")
    );
    assert_eq!(
        get_default_next_stage("active_reading", "sequential_pipeline"),
        Some("intent_recall")
    );
    assert_eq!(
        get_default_next_stage("intent_recall", "sequential_pipeline"),
        Some("debrief")
    );
    assert_eq!(
        get_default_next_stage("debrief", "sequential_pipeline"),
        Some("completed")
    );
    assert_eq!(
        get_default_next_stage("completed", "sequential_pipeline"),
        None
    );
}
