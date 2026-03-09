# clockwork-api Helm Chart

Helm chart deploy `apps/api` lên Kubernetes với:
- API Deployment + Service
- Traefik `IngressRoute` route theo domain từ values
- Redis nội bộ tùy chọn (bật/tắt)

## 1. Yêu cầu

- Kubernetes cluster có Traefik CRD `IngressRoute` (`traefik.io/v1alpha1`)
- Helm v3
- Docker image cho API đã được build/push

## 2. Cấu trúc values quan trọng

- `image.repository`, `image.tag`: image API
- `traefik.host`: domain route cho API
- `traefik.entryPoints`: entryPoints của Traefik (ví dụ `web`, `websecure`)
- `traefik.tls.enabled`, `traefik.tls.secretName`: bật TLS nếu cần
- `redis.enabled`: bật Redis nội bộ
- `externalRedis.url`: Redis URL khi tắt Redis nội bộ
- `env`: non-secret env vars
- `secretEnv`: secret env vars

## 3. Cài đặt nhanh

```bash
helm upgrade --install clockwork-api deploy/helm/clockwork-api \
  --namespace clockwork --create-namespace \
  --set image.repository=ghcr.io/your-org/clockwork-api \
  --set image.tag=latest \
  --set traefik.host=api.internal.example.com
```

## 4. Ví dụ values

### 4.1 Redis nội bộ (mặc định)

```yaml
image:
  repository: ghcr.io/your-org/clockwork-api
  tag: latest

traefik:
  enabled: true
  host: api.internal.example.com
  entryPoints:
    - web

redis:
  enabled: true
  auth:
    enabled: false

secretEnv:
  CLOCKWORK_API_TOKEN: "***"
  ATLASSIAN_EMAIL: "user@example.com"
  ATLASSIAN_API_TOKEN: "***"
  JIRA_DOMAIN: "your-org.atlassian.net"
  JIRA_TENANT_SESSION_TOKEN: "***"
  JIRA_CLOUD_ID: "***"
  JIRA_WORKSPACE_ID: "***"
```

### 4.2 Redis external

```yaml
redis:
  enabled: false

externalRedis:
  url: "redis://default:password@redis.example:6379"

traefik:
  enabled: true
  host: api.internal.example.com
```

## 5. Verify sau deploy

```bash
kubectl -n clockwork get pods,svc,ingressroute
curl -s https://api.internal.example.com/api/health
```

Expected response:

```json
{"status":"ok","service":"clockwork-menubar-api","timestamp":"..."}
```
