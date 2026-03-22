from fastapi import FastAPI
from app.routes import product_card_routes

app = FastAPI(title="AI Model Service")

app.include_router(product_card_routes.router, prefix="/predict/product-card")