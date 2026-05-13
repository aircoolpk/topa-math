from abc import ABC, abstractmethod


class AIProvider(ABC):
    @abstractmethod
    async def generate_practice(self, payload: dict) -> dict:
        raise NotImplementedError


class MiniMaxProvider(AIProvider):
    def __init__(self, api_key: str | None):
        self.api_key = api_key

    async def generate_practice(self, payload: dict) -> dict:
        if not self.api_key:
            raise RuntimeError("MINIMAX_API_KEY is not configured")
        raise NotImplementedError("MiniMax HTTP integration will be wired in production configuration")


class MockAIProvider(AIProvider):
    async def generate_practice(self, payload: dict) -> dict:
        skill_id = payload["skill_id"]
        difficulty = payload.get("target_difficulty", "easy")
        return {
            "lesson_summary": "ลองฝึกทีละขั้น แล้วตรวจคำตอบอย่างใจเย็น",
            "teaching_strategy": "ใช้ตัวอย่างสั้น ๆ และตัวเลขไม่ซับซ้อน",
            "questions": [
                {
                    "question_text": f"ข้อที่ {index}: 2 + {index} = ?",
                    "question_type": "multiple_choice",
                    "choices": [str(index + 1), str(index + 2), str(index + 3), str(index + 4)],
                    "correct_answer": str(index + 2),
                    "explanation": f"2 + {index} เท่ากับ {index + 2}",
                    "hint": "เริ่มนับต่อจาก 2",
                    "skill_id": skill_id,
                    "difficulty": difficulty,
                    "mistake_type_target": payload.get("mistake_type", "calculation_error"),
                }
                for index in range(1, 11)
            ],
        }
