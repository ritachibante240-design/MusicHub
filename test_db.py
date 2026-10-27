from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent / "backend"))

from app.database import test_connection

if __name__ == "__main__":
    test_connection()