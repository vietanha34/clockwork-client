# Tài liệu: Quy trình Quản lý Thời gian Thống nhất với Clockwork Pro
**Phiên bản:** 1.0 | **Ngày:** 2026-02-24 | **Đối tượng:** Team Lead & Kỹ thuật

---

## 1. Bối cảnh & Vấn đề

### 1.1 Tình trạng hiện tại

Hiện tại mỗi bộ phận đang áp dụng một phương pháp theo dõi thời gian khác nhau:

| Role | Phương pháp hiện tại | Vấn đề |
|------|----------------------|--------|
| Developer | Log theo task point (story point) | Không phản ánh thời gian thực, không phân biệt được project |
| QA/Tester | Log thủ công tỷ trọng phần trăm theo dự án | Không gắn với Jira issue cụ thể, dễ sai số |
| PM | Không log | Không có dữ liệu, không tính được cost |
| DevOps | Log theo trường Project, có worklog | Chuẩn nhất nhưng cô lập, thiếu nhất quán với team |
| BA | Không rõ ràng | Thiếu dữ liệu |

**Hệ quả:** Khi cần thống kê chi phí nhân sự theo dự án, phải tổng hợp thủ công từ nhiều nguồn dữ liệu không đồng nhất — tốn thời gian, dễ sai và không có giá trị thực tiễn cho quyết định kinh doanh.

### 1.2 Mục tiêu

- **Thống nhất một đơn vị đo lường:** Mọi thời gian làm việc đều được ghi nhận qua **Worklog Item trên Jira**, sử dụng Clockwork Pro.
- **Trường bắt buộc `Project`:** Mỗi worklog phải gắn với một Project cụ thể để phân tích tỷ trọng chi phí.
- **Tự động hóa tối đa:** Giảm ma sát cho team thông qua tool desktop, AI skills và auto-agent.
- **Dữ liệu đủ và chính xác:** Đây là KPI quan trọng nhất — không cần 100% tự động nếu dữ liệu không chính xác.

---

## 2. Phương pháp: Unified Worklog System

### 2.1 Nguyên tắc cốt lõi

> **"Mọi thời gian làm việc trong giờ hành chính phải có worklog tương ứng trên Jira."**

1. **Đơn vị chuẩn:** Clockwork Pro Worklog — tính bằng giờ/phút thực tế.
2. **Không còn story point = giờ làm việc:** Story point vẫn dùng cho planning/velocity, nhưng cost tracking dùng worklog thực tế.
3. **Mọi loại công việc đều log được:** Kể cả meeting, training, nghỉ phép — xem phần xử lý edge case.
4. **Project là trường bắt buộc:** Không có Project = worklog không hợp lệ.

### 2.2 Cấu trúc dữ liệu

```
Worklog Entry
├── Jira Issue Key (bắt buộc)        # VD: PROJ-123, MEET-001
├── Project (Clockwork field, bắt buộc) # VD: Alpha, Internal, Training
├── Thời gian bắt đầu (auto từ timer)
├── Thời gian kết thúc (auto từ timer)
├── Thời lượng (giờ thực tế)
└── Ghi chú (tùy chọn, AI có thể gợi ý)
```

### 2.3 Workflow chuẩn hàng ngày

```
9:00 Sáng — Mở Clockwork Menubar
     ↓
Xem danh sách task hôm nay (từ Jira board)
     ↓
Chọn task → Start Timer
     ↓
Làm việc... (timer chạy ngầm trên menu bar)
     ↓
Chuyển task hoặc họp → Stop Timer / Switch Timer
     ↓
Cuối ngày: Review worklog summary trên app
     ↓
Nếu thiếu → AI gợi ý bổ sung dựa trên calendar/activity
     ↓
Xác nhận và submit
```

---

## 3. Workflow theo Role

### 3.1 Developer

| Bước | Hành động | Tool |
|------|-----------|------|
| Sáng | Xem sprint board, chọn task đang làm | Jira / Clockwork Menubar |
| Bắt đầu task | Start timer từ Clockwork Menubar | Desktop App |
| Chuyển task | Stop → Start task mới (1 click) | Desktop App |
| Họp | Stop task hiện tại, start timer MEET task | Desktop App |
| Cuối ngày | Xem daily summary, bổ sung nếu thiếu | Desktop App / AI |
| Cuối sprint | AI review: có task nào chưa log? | Auto-agent |

**Lưu ý cho Dev:**
- Không cần ước tính — chỉ cần bấm start/stop theo thực tế.
- Nếu quên start timer → AI skill có thể gợi ý worklog dựa trên Git commit time và Jira activity.

### 3.2 QA / Tester

Tương tự Dev, nhưng task thường là test case execution, bug verification:

- Tạo task kiểu: `[TEST] Login flow - regression` gắn vào sprint.
- Log theo session test thực tế, không theo tỷ trọng ước đoán.
- Defect triage / review cũng log vào task cụ thể.

### 3.3 BA (Business Analyst)

BA thường làm nhiều loại công việc không có task rõ ràng. Giải pháp:

- Tạo task template trên Jira cho các hoạt động lặp lại:
  - `[BA] Requirement gathering - <Project>`
  - `[BA] Wireframe review - <Project>`
  - `[BA] Stakeholder meeting - <Project>`
- AI skill hỗ trợ tạo nhanh task + log trong 30 giây.

### 3.4 PM (Project Manager)

PM thường không log vì công việc trải rộng nhiều dự án. Giải pháp:

- Tạo recurring tasks theo sprint:
  - `[PM] Sprint planning - <Project>` → log 2h/sprint
  - `[PM] Status report - <Project>` → log thực tế
  - `[PM] Stakeholder meeting - <Project>`
- Auto-agent đọc Google Calendar của PM, tự gợi ý log theo meeting type.
- Mục tiêu: PM log 70% thời gian qua automation, 30% manual.

### 3.5 DevOps

DevOps đã có habit log tốt nhất. Chuẩn hóa lại:

- Đảm bảo tất cả task đều có trường `Project`.
- On-call / incident response: có task `[OPS] Incident - <tên>`, log thời gian xử lý thực tế.
- Infra maintenance: tạo recurring task theo tháng/quý.

---

## 4. Xử lý các Trường hợp Đặc biệt (Edge Cases)

### 4.1 Các loại Họp (Meetings)

Meetings chiếm 10-30% thời gian làm việc của hầu hết team members và thường bị bỏ qua hoàn toàn trong worklog.

#### Giải pháp: Dedicated Meeting Tasks per Project

**Cấu trúc Jira:**
```
Project: MEET (hoặc INTERNAL)
├── MEET-001: Daily Stand-up - <Team>           (recurring, ~15min/day)
├── MEET-002: Sprint Planning - <Project>       (recurring, 2h/sprint)
├── MEET-003: Sprint Review - <Project>         (recurring, 1h/sprint)
├── MEET-004: Sprint Retro - <Team>             (recurring, 1h/sprint)
├── MEET-005: 1:1 Meeting - <Manager>           (recurring)
└── MEET-XXX: Ad-hoc Meeting - <Topic>          (tạo khi cần)
```

**Quy trình:**
1. Admin/Scrum Master tạo recurring meeting tasks đầu mỗi sprint.
2. Google Calendar Integration (Phase 3): Agent tự tạo Jira task từ calendar event.
3. Team member log time vào meeting task tương ứng.

**Phân loại Meeting theo Project:**
- Meeting về Alpha project → Project field = "Alpha"
- Internal team meeting → Project field = "Internal"
- Cross-project meeting → Log vào project chiếm đa số nội dung

### 4.2 Hoạt động Ngoại khóa (Team Building, Company Events)

| Hoạt động | Xử lý đề xuất | Project |
|-----------|---------------|---------|
| Team building | Jira task: `[HR] Team building - Q1/2026` | Internal |
| Company trip | Jira task: `[HR] Company outing - <date>` | Internal |
| External training | Jira task: `[TRAIN] <Tên khóa học>` | Training |
| Internal training | Jira task: `[TRAIN] <Tên buổi>` | Training |
| Onboarding mới | Jira task: `[HR] Onboarding - <Tên nhân viên>` | Internal |

**Nguyên tắc:** Mọi hoạt động chiếm > 30 phút trong giờ làm việc đều phải có worklog, dù là nội dung không trực tiếp liên quan đến sản phẩm.

### 4.3 Nghỉ phép / Sick Leave

Nghỉ phép **không log worklog** — đây không phải thời gian làm việc. Tuy nhiên, cần xử lý để agent không gửi reminder sai.

**Giải pháp: Google Calendar as Source of Truth cho Leave**

```
Google Calendar (out-of-office event)
         ↓
Calendar Agent đọc mỗi ngày
         ↓
Nếu ngày đó có "Out of office" / "Nghỉ phép" / "Sick" event
         ↓
Đánh dấu là "Không cần worklog ngày này"
         ↓
Bỏ qua reminder và reporting cho ngày đó
```

**Yêu cầu nhỏ với team:** Đặt Google Calendar event "Out of office" khi nghỉ — đây là việc họ thường đã làm.

### 4.4 Công việc Admin / Email / Tài liệu

Những công việc không gắn với task cụ thể nhưng vẫn là giờ làm việc:

| Loại | Xử lý |
|------|-------|
| Email / Slack review | Log vào task liên quan gần nhất (VD: đang trong sprint X → log vào task sprint) |
| Viết tài liệu kỹ thuật | Tạo task: `[DOCS] <Tên tài liệu>` |
| Code review | Log vào task được review, hoặc task `[REVIEW] Sprint N code review` |
| Research / Spike | Tạo Spike task: `[SPIKE] Research <topic>` |
| Admin / HR paperwork | Task `[ADMIN] <mô tả>`, Project = Internal |

### 4.5 Multi-project trong cùng một ngày

Khi làm nhiều project trong ngày, Clockwork Menubar hỗ trợ switch timer nhanh:

```
08:30 → Start [ALPHA-123] Build login feature   (Project: Alpha)
10:00 → Stop, Start [BETA-456] Fix payment bug   (Project: Beta)
11:00 → Stop, Start [MEET-001] Daily standup     (Project: Internal)
11:15 → Stop, Start [ALPHA-123] Continue login   (Project: Alpha)
...
```

App tự động tính tổng theo project vào cuối ngày.

---

## 5. Clockwork Menubar — Desktop Tool

### 5.1 Giới thiệu

Clockwork Menubar là ứng dụng desktop native (macOS menu bar, Windows/Linux system tray) được xây dựng để giảm ma sát tối đa trong việc log worklog.

**Vấn đề nó giải quyết:**
- Không cần mở Jira để bắt đầu/dừng timer.
- Hiển thị thời gian đang chạy ngay trên thanh menu bar — luôn nhìn thấy.
- Tóm tắt worklog ngày hiện tại trong 1 click.
- Tìm kiếm Jira issue ngay trong app (không cần chuyển sang browser).

### 5.2 Cách sử dụng cơ bản

```
Setup (1 lần):
  1. Tải app về, cài đặt
  2. Nhập Jira email
  3. Nhập Clockwork API token (lấy từ Clockwork settings)

Hàng ngày:
  1. Icon trên menu bar hiển thị "⏱ 02:34" nếu đang có timer chạy
  2. Click icon → thấy timer hiện tại + daily summary
  3. Stop timer → Start timer mới → chọn issue từ search box
  4. Cuối ngày: xem tổng giờ theo project
```

### 5.3 Yêu cầu hệ thống

- macOS 12+, Windows 10+, Ubuntu 20.04+
- Jira account với Clockwork Pro plugin
- Clockwork API token (personal, miễn phí)

---

## 6. AI Layer — Tự động hóa và Hỗ trợ

### 6.1 AI Skills (On-demand)

Bộ skills AI được gọi khi cần, tích hợp trong IDE hoặc qua CLI:

#### Skill 1: Quick Worklog Logger
```
Mô tả: Thêm worklog nhanh vào Jira issue
Trigger: Dev nhận ra quên log giờ
Quy trình:
  1. AI hỏi: "Issue nào? Thời gian bao nhiêu? Khoảng thời gian nào?"
  2. AI tạo worklog qua Clockwork API
  3. Confirm ngay trong terminal/IDE

Ví dụ:
  User: "log 2h sáng nay vào ALPHA-123"
  AI: "Đã log 2h (09:00-11:00) vào ALPHA-123. Project: Alpha. OK?"
```

#### Skill 2: Task Creator + Worklog
```
Mô tả: Tạo Jira task mới và log giờ ngay lập tức
Use case: Công việc không có task sẵn (ad-hoc meeting, research...)
Quy trình:
  1. AI nhận mô tả ngắn của công việc
  2. Tạo Jira issue với template phù hợp
  3. Log worklog vào issue vừa tạo

Ví dụ:
  User: "tôi vừa review PR cho beta-payment 45 phút"
  AI: Tạo [REVIEW] PR review: beta-payment → log 45min → confirm
```

#### Skill 3: Daily Worklog Filler (khi thiếu giờ)
```
Mô tả: Phân tích ngày hôm nay, tìm khoảng thời gian chưa log, gợi ý
Nguồn dữ liệu:
  - Git commit history (gợi ý từ commit message)
  - Jira issue activity (comments, transitions)
  - Google Calendar events
  - Clockwork existing worklogs

Output: "Bạn có 1.5h chưa log vào khoảng 14:00-15:30. Hôm nay bạn có
         meeting 'Product review' trên calendar. Muốn log vào MEET-003?"
```

### 6.2 Auto-Agent — Monitoring & Reminders

Auto-agent chạy tự động theo lịch, không cần can thiệp thủ công:

#### Reminder Agent (Hàng ngày, 17:00)
```
Trigger: Cuối ngày làm việc (17:00-18:00)
Logic:
  1. Lấy danh sách team members
  2. Với mỗi người:
     a. Kiểm tra Google Calendar → có nghỉ phép không? → skip
     b. Tính tổng giờ đã log hôm nay
     c. Nếu < 6h (ngưỡng cấu hình) → gửi reminder
  3. Reminder qua Slack/Email:
     "Hey @user, hôm nay bạn mới log 3.5h / 8h.
      Còn thiếu khoảng 4.5h. Dùng /worklog để bổ sung nhé!"

Cấu hình:
  - Ngưỡng giờ tối thiểu: 6h (có thể điều chỉnh)
  - Channel: Slack DM (không spam public channel)
  - Timezone per user
```

#### Weekly Review Agent (Thứ Sáu, 16:00)
```
Trigger: Cuối tuần
Logic:
  1. Tính tổng giờ cả tuần per user
  2. Tính tỷ trọng theo project
  3. Identify outliers: ai log < 30h/tuần?
  4. Gửi summary cho Team Lead:
     "Tuần này:
      - Thiếu log: @user1 (22h), @user2 (18h)
      - Tỷ trọng Alpha/Beta: 60%/40%
      - Tổng chi phí giờ: 320h"
  5. Gửi personal summary cho từng member
```

#### Monthly Cost Report Agent
```
Trigger: Ngày đầu tháng
Output: Báo cáo chi phí nhân sự theo project (giờ):
  ┌─────────────┬──────────┬─────────┬──────────┐
  │ Project     │ Dev (h)  │ QA (h)  │ Total (h)│
  ├─────────────┼──────────┼─────────┼──────────┤
  │ Alpha       │ 480      │ 120     │ 780      │
  │ Beta        │ 200      │ 80      │ 320      │
  │ Internal    │ 60       │ 20      │ 100      │
  │ Training    │ 40       │ 40      │ 80       │
  └─────────────┴──────────┴─────────┴──────────┘
Gửi cho: BGĐ, PM, Team Lead
```

### 6.3 Google Calendar Integration (Phase 3)

```
Architecture:
  Google Calendar API (read-only)
         ↓
  Calendar Sync Agent (chạy mỗi sáng 8:00)
         ↓
  ┌──────────────────────────────────────────┐
  │ Phân tích events hôm nay:                │
  │  - "Daily standup" → MEET-001 (15min)    │
  │  - "Sprint planning Alpha" → MEET-002    │
  │  - "Out of office" → Không cần log       │
  │  - "1:1 với [Manager]" → Tạo task mới   │
  └──────────────────────────────────────────┘
         ↓
  Gợi ý worklog cho user (sáng hoặc cuối ngày)
         ↓
  User review + approve (1 click) → log vào Clockwork

Yêu cầu:
  - Google Calendar OAuth2 (mỗi user tự authorize)
  - Meeting naming convention: "[Project]" prefix gợi ý project field
  - Admin cấu hình mapping: "Daily standup" → MEET-001
```

---

## 7. Ưu điểm & Nhược điểm

### 7.1 Ưu điểm

| Ưu điểm | Mô tả |
|---------|-------|
| **Dữ liệu thống nhất** | Một nguồn sự thật cho toàn bộ tổ chức |
| **Chi phí thực tế** | Tính được cost nhân sự theo giờ thực cho từng project |
| **Realtime visibility** | Quản lý thấy ngay ai đang làm gì, dự án nào |
| **Planning cải thiện** | Dữ liệu lịch sử giúp ước lượng sprint chính xác hơn |
| **Phát hiện bottleneck** | Ai đang spend quá nhiều giờ cho việc ngoài sản phẩm? |
| **Tự động hóa cao** | AI giảm thiểu công sức log thủ công |
| **Không thay đổi tool** | Vẫn dùng Jira — không phải học thêm hệ thống mới |

### 7.2 Nhược điểm & Giải pháp

| Nhược điểm | Mức độ | Giải pháp |
|-----------|--------|-----------|
| **Kháng cự ban đầu từ team** | Cao | Rollout từng phần, AI giảm ma sát, show value sớm |
| **Chất lượng dữ liệu phụ thuộc vào kỷ luật** | Trung bình | Auto-agent reminder + gamification (leader board) |
| **Meeting tasks cần pre-create** | Thấp | Admin tạo template đầu sprint, sau đó calendar agent tự động |
| **Khó log chính xác khi làm multitask** | Trung bình | Chấp nhận ±15 phút là đủ tốt, tập trung vào dữ liệu đủ hơn dữ liệu hoàn hảo |
| **Chi phí setup ban đầu** | Thấp | Clockwork Pro đã có sẵn, chỉ cần chuẩn hóa |
| **Google Calendar integration cần OAuth** | Thấp | Optional — không bắt buộc để system hoạt động |

### 7.3 Rủi ro cần chú ý

1. **Micromanagement perception:** Team có thể cảm thấy bị giám sát quá mức.
   - Giải pháp: Truyền thông rõ mục đích là cost tracking, không phải performance review.

2. **Gaming the system:** Một số người log giờ không thực tế để đạt ngưỡng.
   - Giải pháp: Weekly review agent phát hiện pattern bất thường (VD: log 8h một lần vào cuối tuần).

3. **Data silos trong giai đoạn chuyển đổi:** Dữ liệu cũ (story point) và mới (worklog) song song.
   - Giải pháp: Xác định cutoff date rõ ràng, không cần migrate dữ liệu cũ.

---

## 8. Roadmap Triển khai

### Phase 1 — Chuẩn hóa nền tảng (Tuần 1-2)

- [ ] Cấu hình Clockwork Pro: bật trường `Project` bắt buộc cho toàn bộ team
- [ ] Tạo Project categories chuẩn (Alpha, Beta, Internal, Training, Meeting...)
- [ ] Tạo Jira task templates cho recurring meetings và hoạt động thường xuyên
- [ ] Training session cho toàn team (30 phút, demo live)
- [ ] Document hướng dẫn nhanh per role (1 trang)

### Phase 2 — Rollout Desktop Tool (Tuần 3-4)

- [ ] Deploy Clockwork Menubar app (macOS + Windows)
- [ ] Team tự cài đặt + cấu hình API token
- [ ] Chạy thử nghiệm với 1 team (Dev hoặc DevOps — vì đã quen nhất)
- [ ] Thu thập feedback, fix edge cases
- [ ] Rollout toàn bộ team

### Phase 3 — AI Skills (Tháng 2)

- [ ] Deploy Quick Worklog Logger skill (Claude Code / Slack command)
- [ ] Deploy Task Creator + Worklog skill
- [ ] Kết nối Daily Reminder Agent qua Slack
- [ ] Chạy thử 2 tuần, đo tỷ lệ log coverage

### Phase 4 — Full Automation (Tháng 3)

- [ ] Google Calendar OAuth integration (opt-in per user)
- [ ] Calendar Sync Agent: gợi ý worklog từ calendar events
- [ ] Weekly Review Agent cho Team Lead
- [ ] Monthly Cost Report Agent cho BGĐ
- [ ] Dashboard thống kê thời gian thực (Clockwork built-in reports)

### KPI theo dõi sau triển khai

| KPI | Baseline hiện tại | Target Phase 2 | Target Phase 4 |
|-----|-------------------|----------------|----------------|
| % team có worklog đủ (≥6h/ngày) | ~20% (DevOps only) | 60% | 85%+ |
| % worklog có trường Project | ~20% | 90% | 99% |
| Thời gian log worklog/ngày | 15-20 phút (manual) | 5 phút | <2 phút (AI) |
| Độ chính xác báo cáo cost | Thấp (ước tính) | Trung bình | Cao (thực tế) |

---

## 9. Câu hỏi thường gặp (FAQ)

**Q: Tôi cần log chính xác đến phút không?**
A: Không cần. Làm tròn 15 phút là đủ (VD: 45 phút → log 1h, hoặc log 45min). Mục tiêu là dữ liệu đủ, không phải hoàn hảo.

**Q: Nếu tôi quên log cả ngày hôm qua thì sao?**
A: Dùng AI Worklog Filler skill. Nó sẽ gợi ý dựa trên Git commits và Jira activity hôm qua để bạn log bổ sung.

**Q: Meeting không gắn với issue nào cả thì log vào đâu?**
A: Log vào task MEET-XXX tương ứng đã được tạo sẵn. Nếu chưa có → dùng Task Creator skill tạo ngay (30 giây).

**Q: Ngày nghỉ phép tôi có bị reminder không?**
A: Không — chỉ cần đặt "Out of office" trên Google Calendar, agent sẽ tự nhận biết và bỏ qua ngày đó.

**Q: Story point và worklog có loại trừ nhau không?**
A: Không. Story point vẫn dùng để planning/velocity. Worklog là để track chi phí thực tế. Hai mục đích khác nhau.

**Q: Nếu tôi làm việc ngoài giờ (overtime) thì log như thế nào?**
A: Vẫn log bình thường. Clockwork Pro ghi nhận thời điểm thực tế. Report sẽ phân biệt được giờ làm trong/ngoài giờ hành chính nếu cần.

---

## 10. Tóm lược cho Ban giám đốc

**Vấn đề:** Hiện tại không thể tính được chi phí nhân sự theo giờ thực tế cho từng dự án. Mỗi team dùng một phương pháp khác nhau → không thể tổng hợp.

**Giải pháp:** Thống nhất toàn bộ team về Clockwork Pro Worklog với trường Project bắt buộc, hỗ trợ bởi desktop app và AI automation để giảm ma sát.

**Investment:** Tận dụng Clockwork Pro đã có. Chi phí chủ yếu là thời gian setup (2 tuần) và training (30 phút/person). AI agent phát triển dần theo 4 phases trong 3 tháng.

**Expected outcome:**
- Tháng 1: 60% team log đầy đủ, có trường Project
- Tháng 3: 85%+ team log đầy đủ, báo cáo cost tự động hàng tháng
- Dài hạn: Dữ liệu để lập kế hoạch nhân sự, định giá dự án và phát hiện inefficiency chính xác

---

*Tài liệu này được viết bởi: Engineering Team | Phiên bản tiếp theo sẽ bổ sung sau Phase 1 pilot.*
