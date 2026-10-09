# Ventrix — Complete Master Project Specification & Technical Architecture

**Project Title**: A Data-Driven Approach for Remaining Useful Life (RUL) Prediction of Railway HVAC Systems Using Artificial Intelligence.  
**Platform**: **Ventrix is an intelligent railway HVAC predictive maintenance platform with integrated depot maintenance and spare-parts management.**  
- **Primary Focus**: HVAC Condition Monitoring & Machine Learning-Based Predictive Maintenance.  
- **Supporting Functions**: Depot Work Orders, Technician Dispatch, Spare Parts Inventory, and Closed-Loop Verification.  
**Target Rolling Stock Application**: Premium Passenger Coaches (e.g., Rajdhani Express, Vande Bharat Express, Shatabdi Express).  
**Technology Stack**: Node.js / Express.js, PostgreSQL, Python (scikit-learn), React (Vite), Kafka (optional event broker).

---

## 1. Project Overview & System Objectives

Modern passenger railway operations rely heavily on Roof-Mounted AC Units (RMPUs) to maintain passenger comfort and cabin air quality. A mid-journey HVAC failure causes immediate passenger distress, service disruptions, and expensive emergency depot turnarounds.

**Ventrix improves conventional railway HVAC maintenance by combining preventive maintenance, condition-based monitoring, and predictive maintenance into a unified, closed-loop platform:**

- **Preventive Maintenance**: Manages recurring, calendar-based or mileage-based maintenance schedules (`maintenance_schedules`).
- **Condition-Based Maintenance**: Continuously tracks real-time sensor limits to catch immediate operational breaches (e.g., refrigerant suction pressure loss, excessive compressor current).
- **Predictive Maintenance**: Projects the Remaining Useful Life (RUL) of critical components using machine learning, allowing repairs to be scheduled days or weeks before functional failure occurs.
- **Simulation-Based Digital Twin Hierarchy**: A digital representation linking trains, coaches, HVAC assets, live telemetry, and depot maintenance tickets.
- **Decision-Support for Maintenance Engineers**: AI predictions provide explainable degradation indicators (why RUL is declining) to empower engineers to schedule targeted repairs before faults manifest. AI predictions support Engineer decision-making rather than autonomously executing maintenance actions.
- **Closed-Loop Depot Operations**: Connects alerts, service requests, work orders, spare part requisition, admin inventory issuance, field measurement findings, post-maintenance telemetry re-evaluation, and formal engineering verification with persistent maintenance history.

---

## 2. User Roles & Operational Separation

Ventrix strictly enforces a **three-tier role architecture** to maintain operational integrity:

```
┌──────────────────────────────────────────────────────────────────┐
│                   1. ADMIN (System Governance)                   │
│     User Provisioning · RBAC Permissions · Fleet Oversight       │
│               Admin — Inventory/Warehouse Operations             │
└─────────────────────────────────┬────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│              2. MAINTENANCE ENGINEER (Decision-Maker)            │
│   Diagnostics · RUL Evaluation · Work Dispatch · Part Approval   │
│                 Service Request Triage · Sign-Off                │
└─────────────────────────────────┬────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│              3. FIELD TECHNICIAN (Physical Execution)            │
│    Job Execution · Part Requisitions · Findings · Sign-Off       │
│                  Service Request Defect Reports                  │
└──────────────────────────────────────────────────────────────────┘
```

1. **Admin (`admin@ventrix.com`)**:
   - **Responsibility**: System governance, user provisioning, dynamic RBAC permission toggling, asset registry management, warehouse stock oversight, and high-level fleet reliability metrics.
   - **Inventory Role (Admin — Inventory/Warehouse Operations)**: The Administrator performs the physical warehouse issuance function when approved part requisitions are dispensed.
   - **Boundary**: Does **not** perform daily technician dispatching or physical maintenance.
2. **Maintenance Engineer (`engineer@ventrix.com`)**:
   - **Responsibility**: The primary operational decision-maker. Evaluates real-time telemetry, incoming alerts, service requests, and AI RUL forecasts. Converts predictive recommendations and scheduled plans into work orders, validates technician capacity, approves spare part requisitions, inspects post-maintenance telemetry, and formally verifies completed jobs.
3. **Field Technician (`tech@ventrix.com`)**:
   - **Responsibility**: On-site execution. Submits field service requests for observed defects, accepts assigned work orders, transitions job states, requisitions required spare parts, logs physical measurement findings (temperature delta, vibration, head pressure), and submits completion reports for engineering verification.

> **Operational Interaction**: The Technician requests the required spare part, the Engineer approves the technical requirement, and the Admin performs the inventory issuance.

---

## 3. End-to-End System & Data Flow Architecture

In Ventrix, **the frontend never touches PostgreSQL directly**. All client interactions flow through authenticated REST APIs hosted by the Express backend.

```
┌───────────────────────────────┐
│ Railway HVAC Simulation       │
│ (Physics + Monte Carlo Env)   │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│ Telemetry Streaming           │
│ Direct HTTP / Kafka Broker    │
└───────────────┬───────────────┘
                │ (X-Telemetry-Key)
                ▼
┌───────────────────────────────┐
│ Express API Ingestion         │
│ (Range + Consistency Checks)  │
└───────┬───────────────┬───────┘
        │               │
        ▼               ▼
┌──────────────┐ ┌──────────────┐
│  PostgreSQL  │ │ AI Inference │
│  Database    │ │ (predict.py) │
└───────┬──────┘ └──────┬───────┘
        │               │
        └───────┬───────┘
                │
                ▼
┌───────────────────────────────┐
│ Express REST Services         │
└───────────────┬───────────────┘
                │ (Axios / Bearer JWT)
                ▼
┌───────────────────────────────┐
│ React Frontend Application    │
│ (Role-Specific Dashboards)    │
└───────────────────────────────┘
```

### Architectural Responsibilities:
- **`telemetryModel.js`**: Handles database persistence and transactional storage of incoming telemetry, rule-based alerts, active alert deduplication, and connection status tracking (`LIVE`, `STALE`, `OFFLINE`).
- **`aiPredictionService.js`**: Orchestrates the Machine Learning workflow. Retrieves the latest 20 telemetry readings per asset, invokes the Python Random Forest inference engine via stdin/stdout, stores RUL predictions, synchronizes asset health, and generates prescriptive explainability advisories.
- **`predict.py`**: Independent Python inference engine loading `rul_model.pkl`, executing 20-cycle rolling feature transformations, and predicting remaining useful life in hours and operational days.
- **`PredictionsPage.jsx` / `AIPredictionsView.jsx`**: The dedicated AI prediction view in the client dashboard, providing fleet-wide RUL indicators, health conditions, degradation drivers, and one-click dispatch triggers.

---

## 4. The Ventrix Digital Twin Hierarchy

In Ventrix, the **Digital Twin** is a **simulation-based digital representation linking trains, coaches, HVAC assets, live telemetry, and depot maintenance tickets**:

```
Railway System (Indian Railways)
      ↓
Train (e.g. 12951 Rajdhani Express)
      ↓
Coach (e.g. Coach A1 - AC First Class)
      ↓
HVAC Unit (e.g. HVAC-001 End-A / HVAC-002 End-B)
      ↓
Live Telemetry (Supply Air Temp, Pressure, Current, Filter DP, Vibration)
      ↓
Degradation State (Compressor Wear, Motor Efficiency, Filter Restriction)
      ↓
AI Predicted RUL & Risk Level (CRITICAL / HIGH / MEDIUM / NOMINAL)
      ↓
Depot Maintenance State (Open Work Orders, Assigned Technicians, Parts Issued)
      ↓
Maintenance History (Completed Inspections, Verified Telemetry, Replaced Parts)
```

Through this hierarchy, platform users can inspect equipment condition and maintenance lifecycles at any level of granularity: whole fleet, specific train routes, coaches, or individual rooftop HVAC units.

---

## 5. Physics-Informed HVAC Simulation & Stochastic Engine

The prototype utilizes physics-informed simulation combined with stochastic environment generation to model realistic degradation.

### 5.1 Stochastic Environment Generation (`MonteCarloEngine.js`)
To ensure varied operational stress across units rather than a single repeated trajectory, `MonteCarloEngine.js` generates randomized operational parameters:
- **Ambient Temperature**: $28^\circ	ext{C}$ to $45^\circ	ext{C}$
- **Ambient Humidity**: $50\%$ to $90\%$
- **Passenger Load**: $40$ to $320$ passengers
- **Train Operating Speed**: $0$ to $110	ext{ km/h}$
- **Supply Voltage**: $390	ext{ V}$ to $420	ext{ V}$ (3-phase 415V nominal)

### 5.2 Thermodynamic Equations (`HVACPhysics.js`)
The simulation models heat transfer and refrigeration physics:
1. **Cabin Heat Load ($Q_{\text{load}}$)**:
   $$Q_{\text{load}} = Q_{\text{ambient}} + Q_{\text{passengers}} + Q_{\text{doors}} + Q_{\text{equipment}}$$
   where $Q_{\text{ambient}} = (T_{\text{ambient}} - 24^\circ\text{C}) \times 0.8$, $Q_{\text{passengers}} = N_{\text{passengers}} \times 0.12\text{ kW}$, and $Q_{\text{equipment}} = 2.5\text{ kW}$.
2. **Airflow Restriction Across Filter**:
   $$\Delta P_{\text{filter}} = \Delta P_{\text{nominal}} + (\Delta P_{\text{max}} - \Delta P_{\text{nominal}}) \times R_{\text{filter}}$$
   $$\text{Airflow} = \max\left(0.35, 1.0 - 0.65 \times \frac{\Delta P_{\text{filter}} - \Delta P_{\text{nominal}}}{\Delta P_{\text{max}} - \Delta P_{\text{nominal}}}\right)$$
3. **Electrical Power & Current**:
   $$P_{\text{electrical}} = \frac{Q_{\text{cooling}}}{\text{COP} \times \eta_{\text{motor}}} \times \left(1 + \frac{\text{CompressorWear}}{2}\right)$$
   $$I_{\text{compressor}} = \frac{P_{\text{electrical}} \times 1000}{\sqrt{3} \times V_{\text{supply}} \times \text{PF} \times \eta_{\text{motor}}}$$

### 5.3 Mechanical Aging & Wear Engine (`HVACDegradation.js`)
Operating hours accumulate under load stress:
$$\text{Stress} = 0.4 + \text{CompressorLoad}$$
$$\text{Wear}_{\text{compressor}}(t + \Delta t) = \text{Wear}_{\text{compressor}}(t) + \left(\frac{1}{\text{DesignLifeHours}}\right) \times \text{Stress} \times \Delta t$$
$$\eta_{\text{compressor}} = \max(0.15, 1.0 - \text{Wear}_{\text{compressor}})$$
$$\eta_{\text{motor}} = \max(0.50, 1.0 - \text{Wear}_{\text{motor}} \times 0.5)$$

> **Data Authenticity Note**: Ventrix is trained and demonstrated using run-to-failure data generated from **80 simulated railway HVAC units with different degradation patterns and operating lifetimes**. Ventrix does **not** claim to be trained on real sensor logs from operational Vande Bharat, Rajdhani, or Shatabdi rakes. The architecture uses standard REST/Kafka schemas so physical IoT edge gateways can directly connect when available.

---

## 6. Telemetry Ingestion, Validation & Server-Side Health Authority

### 6.1 Telemetry Streaming Mechanisms
1. **Direct HTTP Streamer (`stream_direct.js`)**: Advances simulated time and POSTs telemetry directly to `http://localhost:5000/api/telemetry` every 3 seconds with header `X-Telemetry-Key`.
2. **Kafka Event Pipeline (`KafkaConsumer.js`)**: Simulation publishes to topic `simulation.telemetry`. A consumer bridge forwards messages to the Express API.

### 6.2 Range & Consistency Validation
The ingestion pipeline enforces **range validation + data consistency validation**:
- **Physical Sensor Plausibility Bounds**:
  - Supply Air Temp: $-30.0^\circ	ext{C}$ to $80.0^\circ	ext{C}$
  - Refrigerant Pressure: $0.0	ext{ bar}$ to $40.0	ext{ bar}$
  - Compressor Current: $0.0	ext{ A}$ to $120.0	ext{ A}$
  - Filter DP: $0.0	ext{ Pa}$ to $5,000.0	ext{ Pa}$
  - Power Consumption: $0.0	ext{ kW}$ to $250.0	ext{ kW}$
  - Vibration: $0.0	ext{ mm/s}$ to $100.0	ext{ mm/s}$
  - Operating Hours: $0	ext{ h}$ to $500,000	ext{ h}$
- **Consistency Checks**:
  - `assetId` must exist in active registry and match alphanumeric format.
  - `timestamp` must be valid ISO 8601, not $> 24	ext{ hours}$ in the future, and not $> 60	ext{ days}$ in the past.
  - Operating hours must be monotonically non-decreasing.

### 6.3 Server-Side Health Authority
> **Telemetry values received from the simulator are validated at the API boundary, while authoritative asset health and operational status are determined by the backend using telemetry, rule evaluation, and prediction results.**

### 6.4 Telemetry Connection Status (`LIVE`, `STALE`, `OFFLINE`)
An asset must not be shown as healthy simply because its last recorded reading hours ago was nominal. Ventrix evaluates communication freshness:
```
Telemetry received within last 30 seconds
                ↓
              LIVE

No telemetry received for 30s to 5 minutes
                ↓
              STALE

No communication received beyond 5 minutes
                ↓
             OFFLINE
```

---

## 7. Machine Learning & RUL Prediction Deep Dive

### 7.1 Model Architecture & Evaluation
- **Random Forest Regressor**: A Random Forest model with 150 decision trees is trained using run-to-failure data generated from 80 simulated HVAC units.
- **Validation**: Evaluated using a **unit-level grouped train/test split**, with 80% of units (64 units) used for training and 20% unseen units (16 units) used for testing.
- **Evaluation Performance**:
  - **Mean Absolute Error (MAE)**: $pprox 42.5	ext{ hours}$
  - **Coefficient of Determination ($R^2$)**: $0.940$

### 7.2 Why 20-Cycle Rolling Features Are Used
The model evaluates the **latest 20 telemetry readings per unit** to capture:
1. **Recent Degradation Trends**: Rolling mean ($\mu_{20}$) smooths short-term noise.
2. **Process Variability**: Rolling standard deviation ($\sigma_{20}$) detects mechanical flutter and unstable suction.
3. **Rate of Degradation**: Instantaneous rate of change ($\Delta x$) captures how rapidly temperature or current is deteriorating.

### 7.3 Independent RUL Risk vs. Health Condition Logic

RUL Risk and Health Condition are **two independent indicators**:
> **RUL Risk represents the predicted remaining operating life of the HVAC unit, while Health Condition represents its current operating condition based on the health score.**

| Predicted RUL | Health Score | Operational Meaning |
|---|---|---|
| $1,600	ext{ h}$ | $94\%$ | **NOMINAL + Healthy** (Optimal condition, long life remaining) |
| $700	ext{ h}$ | $82\%$ | **MEDIUM + Good** (Normal wear, turnaround within standard window) |
| $400	ext{ h}$ | $70\%$ | **HIGH + Warning** (Noticeable degradation; turnaround needed within 72h) |
| $100	ext{ h}$ | $55\%$ | **CRITICAL + Maintenance Required** (Urgent repair needed despite moderate health) |

#### Primary AI Risk Classification (Driven by RUL)
| Risk Level | RUL Threshold | Action Required |
|---|---|---|
| **CRITICAL** | $< 150	ext{ hours}$ | Immediate depot inspection; urgent technician dispatch |
| **HIGH** | $150	ext{ h} - 500	ext{ hours}$ | Service turnaround required within 72 hours |
| **MEDIUM** | $500	ext{ h} - 1000	ext{ hours}$ | Routine monitoring; inspect at next turnaround |
| **NOMINAL** | $\ge 1000	ext{ hours}$ | Optimal performance; standard scheduled cycle |

#### Health Condition Classification (Driven by Health Score)
| Health Score | Condition Status | Engineering Interpretation |
|---|---|---|
| $\ge 90\%$ | **Healthy** | Optimal operating parameters across all sensors |
| $75\% - 89.9\%$ | **Good** | Normal operational wear within acceptable limits |
| $60\% - 74.9\%$ | **Warning** | Elevated filter DP, motor resistance, or thermal lag |
| $40\% - 59.9\%$ | **Maintenance Required** | Significant component degradation; schedule servicing |
| $< 40\%$ | **Critical** | Severe thermodynamic or mechanical degradation |

> **Operational Threshold Clarification**: 75% is the minimum acceptable operational threshold for returning an asset to service, while 90% is the threshold for the "Healthy" condition category (75–89.9% is categorized as "Good"). Therefore, an asset with 78% health is in "Good" condition and is safely restorable to OPERATIONAL.

### 7.4 Safe Model Explainability
- **Observed Condition**: Filter DP elevated ($> 280	ext{ Pa}$).
  - *Interpretation*: Elevated filter restriction.
  - *Recommendation*: Inspect/replace return-air filter.
- **Observed Condition**: Compressor current elevated ($> 18.0	ext{ A}$).
  - *Interpretation*: Elevated compressor current is consistent with increased compressor mechanical wear.
  - *Recommendation*: Inspect compressor electrical windings and bearing lubrication.

---

## 8. Complete Maintenance Management Lifecycle

### 8.1 The Three Maintenance Triggers
Ventrix explicitly integrates:
1. **Preventive Maintenance**: Scheduled depot plans in `maintenance_schedules` based on calendar intervals or design operating hours.
2. **Condition-Based Maintenance**: Immediate alarms triggered when real-time telemetry breaches configured operational thresholds.
3. **Predictive Maintenance**: Early warnings triggered when Random Forest RUL forecasts drop into `HIGH` or `CRITICAL` risk horizons.

### 8.2 Service Request Triage Flow
> **Engineers review incoming requests and either resolve trivial or duplicate requests or convert confirmed defects into Work Orders with linked references.**

```
Technician Submits Service Request (Status: OPEN)
                    ↓
        Engineer Triage & Review
         ┌───────────┴───────────┐
         │                       │
 Maintenance Required?     False Alarm / Trivial?
         │                       │
         ▼                       ▼
Convert to Work Order     Mark as RESOLVED / CLOSED
(Linked via work_order_id)
```

### 8.3 Work Order Duplicate Protection & Technician Capacity Check
1. **Duplicate Active Work Order Prevention**:
   Before creating a work order, the server verifies that no active ticket (`status NOT IN ('CLOSED', 'CANCELLED')`) already exists on that asset for the same alert or issue title:
   ```sql
   SELECT id FROM work_orders
   WHERE asset_id = $1 AND status NOT IN ('CLOSED', 'CANCELLED')
     AND (alert_id = $2 OR LOWER(title) = LOWER($3))
   ```
2. **Technician Workload Conflict Validation**:
   Checks whether the assigned technician currently has $\ge 3$ active jobs (`ASSIGNED`, `ACCEPTED`, `IN_PROGRESS`, `WAITING_FOR_PARTS`). If so, assignment is blocked unless explicitly overridden.

### 8.4 Work Order State Machine

```
OPEN
  ↓ (Assign Technician)
ASSIGNED
  ↓ (Technician Accepts)
ACCEPTED
  ↓ (Start Physical Work)
IN_PROGRESS
  ├──→ COMPLETED (No parts required)
  │
  └──→ WAITING_FOR_PARTS
            ↓ (Admin Issues Stock)
      PARTS_ISSUED
            ↓ (Work Resumes)
       IN_PROGRESS
            ↓ (Submit Findings & Report)
        COMPLETED
            ↓ (Engineer Verification)
   UNDER_VERIFICATION
            ↓
  Post-Maintenance Telemetry Re-check
    ┌───────────────┴───────────────┐
    │                               │
  PASS                            FAIL
    │                               │
    ▼                               ▼
Restored to OPERATIONAL      Remains WARNING / MAINTENANCE
    │                               │
    ▼                               ▼
Work Order CLOSED            Work Order CLOSED /
    │                        Follow-up Ticket Created
    ▼                               │
Maintenance History Updated ◄───────┘
```
*(Work orders may also transition to `CANCELLED` if rejected or cancelled prior to physical execution).*

> **Work Order Closure Logic**: Work order closure records completion of the assigned physical maintenance activity. The asset is restored to `OPERATIONAL` only if post-maintenance telemetry confirms health $\ge 75\%$, physical parameters are nominal, and no other unresolved tickets remain on that unit. If post-repair telemetry shows lingering issues or secondary tickets remain open, the asset status remains `WARNING` or `MAINTENANCE`.

---

## 9. Spare Parts & Auditable Inventory Management

### 9.1 Three-Role Part Requisition Flow
1. **Technician Requisitions Part**: Selects part code, quantity, and work order (`part_requests` status: `PENDING`).
2. **Engineer Approves Requisition**: Evaluates technical justification; updates status to `APPROVED`.
3. **Admin Issues Warehouse Stock**: As part of **Admin — Inventory/Warehouse Operations**, the Administrator executes stock issuance. Status becomes `ISSUED`, quantity in `inventory` decrements, consumed components are recorded in `work_order_parts`, and an entry is logged in the auditable stock ledger.

### 9.2 Auditable Stock Ledger (`stock_transactions`)
Every stock change creates an auditable transaction in `stock_transactions`, recording:
- `user_id`: Administrator executing the change
- `part_id`: Spare part modified
- `transaction_type`: `RECEIVED` (vendor replenishment), `PART_ISSUE` (consumed on work order), `DAMAGED` (scrapped), `ADJUSTED` (cycle count audit)
- `quantity`: Signed integer (+10 received, -1 issued)
- `reference_type` and `reference_id`: Associated work order or purchase order
- `reason`: Mandatory text audit justification

### 9.3 `part_requests` vs. `work_order_parts` (`wo_parts`)
- **`part_requests`**: Tracks the technician request and engineering approval workflow.
- **`work_order_parts` (`wo_parts`)**: Records the actual parts issued from the warehouse and consumed against a work order during repair execution.

---

## 10. Configured Operational Thresholds & Alert Management

The operational limits used in Ventrix represent **configured operational thresholds used by the Ventrix simulation and prototype environment**:
- **Refrigerant Suction Pressure**: $< 3.8	ext{ bar}$ (Critical: risk of coil freeze-up or leak)
- **Supply Air Temperature**: $> 25.5^\circ	ext{C}$ (Warning: cooling capacity degradation)
- **Filter Differential Pressure**: $> 280.0	ext{ Pa}$ (Warning: return air restriction)
- **Compressor Current**: $> 18.0	ext{ A}$ (Warning: motor/mechanical resistance)

### Active Alert Deduplication
To prevent flooding the engineer with duplicate alerts every 3 seconds while degradation continues, the database enforces active alert deduplication:
```sql
WHERE NOT EXISTS (
  SELECT 1 FROM alerts
  WHERE asset_id = $1 AND title = $title AND source = $source AND is_resolved = FALSE
)
```

---

## 11. Relational Database Schema & Domain Model

```
                  ┌──────────────────────┐
                  │    organizations     │
                  └──────────┬───────────┘
                             │
                  ┌──────────▼───────────┐
                  │       projects       │
                  └──────────┬───────────┘
                             │
                  ┌──────────▼───────────┐
                  │        trains        │
                  └──────────┬───────────┘
                             │
                  ┌──────────▼───────────┐
                  │       coaches        │
                  └──────────┬───────────┘
                             │
                  ┌──────────▼───────────┐
                  │        assets        │◄─────────────────────────┐
                  └────┬──────┬──────┬───┘                          │
                       │      │      │                              │
         ┌─────────────┘      │      └──────────────┐               │
         ▼                    ▼                     ▼               │
  ┌─────────────┐      ┌─────────────┐       ┌─────────────┐        │
  │  telemetry  │      │ predictions │       │   alerts    │        │
  └─────────────┘      └─────────────┘       └─────────────┘        │
         ▲                                          │               │
         │                                          │               │
  ┌──────┴──────────────┐                           │               │
  │maintenance_schedules│                           │               │
  └──────┬──────────────┘                           │               │
         │                                          │               │
         ▼                                          ▼               │
  ┌─────────────┐                            ┌──────────────┐       │
  │ work_orders │◄───────────────────────────┤service_reqs  │       │
  └──────┬──────┘                            └──────────────┘       │
         │                                                          │
         ├───────────────────────┬────────────────────────┐         │
         ▼                       ▼                        ▼         │
  ┌──────────────┐        ┌─────────────┐          ┌─────────────┐  │
  │work_ord_parts│        │part_requests│          │    users    │──┘
  └──────────────┘        └──────┬──────┘          └──────┬──────┘
                                 │                        │
                          ┌──────▼──────┐          ┌──────▼──────┐
                          │    parts    │          │    roles    │
                          └──────┬──────┘          └──────┬──────┘
                                 │                        │
                          ┌──────▼──────┐          ┌──────▼──────┐
                          │  inventory  │          │ permissions │
                          └──────┬──────┘          └─────────────┘
                                 │
                          ┌──────▼──────┐
                          │  stock_txns │
                          └─────────────┘
```

---

## 12. Final Master Architecture Flowchart

```
                 VENTRIX
                    │
       ┌────────────┴────────────┐
       │                         │
 HVAC SIMULATION             USER PLATFORM
       │                         │
       ▼                         ▼
 LIVE TELEMETRY             React Frontend
       │                   Admin / Engineer /
       ▼                      Technician
 Express API
       │
 ┌─────┴──────────┐
 │                │
 ▼                ▼
PostgreSQL      AI / RUL
 │                │
 │          Random Forest
 │                │
 └───────┬────────┘
         ▼
  HEALTH + ALERTS
         │
         ▼
  ENGINEER DECISION
         │
 ┌───────┼────────┐
 │       │        │
 ▼       ▼        ▼
Scheduled Rule   AI/RUL
Maintenance Alert Prediction
 │       │        │
 └───────┼────────┘
         ▼
     WORK ORDER
         │
         ▼
     TECHNICIAN
         │
         ▼
    PART REQUEST
         │
         ▼
  ENGINEER APPROVAL
         │
         ▼
   ADMIN ISSUANCE
         │
         ▼
    REPAIR + TEST
         │
         ▼
 FIELD MEASUREMENTS
         │
         ▼
 ENGINEER VERIFICATION
         │
         ▼
 POST-MAINTENANCE
 TELEMETRY CHECK
         │
         ▼
 ASSET RE-EVALUATION
         │
         ▼
 MAINTENANCE HISTORY
```

---

## 13. Academic & Industrial Limitations

1. **Simulated Telemetry Environment**: The current prototype uses physics-informed simulated telemetry rather than physical hardware sensors deployed on operational rolling stock.
2. **Simulation-Trained ML Model**: The Random Forest RUL model is trained and evaluated using run-to-failure degradation data generated from 80 simulated HVAC units with diverse operating lifetimes; real railway sensor data is not currently used for model validation.
3. **Prototype Fleet Scale**: The prototype demonstrates condition monitoring and depot logistics across 5 simulated rooftop HVAC units (`HVAC-001` through `HVAC-005`).
4. **Subprocess Inference Model**: For the academic prototype, the Python inference engine is invoked as a subprocess via standard input/output. In a high-concurrency production system, this would be deployed as a persistent microservice (e.g., FastAPI / gRPC).
5. **Environmental Noise & Track Shocks**: Real rolling stock operations feature harsh ambient vibrations, dust fouling, and track shocks that require edge filtering and sensor calibration prior to ingestion.
