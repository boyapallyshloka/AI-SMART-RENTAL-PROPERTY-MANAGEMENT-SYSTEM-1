from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def home():
    return {"message": "Avenue360 AI Service is running"}
