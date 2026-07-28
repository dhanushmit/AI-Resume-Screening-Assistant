from pydantic import BaseModel, Field
from typing import List, Optional

class ScreeningRequest(BaseModel):
    job_description: str = Field(..., description="The job description to screen resumes against.")
    api_provider: str = Field("gemini", description="LLM provider: 'openai' or 'gemini'.")
    api_key: str = Field(..., description="API key for the selected LLM provider.")
    embedding_provider: str = Field("sentence-transformers", description="Embedding provider: 'sentence-transformers', 'openai', or 'gemini'.")
    top_k: int = Field(5, description="Number of top resume chunks to retrieve.")
    chunk_size: int = Field(500, description="Resume chunk size in characters.")
    chunk_overlap: int = Field(50, description="Resume chunk overlap in characters.")

class CandidateResult(BaseModel):
    candidate_id: str
    candidate_name: str
    match_score: int
    matching_skills: List[str]
    missing_skills: List[str]
    summary: str
    retrieved_chunks: List[str]
    logs: List[str] = Field(default_factory=list)

class ScreeningResponse(BaseModel):
    status: str
    results: List[CandidateResult]
    error: Optional[str] = None
