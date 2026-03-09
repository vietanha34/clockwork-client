# K8s API + Helm Chart Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Đóng gói `apps/api` thành Docker image và tạo Helm chart để deploy lên K8s nội bộ với Redis tùy chọn và Traefik IngressRoute theo domain cấu hình từ values.

**Architecture:** Giữ nguyên runtime Vercel Functions hiện có để tránh refactor nghiệp vụ. Image chạy `vercel dev` trên port 3000, phía K8s expose qua Service và Traefik `IngressRoute`. Helm chart quản lý API + optional Redis nội bộ, đồng thời hỗ trợ external Redis URL khi tắt Redis nội bộ.

**Tech Stack:** Node.js 20, pnpm workspace, Vercel CLI runtime, Docker multi-stage build, Helm v3, Traefik CRD (IngressRoute), Kubernetes Deployments/Services.

---

### Task 1: Khảo sát và khóa contract cấu hình

**Files:**
- Modify: `apps/api/.env.example`
- Modify: `README.md`
- Test: `docs/deployment.md`

**Step 1: Viết checklist biến môi trường bắt buộc cho mode K8s**
- Xác định đầy đủ env hiện tại API cần dùng khi chạy trong cluster (`REDIS_URL`, `CLOCKWORK_API_TOKEN`, `ATLASSIAN_*`, `JIRA_*`).

**Step 2: Cập nhật `.env.example` để phản ánh K8s contract**
- Giữ tương thích local nhưng thêm chú thích rõ biến nào bắt buộc trên cluster.

**Step 3: Đồng bộ nhanh README/deployment docs**
- Thêm mục "K8s + Helm (API)" với luồng giá trị `values.yaml` -> secret/env.

**Step 4: Verify nội dung doc không mâu thuẫn**
Run: `rg -n "REDIS_URL|UPSTASH_REDIS_REST_URL|JIRA_TENANT_SESSION_TOKEN|Helm|K8s" README.md docs/deployment.md apps/api/.env.example -S`
Expected: Có đủ biến, không còn chỉ dẫn mâu thuẫn.

**Step 5: Commit**
```bash
git add apps/api/.env.example README.md docs/deployment.md
git commit -m "docs: align api env contract for k8s deployment"
```

### Task 2: Tạo Dockerfile cho `apps/api`

**Files:**
- Create: `apps/api/Dockerfile`
- Create: `apps/api/.dockerignore`
- Modify: `apps/api/package.json`
- Test: `apps/api/api/health.ts`

**Step 1: Viết test smoke command (manual) trước implementation**
- Xác định command smoke chuẩn: `curl http://localhost:3000/api/health` phải trả `status=ok`.

**Step 2: Tạo `.dockerignore` tối thiểu**
- Loại trừ `node_modules`, `.turbo`, `dist`, logs, env local.

**Step 3: Tạo Dockerfile multi-stage**
- Stage build: cài dependencies workspace, build `apps/api`.
- Stage runtime: copy artifact cần thiết + `vercel` runtime deps.
- Expose `3000`, chạy `vercel dev --listen 3000 --yes`.

**Step 4: Cập nhật scripts nếu cần cho runtime container**
- Nếu cần, thêm script riêng như `start:k8s` để Docker CMD rõ ràng.

**Step 5: Verify build và chạy image**
Run: `docker build -f apps/api/Dockerfile -t clockwork-api:local .`
Expected: Build thành công.

Run: `docker run --rm -p 3000:3000 --env-file apps/api/.env.example clockwork-api:local`
Expected: Container chạy ổn (có thể báo thiếu secret thật, nhưng process không crash ngay vì missing request-time env).

Run: `curl -s http://localhost:3000/api/health`
Expected: JSON có `"status":"ok"`.

**Step 6: Commit**
```bash
git add apps/api/Dockerfile apps/api/.dockerignore apps/api/package.json
git commit -m "feat(api): add docker image for k8s runtime"
```

### Task 3: Scaffold Helm chart cho API

**Files:**
- Create: `deploy/helm/clockwork-api/Chart.yaml`
- Create: `deploy/helm/clockwork-api/values.yaml`
- Create: `deploy/helm/clockwork-api/templates/_helpers.tpl`
- Create: `deploy/helm/clockwork-api/templates/deployment.yaml`
- Create: `deploy/helm/clockwork-api/templates/service.yaml`
- Create: `deploy/helm/clockwork-api/templates/ingressroute.yaml`
- Create: `deploy/helm/clockwork-api/templates/secret.yaml`
- Create: `deploy/helm/clockwork-api/templates/configmap.yaml`

**Step 1: Viết failing render expectation**
- Xác định kỳ vọng: `helm template` phải render đủ Deployment/Service/IngressRoute khi bật Traefik.

**Step 2: Khai báo Chart metadata và values mặc định**
- Bao gồm image/service/resources/probes/env/secretEnv/traefik/redis/externalRedis.

**Step 3: Tạo helper template đặt tên chuẩn**
- Tập trung fullname, labels, selector labels để tái sử dụng.

**Step 4: Tạo Deployment API**
- Mount env từ ConfigMap + Secret.
- Probes gọi `/api/health` port 3000.
- Thiết lập `REDIS_URL` theo điều kiện redis nội bộ/external.

**Step 5: Tạo Service và IngressRoute Traefik**
- Service ClusterIP.
- IngressRoute route `Host(values.traefik.host)` + optional PathPrefix.
- Hỗ trợ entryPoints và TLS secret.

**Step 6: Verify render profile mặc định**
Run: `helm template clockwork-api deploy/helm/clockwork-api`
Expected: Có Deployment, Service; IngressRoute render khi `traefik.enabled=true`.

**Step 7: Commit**
```bash
git add deploy/helm/clockwork-api
git commit -m "feat(helm): scaffold api chart with traefik ingressroute"
```

### Task 4: Bổ sung Redis tùy chọn trong chart

**Files:**
- Modify: `deploy/helm/clockwork-api/values.yaml`
- Create: `deploy/helm/clockwork-api/templates/redis-deployment.yaml`
- Create: `deploy/helm/clockwork-api/templates/redis-service.yaml`
- Create: `deploy/helm/clockwork-api/templates/redis-secret.yaml`
- Modify: `deploy/helm/clockwork-api/templates/deployment.yaml`

**Step 1: Viết failing render case cho Redis on/off**
- Case A: `redis.enabled=true` -> có redis resources.
- Case B: `redis.enabled=false` + externalRedis.url -> không có redis resources.

**Step 2: Implement Redis template khi enabled**
- Deployment 1 replica, Service nội bộ port 6379.
- Optional auth (password secret) theo values.

**Step 3: Inject `REDIS_URL` theo mode**
- `redis.enabled=true`: tự build redis URL nội bộ.
- `redis.enabled=false`: bắt buộc `externalRedis.url`.

**Step 4: Verify render cho 2 profile**
Run: `helm template clockwork-api deploy/helm/clockwork-api --set redis.enabled=true`
Expected: Có `redis-deployment` + `redis-service`.

Run: `helm template clockwork-api deploy/helm/clockwork-api --set redis.enabled=false --set externalRedis.url=redis://user:pass@redis.example:6379`
Expected: Không có redis resources, Deployment API có env `REDIS_URL` từ external.

**Step 5: Commit**
```bash
git add deploy/helm/clockwork-api
git commit -m "feat(helm): add optional internal redis and external redis mode"
```

### Task 5: Hoàn thiện tài liệu vận hành Helm

**Files:**
- Create: `deploy/helm/clockwork-api/README.md`
- Modify: `docs/deployment.md`

**Step 1: Viết hướng dẫn install/upgrade chuẩn**
- Ví dụ `helm upgrade --install` với values file.

**Step 2: Viết cấu hình Traefik domain**
- Ví dụ domain thật theo `values.traefik.host`.

**Step 3: Viết 2 profile Redis (internal/external)**
- Cung cấp snippet values cho từng mode.

**Step 4: Verify docs command chạy được**
Run: `rg -n "helm upgrade --install|IngressRoute|traefik.host|redis.enabled|externalRedis.url" deploy/helm/clockwork-api/README.md docs/deployment.md -S`
Expected: Có đầy đủ command và biến liên quan.

**Step 5: Commit**
```bash
git add deploy/helm/clockwork-api/README.md docs/deployment.md
git commit -m "docs(helm): add k8s deployment and values guide"
```

### Task 6: Verification trước hoàn tất

**Files:**
- Test: `apps/api/Dockerfile`
- Test: `deploy/helm/clockwork-api/templates/*.yaml`

**Step 1: Chạy lint/check liên quan API và chart**
Run: `corepack pnpm --filter api type-check`
Expected: PASS.

**Step 2: Chạy Helm lint**
Run: `helm lint deploy/helm/clockwork-api`
Expected: PASS.

**Step 3: Render chart nhiều profile để bắt regression**
Run: `helm template clockwork-api deploy/helm/clockwork-api --set traefik.enabled=true --set traefik.host=api.internal.example.com`
Expected: IngressRoute đúng host.

Run: `helm template clockwork-api deploy/helm/clockwork-api --set redis.enabled=false --set externalRedis.url=redis://x:y@redis.example:6379`
Expected: Không render Redis nội bộ, API vẫn có `REDIS_URL`.

**Step 4: Smoke Docker runtime**
Run: `docker build -f apps/api/Dockerfile -t clockwork-api:local . && docker run --rm -p 3000:3000 clockwork-api:local`
Expected: Container start thành công.

**Step 5: Commit verification artifacts (nếu có)**
```bash
git add -A
git commit -m "chore: verify docker and helm deployment flow"
```
