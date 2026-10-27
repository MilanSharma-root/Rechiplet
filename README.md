# ReChiplet
**Multi-Product Chiplet Lifecycle Optimizer** — portfolio-wide architecture decision support.

## What the demo does
1. Loads a reusable chiplet design inventory and a portfolio of product requirements.
2. Runs the NSGA-II search for every configured product.
3. Builds three comparable portfolio strategies: **Lowest Cost**, **Balanced**, and **Highest Performance**.
4. Shows each product's selected chiplet combination, estimated BOM cost, power, area, performance and feasibility.
5. Highlights chiplet design assets that appear in multiple product architectures.

## Stack
React + Vite + TypeScript + Tailwind + Plotly.js; FastAPI + SQLAlchemy + Alembic; DEAP NSGA-II; SQLite.

## Windows setup
Open PowerShell in the repository folder and run:

```powershell
.\start.bat
```

Frontend: http://localhost:5173  
API docs: http://127.0.0.1:8000/docs

Requires Python 3.11+ and Node.js. The launcher creates a virtual environment, installs dependencies, runs Alembic migrations, seeds sample data, and starts both servers.

## Demo workflow
- **Chiplet Library:** inspect chiplet specifications and interfaces.
- **Product Portfolio:** inspect each product's requirements. The optimization action always runs for all configured products.
- **Portfolio Optimization:** run or rerun the full portfolio, switch between the three strategies, compare product architectures, and inspect shared chiplet designs.
- API endpoint: `POST /api/optimize/portfolio`.

## Important modelling limits
The included chiplet and product records are synthetic demonstration data. Cost, performance, power and area are simplified additive estimates; interface compatibility is a basic same-interface screen. The prototype does not yet model physical thermal coupling, interconnect bandwidth, packaging, die yield, NRE amortization or production validation. Results are for demonstrating the workflow, not fabrication sign-off or measured silicon claims.
