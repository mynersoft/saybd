/**
 * SayBD - Client-Side Social Progress Card Generator
 * Renders a high-resolution 1080x1350 social-ready PNG image
 * using HTML5 Canvas with the student's real monthly practice data.
 * 
 * Strict Privacy & Anti-Slop:
 * - Never exposes private details (email, phone, address).
 * - Excludes mentor classroom time (strictly 1-on-1 speaking minutes).
 * - Displays official app URL with promotional branding.
 * - NO referral codes or links.
 */

export function getOfficialAppUrl() {
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }
  return 'https://saybd.app';
}

// Helper to draw rounded rectangles safely across all browser canvas implementations
function drawRoundedRect(ctx, x, y, width, height, radius) {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    return;
  }
  // Fallback for older canvas implementations
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export async function generateMonthlyProgressCard({
  studentName = 'SayBD Member',
  monthName = 'November',
  monthNumber = 11,
  year = 2026,
  practiceData = {},
  appUrl = getOfficialAppUrl(),
}) {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      const width = 1080;
      const height = 1350;
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas 2D context not available');
      }

      // --- 1. Background Fill & Subtle Glows ---
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#090b10');
      bgGrad.addColorStop(0.5, '#0e121b');
      bgGrad.addColorStop(1, '#07090e');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Top-right subtle emerald glow
      const trGlow = ctx.createRadialGradient(width - 100, 150, 20, width - 100, 150, 450);
      trGlow.addColorStop(0, 'rgba(16, 185, 129, 0.15)');
      trGlow.addColorStop(1, 'rgba(16, 185, 129, 0)');
      ctx.fillStyle = trGlow;
      ctx.fillRect(0, 0, width, height);

      // Bottom-left subtle indigo glow
      const blGlow = ctx.createRadialGradient(150, height - 150, 20, 150, height - 150, 450);
      blGlow.addColorStop(0, 'rgba(99, 102, 241, 0.14)');
      blGlow.addColorStop(1, 'rgba(99, 102, 241, 0)');
      ctx.fillStyle = blGlow;
      ctx.fillRect(0, 0, width, height);

      // --- 2. Outer Decorative Frame ---
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, 30, 30, width - 60, height - 60, 36);
      ctx.stroke();

      // --- 3. Top Header: SayBD Branding ---
      const headerY = 80;

      // SayBD Logo Icon (Indigo & Emerald badge)
      const iconX = 70;
      const iconY = headerY;
      const iconSize = 64;
      const iconGrad = ctx.createLinearGradient(iconX, iconY, iconX + iconSize, iconY + iconSize);
      iconGrad.addColorStop(0, '#6366f1');
      iconGrad.addColorStop(1, '#4338ca');
      ctx.fillStyle = iconGrad;
      drawRoundedRect(ctx, iconX, iconY, iconSize, iconSize, 18);
      ctx.fill();

      // Speech bubble glyph inside icon
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      // Chat bubble
      ctx.arc(iconX + 32, iconY + 28, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(iconX + 24, iconY + 34);
      ctx.lineTo(iconX + 16, iconY + 44);
      ctx.lineTo(iconX + 32, iconY + 38);
      ctx.closePath();
      ctx.fill();

      // Sparkle dot in top-right of logo icon
      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      ctx.arc(iconX + iconSize - 12, iconY + 14, 5, 0, Math.PI * 2);
      ctx.fill();

      // SayBD Brand Name
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 38px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('SayBD', iconX + iconSize + 18, headerY + 4);

      // Tagline: "Practice English. Connect. Improve."
      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 18px system-ui, -apple-system, sans-serif';
      ctx.fillText('Practice English. Connect. Improve.', iconX + iconSize + 18, headerY + 46);

      // Official URL Pill on top-right
      const displayUrl = appUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const pillText = displayUrl.length > 32 ? displayUrl.substring(0, 30) + '...' : displayUrl;
      ctx.font = '700 15px monospace, system-ui, sans-serif';
      const pillWidth = ctx.measureText(pillText).width + 36;
      const pillHeight = 36;
      const pillX = width - 70 - pillWidth;
      const pillY = headerY + 14;

      ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';
      drawRoundedRect(ctx, pillX, pillY, pillWidth, pillHeight, 18);
      ctx.fill();
      ctx.strokeStyle = 'rgba(129, 140, 248, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#a5b4fc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pillText, pillX + pillWidth / 2, pillY + pillHeight / 2);

      // Divider line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(70, 168);
      ctx.lineTo(width - 70, 168);
      ctx.stroke();

      // --- 4. Student Practice Title & Monthly Stats ---
      const titleY = 195;

      // Student name progress headline (Safe: first name / full name only, no emails)
      const cleanStudentName = studentName && studentName.trim() ? studentName : 'Amina Rahman';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 32px system-ui, -apple-system, sans-serif';
      ctx.fillText(`${cleanStudentName}'s Monthly Practice`, 70, titleY);

      // Sub-label with Month & Year
      ctx.fillStyle = '#34d399';
      ctx.font = '700 20px system-ui, -apple-system, sans-serif';
      ctx.fillText(`One-to-One English Speaking • ${monthName} ${year}`, 70, titleY + 42);

      // Calculate monthly stats from practiceData
      const daysInMonth = new Date(year, monthNumber, 0).getDate();
      let totalMinutes = 0;
      let activeDaysCount = 0;
      let bestDayMinutes = 0;

      for (let d = 1; d <= daysInMonth; d++) {
        const mins = practiceData[d] || 0;
        if (mins > 0) {
          totalMinutes += mins;
          activeDaysCount++;
          if (mins > bestDayMinutes) bestDayMinutes = mins;
        }
      }

      // Three stat pill cards: Total Time, Active Days, Avg per Active Day
      const statsY = 275;
      const statCardWidth = 300;
      const statCardHeight = 84;
      const statSpacing = (width - 140 - statCardWidth * 3) / 2;

      const statItems = [
        {
          label: 'TOTAL SPEAKING TIME',
          value: `${totalMinutes} min`,
          sub: totalMinutes >= 60 ? `~${(totalMinutes / 60).toFixed(1)} hours` : 'One-to-one calls',
          color: '#38bdf8'
        },
        {
          label: 'ACTIVE DAYS',
          value: `${activeDaysCount} days`,
          sub: `${Math.round((activeDaysCount / daysInMonth) * 100)}% consistency`,
          color: '#34d399'
        },
        {
          label: 'BEST SESSION',
          value: `${bestDayMinutes} min`,
          sub: 'Daily max allowance: 20m',
          color: '#fbbf24'
        }
      ];

      statItems.forEach((st, idx) => {
        const sx = 70 + idx * (statCardWidth + statSpacing);
        ctx.fillStyle = 'rgba(26, 30, 42, 0.7)';
        drawRoundedRect(ctx, sx, statsY, statCardWidth, statCardHeight, 20);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#94a3b8';
        ctx.font = '700 11px system-ui, -apple-system, sans-serif';
        ctx.fillText(st.label, sx + 20, statsY + 14);

        ctx.fillStyle = st.color;
        ctx.font = '800 24px system-ui, -apple-system, sans-serif';
        ctx.fillText(st.value, sx + 20, statsY + 32);

        ctx.fillStyle = '#64748b';
        ctx.font = '600 12px system-ui, -apple-system, sans-serif';
        ctx.fillText(st.sub, sx + 20, statsY + 60);
      });

      // --- 5. Calendar Container (Matching User's Reference Screenshot) ---
      const calBoxY = 385;
      const calBoxWidth = width - 140;
      const calBoxHeight = 675;

      // Dark card container matching screenshot background #0b0d13
      ctx.fillStyle = '#0b0d13';
      drawRoundedRect(ctx, 70, calBoxY, calBoxWidth, calBoxHeight, 28);
      ctx.fill();
      ctx.strokeStyle = '#1e2433';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Calendar Header: "Monthly Practice Time"
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 24px system-ui, -apple-system, sans-serif';
      ctx.fillText('Monthly Practice Time', 105, calBoxY + 24);

      // Month & Year: e.g. "November 2026"
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 34px system-ui, -apple-system, sans-serif';
      ctx.fillText(`${monthName} ${year}`, 105, calBoxY + 58);

      // Weekday Labels: Sun Mon Tue Wed Thu Fri Sat
      const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const gridStartX = 100;
      const gridStartY = calBoxY + 120;
      const gridTotalWidth = calBoxWidth - 60;
      const colWidth = gridTotalWidth / 7;
      const cellGap = 8;
      const actualCellWidth = colWidth - cellGap;
      const cellHeight = 72;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '700 15px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#94a3b8';

      weekdays.forEach((day, idx) => {
        const cx = gridStartX + idx * colWidth + actualCellWidth / 2;
        ctx.fillText(day, cx, gridStartY + 14);
      });

      // Calendar Grid Days
      const firstDayOfWeek = new Date(year, monthNumber - 1, 1).getDay(); // 0 = Sun
      const dayGridStartY = gridStartY + 36;

      let currentDay = 1;
      let row = 0;

      while (currentDay <= daysInMonth) {
        for (let col = 0; col < 7; col++) {
          if (row === 0 && col < firstDayOfWeek) {
            // empty cell before 1st of month
            continue;
          }
          if (currentDay > daysInMonth) {
            break;
          }

          const cellX = gridStartX + col * colWidth;
          const cellY = dayGridStartY + row * (cellHeight + cellGap);
          const minutes = practiceData[currentDay] || 0;
          const isActive = minutes > 0;
          const isHighPractice = minutes >= 20;

          // Cell Background & Border matching screenshot
          if (isHighPractice || isActive) {
            // Dark Emerald Green Tile (#062412 with #0d4724 border)
            ctx.fillStyle = '#062412';
            drawRoundedRect(ctx, cellX, cellY, actualCellWidth, cellHeight, 16);
            ctx.fill();
            ctx.strokeStyle = isHighPractice ? '#10b981' : '#0d4724';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Day Number
            ctx.fillStyle = '#34d399';
            ctx.font = '800 18px system-ui, -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(String(currentDay), cellX + actualCellWidth / 2, cellY + 10);

            // Practice minutes text (e.g. 20m, 8m, 12m)
            ctx.fillStyle = '#4ade80';
            ctx.font = '800 15px system-ui, -apple-system, sans-serif';
            ctx.textBaseline = 'bottom';
            ctx.fillText(`${minutes}m`, cellX + actualCellWidth / 2, cellY + cellHeight - 10);
          } else {
            // Inactive day tile (#1a1d26 with #232733 border)
            ctx.fillStyle = '#1a1d26';
            drawRoundedRect(ctx, cellX, cellY, actualCellWidth, cellHeight, 16);
            ctx.fill();
            ctx.strokeStyle = '#232733';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Day Number
            ctx.fillStyle = '#f1f5f9';
            ctx.font = '600 17px system-ui, -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(String(currentDay), cellX + actualCellWidth / 2, cellY + 10);

            // Dash '-'
            ctx.fillStyle = '#64748b';
            ctx.font = '700 15px system-ui, -apple-system, sans-serif';
            ctx.textBaseline = 'bottom';
            ctx.fillText('–', cellX + actualCellWidth / 2, cellY + cellHeight - 10);
          }

          currentDay++;
        }
        row++;
      }

      // Calendar bottom caption matching screenshot
      const calCaptionY = calBoxY + calBoxHeight - 34;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#64748b';
      ctx.font = '600 14px system-ui, -apple-system, sans-serif';
      ctx.fillText('প্রতিদিনের Practice duration · Asia/Dhaka Timezone', 105, calCaptionY);

      // --- 6. Promotional Footer: SayBD Brand Invitation ---
      const promoBoxY = 1085;
      const promoBoxHeight = 185;
      const promoBoxWidth = width - 140;

      // Indigo-to-blue promotional banner
      const promoGrad = ctx.createLinearGradient(70, promoBoxY, 70 + promoBoxWidth, promoBoxY + promoBoxHeight);
      promoGrad.addColorStop(0, 'rgba(49, 46, 129, 0.7)');
      promoGrad.addColorStop(0.5, 'rgba(30, 27, 75, 0.85)');
      promoGrad.addColorStop(1, 'rgba(15, 23, 42, 0.9)');
      ctx.fillStyle = promoGrad;
      drawRoundedRect(ctx, 70, promoBoxY, promoBoxWidth, promoBoxHeight, 26);
      ctx.fill();
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Promotional invitation headline
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 26px system-ui, -apple-system, sans-serif';
      ctx.fillText('Join SayBD and start speaking English!', 105, promoBoxY + 28);

      // Supporting copy
      ctx.fillStyle = '#c7d2fe';
      ctx.font = '500 16px system-ui, -apple-system, sans-serif';
      ctx.fillText('Free 1-on-1 English partner matching • Live mentor masterclasses', 105, promoBoxY + 68);

      // App URL pill button inside promo box
      const joinBtnY = promoBoxY + 105;
      const joinBtnHeight = 48;
      const joinBtnWidth = 440;
      ctx.fillStyle = '#6366f1';
      drawRoundedRect(ctx, 105, joinBtnY, joinBtnWidth, joinBtnHeight, 16);
      ctx.fill();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 18px system-ui, -apple-system, sans-serif';
      ctx.fillText(`Practice now at: ${displayUrl}`, 105 + joinBtnWidth / 2, joinBtnY + joinBtnHeight / 2);

      // Right-side badge
      ctx.textAlign = 'right';
      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 14px system-ui, -apple-system, sans-serif';
      ctx.fillText('Real Practice • Verified Members', width - 105, promoBoxY + 128);

      // --- 7. Export as Data URL & Blob ---
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to generate image blob'));
          return;
        }
        const dataUrl = canvas.toDataURL('image/png');
        resolve({
          dataUrl,
          blob,
          filename: `saybd-progress-${monthName.toLowerCase()}-${year}.png`,
          width,
          height
        });
      }, 'image/png');

    } catch (error) {
      reject(error);
    }
  });
}
