import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session
import re

from backend.app.api.deps import get_current_user
from backend.app.core.config import settings
from backend.app.core.security import create_access_token, generate_otp_code
from backend.app.database.models import OtpToken, User, Business
from backend.app.database.session import get_db
from backend.app.services.email_service import send_otp_email

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication & OTP"])


EMAIL_REGEX = re.compile(r"^[\w\.\+\-]+@[\w\.\-]+\.[a-zA-Z]{2,}$")


class SendOtpRequest(BaseModel):
    email: str
    purpose: str = "login"  # 'login', 'signup', 'merchant_onboarding'

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        clean = v.strip().lower()
        if not EMAIL_REGEX.match(clean):
            raise ValueError("Please provide a valid email address.")
        return clean


class SendOtpResponse(BaseModel):
    success: bool
    message: str
    email: str
    expires_in_minutes: int
    dev_otp: Optional[str] = None  # Included in dev mode for easy localhost testing


class VerifyOtpRequest(BaseModel):
    email: str
    otp_code: str
    full_name: Optional[str] = None
    role: Optional[str] = "resident"  # 'resident', 'merchant'
    phone: Optional[str] = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        clean = v.strip().lower()
        if not EMAIL_REGEX.match(clean):
            raise ValueError("Please provide a valid email address.")
        return clean


class UserProfileResponse(BaseModel):
    id: int
    email: str
    phone: Optional[str] = None
    full_name: Optional[str] = None
    role: str
    is_active: bool
    is_verified: bool
    businesses: List[Dict[str, Any]] = []


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfileResponse


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None


@router.post("/send-otp", response_model=SendOtpResponse)
def send_otp(req: SendOtpRequest, db: Session = Depends(get_db)):
    """
    Generates a secure 6-digit OTP, stores it in the database, and dispatches it
    via configured SMTP or development logger.
    """
    clean_email = req.email.lower().strip()
    otp_code = generate_otp_code(6)
    expires_at = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)

    # Invalidate previous unused OTPs for this email and purpose
    db.query(OtpToken).filter(
        OtpToken.email == clean_email,
        OtpToken.purpose == req.purpose,
        OtpToken.is_used == False
    ).update({"is_used": True})

    token_record = OtpToken(
        email=clean_email,
        otp_code=otp_code,
        purpose=req.purpose,
        expires_at=expires_at,
        is_used=False,
    )
    db.add(token_record)
    db.commit()

    # Dispatch email
    sent, msg = send_otp_email(clean_email, otp_code, purpose=req.purpose)

    return SendOtpResponse(
        success=True,
        message=f"Verification code sent to {clean_email}. Valid for 10 minutes.",
        email=clean_email,
        expires_in_minutes=10,
        dev_otp=otp_code if settings.OTP_DEV_MODE else None,
    )


@router.post("/verify-otp", response_model=AuthTokenResponse)
def verify_otp(req: VerifyOtpRequest, db: Session = Depends(get_db)):
    """
    Verifies the submitted 6-digit OTP. If valid, provisions or retrieves the user
    and issues an authentication JWT access token.
    """
    clean_email = req.email.lower().strip()
    code = req.otp_code.strip()

    latest_unused = (
        db.query(OtpToken)
        .filter(
            OtpToken.email == clean_email,
            OtpToken.is_used == False,
        )
        .order_by(OtpToken.created_at.desc())
        .first()
    )

    if not latest_unused or latest_unused.otp_code != code:
        if latest_unused:
            latest_unused.attempts = (latest_unused.attempts or 0) + 1
            if latest_unused.attempts >= 5:
                latest_unused.is_used = True
            db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code. Please check and try again.",
        )

    record = latest_unused

    if datetime.datetime.utcnow() > record.expires_at:
        record.is_used = True
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new code.",
        )

    # Mark OTP as consumed
    record.is_used = True

    safe_role = req.role if req.role in ("resident", "merchant") else "resident"

    # Find or provision user
    user = db.query(User).filter(User.email == clean_email).first()
    if not user:
        user = User(
            email=clean_email,
            full_name=req.full_name or clean_email.split("@")[0].title(),
            role=safe_role,
            phone=req.phone,
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        user.is_verified = True
        if req.full_name:
            user.full_name = req.full_name
        if req.role in ("resident", "merchant") and user.role == "resident":
            user.role = req.role
        if req.phone:
            user.phone = req.phone
        db.commit()
        db.refresh(user)

    # Fetch merchant businesses if applicable
    businesses = (
        db.query(Business)
        .filter(Business.owner_id == user.id)
        .all()
    )
    b_list = [
        {
            "id": b.id,
            "slug": b.slug,
            "name": b.name,
            "category": b.category,
            "locality": b.locality,
            "city": b.city,
            "status": b.status,
        }
        for b in businesses
    ]

    token = create_access_token(data={"sub": str(user.id), "email": user.email, "role": user.role})

    return AuthTokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserProfileResponse(
            id=user.id,
            email=user.email,
            phone=user.phone,
            full_name=user.full_name,
            role=user.role,
            is_active=user.is_active,
            is_verified=user.is_verified,
            businesses=b_list,
        ),
    )


@router.get("/me", response_model=UserProfileResponse)
def get_current_user_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Returns the authenticated user's profile and linked businesses.
    """
    businesses = (
        db.query(Business)
        .filter(Business.owner_id == user.id)
        .all()
    )
    b_list = [
        {
            "id": b.id,
            "slug": b.slug,
            "name": b.name,
            "category": b.category,
            "locality": b.locality,
            "city": b.city,
            "status": b.status,
        }
        for b in businesses
    ]

    return UserProfileResponse(
        id=user.id,
        email=user.email,
        phone=user.phone,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        is_verified=user.is_verified,
        businesses=b_list,
    )


@router.put("/profile", response_model=UserProfileResponse)
def update_profile(
    req: UpdateProfileRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Updates user display name, phone number, or upgrades role to merchant.
    """
    if req.full_name is not None:
        user.full_name = req.full_name.strip()
    if req.phone is not None:
        user.phone = req.phone.strip()
    if req.role is not None and req.role in ("resident", "merchant") and user.role != "admin":
        user.role = req.role

    db.commit()
    db.refresh(user)

    businesses = db.query(Business).filter(Business.owner_id == user.id).all()
    b_list = [
        {
            "id": b.id,
            "slug": b.slug,
            "name": b.name,
            "category": b.category,
            "locality": b.locality,
            "city": b.city,
            "status": b.status,
        }
        for b in businesses
    ]

    return UserProfileResponse(
        id=user.id,
        email=user.email,
        phone=user.phone,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        is_verified=user.is_verified,
        businesses=b_list,
    )
