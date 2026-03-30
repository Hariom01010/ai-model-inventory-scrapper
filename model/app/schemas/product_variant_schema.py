from pydantic import BaseModel
from typing import List

class Item(BaseModel):
    x: float
    y: float
    width: float
    height: float
    tagName: str
    parent: str
    siblingCount: int
    childCount: int
    hasImage: bool
    text: str
    isClickable: bool

class ProductVariantRequest(BaseModel):
    items: List[Item]
