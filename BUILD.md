# Clockwork Menubar - Build Guide

Hướng dẫn build ứng dụng Clockwork Menubar cho các nền tảng: macOS, Windows, Ubuntu/Linux.

## Yêu cầu chung (tất cả nền tảng)

- **Node.js** >= 20.0.0
- **pnpm** >= 9.0.0 (kích hoạt qua `corepack enable`)
- **Rust** toolchain (cài qua [rustup](https://rustup.rs/))

## Cài đặt Rust toolchain

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup update
```

## Cài đặt dependencies theo nền tảng

### macOS

```bash
xcode-select --install
```

### Windows

1. **Microsoft Visual Studio C++ Build Tools**
   - Tải [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
   - Chọn workload **"Desktop development with C++"**
   - Đảm bảo đã chọn:
     - MSVC v143 (hoặc mới hơn)
     - Windows 10/11 SDK

2. **WebView2**
   - Windows 10 (version 1803+) và Windows 11 đã có sẵn WebView2
   - Nếu chưa có, tải [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

3. **Rust trên Windows**
   - Tải và chạy [rustup-init.exe](https://rustup.rs/)
   - Chọn default toolchain: `stable-x86_64-pc-windows-msvc`

4. **Node.js & pnpm**
   - Tải [Node.js](https://nodejs.org/) >= 20
   - Kích hoạt pnpm:
     ```powershell
     corepack enable
     ```

### Ubuntu / Debian

```bash
# Cập nhật package list
sudo apt update

# Build dependencies cho Tauri v2
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev

# Node.js (qua NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Kích hoạt pnpm
corepack enable
```

> **Lưu ý:** Tauri v2 trên Linux sử dụng `libwebkit2gtk-4.1-dev` (không phải `4.0`). Đảm bảo cài đúng phiên bản.

### Fedora / RHEL

```bash
sudo dnf install -y \
  webkit2gtk4.1-devel \
  openssl-devel \
  curl \
  wget \
  file \
  libxdo-devel \
  libappindicator-gtk3-devel \
  librsvg2-devel

sudo dnf group install -y "C Development Tools and Libraries"
```

## Build

### 1. Clone và cài dependencies

```bash
git clone <repo-url> clockwork-client
cd clockwork-client
corepack enable
pnpm install
```

### 2. Development (chạy thử)

```bash
cd apps/tauri
pnpm tauri dev
```

### 3. Build production

```bash
cd apps/tauri
pnpm tauri build
```

Output sẽ nằm tại `apps/tauri/src-tauri/target/release/bundle/`:

| Nền tảng | Đường dẫn output | Định dạng |
|----------|-------------------|-----------|
| macOS    | `macos/Clockwork Menubar.app` | `.app`, `.dmg` |
| Windows  | `nsis/Clockwork Menubar_0.0.0_x64-setup.exe` | `.exe` (NSIS installer) |
| Ubuntu   | `deb/clockwork-menubar_0.0.0_amd64.deb` | `.deb`, `.AppImage` |

## Cross-compilation (build cho nền tảng khác)

Tauri **không hỗ trợ** cross-compilation trực tiếp. Để build cho nhiều nền tảng, sử dụng CI/CD (ví dụ GitHub Actions):

```yaml
# .github/workflows/build.yml
name: Build
on:
  push:
    tags: ['v*']

jobs:
  build:
    strategy:
      matrix:
        include:
          - platform: macos-latest
            target: aarch64-apple-darwin
          - platform: macos-latest
            target: x86_64-apple-darwin
          - platform: ubuntu-22.04
            target: x86_64-unknown-linux-gnu
          - platform: windows-latest
            target: x86_64-pc-windows-msvc

    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Install dependencies (Ubuntu)
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt update
          sudo apt install -y \
            libwebkit2gtk-4.1-dev \
            build-essential \
            libxdo-dev \
            libssl-dev \
            libayatana-appindicator3-dev \
            librsvg2-dev

      - run: pnpm install

      - name: Build Tauri
        working-directory: apps/tauri
        run: pnpm tauri build --target ${{ matrix.target }}

      - uses: actions/upload-artifact@v4
        with:
          name: bundle-${{ matrix.target }}
          path: apps/tauri/src-tauri/target/${{ matrix.target }}/release/bundle/
```

## Lưu ý theo nền tảng

### Windows
- Tray icon hoạt động mặc định, không cần config thêm
- `macOSPrivateApi` trong config sẽ tự động bị bỏ qua trên Windows

### Ubuntu / Linux
- Tray icon sử dụng `libayatana-appindicator`. Một số desktop environment (GNOME mặc định) không hiển thị tray icon — cần cài extension như [AppIndicator](https://extensions.gnome.org/extension/615/appindicator-support/)
- Cửa sổ transparent có thể không hoạt động trên một số compositors (Wayland). Nếu gặp lỗi, thử chạy với `GDK_BACKEND=x11`

### macOS
- Cần có `icon.icns` trong `src-tauri/icons/`
- `macOSPrivateApi` được bật để hỗ trợ tray icon positioning

## Troubleshooting

| Lỗi | Giải pháp |
|-----|-----------|
| `error: failed to run custom build command for webkit2gtk-sys` | Cài `libwebkit2gtk-4.1-dev` (Ubuntu) |
| `error: linker 'cc' not found` | Cài `build-essential` (Ubuntu) hoặc MSVC Build Tools (Windows) |
| `pnpm: command not found` | Chạy `corepack enable` |
| App build xong nhưng không hiện tray icon (Linux) | Cài AppIndicator extension cho GNOME |
| Window hiện nền đen thay vì transparent (Linux) | Chạy với `GDK_BACKEND=x11` |
