from pydantic import BaseModel, ConfigDict
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
    model_config = ConfigDict(extra="allow")

class ProductVariantRequest(BaseModel):
    items: List[Item]
