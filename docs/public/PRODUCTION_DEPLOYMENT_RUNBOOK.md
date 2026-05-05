# Production Deployment Runbook (Phase 12)

This runbook captures the production rollout process for Unified RAG Studio.

## Scope

- P12-1 Authentication and authorization (JWT bearer auth + role checks)
- P12-2 Security hardening (headers, rate limiting, env hygiene)
- P12-3 Performance optimization (gzip, horizontal scaling baseline)
- P12-4 Kubernetes production manifests
- P12-5 Final documentation pass
- P12-6 Production deployment and launch checklist

## Preconditions

- Container images are built and pushed:
  - `ghcr.io/<org>/rag-studio-api:<tag>`
  - `ghcr.io/<org>/rag-studio-web:<tag>`
- Kubernetes cluster with:
  - ingress-nginx installed
  - cert-manager or a TLS secret already provisioned
  - metrics-server installed (for HPA)
- Backing services available (managed Postgres/Redis/Qdrant/MinIO compatible endpoints)

## Configure Secrets

1. Copy `k8s/production/secret.example.yaml` to `k8s/production/secret.yaml`.
2. Replace placeholder values.
3. Set strong `SECRET_KEY` and production `AUTH_BOOTSTRAP_USERS`.
4. Apply secret:

```bash
kubectl apply -f k8s/production/secret.yaml
```

## Deploy

```bash
kubectl apply -k k8s/production
kubectl -n rag-studio-prod rollout status deploy/rag-studio-api
kubectl -n rag-studio-prod rollout status deploy/rag-studio-web
```

## Validate

```bash
kubectl -n rag-studio-prod get pods,svc,ingress,hpa
curl -f https://api.ragstudio.example.com/health
curl -f https://app.ragstudio.example.com
```

For auth validation:

1. `POST /api/auth/login` with bootstrap admin credentials.
2. Use returned bearer token in `Authorization` header.
3. Verify `GET /api/auth/me` returns principal.
4. Verify deployment write actions require admin role.

## Launch Day Checklist

- Confirm ingress TLS certificates are valid.
- Confirm alerts and dashboards are green.
- Execute smoke tests:
  - create project
  - create config
  - autopilot upload
  - evaluation run
  - deployment status fetch
- Announce release with image tags and rollback command.

## Rollback

```bash
kubectl -n rag-studio-prod rollout undo deploy/rag-studio-api
kubectl -n rag-studio-prod rollout undo deploy/rag-studio-web
```

If needed, roll back ingress/config changes by re-applying a previous Git tag manifest set.
