from pydantic import BaseModel, Field, field_validator, model_validator


class GeneratedQuestion(BaseModel):
    question_text: str = Field(min_length=1)
    question_type: str
    choices: list[str]
    correct_answer: str = Field(min_length=1)
    explanation: str = Field(min_length=1)
    hint: str = Field(min_length=1)
    skill_id: str
    difficulty: str
    mistake_type_target: str

    @field_validator("question_type")
    @classmethod
    def must_be_multiple_choice(cls, value: str) -> str:
        if value != "multiple_choice":
            raise ValueError("only multiple_choice is supported in MVP")
        return value

    @field_validator("difficulty")
    @classmethod
    def valid_difficulty(cls, value: str) -> str:
        if value not in {"easy", "medium", "hard"}:
            raise ValueError("invalid difficulty")
        return value

    @model_validator(mode="after")
    def validate_choices(self) -> "GeneratedQuestion":
        if len(self.choices) != 4:
            raise ValueError("multiple_choice must have exactly 4 choices")
        if self.correct_answer not in self.choices:
            raise ValueError("correct_answer must be included in choices")
        return self


class GeneratedPractice(BaseModel):
    lesson_summary: str = Field(min_length=1)
    teaching_strategy: str = Field(min_length=1)
    questions: list[GeneratedQuestion] = Field(min_length=1)


UNSAFE_TERMS = {"ฆ่า", "เลือด", "พนัน", "ยาเสพติด", "การเมือง"}


def validate_generated_practice(payload: dict, expected_skill_id: str, expected_difficulty: str | None = None) -> GeneratedPractice:
    practice = GeneratedPractice.model_validate(payload)
    for question in practice.questions:
        if question.skill_id != expected_skill_id:
            raise ValueError("generated question skill_id does not match requested skill")
        if expected_difficulty and question.difficulty != expected_difficulty:
            raise ValueError("generated question difficulty does not match request")
        combined_text = " ".join([question.question_text, question.explanation, question.hint])
        if any(term in combined_text for term in UNSAFE_TERMS):
            raise ValueError("generated content contains unsafe child content")
    return practice
