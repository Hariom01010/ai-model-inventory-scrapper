from fastapi import APIRouter
from app.schemas.product_variant_schema import ProductVariantRequest
from app.services.product_variants_service import cluster_variant_elements

router = APIRouter()

@router.post("/cluster")

async def cluster(request: ProductVariantRequest):
    results = cluster_variant_elements(request.items)
    return {"results": results}