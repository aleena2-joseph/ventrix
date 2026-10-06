# Ventrix — Complete Final Project Specification & Technical Architecture

**Project Title**: A Data-Driven Approach for Remaining Useful Life (RUL) Prediction of Railway HVAC Systems Using Artificial Intelligence.  
**Platform**: Ventrix — Railway Rolling Stock HVAC Predictive Maintenance & Depot Logistics Platform  
**Target Rolling Stock**: Premium Passenger Coaches (Rajdhani Express, Vande Bharat Express, Shatabdi Express)  
**Technology Stack**: Node.js / Express.js, PostgreSQL, Python (scikit-learn), React (Vite), Kafka (optional event broker)

---

## 1. Project Overview & System Objectives

Modern passenger railway operations rely heavily on Roof-Mounted AC Units (RMPUs) to maintain passenger comfort and cabin air quality. A mid-journey HVAC failure causes immediate passenger distress, service disruptions, and expensive emergency depot turnarounds.

Traditional maintenance follows reactive (run-to-failure) or rigid time-based periodic maintenance. **Ventrix** replaces these outdated approaches with a **physics-informed Digital Twin and AI-driven predictive maintenance platform**:
- **Continuous Condition Monitoring**: Physics-modeled digital twins generate real-time telemetry simulating operational stress, degradation, and environmental heat loads.
- **Data-Driven RUL Estimation**: A trained Machine Learning model predicts remaining operational hours before critical component breakdown occurs.
- **Decision-Support for Maintenance Engineers**: AI predictions provide explainable degradation indicators (why RUL is declining) to empower engineers to schedule targeted repairs before faults manifest.
- **Closed-Loop Depot Operations**: Seamless workflow connecting alerts, service requests, work orders, spare part requisition, warehouse stock issuance, field measurement findings, and formal engineering verification.

---

## 2. User Roles & Operational Separation

Ventrix enforces a strict three-tier role architecture to maintain operational integrity:

```
┌──────────────────────────────────────────────────────────────┐
│                    ADMIN (System Governance)                 │
│      User Provisioning · RBAC Permissions · Fleet Oversight  │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│             MAINTENANCE ENGINEER (Decision-Maker)            │
│  Diagnostics · RUL Evaluation · Work Dispatch · Part Approval│
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│             FIELD TECHNICIAN (Physical Execution)            │
│ Job Execution · Part Requisitions · Findings · Sign-Off Reports│
└──────────────────────────────────────────────────────────────┘
```

1. **Admin (`admin@ventrix.com`)**:
   - **Responsibility**: System governance, user provisioning, dynamic RBAC permission toggling, asset registry management, warehouse stock oversight, and high-level fleet reliability metrics.
   - **Boundary**: Does **not** perform daily technician dispatching or physical maintenance.
2. **Maintenance Engineer (`engineer@ventrix.com`)**:
   - **Responsibility**: The primary operational decision-maker. Evaluates real-time telemetry, incoming alerts, and AI RUL forecasts. Converts predictive recommendations into scheduled work orders, dispatches technicians, approves spare part requisitions, inspects post-maintenance measurements, and signs off completed jobs.
3. **Field Technician (`tech@ventrix.com`)**:
   - **Responsibility**: On-site execution. Accepts assigned work orders, transitions job states, requisitions required spare parts, logs physical measurement findings (temperature delta, vibration, head pressure), and submits completion reports for engineering verification.

---

## 3. End-to-End System Architecture

```
                    ┌─────────────────────────┐
                    │ Railway HVAC Simulation │
                    │ Physics + Degradation   │
                    └───────────┬─────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │ Telemetry Streaming      │
                    │ Direct HTTP / Kafka      │
                    └───────────┬─────────────┘
                                │ (X-Telemetry-Key)
                                ▼
                    ┌─────────────────────────┐
                    │ Express Backend API     │
                    │ Ingest Validation       │
                    └───────────┬─────────────┘
                                │
               ┌────────────────┼────────────────┐
               ▼                ▼                ▼
        ┌─────────────┐  ┌──────────────┐ ┌─────────────┐
        │ PostgreSQL  │  │ AI Prediction│ │ Maintenance │
        │ Transaction │  │ Service      │ │ Services    │
        └─────────────┘  └──────┬───────┘ └─────────────┘
                                │
                                ▼ (JSON via stdin)
                         ┌─────────────┐
                         │ Python RF   │
                         │ RUL Model   │
                         └──────┬──────┘
                                │ (Predictions + RUL + Risk)
                                ▼
                         React Dashboard
                                │
                  ┌─────────────┼─────────────┐
                  ▼             ▼             ▼
                Admin        Engineer     Technician
```

### Architectural Responsibilities:
- **`telemetryModel.js`**: Handles database persistence and transactional storage of incoming telemetry, initial health scores, threshold alert generation, and asset status synchronization.
- **`aiPredictionService.js`**: Orchestrates the Machine Learning workflow. Retrieves recent telemetry, invokes the Python Random Forest inference engine via stdin/stdout, stores RUL predictions, synchronizes asset health, and generates prescriptive explainability advisories.
- **`predict.py`**: Independent Python inference engine loading `rul_model.pkl`, executing 20-cycle rolling feature transformations, and predicting remaining useful life in hours and operational days.

---

## 4. The Ventrix Digital Twin Hierarchy

In Ventrix, the **Digital Twin** is not merely a 3D visual animation; it represents the **digital operational state of the physical rolling stock HVAC asset**:

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
```

Through this hierarchy, platform users can inspect equipment condition and maintenance lifecycles at any level of granularity: whole fleet, specific train routes, coaches, or individual rooftop HVAC units.

---

## 5. Physics-Informed HVAC Simulation & Degradation Engine

The prototype utilizes physics-informed simulation to generate realistic railway operating data.

### 5.1 Thermodynamic Equations
The simulation models heat transfer and refrigeration physics every second:
1. **Cabin Heat Load ($Q_{\text{load}}$)**:
   $$Q_{\text{load}} = Q_{\text{ambient}} + Q_{\text{passengers}} + Q_{\text{doors}} + Q_{\text{equipment}}$$
   where $Q_{\text{ambient}} = (T_{\text{ambient}} - 24^\circ\text{C}) \times 0.8$, $Q_{\text{passengers}} = N_{\text{passengers}} \times 0.12\text{ kW}$, and $Q_{\text{equipment}} = 2.5\text{ kW}$.
2. **Airflow Restriction Across Filter**:
   $$\Delta P_{\text{filter}} = \Delta P_{\text{nominal}} + (\Delta P_{\text{max}} - \Delta P_{\text{nominal}}) \times R_{\text{filter}}$$
   $$\text{Airflow} = \max\left(0.35, 1.0 - 0.65 \times \frac{\Delta P_{\text{filter}} - \Delta P_{\text{nominal}}}{\Delta P_{\text{max}} - \Delta P_{\text{nominal}}}\right)$$
3. **Electrical Power & Current**:
   $$P_{\text{electrical}} = \frac{Q_{\text{cooling}}}{\text{COP} \times \eta_{\text{motor}}} \times \left(1 + \frac{\text{CompressorWear}}{2}\right)$$
   $$I_{\text{compressor}} = \frac{P_{\text{electrical}} \times 1000}{\sqrt{3} \times V_{\text{supply}} \times \text{PF} \times \eta_{\text{motor}}}$$

### 5.2 Mechanical Aging & Wear Engine (`HVACDegradation.js`)
Operating hours accumulate under load stress:
$$\text{Stress} = 0.4 + \text{CompressorLoad}$$
$$\text{Wear}_{\text{compressor}}(t + \Delta t) = \text{Wear}_{\text{compressor}}(t) + \left(\frac{1}{\text{DesignLifeHours}}\right) \times \text{Stress} \times \Delta t$$
$$\eta_{\text{compressor}} = \max(0.15, 1.0 - \text{Wear}_{\text{compressor}})$$
$$\eta_{\text{motor}} = \max(0.50, 1.0 - \text{Wear}_{\text{motor}} \times 0.5)$$

> **Data Authenticity Disclaimer**: The current prototype uses physics-based simulated telemetry to reproduce realistic degradation curves. The architecture is engineered with standard JSON REST/Kafka schemas so that simulated telemetry can be directly replaced or augmented by physical IoT edge gateways deployed on rolling stock.

---

## 6. Telemetry Ingestion & Streaming Pipeline

Ventrix supports two parallel streaming mechanisms:

1. **Direct HTTP Streamer (`stream_direct.js`)**:
   - Lightweight, standalone Node.js process.
   - Advances simulated time and POSTs telemetry directly to `http://localhost:5000/api/telemetry` every 3 seconds with header `X-Telemetry-Key`.
2. **Kafka Event Pipeline (`KafkaConsumer.js`)**:
   - Decoupled enterprise architecture.
   - Simulation publishes to topic `simulation.telemetry`. A consumer bridge reads messages and forwards them to the Express API.

### Ingestion Validation:
The server validates all readings against strict physical plausibility bounds:
- Supply Air Temp: $-30^\circ\text{C}$ to $80^\circ\text{C}$
- Refrigerant Pressure: $0.0\text{ bar}$ to $40.0\text{ bar}$
- Compressor Current: $0.0\text{ A}$ to $120.0\text{ A}$
- Filter DP: $0\text{ Pa}$ to $5,000\text{ Pa}$
- Operating Hours: $0\text{ h}$ to $500,000\text{ h}$

---

## 7. Machine Learning & RUL Prediction Deep Dive

### 7.1 Run-to-Failure Simulation Methodology
Training data is generated using a **run-to-failure simulation methodology inspired by standard predictive maintenance benchmarks**:
- 60 to 80 simulated HVAC units are run across varied lifespans ($15,000\text{ h} - 25,000\text{ h}$) until health collapses to effective failure (health score $\le 6$).
- **Ground-Truth RUL Labeling**:
  $$\text{RUL}_{\text{ground\_truth}}(t) = t_{\text{failure}} - t$$
- **Academic Distinction**: Ground-truth labels are only calculated during training. The live operational model **never** receives ground-truth RUL; it must infer RUL purely from instantaneous and rolling sensor features.

### 7.2 Model Architecture & Feature Engineering
- **Algorithm**: `RandomForestRegressor` (`n_estimators=150`, `max_depth=16`, `min_samples_leaf=5`, `random_state=42`).
- **Feature Set**:
  1. *Raw Sensors*: Operating hours, ambient temp, humidity, passenger count, speed, voltage, supply air temp, refrigerant pressure, compressor current, filter DP, power, wear metrics.
  2. *20-Cycle Rolling Statistics*: Rolling mean ($\mu_{20}$), rolling standard deviation ($\sigma_{20}$), and rate of change ($\Delta x$) for supply air temperature, compressor current, filter DP, and electrical power.
  3. *Thermodynamic Ratios*: Power efficiency ratio ($\frac{\text{Power}}{\text{CoolingCapacity} + 0.1}$) and health derivative trend.
  4. *Categorical Features*: One-hot encoded `asset_state` and `health_status`.
- **Validation**: Evaluated using a **unit-level grouped split** (80% training units, 20% unseen test units). This ensures the model is validated against equipment it has never encountered during training.

### 7.3 Unified RUL & Risk Classification Thresholds
The entire platform is unified under the following standard risk thresholds:

| Risk Category | RUL Threshold (Hours) | Health Score Equivalent | Required Action |
|---|---|---|---|
| **CRITICAL** | $< 150\text{ hours}$ | $< 40\%$ | Immediate depot inspection; urgent dispatch |
| **HIGH** | $150\text{ h} - 500\text{ hours}$ | $40\% - 59.9\%$ | Service turnaround required within 72 hours |
| **MEDIUM** | $500\text{ h} - 1000\text{ hours}$ | $60\% - 79.9\%$ | Routine depot monitoring; filter & coil inspection |
| **NOMINAL** | $\ge 1000\text{ hours}$ | $\ge 80\%$ | Optimal performance; standard scheduled cycle |

### 7.4 Model Explainability
Rather than returning an opaque RUL number, `aiPredictionService.js` derives explainable diagnostic drivers:
- **Filter DP Elevation**: Flags filter restriction above nominal thresholds (e.g. $> 250\text{ Pa}$).
- **Compressor Current Overdraw**: Identifies elevated current due to mechanical bearing wear.
- **Thermal Lag**: Detects supply air temperature rising above setpoint.
- **Refrigerant Drop**: Detects subcooling pressure loss indicating micro-leaks.

---

## 8. Complete Maintenance Management Lifecycle

### 8.1 Maintenance Decision Flow
```
Telemetry Anomaly / Alert / Low RUL
               ↓
    Engineer Evaluates Urgency
               ↓
    Creates Work Order (Priority, Type, Duration)
               ↓
    Assigns Field Technician
```
*AI does not autonomously create work orders; AI provides predictive intelligence to support the Engineer's operational decision.*

### 8.2 Work Order State Machine

```
              ┌─────────┐
              │  OPEN   │
              └────┬────┘
                   │ Assign Technician
                   ▼
              ┌─────────┐
              │ASSIGNED │
              └────┬────┘
                   │ Technician Accepts
                   ▼
              ┌─────────┐
              │ACCEPTED │
              └────┬────┘
                   │ Start Physical Work
                   ▼
        ┌───────────────────┐
        │    IN_PROGRESS    │
        └───────┬─────┬─────┘
   Parts Needed │     │ No Parts Needed
                ▼     │
      ┌──────────────────┐ │
      │WAITING_FOR_PARTS │ │
      └─────────┬────────┘ │
   Parts Issued │          │
                ▼          │
        ┌──────────────┐   │
        │ PARTS_ISSUED │   │
        └───────┬──────┘   │
                │ Work Resumes
                ▼          │
        ┌──────────────────┐
        │    COMPLETED     │◄─┘
        └───────┬──────────┘
                │ Submit Completion Report
                ▼
        ┌────────────────────┐
        │ UNDER_VERIFICATION │
        └───────┬────────────┘
                │ Engineer Signs Off
                ▼
        ┌────────────────────┐
        │      CLOSED        │
        └────────────────────┘
```

---

## 9. Service Requests Module

The **Service Requests** module bridges informal on-train observations with depot engineering:

```
Technician/Crew reports issue on Coach HVAC
                    ↓
   Service Request created (Status: OPEN)
                    ↓
       Engineer Reviews Request
        ┌───────────┴───────────┐
        │                       │
 Maintenance Required?     False Alarm / Trivial?
        │                       │
        ▼                       ▼
Create Work Order         Mark as RESOLVED / CLOSED
(Linked via work_order_id)
```

- **Database Table**: `service_requests` (`id`, `organization_id`, `asset_id`, `created_by`, `title`, `description`, `priority`, `status`, `work_order_id`, `resolved_at`).
- **Endpoints**: `GET /api/service-requests`, `POST /api/service-requests`, `PATCH /api/service-requests/:id/status`.
- **Frontend Page**: [ServiceRequestsPage.jsx](file:///c:/Users/ASUS/Documents/Projects/HVAC%20RUL/HVAC%20RUL/Ventrix/client/src/pages/dashboard/components/ServiceRequestsPage.jsx) allows submitting requests, viewing status, and escalating to maintenance work orders.

---

## 10. Spare Parts & Auditable Inventory Management

### 10.1 Role-Segregated Part Requisition Flow
Technicians cannot arbitrarily deduct warehouse stock. They must submit requisitions:
1. **Technician Requisitions Part**: Selects part code, quantity, urgency, and associated work order ID (`part_requests` status: `PENDING`).
2. **Engineer Approves Requisition**: Evaluates request feasibility. Upon approval, status changes to `APPROVED`.
3. **Warehouse / Admin Issues Stock**: Physically dispenses parts. Status becomes `ISSUED`, stock in `inventory` is decremented, and an auditable entry in `stock_transactions` is created.

### 10.2 Auditable Stock Transactions (`stock_transactions`)
Every inventory adjustment is permanently audited:
- `transaction_type`: `RECEIVED` (from vendor), `ISSUED` (for work order), `DAMAGED` (scrapped), `AUDIT_CORRECTION` (cycle count).
- Records `user_id`, `part_id`, signed `quantity`, `reference_type` (`work_order`, `purchase_order`, `manual`), and `reason`.

---

## 11. Alerts & Health Management

Ventrix categorizes alerts by source:
1. **Rule-Based Sensor Alerts (`source: 'rule'`)**: Triggered immediately when sensor readings cross physical safety bounds (e.g. Refrigerant pressure $< 4.0\text{ bar}$, Filter $\Delta P > 300\text{ Pa}$, Temperature $> 26^\circ\text{C}$).
2. **AI Predictive Alerts (`source: 'ai'`)**: Generated when predicted RUL drops below $150\text{ hours}$ even before physical sensor thresholds trigger alarms.

### Alert Lifecycle:
- **Acknowledgement**: The engineer acknowledges the alert (`is_acknowledged = TRUE`, `acknowledged_by`, `acknowledged_at`), signifying investigation has begun.
- **Escalation / Resolution**: The engineer either resolves the alert directly or escalates it to a Work Order (`work_order_id` linked).

---

## 12. Security & RBAC Architecture

1. **Authentication**: JWT (JSON Web Tokens) with HMAC-SHA256 signatures; passwords hashed using `bcrypt` (10 salt rounds).
2. **Dynamic Database RBAC**:
   - Permissions stored in table `permissions` and mapped to roles in `role_permissions`.
   - Backend middleware (`requirePermission`) queries the database dynamically with fallback defaults.
3. **Service Ingestion Security**:
   - Streaming endpoint (`POST /api/telemetry`) is protected via `X-Telemetry-Key` validation, isolated from user session cookies.
4. **Data Protection**:
   - Parameterized SQL queries (`pg` pool) across all endpoints preventing SQL injection.
   - Input sanitization and physical numerical bounding on telemetry ingestion.

---

## 13. Complete Relational Database Architecture

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
  │  wo_parts    │        │part_requests│          │    users    │──┘
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

## 14. Domain Model Class Structure

```
+---------------------------------------------------------------------------------+
|                                 DOMIAN MODEL                                    |
+---------------------------------------------------------------------------------+
| User              : id, name, email, role_id, is_active, last_login             |
| Role              : id, name, description                                       |
| Permission        : id, permission_key, label, category, description            |
| Organization      : id, name, code, contact_email                               |
| Project           : id, project_code, name, status                              |
| Train             : id, train_number, train_name, status                        |
| Coach             : id, coach_number, coach_type, status                        |
| HVACAsset         : id, asset_code, name, status, install_date, health_score    |
| Telemetry         : id, asset_id, recorded_at, temp, pressure, current, filterDP|
| RULPrediction     : id, asset_id, rul_hours, risk_level, model_version          |
| Alert             : id, asset_id, level, title, source, is_resolved, is_ack     |
| ServiceRequest    : id, asset_id, created_by, title, priority, status, wo_id    |
| MaintenanceSched  : id, asset_id, scheduled_date, maintenance_type, template    |
| WorkOrder         : id, asset_id, title, priority, status, assigned_to, report  |
| Part              : id, part_code, name, unit, minimum_stock, unit_price        |
| Inventory         : id, part_id, location, quantity                             |
| PartRequest       : id, part_id, work_order_id, requested_by, quantity, status  |
| StockTransaction  : id, part_id, transaction_type, quantity, user_id, reason    |
+---------------------------------------------------------------------------------+
```

---

## 15. REST API Architecture

| Endpoint Group | Method & Route | Access Level | Description |
|---|---|---|---|
| **Auth** | `POST /api/auth/login` | Public | Authenticates credentials, returns JWT token & role permissions |
| **Telemetry** | `POST /api/telemetry` | Service Key | Ingestion endpoint for live sensor stream packets |
| | `GET /api/telemetry/latest` | `telemetry.view` | Latest reading per active HVAC asset |
| | `GET /api/telemetry/:code/history` | `telemetry.view` | Time-series historical data for Recharts waveforms |
| | `GET /api/telemetry/predictions/latest` | `telemetry.view` | Newest AI RUL predictions with explainability drivers |
| | `POST /api/telemetry/predictions/run` | `telemetry.view` | Triggers on-demand Random Forest inference pipeline |
| **Assets** | `GET /api/assets` | `assets.view` | Retrieves HVAC asset registry with filterable specs |
| | `POST /api/assets` | `assets.manage` | Registers new HVAC unit with coach/train linkage |
| | `PUT /api/assets/:code` | `assets.manage` | Updates asset specification or operational status |
| **Maintenance** | `GET /api/maintenance/work-orders` | `maintenance.view` | Lists work orders with status and technician filters |
| | `POST /api/maintenance/work-orders` | `maintenance.manage`| Creates & dispatches work orders to technicians |
| | `PATCH /api/maintenance/work-orders/:id/status` | `maintenance.manage`| Updates ticket status (e.g., ACCEPTED, IN_PROGRESS) |
| | `POST /api/maintenance/work-orders/:id/report` | `maintenance.manage`| Submits technician completion report & sensor findings |
| | `POST /api/maintenance/work-orders/:id/verify` | `maintenance.verify`| Engineer verification & official ticket closure |
| **Service Requests** | `GET /api/service-requests` | `service_requests.view` | Retrieves service requests |
| | `POST /api/service-requests` | `service_requests.create` | Submits field observation ticket |
| | `PATCH /api/service-requests/:id/status` | `service_requests.manage` | Updates status or links escalated work order |
| **Inventory** | `GET /api/inventory/parts` | `inventory.view` | Retrieves spare parts catalog and stock levels |
| | `POST /api/inventory/adjust` | `inventory.manage` | Auditable stock adjustment (RECEIVED, DAMAGED) |
| | `POST /api/inventory/requests` | `parts.request` | Submits spare part requisition for work order |
| | `PATCH /api/inventory/requests/:id/approve` | `inventory.manage` | Engineer/Admin approves part requisition |
| | `PATCH /api/inventory/requests/:id/issue` | `parts.issue` | Dispenses stock from warehouse & records transaction |
| **Users & Roles** | `GET /api/users` | `users.manage` | Lists platform staff and assigned roles |
| | `POST /api/users` | `users.manage` | Creates platform user |
| | `GET /api/roles/matrix` | `settings.manage` | Retrieves role-to-permission mapping |
| | `PUT /api/roles/permissions` | `settings.manage` | Real-time toggle of RBAC permissions |

---

## 16. What Each User Sees in Their Dashboard

### 16.1 Administrator Dashboard (`admin@ventrix.com`)
- **Executive KPI Cards**: Total Fleet Assets (Nominal/Warning/Fault breakdown), Fleet Health Index %, Active Fault Alerts, Active Work Orders (Open/In Progress/Closed), Low-Stock Spare Parts.
- **Attention Notification Strip**: Real-time warning showing critical parts at or below minimum threshold with quick "Review Stock & Reorder" action.
- **Operations Pipeline**: Horizontal progress bars tracking work order distribution across Open, Assigned, In Progress, and Completed.
- **Technician Capacity Tracker**: Registered technicians, active jobs count, and completed ticket throughput.
- **Live Fleet Radar**: Real-time sensor preview cards for units `HVAC-001` through `HVAC-005` displaying status badge, health %, supply temp, and pressure.
- **Full Navigation Access**: Overview Dashboard, Live Telemetry, AI Predictions, Alerts & Anomalies, HVAC Asset Registry, Maintenance & Work Orders, Service Requests, Spare Parts & Stock, Users & Access, and Role Permissions Matrix.

### 16.2 Maintenance Engineer Dashboard (`engineer@ventrix.com`)
- **Supervisor Operational KPIs**: Pending Acceptance, Work In Progress, Awaiting Sign-Off, Units Needing Attention.
- **Engineering Verification & Sign-Off Queue**: Inspects physical technician completion reports and post-fix sensor readings; provides formal sign-off to close work orders.
- **Spare Part Requisitions Queue**: Inspects pending technician component requests; one-click "Quick Approve" authorizes warehouse stock deduction.
- **Active Fault Radar with Quick Dispatch**: Incoming anomalies with one-click "Dispatch Tech" that pre-fills work order modals with asset code, issue description, and technician assignment.
- **Navigation Access**: Overview Dashboard, Live Telemetry, AI Predictions, Alerts & Faults, HVAC Asset Registry, Maintenance & Work Orders, Service Requests, and Spare Parts & Stock. *(User provisioning and system configuration are restricted).*

### 16.3 Field Technician Dashboard (`tech@ventrix.com`)
- **Personal Job Status KPIs**: My Assigned Jobs, Pending Acceptance, In Progress, Under Verification / Closed.
- **Urgent Job Hero Card**: Spotlights highest priority ticket with 5-stage progress indicator:
  - `Accept Assignment` $\rightarrow$ `Start Physical Work` $\rightarrow$ `Request Spare Parts` $\rightarrow$ `Record Field Finding` $\rightarrow$ `Submit Completion Report`.
- **Field Finding Modal**: Input on-site measurements (temperature delta post-service, vibration level, refrigerant head pressure).
- **Completion Report Modal**: Submit summary of physical repair actions taken, handing off ticket to the Engineer.
- **Spare Part Requisition Modal**: Request components from depot warehouse with quantity, urgency, and reason.
- **Report Unscheduled Fault Modal**: Report unexpected defects found on site directly into the system.
- **Navigation Access**: My Field Dashboard, My Work Orders, Service Requests, and Spare Parts Catalog. *(Diagnostic telemetry, asset registration, and administrative controls are hidden to maintain focus on field execution).*

---

## 17. Error Handling & System Resilience

1. **Telemetry Bounds Validation**: If incoming sensor data falls outside physical plausibility ranges, the packet is rejected with HTTP 400 and validation errors logged without polluting database tables.
2. **AI Model Subprocess Resilience**: If Python executable or `rul_model.pkl` is missing, `aiPredictionService.js` catches the error and executes a physics-informed degradation heuristic so platform operations and RUL estimations are never halted.
3. **Database Transaction Rollback**: All multi-step operations (e.g. telemetry ingestion + alerts + prediction sync; or inventory stock issuance + transaction audit) run inside PostgreSQL transactions (`BEGIN ... COMMIT / ROLLBACK`). If any sub-query fails, changes are cleanly reverted.

---

## 18. Academic & Industrial Limitations

1. **Simulation-Based Telemetry**: The current prototype uses physics-based simulated telemetry rather than physical sensors mounted on operational trains.
2. **Model Validation Scope**: The Random Forest model is trained and tested on simulated degradation lifecycles; it has not yet been validated against multi-year real railway depot failure logs.
3. **Environmental Noise**: Real railway operations feature harsh ambient vibrations, dust fouling, and track shocks that require edge filtering prior to platform ingestion.
4. **Fleet Scale**: The current demonstration is configured for depot-scale rolling stock; production deployment across a national rail network would require distributed time-series databases (e.g. TimescaleDB) and Flink stream processors.

---

## 19. Future Roadmap & Production Enhancements

1. **Deep Learning Sequence Models**: Benchmark Temporal Convolutional Networks (TCN), LSTMs, and Transformers against the current Random Forest regressor for long-horizon degradation forecasting.
2. **IoT Edge Gateway Integration**: Deploy MQTT / OPC-UA edge collectors on train coaches communicating via 4G/5G rail telemetry networks.
3. **Automated Maintenance Scheduling**: Integrate integer linear programming (ILP) to optimize technician shift allocation and depot bay scheduling based on train timetables.
4. **Supply Chain Auto-Replenishment**: Automated purchase order generation when spare parts stock falls below critical thresholds.
