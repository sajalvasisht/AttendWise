from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import Any
import uuid
from datetime import datetime, timedelta, timezone

from app.database.session import get_db
from app.models.models import User
from app.core.security import verify_password, get_password_hash, create_access_token
from app.schemas.auth import (
    UserCreate, UserResponse, Token, GoogleLoginRequest, 
    VerifyEmailRequest, ForgotPasswordRequest, ResetPasswordRequest, ChangePasswordRequest
)
from app.api.deps import get_current_user
from app.services.google_auth import verify_google_token
from app.services.email import send_verification_email, send_reset_password_email

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)) -> Any:
    normalized_email = user_in.email.strip().lower()
    
    # Check if user already exists
    user = db.query(User).filter(User.email == normalized_email).first()
    if user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The user with this email already exists in the system.",
        )
    
    v_token = uuid.uuid4().hex
    hashed_pwd = get_password_hash(user_in.password)
    
    db_user = User(
        email=normalized_email,
        password_hash=hashed_pwd,
        full_name=user_in.full_name,
        is_verified=False,
        verification_token=v_token
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Send verification link
    send_verification_email(normalized_email, v_token)
    
    return db_user

@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
) -> Any:
    normalized_username = form_data.username.strip().lower()
    user = db.query(User).filter(User.email == normalized_username).first()
    
    if not user or not user.password_hash or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Please verify your email address to activate your account.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return {
        "access_token": create_access_token(subject=user.id),
        "token_type": "bearer",
    }

@router.post("/google", response_model=Token)
def google_auth(request: GoogleLoginRequest, db: Session = Depends(get_db)) -> Any:
    # Verify Google token
    payload = verify_google_token(request.credential)
    email = payload["email"].strip().lower()
    google_id = payload["sub"]
    name = payload["name"]
    picture = payload["picture"]

    # Check if user already exists
    user = db.query(User).filter((User.google_id == google_id) | (User.email == email)).first()
    
    if not user:
        # Create a new user (pre-verified through Google)
        user = User(
            email=email,
            google_id=google_id,
            full_name=name,
            profile_picture=picture,
            is_verified=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Ensure user fields are synchronized and activated
        user.google_id = google_id
        if picture:
            user.profile_picture = picture
        user.is_verified = True
        db.commit()
        db.refresh(user)

    return {
        "access_token": create_access_token(subject=user.id),
        "token_type": "bearer",
    }

@router.post("/verify-email")
def verify_email(request: VerifyEmailRequest, db: Session = Depends(get_db)) -> Any:
    user = db.query(User).filter(User.verification_token == request.token).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token."
        )
    
    user.is_verified = True
    user.verification_token = None
    db.commit()
    return {"message": "Email successfully verified. You can now log in."}

@router.post("/forgot-password")
def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)) -> Any:
    normalized_email = request.email.strip().lower()
    user = db.query(User).filter(User.email == normalized_email).first()
    
    if user:
        reset_token = uuid.uuid4().hex
        user.reset_token = reset_token
        user.reset_token_expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
        db.commit()
        
        send_reset_password_email(user.email, reset_token)
        
    return {"message": "If this email is registered, a password reset link has been sent."}

@router.post("/reset-password")
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)) -> Any:
    user = db.query(User).filter(
        User.reset_token == request.token,
        User.reset_token_expires_at > datetime.now(timezone.utc)
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token."
        )
        
    user.password_hash = get_password_hash(request.new_password)
    user.reset_token = None
    user.reset_token_expires_at = None
    db.commit()
    return {"message": "Password successfully reset. You can now log in."}

@router.get("/me", response_model=UserResponse)
def read_user_me(current_user: User = Depends(get_current_user)) -> Any:
    return current_user

@router.post("/change-password")
def change_password(
    request: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    if not current_user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Accounts registered via Google OAuth cannot change password here."
        )

    if not verify_password(request.old_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect old password."
        )

    current_user.password_hash = get_password_hash(request.new_password)
    db.commit()
    return {"message": "Password updated successfully."}

@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> None:
    db.delete(current_user)
    db.commit()
    return None
