import io
import json
import logging
from typing import List, Dict, Any, Optional
from typing_extensions import TypedDict
from pypdf import PdfReader

# LangChain / LangGraph imports
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.graph import StateGraph, END

# Import prompt templates
from app.prompts import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE

logger = logging.getLogger(__name__)

# --- Helper Functions ---

def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extracts text from PDF bytes using PyPDF."""
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        text = ""
        for i, page in enumerate(reader.pages):
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
        return text
    except Exception as e:
        logger.error(f"Error parsing PDF: {str(e)}")
        raise ValueError(f"Failed to parse PDF document: {str(e)}")

def chunk_text(text: str, chunk_size: int = 500, chunk_overlap: int = 50) -> List[str]:
    """Splits text into overlapping chunks using RecursiveCharacterTextSplitter."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len
    )
    return splitter.split_text(text)

def get_embedding_model(provider: str, api_key: str = None):
    """Instantiates the selected embedding model."""
    if provider == "openai":
        from langchain_openai import OpenAIEmbeddings
        if not api_key:
            raise ValueError("OpenAI API key is required for OpenAI embeddings.")
        return OpenAIEmbeddings(openai_api_key=api_key)
    elif provider == "gemini":
        from langchain_google_genai import GoogleGenerativeAIEmbeddings
        from langchain_google_genai._common import get_client_info
        from langchain_google_genai._genai_extension import build_generative_service
        if not api_key:
            raise ValueError("Gemini API key is required for Gemini embeddings.")
        
        embeddings = GoogleGenerativeAIEmbeddings(
            google_api_key=api_key,
            model="models/gemini-embedding-2"
        )
        # Override the client to use REST transport (workaround for gRPC connection timeouts in version 1.0.6)
        client_info = get_client_info("GoogleGenerativeAIEmbeddings")
        embeddings.client = build_generative_service(
            api_key=api_key,
            client_info=client_info,
            transport="rest"
        )
        return embeddings
    elif provider == "sentence-transformers":
        from langchain_community.embeddings import HuggingFaceEmbeddings
        try:
            return HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        except Exception as e:
            logger.error(f"Failed to load HuggingFace sentence-transformers: {e}")
            raise RuntimeError(f"Failed to initialize local HuggingFace embeddings. Make sure torch and sentence-transformers are installed: {e}")
    else:
        raise ValueError(f"Unsupported embedding provider: {provider}")

# --- LangGraph Setup ---

class CandidateState(TypedDict):
    job_description: str
    candidate_name: str
    candidate_id: str
    retriever: Any  # FAISS retriever
    top_k: int
    api_provider: str
    api_key: str
    # Outputs
    retrieved_chunks: List[str]
    match_score: int
    matching_skills: List[str]
    missing_skills: List[str]
    summary: str
    error: Optional[str]
    logs: List[str]

# Node 1: Retrieve relevant resume chunks
def retrieve_node(state: CandidateState) -> Dict[str, Any]:
    logs = list(state.get("logs", []))
    logs.append("Node 1: Retrieving relevant resume sections...")
    try:
        retriever = state["retriever"]
        top_k = state.get("top_k", 5)
        jd = state["job_description"]
        
        # Query FAISS
        docs = retriever.invoke(jd)[:top_k]
        retrieved_chunks = [doc.page_content for doc in docs]
        
        logs.append(f"Successfully retrieved {len(retrieved_chunks)} relevant chunk(s) from FAISS.")
        return {
            "retrieved_chunks": retrieved_chunks,
            "logs": logs
        }
    except Exception as e:
        logger.error(f"Error in retrieve_node: {e}")
        logs.append(f"Error during retrieval: {str(e)}")
        return {
            "error": f"Retrieval step failed: {str(e)}",
            "logs": logs
        }

# Node 2: Compare, Score & Summarize using LLM
def score_node(state: CandidateState) -> Dict[str, Any]:
    logs = list(state.get("logs", []))
    logs.append("Node 2: Scoring and summarizing candidate against JD...")
    
    if state.get("error"):
        logs.append("Skipping scoring due to previous retrieval error.")
        return {"logs": logs}
        
    try:
        retrieved_chunks = state.get("retrieved_chunks", [])
        if not retrieved_chunks:
            logs.append("No resume chunks retrieved. Scoring candidate as 0.")
            return {
                "match_score": 0,
                "matching_skills": [],
                "missing_skills": ["Entire resume (no relevant text retrieved)"],
                "summary": "Could not score candidate. No relevant text context was found in the resume.",
                "logs": logs
            }
            
        jd = state["job_description"]
        api_provider = state["api_provider"]
        api_key = state["api_key"]
        
        context_text = "\n\n---\n\n".join(retrieved_chunks)
        
        # Instantiate LLM based on provider selection
        if api_provider == "openai":
            from langchain_openai import ChatOpenAI
            llm = ChatOpenAI(
                openai_api_key=api_key,
                model="gpt-4o-mini",
                temperature=0.0,
                model_kwargs={"response_format": {"type": "json_object"}},
                max_retries=0
            )
        elif api_provider == "gemini":
            from langchain_google_genai import ChatGoogleGenerativeAI
            llm = ChatGoogleGenerativeAI(
                google_api_key=api_key,
                model="gemini-flash-latest",
                temperature=0.0,
                response_mime_type="application/json",
                transport="rest",
                max_retries=3
            )
        else:
            raise ValueError(f"Unknown API provider: {api_provider}")
            
        # Format the user prompt
        user_content = USER_PROMPT_TEMPLATE.format(
            job_description=jd,
            retrieved_resume_chunks=context_text
        )
        
        messages = [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=user_content)
        ]
        
        # Invoke LLM
        response = llm.invoke(messages)
        response_text = response.content.strip()
        
        # Parse structured response JSON
        data = json.loads(response_text)
        
        # Extract values
        match_score = int(data.get("match_score", 0))
        matching_skills = data.get("matching_skills", [])
        missing_skills = data.get("missing_skills", [])
        summary = data.get("summary", "")
        
        logs.append(f"Successfully evaluated candidate. Match Score: {match_score}%.")
        return {
            "match_score": match_score,
            "matching_skills": matching_skills,
            "missing_skills": missing_skills,
            "summary": summary,
            "logs": logs
        }
    except Exception as e:
        logger.error(f"Error in score_node: {e}")
        logs.append(f"Error during scoring: {str(e)}")
        return {
            "error": f"Scoring step failed: {str(e)}",
            "logs": logs
        }

# Compile LangGraph
def build_screening_graph():
    workflow = StateGraph(CandidateState)
    
    # Define Nodes
    workflow.add_node("retrieve", retrieve_node)
    workflow.add_node("score_and_summarize", score_node)
    
    # Define edges
    workflow.set_entry_point("retrieve")
    workflow.add_edge("retrieve", "score_and_summarize")
    workflow.add_edge("score_and_summarize", END)
    
    return workflow.compile()

# --- Orchestrator Pipeline ---

def screen_candidates(
    job_description: str,
    resumes: List[Dict[str, Any]],  # List containing keys: 'name', 'content' (bytes)
    api_provider: str,
    api_key: str,
    embedding_provider: str = "sentence-transformers",
    top_k: int = 5,
    chunk_size: int = 500,
    chunk_overlap: int = 50
) -> List[Dict[str, Any]]:
    """
    Performs RAG + LangGraph screening workflow across multiple candidate resumes.
    """
    results = []
    
    # Initialize embedding model once for the run
    embeddings = get_embedding_model(embedding_provider, api_key)
    
    # Compile graph
    graph = build_screening_graph()
    
    for idx, resume in enumerate(resumes):
        candidate_name = resume.get("name", f"Candidate {idx + 1}")
        candidate_id = f"cand_{idx + 1}"
        candidate_logs = ["Initializing screening pipeline for candidate..."]
        
        try:
            # Step 1: Text extraction
            pdf_text = extract_text_from_pdf(resume["content"])
            candidate_logs.append("Resume text extracted successfully.")
            
            # Step 2: Chunking
            chunks = chunk_text(pdf_text, chunk_size, chunk_overlap)
            candidate_logs.append(f"Resume split into {len(chunks)} text chunks.")
            
            if not chunks:
                raise ValueError("No text content could be extracted from this resume PDF.")
            
            # Step 3: Build Vector Store for candidate
            db = FAISS.from_texts(chunks, embeddings)
            retriever = db.as_retriever(search_kwargs={"k": top_k})
            candidate_logs.append("FAISS vector store indexed successfully (Per-candidate isolated RAG index).")
            
            # Step 4: Execute LangGraph
            initial_state = {
                "job_description": job_description,
                "candidate_name": candidate_name,
                "candidate_id": candidate_id,
                "retriever": retriever,
                "top_k": top_k,
                "api_provider": api_provider,
                "api_key": api_key,
                "retrieved_chunks": [],
                "match_score": 0,
                "matching_skills": [],
                "missing_skills": [],
                "summary": "",
                "error": None,
                "logs": candidate_logs
            }
            
            final_state = graph.invoke(initial_state)
            
            results.append({
                "candidate_id": candidate_id,
                "candidate_name": candidate_name,
                "match_score": final_state.get("match_score", 0),
                "matching_skills": final_state.get("matching_skills", []),
                "missing_skills": final_state.get("missing_skills", []),
                "summary": final_state.get("summary", ""),
                "retrieved_chunks": final_state.get("retrieved_chunks", []),
                "logs": final_state.get("logs", [])
            })
            
        except Exception as e:
            logger.error(f"Error processing candidate {candidate_name}: {e}")
            candidate_logs.append(f"Screening pipeline error: {str(e)}")
            results.append({
                "candidate_id": candidate_id,
                "candidate_name": candidate_name,
                "match_score": 0,
                "matching_skills": [],
                "missing_skills": ["Entire Resume (Screening failed)"],
                "summary": f"Failed to screen this candidate: {str(e)}",
                "retrieved_chunks": [],
                "logs": candidate_logs
            })
            
    # Sort results by match score descending
    results.sort(key=lambda x: x["match_score"], reverse=True)
    return results
