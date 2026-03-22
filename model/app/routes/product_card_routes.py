from fastapi import APIRouter
from app.schemas.product_schema import ProductRequest, ProductResponse
from app.services.product_card_service import predict_product_cards

router = APIRouter()

@router.post("/")
async def predict(request: ProductRequest) -> ProductResponse:
    results = predict_product_cards(request.items)
    return {"results": results}