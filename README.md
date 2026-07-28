# ScreenAI - AI Resume Screening Assistant

ScreenAI is a state-of-the-art **AI Resume Screening Assistant** that automatically ranks and evaluates candidate resumes (PDFs) against a provided Job Description.

It uses a localized **RAG (Retrieval-Augmented Generation)** search pipeline to extract the most relevant segments of a candidate's CV and orchestrates a stateful evaluation workflow using **LangGraph** to match qualifications, log step-by-step pipeline executions, and calculate match scores.

---

## 🌟 Key Features

- **Isolated Per-Candidate RAG Indexing:** Builds a separate vector database index for each uploaded CV, ensuring data privacy and preventing cross-candidate evaluation leaks.
- **Stateful LangGraph Orchestration:** Evaluates candidates through a step-by-step workflow (START &rarr; Node 1: Retrieve &rarr; Node 2: Score & Summarize &rarr; END) with full execution logs.
- **Local offline embeddings:** Uses SentenceTransformers (`all-MiniLM-L6-v2`) locally to compute vector embeddings for free and offline.
- **Interactive Dashboard:** Premium dark-themed single-page dashboard with glassmorphism layout, live log viewing, off-canvas settings drawer, and detailed candidate match logs.
- **CSV Export:** Export structured results (rank, candidate name, match score, matching skills, gaps, and summaries) to CSV with one click.

---

## 🛠️ Tech Stack

- **Backend:** FastAPI, Uvicorn, Python
- **Orchestration & Agents:** LangGraph, LangChain
- **Vector Database:** FAISS (in-memory)
- **PDF Parsing:** PyPDF
- **LLM Model:** Google Gemini 1.5 Flash (default) or OpenAI GPT-4o-mini
- **Embeddings:** HuggingFace SentenceTransformers (local) or Gemini/OpenAI cloud embeddings
- **Frontend:** HTML5, CSS3 (Vanilla), JavaScript (ES6), FontAwesome

---

## 🚀 Getting Started

### 1. Prerequisites
- Python 3.9 or higher installed.

### 2. Installation
Clone the repository and install the dependencies:
```bash
git clone https://github.com/dhanushmit/AI-Resume-Screening-Assistant.git
cd AI-Resume-Screening-Assistant

# Create a virtual environment
python -m venv .venv

# Activate the virtual environment
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

# Install requirements
pip install -r requirements.txt
```

### 3. Environment Setup
Create a `.env` file in the root directory (you can copy from `.env.example`):
```bash
# LLM API Keys
GEMINI_API_KEY=your_gemini_api_key_here
# Optional (if you want to use OpenAI instead)
OPENAI_API_KEY=your_openai_api_key_here
```

### 4. Running the Application
Start the FastAPI server:
```bash
uvicorn main:app --reload
```
Once started, visit **http://127.0.0.1:8000** in your browser to access the interactive dashboard.

### 5. Running Tests
To run unit and pipeline tests:
```bash
python verify_pipeline.py
```

---

## 🧩 System Architecture

```
                       +------------------------+
                       |      Web UI Upload     |
                       | (Resumes + Job Desc)   |
                       +-----------+------------+
                                   |
                                   v
                       +-----------+------------+
                       |    FastAPI Backend     |
                       +-----------+------------+
                                   |
                                   v
                     +-------------+-------------+
                     | PyPDF Document Extraction |
                     +-------------+-------------+
                                   |
                                   v
                  +----------------+----------------+
                  |  RecursiveCharacterTextSplitter |
                  +----------------+----------------+
                                   |
                                   v
             +---------------------+---------------------+
             | SentenceTransformers (Local Embeddings)    |
             +---------------------+---------------------+
                                   |
                                   v
                      +------------+------------+
                      |   FAISS Vector Index    |
                      +------------+------------+
                                   |
                                   v
             +---------------------+---------------------+
             |         LangGraph Stateful Agent          |
             |                                           |
             |  [START]                                  |
             |     |                                     |
             |     v                                     |
             |  [Node 1: Retrieve]                       |
             |     | (Fetches Top-K chunks via similarity|
             |     v  score against JD query)            |
             |  [Node 2: Score & Summarize]              |
             |     | (LLM extracts matching skills,      |
             |     v  missing requirements & matches %)  |
             |  [END]                                    |
             +---------------------+---------------------+
                                   |
                                   v
                      +------------+------------+
                      |   Render Results in UI  |
                      +-------------------------+
```

---

## 🔒 Security & Privacy
ScreenAI handles all candidate resume text extraction, chunking, and database indexing in memory. The FAISS vector database is generated from scratch dynamically per candidate request and destroyed when the request ends. Resume data is never sent to third-party endpoints, except for evaluations conducted by your specified LLM provider (Google Gemini or OpenAI).
