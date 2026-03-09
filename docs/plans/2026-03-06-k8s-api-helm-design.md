# K8s API Helm Design (Clockwork API)

## Bối cảnh
`apps/api` hiện là Vercel Functions (`api/**/*.ts`) và chạy local qua `vercel dev --listen 3000`. Repo chưa có Dockerfile và Helm chart cho phần API.

## Mục tiêu
- Đóng gói Docker cho `apps/api` để chạy trên K8s nội bộ.
- Tạo Helm chart deploy API.
- Redis là tùy chọn qua `values.yaml` (`redis.enabled=true/false`).
- Ingress dùng Traefik `IngressRoute`, match theo domain trong values.

## 3 phương án

### Phương án A (Khuyến nghị): Giữ runtime Vercel trong container
- Cách làm: Build TypeScript trước, chạy `vercel dev --listen 3000 --yes` trong container.
- Ưu điểm:
  - Không phải refactor toàn bộ API routes.
  - Triển khai nhanh, rủi ro regression thấp.
  - Tương thích 1:1 với cấu trúc route hiện tại.
- Nhược điểm:
  - Runtime production kiểu "dev server" của Vercel không tối ưu bằng server framework thuần.

### Phương án B: Refactor sang Express/Fastify rồi containerize
- Cách làm: gom route vào HTTP server chuẩn Node.
- Ưu điểm:
  - Runtime production rõ ràng, observability tốt hơn.
- Nhược điểm:
  - Scope lớn, dễ phát sinh bug hành vi do đổi framework/router.

### Phương án C: Dùng adapter serverless-to-http
- Cách làm: thêm lớp adapter để map Vercel handler vào server HTTP.
- Ưu điểm:
  - Ít đổi logic hơn refactor full.
- Nhược điểm:
  - Thêm abstraction phức tạp, khó debug.

## Thiết kế được chọn
Chọn **Phương án A** để đáp ứng nhanh nhu cầu triển khai nội bộ, giữ thay đổi nhỏ nhất cho code API hiện hữu.

## Kiến trúc triển khai
- Docker image cho `apps/api`:
  - Multi-stage build (`node:20-alpine`).
  - Cài dependencies bằng `pnpm` từ root workspace.
  - Build `apps/api` (TypeScript compile).
  - Runtime command: `vercel dev --listen 3000 --yes`.
- Helm chart (`deploy/helm/clockwork-api`):
  - `Deployment` cho API.
  - `Service` type `ClusterIP` port 80 -> targetPort 3000.
  - `IngressRoute` (Traefik) với `Host(
<domain>)` lấy từ values.
  - Optional Redis:
    - `redis.enabled=true`: tạo Redis Deployment + Service nội bộ.
    - `redis.enabled=false`: dùng `externalRedis.url`.

## Contract values chính
- `image.repository`, `image.tag`, `image.pullPolicy`.
- `service.port`, `service.targetPort`.
- `env` + `secretEnv` cho biến môi trường API.
- `redis.enabled`, `redis.image`, `redis.service.port`, `redis.auth.enabled/password`.
- `externalRedis.url` khi không bật Redis nội bộ.
- `traefik.enabled`, `traefik.entryPoints`, `traefik.tls.enabled`, `traefik.tls.secretName`, `traefik.host`, `traefik.pathPrefix`.

## Data flow runtime
1. Client gọi domain cấu hình (Traefik).
2. Traefik IngressRoute route về service API.
3. API xử lý route hiện hữu (`/api/*`).
4. API kết nối Redis:
   - nội bộ qua service `release-name-redis` khi `redis.enabled=true`, hoặc
   - external URL khi `redis.enabled=false`.

## Error handling và vận hành
- Readiness/Liveness dùng `/api/health`.
- Không inject secret trực tiếp vào values commit; dùng `kubectl create secret` hoặc ExternalSecret.
- Nếu `redis.enabled=false` mà thiếu `externalRedis.url`, chart fail bằng `required` template.

## Test/validation
- Docker:
  - Build image thành công.
  - Chạy local `docker run` và `curl /api/health` trả `status=ok`.
- Helm:
  - `helm lint` pass.
  - `helm template` pass với:
    - profile Redis on.
    - profile Redis off + externalRedis.url.
- K8s smoke:
  - Pod API ready.
  - IngressRoute được Traefik nhận.
  - Call domain `/api/health` thành công.
