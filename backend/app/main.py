from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app import models, crud
from app.models import CampaignOnly
from fastapi import Depends
from app.auth import get_current_user
from app.admin.routes import router as admin_router
from app.updates.routes import router as updates_router
from app.auth import create_access_token
from app.models import UserOnly, UpdateUserInfo, CampaignAndUserOnly, ShopPurchase, UseItemRequest, ItemTargetRequest, ArmyNameUpdate, ForgotPasswordRequest, ResetPasswordRequest
from app.recap import service as recap_service
from prometheus_fastapi_instrumentator import Instrumentator

from app.scheduler import start_scheduler
from database import init_db
from app.media.routes import router as media_router
from app.private.routes import router as private_router


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3002",
        "http://127.0.0.1:3002"
    ],
    allow_credentials=True,
    allow_methods=["*"],   
    allow_headers=["*"]
)

instrumentator = Instrumentator().instrument(app)

@app.on_event("startup")
async def startup_event():
    start_scheduler()
    init_db()
    instrumentator.expose(app, include_in_schema=True, should_gzip=False)

@app.post("/api/word/reveal")
def reveal_word(data: models.CampaignOnly):
    return {"word": crud.get_daily_word(data.campaign_id, data.day)}

@app.post("/api/guess")
def guess_with_meta(data: models.GuessWithMeta, current_user: dict = Depends(get_current_user)):
    return crud.validate_guess(data.word, current_user["user_id"], data.campaign_id, data.day)

@app.post("/api/leaderboard")
def get_leaderboard(data: CampaignOnly):
    return crud.get_leaderboard(data.campaign_id)

@app.get("/api/leaderboard/global")
def get_global_leaderboard(limit: int = 10, current_user: dict = Depends(get_current_user)):
    return crud.get_global_leaderboard(limit)

@app.post("/api/register")
def register(user: models.UserRegister):
    return crud.register_user(
        user.first_name,
        user.last_name,
        user.email,
        user.phone,
        user.password
    )

@app.post("/api/login")
def login(user: models.UserLogin):
    user_data = crud.login_user(user.email, user.password)
    token = create_access_token({"user_id": user_data["user_id"]})
    return {"access_token": token, "user": user_data}


@app.post("/api/auth/forgot_password")
def forgot_password(data: ForgotPasswordRequest):
    return crud.request_password_reset(data.email)


@app.post("/api/auth/reset_password")
def do_reset_password(data: ResetPasswordRequest):
    return crud.reset_password(data.token, data.new_password)

@app.post("/api/campaign/create")
def create_campaign(camp: models.NewCampaign, current_user: dict = Depends(get_current_user)):
    return crud.create_campaign(
        camp.name,
        current_user["user_id"],
        camp.cycle_length,
        bool(camp.is_admin_campaign)
    )

@app.post("/api/campaign/join")
def join_campaign(data: models.JoinCampaign, current_user: dict = Depends(get_current_user)):
    return crud.join_campaign(data.invite_code, current_user["user_id"])

@app.post("/api/campaign/join_by_id")
def join_campaign_by_id(data: models.CampaignIDOnly, current_user: dict = Depends(get_current_user)):
    return crud.join_campaign_by_id(data.campaign_id, current_user["user_id"])

@app.post("/api/campaign/progress")
def get_campaign_progress(data: CampaignOnly):
    return crud.get_campaign_progress(data.campaign_id)

@app.post("/api/campaign/end")
def end_campaign(data: CampaignOnly):
    return crud.handle_campaign_end(data.campaign_id)

@app.post("/api/game/state")
def fetch_game_state(data: models.CampaignOnly, current_user: dict = Depends(get_current_user)):
    return crud.get_saved_progress(current_user["user_id"], data.campaign_id, data.day)

@app.get("/api/user/info")
def get_user_info(current_user: dict = Depends(get_current_user)):
    return crud.get_user_info(current_user["user_id"])

@app.post("/api/user/campaigns")
def user_campaigns(current_user: dict = Depends(get_current_user)):
    return crud.get_user_campaigns(current_user["user_id"])

@app.post("/api/user/update")
def update_user(data: UpdateUserInfo, current_user: dict = Depends(get_current_user)):
    return crud.update_user_info(current_user["user_id"], data.first_name, data.last_name, data.phone)


@app.post("/api/campaign/finished_today")
def check_finished_today(data: CampaignOnly):
    return {"ended": crud.has_campaign_finished_for_day(data.campaign_id)}

@app.post("/api/campaign/delete")
def delete_campaign(data: CampaignOnly, current_user: dict = Depends(get_current_user)):
    return crud.delete_campaign(data.campaign_id, current_user["user_id"])

@app.post("/api/campaign/update_name")
def update_campaign_name(data: models.CampaignNameUpdate, current_user: dict = Depends(get_current_user)):
    return crud.update_campaign_name(data.campaign_id, current_user["user_id"], data.name)

@app.get("/api/campaign/{campaign_id}/recap")
def campaign_recap(campaign_id: int, day: int | None = None, current_user: dict = Depends(get_current_user)):
    return recap_service.get_campaign_recap(campaign_id, current_user["user_id"], day=day)

@app.post("/api/campaign/kick")
def kick_player(data: models.KickRequest, current_user: dict = Depends(get_current_user)):
    return crud.kick_player_from_campaign(data.campaign_id, data.user_id, current_user["user_id"])


@app.get("/api/campaigns/owned")
def get_owned_campaigns(current_user: dict = Depends(get_current_user)):
    return crud.get_campaigns_by_owner(current_user["user_id"])

@app.post("/api/campaign/members")
def get_campaign_members(data: CampaignOnly, current_user: dict = Depends(get_current_user)):
    return crud.get_campaign_members(data.campaign_id, current_user["user_id"])

@app.post("/api/campaign/self_member")
def get_self_member(data: models.CampaignOnly, current_user: dict = Depends(get_current_user)):
    return crud.get_self_member(data.campaign_id, current_user["user_id"])

@app.post("/api/campaign/targets")
def get_campaign_targets(data: models.CampaignOnly, current_user: dict = Depends(get_current_user)):
    return crud.get_targetable_members(data.campaign_id, current_user["user_id"])

@app.post("/api/campaign/targets/item")
def get_campaign_targets_for_item(data: ItemTargetRequest, current_user: dict = Depends(get_current_user)):
    return crud.get_targetable_members_with_item_status(
        data.campaign_id,
        current_user["user_id"],
        data.item_key
    )

@app.post("/api/campaign/items/active")
def get_active_item_effects(data: models.CampaignOnly, current_user: dict = Depends(get_current_user)):
    return crud.get_active_target_effects(current_user["user_id"], data.campaign_id)

@app.post("/api/campaign/items/status")
def get_item_status_effects(data: models.CampaignOnly, current_user: dict = Depends(get_current_user)):
    return crud.get_current_status_effects(current_user["user_id"], data.campaign_id)

@app.post("/api/campaign/items/mercy/redeem")
def redeem_candle_of_mercy(data: models.CampaignOnly, current_user: dict = Depends(get_current_user)):
    return crud.redeem_candle_of_mercy(current_user["user_id"], data.campaign_id)

@app.post("/api/campaign/streak")
def get_campaign_streak(data: models.CampaignOnly, current_user: dict = Depends(get_current_user)):
    return crud.get_campaign_streak(current_user["user_id"], data.campaign_id)

@app.post("/api/campaign/coins")
def get_campaign_coins(data: models.CampaignOnly, current_user: dict = Depends(get_current_user)):
    return crud.get_campaign_coins(current_user["user_id"], data.campaign_id)

@app.post("/api/campaign/accolades")
def get_campaign_accolades(data: models.CampaignOnly, current_user: dict = Depends(get_current_user)):
    return crud.get_user_accolades(current_user["user_id"], data.campaign_id)

@app.post("/api/campaign/ruler_title")
def update_campaign_ruler_title(data: models.CampaignRulerTitle, current_user: dict = Depends(get_current_user)):
    return crud.update_campaign_ruler_title(current_user["user_id"], data.campaign_id, data.title)

@app.post("/api/campaign/update_member")
def update_campaign_member(data: models.CampaignAndUserOnly, current_user: dict = Depends(get_current_user)):
    return crud.update_campaign_member(data.campaign_id, current_user["user_id"], data.display_name, data.color)

@app.post("/api/campaign/army-name")
def update_army_name(data: ArmyNameUpdate, current_user: dict = Depends(get_current_user)):
    return crud.update_army_name(current_user["user_id"], data.campaign_id, data.army_name)


@app.post("/api/double_down")
def activate_double_down(data: CampaignOnly, current_user: dict = Depends(get_current_user)):
    return crud.activate_double_down(current_user["user_id"], data.campaign_id)

@app.post("/api/user/acknowledge_update")
def acknowledge_update(current_user: dict = Depends(get_current_user)):
    return crud.acknowledge_update(current_user["user_id"])

@app.post("/api/campaign/shop/state")
def get_campaign_shop_state(data: CampaignOnly, current_user: dict = Depends(get_current_user)):
    return crud.get_shop_state(current_user["user_id"], data.campaign_id)

@app.post("/api/campaign/shop/purchase")
def purchase_shop_item(data: ShopPurchase, current_user: dict = Depends(get_current_user)):
    return crud.purchase_item(current_user["user_id"], data.campaign_id, data.item_key)

@app.post("/api/campaign/shop/reshuffle")
def reshuffle_shop(data: CampaignOnly, current_user: dict = Depends(get_current_user)):
    return crud.reshuffle_shop(current_user["user_id"], data.campaign_id)

@app.post("/api/campaign/items/use")
def use_campaign_item(data: UseItemRequest, current_user: dict = Depends(get_current_user)):
    return crud.use_item(
        current_user["user_id"],
        data.campaign_id,
        data.item_key,
        data.target_user_id,
        data.effect_payload
    )

@app.post("/api/campaign/items/hint")
def get_campaign_hint(data: CampaignOnly, current_user: dict = Depends(get_current_user)):
    return crud.get_current_day_hint(current_user["user_id"], data.campaign_id)

app.include_router(admin_router)
app.include_router(updates_router)
app.include_router(media_router)
app.include_router(private_router)
