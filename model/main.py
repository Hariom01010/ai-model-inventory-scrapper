from fastapi import FastAPI
from app.routes import product_card_routes, variant_routes

app = FastAPI(title="AI Model Service")

app.include_router(product_card_routes.router, prefix="/predict/product-card")
app.include_router(variant_routes.router)