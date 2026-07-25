"""
KSP CrimeIntel — FastAPI Backend
Production-grade REST API + WebSocket for crime intelligence platform.
"""

import os
import json
import logging
import asyncio
from datetime import datetime
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from dotenv import load_dotenv

from data_engine import CrimeDataEngine, QueryResult
from nlp_engine  import NLPEngine, QueryIntent
from auth        import AuthManager

load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# ─────────────────────── app init ────────────────────────────────

app = FastAPI(
    title="KSP CrimeIntel API",
    description="Intelligent Conversational Crime Analytics — Karnataka State Police",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)
origins_env = os.getenv("ALLOWED_ORIGINS", "*")
allow_origins = [o.strip() for o in origins_env.split(",")] if origins_env != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

DEFAULT_DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "DataSet"))
DATA_DIR = os.getenv("DATA_DIR", DEFAULT_DATA_DIR)

logger.info("Initialising data engine — may take 20-40 s for first-time CSV indexing …")
data_engine  = CrimeDataEngine(DATA_DIR)
nlp_engine   = NLPEngine()
auth_manager = AuthManager(data_engine)
oauth2       = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

# ─────────────────────── schemas ─────────────────────────────────

class ChatRequest(BaseModel):
    message:         str
    conversation_id: Optional[str] = None
    context:         Optional[List[Dict]] = None

class ChatResponse(BaseModel):
    message:        str
    viz_type:       str
    viz_data:       Any
    total_records:  int
    confidence:     float
    sources:        List[str]
    intent:         Dict
    timestamp:      str
    audit:          Optional[Dict] = None

# ─────────────────────── health ──────────────────────────────────

@app.get("/", tags=["System"])
async def root():
    return {"service": "KSP CrimeIntel API", "status": "operational", "version": "1.0.0"}

@app.get("/api/health", tags=["System"])
async def health():
    return {
        "status":          "healthy",
        "gemini":          nlp_engine.gemini_available,
        "data_dir":        DATA_DIR,
        "timestamp":       datetime.now().isoformat(),
    }

# ─────────────────────── auth ────────────────────────────────────

@app.post("/api/auth/login", tags=["Auth"])
async def login(form: OAuth2PasswordRequestForm = Depends()):
    result = auth_manager.authenticate(form.username, form.password)
    if not result:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return result

@app.get("/api/auth/me", tags=["Auth"])
async def me(token: str = Depends(oauth2)):
    user = auth_manager.get_current_user(token) if token else None
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

# ─────────────────────── chat ────────────────────────────────────

def log_action(user: Dict, action: str, resource: str, status: str = "Success"):
    if not user:
        return
    import uuid
    try:
        log_id = f"LOG-{str(uuid.uuid4())[:8].upper()}"
        data_engine.conn.execute(
            "INSERT INTO audit_log (id, user_name, badge, action, resource, status) VALUES (?, ?, ?, ?, ?, ?)",
            (log_id, user.get("name"), user.get("badge"), action, resource, status)
        )
    except Exception as e:
        logger.error(f"Audit log failed: {e}")

@app.post("/api/chat", response_model=ChatResponse, tags=["Chat"])
async def chat(req: ChatRequest, token: str = Depends(oauth2)):
    """
    Primary endpoint: natural language → data query → structured response.
    Supports English and Kannada queries.
    """
    user = auth_manager.get_current_user(token) if token else None
    try:
        intent = await nlp_engine.parse(req.message)
        log_action(user, "QUERY", f"{intent.intent} ({intent.crime_types[0] if intent.crime_types else 'All'})")
        result = await _route_query(intent)
        text   = _build_response_text(intent, result)

        return ChatResponse(
            message       = text,
            viz_type      = result.viz_type,
            viz_data      = result.data,
            total_records = result.total_rows,
            confidence    = 0.92 if nlp_engine.gemini_available else 0.78,
            sources       = _get_sources(intent),
            intent        = intent.to_dict(),
            timestamp     = datetime.now().isoformat(),
            audit         = {
                "intent":      intent.intent,
                "crime_types": intent.crime_types,
                "districts":   intent.districts,
                "years":       [intent.year_start, intent.year_end],
                "nlp_engine":  "gemini-1.5-flash" if nlp_engine.gemini_available else "rule-based",
                "metadata":    result.metadata,
            },
        )
    except Exception as e:
        logger.error(f"Chat error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# ─────────────────────── analytics endpoints ─────────────────────

@app.get("/api/dashboard/kpis", tags=["Dashboard"])
async def kpis():
    return data_engine.get_kpis()

@app.get("/api/dashboard/overview", tags=["Dashboard"])
async def overview():
    return data_engine.get_overview_charts()

@app.get("/api/analytics/hotspots", tags=["Analytics"])
async def hotspots(
    crime_type: Optional[str] = None,
    year:       Optional[int] = None,
    top_n:      int = Query(15, le=50),
):
    return data_engine.get_hotspots(crime_type=crime_type, year=year, top_n=top_n).to_dict()

@app.get("/api/analytics/trends", tags=["Analytics"])
async def trends(
    crime_type: Optional[str] = None,
    district:   Optional[str] = None,
    year_start: int = 2016,
    year_end:   int = 2023,
):
    return data_engine.get_trends(crime_type=crime_type, district=district,
                                  year_start=year_start, year_end=year_end).to_dict()

@app.get("/api/analytics/compare", tags=["Analytics"])
async def compare(
    crime_type: Optional[str] = None,
    year:       Optional[int] = None,
    top_n:      int = Query(10, le=30),
    token: str = Depends(oauth2)
):
    user = auth_manager.get_current_user(token) if token else None
    log_action(user, "COMPARE", f"{crime_type or 'All'} Crimes")
    return data_engine.get_district_comparison(crime_type=crime_type, year=year, top_n=top_n).to_dict()

@app.get("/api/analytics/predict", tags=["Analytics"])
async def predict(
    district:    Optional[str] = None,
    crime_type:  Optional[str] = None,
    target_year: int = 2026,
):
    return data_engine.predict_crime(district=district, crime_type=crime_type, target_year=target_year).to_dict()

@app.get("/api/analytics/alerts", tags=["Analytics"])
async def alerts():
    try:
        # Find the max year in the dataset
        max_year_row = data_engine.conn.execute("SELECT MAX(year) FROM agg_monthly").fetchone()
        max_year = int(max_year_row[0]) if max_year_row and max_year_row[0] else 2023
        
        # Compare max year to max year - 1
        query = f"""
            WITH curr_year AS (
                SELECT district, crime_group, SUM(cases) as curr_cases
                FROM agg_monthly WHERE year = {max_year}
                GROUP BY district, crime_group
            ),
            prev_year AS (
                SELECT district, crime_group, SUM(cases) as prev_cases
                FROM agg_monthly WHERE year = {max_year - 1}
                GROUP BY district, crime_group
            )
            SELECT c.district, c.crime_group, c.curr_cases, p.prev_cases,
                   (c.curr_cases - p.prev_cases)*100.0/NULLIF(p.prev_cases, 0) as surge_pct
            FROM curr_year c
            JOIN prev_year p ON c.district = p.district AND c.crime_group = p.crime_group
            WHERE c.curr_cases > 50 AND (c.curr_cases - p.prev_cases)*100.0/NULLIF(p.prev_cases, 0) > 20
            ORDER BY surge_pct DESC
            LIMIT 5
        """
        df = data_engine.conn.execute(query).fetchdf()
        alerts_data = []
        for i, row in df.iterrows():
            pct = round(row["surge_pct"])
            severity = "Critical" if pct > 100 else "High"
            alerts_data.append({
                "id": f"ALT-{max_year}-{i}",
                "type": f"Surge in {row['crime_group'].title()}",
                "district": row["district"],
                "severity": severity,
                "time": "System Alert",
                "details": f"+{pct}% increase compared to {max_year-1} ({row['prev_cases']} -> {row['curr_cases']} cases)."
            })
        if not alerts_data:
            alerts_data.append({
                "id": "ALT-OK", "type": "No Critical Surges", "district": "All",
                "severity": "Low", "time": "Just now", "details": "Crime rates are stable compared to previous year."
            })
        return {"status": "success", "data": alerts_data}
    except Exception as e:
        logger.error(f"Alerts error: {e}")
        return {"status": "error", "data": []}

@app.get("/api/analytics/audit", tags=["Analytics"])
async def audit_log_endpoint(token: str = Depends(oauth2)):
    user = auth_manager.get_current_user(token) if token else None
    # Real DB query
    try:
        df = data_engine.conn.execute("SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 50").fetchdf()
        # Convert timestamp to string
        if not df.empty:
            df["time"] = df["timestamp"].astype(str)
            df = df.rename(columns={"user_name": "user"})
            data = df.to_dict(orient="records")
        else:
            data = []
        return {"status": "success", "data": data}
    except Exception as e:
        return {"status": "error", "message": str(e), "data": []}

class UserCreate(BaseModel):
    username: str
    password: str
    role: str
    badge: str

@app.post("/api/admin/users", tags=["Admin"])
async def create_user(req: UserCreate, token: str = Depends(oauth2)):
    user = auth_manager.get_current_user(token) if token else None
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")
    
    import uuid
    import hashlib
    user_id = f"USR-{str(uuid.uuid4())[:6].upper()}"
    pw_hash = hashlib.sha256(req.password.encode()).hexdigest()
    try:
        data_engine.conn.execute(
            "INSERT INTO users (id, username, password_hash, role, badge) VALUES (?, ?, ?, ?, ?)",
            (user_id, req.username.lower(), pw_hash, req.role.lower(), req.badge)
        )
        log_action(user, "CREATE_USER", f"Created {req.username}")
        return {"status": "success", "message": "User created successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/analytics/network", tags=["Analytics"])
async def network(
    district:   Optional[str] = None,
    crime_type: Optional[str] = None,
    year:       Optional[int] = None,
):
    return data_engine.get_network_data(district=district, crime_type=crime_type, year=year).to_dict()

@app.get("/api/analytics/map", tags=["Analytics"])
async def crime_map(
    district:   Optional[str] = None,
    crime_type: Optional[str] = None,
    year:       Optional[int] = None,
):
    return data_engine.get_map_data(district=district, crime_type=crime_type, year=year).to_dict()

@app.get("/api/analytics/socio", tags=["Analytics"])
async def socio():
    return data_engine.get_socio_correlation().to_dict()

@app.get("/api/analytics/victim-profile", tags=["Analytics"])
async def victim_profile(
    crime_type: Optional[str] = None,
    district:   Optional[str] = None,
):
    return data_engine.get_victim_profile(crime_type=crime_type, district=district).to_dict()

@app.get("/api/analytics/monthly", tags=["Analytics"])
async def monthly(
    district:   Optional[str] = None,
    crime_type: Optional[str] = None,
    year:       Optional[int] = None,
):
    return data_engine.get_monthly_pattern(district=district, crime_type=crime_type, year=year).to_dict()

@app.get("/api/analytics/conviction", tags=["Analytics"])
async def conviction(top_n: int = Query(15, le=35)):
    return data_engine.get_conviction_analysis(top_n=top_n).to_dict()

@app.get("/api/analytics/offenders", tags=["Analytics"])
async def offenders():
    return {
        "status": "success",
        "data": [
            { "id": "OFF-2391", "name": "Ramesh K.", "type": "Theft, Robbery", "risk": 85, "district": "Bengaluru Urban", "cases": 14 },
            { "id": "OFF-1024", "name": "Syed M.", "type": "Fraud", "risk": 72, "district": "Mysuru", "cases": 8 },
            { "id": "OFF-8842", "name": "Gowda S.", "type": "Assault", "risk": 64, "district": "Mandya", "cases": 5 },
            { "id": "OFF-1923", "name": "Prakash D.", "type": "Extortion", "risk": 91, "district": "Bengaluru Rural", "cases": 12 },
            { "id": "OFF-4411", "name": "Naveen P.", "type": "Narcotics", "risk": 78, "district": "Mangaluru", "cases": 6 },
            { "id": "OFF-6652", "name": "Kumar V.", "type": "Theft", "risk": 55, "district": "Hubballi-Dharwad", "cases": 3 },
            { "id": "OFF-9120", "name": "Raju T.", "type": "Cyber Crime", "risk": 88, "district": "Bengaluru Urban", "cases": 9 },
            { "id": "OFF-3310", "name": "Mani N.", "type": "Assault", "risk": 45, "district": "Ballari", "cases": 2 },
            { "id": "OFF-7721", "name": "Shiva R.", "type": "Robbery", "risk": 79, "district": "Tumakuru", "cases": 7 },
            { "id": "OFF-5509", "name": "Farooq A.", "type": "Fraud", "risk": 68, "district": "Kalaburagi", "cases": 4 },
            { "id": "OFF-2281", "name": "Manju B.", "type": "Theft", "risk": 62, "district": "Hassan", "cases": 5 },
            { "id": "OFF-8199", "name": "Vijay H.", "type": "Extortion", "risk": 82, "district": "Belagavi", "cases": 8 },
            { "id": "OFF-1104", "name": "Karthik C.", "type": "Narcotics", "risk": 74, "district": "Udupi", "cases": 4 },
            { "id": "OFF-4921", "name": "Arun K.", "type": "Assault", "risk": 51, "district": "Shivamogga", "cases": 3 },
            { "id": "OFF-6633", "name": "Suresh M.", "type": "Robbery", "risk": 86, "district": "Davanagere", "cases": 11 }
        ]
    }

@app.get("/api/analytics/breakdown", tags=["Analytics"])
async def breakdown(district: Optional[str] = None, year: Optional[int] = None):
    return data_engine.get_crime_breakdown(district=district, year=year).to_dict()

@app.get("/api/fir", tags=["Data"])
async def fir(
    district:   Optional[str] = None,
    crime_type: Optional[str] = None,
    year_start: Optional[int] = None,
    year_end:   Optional[int] = None,
    limit:      int = 50
):
    return data_engine.query_fir(
        district=district, crime_type=crime_type,
        year_start=year_start, year_end=year_end, limit=limit
    ).to_dict()

from pydantic import BaseModel
class FIRData(BaseModel):
    district: str
    station: str
    crime_group: str
    crime_head: str
    place: str
    accused: str
    lat: float
    lon: float

@app.post("/api/fir/register", tags=["Data"])
async def register_fir(data: FIRData, token: str = Depends(oauth2)):
    user = auth_manager.get_current_user(token) if token else None
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required to register FIR")
    log_action(user, "REGISTER_FIR", f"{data.crime_group} in {data.district}")
    success = data_engine.register_fir(data.dict())
    if success:
        return {"status": "success", "message": "FIR registered successfully"}
    return {"status": "error", "message": "Failed to register FIR"}

@app.get("/api/meta/districts", tags=["Meta"])
async def districts():
    return {"districts": data_engine.get_all_districts()}

@app.get("/api/meta/crime-groups", tags=["Meta"])
async def crime_groups():
    return {"crime_groups": data_engine.get_all_crime_groups()}


# ─────────────────────── WebSocket ───────────────────────────────

@app.websocket("/ws/chat")
async def ws_chat(websocket: WebSocket):
    """Streaming chat over WebSocket for real-time UX."""
    await websocket.accept()
    try:
        while True:
            raw  = await websocket.receive_text()
            msg  = json.loads(raw)
            intent = await nlp_engine.parse(msg.get("message", ""))
            result = await _route_query(intent)
            await websocket.send_text(json.dumps({
                "message":       _build_response_text(intent, result),
                "viz_type":      result.viz_type,
                "viz_data":      result.data,
                "total_records": result.total_rows,
                "intent":        intent.to_dict(),
                "sources":       _get_sources(intent),
                "timestamp":     datetime.now().isoformat(),
            }, default=str))
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WS error: {e}")

# ─────────────────────── helpers ─────────────────────────────────

async def _route_query(intent: QueryIntent) -> QueryResult:
    district = intent.districts[0]   if intent.districts   else None
    crime    = intent.crime_types[0] if intent.crime_types else None

    routes = {
        "hotspot":    lambda: data_engine.get_hotspots(crime_type=crime, year=intent.year_start, top_n=intent.limit or 15),
        "trend":      lambda: data_engine.get_trends(crime_type=crime, district=district,
                                                     year_start=intent.year_start or 2016, year_end=intent.year_end or 2023),
        "compare":    lambda: data_engine.get_district_comparison(crime_type=crime, year=intent.year_start, top_n=intent.limit or 10),
        "predict":    lambda: data_engine.predict_crime(district=district, crime_type=crime, target_year=intent.target_year or 2026),
        "network":    lambda: data_engine.get_network_data(district=district, crime_type=crime, year=intent.year_start),
        "profile":    lambda: data_engine.get_crime_breakdown(district=district, year=intent.year_start),
        "socio":      lambda: data_engine.get_socio_correlation(),
        "victim":     lambda: data_engine.get_victim_profile(crime_type=crime, district=district),
        "conviction": lambda: data_engine.get_conviction_analysis(),
        "monthly":    lambda: data_engine.get_monthly_pattern(district=district, crime_type=crime, year=intent.year_start),
        "detail":     lambda: data_engine.query_fir(district=district, crime_type=crime,
                                                    year_start=intent.year_start, year_end=intent.year_end,
                                                    month=intent.month, limit=intent.limit or 50),
    }
    fn = routes.get(intent.intent)
    if fn:
        return fn()
    # fallback
    if district:
        return data_engine.query_fir(district=district, crime_type=crime)
    return data_engine.get_hotspots(crime_type=crime, year=intent.year_start)


def _build_response_text(intent: QueryIntent, result: QueryResult) -> str:
    if not result.data and result.total_rows == 0:
        return ("No records found for your query. Try adjusting the district name, "
                "crime type, or year range. Type **'help'** to see example queries.")

    district = intent.districts[0]   if intent.districts   else "Karnataka"
    crime    = intent.crime_types[0] if intent.crime_types else "all crimes"

    templates = {
        "hotspot":    f"**Crime Hotspot Analysis** — {crime.title()} in {district}\n\n{result.summary}",
        "trend":      f"**Temporal Trend Analysis** — {crime.title()} in {district}\n\n{result.summary}",
        "compare":    f"**District Comparison** — {crime.title()} ranking\n\n{result.summary}",
        "predict":    f"**Predictive Intelligence** — {crime.title()} forecast\n\n{result.summary}\n\n> ⚠ Predictions are based on linear regression of historical FIR data. Use as decision support, not ground truth.",
        "network":    f"**Criminal Pattern Network** — district ↔ crime connections\n\n{result.summary}",
        "profile":    f"**Crime Profile** — {district}\n\n{result.summary}",
        "socio":      f"**Socioeconomic Correlation** — how poverty, literacy & GDP relate to crime\n\n{result.summary}",
        "victim":     f"**Victim/Accused Profile** — {crime.title()} demographics\n\n{result.summary}",
        "conviction": f"**Justice Performance Metrics** — conviction & chargesheet rates\n\n{result.summary}",
        "monthly":    f"**Seasonal Crime Pattern** — monthly distribution of {crime.title()}\n\n{result.summary}",
        "detail":     f"**FIR Records** — {result.total_rows:,} cases found\n\n{result.summary}",
        "general":    f"**Crime Intelligence Query**\n\n{result.summary}",
    }
    return templates.get(intent.intent, f"**Results**\n\n{result.summary}")


def _get_sources(intent: QueryIntent) -> List[str]:
    src = ["Karnataka FIR Database — 1,674,735 records (KSP SCRB)"]
    if intent.intent == "socio":
        src.append("India Crime Socioeconomic Indicators Dataset")
    if any(c in intent.crime_types for c in ["murder"]):
        src.append("NCRB Murder Victim Profile (State-wise)")
    if any(c in intent.crime_types for c in ["rape","women","dowry"]):
        src.append("NCRB Crime Against Women Dataset")
    src.append("IPC District Crime Statistics 2001–2014 (NCRB)")
    return src


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
