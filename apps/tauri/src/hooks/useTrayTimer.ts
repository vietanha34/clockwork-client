import { invoke } from '@tauri-apps/api/core';
import { useEffect } from 'react';
import { isSquareTrayPlatform } from '../lib/platform';

function formatDuration(startedAt: string): string {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;

  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');

  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

export function useTrayTimer(
  startedAt?: string,
  issueKey?: string,
  progress?: number,
  hasUnloggedDays?: boolean,
) {
  // Update desktop tray icon state (active/idle) when timer starts/stops
  useEffect(() => {
    if (isSquareTrayPlatform()) {
      invoke('update_tray_icon_state', { active: Boolean(startedAt) }).catch(console.error);
    }
  }, [startedAt]);

  useEffect(() => {
    const isDesktop = isSquareTrayPlatform();

    // 1. Create Canvas (only needed for macOS/Linux)
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const render = () => {
      const timeStr = startedAt ? formatDuration(startedAt) : 'No timer';

      if (isDesktop) {
        const tooltip = issueKey && startedAt ? `${issueKey}: ${timeStr}` : timeStr;

        invoke('update_tray_tooltip', { tooltip }).catch(console.error);
        return;
      }

      if (!ctx) return;

      const displayKey = issueKey || '';
      const displayText = startedAt && displayKey ? `${timeStr} - ${displayKey}` : timeStr;

      // 2. Measure Text to determine Width
      // Use system font to match macOS menu bar look
      const fontSize = 11;
      const font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
      ctx.font = font;

      const textMetrics = ctx.measureText(displayText);
      const textWidth = Math.ceil(textMetrics.width);

      // Layout Config
      const paddingX = 0; // minimal padding
      const barHeight = 11; // Tăng độ cao bar
      const barY = 0; // Đẩy bar lên sát hơn
      const warningLaneWidth = hasUnloggedDays ? 16 : 0;

      const totalHeight = 23; // Standard Menu Bar Height
      const contentWidth = Math.max(textWidth, 40) + paddingX * 2; // Minimum width 40px
      const totalWidth = contentWidth + warningLaneWidth;

      // 3. Resize Canvas
      if (canvas.width !== totalWidth || canvas.height !== totalHeight) {
        canvas.width = totalWidth;
        canvas.height = totalHeight;
        // Reset font after resize
        ctx.font = font;
      }

      // 4. Clear
      ctx.clearRect(0, 0, totalWidth, totalHeight);

      // 5. Draw Progress Bar (Top)
      if (typeof progress === 'number') {
        const barTotalWidth = contentWidth;
        const barFillWidth = Math.floor(barTotalWidth * Math.min(Math.max(progress, 0), 1));

        // Draw Track (Background) - Semi-transparent White
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.roundRect(0, barY, barTotalWidth, barHeight, 3);
        ctx.fill();

        // Draw Fill (Progress) - Solid White
        if (barFillWidth > 0) {
          ctx.fillStyle = 'rgba(255, 255, 255, 1)';
          ctx.beginPath();
          ctx.roundRect(0, barY, barFillWidth, barHeight, 3);
          ctx.fill();
        }
      }

      // 6. Draw Text (Bottom)
      ctx.fillStyle = 'rgba(255, 255, 255, 1)'; // Chuyển màu chữ sang trắng
      ctx.textBaseline = 'bottom';
      ctx.textAlign = 'center';
      // Đẩy text xuống sát đáy hơn (totalHeight)
      ctx.fillText(displayText, contentWidth / 2, totalHeight + 2);

      // 7. Draw red warning dot
      if (hasUnloggedDays) {
        const radius = 4.5;
        const dotX = contentWidth + Math.floor(warningLaneWidth / 2);
        const dotY = radius + 1;

        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(dotX, dotY, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(dotX, dotY, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 8. Get Bytes
      const imageData = ctx.getImageData(0, 0, totalWidth, totalHeight);
      const buffer = Array.from(imageData.data);

      // 9. Send to Rust
      invoke('update_tray_bitmap', {
        buffer,
        width: totalWidth,
        height: totalHeight,
      }).catch(console.error);
    };

    render(); // Initial render
    const interval = setInterval(render, 1000);

    return () => clearInterval(interval);
  }, [startedAt, issueKey, progress, hasUnloggedDays]);
}
