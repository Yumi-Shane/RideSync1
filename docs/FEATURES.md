<!-- Waynecorp -->
# Feature checklist

Status of every requirement from the RideSync feature document. All items are covered by the automated test in `tests/e2e.py` unless marked (UI).

| # | Feature | Status | Where |
|---|---------|--------|-------|
| 1 | Passenger home dashboard (upcoming trips, status, queue, vehicle availability, announcements, quick access) | Done (UI) | `app.js` → `home` |
| 2 | Schedule viewing (outbound/return, times, route, live status, schedule-change display) | Done | `trips`, `tripdetail`, `trip_edit` |
| 3 | Virtual queue (join, number, position, people ahead, leave, one active queue, boarding updates, boarded view) | Done | `join`, `leave`, `queue` |
| 4 | Vehicle availability (scheduled / on a trip / available / unavailable, delays, cancellations, driver-confirmed seats) | Done | `vehicles`, `seats` |
| 5 | Driver dashboard (assigned trips, live passenger queue, vehicle, duty status, coordinator updates) | Done (UI) | `dhome` |
| 6 | Trip status updates (boarding, departed, completed, delayed, cancelled), issue notes, vehicle problems, seat confirmation | Done | `dstatus`, `dveh`, `seats` |
| 7 | Passenger demand monitoring (queue + walk-ins, per trip, seats remaining) | Done | `demand`, `cnt` |
| 8 | Schedule management (create, edit, delay, cancel, assign driver/vehicle, seat capacity) | Done | `trip_create`, `trip_edit`, `trip_status`, `trip_cancel`, `assign` |
| 9 | Vehicle and driver availability management | Done | `fleet`, `duty`, `issue` |
| 10 | Centralized queue monitoring (counts, boarding progress, demand-exceeds-seats flag, turned-away count) | Done | `cqueue` |
| 11 | Notifications and announcements (targeted notifications with unread badge, public announcements with history) | Done | `notify()`, `alerts` |
| 12 | Accounts (register, login, 3 roles, role-restricted actions, privacy, password reset, logout) | Done | `signup`, `login`, `forgot`, `reset` |

## Known limits
- Password-reset email uses PHP `mail()`, which many free hosts block. Coordinators can set a temporary password for a user (Profile → Role and access) as a fallback.
- A vehicle has one driver at a time (assigning a driver to a vehicle replaces the previous one).
- Queue/trip data updates by polling every 15 seconds (no websockets).
