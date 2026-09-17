# backend/app/models/database.py
import datetime
from sqlalchemy import (
    create_engine, Column, Integer, String, Float, 
    Boolean, DateTime, Text, ForeignKey
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

DATABASE_URL = "sqlite:///./amex_intelligate.db"

engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False}  # Needed for SQLite in multi-threaded environments
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Member(Base):
    __tablename__ = "members"

    id = Column(String, primary_key=True)  # e.g., "RKA-00-8821"
    name = Column(String, nullable=False)   # "Riya Kapoor"
    email = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    credit_score = Column(Integer, default=812)
    annual_spend = Column(Float, default=94200.0)
    member_since = Column(Integer, default=2019)

    cards = relationship("Card", back_populates="member")


class Card(Base):
    __tablename__ = "cards"

    id = Column(String, primary_key=True)          # e.g., "c1", "c2", "c3"
    member_id = Column(String, ForeignKey("members.id"), nullable=False)
    card_name = Column(String, nullable=False)     # "Platinum Card"
    last4 = Column(String, nullable=False)         # "8234"
    tier = Column(String, nullable=False)          # "Platinum", "Gold", "Blue Cash Preferred"
    credit_limit = Column(Float, nullable=False)   # 8500.0
    balance = Column(Float, default=0.0)           # 2340.50
    is_locked = Column(Boolean, default=False)
    lock_reason = Column(String, nullable=True)

    member = relationship("Member", back_populates="cards")
    waivers = relationship("FeeWaiverHistory", back_populates="card")


class FeeWaiverHistory(Base):
    __tablename__ = "fee_waiver_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    card_id = Column(String, ForeignKey("cards.id"), nullable=False)
    waiver_date = Column(DateTime, nullable=False)
    fee_amount = Column(Float, default=39.0)
    status = Column(String, default="APPROVED")     # APPROVED, DENIED

    card = relationship("Card", back_populates="waivers")


class AuditLedger(Base):
    __tablename__ = "audit_ledger"

    id = Column(Integer, primary_key=True, autoincrement=True)
    action_id = Column(String, unique=True, nullable=False)  # e.g., "LIM-2291", "FEE-883"
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    member_id = Column(String, nullable=False)
    card_id = Column(String, nullable=False)
    action_type = Column(String, nullable=False)            # "LIMIT", "FEE", "REPLACE"
    policy_evaluated = Column(String, nullable=False)
    outcome = Column(String, nullable=False)                 # "Approved", "Denied", "Partially Approved"
    payload_json = Column(Text, nullable=False)
    sha256_hash = Column(String, nullable=False)
    prev_hash = Column(String, nullable=False)


class ServiceRequest(Base):
    __tablename__ = "service_requests"

    sr_number = Column(String, primary_key=True)            # e.g., "SR-882194"
    member_id = Column(String, nullable=False)
    card_id = Column(String, nullable=False)
    intent = Column(String, nullable=False)
    reason = Column(String, nullable=False)
    customer_sentiment = Column(String, default="Frustrated")
    llm_summary = Column(Text, nullable=False)
    recommended_action = Column(String, nullable=False)
    status = Column(String, default="OPEN")                 # OPEN, IN_REVIEW, RESOLVED
    estimated_tat_hours = Column(Integer, default=4)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


def init_db():
    """Create all tables in SQLite."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Dependency helper for database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
