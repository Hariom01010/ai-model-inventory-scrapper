from pydantic import BaseModel
from typing import List

class Item(BaseModel):
    id: str
    tag: str
    textLength: int
    hasImage: bool
    imageCount: int
    hasLink: bool
    linkCount: int
    childCount: int
    siblingCount: int
    width: float
    height: float
    area: float
    x: float
    y: float
    isClickable: bool
    text: str

class ProductRequest(BaseModel):
    items: List[Item]

class Result(BaseModel):
    id: str
    tag: str
    text: str
    siblingCount: int
    prediction: int
    confidence: float

class ProductResponse(BaseModel):
    results: List[Result]