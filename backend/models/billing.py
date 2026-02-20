from pydantic import BaseModel
from typing import Optional, List


class SubscriptionResponse(BaseModel):
    tier: str
    status: str
    price: int
    current_period_end: Optional[str] = None
    features: List[str] = []
    components_limit: int = 100
    repositories_limit: int = 5
    team_members_limit: int = 1


class SubscriptionUpgrade(BaseModel):
    tier: str


class InvoiceResponse(BaseModel):
    id: str
    amount: float
    currency: str = "usd"
    status: str
    period_start: Optional[str] = None
    period_end: Optional[str] = None
    created_at: str
    description: Optional[str] = None


class PaymentMethodUpdate(BaseModel):
    payment_method_id: str
