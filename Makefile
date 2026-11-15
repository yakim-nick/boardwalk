.PHONY: coverage help install dev-backend dev-frontend migrate db-up db-down \
        test test-backend test-frontend build docker-up docker-down \
        k8s-apply k8s-delete

help:
	@echo "FlowBoard — realtime kanban board"
	@echo ""
	@echo "  make install          Install backend + frontend dependencies"
	@echo "  make dev-backend      Run backend in watch mode (requires Postgres + Redis)"
	@echo "  make dev-frontend     Run frontend dev server"
	@echo "  make migrate          Apply Prisma migrations to local DB"
	@echo "  make db-up            Start Postgres + Redis via docker compose"
	@echo "  make db-down          Stop Postgres + Redis"
	@echo "  make test             Run backend + frontend tests"
	@echo "  make test-backend     Run backend tests"
	@echo "  make coverage         Run backend tests with a coverage report"
	@echo "  make test-frontend    Run frontend tests"
	@echo "  make build            Build backend + frontend"
	@echo "  make docker-up        Build & run the full stack in Docker"
	@echo "  make docker-down      Stop the full stack"
	@echo "  make k8s-apply        Deploy manifests to a cluster (kubectl apply -k infra/k8s)"
	@echo "  make k8s-delete       Remove manifests from a cluster"

install:
	cd backend && npm install
	cd frontend && npm install

dev-backend:
	cd backend && npm run dev

dev-frontend:
	cd frontend && npm run dev

migrate:
	cd backend && npx prisma migrate deploy

db-up:
	docker compose up -d postgres redis

db-down:
	docker compose down postgres redis

test: test-backend test-frontend

test-backend:
	cd backend && npm test

coverage:
	cd backend && npm run test:coverage

test-frontend:
	cd frontend && npm test

build:
	cd backend && npm run build
	cd frontend && npm run build

docker-up:
	docker compose up --build

docker-down:
	docker compose down

k8s-apply:
	kubectl apply -k infra/k8s

k8s-delete:
	kubectl delete -k infra/k8s
