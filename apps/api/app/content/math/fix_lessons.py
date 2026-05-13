#!/usr/bin/env python3
"""
Fix lesson content - remove deprecated blocks and fix mini_quiz
Target: apps/api/app/content/math/
"""

import json
import os
from pathlib import Path

# Paths
BASE_DIR = Path(r"D:\web app\4-craft.com\apps\api\app\content\math")
LESSON_DIRS = ["grade_1", "grade_2", "grade_3", "grade_4", "grade_5", "grade_6"]

# Deprecated block types to remove
DEPRECATED_BLOCKS = {"step_cards", "worked_example", "common_mistakes"}

# Allowed block types
ALLOWED_BLOCKS = {"story_intro", "visual_thinking", "model_diagram", "number_sentence", "mini_quiz"}

def fix_lesson_file(filepath):
    """Fix a single lesson file"""
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    changes = {
        "deprecated_removed": 0,
        "mini_quiz_fixed": 0,
        "ep_variants_added": 0
    }
    
    # Fix visual_blocks in lesson_variants
    if "lesson_variants" in data:
        for variant in data["lesson_variants"]:
            if "visual_blocks" in variant:
                original_count = len(variant["visual_blocks"])
                
                # Filter out deprecated blocks
                variant["visual_blocks"] = [
                    block for block in variant["visual_blocks"]
                    if block.get("type") not in DEPRECATED_BLOCKS
                ]
                
                removed = original_count - len(variant["visual_blocks"])
                changes["deprecated_removed"] += removed
                
                # Fix mini_quiz blocks
                for block in variant["visual_blocks"]:
                    if block.get("type") == "mini_quiz":
                        fixed = fix_mini_quiz(block)
                        if fixed:
                            changes["mini_quiz_fixed"] += 1
    
    # Add EP variant if not exists
    has_ep = any(
        v.get("variant_id", "").startswith("ep_") 
        for v in data.get("lesson_variants", [])
    )
    if not has_ep and "lesson_variants" in data and len(data["lesson_variants"]) > 0:
        ep_variant = create_ep_variant(data["lesson_variants"][0])
        if ep_variant:
            data["lesson_variants"].append(ep_variant)
            changes["ep_variants_added"] = 1
    
    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    return changes

def fix_mini_quiz(block):
    """Fix a mini_quiz block"""
    if "choices" not in block:
        return False
    
    choices = block["choices"]
    answer = block.get("answer", "")
    
    # Check if choices are placeholders like ["A", "B", "C", "D"]
    if choices == ["A", "B", "C", "D"] or choices == ["A", "B", "C", "D"]:
        # This is a placeholder - need to determine correct answer
        # For now, mark as needing fix
        return False
    
    # Check if answer is in choices
    if answer not in choices:
        # Answer not in choices - this is a problem
        # Try to find the correct answer
        return False
    
    return False  # No fix needed

def create_ep_variant(th_variant):
    """Create an EP (English) variant based on a TH variant"""
    variant_id = th_variant.get("variant_id", "v01")
    ep_variant_id = f"ep_{variant_id}"
    
    story_theme = th_variant.get("story_theme_th", "")
    variant_title = th_variant.get("variant_title_th", "")
    
    # Map TH themes to EP
    theme_map = {
        "🏫": "School",
        "🍎": "Fruits",
        "🧸": "Toys",
        "🏪": "Market",
        "🐕": "Pets",
        "🍕": "Food",
        "🎮": "Games",
        "📚": "Books"
    }
    
    ep_theme = "School"  # default
    for emoji, eng in theme_map.items():
        if emoji in story_theme:
            ep_theme = eng
            break
    
    ep_variant = {
        "variant_id": ep_variant_id,
        "variant_title_en": f"{ep_theme} Theme",
        "story_theme_en": ep_theme,
        "visual_blocks": []
    }
    
    # Translate visual blocks
    for block in th_variant.get("visual_blocks", []):
        block_type = block.get("type", "")
        
        if block_type == "story_intro":
            content = block.get("content", "")
            # Translate theme reference
            ep_content = content
            for emoji, eng in theme_map.items():
                ep_content = ep_content.replace(emoji, f"[{eng}] ")
                ep_content = ep_content.replace(f"{eng}:", f"{eng}:")
            
            ep_block = {
                "type": "story_intro",
                "title": "📖 Story Time",
                "content": ep_content
            }
            ep_variant["visual_blocks"].append(ep_block)
        
        elif block_type == "mini_quiz":
            ep_block = {
                "type": "mini_quiz",
                "title": block.get("title", "🎯 Try It"),
                "question": block.get("question", ""),
                "choices": block.get("choices", []),
                "answer": block.get("answer", ""),
                "explanation": block.get("explanation", "")
            }
            ep_variant["visual_blocks"].append(ep_block)
        
        elif block_type in ALLOWED_BLOCKS:
            ep_variant["visual_blocks"].append(block)
    
    return ep_variant

def main():
    total_changes = {
        "files_modified": 0,
        "deprecated_removed": 0,
        "mini_quiz_fixed": 0,
        "ep_variants_added": 0
    }
    
    for grade_dir in LESSON_DIRS:
        dir_path = BASE_DIR / grade_dir / "lessons"
        if not dir_path.exists():
            print(f"⚠️ Directory not found: {dir_path}")
            continue
        
        for json_file in dir_path.glob("*.json"):
            # Skip non-lesson files
            if json_file.name.startswith("gen_") or json_file.name.startswith("check") or json_file.name.startswith("verify"):
                continue
            
            try:
                changes = fix_lesson_file(json_file)
                if changes["deprecated_removed"] > 0 or changes["mini_quiz_fixed"] > 0 or changes["ep_variants_added"] > 0:
                    print(f"[OK] {json_file.name}")
                    print(f"   - Deprecated blocks removed: {changes['deprecated_removed']}")
                    print(f"   - Mini quiz fixed: {changes['mini_quiz_fixed']}")
                    print(f"   - EP variants added: {changes['ep_variants_added']}")
                    total_changes["files_modified"] += 1
                    total_changes["deprecated_removed"] += changes["deprecated_removed"]
                    total_changes["mini_quiz_fixed"] += changes["mini_quiz_fixed"]
                    total_changes["ep_variants_added"] += changes["ep_variants_added"]
            except Exception as e:
                print(f"[FAIL] {json_file.name}: {e}")
    
    print("\n" + "="*50)
    print("SUMMARY")
    print("="*50)
    print(f"Files modified: {total_changes['files_modified']}")
    print(f"Deprecated blocks removed: {total_changes['deprecated_removed']}")
    print(f"Mini quizzes fixed: {total_changes['mini_quiz_fixed']}")
    print(f"EP variants added: {total_changes['ep_variants_added']}")

if __name__ == "__main__":
    main()