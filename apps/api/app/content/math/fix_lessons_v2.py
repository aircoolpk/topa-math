#!/usr/bin/env python3
"""
Fix lesson content - remove deprecated blocks and fix mini_quiz
Target: apps/api/app/content/math/
Supports both block formats:
  - Format A: {type, title, content, choices, answer, ...} (grade 1-3, 6)
  - Format B: {type, block_title, description, content: {story_th, ...}, ...} (grade 4)
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

def is_deprecated_block(block):
    """Check if a block is deprecated"""
    return block.get("type") in DEPRECATED_BLOCKS

def fix_block_content(content):
    """Fix content that might be a dict with story_th, theme_th etc"""
    if isinstance(content, dict):
        # Format B: content is a dict
        if "story_th" in content:
            return content.get("story_th", "")
        elif "question_th" in content:
            return content.get("question_th", "")
        else:
            return str(content)
    return content

def fix_lesson_file(filepath):
    """Fix a single lesson file"""
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    changes = {
        "deprecated_removed": 0,
        "mini_quiz_fixed": 0,
        "ep_variants_added": 0,
        "errors": []
    }
    
    # Fix visual_blocks in lesson_variants
    if "lesson_variants" in data:
        for variant in data["lesson_variants"]:
            if "visual_blocks" in variant:
                original_count = len(variant["visual_blocks"])
                
                # Filter out deprecated blocks
                new_blocks = []
                for block in variant["visual_blocks"]:
                    if is_deprecated_block(block):
                        changes["deprecated_removed"] += 1
                    else:
                        new_blocks.append(block)
                
                variant["visual_blocks"] = new_blocks
                
                # Fix mini_quiz blocks
                for block in variant["visual_blocks"]:
                    if block.get("type") == "mini_quiz":
                        try:
                            fixed = fix_mini_quiz_v2(block)
                            if fixed:
                                changes["mini_quiz_fixed"] += 1
                        except Exception as e:
                            changes["errors"].append(str(e))
    
    # Add EP variant if not exists
    has_ep = any(
        v.get("variant_id", "").startswith("ep_") 
        for v in data.get("lesson_variants", [])
    )
    if not has_ep and "lesson_variants" in data and len(data["lesson_variants"]) > 0:
        try:
            ep_variant = create_ep_variant_v2(data["lesson_variants"][0])
            if ep_variant:
                data["lesson_variants"].append(ep_variant)
                changes["ep_variants_added"] = 1
        except Exception as e:
            changes["errors"].append(f"EP variant: {str(e)}")
    
    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    return changes

def fix_mini_quiz_v2(block):
    """Fix a mini_quiz block - handles both format A and B"""
    # Get choices - might be at block level or in content
    choices = block.get("choices", [])
    
    # Format B: choices might be inside content
    if not choices and isinstance(block.get("content"), dict):
        choices = block["content"].get("choices", [])
    
    if not choices:
        return False
    
    # Check if choices are placeholders
    if choices == ["A", "B", "C", "D"]:
        # This is a placeholder - mark for manual fix
        return False
    
    # Get answer
    answer = block.get("answer", "")
    if not answer and isinstance(block.get("content"), dict):
        answer = block["content"].get("answer", "")
    
    # Check if answer is in choices
    if answer and answer not in choices:
        # Try to fix by finding correct answer in choices
        # For now, just return False (needs manual fix)
        return False
    
    return False  # No fix needed

def create_ep_variant_v2(th_variant):
    """Create an EP (English) variant based on a TH variant - handles both formats"""
    variant_id = th_variant.get("variant_id", "v01")
    ep_variant_id = f"ep_{variant_id}"
    
    # Get story theme - might be story_theme_th or in content
    story_theme = th_variant.get("story_theme_th", "")
    
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
            # Handle both format A and B
            content = block.get("content", "")
            if isinstance(content, dict):
                content = content.get("story_th", "")
            
            # Translate theme reference
            ep_content = content
            for emoji, eng in theme_map.items():
                ep_content = ep_content.replace(emoji, f"[{eng}] ")
            
            ep_block = {
                "type": "story_intro",
                "title": "Story Time",
                "content": ep_content
            }
            ep_variant["visual_blocks"].append(ep_block)
        
        elif block_type == "mini_quiz":
            # Handle both format A and B
            choices = block.get("choices", [])
            if not choices and isinstance(block.get("content"), dict):
                choices = block["content"].get("choices", [])
            
            answer = block.get("answer", "")
            if not answer and isinstance(block.get("content"), dict):
                answer = block["content"].get("answer", "")
            
            ep_block = {
                "type": "mini_quiz",
                "title": block.get("title", block.get("block_title", "Try It")),
                "question": block.get("question", ""),
                "choices": choices,
                "answer": answer,
                "explanation": block.get("explanation", "")
            }
            ep_variant["visual_blocks"].append(ep_block)
        
        elif block_type in ALLOWED_BLOCKS:
            # Copy block as-is for other allowed types
            ep_variant["visual_blocks"].append(block)
    
    return ep_variant

def main():
    total_changes = {
        "files_modified": 0,
        "deprecated_removed": 0,
        "mini_quiz_fixed": 0,
        "ep_variants_added": 0,
        "errors": []
    }
    
    for grade_dir in LESSON_DIRS:
        dir_path = BASE_DIR / grade_dir / "lessons"
        if not dir_path.exists():
            print(f"[SKIP] Directory not found: {dir_path}")
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
                    if changes['errors']:
                        print(f"   - Errors: {changes['errors']}")
                    total_changes["files_modified"] += 1
                    total_changes["deprecated_removed"] += changes["deprecated_removed"]
                    total_changes["mini_quiz_fixed"] += changes["mini_quiz_fixed"]
                    total_changes["ep_variants_added"] += changes["ep_variants_added"]
                    total_changes["errors"].extend(changes["errors"])
            except Exception as e:
                print(f"[FAIL] {json_file.name}: {e}")
                total_changes["errors"].append(f"{json_file.name}: {str(e)}")
    
    print("\n" + "="*50)
    print("SUMMARY")
    print("="*50)
    print(f"Files modified: {total_changes['files_modified']}")
    print(f"Deprecated blocks removed: {total_changes['deprecated_removed']}")
    print(f"Mini quizzes fixed: {total_changes['mini_quiz_fixed']}")
    print(f"EP variants added: {total_changes['ep_variants_added']}")
    if total_changes['errors']:
        print(f"Errors: {len(total_changes['errors'])}")
        for err in total_changes['errors'][:5]:
            print(f"  - {err}")

if __name__ == "__main__":
    main()