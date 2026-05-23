# services/cloth-detection-api/app.py

import os
from fastapi import FastAPI, HTTPException, File, UploadFile
from pydantic import BaseModel
from typing import List
from PIL import Image
import io
from ultralytics import YOLO
from fastapi.middleware.cors import CORSMiddleware

# --- 1. Model Loading ---
MODEL_PATH = os.path.join(os.path.dirname(__file__), "best.pt")

if not os.path.exists(MODEL_PATH):
    raise FileNotFoundError(f"Model file not found at {MODEL_PATH}. Make sure 'best.pt' is in the same directory.")

print("⏳ Loading custom YOLOv5 model..")
# The YOLO class from ultralytics can load YOLOv5 .pt files seamlessly.
model = YOLO(MODEL_PATH)
print("✅ Custom YOLOv5 model loaded successfully.")

# --- 2. FastAPI Application Setup ---
app = FastAPI(
    title="Custom Cloth Detection API",
    description="An API to detect clothing items in images using a custom-trained YOLOv5 model."
)

origins = [
    "*", # Allows all origins for development
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods
    allow_headers=["*"], # Allows all headers
)

# Pydantic models for structured input and output
class DetectionResult(BaseModel):
    class_name: str
    confidence: float
    box: List[float] # [x1, y1, x2, y2]

class DetectionResponse(BaseModel):
    is_clothing: bool
    detections: List[DetectionResult]

# --- 3. API Endpoint ---
@app.post("/detect", response_model=DetectionResponse)
async def detect_clothing_from_upload(file: UploadFile = File(...)):
    """
    Detects clothing items from an uploaded image file.
    """
    print("🕵️‍♂️ Received image for detection...")
    # Read image file
    contents = await file.read()
    
    try:
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file.")

    # Perform inference
    results = model(image, verbose=False)
    result = results[0] # Get results for the first image

    detections = []
    for box in result.boxes:
        class_id = int(box.cls[0].item())
        confidence = float(box.conf[0].item())
        box_coords = box.xyxy[0].tolist() # [x1, y1, x2, y2]
        
        detections.append(DetectionResult(
            class_name=model.names[class_id],
            confidence=confidence,
            box=box_coords
        ))
        
    is_clothing = len(detections) > 0
    print(f"✅ Detection result: Found {len(detections)} items.")
    
    return DetectionResponse(is_clothing=is_clothing, detections=detections)

@app.get("/")
def root():
    return {"message": "Custom Cloth Detection API is running. POST to /detect with an image file."}