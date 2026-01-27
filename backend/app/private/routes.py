from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.auth import require_api_key
from app.private import service

router = APIRouter(
    prefix="/api/private",
    tags=["private"],
    dependencies=[Depends(require_api_key)],
)


@router.get("/ping")
def private_ping():
    return {"status": "ok"}


@router.get("/campaigns")
def list_campaigns():
    return {"campaigns": service.list_campaigns()}


@router.get("/campaign/members")
def list_campaign_members(campaign_id: int):
    return {
        "campaign_id": campaign_id,
        "members": service.list_campaign_members(campaign_id),
    }


@router.get("/stats/global/daily")
def global_daily_stats(
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int | None = Query(default=30, ge=1, le=365),
):
    return {
        "daily_stats": service.get_global_daily_stats(date_from, date_to, limit)
    }


@router.get("/stats/global/words")
def global_word_stats(
    limit: int | None = Query(default=30, ge=1, le=365),
    order_by: str = Query(default="attempts", pattern="^(attempts|solves|fails|last_seen)$"),
):
    return {"word_stats": service.get_global_word_stats(limit, order_by)}


@router.get("/stats/global/items")
def global_item_stats(
    limit: int | None = Query(default=30, ge=1, le=365),
    order_by: str = Query(default="uses", pattern="^(uses|targets|last_used_at)$"),
):
    return {"item_stats": service.get_global_item_stats(limit, order_by)}


@router.get("/stats/global/accolades")
def global_accolade_stats(
    limit: int | None = Query(default=30, ge=1, le=365),
):
    return {"accolade_stats": service.get_global_accolade_stats(limit)}


@router.get("/stats/campaign/daily")
def campaign_daily_stats(
    campaign_id: int,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int | None = Query(default=30, ge=1, le=365),
):
    return {
        "campaign_id": campaign_id,
        "daily_stats": service.get_campaign_daily_stats(campaign_id, date_from, date_to, limit),
    }


@router.get("/stats/campaign/words")
def campaign_word_stats(
    campaign_id: int,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int | None = Query(default=30, ge=1, le=365),
    order_by: str = Query(default="solved_count", pattern="^(solved_count|failed_count|date)$"),
):
    return {
        "campaign_id": campaign_id,
        "word_stats": service.get_campaign_word_stats(campaign_id, date_from, date_to, limit, order_by),
    }


@router.get("/stats/campaign/accolades")
def campaign_accolade_stats(
    campaign_id: int,
    limit: int | None = Query(default=30, ge=1, le=365),
):
    return {
        "campaign_id": campaign_id,
        "accolade_stats": service.get_campaign_accolade_stats(campaign_id, limit),
    }


@router.get("/stats/campaign/items")
def campaign_item_stats(
    campaign_id: int,
    limit: int | None = Query(default=30, ge=1, le=365),
):
    return {
        "campaign_id": campaign_id,
        "item_stats": service.get_campaign_item_usage(campaign_id, limit),
    }


@router.get("/stats/campaign/recaps")
def campaign_recaps(
    campaign_id: int,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int | None = Query(default=30, ge=1, le=365),
):
    return {
        "campaign_id": campaign_id,
        "recaps": service.get_campaign_recaps(campaign_id, date_from, date_to, limit),
    }


@router.get("/stats/global/summary")
def global_summary(
    daily_limit: int | None = Query(default=30, ge=1, le=365),
    word_limit: int | None = Query(default=30, ge=1, le=365),
    item_limit: int | None = Query(default=30, ge=1, le=365),
    accolade_limit: int | None = Query(default=30, ge=1, le=365),
):
    return service.get_global_summary(daily_limit, word_limit, item_limit, accolade_limit)


@router.get("/stats/campaign/summary")
def campaign_summary(
    campaign_id: int,
    daily_limit: int | None = Query(default=30, ge=1, le=365),
    word_limit: int | None = Query(default=30, ge=1, le=365),
    item_limit: int | None = Query(default=30, ge=1, le=365),
    accolade_limit: int | None = Query(default=30, ge=1, le=365),
    recap_limit: int | None = Query(default=7, ge=1, le=365),
):
    return service.get_campaign_summary(
        campaign_id,
        daily_limit,
        word_limit,
        item_limit,
        accolade_limit,
        recap_limit,
    )


class AdjustBalancesRequest(BaseModel):
    campaign_id: int
    user_id: int
    coins_delta: int | None = None
    coins_set: int | None = None
    score_delta: int | None = None
    score_set: int | None = None
    dry_run: bool = False


@router.post("/campaign/adjust-balances")
def adjust_balances(data: AdjustBalancesRequest):
    return service.adjust_campaign_balances(
        data.campaign_id,
        data.user_id,
        data.coins_delta,
        data.coins_set,
        data.score_delta,
        data.score_set,
        data.dry_run,
    )
