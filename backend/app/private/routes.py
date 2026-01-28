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

@router.get("/campaign/details")
def campaign_details(campaign_id: int):
    return service.get_campaign_details(campaign_id)

@router.get("/users")
def list_users(
    limit: int | None = Query(default=100, ge=1, le=365),
    offset: int | None = Query(default=0, ge=0, le=10000),
):
    return {"users": service.list_users(limit, offset)}

@router.get("/users/stats")
def user_campaign_stats(
    user_id: int | None = None,
    campaign_id: int | None = None,
    limit: int | None = Query(default=100, ge=1, le=365),
):
    return {
        "user_campaign_stats": service.get_user_campaign_stats(user_id, campaign_id, limit)
    }

@router.get("/users/daily-results")
def user_daily_results(
    user_id: int | None = None,
    campaign_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int | None = Query(default=100, ge=1, le=365),
):
    return {
        "daily_results": service.get_user_daily_results(user_id, campaign_id, date_from, date_to, limit)
    }

@router.get("/users/accolades")
def user_accolade_stats(
    user_id: int | None = None,
    campaign_id: int | None = None,
    limit: int | None = Query(default=100, ge=1, le=365),
):
    return {
        "user_accolade_stats": service.get_user_accolade_stats(user_id, campaign_id, limit)
    }

@router.get("/users/accolades/events")
def user_accolade_events(
    user_id: int | None = None,
    campaign_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int | None = Query(default=100, ge=1, le=365),
):
    return {
        "user_accolade_events": service.get_user_accolade_events(user_id, campaign_id, date_from, date_to, limit)
    }


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

@router.get("/stats/global/high-scores")
def global_high_scores(
    limit: int | None = Query(default=30, ge=1, le=365),
):
    return {"high_scores": service.get_global_high_scores(limit)}

@router.get("/stats/global/streaks")
def global_streak_stats():
    return {"streak_stats": service.get_global_streak_stats()}

@router.get("/stats/global/user-streaks")
def global_user_streaks(
    limit: int | None = Query(default=30, ge=1, le=365),
):
    return {"user_streaks": service.get_global_user_streaks(limit)}


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

@router.get("/stats/campaign/daily-troops")
def campaign_daily_troops(
    campaign_id: int,
    user_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int | None = Query(default=100, ge=1, le=365),
):
    return {
        "campaign_id": campaign_id,
        "daily_troops": service.get_campaign_daily_troops(campaign_id, user_id, date_from, date_to, limit),
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

@router.get("/campaign/guess-states")
def campaign_guess_states(
    campaign_id: int,
    user_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int | None = Query(default=50, ge=1, le=365),
):
    return {
        "campaign_id": campaign_id,
        "guess_states": service.get_campaign_guess_states(campaign_id, user_id, date_from, date_to, limit),
    }

@router.get("/campaign/first-guesses")
def campaign_first_guesses(
    campaign_id: int,
    user_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int | None = Query(default=100, ge=1, le=365),
):
    return {
        "campaign_id": campaign_id,
        "first_guesses": service.get_campaign_first_guesses(campaign_id, user_id, date_from, date_to, limit),
    }

@router.get("/campaign/shop/rotation")
def campaign_shop_rotation(
    campaign_id: int,
    user_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int | None = Query(default=100, ge=1, le=365),
):
    return {
        "campaign_id": campaign_id,
        "shop_rotation": service.get_campaign_shop_rotation(campaign_id, user_id, date_from, date_to, limit),
    }

@router.get("/campaign/shop/log")
def campaign_shop_log(
    campaign_id: int,
    user_id: int | None = None,
    event_type: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int | None = Query(default=200, ge=1, le=365),
):
    return {
        "campaign_id": campaign_id,
        "shop_log": service.get_campaign_shop_log(campaign_id, user_id, event_type, date_from, date_to, limit),
    }

@router.get("/campaign/item-events")
def campaign_item_events(
    campaign_id: int,
    user_id: int | None = None,
    target_user_id: int | None = None,
    event_type: str | None = None,
    item_key: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int | None = Query(default=200, ge=1, le=365),
):
    return {
        "campaign_id": campaign_id,
        "item_events": service.get_campaign_item_events(
            campaign_id,
            user_id,
            target_user_id,
            event_type,
            item_key,
            date_from,
            date_to,
            limit,
        ),
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
