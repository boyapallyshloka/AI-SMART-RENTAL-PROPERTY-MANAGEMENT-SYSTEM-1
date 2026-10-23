
import os
import warnings
import joblib
import sklearn

MODEL_DIR = "models"

print("Current scikit-learn:", sklearn.__version__)
print("Checking saved models...\n")

for root, dirs, files in os.walk("."):
    dirs[:] = [
        d for d in dirs
        if d not in {".venv", ".git", "__pycache__"}
    ]

    for filename in files:
        if filename.endswith((".joblib", ".pkl")):
            path = os.path.join(root, filename)

            print(f"\nModel: {path}")

            try:
                with warnings.catch_warnings(record=True) as caught:
                    warnings.simplefilter("always")
                    model = joblib.load(path)

                version_warnings = [
                    str(w.message)
                    for w in caught
                    if "InconsistentVersionWarning" in
                    w.category.__name__
                ]

                if version_warnings:
                    for message in version_warnings:
                        print("VERSION WARNING:", message)
                else:
                    print("Loaded without version warnings.")

                print("Model type:", type(model).__name__)

            except Exception as exc:
                print("LOAD ERROR:", repr(exc))
