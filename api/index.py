import os
import sys

# Ensure the project root directory is in the Python search path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app
