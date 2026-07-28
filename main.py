import os
import logging
from typing import List
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.schemas import ScreeningResponse, CandidateResult
from app.backend import screen_candidates

# Load environment variables
load_dotenv()

# Initialize Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Resume Screening Assistant",
    description="Automatically screen and rank resumes against a job description using RAG & LangGraph."
)

# Enable CORS for local testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
static_dir = os.path.join(BASE_DIR, "app", "static")
index_file = os.path.join(static_dir, "index.html")

# Serve Frontend static files
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
async def read_index():
    """Serves the main single-page web dashboard."""
    return FileResponse(index_file)

@app.post("/api/screen", response_model=ScreeningResponse)
async def api_screen_resumes(
    job_description: str = Form(..., description="Job Description text"),
    api_provider: str = Form("gemini", description="LLM provider ('openai' or 'gemini')"),
    api_key: str = Form("", description="API Key for selected provider"),
    embedding_provider: str = Form("sentence-transformers", description="Embedding provider ('sentence-transformers', 'openai', or 'gemini')"),
    top_k: int = Form(5, description="Number of top chunks to retrieve"),
    chunk_size: int = Form(500, description="Size of text chunks"),
    chunk_overlap: int = Form(50, description="Overlap of text chunks"),
    resumes: List[UploadFile] = File(..., description="PDF Resume files to screen")
):
    """
    Accepts job description text and multiple resume PDFs, processes them via a RAG 
    retrieval pipeline and a LangGraph workflow, and returns candidate match scores and gap summaries.
    """
    logger.info(f"Received screening request. Candidates: {len(resumes)}, Provider: {api_provider}, Embeddings: {embedding_provider}")
    
    if not resumes:
        raise HTTPException(status_code=400, detail="No resume files uploaded.")
        
    try:
        # Prepare candidates resume data
        resume_data_list = []
        for file in resumes:
            if not file.filename.lower().endswith(".pdf"):
                logger.warning(f"Skipping file {file.filename}: Not a PDF.")
                continue
            
            # Read pdf bytes
            content = await file.read()
            resume_data_list.append({
                "name": file.filename.replace(".pdf", "").replace("_", " ").title(),
                "content": content
            })
            
        if not resume_data_list:
            raise HTTPException(status_code=400, detail="No valid PDF resumes were provided.")
            
        # Resolve API Key from form or server environment
        effective_api_key = api_key.strip()
        if not effective_api_key:
            if api_provider == "gemini":
                effective_api_key = os.getenv("GEMINI_API_KEY", "")
            elif api_provider == "openai":
                effective_api_key = os.getenv("OPENAI_API_KEY", "")
                
        if not effective_api_key:
            raise HTTPException(
                status_code=400,
                detail=f"API Key for {api_provider} was not provided in the request form and is not configured in the server's .env file."
            )

        # Execute screening pipeline
        results = screen_candidates(
            job_description=job_description,
            resumes=resume_data_list,
            api_provider=api_provider,
            api_key=effective_api_key,
            embedding_provider=embedding_provider,
            top_k=top_k,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap
        )
        
        # Format response results
        formatted_results = []
        for res in results:
            formatted_results.append(CandidateResult(
                candidate_id=res["candidate_id"],
                candidate_name=res["candidate_name"],
                match_score=res["match_score"],
                matching_skills=res["matching_skills"],
                missing_skills=res["missing_skills"],
                summary=res["summary"],
                retrieved_chunks=res["retrieved_chunks"],
                logs=res["logs"]
            ))
            
        return ScreeningResponse(status="success", results=formatted_results)
        
    except Exception as e:
        logger.exception("An error occurred during screening:")
        return ScreeningResponse(status="error", results=[], error=str(e))
