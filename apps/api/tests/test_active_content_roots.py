from app.services.lesson_content import (
    CONTENT_ROOT,
    _lesson_files,
    _quiz_files,
    path_is_active_content,
)


def test_active_lesson_files_are_only_grade_lesson_roots():
    paths = _lesson_files()
    assert paths
    assert all(path_is_active_content(path, "lessons") for path in paths)
    assert not any("_content_backups" in path.parts for path in paths)
    assert not any(part.startswith("backup_") for path in paths for part in path.parts)
    assert not any("question_banks" in path.parts for path in paths)


def test_active_quiz_files_are_only_grade_quiz_roots():
    paths = _quiz_files()
    assert paths
    assert all(path_is_active_content(path, "quizzes") for path in paths)
    assert not any("_content_backups" in path.parts for path in paths)
    assert not any(part.startswith("backup_") for path in paths for part in path.parts)
    assert not any("question_banks" in path.parts for path in paths)
    assert not any(path.suffix == ".jsonl" for path in paths)


def test_backup_and_legacy_paths_are_rejected():
    assert not path_is_active_content(
        CONTENT_ROOT / "_content_backups" / "20260522" / "question_banks" / "grade_3" / "g3_area_intro.jsonl",
        "quizzes",
    )
    assert not path_is_active_content(CONTENT_ROOT / "question_banks" / "grade_3" / "g3_area_intro.jsonl", "quizzes")
    assert not path_is_active_content(CONTENT_ROOT / "g3" / "lessons" / "g3_area_intro.json", "lessons")
    assert not path_is_active_content(CONTENT_ROOT / "backup_miniquiz_round3" / "g3_area_intro.json", "quizzes")
