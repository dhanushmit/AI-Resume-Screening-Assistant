import sys
import unittest
from unittest.mock import patch, MagicMock

# Import app modules
from app.backend import chunk_text, build_screening_graph, extract_text_from_pdf
from app.schemas import ScreeningRequest, CandidateResult, ScreeningResponse

class TestResumeScreeningAssistant(unittest.TestCase):
    
    def test_chunking(self):
        """Verify that the text chunking mechanism splits text properly."""
        sample_text = "Python Developer. AWS Cloud Engineer. Docker Specialist. " * 20
        chunks = chunk_text(sample_text, chunk_size=100, chunk_overlap=10)
        self.assertTrue(len(chunks) > 1)
        self.assertTrue(all(len(c) <= 100 for c in chunks))
        print(f"[OK] Chunking tests passed. Generated {len(chunks)} chunks.")

    @patch('langchain_community.vectorstores.FAISS')
    def test_langgraph_flow(self, mock_faiss):
        """Verify that the LangGraph workflow retrieves and scores successfully with a mocked LLM."""
        # Create a mock retriever
        mock_retriever = MagicMock()
        mock_doc = MagicMock()
        mock_doc.page_content = "Resume text showing experience with Python, FastAPI, and Docker."
        mock_retriever.invoke.return_value = [mock_doc]
        
        # Build LangGraph graph
        graph = build_screening_graph()
        
        # Define mock LLM responses
        class MockLLM:
            def invoke(self, messages):
                return MagicMock(content='''{
                    "match_score": 88,
                    "matching_skills": ["Python", "FastAPI", "Docker"],
                    "missing_skills": ["AWS", "LangGraph"],
                    "summary": "Candidate is a strong match for backend roles but lacks AWS cloud deployment experience."
                }''')
                
        # Patch the LLM creation inside score_node
        with patch('langchain_google_genai.ChatGoogleGenerativeAI', return_value=MockLLM()):
            # Test state input
            initial_state = {
                "job_description": "We need a Python developer with FastAPI, Docker, and AWS experience.",
                "candidate_name": "Test Candidate",
                "candidate_id": "cand_1",
                "retriever": mock_retriever,
                "top_k": 5,
                "api_provider": "gemini",
                "api_key": "mock_key",
                "retrieved_chunks": [],
                "match_score": 0,
                "matching_skills": [],
                "missing_skills": [],
                "summary": "",
                "error": None,
                "logs": []
            }
            
            # Execute graph
            final_state = graph.invoke(initial_state)
            
            # Assert outputs
            self.assertIsNone(final_state.get("error"))
            self.assertEqual(final_state["match_score"], 88)
            self.assertIn("Python", final_state["matching_skills"])
            self.assertIn("AWS", final_state["missing_skills"])
            self.assertTrue(len(final_state["retrieved_chunks"]) > 0)
            self.assertTrue(len(final_state["logs"]) > 0)
            
            print("[OK] LangGraph node execution and scoring tests passed.")

if __name__ == "__main__":
    suite = unittest.TestLoader().loadTestsFromTestCase(TestResumeScreeningAssistant)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    sys.exit(not result.wasSuccessful())
